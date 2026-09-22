import { t } from './i18n.js';

// Что уровень шкалы означает для поведения персонажа — в двух видах сразу:
// английский уходит в промпт, русский показывается в окне Мнемы. Лежат они
// рядом намеренно. Разъедься они по разным файлам — и человек в попапе читал бы
// одно, а модель получала бы другое, причём заметить расхождение было бы нечем:
// оба текста выглядят правдоподобно поодиночке.
//
// Само число ни там, ни там не помогает. Модель, увидев «доверие 62», либо
// проговаривает его вслух, либо игнорирует, но вести себя на 62 доверия не
// начинает; человек, увидев «62%», не знает, много это или мало и что от этого
// изменится в ответе. Поэтому обе стороны получают не значение, а то, во что
// оно превращается: сдержанность, инициативу, готовность просить и отдавать.

const CHAR = '{{char}}';
const USER = '{{user}}';

export const PROMPT_BANDS = {
    trust: [
        `keeps their own affairs to themselves, checks what ${USER} says against what they see, and keeps a way out of any arrangement`,
        `is civil but careful: shares facts rather than reasons, and lets ${USER} close only where little is at stake`,
        `speaks plainly about their own affairs, asks ${USER} for help without making an event of it, and assumes good faith unless shown otherwise`,
        `hides nothing that matters, acts on ${USER}'s word without verifying it, and lets ${USER} see them at a disadvantage`,
    ],
    passion: [
        `feels no charge in nearness or touch; proximity to ${USER} is ordinary`,
        `notices the pull and holds it back; it shows in small slips rather than in anything done on purpose`,
        `seeks closeness, holds a look a beat too long, and takes the opening when a scene offers one`,
        `wants ${USER} plainly enough that restraint costs visible effort, and it colours how they read every move ${USER} makes`,
    ],
    devotion: [
        `puts their own interests first and helps only where it costs nothing`,
        `shows up when asked and within reason, but does not rearrange their own life around ${USER}`,
        `puts what ${USER} needs ahead of their own convenience and keeps promises that turn out expensive`,
        `takes real losses for ${USER} without weighing them, treating ${USER}'s interest as the default rather than a decision`,
    ],
    attachment: [
        `is unchanged by ${USER}'s absence`,
        `notices ${USER} is gone and returns to their own business`,
        `keeps ${USER} in mind between meetings and steers towards the next occasion to see them`,
        `carries ${USER}'s absence as a weight and reads separation as loss, which shows in their attention and patience`,
    ],
};

// Глаголы здесь только в настоящем времени третьего лица: в прошедшем русский
// требует рода, а персонаж в чате может быть любого.
export const UI_BANDS = {
    trust: [
        'Держится настороже: о своих делах молчит, слова {user} проверяет, путь к отступлению оставляет всегда',
        'Держится вежливо, но осторожно: делится фактами, а не причинами, и подпускает {user} только туда, где нечего терять',
        'Говорит о своих делах прямо и просит {user} о помощи без лишних предисловий',
        'Не скрывает ничего важного, верит {user} на слово и позволяет застать себя врасплох',
    ],
    passion: [
        'Близость и прикосновения ничего не меняют: рядом {user} или нет — одинаково',
        'Тянет, но держит себя в руках — это прорывается в мелочах, а не в поступках',
        'Ищет близости, задерживает взгляд и пользуется случаем, когда сцена его даёт',
        'Хочет {user} настолько, что сдержанность стоит заметных усилий и окрашивает каждый жест в ответ',
    ],
    devotion: [
        'Своё впереди чужого: помогает там, где это ничего не стоит',
        'Приходит, когда просят, и в разумных пределах, но свою жизнь вокруг {user} не перестраивает',
        'Ставит нужду {user} выше своего удобства и держит слово, даже когда оно дорого обходится',
        'Идёт на настоящие потери ради {user} не раздумывая: чужой интерес здесь не решение, а исходная точка',
    ],
    attachment: [
        'Отсутствие {user} ничего не меняет',
        'Замечает, что {user} рядом нет, и возвращается к своим делам',
        'Держит {user} в голове между встречами и ищет повод увидеться снова',
        'Носит разлуку с собой как тяжесть, и это видно по вниманию и терпению',
    ],
};

export const dispositionBand = value => value >= 75 ? 3 : value >= 50 ? 2 : value >= 25 ? 1 : 0;

// Ноль — «ещё не оценено», а не «нет доверия»: пустая шкала не должна ни
// отыгрываться как холод, ни объявлять об этом человеку в окне.
export function dispositionText(metric, value, names = {}) {
    const bands = UI_BANDS[metric];
    const level = Number(value);
    if (!bands || !(level > 0)) return '';
    return t(bands[dispositionBand(level)], { char: names.char || '{{char}}', user: names.user || '{{user}}' });
}
