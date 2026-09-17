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
    connectionMode: 'profile',
    profileId: '',
    apiUrl: '',
    apiKey: '',
    model: '',
    temperature: 0.25,
    trackRelationships: true,
    trackCalendar: true,
    trackHealth: true,
    trackSecrets: true,
    collectGallery: true,
    galleryMemoriesEnabled: true,
    galleryMemoryMode: 'auto',
    galleryKeepsakesEnabled: true,
    galleryKeepsakeMode: 'auto',
    galleryContext: 12,
    infoblock: false,
});

export const RELATIONSHIP_METRICS = Object.freeze([
    ['trust', 'Доверие', 'fa-shield-heart'],
    ['passion', 'Страсть', 'fa-fire'],
    ['devotion', 'Преданность', 'fa-hand-holding-heart'],
    ['attachment', 'Привязанность', 'fa-link'],
]);
