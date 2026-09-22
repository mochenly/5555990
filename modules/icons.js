// Тонкие контурные иконки для плашки. Font Awesome рисует сплошные глифы с
// жирными засечками — рядом с волосяными линейками и лёгким начертанием темы
// «Часы» они выглядят кляксами. Здесь один общий контур в 1.4px и currentColor,
// поэтому иконка наследует цвет и прозрачность места, куда вставлена.
//
// Кнопки действий намеренно оставлены на Font Awesome: там глиф — мишень для
// нажатия, и заливка ему на пользу.
const STROKE = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"';

const PATHS = {
    location: '<path d="M12 21c4.2-4 6.5-7.2 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 13.8 7.8 17 12 21Z"/><circle cx="12" cy="10.3" r="2.4"/>',
    chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
    chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
    chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
    shirt: '<path d="M8.6 3 4 5.6l1.7 3.5L7.3 8.2V21h9.4V8.2l1.6.9L20 5.6 15.4 3a3.5 3.5 0 0 1-6.8 0Z"/>',
    pulse: '<path d="M3 12.5h3.8l2-5.5 3.4 11 2.2-5.5H21"/>',
    bell: '<path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 3.8 1.4 5.2 1.4 5.2H5.1s1.4-1.4 1.4-5.2Z"/><path d="M10.2 18.2a2 2 0 0 0 3.6 0"/>',
    key: '<circle cx="16" cy="8" r="3.6"/><path d="M13.4 10.6 4 20v-2.6h2.6v-2.6h2.6v-2.2"/>',
    user: '<circle cx="12" cy="8.2" r="3.4"/><path d="M5.2 20a6.8 6.8 0 0 1 13.6 0"/>',
    mask: '<path d="M3.2 8.4C3.2 7.2 7.5 6 12 6s8.8 1.2 8.8 2.4c0 5.8-3.9 9.6-8.8 9.6S3.2 14.2 3.2 8.4Z"/><path d="M7.8 10.4h2.6M13.6 10.4h2.6"/>',
    globe: '<circle cx="12" cy="12" r="8.8"/><path d="M3.2 12h17.6"/><path d="M12 3.2a13.5 13.5 0 0 1 0 17.6 13.5 13.5 0 0 1 0-17.6Z"/>',
    heart: '<path d="M12 20.2c-4.6-3-7-6-7-9.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7 3.4c0 3.2-2.4 6.2-7 9.2Z"/>',
    arrowRight: '<path d="M4 12h15"/><path d="m14.2 7.2 4.8 4.8-4.8 4.8"/>',
    faceSmile: '<circle cx="12" cy="12" r="8.8"/><path d="M8.4 14.2a4.4 4.4 0 0 0 7.2 0"/><path d="M9.3 9.6h.01M14.7 9.6h.01"/>',
    faceMeh: '<circle cx="12" cy="12" r="8.8"/><path d="M8.8 14.8h6.4"/><path d="M9.3 9.6h.01M14.7 9.6h.01"/>',
    faceFrown: '<circle cx="12" cy="12" r="8.8"/><path d="M8.4 15.6a4.4 4.4 0 0 1 7.2 0"/><path d="M9.3 9.6h.01M14.7 9.6h.01"/>',
    injury: '<rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)"/><path d="M10.4 10.4h.01M13.6 10.4h.01M10.4 13.6h.01M13.6 13.6h.01"/>',
    lock: '<rect x="4.6" y="10.4" width="14.8" height="9.6" rx="2.2"/><path d="M8 10.4V7.8a4 4 0 0 1 8 0v2.6"/>',
    lockOpen: '<rect x="4.6" y="10.4" width="14.8" height="9.6" rx="2.2"/><path d="M8 10.4V7.8a4 4 0 0 1 7.6-1.7"/>',
    eye: '<path d="M2.5 12S6.3 6.2 12 6.2 21.5 12 21.5 12 17.7 17.8 12 17.8 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeSlash: '<path d="M4.2 8.3C2.9 9.7 2.5 12 2.5 12s3.8 5.8 9.5 5.8c1.4 0 2.7-.3 3.8-.9M9.4 6.6c.8-.3 1.7-.4 2.6-.4 5.7 0 9.5 5.8 9.5 5.8s-1 1.6-2.8 3.1"/><path d="M9.9 9.9a2.8 2.8 0 0 0 4 4"/><path d="m3.5 3.5 17 17"/>',
    calendar: '<rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2.4"/><path d="M3.4 10.2h17.2M8.2 3v4M15.8 3v4"/>',
};

// Тревога — единственная заливка в наборе: восклицательный знак вырезан из
// круга по evenodd, чтобы значок читался как сплошное пятно, а не как ещё один
// контур среди контуров.
const FILLED = {
    alert: '<svg class="mnema-ib-ico" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" aria-hidden="true"><path d="M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4ZM11 6.9h2v7.2h-2V6.9Zm0 8.9h2v2.1h-2v-2.1Z"/></svg>',
};

export function icon(name, extraClass = '') {
    const className = ['mnema-ib-ico', extraClass].filter(Boolean).join(' ');
    if (FILLED[name]) return FILLED[name].replace('class="mnema-ib-ico"', `class="${className}"`);
    const body = PATHS[name];
    if (!body) return '';
    return `<svg class="${className}" ${STROKE} aria-hidden="true">${body}</svg>`;
}
