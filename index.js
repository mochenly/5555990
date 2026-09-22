import { infoblockTheme } from './modules/infoblock-themes.js';
import { SECRET_OWNERS, secretLimit, secretSlots, sameSecret } from './modules/secrets.js';
import { extension_settings, getContext } from '/scripts/extensions.js';
import {
    eventSource,
    event_types,
    extension_prompt_roles,
    extension_prompt_types,
    getCurrentChatId,
    reloadCurrentChat,
    saveSettingsDebounced,
    setExtensionPrompt,
    system_message_types,
    user_avatar,
} from '/script.js';
import { ConnectionManagerRequestService } from '/scripts/extensions/shared.js';
import {
    DEFAULT_SETTINGS,
    EXTENSION_KEY,
    INFOBLOCK_PROMPT_KEY,
    MENU_BUTTON_ID,
    POPUP_ID,
    PROMPT_KEY,
    RELATIONSHIP_METRICS,
    STATE_KEY,
} from './modules/config.js';
import { clampPercent, contiguousRanges, escapeHtml, notify } from './modules/utils.js';
import { isRussianUi, observeTranslation, t } from './modules/i18n.js';
import { buildAnalysisPrompt as composeAnalysisPrompt, buildArcPrompt, buildMemoryInjection } from './modules/prompts.js';
import { menuHtml, popupHtml } from './modules/template.js';
import { applyCalendarUpdates, dateFromIso, formatCalendarDate, renderCalendar, syncCalendarDate } from './modules/calendar.js';
import { fetchModels, parseJsonResponse, requestModel } from './modules/model-api.js';
import { applyGalleryUpdates, applyHealthUpdate, applyRelationshipUpdate, applySecretsUpdate, applyWorldUpdate, createState, getState, normalizeState, reconcileStateWithChat, storeSnapshot } from './modules/state.js';
import { arcMessageText, normalizeRecap, recapMarkdown, resolvedThreadIndices } from './modules/arc-summary.js';
import { createRenderer } from './modules/renderer.js';
import { createGalleryImages } from './modules/gallery-images.js';
import { createSectionEditor } from './modules/editor.js';
import { createGalleryController } from './modules/gallery.js';
import { createFocusController } from './modules/focus.js';
import { createGallerySettings } from './modules/gallery-settings.js';
import { initializeGallerySettings } from './modules/gallery-data.js';
import { candidateIndices, participantContext, prepareRebuiltChat, validateManualArcs, wholeChatIndices } from './modules/analysis.js';
import { applySceneToState, buildInfoblock, hasSceneTag, infoblockInstruction, lastCharacterMessageIndex, parseSceneTag, readStoredScene, removeInfoblocks, renderInfoblock, sceneTagSource, setTrailFocus, storeScene, stripSceneTagFromMessage } from './modules/infoblock.js';
// ВРЕМЕННО: предпросмотр заполненного интерфейса, удалить вместе с demo.js.
import { fillDemoState } from './modules/demo.js';

let settings;
let processing = false;
let chatEpoch = 0;
let manualRunCancelled = false;
let galleryImages;
let gallery;
let gallerySettings;
// Список моделей ручного подключения живёт в памяти сессии: он зависит от
// адреса и ключа, поэтому в настройках его хранить нечего.
let manualModels = [];
let manualModelsSource = '';
let manualModelsBusy = false;

const { getParticipantVisuals, renderGallery, renderOverview, setSecretPeek, isPeeking, peekedOwners } = createRenderer({
    getState,
    getSettings: () => settings,
    isProcessing: () => processing,
    candidateIndices,
    getGalleryImageConfig: () => galleryImages?.getGalleryImageConfig(),
    getGalleryStatus: () => gallery?.status() || { expanded: new Set() },
});
galleryImages = createGalleryImages();
gallery = createGalleryController({ getState, getSettings: () => settings, images: galleryImages, renderGallery: state => { renderGallery(state); decorateInfoblocks(); }, onChanged: updateArcInjection, isProcessing: () => processing || Boolean(focus.status().busy) });
gallerySettings = createGallerySettings({ getSettings: () => settings, saveSettings, onChanged: () => renderGallery(getState({ create: false })) });
// Фокусная генерация раздела: секреты и планы по отдельной кнопке, без общего
// анализа. Перерисовываем всё, чего она касается, — попап и плашку в чате.
const focus = createFocusController({
    getState,
    getSettings: () => settings,
    isProcessing: () => processing || Boolean(gallery.status().busy),
    onChanged: () => {
        updateArcInjection();
        renderOverview();
        if (settings.infoblock) decorateInfoblocks();
        syncFocusButtons();
    },
});
const sectionEditor = createSectionEditor({
    getSettings: () => settings,
    getState,
    isBusy: () => processing || Boolean(gallery.status().busy) || Boolean(focus.status().busy),
    onSaved: () => {
        updateArcInjection();
        renderOverview();
        if (settings.infoblock) decorateInfoblocks();
    },
});

function loadSettings() {
    extension_settings[EXTENSION_KEY] = {
        ...DEFAULT_SETTINGS,
        ...(extension_settings[EXTENSION_KEY] || {}),
    };
    settings = extension_settings[EXTENSION_KEY];
    delete settings.temperature;
    settings.infoblockTheme = infoblockTheme(settings.infoblockTheme);
    initializeGallerySettings(settings);
    saveSettingsDebounced();
}

function saveSettings() {
    settings.interval = Math.max(1, Math.min(100, Number(settings.interval) || DEFAULT_SETTINGS.interval));
    settings.arcMaxMessages = Math.max(0, Math.min(500, Math.round(Number(settings.arcMaxMessages) || 0)));
    settings.arcMaxTokens = Math.max(0, Math.min(200000, Math.round(Number(settings.arcMaxTokens) || 0)));
    settings.arcVisibleBuffer = Math.max(0, Math.min(200, Math.round(Number(settings.arcVisibleBuffer) || 0)));
    // Ноль читаем как «без предела»: иначе опечатка в поле молча слила бы все
    // арки истории в одну.
    // Ноль здесь — осмысленное значение («без предела»), поэтому `|| default`
    // не годится: он проглотил бы его вместе с мусором. Отличаем одно от другого.
    const arcLimit = Math.round(Number(settings.arcLimit));
    settings.arcLimit = Math.max(0, Math.min(50, Number.isFinite(arcLimit) ? arcLimit : DEFAULT_SETTINGS.arcLimit));
    settings.secretLimits = Object.fromEntries(SECRET_OWNERS.map(owner => [owner, secretLimit(settings, owner)]));
    saveSettingsDebounced();
    updateArcInjection();
}

function getProfiles() {
    try {
        return ConnectionManagerRequestService.getSupportedProfiles();
    } catch (error) {
        console.warn('[Mnema] Connection Manager is unavailable:', error);
        return [];
    }
}

