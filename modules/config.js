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

// Лестница отношений у каждой истории своя: общий список ступеней не подходит ни
// одному конкретному сюжету, поэтому её складывает разбор и хранит состояние
// чата. Свободная «стадия» описывает сегодняшний оттенок, ступень отвечает на
// один вопрос — где именно история сейчас, — а между двумя ступенями в любой
// момент может появиться третья, если сюжет её показал.
export const RELATIONSHIP_LADDER_LIMIT = 14;
export const RELATIONSHIP_RUNG_TITLE_LIMIT = 60;
export const RELATIONSHIP_RUNG_NOTE_LIMIT = 220;
