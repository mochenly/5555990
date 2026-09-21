import { escapeHtml, isNativeSystemMessage } from './utils.js';
import { isRussianUi, t } from './i18n.js';

const MONTHS = new Map([
    ['январь', 1], ['января', 1], ['янв', 1], ['january', 1], ['jan', 1],
    ['февраль', 2], ['февраля', 2], ['фев', 2], ['february', 2], ['feb', 2],
    ['март', 3], ['марта', 3], ['мар', 3], ['march', 3], ['mar', 3],
    ['апрель', 4], ['апреля', 4], ['апр', 4], ['april', 4], ['apr', 4],
    ['май', 5], ['мая', 5], ['may', 5],
    ['июнь', 6], ['июня', 6], ['июн', 6], ['june', 6], ['jun', 6],
    ['июль', 7], ['июля', 7], ['июл', 7], ['july', 7], ['jul', 7],
    ['август', 8], ['августа', 8], ['авг', 8], ['august', 8], ['aug', 8],
    ['сентябрь', 9], ['сентября', 9], ['сент', 9], ['сен', 9], ['september', 9], ['sep', 9], ['sept', 9],
    ['октябрь', 10], ['октября', 10], ['окт', 10], ['october', 10], ['oct', 10],
    ['ноябрь', 11], ['ноября', 11], ['нояб', 11], ['ноя', 11], ['november', 11], ['nov', 11],
    ['декабрь', 12], ['декабря', 12], ['дек', 12], ['december', 12], ['dec', 12],
]);
const MONTH_PATTERN = [...MONTHS.keys()].sort((a, b) => b.length - a.length).join('|');
const MONTH_LABELS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAY_LABELS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAY_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_LABELS = isRussianUi() ? WEEKDAY_LABELS_RU : WEEKDAY_LABELS_EN;
const WEEKDAYS = new Map([['понедельник', 1], ['пн', 1], ['monday', 1], ['mon', 1], ['вторник', 2], ['вт', 2], ['tuesday', 2], ['tue', 2], ['среда', 3], ['ср', 3], ['wednesday', 3], ['wed', 3], ['четверг', 4], ['чт', 4], ['thursday', 4], ['thu', 4], ['пятница', 5], ['пт', 5], ['friday', 5], ['fri', 5], ['суббота', 6], ['сб', 6], ['saturday', 6], ['sat', 6], ['воскресенье', 7], ['вс', 7], ['sunday', 7], ['sun', 7]]);


function dateFromParts(year, month, day) {
    const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
    return date;
}

function isoDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateFromIso(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    return match ? dateFromParts(match[1], match[2], match[3]) : null;
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function inferYear(month, day, anchor, preferFuture = false) {
    const base = anchor || new Date();
    const candidates = [-1, 0, 1].map(delta => dateFromParts(base.getFullYear() + delta, month, day)).filter(Boolean);
    if (preferFuture) return candidates.filter(date => date >= base).sort((a, b) => a - b)[0] || candidates.at(-1);
    return candidates.sort((a, b) => Math.abs(a - base) - Math.abs(b - base))[0];
}

function extractDateCandidates(text, anchor = null, { preferFuture = false } = {}) {
    const source = String(text || '');
    const candidates = [];
    const push = (match, year, month, day, explicitYear = true) => {
        const date = explicitYear ? dateFromParts(year, month, day) : inferYear(month, day, anchor, preferFuture);
        if (date) candidates.push({ date, index: match.index, raw: match[0].trim(), explicitYear });
    };
    for (const match of source.matchAll(/\b((?:1[6-9]|20|21)\d{2})[.\/-](0?[1-9]|1[0-2])[.\/-](0?[1-9]|[12]\d|3[01])\b/g)) push(match, match[1], match[2], match[3]);
    for (const match of source.matchAll(/\b(0?[1-9]|[12]\d|3[01])[.\/-](0?[1-9]|1[0-2])(?:[.\/-](\d{2}|(?:1[6-9]|20|21)\d{2}))?\b/g)) {
        const year = match[3] ? (match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])) : null;
        push(match, year, match[2], match[1], Boolean(year));
    }
    const dayMonth = new RegExp(`\\b(0?[1-9]|[12]\\d|3[01])(?:-?(?:го|е|ое|st|nd|rd|th))?\\s+(${MONTH_PATTERN})\\.?(?:\\s*,?\\s*((?:1[6-9]|20|21)\\d{2}))?`, 'giu');
    for (const match of source.matchAll(dayMonth)) push(match, match[3] || null, MONTHS.get(match[2].toLowerCase().replace(/\.$/, '')), match[1], Boolean(match[3]));
    const monthDay = new RegExp(`\\b(${MONTH_PATTERN})\\.?\\s+(0?[1-9]|[12]\\d|3[01])(?:st|nd|rd|th)?(?:\\s*,?\\s*((?:1[6-9]|20|21)\\d{2}))?`, 'giu');
    for (const match of source.matchAll(monthDay)) push(match, match[3] || null, MONTHS.get(match[1].toLowerCase().replace(/\.$/, '')), match[2], Boolean(match[3]));
    return candidates.sort((a, b) => a.index - b.index);
}