function refreshProfileOptions() {
    const select = document.getElementById('mnema_profile');
    if (!select) return;
    const profiles = getProfiles();
    select.innerHTML = profiles.length
        ? profiles.map(profile => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name || profile.model || profile.id)}</option>`).join('')
        : '<option value="">Нет доступных профилей</option>';
    select.value = settings.profileId || '';
    if (!select.value && profiles[0]) {
        settings.profileId = profiles[0].id;
        select.value = settings.profileId;
        saveSettings();
    }
}

function manualEndpointKey() {
    return `${String(settings.apiUrl || '').trim()}\n${String(settings.apiKey || '').trim()}`;
}

function renderManualModels() {
    const list = document.getElementById('mnema_model_options');
    if (!list) return;
    list.innerHTML = manualModels.map(model => `<option value="${escapeHtml(model)}"></option>`).join('');
    $('#mnema_model_refresh').prop('disabled', manualModelsBusy)
        .find('i').toggleClass('fa-spin', manualModelsBusy);
    $('#mnema_model').attr('title', manualModels.length
        ? t('Доступно моделей: {n}', { n: manualModels.length })
        : t('Нажмите «обновить», чтобы загрузить список моделей'));
}

// silent: авто-подгрузка при открытии настроек, о неудаче молчим — адрес могут
// ещё дописывать. Явное нажатие кнопки сообщает и об ошибке, и о результате.
async function refreshManualModels({ silent = false } = {}) {
    if (manualModelsBusy) return;
    const endpoint = manualEndpointKey();
    if (!String(settings.apiUrl || '').trim()) {
        if (!silent) notify('Сначала укажите API URL', 'error');
        return;
    }
    // Список от прежнего адреса больше не применим — убираем до загрузки.
    if (endpoint !== manualModelsSource) { manualModels = []; manualModelsSource = ''; }
    manualModelsBusy = true;
    renderManualModels();
    try {
        const models = await fetchModels(settings);
        if (endpoint !== manualEndpointKey()) return;
        manualModels = models;
        manualModelsSource = endpoint;
        if (!silent) notify(t('Загружено моделей: {n}', { n: models.length }), 'success');
    } catch (error) {
        console.warn('[Mnema] Не удалось получить список моделей:', error);
        if (endpoint === manualEndpointKey()) { manualModels = []; manualModelsSource = ''; }
        if (!silent) notify(error.message || String(error), 'error');
    } finally {
        manualModelsBusy = false;
        renderManualModels();
    }
}

function syncManualModels() {
    renderManualModels();
    if (settings.connectionMode !== 'manual' || manualModelsBusy) return;
    if (!String(settings.apiUrl || '').trim() || manualModelsSource === manualEndpointKey()) return;
    void refreshManualModels({ silent: true });
}

function updateSectionVisibility() {
    const visibility = {
        relationships: settings.trackRelationships,
        calendar: settings.trackCalendar,
        health: settings.trackHealth,
        secrets: settings.trackSecrets,
        gallery: settings.collectGallery,
    };
    for (const [tab, visible] of Object.entries(visibility)) {
        $(`.mnema-tab-btn[data-mnema-tab="${tab}"]`).prop('hidden', !visible);
    }
    $('.mnema-sidebar-label').each(function () {
        const group = $(this).nextUntil('.mnema-sidebar-label', '.mnema-tab-btn');
        $(this).prop('hidden', group.length > 0 && group.filter(':visible').length === 0);
    });
    const activeTab = $('.mnema-tab-btn.active').attr('data-mnema-tab');
    if (activeTab && visibility[activeTab] === false) $('.mnema-tab-btn[data-mnema-tab="overview"]').trigger('click');
}

function syncSettingsUi() {
    $('#mnema_enabled').prop('checked', settings.enabled);
    $('#mnema_interval').val(settings.interval);
    $('#mnema_arc_max_messages').val(settings.arcMaxMessages || '');
    $('#mnema_arc_max_tokens').val(settings.arcMaxTokens || '');
    $('#mnema_arc_visible_buffer').val(settings.arcVisibleBuffer || '');
    $('#mnema_arc_limit').val(settings.arcLimit || '');
    $('#mnema_connection_mode').val(settings.connectionMode);
    $('#mnema_api_url').val(settings.apiUrl);
    $('#mnema_api_key').val(settings.apiKey);
    $('#mnema_model').val(settings.model);
    $('#mnema_track_relationships').prop('checked', settings.trackRelationships);
    $('#mnema_track_calendar').prop('checked', settings.trackCalendar);
    $('#mnema_track_health').prop('checked', settings.trackHealth);
    for (const owner of SECRET_OWNERS) $(`#mnema_secret_limit_${owner}`).val(secretLimit(settings, owner));
    $('#mnema_track_secrets').prop('checked', settings.trackSecrets);
    $('#mnema_collect_gallery').prop('checked', settings.collectGallery);
    $('#mnema_infoblock').prop('checked', settings.infoblock);
    $(`[name="mnema_infoblock_theme"][value="${infoblockTheme(settings.infoblockTheme)}"]`).prop('checked', true);
    gallerySettings.sync();
    refreshProfileOptions();
    const manual = settings.connectionMode === 'manual';
    $('#mnema_profile_fields').prop('hidden', manual);
    $('#mnema_manual_fields').prop('hidden', !manual);
    syncManualModels();
    updateSectionVisibility();
}

function messageLabel(chat, index) {
    const message = chat[index];
    const context = getContext();
    return message?.name || (message?.is_user ? context?.name1 : context?.name2) || t(message?.is_user ? 'Пользователь' : 'Персонаж');
}

function openPopup() {
    const popup = document.getElementById(POPUP_ID);
    if (!popup) return;
    popup.hidden = false;
    document.body.classList.add('mnema-popup-open');
    syncSettingsUi();
    renderOverview();
    syncFocusButtons();
}

// Кнопки фокусной генерации живут и в попапе, и в плашке под сообщением,
// причём плашка перерисовывается сама по себе. Поэтому состояние проставляем им
// по атрибуту, а не из рендера конкретного раздела.
function syncFocusButtons() {
    const busy = focus.status().busy;
    const disabled = Boolean(busy) || processing || Boolean(gallery?.status().busy);
    $('[data-mnema-focus]').each(function () {
        const active = Boolean(busy) && busy.kind === this.dataset.mnemaFocus
            && (busy.kind !== 'secrets' || busy.owner === this.dataset.focusOwner);
        this.disabled = disabled;
        this.setAttribute('aria-busy', String(active));
        // Иконку покоя берём с самой кнопки: у кнопок фокуса они разные, и
        // возвращать всем палочку значит стереть чужую после первой же генерации.
        $(this).find('i').attr('class', active ? 'fa-solid fa-spinner fa-spin' : (this.dataset.focusIcon || 'fa-solid fa-wand-magic-sparkles'));
    });
}

function closePopup() {
    const popup = document.getElementById(POPUP_ID);
    if (!popup || popup.hidden) return;
    popup.hidden = true;
    document.body.classList.remove('mnema-popup-open');
    // Спойлер закрывается вместе с попапом — иначе тайны «протекают» в чат.
    if (isPeeking()) { setSecretPeek(null); if (settings.infoblock) decorateInfoblocks(); }
}

function serializeMessages(chat, indices) {
    return indices.map(index => ({ index, speaker: messageLabel(chat, index), role: chat[index].is_user ? 'user' : 'assistant', text: String(chat[index].mes || '') }));
}

function shiftRange(range, fromIndex, delta) {
    if (!Array.isArray(range) || range.length < 2) return range;
    return range.map(index => Number(index) >= fromIndex ? Number(index) + delta : Number(index));
}

function shiftStateIndices(state, fromIndex, delta) {
    if (state.processedThrough >= fromIndex) state.processedThrough += delta;
    if (Number.isInteger(state.calendar?.sourceMessageIndex) && state.calendar.sourceMessageIndex >= fromIndex) state.calendar.sourceMessageIndex += delta;
    state.pending.messageIndices = state.pending.messageIndices.map(index => index >= fromIndex ? index + delta : index);
    for (const note of state.pending.eventNotes) note.range = shiftRange(note.range, fromIndex, delta);
    for (const arc of state.arcs) {
        arc.messageIndices = (arc.messageIndices || []).map(index => index >= fromIndex ? index + delta : index);
        arc.range = shiftRange(arc.range, fromIndex, delta);
        if (Number.isInteger(arc.summaryMessageIndex) && arc.summaryMessageIndex >= fromIndex) arc.summaryMessageIndex += delta;
    }
}

function createArcMessage(arc) {
    return {
        name: 'Mnema',
        is_user: false,
        is_system: arc.active === false,
        mes: arcMessageText(arc),
        send_date: new Date().toISOString(),
        extra: {
            type: system_message_types.NARRATOR,
            swipeable: false,
            mnema_arc_id: arc.id,
        },
    };
}

function findArcMessageIndex(chat, arc) {
    const markedIndex = chat.findIndex(message => message?.extra?.mnema_arc_id === arc.id);
    return markedIndex >= 0 ? markedIndex : null;
}

function insertArcMessage(chat, state, arc, insertAt) {
    shiftStateIndices(state, insertAt, 1);
    chat.splice(insertAt, 0, createArcMessage(arc));
    arc.summaryMessageIndex = insertAt;
}

// Конспект встаёт сразу за последним сообщением арки: он заменяет собой блок,
// а не открывает его. Иначе в ленте выходит «конспект, а под ним стена
// свёрнутого прошлого», и следующая живая реплика уезжает вниз.
function arcInsertPosition(indices) {
    return Math.max(...indices) + 1;
}

function arcFoldLabel(arc, count, unfolded) {
    return unfolded
        ? t('Свернуть исходные сообщения ({n})', { n: count })
        : t('Арка «{title}» · {n} сообщений свёрнуто', { title: arc.title, n: count });
}

// Исходные сообщения арки остаются в чате (на них живут снимки состояния и по
// ним идёт пересчёт всего чата), но в ленте их заменяет одна полоска.
function foldArcSources(chatElement, messageElements, state, chat = []) {
    const byIndex = new Map(messageElements.map(element => [Number(element.getAttribute('mesid')), element]));
    const unfoldedArcs = new Set([...chatElement.querySelectorAll('.mnema-arc-fold.open')].map(node => node.dataset.arcId));
    chatElement.querySelectorAll('.mnema-arc-fold').forEach(node => node.remove());
    for (const arc of state?.arcs || []) {
        // Выключенная арка снова отдаёт исходники модели — прятать их в этот
        // момент значило бы показывать не то, что уходит в промпт.
        if (arc.active === false) continue;
        // По той же причине не сворачиваем хвост, оставленный буфером видимости:
        // эти сообщения не скрыты и идут в промпт целиком.
        const elements = (arc.messageIndices || []).filter(index => chat[index]?.is_system !== false)
            .map(index => byIndex.get(index)).filter(Boolean);
        if (!elements.length) continue;
        const unfolded = unfoldedArcs.has(arc.id);
        for (const element of elements) {
            element.classList.add('mnema-arc-source');
            element.classList.toggle('mnema-arc-unfolded', unfolded);
            element.dataset.mnemaFold = arc.id;
        }
        const bar = document.createElement('div');
        bar.className = unfolded ? 'mnema-arc-fold open' : 'mnema-arc-fold';
        bar.dataset.arcId = arc.id;
        bar.innerHTML = `<i class="fa-solid fa-chevron-right"></i><span>${escapeHtml(arcFoldLabel(arc, elements.length, unfolded))}</span>`;
        elements[0].parentNode.insertBefore(bar, elements[0]);
    }
}

