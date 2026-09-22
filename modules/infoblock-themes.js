import { escapeHtml } from './utils.js';
import { icon } from './icons.js';

export const INFOBLOCK_THEMES = [
    { id: 'classic', name: 'Компактный', description: 'Ярлык слева, значение справа · одна колонка' },
    { id: 'glass', name: 'Часы', description: 'Крупные цифры · берёт цвет вашей темы' },
    { id: 'frost', name: 'Стекло', description: 'Матовая линза · плитка в две колонки' },
    { id: 'journal', name: 'Дневник', description: 'Тёплая бумага · сплошной текст, всегда в столбец' },
    { id: 'terminal', name: 'Табло', description: 'Графит и янтарь · сетка данных до трёх колонок' },
];

// Запасной вариант держим тем же, что и в настройках по умолчанию: разойдись
// они — и человек, ни разу не открывавший выбор оформления, видел бы одну тему,
// а переключатель показывал бы другую.
export const infoblockTheme = value => INFOBLOCK_THEMES.some(theme => theme.id === value) ? value : 'glass';

export function infoblockThemesHtml() {
    return `<fieldset class="mnema-ib-theme-picker"><legend>Оформление инфоблока</legend><div class="mnema-ib-theme-options">${INFOBLOCK_THEMES.map(theme => `
        <label class="mnema-ib-theme-option"><input type="radio" name="mnema_infoblock_theme" value="${theme.id}">
            <span class="mnema-ib-theme-card"><span class="mnema-ib-theme-sample" data-theme="${theme.id}" aria-hidden="true"><b>11:30</b><i></i><i></i><i></i></span><strong>${theme.name}</strong><small>${theme.description}</small></span>
        </label>`).join('')}</div><p class="mnema-hint">Оформление меняется сразу во всём чате. Раскрытые разделы сохраняются.</p></fieldset>`;
}

export function themedInfoblockHeader(theme, scene, dateText) {
    if (theme === 'classic') return null;
    const clock = escapeHtml(scene.clock || '··:··');
    const place = escapeHtml(scene.location || 'Место не указано');
    const weather = escapeHtml([scene.indoor === true ? 'внутри' : scene.indoor === false ? 'снаружи' : '', scene.weather, Number.isFinite(scene.temperature) ? `${scene.temperature}°` : ''].filter(Boolean).join(' · '));
    const date = escapeHtml(dateText);
    // Часы и дата лежат в общей обёртке: иначе капсула локации, растянутая на
    // всю ширину, раздувает колонки грида и центрировать пару нечем.
    if (theme === 'glass') return `<div class="mnema-ib-head mnema-ib-glass-head"><div class="mnema-ib-glass-time"><div class="mnema-ib-clock-face">${clock}</div><div class="mnema-ib-glass-meta"><span>${date}</span><small>${weather}</small></div></div><div class="mnema-ib-glass-place">${icon('location')}<strong>${place}</strong></div></div>`;
    if (theme === 'frost') return `<div class="mnema-ib-head mnema-ib-frost-head"><div class="mnema-ib-frost-place">${icon('location')}<strong>${place}</strong></div><div class="mnema-ib-clock-face">${clock}</div><div class="mnema-ib-frost-meta"><span>${date}</span><small>${weather}</small></div></div>`;
    if (theme === 'journal') return `<div class="mnema-ib-head mnema-ib-journal-head"><div class="mnema-ib-journal-dateline"><span>${date}</span><span>${clock}</span></div><div class="mnema-ib-journal-place">${place}</div><div class="mnema-ib-journal-footer"><small>${weather}</small></div></div>`;
    return `<div class="mnema-ib-head mnema-ib-terminal-head"><div class="mnema-ib-clock-face">${clock}<small>${date}</small></div><div class="mnema-ib-terminal-place"><strong>${place}</strong><small>${weather}</small></div></div>`;
}
