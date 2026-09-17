import { getContext } from '/scripts/extensions.js';
import { escapeHtml } from './utils.js';
import { applySecretsUpdate, normalizeClock } from './state.js';
import { galleryEnabled } from './gallery-data.js';
import { dateFromIso, formatCalendarDate } from './calendar.js';
import { nearestStoryPlan } from './prompts.js';

// Режим «инфоблок»: основная модель чата дописывает в конец ответа одну строку
// [MN: ...], мы её разбираем, вырезаем из текста сообщения (в контекст она уже
// не попадёт) и рисуем плашку. Тяжёлые разделы по-прежнему заполняет Extra API.
const TAG = /\[MN:\s*([^\]]*)\]/i;
const SCENE_KEY = 'mnema_scene';

// Инструкция намеренно короткая: длинные схемы ролевые модели игнорируют.
// Состояние и правила поведения идут выше, в блоке памяти, — здесь только
// формат строки, и он стоит последним: ближний к концу контекста выполняется
// заметно надёжнее.
export function infoblockInstruction(settings = {}) {
    return [
        'Add one line in exactly this format at the very end of your reply, listing ONLY the fields whose value actually changed in it:',
        '[MN: clock: HH:MM | location: place | setting: indoors/outdoors | weather: weather and temperature | description: full description of the new location | char_outfit: main character clothing | user_outfit: user character clothing'
            + (settings.trackCalendar ? ' | date: DD.MM.YYYY | plan: commitment, DD.MM.YYYY HH:MM' : '')
            + (settings.trackSecrets ? ' | revealed: exact existing secret title' : '') + ']',
        'Mnema merges these changes into the state above and sends the result back next turn.',
        '- Omit unchanged and unknown fields; no placeholders. A missing field keeps its previous value. If nothing changed, omit the whole tag.',
        '- Never invent a replacement fact just to fill the tag, and never repeat unchanged details for bookkeeping.',
        '- clock is in-story time, never real-world time. Field values must not contain |, [ or ].',
        '- description belongs in the same tag as a location change: the new place exactly as you narrated it. Include char_outfit or user_outfit when clothing is first established or changes, with accessories and condition.',
        settings.trackCalendar ? '- plan only for a new or changed commitment made in this scene; omit an unknown date.' : '- Calendar is off: omit date and plan.',
        ...(settings.trackSecrets ? ['- revealed only when an existing secret actually became known to the other side in this reply. Copy its title exactly, never its contents; suspicion and hints are not disclosure. Repeat the field for several disclosures.'] : []),
        '- Field values in the language of the story, labels in English. Write only the story: never explain, repeat or mention the tag.',
        'Example when only time changed: [MN: clock: 21:40]',
    ].join('\n');
}

