import { t } from './i18n.js';

export function escapeHtml(value) {
    const node = document.createElement('span');
    node.textContent = String(value ?? '');
    return node.innerHTML;
}

// Перевод здесь, а не на каждом вызове: через notify проходят и свои
// сообщения, и текст ошибок, которые тоже лежат в словаре. Уже переведённая
// строка ключом не является и возвращается как есть.
export function notify(message, type = 'info') {
    const text = t(String(message ?? ''));
    const toast = globalThis.toastr?.[type] || globalThis.toastr?.info;
    if (toast) toast(text, 'Mnema');
    else console[type === 'error' ? 'error' : 'log'](`[Mnema] ${text}`);
}

// SillyTavern держит скрытое и системное в одном поле is_system, поэтому своего
// флага мы не заводим: у настоящих системных сообщений есть extra.type, у
// спрятанных командой — нет. Так нативный /hide и наш дают одно и то же.
export function isNativeSystemMessage(message) {
    return Boolean(message?.is_system) && (Boolean(message?.extra?.type) || message?.extra?.isSmallSys === true);
}

export function isHiddenMessage(message) {
    return Boolean(message?.is_system) && !isNativeSystemMessage(message);
}

export function contiguousRanges(indices) {
    const ranges = [];
    for (const index of [...new Set(indices)].sort((a, b) => a - b)) {
        const last = ranges.at(-1);
        if (last && index === last[1] + 1) last[1] = index;
        else ranges.push([index, index]);
    }
    return ranges;
}

export function clampPercent(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(Math.max(0, Math.min(100, number))) : fallback;
}
