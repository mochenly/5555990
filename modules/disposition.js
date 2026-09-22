import { RELATIONSHIP_METRICS } from './config.js';
import { t } from './i18n.js';

// Во что шкалы отношений складываются в поведении — одной общей строкой, а не
// разбором по каждой. Разбор давал четыре отдельных утверждения, которые никто
// не сводил воедино: человек в окне читал спецификацию, а модель получала
// таблицу вместо характера. Персонаж в сцене ведёт себя одним образом, и
// описание у него должно быть одно.
//
// Само число не годится ни там, ни там. Модель, увидев «доверие 62», либо
// проговаривает его вслух, либо игнорирует, но вести себя на 62 доверия не
// начинает; человек, увидев «62%», не знает, много это или мало и что от этого
// изменится в ответе.
//
// Английский текст уходит в промпт, русский показывается в окне. Лежат они
// рядом намеренно: разъедься они по разным файлам — и окно начало бы обещать
// поведение, которого модель никогда не просили, причём незаметно, потому что
// каждый текст поодиночке выглядит правдоподобно.

const CHAR = '{{char}}';
const USER = '{{user}}';

// Общая манера держаться. Считается по всем оценённым шкалам сразу: близость —
// это не отдельно доверие и отдельно тяга, а то, что из них вместе выходит.
const PROMPT_STANCE = [
    `keeps ${USER} at arm's length: says little about themselves, checks what they are told, and helps only where it costs nothing`,
    `is steady with ${USER} but not close: shares facts rather than reasons, shows up when asked, and stops well short of rearranging anything for them`,
    `is close to ${USER}: speaks plainly about their own affairs, seeks their company, holds a look a beat too long, and puts what they need ahead of mere convenience`,
    `lives with ${USER} inside their guard: hides nothing that matters, acts on their word without checking it, takes real losses for them without weighing them, and feels their absence as a weight`,
];

const UI_STANCE = [
    'Держит {user} на расстоянии: о себе говорит скупо, сказанное проверяет и помогает там, где это ничего не стоит',
    'Держится с {user} ровно, но без сближения: делится фактами, а не причинами, приходит, когда просят, и свою жизнь ни под что не перестраивает',
    'Держится с {user} близко: говорит о своём прямо, ищет общества, задерживает взгляд и ставит чужую нужду выше собственного удобства',
    'Пускает {user} за все свои границы: не скрывает ничего важного, верит на слово, идёт на настоящие потери не раздумывая и тяжело переносит разлуку',
];

// Одна шкала, ушедшая далеко от остальных, и есть то, что отличает этого
// персонажа от любого другого с той же общей близостью: тяга без доверия и
// доверие без тяги ведут себя очень по-разному.
const STANDOUT_GAP = 18;

const PROMPT_MOVE = { 1: 'lately it has been rising', '-1': 'lately it has been slipping' };
const UI_MOVE = { 1: 'в последнее время это растёт', '-1': 'в последнее время это идёт на убыль' };

export const dispositionBand = value => value >= 75 ? 3 : value >= 50 ? 2 : value >= 25 ? 1 : 0;

const metricKeys = () => RELATIONSHIP_METRICS.map(([key]) => key);
const metricLabel = key => RELATIONSHIP_METRICS.find(([metric]) => metric === key)?.[1] || key;

// Ноль — «ещё не оценено», а не «нет доверия»: пустые шкалы не должны ни
// отыгрываться как холод между героями, ни объявлять об этом в окне.
function reading(relationship, trends = {}) {
    const scored = metricKeys()
        .map(key => ({ key, value: Number(relationship?.[key]) || 0 }))
        .filter(item => item.value > 0);
    if (!scored.length) return null;
    const average = scored.reduce((sum, item) => sum + item.value, 0) / scored.length;
    const sorted = [...scored].sort((a, b) => b.value - a.value);
    const top = sorted[0];
    const bottom = sorted.at(-1);
    // Направление берём у общей близости: у каждой шкалы оно своё, и перечислять
    // их по отдельности значит снова вернуться к разбору по статам.
    const drift = Math.sign(scored.reduce((sum, item) => sum + (Math.sign(Number(trends?.[item.key]) || 0)), 0));
    return {
        band: dispositionBand(average),
        high: sorted.length > 1 && top.value - average >= STANDOUT_GAP ? top.key : null,
        low: sorted.length > 1 && average - bottom.value >= STANDOUT_GAP ? bottom.key : null,
        drift,
    };
}

export function promptDisposition(relationship, trends = {}) {
    const read = reading(relationship, trends);
    if (!read) return '';
    const standout = [
        read.high ? `${read.high} runs ahead of the rest` : '',
        read.low ? `${read.low} lags behind it` : '',
    ].filter(Boolean).join(', and ');
    const move = PROMPT_MOVE[String(read.drift)] || '';
    return [`${CHAR} ${PROMPT_STANCE[read.band]}`, standout, move].filter(Boolean).join('; ') + '.';
}

export function uiDisposition(relationship, names = {}) {
    const read = reading(relationship, relationship?.trends);
    if (!read) return '';
    const vars = { char: names.char || '{{char}}', user: names.user || '{{user}}' };
    const standout = [
        read.high ? t('сильнее прочего — {metric}', { metric: t(metricLabel(read.high)).toLowerCase() }) : '',
        read.low ? t('слабее прочего — {metric}', { metric: t(metricLabel(read.low)).toLowerCase() }) : '',
    ].filter(Boolean).join(', ');
    const move = UI_MOVE[String(read.drift)] ? t(UI_MOVE[String(read.drift)]) : '';
    return [t(UI_STANCE[read.band], vars), standout, move].filter(Boolean).join('; ') + '.';
}
