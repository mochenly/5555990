// ВРЕМЕННЫЙ МОДУЛЬ ДЛЯ ПРЕДПРОСМОТРА ИНТЕРФЕЙСА.
// Заполняет состояние чата примерами по всем разделам, чтобы посмотреть, как
// выглядит полностью заполненная панель. Ничего не сохраняет: данные живут
// только до перезагрузки чата. Удалить вместе с кнопкой #mnema_demo_fill.
const DEMO_IMAGE = '/img/ai4.png';

function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shift(base, days) {
    const date = new Date(base);
    date.setDate(date.getDate() + days);
    return date;
}

function demoScene() {
    return [
        { index: 0, speaker: 'Сан', role: 'assistant', text: 'Дождь превратил парковку в чёрное зеркало. Он держал зонт так, будто это оружие, а не вежливость.' },
        { index: 1, speaker: 'Хэ-рин', role: 'user', text: '«Ты опоздал на сорок секунд», — сказала она, не поднимая глаз от телефона.' },
        { index: 2, speaker: 'Сан', role: 'assistant', text: 'Он не стал извиняться. Просто шагнул ближе, и дождь перестал существовать.' },
    ];
}

export function fillDemoState(state) {
    const today = new Date();

    state.processedThrough = 12;
    state.pending = {
        messageIndices: [13, 14, 15, 16, 17],
        closeRequested: false,
        eventNotes: [
            { range: [7, 9], summary: 'Первая совместная поездка в Пусан. Сан впервые не стал держать дистанцию, Хэ-рин впервые не стала отсылать его прочь.', closeArc: false },
            { range: [10, 12], summary: 'Ссора из-за журналистов у студии. Хэ-рин ушла под дождь одна, Сан догнал её через три квартала.', closeArc: true, arcReason: 'Конфликт разрешён, линия доверия закрылась признанием.' },
        ],
    };

    state.arcs = [
        { id: 'demo_arc_1', range: [0, 6], title: 'Одиннадцатый телохранитель', summary: 'Сан под именем Ли Минхо получает место рядом с Хэ-рин. Она проверяет его на прочность холодом и молчанием, он не отступает. К концу арки она впервые обращается к нему по имени.', messageIndices: [], eventNotes: [{}, {}, {}], active: false },
        { id: 'demo_arc_2', range: [7, 12], title: 'Дождь над Пусаном', summary: 'Поездка, ссора и первое признание, что рядом с ним ей спокойнее, чем одной. Сан впервые сомневается в задании Сайфера.', messageIndices: [], eventNotes: [{}, {}], active: true },
    ];

    state.world = {
        location: 'Odd Atelier, репетиционная студия',
        description: 'Зеркала во всю стену множат холодный свет ламп. Пахнет канифолью, кофе из автомата и дорогими духами. За окном — ноябрьский Сеул под дождём, стекло запотело изнутри.',
        indoor: true,
        clock: '21:40',
        timeOfDay: 'поздний вечер',
        weather: 'дождь',
        temperature: 8,
        updatedAt: new Date().toISOString(),
    };

    state.health = {
        satiety: { value: 38, label: 'Не ела с утра, только кофе' },
        energy: { value: 21, label: 'Вторые сутки без нормального сна' },
        mood: { label: 'Напряжена и упряма', tone: 'negative' },
        injuries: [
            { id: 'demo_injury_1', name: 'Растяжение голеностопа', severity: 'moderate', details: 'Подвернула ногу на репетиции. Фиксирующая повязка, нагрузка ограничена, танцевать нельзя минимум неделю.' },
            { id: 'demo_injury_2', name: 'Порез на ладони', severity: 'minor', details: 'Разбитый бокал в гримёрке. Обработан, заживает.' },
        ],
    };

    state.relationship = {
        stage: 'Опасная близость',
        progress: 64,
        trust: 58,
        passion: 71,
        devotion: 44,
        attachment: 67,
        trends: { progress: 1, trust: 1, passion: 1, devotion: 0, attachment: -1 },
        updatedAt: new Date().toISOString(),
    };

    state.secrets = {
        revealed: [
            { title: 'Прошлое Сана во Владивостоке', summary: 'Два года на территории, где корейские банды пересекались с русской братвой. Хэ-рин узнала об этом из его оговорки в машине.', owner: 'char' },
            { title: 'Хэ-рин ненавидит сцену', summary: 'Призналась Сану ночью после концерта: выходит на сцену только из-за обещания матери.', owner: 'user' },
        ],
        unrevealed: [
            { title: 'Настоящее имя телохранителя', summary: 'Ли Минхо не существует. Хэ-рин не знает, что рядом с ней Докса, правая рука Сайфера.', owner: 'char' },
            { title: 'Задание Сайфера', summary: 'Сан должен получить доступ к судоходным маршрутам и офшорам Yoon Group. Срок — четыре месяца.', owner: 'char' },
            { title: 'Диагноз Сайфера', summary: 'Старику осталось меньше года. Знают только Сан и подкупленный онколог.', owner: 'char' },
            { title: 'Счета, о которых не знает отец', summary: 'У Хэ-рин есть право подписи по офшорам Yoon Group, и она молчит об этом даже с Чжихуном.', owner: 'user' },
        ],
    };

    const anchor = today;
    state.calendar = {
        currentDate: isoDate(anchor),
        sourceMessageIndex: 12,
        viewOffsetWeeks: 0,
        birthdays: [
            { id: 'demo_bd_1', person: 'Хэ-рин', monthDay: `${String(shift(anchor, 5).getMonth() + 1).padStart(2, '0')}-${String(shift(anchor, 5).getDate()).padStart(2, '0')}`, note: 'Просила ничего не устраивать. Врёт.' },
            { id: 'demo_bd_2', person: 'Чжихун', monthDay: '03-19', note: 'Менеджер, всегда работает в свой день рождения.' },
        ],
        plans: [
            { id: 'demo_plan_1', title: 'Съёмка для обложки', date: isoDate(shift(anchor, 1)), time: '09:00', details: 'Студия в Каннаме, весь день. Охрана — Сан.' },
            { id: 'demo_plan_2', title: 'Ужин с отцом', date: isoDate(shift(anchor, 3)), time: '19:30', details: 'Ханнам-дон. Разговор о наследовании, Хэ-рин откладывала его дважды.' },
            { id: 'demo_plan_3', title: 'Совет директоров Yoon Group', date: isoDate(shift(anchor, 9)), time: '11:00', details: 'Право подписи по скрытым счетам.' },
        ],
    };

    const scene = demoScene();
    state.gallery = {
        memories: [
            {
                id: 'demo_memory_1', kind: 'memory', title: 'Зонт под чёрным дождём',
                summary: 'Сан впервые встал так близко, что дождь перестал её касаться.',
                detail: 'Я помню запах мокрого асфальта и то, как холод пробирался под воротник.\n\nОн ничего не сказал — просто шагнул ближе и поднял зонт так, что вода больше не доставала до меня. Одиннадцать человек до него держали дистанцию, как будто я стеклянная. Он держал дистанцию иначе: будто стеклянный был он.\n\nЯ злилась на себя за то, что мне стало спокойно.',
                imagePrompt: 'A cinematic night scene in a rain-soaked Seoul parking lot, reflective black asphalt mirroring neon signage…',
                aspectRatio: '4:3', imageUrl: DEMO_IMAGE, sourceMessages: scene, createdAt: new Date().toISOString(),
            },
            {
                id: 'demo_memory_2', kind: 'memory', title: 'Три квартала под ливнем',
                summary: 'После ссоры у студии он догнал её и не стал ничего объяснять.',
                detail: 'Я шла быстро, чтобы он не догнал. Он догнал.\n\nНи одного упрёка, ни одного вопроса. Только куртка на моих плечах, ещё тёплая, и его молчание рядом — единственное молчание в моей жизни, которое не было осуждением.',
                imagePrompt: 'Two figures walking through heavy rain on a narrow Seoul side street at night…',
                aspectRatio: '16:9', imageUrl: '', sourceMessages: scene, createdAt: new Date().toISOString(),
            },
        ],
        items: [
            {
                id: 'demo_item_1', kind: 'item', title: 'Серебряное кольцо с царапиной',
                summary: 'Кольцо, которое он снял с пальца и оставил на её столе без объяснений.',
                detail: 'Он снял его и положил на мой туалетный столик, ничего не сказав.\n\nЯ до сих пор ношу его на цепочке, потому что это единственное, что от него осталось настоящего.',
                imagePrompt: 'Close-up of a heavy scratched silver ring resting on a marble vanity…',
                aspectRatio: '3:2', imageUrl: DEMO_IMAGE, sourceMessages: scene, createdAt: new Date().toISOString(),
            },
            {
                id: 'demo_item_2', kind: 'item', title: 'Разбитые очки в тонкой оправе',
                summary: 'Часть чужого образа, которую он больше не надел.',
                detail: 'Стекло треснуло, когда он закрыл меня собой у служебного выхода.\n\nОн не стал их чинить — и я поняла, что человек, которым он притворялся, закончился в тот вечер.',
                imagePrompt: 'Wire-rimmed glasses with a cracked lens lying on dark wool fabric…',
                aspectRatio: '4:3', imageUrl: '', sourceMessages: scene, createdAt: new Date().toISOString(),
            },
        ],
    };

    return state;
}
