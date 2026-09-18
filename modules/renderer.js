import { getContext } from '/scripts/extensions.js';
import { user_avatar } from '/script.js';
import { RELATIONSHIP_METRICS } from './config.js';
import { dateFromIso, formatCalendarDate, renderCalendar } from './calendar.js';
import { normalizeRelationship } from './state.js';
import { escapeHtml } from './utils.js';
import { t } from './i18n.js';
import { galleryEnabled } from './gallery-data.js';

export function createRenderer({ getState, getSettings, isProcessing, candidateIndices, getGalleryImageConfig, getGalleryStatus = () => ({ expanded: new Set() }) }) {
    const settings = new Proxy({}, { get: (_target, property) => getSettings()?.[property] });
    // Подсматривание в чужие тайны живёт только в текущей сессии: закрыл попап —
    // спойлер снова закрыт.
    let peeking = false;

    function renderOverview() {
        const state = getState({ create: false });
        const chat = getContext()?.chat || [];
        const notes = state?.pending?.eventNotes || [];
        const pendingIndices = state?.pending?.messageIndices || [];
        $('#mnema_pending_count').text(t('{n} сообщ. · {m} замет.', { n: pendingIndices.length, m: notes.length }));
        $('#mnema_pending').html(notes.length ? notes.map((note, index) => `
            <article class="mnema-note">
                <div class="mnema-note-head"><small>${t('Пакет {n}', { n: index + 1 })} · #${note.range?.[0]}–#${note.range?.[1]}</small><span>${note.closeArc ? 'Завершить арку' : 'Арка продолжается'}</span><button type="button" class="mnema-section-edit" data-mnema-edit="pending" data-edit-note="${index}" title="Редактировать конспект" aria-label="Редактировать конспект"><i class="fa-solid fa-pen"></i></button></div>
                <p>${escapeHtml(note.summary)}</p>${note.arcReason ? `<em>${escapeHtml(note.arcReason)}</em>` : ''}
            </article>`).join('') : '<p class="mnema-empty">Новая арка ещё не накопила событий.</p>');
    
        const arcs = state?.arcs || [];
        $('#mnema_arc_count').text(String(arcs.length));
        $('#mnema_arcs').html(arcs.length ? [...arcs].reverse().map(arc => `
            <article class="mnema-arc ${arc.active === false ? 'inactive' : ''}" data-arc-id="${escapeHtml(arc.id)}">
                <div class="mnema-arc-head"><div><small>#${arc.range?.[0]}–#${arc.range?.[1]}</small><h5>${escapeHtml(arc.title)}</h5></div>
                    <button type="button" class="mnema-section-edit" data-mnema-edit="arcs" data-edit-id="${escapeHtml(arc.id)}" title="Редактировать арку" aria-label="Редактировать арку"><i class="fa-solid fa-pen"></i></button>
                    <button class="mnema-arc-toggle" type="button" title="${arc.active === false ? 'Скрыть исходные сообщения и вернуть сводку' : 'Вернуть исходные сообщения'}"><i class="fa-solid ${arc.active === false ? 'fa-box-archive' : 'fa-eye'}"></i></button>
                </div>
                <p>${escapeHtml(arc.summary)}</p><small>${t('{n} сообщений · {m} событий', { n: arc.messageIndices?.length || 0, m: arc.eventNotes?.length || 0 })}</small>
            </article>`).join('') : '<p class="mnema-empty">Завершённых арок пока нет.</p>');
    
        const unprocessed = state ? candidateIndices(chat, state).length : 0;
        $('#mnema_pending_badge').text(notes.length).prop('hidden', notes.length === 0);
        $('#mnema_arc_badge').text(arcs.length).prop('hidden', arcs.length === 0);
        $('#mnema_header_status_dot').toggleClass('busy', isProcessing()).toggleClass('off', !settings.enabled)
            .attr('title', isProcessing() ? 'Mnema анализирует…' : settings.enabled ? 'Mnema включена' : 'Mnema выключена');
        $('#mnema_status_text').text(isProcessing() ? t('Mnema анализирует…')
            : settings.enabled ? t('До следующей проверки: {n}', { n: Math.max(0, settings.interval - unprocessed) })
                : t('Mnema выключена'));
        // Кнопка работает и без новых сообщений: тогда она перечитывает
        // последний интервал. Гасим её, только когда нечего и перечитывать.
        const recheckable = Boolean(notes.length);
        $('#mnema_analyze_now')
            .prop('disabled', isProcessing() || (unprocessed === 0 && !recheckable))
            .attr('title', unprocessed === 0 && recheckable ? t('Перечитать последний интервал заново') : t('Проверить новые сообщения'));
        renderManual(state, chat);
        renderScene(state);
        renderWorld(state);
        renderSecrets(state);
        renderCalendar(state);
        renderHealth(state);
        renderRelationship(state);
        renderGallery(state);
    }
    
    function renderScene(state) {
        const world = state?.world || {};
        $('.mnema-scene-cell[data-scene-cell="date"]').prop('hidden', !settings.trackCalendar);
        if (settings.trackCalendar) {
            const anchor = dateFromIso(state?.calendar?.currentDate);
            $('#mnema_scene_date').text(anchor ? formatCalendarDate(anchor, true) : 'Не определена');
        }
        $('#mnema_scene_time').text(world.clock || world.timeOfDay || '—');
        $('#mnema_scene_time_sub').text(world.clock ? world.timeOfDay || '' : '');
        $('#mnema_scene_location').text(world.location || 'Не определена');
        $('#mnema_scene_location_sub').text(world.indoor === true ? 'внутри' : world.indoor === false ? 'снаружи' : '');
        $('#mnema_scene_weather').text([world.weather, Number.isFinite(world.temperature) ? `${world.temperature}°` : ''].filter(Boolean).join(' · ') || '—');
    
        const hasLocation = Boolean(world.location && world.description);
        $('#mnema_overview_location').prop('hidden', !hasLocation);
        if (hasLocation) {
            $('#mnema_overview_location_name').text(world.location);
            const meta = [world.indoor === true ? 'внутри' : world.indoor === false ? 'снаружи' : '', world.clock, world.timeOfDay].filter(Boolean).join(' · ');
            $('#mnema_overview_location_meta').text(meta);
            $('#mnema_overview_location_description').text(world.description);
        }
    
        const relationship = state?.relationship;
        const hasRelationship = Boolean(settings.trackRelationships && relationship && (relationship.progress || relationship.phase || relationship.ladder?.length || relationship.stage !== 'Не определено'));
        $('#mnema_overview_relationship').prop('hidden', !hasRelationship);
        if (hasRelationship) {
            const people = getParticipantVisuals();
            for (const [selector, url, name] of [['#mnema_overview_user_avatar', people.userAvatar, people.userName], ['#mnema_overview_char_avatar', people.charAvatar, people.charName]]) {
                const image = $(selector);
                image.attr('alt', name).toggleClass('empty', !url);
                if (url) image.attr('src', url); else image.removeAttr('src');
                image.parent().attr('data-initial', String(name).trim().charAt(0).toUpperCase() || '?');
            }
            $('#mnema_overview_relationship_stage').text(relationship.stage);
            $('#mnema_overview_relationship_fill').css('width', `${relationship.progress}%`);
            const rung = (relationship.ladder || []).find(item => item.id === relationship.phase);
            $('#mnema_overview_relationship_value').text([rung?.title, t('{n}% общего прогресса', { n: relationship.progress })].filter(Boolean).join(' · '));
        }
    
        const secrets = state?.secrets;
        const hasSecrets = Boolean(settings.trackSecrets && secrets && (secrets.revealed.length || secrets.unrevealed.length));
        $('#mnema_overview_secrets').prop('hidden', !hasSecrets);
        if (hasSecrets) {
            const charSecrets = collectSecrets(state, 'char');
            $('#mnema_overview_secrets_revealed').text(collectSecrets(state, 'user').length);
            $('#mnema_overview_secrets_unrevealed').text(`${charSecrets.filter(secret => secret.revealed).length}/${charSecrets.length}`);
        }
    
        const health = state?.health;
        const hasHealth = Boolean(settings.trackHealth && health && (health.satiety || health.energy || health.mood));
        $('#mnema_overview_char').prop('hidden', !hasHealth);
        if (hasHealth) {
            $('#mnema_overview_char_name').text(getContext()?.name2 || '{{char}}');
            $('#mnema_overview_char_mood').text(health.mood?.label || '');
            $('#mnema_overview_satiety_fill').css('width', `${health.satiety?.value ?? 0}%`);
            $('#mnema_overview_energy_fill').css('width', `${health.energy?.value ?? 0}%`);
        }
    }
    
    function renderWorld(state) {
        const world = state?.world || {};
        $('#mnema_world_location').text(world.location || 'Локация не определена');
        const weather = [world.weather, Number.isFinite(world.temperature) ? `${world.temperature}°` : ''].filter(Boolean).join(' ');
        const meta = [world.indoor === true ? 'внутри' : world.indoor === false ? 'снаружи' : '', world.clock, world.timeOfDay, weather].filter(Boolean).join(' · ');
        $('#mnema_world_meta').text(meta);
        $('#mnema_world_description').text(world.description || 'Пока нет данных о месте действия.');
    }
    
    function renderManual(state, chat) {
        const last = Math.max(0, chat.length - 1);
        const archived = state?.arcs?.reduce((total, arc) => total + (arc.messageIndices?.length || 0), 0) || 0;
        $('#mnema_manual_hint').text(last
            ? t('Доступны номера 1–{n}{hint}. Номер сообщения — его ID в чате.', {
                n: last,
                hint: archived ? t(' · уже в арках: {n} сообщ.', { n: archived }) : '',
            })
            : t('В чате пока нет сообщений.'));
        $('#mnema_manual_run, #mnema_manual_full').prop('disabled', isProcessing() || !last);
    }
    
    function collectSecrets(state, owner) {
        const mark = (items, revealed) => (items || []).filter(item => (item.owner || 'char') === owner).map(item => ({ ...item, revealed }));
        return [...mark(state?.secrets?.revealed, true), ...mark(state?.secrets?.unrevealed, false)];
    }

    function renderSecrets(state) {
        const people = getParticipantVisuals();
        const userSecrets = collectSecrets(state, 'user');
        const charSecrets = collectSecrets(state, 'char');
        const revealedCount = charSecrets.filter(secret => secret.revealed).length;

        $('#mnema_user_secrets_title').text(t('Секреты {name}', { name: people.userName }));
        $('#mnema_char_secrets_title').text(t('Секреты {name}', { name: people.charName }));
        $('#mnema_user_secrets_count').text(userSecrets.length);
        $('#mnema_char_secrets_count').text(charSecrets.length);
        $('#mnema_char_secrets_progress').text(charSecrets.length
            ? t('{revealed} из {total} раскрыто', { revealed: revealedCount, total: charSecrets.length })
            : t('тайн пока нет'));
        $('#mnema_char_secrets_fill').css('width', charSecrets.length ? `${Math.round((revealedCount / charSecrets.length) * 100)}%` : '0%');
        // Свои секреты игрок знает всегда, чужие нераскрытые — только по кнопке.
        $('#mnema_user_secrets').html(renderSecretItems(userSecrets, { spoil: true, peekable: false, emptyText: 'Своих тайн пока не нашлось.' }));
        $('#mnema_char_secrets').html(renderSecretItems(charSecrets, { spoil: peeking, peekable: true, emptyText: 'Чужих тайн пока не нашлось.' }));
    }

    function renderSecretItems(items, { spoil, peekable, emptyText }) {
        if (!items.length) return `<div class="mnema-secret-empty"><i class="fa-solid fa-key"></i><span>${emptyText}</span></div>`;
        const hidden = items.filter(secret => !secret.revealed).length;
        const cards = items.map((secret, index) => {
            const title = secret.title || `Секрет ${index + 1}`;
            const veiled = !secret.revealed && !spoil;
            // Класс .hidden занят SillyTavern (visibility: hidden), поэтому unrevealed.
            return `<article class="mnema-secret-item ${secret.revealed ? 'revealed' : 'unrevealed'}">
                <span class="mnema-secret-marker"><i class="fa-solid ${secret.revealed ? 'fa-lock-open' : 'fa-lock'}"></i></span>
                <div>${veiled
        ? '<h5 class="mnema-secret-veil">Нераскрытая тайна</h5>'
        : `<h5>${escapeHtml(title)}</h5>${secret.summary ? `<p>${escapeHtml(secret.summary)}</p>` : ''}`}</div>
            </article>`;
        }).join('');
        const peek = !peekable || !hidden ? ''
            : spoil
                ? '<button type="button" class="mnema-secret-peek" data-mnema-peek="off"><i class="fa-solid fa-eye-slash"></i> Снова скрыть</button>'
                : `<button type="button" class="mnema-secret-peek" data-mnema-peek="on"><i class="fa-solid fa-eye"></i> ${t('Показать {n} нераскрытых', { n: hidden })}</button>`;
        return cards + peek;
    }
    
    function renderHealth(state) {
        const health = state?.health || {};
        $('#mnema_health_name').text(getContext()?.name2 || '{{char}}');
        const renderVital = (key, vital) => {
            const value = vital?.value;
            const known = Number.isFinite(value);
            const level = !known ? 'unknown' : value < 25 ? 'critical' : value < 50 ? 'low' : value < 75 ? 'medium' : 'high';
            $(`.mnema-vital[data-vital="${key}"]`).attr('data-level', level);
            $(`#mnema_${key}_value`).text(known ? `${value}%` : '—%');
            $(`#mnema_${key}_fill`).css('width', known ? `${value}%` : '0%');
            $(`#mnema_${key}_label`).text(vital?.label || (known ? (value < 25 ? 'Критически мало' : value < 50 ? 'Низко' : value < 75 ? 'Нормально' : 'Хорошо') : 'Нет данных'));
        };
        renderVital('satiety', health.satiety);
        renderVital('energy', health.energy);
    
        const mood = String(health.mood?.label || 'Не определено');
        const moodLower = mood.toLowerCase();
        const moodIcon = /рад|счаст|весел|воодуш|happy|joy/u.test(moodLower) ? 'fa-face-smile'
            : /груст|печал|подав|sad/u.test(moodLower) ? 'fa-face-frown'
                : /зл|раздраж|ярост|angry/u.test(moodLower) ? 'fa-face-angry'
                    : /устал|сонн|tired/u.test(moodLower) ? 'fa-face-tired' : 'fa-face-meh';
        $('#mnema_mood_label').text(mood);
        $('#mnema_mood_icon i').attr('class', `fa-regular ${moodIcon}`);
    
        const injuries = health.injuries || [];
        $('#mnema_injuries_section').prop('hidden', injuries.length === 0);
        $('#mnema_injury_count').text(injuries.length);
        $('#mnema_health_badge').prop('hidden', injuries.length === 0 && (health.satiety?.value ?? 100) >= 25 && (health.energy?.value ?? 100) >= 25);
        $('#mnema_injuries').html(injuries.map(injury => `<article class="mnema-injury-item ${escapeHtml(injury.severity)}"><span><i class="fa-solid fa-bandage"></i></span><div><strong>${escapeHtml(injury.name)}</strong>${injury.details ? `<small>${escapeHtml(injury.details)}</small>` : ''}</div></article>`).join(''));
    
        const knownValues = [health.satiety?.value, health.energy?.value].filter(Number.isFinite);
        const lowest = knownValues.length ? Math.min(...knownValues) : null;
        const summary = injuries.length ? 'Есть травмы' : lowest !== null && lowest < 25 ? 'Нужна помощь' : lowest !== null && lowest < 50 ? 'Нужен отдых' : knownValues.length || health.mood ? 'Стабильно' : 'Нет данных';
        $('#mnema_health_summary').text(summary).attr('data-state', injuries.length || (lowest !== null && lowest < 25) ? 'warning' : 'normal');
    }
    
    function getParticipantVisuals() {
        const context = getContext() || {};
        const charName = context.name2 || '{{char}}';
        const userName = context.name1 || '{{user}}';
        const character = context.characters?.[context.characterId];
        let charAvatar = context.getCharacterAvatar?.(context.characterId) || '';
        if (!charAvatar && character?.avatar && character.avatar !== 'none') charAvatar = `/characters/${encodeURIComponent(character.avatar)}`;
        const userAvatar = user_avatar ? context.getThumbnailUrl('persona', user_avatar) : '';
        return { charName, userName, charAvatar, userAvatar };
    }
    
    // Лестница целиком, а не одна подпись: видно и пройденное, и то, что впереди,
    // поэтому пропущенная ступень сразу бросается в глаза. Ступени приходят из
    // состояния чата — у каждой истории они свои.
    function renderPhaseTrack(relationship) {
        const ladder = relationship.ladder || [];
        $('#mnema_relationship_phase').prop('hidden', !ladder.length);
        const currentIndex = ladder.findIndex(rung => rung.id === relationship.phase);
        $('#mnema_relationship_phase_track').html(ladder.map((rung, index) => {
            // Ступень выше текущей, но уже прожитая, — это откат: история там
            // была, и гасить её как «впереди» было бы враньём.
            const status = index === currentIndex ? 'current' : (currentIndex >= 0 && index < currentIndex) || rung.reached ? 'passed' : 'ahead';
            return `<li class="mnema-phase-step" data-state="${status}"${rung.note ? ` title="${escapeHtml(rung.note)}"` : ''}>${escapeHtml(rung.title)}</li>`;
        }).join(''));
        $('#mnema_relationship_next').prop('hidden', !relationship.nextStep);
        $('#mnema_relationship_next_text').text(relationship.nextStep || '');
    }

    function renderRelationship(state) {
        const relationship = state?.relationship || normalizeRelationship(null);
        const people = getParticipantVisuals();
        $('#mnema_user_name').text(people.userName);
        $('#mnema_char_name').text(people.charName);
        for (const [selector, url, name] of [['#mnema_user_avatar', people.userAvatar, people.userName], ['#mnema_char_avatar', people.charAvatar, people.charName]]) {
            const image = $(selector);
            image.attr('alt', name).toggleClass('empty', !url);
            if (url) image.attr('src', url); else image.removeAttr('src');
            image.parent().attr('data-initial', String(name).trim().charAt(0).toUpperCase() || '?');
        }
        $('#mnema_relationship_stage').text(relationship.stage);
        renderPhaseTrack(relationship);
        $('#mnema_relationship_progress_value').text(`${relationship.progress}%`);
        $('#mnema_relationship_progress_fill').css('width', `${relationship.progress}%`);
        $('#mnema_relationship_metrics').html(RELATIONSHIP_METRICS.map(([key, label, icon]) => {
            const value = relationship[key] || 0;
            const trend = relationship.trends?.[key] || 0;
            return `<section class="mnema-relationship-metric" data-metric="${key}">
                <div><span><i class="fa-solid ${icon}"></i>${label}</span><strong>${value}% ${trend ? `<i class="fa-solid fa-arrow-${trend > 0 ? 'up' : 'down'}"></i>` : ''}</strong></div>
                <div class="mnema-relationship-metric-track"><i style="width:${value}%"></i></div>
            </section>`;
        }).join(''));
    }
    
    function renderGallery(state) {
        const memoriesEnabled = galleryEnabled(settings, 'memory');
        const itemsEnabled = galleryEnabled(settings, 'item');
        const memories = memoriesEnabled ? state?.gallery?.memories || [] : [];
        const items = itemsEnabled ? state?.gallery?.items || [] : [];
        const status = getGalleryStatus();
        if (!galleryEnabled(settings, status.activeKind || 'memory')) status.activeKind = memoriesEnabled ? 'memory' : 'item';
        const active = status.activeKind === 'item' ? 'items' : 'memories';
        $('.mnema-gallery-switch button').each(function () {
            $(this).prop('hidden', this.dataset.galleryKind === 'items' ? !itemsEnabled : !memoriesEnabled).toggleClass('active', this.dataset.galleryKind === active);
        });
        $('.mnema-gallery-grid').removeClass('active').filter(`[data-gallery-panel="${active}"]`).addClass('active');
        $('#mnema_gallery_add').prop('disabled', Boolean(status.busy) || isProcessing() || (!memoriesEnabled && !itemsEnabled)).text(status.busy ? status.busy.phase === 'image' ? 'Создаю изображение…' : 'Восстанавливаю воспоминание…' : active === 'items' ? '+ Предмет из текущей сцены' : '+ Воспоминание из текущей сцены');
        $('#mnema_gallery_memory_count').text(memories.length);
        $('#mnema_gallery_item_count').text(items.length);
        $('#mnema_gallery_badge').text(memories.length + items.length).prop('hidden', memories.length + items.length === 0);
        $('#mnema_gallery_memories').html(renderGalleryEntries(memories, 'memory'));
        $('#mnema_gallery_items').html(renderGalleryEntries(items, 'item'));
    }
    
    function renderGalleryEntries(entries, kind) {
        if (!entries.length) return `<div class="mnema-gallery-empty"><i class="fa-solid ${kind === 'item' ? 'fa-gem' : 'fa-camera-retro'}"></i><span>${kind === 'item' ? 'Памятных предметов пока нет.' : 'Особенных воспоминаний пока нет.'}</span></div>`;
        const imagesAvailable = Boolean(getGalleryImageConfig());
        const { busy, expanded } = getGalleryStatus();
        return entries.map(entry => {
            const open = expanded?.has(entry.id);
            const loading = busy?.id === entry.id;
            const disabled = busy || isProcessing() ? 'disabled' : '';
            const detail = String(entry.detail || '').split(/\n\s*\n/).filter(Boolean).map(text => `<p>${escapeHtml(text)}</p>`).join('');
            return `<article class="mnema-gallery-card ${open ? 'open' : ''}" data-gallery-id="${escapeHtml(entry.id)}">
            <div class="mnema-gallery-cover"><button class="mnema-gallery-toggle" type="button" aria-expanded="${Boolean(open)}" ${disabled}>
            ${loading ? `<span class="mnema-gallery-loading"><i class="fa-solid fa-spinner fa-spin"></i>${busy.phase === 'image' ? 'Создаю изображение…' : 'Вспоминаю…'}</span>` : entry.imageUrl ? `<img src="${escapeHtml(entry.imageUrl)}" alt="" loading="lazy">` : `<span class="mnema-gallery-placeholder"><i class="fa-solid ${kind === 'item' ? 'fa-gem' : 'fa-camera-retro'}"></i><small>${entry.detail ? 'Открыть' : 'Вспомнить'}</small></span>`}
            <span class="mnema-gallery-cover-title">${escapeHtml(entry.title)}<i class="fa-solid fa-chevron-${open ? 'up' : 'down'}"></i></span></button>
            ${entry.imageUrl && open ? '<button type="button" class="mnema-gallery-view" title="Увеличить изображение" aria-label="Увеличить изображение"><i class="fa-solid fa-expand"></i></button>' : ''}</div>
            <div class="mnema-gallery-reveal" ${open ? '' : 'hidden'}>${detail ? `<div class="mnema-gallery-detail">${detail}</div>` : `<p>${escapeHtml(entry.summary || '')}</p>`}
            <div class="mnema-gallery-actions">${imagesAvailable && entry.imagePrompt ? `<button class="menu_button mnema-gallery-image-button" type="button" ${disabled}>${entry.imageUrl ? 'Обновить изображение' : 'Создать изображение'}</button>` : ''}<button class="menu_button mnema-gallery-redo" type="button" ${disabled}>${entry.detail ? 'Пересоздать полностью' : 'Вспомнить'}</button><button class="menu_button mnema-gallery-delete" type="button" ${disabled} title="Удалить запись" aria-label="Удалить запись"><i class="fa-solid fa-trash-can"></i></button></div></div>
        </article>`;
        }).join('');
    }
    
    

    return {
        getParticipantVisuals, renderOverview, renderGallery, renderRelationship,
        setSecretPeek: value => { peeking = Boolean(value); renderSecrets(getState({ create: false })); },
        isPeeking: () => peeking,
    };
}
