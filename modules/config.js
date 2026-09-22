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
    // Здоровье и галерея выключены, пока их не включили: оба раздела заметно
    // утяжеляют и промпт анализа, и плашку, а нужны далеко не каждой истории.
    // Подпереключатели галереи остаются включёнными — тогда при включении
    // раздела он сразу работает целиком, а не требует второго захода.
    trackHealth: false,
    trackSecrets: true,
    secretLimits: Object.freeze({ user: 10, char: 10, world: 10 }),
    collectGallery: false,
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

// Язык ответа модель выбирает по тому, что видит вокруг, и промпты работают
// против неё: инструкции, ключи и примеры значений — английские, а язык
// интерфейса и язык истории у половины пользователей разные. Просьбы «пиши на
// языке пользователя» тут мало — «пользователя» модель ищет в том числе и в
// самом промпте. Поэтому источник называем поимённо (только сообщения истории)
// и отдельно снимаем право решать за неё с примеров и с уже записанных
// значений: в состояние подписи попадают и от самого расширения.
//
// Живёт здесь, рядом с isWorldPlan: правило нужно каждому сборщику промптов, а
// импортировать ради него сборщики друг из друга значит завести цикл.
export const LANGUAGE_RULE = 'Language of the answer: write every natural-language value — titles, names, summaries, notes, labels, descriptions — in the language of the supplied story messages, whatever language that is. '
    + 'Work it out from those messages alone. This instruction, the JSON keys and every example value are written in English as notation only and never indicate the output language; neither do values already present in the previous state, which may have been recorded by the extension itself rather than written in the story. '
    + 'A Russian story is answered in Russian, an English one in English, and any other language in that language. Never translate the story into English, and never mix two languages in one answer. Keep JSON keys and enum codes exactly as specified, in English.';

export const RELATIONSHIP_LADDER_LIMIT = 14;
export const RELATIONSHIP_RUNG_TITLE_LIMIT = 40;
export const RELATIONSHIP_RUNG_NOTE_LIMIT = 100;
