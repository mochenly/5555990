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
// Ни одного языка правило не называет, хотя раньше называло два для примера.
// Больше в промптах расширения нет ни слова не по-английски, так что этот
// пример был единственным упоминанием другого языка во всём запросе — и в
// английской истории модель временами уходила отвечать именно на нём.
//
// Живёт здесь, рядом с isWorldPlan: правило нужно каждому сборщику промптов, а
// импортировать ради него сборщики друг из друга значит завести цикл.
export const LANGUAGE_RULE = 'Language of the answer: write every natural-language value — titles, names, summaries, notes, labels, descriptions — in the language of the supplied story messages, whatever language that is. '
    + 'Work it out from those messages alone. This instruction, the JSON keys and every example value are written in English as notation only and never indicate the output language; neither do values already present in the previous state, which may have been recorded by the extension itself rather than written in the story. '
    + 'Whatever language the story is written in, the answer is written in that same one. Do not translate the story into another language, do not mix two languages in one answer, and do not switch language because a single line, a quoted phrase or a character name differs from the rest of the story. Keep JSON keys and enum codes exactly as specified, in English.';

// Просить модель «определи язык истории сама» — значит отдавать ей решение,
// которое расширение принимает надёжнее: текст истории у нас на руках, считать
// его буквы дёшево, и никакая карточка персонажа на счёт не влияет. Модель же
// в этом месте путает язык истории с языком героя, и русская по паспорту
// девушка в английском отыгрыше уводит на русский весь раздел.
//
// Определяем только то, что действительно различимо: кириллица — русский,
// латиница с английскими служебными словами — английский. Латиница без них
// может оказаться любым из десятка языков, и называть её английским хуже, чем
// не называть никак: тогда остаётся общее правило.
const ENGLISH_MARKERS = /\b(?:the|and|of|to|in|that|was|with|he|she|her|his|they|for|not|but|had|you|it|from|were|would)\b/gi;
const LANGUAGE_SAMPLE_LIMIT = 20000;
const LANGUAGE_MIN_LETTERS = 200;

export function storyLanguage(source) {
    const sample = (Array.isArray(source) ? source : [source])
        .map(item => typeof item === 'string' ? item : String(item?.text ?? item?.mes ?? item?.summary ?? ''))
        .join('\n')
        .slice(0, LANGUAGE_SAMPLE_LIMIT);
    const cyrillic = (sample.match(/\p{Script=Cyrillic}/gu) || []).length;
    const latin = (sample.match(/\p{Script=Latin}/gu) || []).length;
    // Пара реплик — ещё не язык истории: на таком объёме приветствие на одном
    // языке перевесит всё остальное.
    if (cyrillic + latin < LANGUAGE_MIN_LETTERS) return '';
    if (cyrillic > latin) return 'Russian';
    const words = sample.split(/[^\p{L}']+/u).filter(Boolean).length;
    const markers = (sample.match(ENGLISH_MARKERS) || []).length;
    return words >= 40 && markers / words >= 0.08 ? 'English' : '';
}

// Язык назван прямо — и сразу перечислено всё, что его не решает: иначе модель
// находит «она русская» в карточке и считает это указанием.
export function languageRule(source) {
    const language = storyLanguage(source);
    if (!language) return LANGUAGE_RULE;
    return `Language of the answer: write every natural-language value — titles, names, summaries, notes, labels, descriptions — in ${language}. `
        + `The supplied story is written in ${language}, and that is the only thing deciding this. What language a character is said to speak, their nationality or origin, a line of dialogue quoted in another language, the language of these instructions, and any value already recorded in the previous state decide nothing here. `
        + `Answer in ${language} even where the story quotes another language, and never mix two languages in one answer. Keep JSON keys and enum codes exactly as specified, in English.`;
}

export const RELATIONSHIP_LADDER_LIMIT = 14;
export const RELATIONSHIP_RUNG_TITLE_LIMIT = 40;
export const RELATIONSHIP_RUNG_NOTE_LIMIT = 100;