function decorateArcMessages() {
    const chatElement = document.getElementById('chat');
    const chat = getContext()?.chat;
    if (!chatElement || !Array.isArray(chat)) return;
    // Поиск строго внутри #chat и только по числовому mesid: у скрытого шаблона
    // сообщения SillyTavern атрибут mesid пустой, а Number('') === 0. Без этой
    // проверки класс арки садился на сам шаблон, и его наследовали все
    // отрисованные позже сообщения — подпись «сюжетная память» расползалась по
    // всему чату после первой же арки с нулевым сообщением внутри.
    const messageElements = [...chatElement.querySelectorAll('.mes[mesid]')]
        .filter(element => /^\d+$/.test(element.getAttribute('mesid') || ''));
    for (const element of messageElements) {
        const index = Number(element.getAttribute('mesid'));
        element.classList.toggle('mnema-arc-message', Boolean(chat[index]?.extra?.mnema_arc_id));
        element.classList.remove('mnema-arc-source', 'mnema-arc-unfolded');
        delete element.dataset.mnemaFold;
    }
    foldArcSources(chatElement, messageElements, getState({ create: false }), chat);
}

async function migrateArcMessages(chat, state) {
    let changed = false;
    for (const arc of state.arcs) {
        const existingIndex = findArcMessageIndex(chat, arc);
        if (existingIndex !== null) {
            arc.summaryMessageIndex = existingIndex;
            continue;
        }
        const covered = (arc.messageIndices || []).filter(Number.isInteger);
        if (!covered.length) continue;
        const insertAt = arcInsertPosition(covered);
        if (!Number.isFinite(insertAt) || insertAt > chat.length) continue;
        insertArcMessage(chat, state, arc, insertAt);
        changed = true;
    }
    if (changed) {
        await getContext().saveChat();
        await reloadCurrentChat();
    }
    return changed;
}

function buildAnalysisPrompt(chat, state, indices, options = {}) {
    const context = getContext();
    return composeAnalysisPrompt({
        state,
        settings,
        characterName: context?.name2,
        userName: context?.name1,
        participants: participantContext(context || {}),
        messages: serializeMessages(chat, indices),
        ...options,
    });
}
async function countTokens(text) {
    try {
        const count = await getContext()?.getTokenCountAsync?.(text);
        if (Number.isFinite(count)) return count;
    } catch (error) {
        console.warn('[Mnema] Токенизатор недоступен, оцениваю приблизительно:', error);
    }
    // Грубая оценка на случай недоступного токенизатора: ~4 символа на токен.
    return Math.ceil(text.length / 4);
}

// Страховка от бесконечной арки: модель закрывает её по сюжету, а лимиты — по
// объёму накопленного, чтобы конспект оставался пригодным для пересказа.
async function arcLimitReached(chat, state) {
    const indices = state.pending.messageIndices;
    if (!indices.length) return false;
    const maxMessages = Number(settings.arcMaxMessages) || 0;
    if (maxMessages > 0 && indices.length >= maxMessages) {
        console.log(`[Mnema] Лимит арки по сообщениям: ${indices.length}/${maxMessages}`);
        return true;
    }
    const maxTokens = Number(settings.arcMaxTokens) || 0;
    if (maxTokens > 0) {
        const tokens = await countTokens(indices.map(index => String(chat[index]?.mes || '')).join('\n'));
        if (tokens >= maxTokens) {
            console.log(`[Mnema] Лимит арки по токенам: ${tokens}/${maxTokens}`);
            return true;
        }
    }
    return false;
}

async function analyzeBatch(chat, state, indices, epoch, options = {}) {
    // replaceNote — повторная проверка уже разобранного интервала: заметка о нём
    // заменяется, а не ложится второй копией. В промпт этот флаг не идёт.
    const { replaceNote = null, ...promptOptions } = options;
    const messages = buildAnalysisPrompt(chat, state, indices, promptOptions);
    const result = parseJsonResponse(await requestModel(messages, settings, 1800));
    if (epoch !== chatEpoch || getContext()?.chat !== chat) throw new Error('Чат сменился во время анализа');
    const summary = String(result.event_summary || result.summary || '').trim();
    if (!summary) throw new Error('В ответе модели отсутствует event_summary');
    state.pending.messageIndices.push(...indices);
    state.pending.messageIndices = [...new Set(state.pending.messageIndices)].sort((a, b) => a - b);
    const closeArc = result.close_arc === true || String(result.close_arc).toLowerCase() === 'true';
    const note = { range: [indices[0], indices[indices.length - 1]], summary, closeArc, arcReason: String(result.arc_reason || '').trim(), createdAt: new Date().toISOString() };
    if (Number.isInteger(replaceNote) && state.pending.eventNotes[replaceNote]) state.pending.eventNotes[replaceNote] = note;
    else state.pending.eventNotes.push(note);
    applyAnalysisState(chat, state, result, indices);
    state.pending.closeRequested = closeArc || await arcLimitReached(chat, state);
    state.processedThrough = Math.max(state.processedThrough, indices[indices.length - 1]);
    // Снимок на последнем разобранном сообщении: по нему ветка вернётся к тому
    // состоянию, которое было на этой точке, а не унаследует будущее.
    storeSnapshot(chat, state, indices[indices.length - 1]);
    await getContext().saveChat();
    updateArcInjection();
}

function applyAnalysisState(chat, state, result, indices = null) {
    syncCalendarDate(chat, state);
    // Анализ видел только свою пачку сообщений, поэтому и время помечаем её
    // последним номером. Разбор всего чата (indices не задан) видел всё.
    const clockIndex = indices?.length ? indices[indices.length - 1] : chat.length - 1;
    // При включённом инфоблоке время ведёт метка основной модели: она идёт по
    // каждому сообщению, а анализ только оценивает его по пачке задним числом.
    applyWorldUpdate(state, result.world_update || result.world, clockIndex, { tieWins: !settings.infoblock });
    applyCalendarUpdates(state, result.calendar_updates || result.calendar, settings.trackCalendar, clockIndex, { tieWins: !settings.infoblock });
    applyHealthUpdate(state, result.health_update || result.health, settings);
    applyRelationshipUpdate(state, result.relationship_update || result.relationship, settings);
    applySecretsUpdate(state, result.secrets_update || result.secrets, settings);
    applyGalleryUpdates(state, result.gallery_updates || result.gallery, settings, indices ? serializeMessages(chat, indices) : []);
}

async function setMessagesHidden(chat, indices, hidden) {
    const valid = [...new Set(indices)].filter(index => index >= 0 && chat[index]);
    for (const index of valid) chat[index].is_system = hidden;
    try {
        const { executeSlashCommandsWithOptions } = await import('/scripts/slash-commands.js');
        // Подряд идущие номера уходят одним диапазоном: каждый вызов команды
        // сохраняет чат целиком, а на арке таких сообщений десятки.
        for (const [start, end] of contiguousRanges(valid)) {
            const range = end > start ? `${start}-${end}` : String(start);
            try { await executeSlashCommandsWithOptions(`${hidden ? '/hide' : '/unhide'} ${range}`); }
            catch (error) { console.warn(`[Mnema] Не удалось ${hidden ? 'скрыть' : 'показать'} сообщения ${range}:`, error); }
        }
    } catch (error) {
        console.warn('[Mnema] Нативные команды скрытия недоступны, использую прямую синхронизацию:', error);
    }
    for (const index of valid) {
        chat[index].is_system = hidden;
        document.querySelector(`.mes[mesid="${index}"]`)?.setAttribute('is_system', String(hidden));
    }
    await getContext().saveChat();
}

// Открытые линии всех действующих арок одним плоским списком: модель отвечает
// номерами по нему, а мы по тем же номерам знаем, из какой арки вырезать.
function collectOpenThreads(state) {
    return (state?.arcs || []).filter(arc => arc.active !== false)
        .flatMap(arc => (arc.recap?.threads || []).map(text => ({ arcId: arc.id, text })));
}