function parsePlans(parts, anchorDate) {
    const plans = [];
    for (const part of parts) {
        const match = /^(?:plan|план)\s*:\s*(.+)$/i.exec(part.trim());
        if (!match) continue;
        const body = match[1].trim();
        if (/^[-—–?]*$/.test(body) || /^(?:unchanged|unknown|n\/?a)$/i.test(body)) continue;
        const when = /(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?(?:\s+(\d{1,2}[:.]\d{2}))?\s*$/.exec(body);
        const title = (when ? body.slice(0, when.index) : body).replace(/[,;]\s*$/, '').trim();
        if (!title) continue;
        let date = null;
        if (when) {
            const year = when[3] ? (when[3].length === 2 ? 2000 + Number(when[3]) : Number(when[3])) : anchorDate?.getFullYear();
            if (year) date = `${year}-${String(Number(when[2])).padStart(2, '0')}-${String(Number(when[1])).padStart(2, '0')}`;
        }
        plans.push({ title: title.slice(0, 120), date, time: normalizeClock(when?.[4]) });
    }
    return plans;
}

export function parseSceneTag(text, anchorIso = null) {
    const match = TAG.exec(String(text || ''));
    if (!match) return null;
    const parts = /^unchanged$/i.test(match[1].trim()) ? [] : match[1].split('|').map(part => part.trim());
    const named = /^(?:clock|date|location|setting|weather|description|char_outfit|user_outfit|plan|revealed)\s*:/i.test(parts[0] || '');
    const optionalParts = named ? parts : parts.slice(5);
    const value = index => {
        const key = ['clock', 'date', 'location', 'setting', 'weather'][index];
        const field = named ? parts.find(part => new RegExp('^' + key + '\\s*:', 'i').test(part)) : null;
        const raw = named ? (field ? field.slice(field.indexOf(':') + 1).trim() : '') : parts[index] || '';
        return /^[-—–?]*$/.test(raw) || /^(?:n\/?a|unknown|unchanged|неизвестно)$/i.test(raw) ? '' : raw;
    };
    const dateRaw = value(1);
    const dateMatch = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})$/.exec(dateRaw);
    const year = dateMatch ? (dateMatch[3].length === 2 ? 2000 + Number(dateMatch[3]) : Number(dateMatch[3])) : null;
    const indoorRaw = value(3).toLowerCase();
    const weatherRaw = value(4);
    const temperature = /(-?\+?\d{1,2})\s*°?\s*[cс]?\b/.exec(weatherRaw.replace(/^\+/, ''))?.[1];
    const optional = key => {
        const part = optionalParts.find(part => new RegExp('^' + key + '\\s*:', 'i').test(part));
        const raw = part ? part.slice(part.indexOf(':') + 1).trim() : '';
        return /^[-—–?]*$/.test(raw) || /^(?:n\/?a|unknown|unchanged)$/i.test(raw) ? '' : raw;
    };
    const date = dateMatch ? `${year}-${String(Number(dateMatch[2])).padStart(2, '0')}-${String(Number(dateMatch[1])).padStart(2, '0')}` : null;

    return {
        raw: match[0],
        clock: normalizeClock(value(0)),
        date,
        location: value(2).replace(/^["'«»]|["'«»]$/g, '').slice(0, 120),
        description: optional('description').slice(0, 2400),
        characterOutfit: optional('char_outfit').slice(0, 1200),
        userOutfit: optional('user_outfit').slice(0, 1200),
        indoor: /внутри|indoor|inside|помещен/.test(indoorRaw) ? true : /снаружи|outdoor|outside|улиц/.test(indoorRaw) ? false : null,
        weather: weatherRaw.replace(/,?\s*-?\+?\d{1,2}\s*°?\s*[cс]?\b/i, '').replace(/[,;]\s*$/, '').trim().slice(0, 60),
        temperature: temperature === undefined ? null : Number(temperature),
        plans: parsePlans(optionalParts, dateFromIso(date || anchorIso)),
        revealedSecrets: optionalParts.flatMap(part => {
            const revealed = /^revealed\s*:\s*(.+)$/i.exec(part)?.[1]?.trim();
            return revealed && !/^[-—–?]*$/.test(revealed) && !/^(?:none|unknown|unchanged|n\/?a)$/i.test(revealed) ? [revealed] : [];
        }),
    };
}

// Строка метки вырезается из самого сообщения, а не прячется стилями: так она
// не попадёт ни в следующий запрос, ни в перегенерацию.
export function stripSceneTag(text) {
    return String(text || '').replace(new RegExp(TAG.source, 'gi'), '').replace(/[ \t]+$/gm, '').replace(/\n{3,}$/, '\n').trimEnd();
}

export function readStoredScene(message) {
    return message?.extra?.[SCENE_KEY] || null;
}

export function storeScene(message, scene) {
    message.extra = message.extra || {};
    message.extra[SCENE_KEY] = scene;
}

// Метка описывает момент сообщения, поэтому в общее состояние попадают только
// поля, которые действительно двигают сцену вперёд.
export function applySceneToState(state, scene, settings, messageIndex) {
    if (!state || !scene) return false;
    let changed = false;
    const setWorld = (key, value) => {
        if (value === null || value === undefined || value === '' || state.world[key] === value) return;
        state.world[key] = value;
        changed = true;
    };
    setWorld('clock', scene.clock);
    if (scene.location && scene.location.toLowerCase() !== String(state.world.location).toLowerCase()) {
        state.world.location = scene.location;
        state.world.description = '';
        state.world.indoor = null;
        changed = true;
    }
    if (typeof scene.indoor === 'boolean') setWorld('indoor', scene.indoor);
    setWorld('description', scene.description);
    setWorld('characterOutfit', scene.characterOutfit);
    setWorld('userOutfit', scene.userOutfit);
    setWorld('weather', scene.weather);
    if (Number.isFinite(scene.temperature)) setWorld('temperature', scene.temperature);
    if (changed) state.world.updatedAt = new Date().toISOString();

    if (settings.trackCalendar) {
        if (scene.date && scene.date !== state.calendar.currentDate) {
            state.calendar.currentDate = scene.date;
            state.calendar.sourceMessageIndex = messageIndex;
            state.calendar.viewOffsetWeeks = 0;
            changed = true;
        }
        for (const plan of scene.plans || []) {
            const existing = state.calendar.plans.find(item => item.title.toLowerCase() === plan.title.toLowerCase());
            if (existing) {
                if (plan.date) existing.date = plan.date;
                if (plan.time) existing.time = plan.time;
            } else {
                state.calendar.plans.push({ id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, title: plan.title, date: plan.date, time: plan.time, details: '' });
            }
            changed = true;
        }
    }
    if (settings.trackSecrets && scene.revealedSecrets?.length) {
        const count = state.secrets.unrevealed.length;
        applySecretsUpdate(state, { reveal: scene.revealedSecrets }, settings);
        if (state.secrets.unrevealed.length !== count) changed = true;
    }
    return changed;
}

function meter(label, value, tone = '') {
    const percent = Math.max(0, Math.min(100, Number(value) || 0));
    return `<div class="mnema-ib-meter ${tone}"><div><span>${escapeHtml(label)}</span><b>${percent}%</b></div><div class="mnema-ib-track" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div></div>`;
}

// Чужие тайны — спойлер: пока не нажали «показать», видно только счётчик и
// полосу прогресса раскрытия.
function secretsSection(state, peek) {
    const own = owner => [
        ...state.secrets.revealed.filter(item => (item.owner || 'char') === owner).map(item => ({ ...item, revealed: true })),
        ...state.secrets.unrevealed.filter(item => (item.owner || 'char') === owner).map(item => ({ ...item, revealed: false })),
    ];
    const context = getContext();
    const mine = own('user');
    const theirs = own('char');
    const line = secret => `<li class="mnema-ib-secret"><i class="fa-solid ${secret.revealed ? 'fa-lock-open' : 'fa-lock'}" aria-hidden="true"></i><div><b>${escapeHtml(secret.title)}</b><small>${secret.revealed ? 'Раскрыт' : 'Личная тайна'}</small>${secret.summary ? `<p>${escapeHtml(secret.summary)}</p>` : ''}</div></li>`;
    const veiled = theirs.filter(secret => !secret.revealed).length;
    const column = (secrets, name, icon, hidden) => {
        const revealed = secrets.filter(secret => secret.revealed).length;
        const percent = secrets.length ? Math.round(revealed / secrets.length * 100) : 0;
        const visible = secrets.filter(secret => !hidden || secret.revealed || peek);
        return `<section class="mnema-ib-secret-column"><h6><span><i class="fa-solid ${icon}" aria-hidden="true"></i> ${escapeHtml(name)}</span><button type="button" class="mnema-ib-action mnema-ib-icon" data-mnema-ib="add-secret" title="Добавить секрет" aria-label="Добавить секрет: ${escapeHtml(name)}" aria-expanded="false"><i class="fa-solid fa-plus" aria-hidden="true"></i></button></h6>
            <form class="mnema-ib-secret-form" data-owner="${hidden ? 'char' : 'user'}" hidden><textarea name="secret" rows="3" maxlength="600" required aria-label="Новый секрет" placeholder="Новый секрет…"></textarea><div><button type="submit" class="mnema-ib-action">Добавить</button><button type="button" class="mnema-ib-action" data-mnema-ib="cancel-secret">Отмена</button></div></form>
            ${secrets.length ? meter(`Раскрыто ${revealed} из ${secrets.length}`, percent) : '<p class="mnema-ib-note">Секретов пока нет</p>'}
            ${visible.length ? `<ul class="mnema-ib-list">${visible.map(line).join('')}</ul>` : ''}
            ${hidden && veiled ? `<button type="button" class="mnema-ib-action" data-mnema-ib="${peek ? 'unpeek' : 'peek'}"><i class="fa-solid ${peek ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i> ${peek ? 'Скрыть нераскрытые' : `Показать нераскрытые (${veiled})`}</button>` : ''}
        </section>`;
    };

    return `<section class="mnema-ib-section mnema-ib-secrets-section"><details class="mnema-ib-secrets" data-mnema-details="secrets">
        <summary><span class="mnema-ib-secret-heading"><i class="fa-solid fa-key" aria-hidden="true"></i><span>Секреты<small>Что известно друг о друге</small></span></span><i class="fa-solid fa-chevron-down mnema-ib-chevron" aria-hidden="true"></i></summary>
        <div class="mnema-ib-secret-columns">${column(mine, context?.name1 || 'Вы', 'fa-user', false)}${column(theirs, context?.name2 || 'Персонаж', 'fa-mask', true)}</div>
    </details></section>`;
}

function statusRows(state, settings, peek) {
    const rows = [];
    const outfits = [[getContext()?.name2 || '{{char}}', state.world.characterOutfit], [getContext()?.name1 || '{{user}}', state.world.userOutfit]].filter(([, outfit]) => outfit);
    if (outfits.length) rows.push(`<section class="mnema-ib-section"><h6><i class="fa-solid fa-shirt"></i> Одежда</h6><ul class="mnema-ib-list">${outfits.map(([name, outfit]) => `<li><b>${escapeHtml(name)}</b><span>${escapeHtml(outfit)}</span></li>`).join('')}</ul></section>`);
    if (settings.trackHealth) {
        const health = state.health;
        const vitals = [['Сытость', health.satiety], ['Энергия', health.energy]]
            .filter(([, vital]) => vital)
            .map(([label, vital]) => `<div class="mnema-ib-vital-card">${meter(label, vital.value, vital.value < 25 ? 'critical' : vital.value < 50 ? 'low' : '')}${vital.label ? `<small>${escapeHtml(vital.label)}</small>` : ''}${vital.value < 25 ? '<small class="mnema-ib-warning">Критическое состояние</small>' : ''}</div>`)
            .join('');
        const injuries = health.injuries.map(injury => `<span class="mnema-ib-tag ${escapeHtml(injury.severity)}">${escapeHtml(injury.name)}</span>`).join('');
        if (vitals || health.mood || injuries) {
            rows.push(`<section class="mnema-ib-section"><h6><i class="fa-solid fa-heart-pulse"></i> Состояние · ${escapeHtml(getContext()?.name2 || 'Персонаж')}</h6>${health.mood ? `<p class="mnema-ib-mood">${escapeHtml(health.mood.label)}</p>` : ''}<div class="mnema-ib-meters">${vitals}</div>${injuries ? `<div class="mnema-ib-tags">${injuries}</div>` : ''}</section>`);
        }
    }
    if (settings.trackRelationships && state.relationship.updatedAt) {
        const relationship = state.relationship;
        rows.push(`<section class="mnema-ib-section mnema-ib-relationship"><details class="mnema-ib-relationship-details" data-mnema-details="relationship">
            <summary title="Подробности отношений"><div class="mnema-ib-relationship-heading"><i class="fa-regular fa-heart" aria-hidden="true"></i><strong>${escapeHtml(relationship.stage || 'Отношения')}</strong><i class="fa-solid fa-chevron-down mnema-ib-chevron" aria-hidden="true"></i></div>${meter('Прогресс фазы', relationship.progress)}</summary>
            <div class="mnema-ib-relationship-content">${relationship.behavior ? `<p class="mnema-ib-note">${escapeHtml(relationship.behavior)}</p>` : ''}
            <div class="mnema-ib-meters">${[['trust', 'Доверие'], ['passion', 'Страсть'], ['devotion', 'Преданность'], ['attachment', 'Привязанность']].map(([key, label]) => meter(label, relationship[key], key)).join('')}</div></div></details></section>`);
    }
    if (settings.trackCalendar) {
        const plan = nearestStoryPlan(state.calendar, state.world.clock);
        const date = dateFromIso(plan?.date);
        if (plan) rows.push(`<section class="mnema-ib-section mnema-ib-reminder"><div class="mnema-ib-date-tile">${date ? `<b>${date.getDate()}</b><small>${escapeHtml(date.toLocaleDateString('ru-RU', { month: 'short' }))}</small>` : '<i class="fa-regular fa-calendar"></i>'}</div><div><h6><i class="fa-regular fa-bell"></i> Ближайший план</h6><strong>${escapeHtml(plan.title)}</strong><small>${escapeHtml([date ? formatCalendarDate(date) : 'Дата не задана', plan.time].filter(Boolean).join(' · '))}</small>${plan.details ? `<p class="mnema-ib-note">${escapeHtml(plan.details)}</p>` : ''}</div></section>`);
    }
    if (settings.trackSecrets) rows.push(secretsSection(state, peek));
    return rows.join('');
}

function actions(settings, busy = false) {
    const buttons = [];
    const add = (action, icon, label) => {
        const disabled = busy && ['memory', 'item', 'analyze', 'edit'].includes(action);
        const hint = disabled ? `${label} — дождитесь завершения создания` : label;
        buttons.push(`<button type="button" class="mnema-ib-action mnema-ib-icon" data-mnema-ib="${action}" title="${hint}" aria-label="${hint}"${disabled ? ' disabled' : ''}><i class="fa-solid ${icon}" aria-hidden="true"></i></button>`);
    };
    add('edit', 'fa-pen', 'Редактировать');
    if (settings.collectGallery && galleryEnabled(settings, 'memory')) add('memory', 'fa-camera-retro', 'Сохранить воспоминание');
    if (settings.collectGallery && galleryEnabled(settings, 'item')) add('item', 'fa-gem', 'Сохранить предмет');
    add('analyze', 'fa-wand-magic-sparkles', 'Анализировать сцену');
    add('open', 'fa-sliders', 'Открыть Mnema');
    return buttons.join('');
}

export function buildInfoblock({ scene, state, settings, live, busy, peek = false }) {
    if (live && state) scene = { ...scene, ...state.world, date: settings.trackCalendar ? state.calendar.currentDate : null };
    if (!scene) {
        scene = { ...(live ? state?.world : {}), date: live && settings.trackCalendar ? state?.calendar?.currentDate : null };
    }
    const date = dateFromIso(scene.date);
    const head = `<div class="mnema-ib-head">
        <div class="mnema-ib-place"><i class="fa-solid fa-location-dot"></i><div><strong>${escapeHtml(scene.location || state?.world?.location || 'Место не указано')}</strong><small>${escapeHtml([scene.indoor === true ? 'внутри' : scene.indoor === false ? 'снаружи' : '', scene.weather, Number.isFinite(scene.temperature) ? `${scene.temperature}°` : ''].filter(Boolean).join(' · '))}</small></div></div>
        <div class="mnema-ib-time"><strong>${escapeHtml(scene.clock || '··:··')}</strong><small>${escapeHtml(date ? formatCalendarDate(date, true) : '')}</small></div>${live && state ? '<i class="fa-solid fa-chevron-down mnema-ib-chevron" aria-hidden="true"></i>' : ''}
    </div>`;
    if (!live || !state) return `<div class="mnema-ib">${head}</div>`;
    return `<div class="mnema-ib mnema-ib-live${busy ? ' busy' : ''}">
        <details class="mnema-ib-details" data-mnema-details="scene"><summary title="Раскрыть или свернуть состояние сцены">${head}</summary>
            <div class="mnema-ib-actions" role="group" aria-label="Действия Mnema">${busy ? '<span class="mnema-ib-working" role="status">Создаётся…</span>' : ''}${actions(settings, busy)}</div>
            <div class="mnema-ib-body">${statusRows(state, settings, peek)}</div>
        </details>
    </div>`;
}

// Плашка живёт внутри .mes_text, поэтому вставляем/заменяем только её саму,
// не переписывая остальной HTML сообщения.
export function renderInfoblock(messageId, html) {
    const element = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
    if (!element) return;
    const existing = element.querySelector(':scope > .mnema-ib');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const block = wrapper.firstElementChild;
    // Плашка перерисовывается целиком, поэтому раскрытые <details> надо перенести
    // руками — иначе любое обновление захлопывает блок под курсором.
    const open = new Map();
    existing?.querySelectorAll('details[data-mnema-details]').forEach(details => open.set(details.dataset.mnemaDetails, details.open));
    block.querySelectorAll('details[data-mnema-details]').forEach(details => {
        if (open.has(details.dataset.mnemaDetails)) details.open = open.get(details.dataset.mnemaDetails);
    });
    if (existing) existing.replaceWith(block);
    else element.prepend(block);
}

export function removeInfoblocks() {
    document.querySelectorAll('.mnema-ib').forEach(element => element.remove());
}

export function lastCharacterMessageIndex(chat) {
    for (let index = chat.length - 1; index >= 0; index--) {
        const message = chat[index];
        if (!message.is_user && !message.is_system) return index;
    }
    return -1;
}

export function infoblockContext() {
    const context = getContext();
    return { context, chat: context?.chat || [] };
}
