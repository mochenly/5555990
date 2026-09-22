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

const parseColor = value => {
    const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?)\s*)?\)$/i.exec(String(value || '').trim());
    if (!match) return null;
    const raw = match[4];
    const alpha = raw === undefined ? 1 : raw.endsWith('%') ? Number.parseFloat(raw) / 100 : Number(raw);
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: Number.isFinite(alpha) ? alpha : 1 };
};

const luminance = ({ r, g, b }) => {
    const channel = value => {
        const part = value / 255;
        return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

// Окно Мнемы должно быть сплошным: тема задаёт подложку как rgba, и её альфа
// гуляет от 1.0 до 0.09 — сквозь окно просвечивал чат, причём на каждой теме
// по-своему. Просто отбросить альфу нельзя: при 0.09 (а у Liquid Glass Hearts
// и вовсе при 0) каналы RGB подложки не значат ничего и дают то мутное какао
// под светлым текстом, то чёрную плиту посреди стеклянной темы. Поэтому
// полярность берём у цвета текста — он осмыслен в любой теме, — а подложку
// пускаем только на оттенок.
export function resolveSurfaceColor(styles) {
    const rgb = color => `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
    const tint = parseColor(styles.getPropertyValue('--SmartThemeBlurTintColor'));
    // Почти непрозрачная подложка и есть тот фон, который человек уже видит:
    // берём её как есть, сняв остаток прозрачности.
    if (tint && tint.a >= 0.85) return rgb(tint);
    const text = parseColor(styles.getPropertyValue('--SmartThemeBodyColor')) || { r: 238, g: 238, b: 238, a: 1 };
    const base = luminance(text) > 0.45 ? { r: 18, g: 17, b: 22 } : { r: 244, g: 241, b: 246 };
    // Оттенок темы подмешиваем скупо и только когда подложка вообще видима:
    // иначе окно выпадет из темы безымянно-серым прямоугольником.
    const hue = tint && tint.a >= 0.05 ? tint : null;
    return hue ? rgb({ r: base.r * 0.82 + hue.r * 0.18, g: base.g * 0.82 + hue.g * 0.18, b: base.b * 0.82 + hue.b * 0.18 }) : rgb(base);
}

export function clampPercent(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(Math.max(0, Math.min(100, number))) : fallback;
}