function parseCalendarDate(value, anchor, { preferFuture = true } = {}) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return null;
    if (anchor) {
        if (/\b(?:сегодня|today)\b/u.test(text)) return new Date(anchor);
        if (/\b(?:послезавтра|day after tomorrow)\b/u.test(text)) return addDays(anchor, 2);
        if (/\b(?:завтра|tomorrow)\b/u.test(text)) return addDays(anchor, 1);
        const weekdayPattern = [...WEEKDAYS.keys()].sort((a, b) => b.length - a.length).join('|');
        const weekdayMatch = new RegExp(`\\b(${weekdayPattern})\\b`, 'iu').exec(text);
        if (weekdayMatch) {
            const target = WEEKDAYS.get(weekdayMatch[1].toLowerCase());
            const current = anchor.getDay() || 7;
            let delta = (target - current + 7) % 7;
            if (delta === 0 && preferFuture) delta = 7;
            return addDays(anchor, delta);
        }
        const dayOnly = /\b(0?[1-9]|[12]\d|3[01])(?:-?(?:го|е|ое))\b/u.exec(text);
        if (dayOnly) return inferYear(anchor.getMonth() + 1, Number(dayOnly[1]), anchor, preferFuture);
    }
    return extractDateCandidates(text, anchor, { preferFuture })[0]?.date || null;
}

function detectStoryDate(chat, previousDate = null) {
    const anchor = dateFromIso(previousDate);
    let best = null;
    for (let messageIndex = 0; messageIndex < chat.length; messageIndex++) {
        const message = chat[messageIndex];
        // Скрытые сообщения дату всё ещё задают: их спрятали из промпта, но из
        // истории они никуда не делись. Пропускаем только системные.
        if (!message?.mes || message.extra?.mnema_arc_id || isNativeSystemMessage(message)) continue;
        const text = String(message.mes);
        for (const candidate of extractDateCandidates(text, anchor)) {
            const nearby = text.slice(Math.max(0, candidate.index - 55), candidate.index + candidate.raw.length + 55).toLowerCase();
            const currentMarker = /(?:сегодня|текущ(?:ая|ую|ей)\s+дат|дата\s*[:—-]|на дворе|настал[оиа]?|утро|вечер|ночь|today|current date|date\s*[:—-])/iu.test(nearby);
            const futureMarker = /(?:день рожд|родил[асься]|план|встреч|заплан|дедлайн|через|завтра|следующ|birthday|meeting|deadline|next)/iu.test(nearby);
            const score = (currentMarker ? 300000 : futureMarker ? 0 : 100000) + (candidate.explicitYear ? 10000 : 0) + messageIndex;
            if (!best || score > best.score) best = { ...candidate, messageIndex, score };
        }
    }
    return best;
}

export function syncCalendarDate(chat, state) {
    const detected = detectStoryDate(chat, state.calendar.currentDate);
    if (!detected) return false;
    if (Number.isInteger(state.calendar.sourceMessageIndex) && detected.messageIndex < state.calendar.sourceMessageIndex) return false;
    const nextDate = isoDate(detected.date);
    if (nextDate === state.calendar.currentDate && detected.messageIndex === state.calendar.sourceMessageIndex) return false;
    state.calendar.currentDate = nextDate;
    state.calendar.sourceMessageIndex = detected.messageIndex;
    state.calendar.viewOffsetWeeks = 0;
    return true;
}