async function requestArcSummary(noteSummaries, fallbackTitle, openThreads = []) {
    const messages = buildArcPrompt(noteSummaries, participantContext(getContext() || {}), openThreads.map(thread => thread.text));
    const result = parseJsonResponse(await requestModel(messages, settings, 2400));
    const summary = String(result.summary || '').trim();
    if (!summary) throw new Error('В ответе модели отсутствует summary');
    return {
        title: String(result.title || fallbackTitle).trim(),
        summary,
        recap: normalizeRecap(result.recap),
        resolved: resolvedThreadIndices(result.resolved_threads, openThreads.map(thread => thread.text)),
    };
}

// Линии, закрытые новой аркой, вырезаем из перечней прошлых: держать в памяти
// «долг не отдан» после того, как его отдали, — хуже, чем не держать ничего.
async function pruneResolvedThreads(chat, state, openThreads, resolved) {
    const byArc = new Map();
    for (const position of resolved) {
        const thread = openThreads[position];
        if (!thread) continue;
        if (!byArc.has(thread.arcId)) byArc.set(thread.arcId, new Set());
        byArc.get(thread.arcId).add(thread.text);
    }
    let changed = 0;
    for (const [arcId, texts] of byArc) {
        const arc = state.arcs.find(item => item.id === arcId);
        if (!arc?.recap?.threads?.length) continue;
        const kept = arc.recap.threads.filter(text => !texts.has(text));
        const removed = arc.recap.threads.length - kept.length;
        if (!removed) continue;
        // Пустой список убираем целиком: иначе в сводке останется заголовок
        // «Осталось открытым» без единой строки под ним.
        if (kept.length) arc.recap.threads = kept;
        else delete arc.recap.threads;
        const index = findArcMessageIndex(chat, arc);
        if (index !== null) chat[index].mes = arcMessageText(arc);
        changed += removed;
    }
    return changed;
}

