import { infoblockTheme, themedInfoblockHeader } from './infoblock-themes.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { getContext } from '/scripts/extensions.js';
import { escapeHtml } from './utils.js';
import { applySecretsUpdate, normalizeClock, timeOfDayFromClock } from './state.js';
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
        ...(settings.trackSecrets ? ['- revealed only when an existing secret actually became known to both protagonists in this reply, including world secrets. Copy its title exactly, never its contents; suspicion and hints are not disclosure. Repeat the field for several disclosures.'] : []),
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

export function hasSceneTag(text) {
    return TAG.test(String(text || ''));
}

// Разбирать только message.mes нельзя: соседние расширения держат свою копию
// ответа (display_text, текущий свайп) и переписывают mes целиком — метка тогда
// остаётся видимой, но до разбора не доходит. Берём первую копию, где она есть.
export function sceneTagSource(message) {
    if (!message) return '';
    const swipe = Array.isArray(message.swipes) && Number.isInteger(message.swipe_id) ? message.swipes[message.swipe_id] : null;
    for (const text of [message.mes, message.extra?.display_text, swipe]) {
        if (hasSceneTag(text)) return String(text);
    }
    return '';
}

// Метка живёт не только в message.mes. ST рисует сообщение из display_text,
// если его выставил перевод или regex-скрипт «только отображение», а в контекст
// уходит текущий свайп — почистить надо все три копии, иначе метка останется
// видимой или вернётся в промпт при свайпе.
export function stripSceneTagFromMessage(message) {
    if (!message) return false;
    const before = message.mes;
    const displayBefore = message.extra?.display_text;
    message.mes = stripSceneTag(message.mes);
    if (Array.isArray(message.swipes) && Number.isInteger(message.swipe_id) && message.swipes.length > message.swipe_id) {
        message.swipes[message.swipe_id] = message.mes;
    }
    if (displayBefore) message.extra.display_text = stripSceneTag(displayBefore);
    // Чужая копия ответа тоже считается изменением: метка могла остаться только
    // в ней, и без перерисовки она так и висела бы в чате.
    return message.mes !== before || message.extra?.display_text !== displayBefore;
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
    // Метка описывает конкретное сообщение, поэтому вместе со временем
    // запоминаем его номер: разбор более раннего интервала не должен потом
    // отмотать часы назад.
    if (scene.clock && (state.world.clockIndex === null || messageIndex >= state.world.clockIndex)) {
        if (state.world.clock !== scene.clock) {
            state.world.clock = scene.clock;
            changed = true;
        }
        state.world.clockIndex = messageIndex;
    }
    const timeOfDay = timeOfDayFromClock(state.world.clock);
    if (state.world.timeOfDay !== timeOfDay) { state.world.timeOfDay = timeOfDay; changed = true; }
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

// badge живёт внутри подписи, а не рядом со значением: в теме «Часы» значение
// поднято над подписью, и значок, привязанный к нему, уезжал бы в отдельную
// строку. При подписи он держится одинаково во всех оформлениях.
function meter(label, value, tone = '', badge = '') {
    const percent = Math.max(0, Math.min(100, Number(value) || 0));
    return `<div class="mnema-ib-meter ${tone}"><div><span>${escapeHtml(label)}${badge}</span><b>${percent}%</b></div><div class="mnema-ib-track" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div></div>`;
}

const SEVERITY_LABEL = { minor: 'Лёгкая', moderate: 'Средняя', severe: 'Тяжёлая' };

const MOOD_ICON = { positive: 'faceSmile', neutral: 'faceMeh', negative: 'faceFrown' };

// Настроение висело голой строкой крупнее соседнего текста и читалось как
// случайная реплика. Тон модель записывает давно, но инфоблок его не показывал —
// теперь он и даёт значок с цветом, а сама строка становится отдельной меткой.
function moodChip(mood) {
    if (!mood?.label) return '';
    const tone = MOOD_ICON[mood.tone] ? mood.tone : 'neutral';
    return `<p class="mnema-ib-mood" data-tone="${tone}">${icon(MOOD_ICON[tone])}<span>${escapeHtml(mood.label)}</span></p>`;
}

// Травмы были россыпью одинаковых пилюль: тяжесть читалась только по цвету
// рамки, а подробности не показывались вовсе, хотя модель их записывает.
function injuryList(injuries) {
    if (!injuries.length) return '';
    const line = injury => {
        const severity = SEVERITY_LABEL[injury.severity] ? injury.severity : 'minor';
        const meta = [SEVERITY_LABEL[severity], injury.details].filter(Boolean).join(' · ');
        return `<li data-severity="${severity}">${icon('injury')}<div><b>${escapeHtml(injury.name)}</b><small>${escapeHtml(meta)}</small></div></li>`;
    };
    return `<ul class="mnema-ib-injuries">${injuries.map(line).join('')}</ul>`;
}

const RUNG_STATE_LABEL = { passed: 'Пройдено', current: 'Сейчас', ahead: 'Впереди' };

// Дорожка ступеней. Столбиком все ступени сразу занимали в плашке больше места,
// чем всё остальное вместе, а названия здесь длинные и в строку не ложатся —
// поэтому шкала из точек, а под ней одна карточка той ступени, что выбрана.
// Листается стрелками и самими точками, без перерисовки плашки.
//
// Статус считаем так же, как основная панель: ступень выше текущей, но уже
// отмеченная пройденной, — это откат, и гасить её как «впереди» было бы враньём.
function ladderTrail(ladder, current) {
    if (!ladder.length) return '';
    const stateOf = (rung, index) => index === current ? 'current' : (current >= 0 && index < current) || rung.reached ? 'passed' : 'ahead';
    // Открыта та ступень, на которой история стоит; если её нет — первая.
    const focus = current >= 0 ? current : 0;
    const dots = ladder.map((rung, index) => `<button type="button" class="mnema-ib-trail-dot" data-trail-dot="${index}" data-state="${stateOf(rung, index)}"${index === focus ? ' aria-current="step"' : ''}${Math.abs(index - focus) > 1 ? ' hidden' : ''} title="${escapeHtml(rung.title)}" aria-label="${escapeHtml(rung.title)}"></button>`).join('');
    const cards = ladder.map((rung, index) => `<article class="mnema-ib-trail-card" data-state="${stateOf(rung, index)}"${index === focus ? '' : ' hidden'}>
        <small>${RUNG_STATE_LABEL[stateOf(rung, index)]}</small><strong>${escapeHtml(rung.title)}</strong>${rung.note ? `<p>${escapeHtml(rung.note)}</p>` : ''}
    </article>`).join('');
    // Видно всегда ровно три места, и выбранная ступень держится в среднем. На
    // краю лестницы соседа нет — его место занимает пустышка, иначе выбранная
    // точка съезжала бы с центра именно там, где и так не на что смотреть.
    return `<div class="mnema-ib-trail" data-trail-focus="${focus}" data-trail-size="${ladder.length}" aria-label="Ступени отношений">
        <div class="mnema-ib-trail-rail"><span class="mnema-ib-trail-slot" data-trail-edge="start" aria-hidden="true"${focus > 0 ? ' hidden' : ''}></span>${dots}<span class="mnema-ib-trail-slot" data-trail-edge="end" aria-hidden="true"${focus < ladder.length - 1 ? ' hidden' : ''}></span></div>
        <div class="mnema-ib-trail-view">
            <button type="button" class="mnema-ib-trail-nav" data-trail-nav="-1" title="Предыдущая ступень" aria-label="Предыдущая ступень"${focus === 0 ? ' disabled' : ''}>${icon('chevronLeft')}</button>
            <div class="mnema-ib-trail-cards">${cards}</div>
            <button type="button" class="mnema-ib-trail-nav" data-trail-nav="1" title="Следующая ступень" aria-label="Следующая ступень"${focus === ladder.length - 1 ? ' disabled' : ''}>${icon('chevronRight')}</button>
        </div>
    </div>`;
}

// Чужие тайны — спойлер: пока не нажали «показать», видно только счётчик и
// полосу прогресса раскрытия. peek — множество категорий, которые раскрыты
// прямо сейчас: у персонажа и у мира спойлер свой.
function secretsSection(state, peek) {
    const own = owner => [
        ...state.secrets.revealed.filter(item => (item.owner || 'char') === owner).map(item => ({ ...item, revealed: true })),
        ...state.secrets.unrevealed.filter(item => (item.owner || 'char') === owner).map(item => ({ ...item, revealed: false })),
    ];
    const context = getContext();
    const mine = own('user');
    const theirs = own('char');
    const line = secret => `<li class="mnema-ib-secret">${icon(secret.revealed ? 'lockOpen' : 'lock')}<div><b>${escapeHtml(secret.title)}</b><small>${secret.revealed ? 'Раскрыт' : secret.owner === 'world' ? 'Тайна мира' : 'Личная тайна'}</small>${secret.summary ? `<p>${escapeHtml(secret.summary)}</p>` : ''}</div></li>`;
    const column = (secrets, name, glyph, owner) => {
        const hidden = owner !== 'user';
        const open = peek.has(owner);
        const veiled = secrets.filter(secret => !secret.revealed).length;
        const revealed = secrets.filter(secret => secret.revealed).length;
        const percent = secrets.length ? Math.round(revealed / secrets.length * 100) : 0;
        const visible = secrets.filter(secret => !hidden || secret.revealed || open);
        return `<section class="mnema-ib-secret-column"><h6><span>${icon(glyph)} ${escapeHtml(name)}</span><span class="mnema-ib-secret-tools"><button type="button" class="mnema-ib-action mnema-ib-icon" data-mnema-focus="secrets" data-focus-owner="${owner}" title="Придумать секреты" aria-label="Придумать секреты: ${escapeHtml(name)}"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i></button><button type="button" class="mnema-ib-action mnema-ib-icon" data-mnema-ib="add-secret" title="Добавить секрет" aria-label="Добавить секрет: ${escapeHtml(name)}" aria-expanded="false"><i class="fa-solid fa-plus" aria-hidden="true"></i></button></span></h6>
            <form class="mnema-ib-secret-form" data-owner="${owner}" hidden><textarea name="secret" rows="3" maxlength="180" required aria-label="Новый секрет" placeholder="Новый секрет…"></textarea><div><button type="submit" class="mnema-ib-action">Добавить</button><button type="button" class="mnema-ib-action" data-mnema-ib="cancel-secret">Отмена</button></div></form>
            ${secrets.length ? meter(t('Раскрыто {n} из {m}', { n: revealed, m: secrets.length }), percent) : '<p class="mnema-ib-note">Секретов пока нет</p>'}
            ${visible.length ? `<ul class="mnema-ib-list">${visible.map(line).join('')}</ul>` : ''}
            ${hidden && veiled ? `<button type="button" class="mnema-ib-action" data-mnema-ib="${open ? 'unpeek' : 'peek'}" data-peek-owner="${owner}">${icon(open ? 'eyeSlash' : 'eye')} ${open ? 'Скрыть нераскрытые' : t('Показать нераскрытые ({n})', { n: veiled })}</button>` : ''}
        </section>`;
    };

    return `<section class="mnema-ib-section mnema-ib-secrets-section"><details class="mnema-ib-secrets" data-mnema-details="secrets">
        <summary><span class="mnema-ib-secret-heading">${icon('key')}<span>Секреты<small>Что известно друг о друге</small></span></span>${icon('chevronDown', 'mnema-ib-chevron')}</summary>
        <div class="mnema-ib-secret-columns">${column(mine, context?.name1 || 'Вы', 'user', 'user')}${column(theirs, context?.name2 || 'Персонаж', 'mask', 'char')}${column(own('world'), 'Секреты мира', 'globe', 'world')}</div>
    </details></section>`;
}

function statusRows(state, settings, peek) {
    const rows = [];
    const outfits = [[getContext()?.name2 || '{{char}}', state.world.characterOutfit], [getContext()?.name1 || '{{user}}', state.world.userOutfit]].filter(([, outfit]) => outfit);
    if (outfits.length) rows.push(`<section class="mnema-ib-section mnema-ib-outfits"><h6>${icon('shirt')} Одежда</h6><ul class="mnema-ib-list">${outfits.map(([name, outfit]) => `<li><b>${escapeHtml(name)}</b><span>${escapeHtml(outfit)}</span></li>`).join('')}</ul></section>`);
    if (settings.trackHealth) {
        const health = state.health;
        // Критическое состояние обозначаем значком при подписи, а не строкой
        // словами: фраза занимала целую строку под каждой шкалой и повторяла то,
        // что уже сказано цветом полосы.
        const alarm = `<span class="mnema-ib-alarm" title="Критическое состояние" aria-label="Критическое состояние">${icon('alert')}</span>`;
        const vitals = [['Сытость', health.satiety], ['Энергия', health.energy]]
            .filter(([, vital]) => vital)
            .map(([label, vital]) => `<div class="mnema-ib-vital-card">${meter(label, vital.value, vital.value < 25 ? 'critical' : vital.value < 50 ? 'low' : '', vital.value < 25 ? alarm : '')}${vital.label ? `<small>${escapeHtml(vital.label)}</small>` : ''}</div>`)
            .join('');
        const injuries = injuryList(health.injuries);
        if (vitals || health.mood || injuries) {
            rows.push(`<section class="mnema-ib-section mnema-ib-vitals"><h6>${icon('pulse')} ${escapeHtml(t('Состояние · {name}', { name: getContext()?.name2 || t('Персонаж') }))}</h6>${moodChip(health.mood)}<div class="mnema-ib-meters">${vitals}</div>${injuries}</section>`);
        }
    }
    if (settings.trackRelationships && state.relationship.updatedAt) {
        const relationship = state.relationship;
        const ladder = relationship.ladder || [];
        const current = ladder.findIndex(rung => rung.id === relationship.phase);
        // Заголовок — ступень, на которой стоим, поэтому в пузырьке рядом место
        // только для той, что впереди: повторять текущую там незачем.
        const ahead = current >= 0 ? ladder[current + 1] : ladder[0];
        rows.push(`<section class="mnema-ib-section mnema-ib-relationship"><details class="mnema-ib-relationship-details" data-mnema-details="relationship">
            <summary title="Подробности отношений"><div class="mnema-ib-relationship-heading">${icon('heart')}<strong>${escapeHtml(relationship.stage || 'Отношения')}</strong>${ahead ? `<span class="mnema-ib-tag mnema-ib-ahead" title="Следующая ступень: ${escapeHtml(ahead.title)}${ahead.note ? ` — ${escapeHtml(ahead.note)}` : ''}">${escapeHtml(t('далее · {title}', { title: ahead.title }))}</span>` : ''}${icon('chevronDown', 'mnema-ib-chevron')}</div>${meter('Прогресс фазы', relationship.progress)}</summary>
            <div class="mnema-ib-relationship-content">${relationship.behavior ? `<p class="mnema-ib-note">${escapeHtml(relationship.behavior)}</p>` : ''}
            ${relationship.nextStep ? `<div class="mnema-ib-next-step"><small>${icon('arrowRight')}Следующий шаг</small><p>${escapeHtml(relationship.nextStep)}</p></div>` : ''}
            ${ladderTrail(ladder, current)}
            <div class="mnema-ib-meters">${[['trust', 'Доверие'], ['passion', 'Страсть'], ['devotion', 'Преданность'], ['attachment', 'Привязанность']].map(([key, label]) => meter(label, relationship[key], key)).join('')}</div></div></details></section>`);
    }
    if (settings.trackCalendar) {
        const plan = nearestStoryPlan(state.calendar, state.world.clock);
        const date = dateFromIso(plan?.date);
        const heading = `<h6 class="mnema-ib-head-row"><span>${icon('bell')} Ближайший план</span><button type="button" class="mnema-ib-action mnema-ib-icon" data-mnema-focus="plans" title="Придумать поводы пересечься" aria-label="Придумать поводы пересечься"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i></button></h6>`;
        // Раздел рисуем и с пустым календарём: кнопка «придумать» нужна ровно
        // тогда, когда планов ещё нет.
        rows.push(plan
            ? `<section class="mnema-ib-section mnema-ib-plan-section mnema-ib-reminder"><div class="mnema-ib-date-tile">${date ? `<b>${date.getDate()}</b><small>${escapeHtml(date.toLocaleDateString('ru-RU', { month: 'short' }))}</small>` : icon('calendar')}</div><div>${heading}<strong>${escapeHtml(plan.title)}</strong><small>${escapeHtml([date ? formatCalendarDate(date) : 'Дата не задана', plan.time].filter(Boolean).join(' · '))}</small>${plan.details ? `<p class="mnema-ib-note">${escapeHtml(plan.details)}</p>` : ''}</div></section>`
            : `<section class="mnema-ib-section mnema-ib-plan-section">${heading}<p class="mnema-ib-note">Планов пока нет</p></section>`);
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
    add('analyze', 'fa-wand-magic-sparkles', 'Проверить новое, иначе перечитать интервал');
    add('open', 'fa-sliders', 'Открыть Mnema');
    return buttons.join('');
}

export function buildInfoblock({ scene, state, settings, live, busy, peek = new Set() }) {
    if (live && state) scene = { ...scene, ...state.world, date: settings.trackCalendar ? state.calendar.currentDate : null };
    if (!scene) {
        scene = { ...(live ? state?.world : {}), date: live && settings.trackCalendar ? state?.calendar?.currentDate : null };
    }
    const date = dateFromIso(scene.date);
    const theme = infoblockTheme(settings.infoblockTheme);
    const head = themedInfoblockHeader(theme, { ...scene, location: scene.location || state?.world?.location }, date ? formatCalendarDate(date, true) : '') || `<div class="mnema-ib-head">
        <div class="mnema-ib-place">${icon('location')}<div><strong>${escapeHtml(scene.location || state?.world?.location || 'Место не указано')}</strong><small>${escapeHtml([scene.indoor === true ? 'внутри' : scene.indoor === false ? 'снаружи' : '', scene.weather, Number.isFinite(scene.temperature) ? `${scene.temperature}°` : ''].filter(Boolean).join(' · '))}</small></div></div>
        <div class="mnema-ib-time"><strong>${escapeHtml(scene.clock || '··:··')}</strong><small>${escapeHtml(date ? formatCalendarDate(date, true) : '')}</small></div>${live && state ? icon('chevronDown', 'mnema-ib-chevron') : ''}
    </div>`;
    if (!live || !state) return `<div class="mnema-ib" data-ib-theme="${theme}">${head}</div>`;
    return `<div class="mnema-ib mnema-ib-live${busy ? ' busy' : ''}" data-ib-theme="${theme}">
        <details class="mnema-ib-details" data-mnema-details="scene"><summary title="Раскрыть или свернуть состояние сцены">${head}</summary>
            <div class="mnema-ib-actions" role="group" aria-label="Действия Mnema">${busy ? '<span class="mnema-ib-working" role="status">Создаётся…</span>' : ''}${actions(settings, busy)}</div>
            <div class="mnema-ib-body">${statusRows(state, settings, peek)}</div>
        </details>
    </div>`;
}

// Переключение ступени в листалке — чистая работа с DOM: перерисовывать всю
// плашку ради смены видимой карточки незачем, да и нельзя — это сбросило бы
// выбор обратно на текущую ступень.
export function setTrailFocus(trail, step) {
    const size = Number(trail.dataset.trailSize) || 0;
    if (!size) return;
    const focus = Math.max(0, Math.min(size - 1, Number.isFinite(step) ? step : 0));
    trail.dataset.trailFocus = String(focus);
    trail.querySelectorAll('.mnema-ib-trail-card').forEach((card, index) => { card.hidden = index !== focus; });
    trail.querySelectorAll('[data-trail-dot]').forEach((dot, index) => {
        // Окно в три точки: сама выбранная и по одной соседке с каждой стороны.
        dot.hidden = Math.abs(index - focus) > 1;
        if (index === focus) dot.setAttribute('aria-current', 'step');
        else dot.removeAttribute('aria-current');
    });
    const edge = position => trail.querySelector(`[data-trail-edge="${position}"]`);
    if (edge('start')) edge('start').hidden = focus > 0;
    if (edge('end')) edge('end').hidden = focus < size - 1;
    trail.querySelectorAll('[data-trail-nav]').forEach(button => {
        button.disabled = Number(button.dataset.trailNav) < 0 ? focus === 0 : focus === size - 1;
    });
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
    // Пролистанная ступень — тоже состояние под курсором. Переносим её, но
    // только пока лестница той же длины: если ступень добавилась, прежний номер
    // указывал бы уже не на то, что человек открыл.
    const previous = existing?.querySelector('.mnema-ib-trail');
    const trail = block.querySelector('.mnema-ib-trail');
    if (previous && trail && previous.dataset.trailSize === trail.dataset.trailSize) {
        setTrailFocus(trail, Number(previous.dataset.trailFocus));
    }
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
