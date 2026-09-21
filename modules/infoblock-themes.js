import { escapeHtml } from './utils.js';

export const INFOBLOCK_THEMES = [
    { id: 'classic', name: 'Компактный', description: 'Привычная плашка · нейтральные тона' },
    { id: 'glass', name: 'Часы', description: 'Часы и дата · лёгкие карточки' },
    { id: 'frost', name: 'Стекло', description: 'Матовое стекло · прозрачная линза' },
    { id: 'journal', name: 'Дневник', description: 'Тёплая бумага · мини-дневник' },
    { id: 'terminal', name: 'Табло', description: 'Графит и янтарь · приборная панель' },
];

export const infoblockTheme = value => INFOBLOCK_THEMES.some(theme => theme.id === value) ? value : 'classic';

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
    if (theme === 'glass') return `<div class="mnema-ib-head mnema-ib-glass-head"><div class="mnema-ib-clock-face">${clock}</div><div class="mnema-ib-glass-meta"><span>${date}</span><small>${weather}</small></div><div class="mnema-ib-glass-place"><i class="fa-solid fa-location-dot" aria-hidden="true"></i><strong>${place}</strong></div></div>`;
    if (theme === 'frost') return `<div class="mnema-ib-head mnema-ib-frost-head"><div class="mnema-ib-frost-place"><i class="fa-solid fa-location-dot" aria-hidden="true"></i><strong>${place}</strong></div><div class="mnema-ib-clock-face">${clock}</div><div class="mnema-ib-frost-meta"><span>${date}</span><small>${weather}</small></div></div>`;
    if (theme === 'journal') return `<div class="mnema-ib-head mnema-ib-journal-head"><div class="mnema-ib-journal-dateline"><span>${date}</span><span>${clock}</span></div><div class="mnema-ib-journal-place">${place}</div><div class="mnema-ib-journal-footer"><small>${weather}</small></div></div>`;
    return `<div class="mnema-ib-head mnema-ib-terminal-head"><div class="mnema-ib-clock-face">${clock}<small>${date}</small></div><div class="mnema-ib-terminal-place"><strong>${place}</strong><small>${weather}</small></div></div>`;
}