function createArc({ title, summary, recap = {}, indices, notes }) {
    return {
        id: `arc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title, summary, recap,
        range: [indices[0], indices[indices.length - 1]], messageIndices: indices,
        eventNotes: notes.map(note => ({ ...note })), active: true, createdAt: new Date().toISOString(),
    };
}


// Пересборка сводки по кнопке: исходные конспекты интервалов лежат в самой арке,
// поэтому перечитывать чат и тратить анализ заново не нужно. Меняется только
// текст — границы арки, её сообщения и снимки состояния остаются как были.
async function regenerateArc(arcId) {
    if (processing || focus.status().busy) return notify('Дождитесь окончания текущей операции', 'info');
    const chat = getContext()?.chat;
    const state = getState({ create: false });
    const arc = state?.arcs?.find(item => item.id === arcId);
    if (!arc || !Array.isArray(chat)) return;
    const notes = (arc.eventNotes || []).map(note => note.summary).filter(Boolean);
    if (!notes.length) return notify('У этой арки не сохранены конспекты интервалов', 'info');

    const epoch = chatEpoch;
    processing = true;
    renderOverview();
    syncFocusButtons();
    try {
        const { title, summary, recap } = await requestArcSummary(notes, arc.title);
        if (epoch !== chatEpoch || getContext()?.chat !== chat) throw new Error('Чат сменился во время пересборки арки');
        // Арку ищем заново: за время запроса состояние могло смениться, и писать
        // в захваченный объект значило бы потерять правку или воскресить удалённое.
        const target = getState({ create: false })?.arcs?.find(item => item.id === arcId);
        if (!target) throw new Error('Арка исчезла во время пересборки');
        Object.assign(target, { title, summary, recap });
        const index = findArcMessageIndex(chat, target);
        if (index !== null) chat[index].mes = createArcMessage(target).mes;
        await getContext().saveChat();
        updateArcInjection();
        notify(t('Сводка арки «{title}» пересобрана', { title: target.title }), 'success');
    } catch (error) {
        notify(error.message || String(error), 'error');
    } finally {
        processing = false;
        renderOverview();
        syncFocusButtons();
        await reloadCurrentChat();
    }
}

// Хвост чата, который остаётся видимым даже будучи заархивированным: сводка
// пересказывает события, но не сохраняет голос сцены, и без нескольких живых
// реплик перед носом модель на стыке арок сбивается на пересказ.
//
// Пересчитываем по всем аркам сразу, а не по свежезакрытой: сообщения, попавшие
// в буфер прошлый раз, к этому моменту уже уехали вглубь и должны скрыться.
async function applyArcVisibility(chat, state) {
    const archived = state.arcs.filter(arc => arc.active !== false).flatMap(arc => arc.messageIndices || []);
    if (!archived.length) return;
    const buffer = Math.max(0, Number(settings.arcVisibleBuffer) || 0);
    const keep = new Set();
    // Считаем от конца по настоящим репликам: вставленные сводки арок видимы и
    // так, и занимать ими места в буфере значило бы урезать его молча.
    for (let index = chat.length - 1, left = buffer; index >= 0 && left > 0; index--) {
        if (!chat[index] || chat[index].extra?.mnema_arc_id) continue;
        keep.add(index);
        left--;
    }
    const hide = archived.filter(index => !keep.has(index));
    const show = archived.filter(index => keep.has(index));
    if (hide.length) await setMessagesHidden(chat, hide, true);
    if (show.length) await setMessagesHidden(chat, show, false);
}

// Число отдельных арок ограничено: на длинной истории десяток сводок в контексте
// работает хуже одной общей. При переполнении самые старые сливаются в большое
// саммари — история не теряется, но перестаёт расти вширь.
async function consolidateArcs(chat, state, epoch) {
    const limit = Math.max(0, Number(settings.arcLimit) || 0);
    if (!limit || state.arcs.length <= limit) return null;
    // Сливаем ровно столько старых, чтобы уложиться в лимит, но не меньше двух:
    // «слияние» одной арки лишь переписало бы ей заголовок чужой моделью.
    const mergeCount = Math.max(2, state.arcs.length - limit + 1);
    if (mergeCount > state.arcs.length) return null;
    const merged = state.arcs.slice(0, mergeCount);
    // В слияние отдаём сводки вместе с их перечнями: именно там живут
    // открытые линии и детали, которые иначе потерялись бы при пересказе пересказа.
    const { title, summary, recap } = await requestArcSummary(
        merged.map(arc => [arc.summary, recapMarkdown(arc.recap)].filter(Boolean).join('\n\n')), t('Ранняя история'));
    if (epoch !== chatEpoch || getContext()?.chat !== chat) throw new Error('Чат сменился во время слияния арок');

    // Сводки сливаемых арок убираем с конца: удаление с головы сдвинуло бы
    // номера ещё не обработанных.
    for (const arc of [...merged].reverse()) {
        const index = findArcMessageIndex(chat, arc);
        if (index === null) continue;
        chat.splice(index, 1);
        // Сдвигаем то, что строго дальше: ссылки на саму удалённую строку
        // принадлежат сливаемой арке и уходят вместе с ней.
        shiftStateIndices(state, index + 1, -1);
    }
    const indices = [...new Set(merged.flatMap(arc => arc.messageIndices || []))].filter(index => chat[index]).sort((a, b) => a - b);
    if (!indices.length) return null;
    const combined = createArc({ title, summary, recap, indices, notes: merged.flatMap(arc => arc.eventNotes || []) });
    state.arcs.splice(0, mergeCount, combined);
    insertArcMessage(chat, state, combined, arcInsertPosition(indices));
    await getContext().saveChat();
    return { arc: combined, mergeCount };
}

async function finalizeArc(chat, state, epoch, { reload = true, silent = false } = {}) {
    const indices = [...state.pending.messageIndices].filter(index => chat[index]);
    if (!indices.length || !state.pending.eventNotes.length) { state.pending.closeRequested = false; return null; }
    const openThreads = collectOpenThreads(state);
    const { title, summary, recap, resolved } = await requestArcSummary(
        state.pending.eventNotes.map(note => note.summary), t('Арка {n}', { n: state.arcs.length + 1 }), openThreads);
    if (epoch !== chatEpoch || getContext()?.chat !== chat) throw new Error('Чат сменился во время формирования арки');
    const arc = createArc({ title, summary, recap, indices, notes: state.pending.eventNotes });
    // Чистим до вставки новой сводки: она сдвигает номера, а чистке нужно найти
    // сообщения прошлых арок по их текущим местам.
    const pruned = await pruneResolvedThreads(chat, state, openThreads, resolved);
    state.arcs.push(arc);
    insertArcMessage(chat, state, arc, arcInsertPosition(indices));
    state.pending = { messageIndices: [], eventNotes: [], closeRequested: false };
    await getContext().saveChat();
    // Слияние идёт до расчёта видимости: оно двигает номера сообщений, и
    // скрывать по старым значило бы промахнуться мимо цели.
    const consolidated = await consolidateArcs(chat, state, epoch);
    await applyArcVisibility(chat, state);
    updateArcInjection();
    if (reload) await reloadCurrentChat();
    if (!silent) {
        notify(t('Арка «{title}» завершена', { title: arc.title }), 'success');
        if (pruned) notify(t('Закрыто открытых линий в прошлых арках: {n}', { n: pruned }), 'info');
        if (consolidated) notify(t('Старые арки слиты в одну: {n}', { n: consolidated.mergeCount }), 'info');
    }
    return arc;
}

function updateArcInjection() {
    const chat = getContext()?.chat || [];
    // Legacy fallback only. New arc summaries are narrator messages in their exact
    // chronological position, so injecting them again would duplicate the memory.
    const state = getState({ create: false });
    const active = state?.arcs?.filter(arc => arc.active !== false && findArcMessageIndex(chat, arc) === null) || [];
    const arcs = active.length
        ? `<mnema_arcs>\n${active.map((arc, index) => `ARC ${index + 1}: ${arc.title}\n${arc.summary}`).join('\n\n')}\n</mnema_arcs>` : '';
    setExtensionPrompt(PROMPT_KEY, settings.enabled ? arcs : '', extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
    const narrativeContext = settings.enabled ? buildMemoryInjection(state, settings) : '';
    // Инструкция для основной модели идёт в самый конец чата, сразу после
    // сообщения пользователя, иначе модель про метку забывает.
    setExtensionPrompt(
        INFOBLOCK_PROMPT_KEY,
        [narrativeContext, settings.enabled && settings.infoblock ? infoblockInstruction(settings) : ''].filter(Boolean).join('\n\n'),
        extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM,
    );
}

// ── Режим «инфоблок» ───────────────────────────────────────────────────────
function renderInfoblockFor(messageIndex) {
    const chat = getContext()?.chat || [];
    const message = chat[messageIndex];
    if (!message || message.is_user) return;
    const live = messageIndex === lastCharacterMessageIndex(chat);
    const scene = readStoredScene(message);
    // Replies without updates use the existing state; no missing-tag warning.
    if (!scene && !live) return;
    renderInfoblock(messageIndex, buildInfoblock({ scene, state: getState({ create: false }), settings, live, busy: Boolean(gallery?.status().busy), peek: peekedOwners() }));
}

function decorateInfoblocks() {
    if (!settings.infoblock) return removeInfoblocks();
    const chat = getContext()?.chat || [];
    for (let index = 0; index < chat.length; index++) {
        if (readStoredScene(chat[index]) || index === lastCharacterMessageIndex(chat)) renderInfoblockFor(index);
    }
}

async function processSceneTag(messageIndex) {
    if (!settings.infoblock) return false;
    const context = getContext();
    const message = context?.chat?.[messageIndex];
    if (!message || message.is_user || message.is_system) return false;
    const state = getState();
    if (!state) return false;
    const parsed = parseSceneTag(sceneTagSource(message) || message.mes, state.calendar?.currentDate);
    // A carried-forward snapshot is not proof that the final reply was parsed.
    // Streaming, edits and swipes can append a new tag after that snapshot.
    if (!parsed && readStoredScene(message)) { renderInfoblockFor(messageIndex); return false; }
    const scene = parsed || {};

    if (scene.raw) stripSceneTagFromMessage(message);
    const changed = applySceneToState(state, scene, settings, messageIndex);
    // Store the effective scene for this message, including carried-forward values.
    storeScene(message, {
        ...scene,
        clock: state?.world?.clock || scene.clock,
        date: settings.trackCalendar ? state?.calendar?.currentDate || scene.date : null,
        location: state?.world?.location || scene.location,
        description: state?.world?.description || scene.description,
        indoor: state?.world?.indoor ?? scene.indoor,
        weather: state?.world?.weather || scene.weather,
        temperature: state?.world?.temperature ?? scene.temperature,
        characterOutfit: state?.world?.characterOutfit || scene.characterOutfit,
        userOutfit: state?.world?.userOutfit || scene.userOutfit,
    });
    // Текст изменился — перерисовываем сообщение целиком, потом плашку.
    if (scene.raw) context.updateMessageBlock?.(messageIndex, message);
    if (changed) updateArcInjection();
    renderInfoblockFor(messageIndex);
    renderOverview();
    await context.saveChat();
    return Boolean(scene.raw);
}

// При стриминге message.mes — это ещё не ответ, а срез потока. Свайп, остановка
// и смена чата приходят как раз посреди генерации, и разбор такого текста
// записал бы сообщению снимок сцены до того, как модель дописала метку.
function isGenerating() {
    return document.body.dataset.generating === 'true';
}

function scheduleSceneTag(messageId, delay = 50, { rechecks = 1, waits = 20 } = {}) {
    const chat = getContext()?.chat;
    const epoch = chatEpoch;
    const index = messageId == null ? lastCharacterMessageIndex(chat || []) : Number(messageId);
    const message = chat?.[index];
    if (!message || !Number.isInteger(index)) return;
    setTimeout(() => {
        if (chatEpoch !== epoch || getContext()?.chat !== chat) return;
        // Сообщение по индексу могли подменить, пока мы ждали: соседние
        // расширения переписывают и перерисовывают ответ после нас. Пока в нём
        // лежит неразобранная метка, она важнее совпадения объектов — иначе
        // разбор теряется молча, а метка остаётся видимой в чате.
        if (chat[index] !== message && !hasSceneTag(sceneTagSource(chat[index]))) return;
        if (isGenerating()) {
            if (waits > 0) scheduleSceneTag(index, 300, { rechecks, waits: waits - 1 });
            return;
        }
        void processSceneTag(index).then(stripped => {
            // Текст сообщения могут переписать уже после нас: авто-продолжение
            // возвращает метку из копии, снятой до вырезки, а разбор reasoning
            // переписывает mes целиком. Один контрольный проход это ловит.
            if (stripped && rechecks > 0) scheduleSceneTag(index, 400, { rechecks: rechecks - 1, waits });
        }).catch(error => {
            console.error('[Mnema] Scene tag processing failed:', error);
            notify('Не удалось сохранить данные инфоблока: ' + (error.message || String(error)), 'error');
        });
    }, delay);
}

// Страховка на случай, когда разбор перебило чужое расширение: оно могло
// переписать текст ответа уже после нашего прохода, перерисовать сообщение или
// отложенно дописать в него свой блок. Метка, оставшаяся в чате, — единственный
// надёжный признак пропущенного разбора, поэтому подбираем её ещё раз.
function sweepSceneTags(depth = 6) {
    if (!settings.infoblock || isGenerating()) return;
    const chat = getContext()?.chat || [];
    // Строго от старых к новым: разбор применяет сцену к общему состоянию, и
    // метка позднего сообщения должна лечь поверх ранней, а не наоборот.
    for (let index = Math.max(0, chat.length - depth); index < chat.length; index++) {
        const message = chat[index];
        if (!message || message.is_user || message.is_system) continue;
        if (hasSceneTag(sceneTagSource(message))) scheduleSceneTag(index, 0, { rechecks: 0 });
    }
}

async function processAvailable({ force = false } = {}) {
    if (processing || gallery.status().busy || focus.status().busy) return;
    const chat = getContext()?.chat;
    const state = getState();
    if (!Array.isArray(chat) || !state) return;
    const epoch = chatEpoch;
    processing = true;
    renderOverview();
    try {
        if (state.pending.closeRequested) await finalizeArc(chat, state, epoch);
        while (epoch === chatEpoch && getContext()?.chat === chat) {
            const available = candidateIndices(chat, state);
            if (!available.length || (!force && available.length < settings.interval)) break;
            const batch = available.slice(0, settings.interval);
            await analyzeBatch(chat, state, batch, epoch);
            force = false;
            if (state.pending.closeRequested) await finalizeArc(chat, state, epoch);
        }
    } catch (error) {
        console.error('[Mnema] Ошибка обработки:', error);
        if (!/Чат сменился/.test(error.message)) notify(error.message || String(error), 'error');
    } finally {
        processing = false;
        renderOverview();
    }
}

// «Проверить» и палочка в плашке делают по одной кнопке две вещи: сначала
// разбирают всё накопленное, не дожидаясь интервала, а если разбирать нечего —
// перечитывают последний интервал заново. Второе нужно, когда в разделы что-то
// не подхватилось: промпт тот же, заново перечитываются те же сообщения.
function recheckableInterval(chat, state) {
    const noteIndex = (state?.pending?.eventNotes?.length || 0) - 1;
    const note = state?.pending?.eventNotes?.[noteIndex];
    if (!note) return null;
    // Берём ровно сообщения последней заметки: так перечитанный интервал
    // совпадает с заменяемой заметкой и частичных перекрытий не возникает.
    const indices = (state.pending.messageIndices || []).filter(index => index >= note.range[0] && index <= note.range[1] && chat[index]);
    return indices.length ? { indices, noteIndex } : null;
}

function analyzeOrRecheck() {
    const chat = getContext()?.chat;
    const state = getState();
    if (!Array.isArray(chat) || !state) return notify('Откройте чат', 'error');
    if (candidateIndices(chat, state).length) return void processAvailable({ force: true });
    void recheckLastInterval(chat, state);
}

async function recheckLastInterval(chat, state) {
    if (processing || gallery.status().busy || focus.status().busy) return;
    const target = recheckableInterval(chat, state);
    if (!target) return notify('Нечего перепроверять: новых сообщений нет, а прошлые интервалы уже сведены в арки', 'info');
    const epoch = chatEpoch;
    processing = true;
    renderOverview();
    try {
        await analyzeBatch(chat, state, target.indices, epoch, { replaceNote: target.noteIndex });
        if (epoch !== chatEpoch || getContext()?.chat !== chat) return;
        if (state.pending.closeRequested) await finalizeArc(chat, state, epoch);
        if (settings.infoblock) decorateInfoblocks();
        notify(t('Интервал #{from}–#{to} перечитан', { from: target.indices[0], to: target.indices[target.indices.length - 1] }), 'success');
    } catch (error) {
        console.error('[Mnema] Ошибка перепроверки:', error);
        if (!/Чат сменился/.test(error.message)) notify(error.message || String(error), 'error');
    } finally {
        processing = false;
        renderOverview();
    }
}

// В новом чате первая же генерация идёт без базы истории: приветствие и реплика
// игрока ещё не разобраны, поэтому модель получает пустую память. MESSAGE_SENT
// ждут внутри Generate() до сборки промпта — разбираем эти два сообщения прямо
// здесь, и отправка уходит уже с готовым состоянием.
function isFreshChat(state) {
    return state.processedThrough < 0 && !state.arcs.length
        && !state.pending.eventNotes.length && !state.pending.messageIndices.length;
}

async function bootstrapNewChat(messageIndex) {
    if (!settings.enabled || processing || gallery.status().busy) return;
    // Только самое начало чата: приветствие (0) и первая реплика игрока (1).
    if (!Number.isInteger(messageIndex) || messageIndex > 1) return;
    const chat = getContext()?.chat;
    if (!Array.isArray(chat) || !chat[messageIndex]?.is_user) return;
    const state = getState();
    if (!state || !isFreshChat(state)) return;
    const indices = candidateIndices(chat, state).filter(index => index <= messageIndex);
    if (!indices.length) return;
    const epoch = chatEpoch;
    processing = true;
    renderOverview();
    notify('Собираю базу истории по началу чата…', 'info');
    try {
        // Арка не может закрыться на первой же реплике — лишний вопрос модели.
        await analyzeBatch(chat, state, indices, epoch, { detectArcEnd: false });
    } catch (error) {
        console.error('[Mnema] Ошибка стартового анализа:', error);
        if (!/Чат сменился/.test(error.message)) notify(error.message || String(error), 'error');
    } finally {
        processing = false;
        renderOverview();
        if (settings.infoblock) decorateInfoblocks();
    }
}

function parseMessageIndices(input, chat, state) {
    const wanted = new Set();
    for (const chunk of String(input || '').split(/[,;\s]+/).filter(Boolean)) {
        const range = /^(\d+)\s*[-–—]\s*(\d+)$/.exec(chunk);
        if (range) {
            const from = Math.min(Number(range[1]), Number(range[2]));
            const to = Math.max(Number(range[1]), Number(range[2]));
            for (let index = from; index <= to; index++) wanted.add(index);
            continue;
        }
        if (/^\d+$/.test(chunk)) wanted.add(Number(chunk));
        else throw new Error(t('Не понимаю «{chunk}». Формат: 12-40 или 12,15,18', { chunk }));
    }
    if (!wanted.size) throw new Error('Укажите номера сообщений');

    const archived = new Set(state.arcs.flatMap(arc => arc.messageIndices || []));
    const indices = [];
    const skipped = { missing: 0, empty: 0, archived: 0 };
    for (const index of [...wanted].sort((a, b) => a - b)) {
        const message = chat[index];
        if (index < 0 || !message) { skipped.missing++; continue; }
        if (archived.has(index) || message.extra?.mnema_arc_id) { skipped.archived++; continue; }
        if (!String(message.mes || '').trim()) { skipped.empty++; continue; }
        indices.push(index);
    }
    if (!indices.length) throw new Error('Среди указанных номеров нет подходящих сообщений');
    return { indices, skipped };
}

function setManualProgress(text, ratio) {
    $('#mnema_manual_progress').prop('hidden', !text);
    if (!text) return;
    $('#mnema_manual_progress_text').text(text);
    $('#mnema_manual_progress_fill').css('width', `${Math.round(Math.max(0, Math.min(1, ratio || 0)) * 100)}%`);
}

function applyManualArcs(chat, state, parts) {
    const selected = new Set(parts.flatMap(part => part.indices));
    state.pending.messageIndices = state.pending.messageIndices.filter(index => !selected.has(index));
    state.pending.eventNotes = state.pending.eventNotes.filter(note => {
        const [start, end] = note.range || [];
        // Keep a partially covered note: its unselected facts still matter.
        for (let index = start; index <= end; index++) if (!selected.has(index)) return true;
        return false;
    });
    if (!state.pending.messageIndices.length) state.pending.closeRequested = false;
    const arcs = [];
    for (const part of parts) {
        if (!part.closed) {
            state.pending.messageIndices.push(...part.indices);
            state.pending.eventNotes.push({
                range: [part.indices[0], part.indices.at(-1)], summary: part.summary,
                closeArc: false, arcReason: '', createdAt: new Date().toISOString(),
            });
            continue;
        }
        arcs.push(createArc({ title: part.title, summary: part.summary, indices: [...part.indices], notes: [] }));
    }
    // Register every arc before inserting summaries so all indices shift together.
    state.arcs.push(...arcs);
    for (const arc of arcs) insertArcMessage(chat, state, arc, arcInsertPosition(arc.messageIndices));
    for (const arc of arcs) for (const index of arc.messageIndices) chat[index].is_system = true;
    return arcs.length;
}

async function runManualAnalysis({ chat, state, indices, wholeChat = false, skipped = 0 }) {
    const epoch = chatEpoch;
    const original = JSON.stringify(chat);
    const originalState = JSON.stringify(state);
    const context = getContext();
    processing = true;
    manualRunCancelled = false;
    renderOverview();
    let committed = false;
    try {
        const analysisState = wholeChat ? createState(chat) : state;
        setManualProgress(t('Отправляю {n} сообщений одним запросом…', { n: indices.length }), 0.1);
        const messages = buildAnalysisPrompt(chat, analysisState, indices, {
            manual: true, wholeChat, sections: wholeChat, detectArcEnd: false,
        });
        const result = parseJsonResponse(await requestModel(messages, settings, 8192));
        if (manualRunCancelled) { notify('Анализ отменён, данные не изменены', 'info'); return; }
        if (epoch !== chatEpoch || getContext()?.chat !== chat) throw new Error('Чат сменился во время анализа');
        if (JSON.stringify(chat) !== original || JSON.stringify(state) !== originalState) {
            throw new Error('Чат или память изменились во время анализа. Запустите анализ ещё раз.');
        }
        const parts = validateManualArcs(result, indices, wholeChat);
        setManualProgress('Сохраняю арки и память…', 0.9);
        let draftChat;
        let draftState;
        if (wholeChat) {
            const rebuilt = prepareRebuiltChat(chat, state);
            draftChat = rebuilt.messages;
            for (const part of parts) part.indices = part.indices.map(index => rebuilt.indexMap.get(index));
            draftState = createState(draftChat);
            applyAnalysisState(draftChat, draftState, result);
            draftState.processedThrough = draftChat.length - 1;
        } else {
            draftChat = structuredClone(chat);
            draftState = structuredClone(state);
        }
        const count = applyManualArcs(draftChat, draftState, parts);
        // No chat mutation or reset occurs until the complete response is validated.
        chat.length = 0;
        for (const message of draftChat) chat.push(message);
        context.chatMetadata[STATE_KEY] = draftState;
        try {
            await context.saveChat();
        } catch (error) {
            chat.length = 0;
            for (const message of JSON.parse(original)) chat.push(message);
            context.chatMetadata[STATE_KEY] = state;
            throw error;
        }
        committed = true;
        updateArcInjection();
        notify(t('Анализ завершён. Создано арок: {n}{open}{skipped}', {
            n: count,
            open: parts.some(part => !part.closed) ? t(' · текущая арка оставлена открытой') : '',
            skipped: skipped ? t(' · пропущено {n}', { n: skipped }) : '',
        }), 'success');
    } catch (error) {
        console.error('[Mnema] Ошибка ручного анализа:', error);
        if (!/Чат сменился/.test(error.message)) notify(error.message || String(error), 'error');
    } finally {
        processing = false;
        manualRunCancelled = false;
        setManualProgress('');
        if (committed && epoch === chatEpoch && getContext()?.chat === chat) await reloadCurrentChat();
        renderOverview();
    }
}

async function analyzeManualRange(input) {
    if (processing || gallery.status().busy) return;
    const chat = getContext()?.chat;
    const state = getState();
    if (!Array.isArray(chat) || !state) { notify('Откройте чат', 'error'); return; }
    try {
        const { indices, skipped } = parseMessageIndices(input, chat, state);
        await runManualAnalysis({ chat, state, indices, skipped: skipped.missing + skipped.empty + skipped.archived });
    } catch (error) {
        notify(error.message, 'error');
    }
}

async function analyzeWholeChat() {
    if (processing || gallery.status().busy) return;
    const context = getContext();
    const chat = context?.chat;
    const state = getState();
    if (!Array.isArray(chat) || !state) { notify('Откройте чат', 'error'); return; }
    const epoch = chatEpoch;
    const confirmed = await context.callGenericPopup(
        `<h3>${t('Пересчитать весь чат с нуля?')}</h3><p>${t('Все исходные сообщения будут отправлены одним запросом. Модель сама выделит арки и соберёт итоговое состояние разделов.')}</p><p>${t('После успешного анализа существующие арки ({n}) и память будут заменены. При ошибке или отмене они сохранятся.', { n: state.arcs.length })}</p>`,
        context.POPUP_TYPE.CONFIRM,
        '',
        { okButton: t('Пересчитать'), cancelButton: t('Отмена') },
    );
    if (confirmed !== context.POPUP_RESULT.AFFIRMATIVE || processing) return;
    if (epoch !== chatEpoch || getContext()?.chat !== chat) { notify('Чат сменился, пересчёт отменён', 'info'); return; }
    const indices = wholeChatIndices(chat, state);
    if (!indices.length) { notify('Нет сообщений для анализа', 'info'); return; }
    await runManualAnalysis({ chat, state, indices, wholeChat: true });
}

async function toggleArc(arcId) {
    const chat = getContext()?.chat;
    const state = getState({ create: false });
    const arc = state?.arcs?.find(item => item.id === arcId);
    if (!chat || !arc) return;
    arc.active = arc.active === false;
    await setMessagesHidden(chat, arc.messageIndices, arc.active);
    const summaryIndex = findArcMessageIndex(chat, arc);
    if (summaryIndex !== null) await setMessagesHidden(chat, [summaryIndex], !arc.active);
    updateArcInjection();
    decorateArcMessages();
    renderOverview();
}

async function refreshCalendarFromChat() {
    const chat = getContext()?.chat;
    const state = getState({ create: false });
    if (!Array.isArray(chat) || !state) return;
    if (syncCalendarDate(chat, state)) await getContext().saveChat();
    updateArcInjection();
    renderCalendar(state);
}

function bindEvents() {
    sectionEditor.bindEvents();
    gallery.bindEvents();
    gallerySettings.bindEvents();
    $(document).on('click', `#${MENU_BUTTON_ID}`, openPopup);
    $(document).on('keydown', `#${MENU_BUTTON_ID}`, event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPopup(); } });
    $(document).on('click', '#mnema_popup_close', closePopup);
    $(document).on('click', `#${POPUP_ID}`, event => { if (event.target.id === POPUP_ID) closePopup(); });
    $(document).on('keydown.mnema', event => { if (event.key === 'Escape' && !document.getElementById(POPUP_ID)?.hidden) closePopup(); });
    $(document).on('click', '.mnema-tab-btn', function () {
        const tab = this.dataset.mnemaTab;
        $(`#${POPUP_ID} .mnema-tab-btn`).removeClass('active').filter(`[data-mnema-tab="${tab}"]`).addClass('active');
        $(`#${POPUP_ID} .mnema-tab-panel`).removeClass('active').filter(`[data-mnema-panel="${tab}"]`).addClass('active');
    });
    $(document).on('click', '#mnema_manual_run', () => void analyzeManualRange($('#mnema_manual_range').val()));
    $(document).on('keydown', '#mnema_manual_range', function (event) {
        if (event.key === 'Enter') { event.preventDefault(); void analyzeManualRange(this.value); }
    });
    $(document).on('click', '#mnema_manual_full', () => void analyzeWholeChat());
    $(document).on('click', '#mnema_manual_stop', () => { manualRunCancelled = true; setManualProgress('Останавливаю после текущего запроса…', 1); });
    $(document).on('click', '#mnema_analyze_now', () => analyzeOrRecheck());
    // ВРЕМЕННО: заполнить все разделы примерами. Ничего не сохраняет — данные
    // исчезнут при перезагрузке чата. Удалить вместе с modules/demo.js.
    $(document).on('click', '#mnema_demo_fill', () => {
        const state = getState();
        if (!state) return notify('Откройте чат', 'error');
        fillDemoState(state);
        gallery.reset();
        updateArcInjection();
        renderOverview();
        notify('Демо-данные подставлены. Не сохраняются: перезагрузите чат, чтобы вернуть реальные.', 'info');
    });
    $(document).on('click', '.mnema-calendar-nav', function () {
        const state = getState({ create: false });
        if (!state) return;
        state.calendar.viewOffsetWeeks += Number(this.dataset.calendarShift) || 0;
        void getContext().saveChat();
        renderCalendar(state);
    });
    $(document).on('click', '#mnema_calendar_today', () => {
        const state = getState({ create: false });
        if (!state) return;
        state.calendar.viewOffsetWeeks = 0;
        void getContext().saveChat();
        renderCalendar(state);
    });
    // Кнопки живут в <summary>, поэтому клик по ним иначе ещё и переключал бы
    // саму арку. Гасим только действие по умолчанию — остальные обработчики
    // отработать обязаны.
    $(document).on('click', '.mnema-arc > summary button', function (event) { event.preventDefault(); });
    $(document).on('click', '.mnema-arc-toggle', function () { void toggleArc(this.closest('.mnema-arc')?.dataset.arcId); });
    $(document).on('click', '[data-mnema-arc-regenerate]', function () { void regenerateArc(this.dataset.mnemaArcRegenerate); });
    $(document).on('click', '.mnema-arc-fold', function () {
        const arcId = this.dataset.arcId;
        if (!arcId) return;
        const unfolded = this.classList.toggle('open');
        const elements = document.querySelectorAll(`#chat .mes[data-mnema-fold="${CSS.escape(arcId)}"]`);
        elements.forEach(element => element.classList.toggle('mnema-arc-unfolded', unfolded));
        const arc = getState({ create: false })?.arcs?.find(item => item.id === arcId);
        if (arc) this.querySelector('span').textContent = arcFoldLabel(arc, elements.length, unfolded);
    });
    $(document).on('click', '.mnema-secret-peek', function () {
        const owner = SECRET_OWNERS.includes(this.dataset.peekOwner) ? this.dataset.peekOwner : 'char';
        setSecretPeek(owner, this.dataset.mnemaPeek === 'on');
        if (settings.infoblock) decorateInfoblocks();
    });
    $(document).on('change', '#mnema_enabled', function () { settings.enabled = this.checked; saveSettings(); renderOverview(); });
    $(document).on('change', '#mnema_interval', function () { settings.interval = this.value; saveSettings(); syncSettingsUi(); renderOverview(); });
    $(document).on('change', '#mnema_arc_max_messages', function () { settings.arcMaxMessages = this.value; saveSettings(); syncSettingsUi(); });
    $(document).on('change', '#mnema_arc_max_tokens', function () { settings.arcMaxTokens = this.value; saveSettings(); syncSettingsUi(); });
    $(document).on('change', '#mnema_arc_visible_buffer', function () { settings.arcVisibleBuffer = this.value; saveSettings(); syncSettingsUi(); });
    $(document).on('change', '#mnema_arc_limit', function () { settings.arcLimit = this.value; saveSettings(); syncSettingsUi(); });
    $(document).on('change', '#mnema_connection_mode', function () { settings.connectionMode = this.value === 'manual' ? 'manual' : 'profile'; saveSettings(); syncSettingsUi(); });
    $(document).on('change', '#mnema_profile', function () { settings.profileId = this.value; saveSettings(); });
    $(document).on('change', '#mnema_api_url', function () { settings.apiUrl = this.value.trim(); saveSettings(); syncManualModels(); });
    $(document).on('change', '#mnema_api_key', function () { settings.apiKey = this.value.trim(); saveSettings(); syncManualModels(); });
    $(document).on('click', '#mnema_model_refresh', () => void refreshManualModels());
    $(document).on('change', '#mnema_model', function () { settings.model = this.value.trim(); saveSettings(); });
    $(document).on('click', '.mnema-section-disclosure', function () {
        const expanded = $(this).toggleClass('expanded').hasClass('expanded');
        this.setAttribute('aria-expanded', String(expanded));
        $(`#${this.dataset.mnemaDisclosure}`).prop('hidden', !expanded);
    });
    $(document).on('change', '#mnema_track_relationships', function () { settings.trackRelationships = this.checked; saveSettings(); updateSectionVisibility(); });
    $(document).on('change', '#mnema_track_calendar', function () { settings.trackCalendar = this.checked; saveSettings(); updateSectionVisibility(); });
    $(document).on('change', '#mnema_track_health', function () { settings.trackHealth = this.checked; saveSettings(); updateSectionVisibility(); });
    $(document).on('change', '[data-secret-limit]', function () { settings.secretLimits = { ...settings.secretLimits, [this.dataset.secretLimit]: this.value }; saveSettings(); syncSettingsUi(); });
    $(document).on('change', '#mnema_track_secrets', function () { settings.trackSecrets = this.checked; saveSettings(); updateSectionVisibility(); });
    $(document).on('change', '#mnema_collect_gallery', function () { settings.collectGallery = this.checked; saveSettings(); updateSectionVisibility(); });
    $(document).on('change', '[name="mnema_infoblock_theme"]', function () {
        settings.infoblockTheme = infoblockTheme(this.value);
        saveSettings();
        if (settings.infoblock) decorateInfoblocks();
    });
    $(document).on('change', '#mnema_infoblock', function () {
        settings.infoblock = this.checked;
        saveSettings();
        if (this.checked) decorateInfoblocks(); else removeInfoblocks();
    });
    $(document).on('click', '[data-mnema-focus]', function () {
        void focus.generate(this.dataset.mnemaFocus, SECRET_OWNERS.includes(this.dataset.focusOwner) ? this.dataset.focusOwner : 'char');
    });
    // Листание ступеней меняет только показанную карточку, поэтому плашку не
    // перерисовываем: перерисовка сбросила бы выбор обратно на текущую ступень.
    $(document).on('click', '[data-trail-dot], [data-trail-nav]', function () {
        const trail = this.closest('.mnema-ib-trail');
        if (!trail) return;
        setTrailFocus(trail, this.dataset.trailDot !== undefined
            ? Number(this.dataset.trailDot)
            : Number(trail.dataset.trailFocus) + Number(this.dataset.trailNav));
    });
    $(document).on('click', '.mnema-ib-action', async function () {
        const action = this.dataset.mnemaIb;
        const messageId = Number(this.closest('.mes')?.getAttribute('mesid'));
        if (action === 'add-secret' || action === 'cancel-secret') {
            const column = this.closest('.mnema-ib-secret-column');
            const form = column.querySelector('.mnema-ib-secret-form');
            form.hidden = action === 'cancel-secret' || !form.hidden;
            column.querySelector('[data-mnema-ib="add-secret"]').setAttribute('aria-expanded', String(!form.hidden));
            if (!form.hidden) form.elements.secret.focus();
            return;
        }
        if (action === 'peek' || action === 'unpeek') {
            const owner = SECRET_OWNERS.includes(this.dataset.peekOwner) ? this.dataset.peekOwner : 'char';
            setSecretPeek(owner, action === 'peek');
            return decorateInfoblocks();
        }
        if (action === 'open') return openPopup();
        if (action === 'edit') return sectionEditor.open();
        if (action === 'analyze') return analyzeOrRecheck();
        if (action === 'retry') return void processSceneTag(messageId);
        if (action === 'memory' || action === 'item') {
            await gallery.reconstruct(null, action === 'item' ? 'item' : 'memory');
        }
    });
    $(document).on('submit', '.mnema-ib-secret-form', async function (event) {
        event.preventDefault();
        if (this.dataset.saving) return;
        if (processing) return notify('Дождитесь завершения анализа', 'info');
        const context = getContext();
        const state = getState({ create: false });
        const text = this.elements.secret.value.trim();
        if (!state || !settings.trackSecrets || !text) return;
        const owner = SECRET_OWNERS.includes(this.dataset.owner) ? this.dataset.owner : 'char';
        if (!secretSlots(state, settings, owner)) return notify('Достигнут лимит секретов в этой категории', 'info');
        const title = text.slice(0, 60);
        if ([...state.secrets.revealed, ...state.secrets.unrevealed].some(secret => sameSecret(secret, { title, summary: text }))) return notify('Секрет с таким названием уже есть', 'info');
        const secret = { title, summary: text.length > 60 ? text.slice(0, 180) : '', owner };
        this.dataset.saving = 'true';
        state.secrets.unrevealed.push(secret);
        try {
            await context.saveChat();
            if (getState({ create: false }) === state) {
                updateArcInjection();
                renderOverview();
                decorateInfoblocks();
            }
        } catch (error) {
            const index = state.secrets.unrevealed.indexOf(secret);
            if (index >= 0) state.secrets.unrevealed.splice(index, 1);
            notify(error.message || 'Не удалось сохранить секрет', 'error');
        } finally { delete this.dataset.saving; }
    });
    $(document).on('click', '#mnema_test_connection', async function () {
        const button = $(this).prop('disabled', true);
        try { const response = await requestModel([{ role: 'user', content: 'Reply with one word: OK' }], settings, 16); notify(`Подключение работает: ${response.slice(0, 80)}`, 'success'); }
        catch (error) { notify(error.message || String(error), 'error'); }
        finally { button.prop('disabled', false); }
    });
}

