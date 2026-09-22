export const EXTENSION_KEY = 'mnema';
export const MENU_BUTTON_ID = 'mnema_menu_button';
export const POPUP_ID = 'mnema_popup';
export const PROMPT_KEY = 'MNEMA_ARCS';
export const INFOBLOCK_PROMPT_KEY = 'MNEMA_INFOBLOCK';
export const STATE_KEY = 'mnema_meta';

export const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    interval: 5,
    // 0 — без предела: арку закрывает только сама модель, как и раньше.
    arcMaxMessages: 0,
    arcMaxTokens: 0,
    // Хвост, который остаётся видимым даже после закрытия арки: без него модель
    // на стыке теряет нить и начинает пересказывать сводку вместо сцены.
    arcVisibleBuffer: 0,
    // Больше нескольких отдельных сводок в контексте хуже одной общей, поэтому
    // при переполнении старые арки сливаются в большое саммари.
    arcLimit: 3,
    connectionMode: 'profile',
    profileId: '',
    apiUrl: '',
    apiKey: '',
    model: '',
    trackRelationships: true,
    trackCalendar: true,
    trackHealth: true,
    trackSecrets: true,
    secretLimits: Object.freeze({ user: 10, char: 10, world: 10 }),
    collectGallery: true,
    galleryMemoriesEnabled: true,
    galleryMemoryMode: 'auto',
    galleryKeepsakesEnabled: true,
    galleryKeepsakeMode: 'auto',
    galleryContext: 12,
    infoblock: false,
    infoblockTheme: 'glass',
});

export const RELATIONSHIP_METRICS = Object.freeze([
    ['trust', 'Доверие', 'fa-shield-heart'],
    ['passion', 'Страсть', 'fa-fire'],
    ['devotion', 'Преданность', 'fa-hand-holding-heart'],
    ['attachment', 'Привязанность', 'fa-link'],
]);

// Concrete status labels and brief entry conditions; no prescribed romantic destination.
// Запись календаря бывает двух родов, и путать их нельзя: личный план — это
// обязательство героев друг перед другом, событие мира случится и без них.
// Неизвестное считаем личным: так вело себя всё, что записано до разделения.
// Живёт здесь, а не в calendar.js: предикат нужен сборщику промптов, а тащить
// ради него в промпты весь календарь с его i18n и DOM незачем.
export const planKind = value => String(value || '').trim().toLowerCase() === 'world' ? 'world' : 'personal';
export const isWorldPlan = plan => planKind(plan?.kind) === 'world';

export const RELATIONSHIP_LADDER_LIMIT = 14;
export const RELATIONSHIP_RUNG_TITLE_LIMIT = 40;
export const RELATIONSHIP_RUNG_NOTE_LIMIT = 100;
