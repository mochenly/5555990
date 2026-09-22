import { textLanguage, tLang } from './i18n.js';

// Текст сообщения-конспекта собирается в трёх местах: при создании арки, при
// её пересборке по кнопке и при ручной правке в редакторе. Пока сборка была
// расписана по местам, правка арки молча теряла перечень, которого не знала.
export const RECAP_KEYS = ['events', 'details', 'npcs', 'threads'];

export const RECAP_LABELS = {
    events: 'События',
    details: 'Важные детали',
    npcs: 'Кто ещё участвовал',
    threads: 'Осталось открытым',
};

// Промпт просит модель уложиться в это число строк на поле, но просьбу она
// иногда игнорирует — тогда recap разрастается в тот же построчный пересказ,
// от которого мы его отделяли. Лимиты здесь режут по живому вне зависимости
// от того, что вернул ответ.
const RECAP_LIMITS = { events: 4, details: 5, npcs: 4, threads: 3 };

// Перечень приводим к одному виду независимо от того, что вернула модель:
// строка вместо списка, объекты вместо строк, пустые хвосты — всё это обычные
// ответы, и разбираться с ними в момент отрисовки поздно.
export function normalizeRecap(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const recap = {};
    for (const key of RECAP_KEYS) {
        const raw = Array.isArray(source[key]) ? source[key] : source[key] ? [source[key]] : [];
        const lines = raw
            // null и undefined отсеиваем до String(): иначе строка "null" прошла
            // бы дальше как полноценная запись перечня.
            .filter(item => item !== null && item !== undefined)
            .map(item => String(typeof item === 'object' ? (item.text ?? item.title ?? item.name ?? '') : item).trim())
            .filter(Boolean)
            .slice(0, RECAP_LIMITS[key]);
        if (lines.length) recap[key] = lines;
    }
    return recap;
}

// Модель отвечает номерами, но нередко возвращает и сам текст линии. Принимаем
// оба вида и отдаём номера позиций — по ним вызывающий найдёт, из какой арки
// строку вырезать.
export function resolvedThreadIndices(value, openThreads) {
    const raw = Array.isArray(value) ? value : value ? [value] : [];
    const normalized = openThreads.map(text => String(text).trim().toLowerCase());
    const found = new Set();
    for (const item of raw) {
        if (item === null || item === undefined) continue;
        const number = Number(item);
        if (Number.isInteger(number) && number >= 1 && number <= openThreads.length) { found.add(number - 1); continue; }
        const position = normalized.indexOf(String(typeof item === 'object' ? (item.text ?? item.title ?? '') : item).trim().toLowerCase());
        if (position >= 0) found.add(position);
    }
    return [...found];
}

// Язык подписей здесь — язык самой сводки, а не интерфейса: этот текст стоит
// в чате наравне с сообщениями и уходит в промпт обеими сторонами. Английская
// шапка над русским конспектом (или наоборот) — ровно тот сор, из-за которого
// модель начинает отвечать не на том языке, на котором идёт история.
export function arcLanguage(arc) {
    return textLanguage(`${arc?.summary || ''} ${arc?.title || ''}`);
}

export function recapMarkdown(recap, language = 'ru') {
    return RECAP_KEYS.filter(key => recap?.[key]?.length)
        .map(key => `**${tLang(language, RECAP_LABELS[key])}**\n${recap[key].map(line => `- ${line}`).join('\n')}`)
        .join('\n\n');
}

// Перечень уходит в то же сообщение, что и сводка: отдельной записью он потерял
// бы место в хронологии, а в промпт основной модели попадает ровно так же.
export function arcMessageText(arc) {
    const language = arcLanguage(arc);
    return [
        `### ${tLang(language, 'Конспект арки: {title}', { title: arc.title })}`,
        arc.summary,
        recapMarkdown(arc.recap, language),
    ].filter(Boolean).join('\n\n');
}