async function onChatChanged() {
    chatEpoch++;
    sectionEditor.close();
    gallery.reset();
    galleryImages.cancel?.();
    const state = getState();
    const chat = getContext()?.chat;
    if (state && Array.isArray(chat)) {
        // Сверка идёт до миграции арок: иначе унаследованная веткой арка из
        // будущего получит здесь сообщение-конспект несуществующих событий.
        const reconciled = reconcileStateWithChat(state, chat);
        if (reconciled) {
            notify(reconciled === 'snapshot'
                ? 'Память отмотана к состоянию на этой точке чата'
                : 'Память обрезана по этому чату: снимка на этой точке не нашлось, накопленные значения разделов остались прежними', 'info');
        }
        syncCalendarDate(chat, state);
        await getContext().saveChat();
        if (await migrateArcMessages(chat, state)) return;
    }
    updateArcInjection();
    renderOverview();
    setTimeout(decorateArcMessages, 0);
    setTimeout(decorateInfoblocks, 0);
    scheduleSceneTag(null, 0);
    // Чат мог быть сохранён с непойманными метками — подбираем их при открытии.
    setTimeout(() => sweepSceneTags(), 300);
}

function initialize() {
    loadSettings();
    if (!document.getElementById(MENU_BUTTON_ID)) $('#extensionsMenu').append(menuHtml());
    if (!document.getElementById(POPUP_ID)) $('body').append(popupHtml());
    // Рендер вставляет русский HTML, поэтому перевод живёт наблюдателем: попап
    // и плашки перерисовываются целиком и часто.
    document.documentElement.setAttribute('data-mnema-lang', isRussianUi() ? 'ru' : 'en');
    observeTranslation([`#${POPUP_ID}`, '#extensionsMenu', '#chat']);
    // Лечение чатов, открытых старой версией: класс арки мог осесть на скрытом
    // шаблоне сообщения, и каждая новая реплика клонировалась уже с подписью.
    document.querySelectorAll('#message_template .mes').forEach(element => element.classList.remove('mnema-arc-message', 'mnema-arc-source', 'mnema-arc-unfolded'));
    bindEvents(); syncSettingsUi(); void onChatChanged();
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, messageId => {
        // Метку разбираем до анализа: она уточняет дату и место для конспекта.
        scheduleSceneTag(messageId);
        setTimeout(() => void refreshCalendarFromChat(), 100);
        if (settings.enabled) setTimeout(() => void processAvailable(), 300);
        // Фоновая дописка чужого расширения приходит уже после нашего разбора.
        setTimeout(() => sweepSceneTags(), 2000);
    });
    // Слушатель намеренно блокирующий: Generate() ждёт MESSAGE_SENT, поэтому
    // сообщение уходит уже после того, как память заполнена.
    eventSource.on(event_types.MESSAGE_SENT, messageId => bootstrapNewChat(messageId));
    eventSource.on(event_types.USER_MESSAGE_RENDERED, () => setTimeout(() => void refreshCalendarFromChat(), 100));
    eventSource.on(event_types.MESSAGE_UPDATED, messageId => {
        // Reparse local metadata too: edited replies may contain a fresh tag.
        if (settings.infoblock) scheduleSceneTag(messageId);
        setTimeout(() => void refreshCalendarFromChat(), 100);
    });
    eventSource.on(event_types.MESSAGE_SWIPED, () => { scheduleSceneTag(); setTimeout(decorateInfoblocks, 50); setTimeout(() => sweepSceneTags(), 2000); });
    // GENERATION_ENDED passes chat.length, not a message index.
    eventSource.on(event_types.GENERATION_ENDED, () => scheduleSceneTag());
    eventSource.on(event_types.MESSAGE_DELETED, () => {
        const state = getState({ create: false });
        if (state) normalizeState(state, getContext().chat);
        updateArcInjection(); renderOverview();
    });
    eventSource.on(event_types.GENERATION_STARTED, updateArcInjection);
    console.log('[Mnema] initialized');
}

$(() => initialize());