export function applyCalendarUpdates(state, updates, enabled = true, messageIndex = null, { tieWins = true } = {}) {
    if (!enabled || !updates || typeof updates !== 'object') return;
    const currentDate = dateFromIso(updates.current_date ?? updates.currentDate);
    const recorded = state.calendar.sourceMessageIndex;
    const fresher = !state.calendar.currentDate || (Number.isInteger(messageIndex) && (!Number.isInteger(recorded) || (tieWins ? messageIndex >= recorded : messageIndex > recorded)));
    if (currentDate && fresher) {
        state.calendar.currentDate = isoDate(currentDate);
        state.calendar.sourceMessageIndex = messageIndex;
        state.calendar.viewOffsetWeeks = 0;
    }
    const anchor = dateFromIso(state.calendar.currentDate);
    for (const item of Array.isArray(updates.birthdays) ? updates.birthdays : []) {
        const person = String(item?.person || item?.name || '').trim();
        const previous = state.calendar.birthdays.find(entry => String(entry.person || '').toLowerCase() === person.toLowerCase());
        const birthdayText = String(item?.date || previous?.monthDay || '');
        const monthDay = /^(\d{2})-(\d{2})$/.exec(birthdayText);
        const date = monthDay ? dateFromParts(2000, monthDay[1], monthDay[2]) : parseCalendarDate(birthdayText, anchor, { preferFuture: false });
        if (!person || !date) continue;
        const birthday = { id: item.id || `birthday_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, person, monthDay: `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, note: String(item.note || previous?.note || '').trim() };
        const existing = state.calendar.birthdays.findIndex(entry => String(entry.person || '').toLowerCase() === person.toLowerCase());
        if (existing >= 0) state.calendar.birthdays[existing] = { ...state.calendar.birthdays[existing], ...birthday, id: state.calendar.birthdays[existing].id };
        else state.calendar.birthdays.push(birthday);
    }
    for (const item of Array.isArray(updates.plans) ? updates.plans : []) {
        const title = String(item?.title || item?.plan || '').trim();
        if (!title) continue;
        if (['cancelled', 'completed'].includes(String(item.status || '').toLowerCase())) {
            state.calendar.plans = state.calendar.plans.filter(plan => plan.title.toLowerCase() !== title.toLowerCase());
            continue;
        }
        const existing = state.calendar.plans.findIndex(entry => entry.title.toLowerCase() === title.toLowerCase());
        const previous = existing >= 0 ? state.calendar.plans[existing] : {};
        const date = item.date ? parseCalendarDate(item.date, anchor, { preferFuture: true }) : null;
        const plan = { id: item.id || `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, title, date: isoDate(date) || previous.date || null, time: String(item.time || previous.time || '').trim(), details: String(item.details || item.note || previous.details || '').trim() };
        if (existing >= 0) state.calendar.plans[existing] = { ...state.calendar.plans[existing], ...plan, id: state.calendar.plans[existing].id };
        else state.calendar.plans.push(plan);
    }
}


function startOfWeek(date) {
    const day = date.getDay() || 7;
    return addDays(date, 1 - day);
}

const MONTH_LABELS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatCalendarDate(date, withYear = false) {
    if (!date) return t('Без даты');
    const year = withYear ? ` ${date.getFullYear()}` : '';
    // Порядок частей у языков разный, поэтому дату собираем, а не переводим.
    return isRussianUi()
        ? `${date.getDate()} ${MONTH_LABELS[date.getMonth()]}${year}`
        : `${MONTH_LABELS_EN[date.getMonth()]} ${date.getDate()}${year}`;
}

function nextBirthdayDate(birthday, anchor) {
    const match = /^(\d{2})-(\d{2})$/.exec(String(birthday?.monthDay || ''));
    if (!match) return null;
    return inferYear(Number(match[1]), Number(match[2]), anchor, true);
}

export function renderCalendar(state) {
    const calendar = state?.calendar || { birthdays: [], plans: [], viewOffsetWeeks: 0 };
    const anchor = dateFromIso(calendar.currentDate);
    const birthdays = [...(calendar.birthdays || [])];
    const upcomingPlans = (calendar.plans || []).filter(plan => {
        const date = dateFromIso(plan.date);
        return !anchor || !date || date >= anchor;
    }).sort((a, b) => (dateFromIso(a.date)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (dateFromIso(b.date)?.getTime() ?? Number.MAX_SAFE_INTEGER));

    $('#mnema_calendar_badge').text(upcomingPlans.length).prop('hidden', upcomingPlans.length === 0);
    $('#mnema_birthday_count').text(birthdays.length);
    $('#mnema_plan_count').text(upcomingPlans.length);
    $('#mnema_calendar_anchor').text(anchor
        ? t('Сюжетная дата · сообщение #{n}', { n: calendar.sourceMessageIndex })
        : t('Ищу дату в диалоге'));

    if (anchor) {
        const weekStart = addDays(startOfWeek(anchor), (calendar.viewOffsetWeeks || 0) * 7);
        const weekEnd = addDays(weekStart, 6);
        const title = weekStart.getMonth() === weekEnd.getMonth()
            ? (isRussianUi()
                ? `${weekStart.getDate()} — ${weekEnd.getDate()} ${MONTH_LABELS[weekEnd.getMonth()]} · ${weekEnd.getFullYear()}`
                : `${MONTH_LABELS_EN[weekEnd.getMonth()]} ${weekStart.getDate()} — ${weekEnd.getDate()} · ${weekEnd.getFullYear()}`)
            : `${formatCalendarDate(weekStart)} — ${formatCalendarDate(weekEnd)} · ${weekEnd.getFullYear()}`;
        $('#mnema_calendar_week_title').text(title);
        const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
        $('#mnema_calendar_week').html(days.map((date, index) => {
            const iso = isoDate(date);
            const plans = upcomingPlans.filter(plan => plan.date === iso);
            const dayBirthdays = birthdays.filter(birthday => {
                const next = nextBirthdayDate(birthday, date);
                return next && next.getMonth() === date.getMonth() && next.getDate() === date.getDate();
            });
            const events = [...dayBirthdays.map(item => ({ type: 'birthday', title: item.person })), ...plans.map(item => ({ type: 'plan', title: item.title }))];
            const today = iso === calendar.currentDate;
            return `<div class="mnema-calendar-day ${today ? 'today' : ''} ${events.length ? 'has-events' : ''}" title="${escapeHtml(events.map(event => event.title).join(' · '))}">
                <small>${WEEKDAY_LABELS[index]}</small><strong>${date.getDate()}</strong>
                <div class="mnema-calendar-dots">${events.slice(0, 3).map(event => `<i class="${event.type}"></i>`).join('')}</div>
                <span>${events[0] ? escapeHtml(events[0].title) : ''}</span>
            </div>`;
        }).join(''));
    } else {
        $('#mnema_calendar_week_title').text('Дата не определена');
        $('#mnema_calendar_week').html(WEEKDAY_LABELS.map(label => `<div class="mnema-calendar-day unknown"><small>${label}</small><strong>—</strong><div class="mnema-calendar-dots"></div><span></span></div>`).join(''));
    }

    const sortedBirthdays = birthdays.map(item => ({ item, next: nextBirthdayDate(item, anchor || new Date()) })).filter(entry => entry.next).sort((a, b) => a.next - b.next);
    $('#mnema_birthdays').html(sortedBirthdays.length ? sortedBirthdays.map(({ item, next }) => {
        const daysAway = anchor ? Math.round((next - anchor) / 86400000) : null;
        return `<article class="mnema-birthday-item"><span class="mnema-calendar-item-icon"><i class="fa-solid fa-cake-candles"></i></span><div><strong>${escapeHtml(item.person)}</strong>${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}</div><time>${formatCalendarDate(next)}</time>${daysAway !== null && daysAway <= 30 ? '<em>скоро</em>' : ''}</article>`;
    }).join('') : '<div class="mnema-calendar-empty">Дни рождения пока не найдены.</div>');

    $('#mnema_plans').html(upcomingPlans.length ? upcomingPlans.slice(0, 10).map(plan => {
        const date = dateFromIso(plan.date);
        return `<article class="mnema-plan-item"><span class="mnema-plan-bar"></span><div><strong>${escapeHtml(plan.title)}</strong>${plan.details || plan.time ? `<small>${escapeHtml([plan.time, plan.details].filter(Boolean).join(' · '))}</small>` : ''}</div><time>${formatCalendarDate(date, date?.getFullYear() !== anchor?.getFullYear())}</time></article>`;
    }).join('') : '<div class="mnema-calendar-empty">Ближайших планов пока нет.</div>');
}
