import { getCurrentLocale } from '/scripts/i18n.js';

// Интерфейс написан по-русски, поэтому механизм SillyTavern (английский —
// источник) нам не подходит: держим свой словарь RU→EN. Русская локаль отдаёт
// строки как есть, любая другая — перевод.
const EN = {
    "Оформление инфоблока": "Infoblock appearance",
    "Компактный": "Compact",
    "Привычная плашка · нейтральные тона": "Familiar layout · neutral tones",
    "Часы": "Clock",
    "Часы и дата · лёгкие карточки": "Clock and date · light cards",
    "Стекло": "Glass",
    "Матовое стекло · прозрачная линза": "Frosted glass · translucent lens",
    "Дневник": "Journal",
    "Тёплая бумага · мини-дневник": "Warm paper · pocket journal",
    "Табло": "Readout",
    "Графит и янтарь · приборная панель": "Graphite and amber · instrument panel",
    "Оформление меняется сразу во всём чате. Раскрытые разделы сохраняются.": "Appearance changes immediately throughout the chat. Expanded sections stay open.",
    "ночь": "night",
    "утро": "morning",
    "день": "afternoon",
    "вечер": "evening",
    "Секреты мира": "World secrets",
    "Мир": "World",
    "Мира": "World",
    "Тайна мира": "World secret",
    "Тайн мира пока нет.": "No world secrets yet.",
    "Скрытые истины за пределами двух героев": "Hidden truths beyond the two protagonists",
    "Придумать секреты мира": "Invent world secrets",
    "Редактировать секреты мира": "Edit world secrets",
    "Лимиты секретов": "Secret limits",
    "Максимум на категорию, включая раскрытые. 0 запрещает новые записи. Уже сохранённые секреты не удаляются.": "Maximum per category, including revealed secrets. 0 prevents new entries. Existing secrets are preserved.",
    "Достигнут лимит секретов в этой категории": "Secret limit reached for this category",
    "Сократите секрет: название до 60, содержание до 180 символов": "Shorten the secret: title up to 60, content up to 180 characters",
    "Такой секрет уже есть": "This secret already exists",
    // ── Общее, вкладки, шапка ──────────────────────────────────────────────
    'Проверить': 'Analyze',
    'Проверить новые сообщения': 'Analyze new messages',
    'Перечитать последний интервал заново': 'Re-read the last interval',
    'Проверить новое, иначе перечитать интервал': 'Analyze new messages, or re-read the interval',
    'Интервал #{from}–#{to} перечитан': 'Interval #{from}–#{to} re-read',
    'Нечего перепроверять: новых сообщений нет, а прошлые интервалы уже сведены в арки': 'Nothing to re-check: no new messages, and earlier intervals are already merged into arcs',
    'Тест': 'Demo',
    'Временно: заполнить все разделы примерами (без сохранения)': 'Temporary: fill every section with examples (not saved)',
    'Закрыть': 'Close',
    'Отмена': 'Cancel',
    'Сохранить': 'Save',
    'Удалить запись': 'Delete entry',
    'Редактировать': 'Edit',
    'Основное': 'Main',
    'Статус': 'Status',
    'Техническое': 'Technical',
    'Разделы Mnema': 'Mnema sections',
    'Сводка': 'Overview',
    'Общая сводка': 'Overview',
    'Воспоминания': 'Memories',
    'Галерея': 'Gallery',
    'Секреты': 'Secrets',
    'Мир': 'World',
    'Отношения': 'Relationship',
    'Календарь': 'Calendar',
    'Здоровье': 'Health',
    'Арки': 'Arcs',
    'Ручной анализ': 'Manual analysis',
    'Настройки': 'Settings',
    'Раздел готов к настройке.': 'This section is ready to be set up.',
    'Готово': 'Done',
    'Нет данных': 'No data',
    'Не определено': 'Not set',
    'Не определена': 'Not set',
    'Пользователь': 'User',
    'Персонаж': 'Character',
    'Персона': 'Persona',
    'Вы': 'You',
    'Откройте чат': 'Open a chat first',

    // ── Сводка и сцена ─────────────────────────────────────────────────────
    'дата': 'date',
    'время': 'time',
    'локация': 'location',
    'погода': 'weather',
    'Локация не определена': 'Location not set',
    'Пока нет данных о месте действия.': 'Nothing recorded about the setting yet.',
    'ваших тайн': 'your secrets',
    'чужих раскрыто': 'of theirs revealed',
    'Сытость': 'Satiety',
    'Энергия': 'Energy',
    'Текущая арка': 'Current arc',
    'Предметы': 'Keepsakes',
    'Стадия отношений': 'Relationship stage',
    'Ступени этой истории': 'The steps of this story',
    'Следующий шаг:': 'Next step:',
    'Пройдено': 'Passed',
    'Сейчас': 'Now',
    'Впереди': 'Ahead',
    'Следующий шаг': 'Next step',
    'Ступени отношений': 'Relationship steps',
    'Предыдущая ступень': 'Previous step',
    'Следующая ступень': 'Next step ahead',
    'Общий прогресс': 'Overall progress',
    'Состояние персонажа': 'Character condition',
    'Настроение': 'Mood',
    'Травмы': 'Injuries',
    'внутри': 'indoors',
    'снаружи': 'outdoors',
    'Mnema анализирует…': 'Mnema is analyzing…',
    'Mnema включена': 'Mnema is on',
    'Mnema выключена': 'Mnema is off',
    'Критически мало': 'Critically low',
    'Низко': 'Low',
    'Нормально': 'Normal',
    'Хорошо': 'Good',
    'Есть травмы': 'Injured',
    'Нужна помощь': 'Needs help',
    'Нужен отдых': 'Needs rest',
    'Стабильно': 'Stable',
    'В чате пока нет сообщений.': 'No messages in this chat yet.',
    'До следующей проверки: {n}': 'Next check in {n}',
    '{n}% общего прогресса': '{n}% of overall progress',

    // ── Секреты ────────────────────────────────────────────────────────────
    'Ваши тайны — вы их и так знаете': 'Your own secrets — you know them anyway',
    '0 из 0 раскрыто': '0 of 0 revealed',
    'тайн пока нет': 'no secrets yet',
    'Своих тайн пока не нашлось.': 'No secrets of your own yet.',
    'Чужих тайн пока не нашлось.': 'No secrets of theirs yet.',
    'Нераскрытая тайна': 'Undisclosed secret',
    'Снова скрыть': 'Hide again',
    'Редактировать секреты персоны': 'Edit persona secrets',
    'Редактировать секреты персонажа': 'Edit character secrets',
    'Секреты {name}': '{name}’s secrets',
    '{revealed} из {total} раскрыто': '{revealed} of {total} revealed',
    'Показать {n} нераскрытых': 'Show {n} undisclosed',
    'Секретов пока нет': 'No secrets yet',
    'Что известно друг о друге': 'What they know about each other',
    'Скрыть нераскрытые': 'Hide undisclosed',
    'далее · {title}': 'next · {title}',
    'Раскрыто {n} из {m}': 'Revealed {n} of {m}',
    'Показать нераскрытые ({n})': 'Show undisclosed ({n})',
    'Раскрыт': 'Revealed',
    'Не раскрыт': 'Not revealed',
    'Личная тайна': 'Private secret',
    'Добавить': 'Add',
    'Добавить секрет': 'Add a secret',
    'Добавить секрет: {name}': 'Add a secret: {name}',
    'Новый секрет': 'New secret',
    'Новый секрет…': 'New secret…',
    'Придумать секреты': 'Invent secrets',
    'Придумать секреты: {name}': 'Invent secrets: {name}',
    'Придумать секреты персоны': 'Invent persona secrets',
    'Придумать секреты персонажа': 'Invent character secrets',
    'Раздел «Секреты» выключен в настройках': 'The Secrets section is switched off in settings',
    'Модель не предложила ни одного нового секрета': 'The model proposed no new secret',
    'Добавлено секретов: {n}': 'Secrets added: {n}',

    // ── Пересборка отношений ───────────────────────────────────────────────
    'Пересобрать раздел по всей истории': 'Rebuild the section from the whole story',
    'Пересобрать раздел отношений?': 'Rebuild the relationship section?',
    'Модель перечитает историю чата вместе со сводками арок и соберёт лестницу, стадию и все шкалы заново.': 'The model will re-read the chat history together with the arc summaries and rebuild the ladder, the stage and every scale from scratch.',
    'Записанное сейчас (пройденных ступеней: {n}) будет заменено целиком, включая правки, внесённые вручную. При ошибке или отмене всё останется как есть.': 'What is recorded now (steps taken: {n}) will be replaced outright, including edits made by hand. On an error or a cancel nothing changes.',
    'Пересобрать': 'Rebuild',
    'Раздел «Отношения» выключен в настройках': 'The Relationships section is switched off in settings',
    'Модель вернула пустой раздел отношений': 'The model returned an empty relationship section',
    'Модель не вернула ни одной ступени отношений': 'The model returned no relationship step at all',
    'Модель не оставила ни одной ступени впереди — нажмите пересборку ещё раз': 'The model left no step ahead — press rebuild again',

    // ── Что шкалы означают в поведении (то же, что уходит в промпт) ─────────
    'Что это меняет в поведении': 'What this changes in behaviour',
    'Держит {user} на расстоянии: о себе говорит скупо, сказанное проверяет и помогает там, где это ничего не стоит': 'Keeps {user} at arm\'s length: says little about themselves, checks what they are told, and helps where it costs nothing',
    'Держится с {user} ровно, но без сближения: делится фактами, а не причинами, приходит, когда просят, и свою жизнь ни под что не перестраивает': 'Steady with {user} but not close: shares facts rather than reasons, shows up when asked, and rearranges nothing for them',
    'Держится с {user} близко: говорит о своём прямо, ищет общества, задерживает взгляд и ставит чужую нужду выше собственного удобства': 'Close to {user}: speaks plainly about their own affairs, seeks their company, holds a look a beat too long, and puts their need ahead of mere convenience',
    'Пускает {user} за все свои границы: не скрывает ничего важного, верит на слово, идёт на настоящие потери не раздумывая и тяжело переносит разлуку': 'Lets {user} inside every guard: hides nothing that matters, takes them at their word, accepts real losses without weighing them, and takes separation hard',
    'сильнее прочего — {metric}': '{metric} runs ahead of the rest',
    'слабее прочего — {metric}': '{metric} lags behind',
    'в последнее время это растёт': 'lately it has been rising',
    'в последнее время это идёт на убыль': 'lately it has been slipping',
    'Раздел отношений пересобран · ступеней: {n}': 'Relationship section rebuilt · steps: {n}',

    // ── Календарь ──────────────────────────────────────────────────────────
    'Дата не определена': 'Date not set',
    'Дата не задана': 'Date not set',
    'Ищу дату в диалоге': 'Looking for a date in the conversation',
    'Дни рождения': 'Birthdays',
    'Ближайшие планы': 'Upcoming plans',
    'Личные планы': 'Personal plans',
    'События мира': 'World events',
    'Обещания и договорённости героев. Их можно сдержать, перенести или нарушить.': 'Promises and agreements the protagonists made. They can keep, move or break them.',
    'Происходит само по себе, без участия героев. В промпт уходит только ближайшая дата — остальное ждёт своей очереди.': 'Happens on its own, without the protagonists. Only the nearest date goes into the prompt - the rest waits its turn.',
    'Личных планов пока нет.': 'No personal plans yet.',
    'Событий мира пока нет.': 'No world events yet.',
    'Род записи': 'Entry kind',
    'Личный план героев': 'Personal plan',
    'Событие мира': 'World event',
    'Ближайший план': 'Next plan',
    'Дни рождения пока не найдены.': 'No birthdays found yet.',
    'Ближайших планов пока нет.': 'No upcoming plans yet.',
    'Планов пока нет': 'No plans yet',
    'Придумать поводы пересечься': 'Invent occasions to cross paths',
    'Раздел «Календарь» выключен в настройках': 'The Calendar section is switched off in settings',
    'Модель не предложила ни одного нового плана': 'The model proposed no new plan',
    'Добавлено планов: {n}': 'Plans added: {n}',
    'Придумать события сеттинга': 'Invent events of the setting',
    'Модель не предложила ни одного нового события': 'The model proposed no new event',
    'Добавлено событий: {n}': 'Events added: {n}',
    'Не скрывать последние сообщения': 'Keep the last messages visible',
    'Хвост чата остаётся видимым даже после закрытия арки, чтобы модель не теряла нить': 'The tail of the chat stays visible after an arc closes, so the model keeps the thread',
    '0 — скрывать всю арку': '0 - hide the whole arc',
    'Максимум отдельных арок': 'Maximum separate arcs',
    'Когда арок становится больше, самые старые сливаются в одно большое саммари': 'When there are more, the oldest are merged into one large summary',
    'Ранняя история': 'Early history',
    'Старые арки слиты в одну: {n}': 'Old arcs merged into one: {n}',
    'Закрыто открытых линий в прошлых арках: {n}': 'Threads closed in earlier arcs: {n}',
    'События': 'Events',
    'Важные детали': 'Key details',
    'Кто ещё участвовал': 'Who else was involved',
    'Осталось открытым': 'Left open',
    'Пересобрать сводку арки': 'Rebuild the arc summary',
    'Сводка арки «{title}» пересобрана': 'Arc summary “{title}” rebuilt',
    'У этой арки не сохранены конспекты интервалов': 'This arc has no stored interval notes',
    'Дождитесь окончания текущей операции': 'Wait for the current operation to finish',
    'Арка исчезла во время пересборки': 'The arc disappeared during the rebuild',
    'Чат сменился во время пересборки арки': 'The chat changed during the arc rebuild',
    'скоро': 'soon',
    'Предыдущая неделя': 'Previous week',
    'Следующая неделя': 'Next week',
    'Вернуться к сюжетной дате': 'Back to the story date',
    'Сюжетная дата · сообщение #{n}': 'Story date · message #{n}',

    // ── Арки и ручной анализ ───────────────────────────────────────────────
    'Завершённые арки': 'Completed arcs',
    'Выбранные сообщения': 'Selected messages',
    'Номера сообщений': 'Message numbers',
    'Все выбранные сообщения отправляются одним запросом с их номерами. Модель сама разделит их на арки.': 'Every selected message is sent in a single request with its number. The model splits them into arcs itself.',
    'Свести в арки': 'Group into arcs',
    'Весь чат': 'Whole chat',
    'Вся переписка отправляется одним запросом с номерами сообщений. Модель сама выделит арки, оставит незавершённую арку открытой и пересчитает память. Старые данные заменяются только после успешного ответа.': 'The whole conversation is sent in a single request with message numbers. The model picks the arcs itself, leaves an unfinished arc open and recalculates the memory. Existing data is replaced only after a successful response.',
    'Анализ всего чата': 'Analyze the whole chat',
    'Анализ…': 'Analyzing…',
    'Остановить': 'Stop',
    'Новая арка ещё не накопила событий.': 'The new arc has not gathered any events yet.',
    'Завершённых арок пока нет.': 'No completed arcs yet.',
    'Редактировать конспект': 'Edit the note',
    'Редактировать арку': 'Edit the arc',
    'Скрыть исходные сообщения и вернуть сводку': 'Hide the source messages and restore the summary',
    'Вернуть исходные сообщения': 'Restore the source messages',
    'Завершить арку': 'Close the arc',
    'Арка продолжается': 'Arc in progress',
    'Заметки текущей арки': 'Notes of the current arc',
    'Конспекты интервалов': 'Interval notes',
    'Конспект': 'Note',
    'Причина завершения': 'Reason for closing',
    'Сводки арок': 'Arc summaries',
    '{n} сообщ. · {m} замет.': '{n} msg · {m} notes',
    'Пакет {n}': 'Batch {n}',
    '{n} сообщений · {m} событий': '{n} messages · {m} events',
    'Доступны номера 1–{n}{hint}. Номер сообщения — его ID в чате.': 'Available numbers: 1–{n}{hint}. A message number is its ID in the chat.',
    '12-40 или 12,15,18': '12-40 or 12,15,18',

    // ── Настройки ──────────────────────────────────────────────────────────
    'Расширение': 'Extension',
    'Выключение просто останавливает анализ — попап и настройки остаются доступны': 'Turning it off only stops the analysis — the popup and settings stay available',
    'Проверять каждые N сообщений': 'Check every N messages',
    'Максимум сообщений в арке': 'Max messages per arc',
    'Максимум токенов в арке': 'Max tokens per arc',
    '0 — без предела': '0 — no limit',
    'Обычно арку закрывает модель, когда сюжет пришёл к развязке. Лимиты — страховка от бесконечной арки: как только накопленные сообщения превышают предел, Mnema закрывает её сама на ближайшем анализе. 0 отключает ограничение.': 'Normally the model closes an arc when the story reaches a resolution. These limits are a safety net against an endless arc: once the accumulated messages exceed the limit, Mnema closes it itself on the next analysis. 0 disables the limit.',
    'Режим «инфоблок»': 'Info block mode',
    'Основная модель дописывает метку сцены, Mnema превращает её в плашку под сообщением и вырезает метку из контекста': 'The main model appends a scene tag, Mnema turns it into a panel under the message and strips the tag from the context',
    'Разделы': 'Sections',
    'Обновлять стадию и шкалы для {{char}} и {{user}}': 'Track the stage and meters between {{char}} and {{user}}',
    'Отслеживать сюжетную дату, дни рождения и планы': 'Track the story date, birthdays and plans',
    'Сытость, энергия, настроение и травмы': 'Satiety, energy, mood and injuries',
    'Раскрытые и нераскрытые сюжетные секреты': 'Revealed and undisclosed story secrets',
    'Собирать важные воспоминания и памятные предметы': 'Collect significant memories and keepsakes',
    'Подключение': 'Connection',
    'Режим подключения': 'Connection mode',
    'Профиль SillyTavern': 'SillyTavern profile',
    'Extra API вручную': 'Extra API, manual',
    'Профиль подключения': 'Connection profile',
    'Модель': 'Model',
    'Проверить подключение': 'Test connection',
    'Нет доступных профилей': 'No profiles available',
    'Обновить список моделей': 'Refresh the model list',
    'Нажмите «обновить», чтобы загрузить список моделей': 'Press refresh to load the model list',
    'Доступно моделей: {n}': 'Models available: {n}',
    'Загружено моделей: {n}': 'Models loaded: {n}',
    'Сначала укажите API URL': 'Set the API URL first',
    'Подключение работает: {text}': 'Connection works: {text}',

    // ── Галерея ────────────────────────────────────────────────────────────
    'Галерея · воспоминания и предметы': 'Gallery · memories and keepsakes',
    'Сбор воспоминаний': 'Collecting memories',
    'Сбор предметов': 'Collecting keepsakes',
    'Автоматически': 'Automatically',
    'Только вручную': 'Manually only',
    'Памятные предметы': 'Keepsakes',
    'Сообщений для воспоминания из текущей сцены': 'Messages used for a memory from the current scene',
    'Нажми на карточку, чтобы раскрыть воспоминание от лица персонажа. Текст создаётся через подключение Mnema. Изображения используют текущие настройки SillyImages, включая модель и референсы.': 'Click a card to unfold the memory in the character’s own voice. The text is generated through Mnema’s connection. Images use your current SillyImages settings, including the model and references.',
    '+ Предмет из текущей сцены': '+ Keepsake from this scene',
    '+ Воспоминание из текущей сцены': '+ Memory from this scene',
    'Памятных предметов пока нет.': 'No keepsakes yet.',
    'Особенных воспоминаний пока нет.': 'No significant memories yet.',
    'Вспоминаю…': 'Recalling…',
    'Создаю изображение…': 'Creating the image…',
    'Восстанавливаю воспоминание…': 'Recovering the memory…',
    'Открыть': 'Open',
    'Вспомнить': 'Recall',
    'Увеличить изображение': 'Enlarge the image',
    'Обновить изображение': 'Refresh the image',
    'Создать изображение': 'Create an image',
    'Пересоздать полностью': 'Recreate completely',
    'Изображение воспоминания': 'Memory image',
    'Закрыть изображение': 'Close the image',
    'Удалить эту запись из галереи?': 'Delete this entry from the gallery?',
    'Памятный предмет готов': 'The keepsake is ready',
    'Воспоминание раскрыто': 'The memory is unfolded',
    'Изображение готово': 'The image is ready',
    'Предыдущая версия сохранена.': 'The previous version has been kept.',
    'Текст сохранён — изображение можно повторить отдельно.': 'The text is saved — the image can be retried separately.',
    'Текст восстановлен, но изображение не создано: {error}': 'The text was recovered, but the image was not created: {error}',
    'Модель не вернула текст воспоминания или визуальный промпт': 'The model returned no memory text or image prompt',
    'Включите генерацию изображений в SillyImages': 'Enable image generation in SillyImages',
    'Не удалось подключить генерацию SillyImages. Проверьте, что расширение установлено и включено.': 'Could not hook into SillyImages generation. Check that the extension is installed and enabled.',
    'Чат сменился, генерация отменена': 'The chat changed, generation cancelled',
    'Для галереи выберите в SillyImages модель изображений, а не видео': 'Pick an image model in SillyImages for the gallery, not a video one',
    'Не удалось сохранить изображение: HTTP {status}': 'Could not save the image: HTTP {status}',
    'Сервер не вернул путь изображения': 'The server returned no image path',

    // ── Инфоблок ───────────────────────────────────────────────────────────
    'Одежда': 'Clothing',
    'Критическое состояние': 'Critical condition',
    'Создаётся…': 'Creating…',
    'Подробности отношений': 'Relationship details',
    'Раскрыть или свернуть состояние сцены': 'Expand or collapse the scene state',
    'Действия Mnema': 'Mnema actions',
    'Прогресс фазы': 'Phase progress',
    'Сохранить воспоминание': 'Save as a memory',
    'Сохранить предмет': 'Save as a keepsake',
    'Анализировать сцену': 'Analyze the scene',
    'Открыть Mnema': 'Open Mnema',
    'Место не указано': 'Location not set',
    'Состояние · {name}': 'Condition · {name}',
    '{text} — дождитесь завершения создания': '{text} — wait until it is finished',

    // ── Метрики отношений ──────────────────────────────────────────────────
    'Доверие': 'Trust',
    'Страсть': 'Passion',
    'Преданность': 'Devotion',
    'Привязанность': 'Attachment',
    'Прогресс': 'Progress',

    // ── Редактор разделов ──────────────────────────────────────────────────
    'Редактировать раздел': 'Edit section',
    'Редактировать: {name}': 'Edit: {name}',
    'Изменения сохранятся после нажатия «Сохранить».': 'Changes are applied when you press Save.',
    'Раздел': 'Section',
    'Записей пока нет.': 'No entries yet.',
    'Добавить запись': 'Add an entry',
    'Чьи секреты': 'Whose secrets',
    'Мир и одежда': 'World and clothing',
    'Локация': 'Location',
    'Описание локации': 'Location description',
    'Время': 'Time',
    'Время суток': 'Part of day',
    'Обстановка': 'Setting',
    'Неизвестно': 'Unknown',
    'Внутри': 'Indoors',
    'Снаружи': 'Outdoors',
    'Погода': 'Weather',
    'Температура, °C': 'Temperature, °C',
    'Одежда персонажа': 'Character clothing',
    'Одежда персоны': 'Persona clothing',
    'Следующий шаг в отношениях': 'Next step in the relationship',
    'Текущая ступень': 'Current step',
    'Название ступени': 'Step name',
    'Что должно произойти': 'What has to happen',
    'Как отношение влияет на поведение': 'How the attitude shapes behaviour',
    'Сытость, 0–100': 'Satiety, 0–100',
    'Описание сытости': 'Satiety description',
    'Энергия, 0–100': 'Energy, 0–100',
    'Описание энергии': 'Energy description',
    'Тон настроения': 'Mood tone',
    'Не указан': 'Not set',
    'Положительный': 'Positive',
    'Нейтральный': 'Neutral',
    'Отрицательный': 'Negative',
    'Травмы и состояния': 'Injuries and conditions',
    'Название': 'Name',
    'Тяжесть': 'Severity',
    'Лёгкая': 'Minor',
    'Средняя': 'Moderate',
    'Тяжёлая': 'Severe',
    'Симптомы, ограничения, лечение': 'Symptoms, limitations, treatment',
    'Сюжетная дата': 'Story date',
    'Планы': 'Plans',
    'Дата': 'Date',
    'Подробности': 'Details',
    'Имя': 'Name',
    'Месяц-день, например 03-08': 'Month-day, e.g. 03-08',
    'Заметка': 'Note',
    'Секреты персонажей': 'Character secrets',
    'Содержание и кто знает': 'The fact and who knows it',
    'Чей секрет': 'Whose secret',
    'Персонажа': 'Character’s',
    'Персоны': 'Persona’s',
    'Факт для памяти': 'Fact to remember',
    'Личное воспоминание': 'Personal recollection',
    'Визуальный промпт': 'Image prompt',
    'Пропорции': 'Aspect ratio',
    'Путь или URL изображения': 'Image path or URL',
    'Конспект #{n}': 'Note #{n}',
    'Новый план': 'New plan',
    'Новый день рождения': 'New birthday',
    'Новая запись': 'New entry',
    'Дата не указана': 'No date',
    'Без даты': 'No date',
    'Изменения сохранены': 'Changes saved',
    'Перейти в другой раздел без сохранения правок?': 'Switch to another section without saving your edits?',
    'Заполните поле «{field}» или удалите пустую запись': 'Fill in the “{field}” field or remove the empty entry',
    'День рождения: укажите месяц-день, например 03-08': 'Birthday: use month-day, e.g. 03-08',
    'Раздел обновился во время редактирования. Откройте редактор заново, чтобы не затереть новые данные.': 'The section changed while you were editing. Reopen the editor so the new data is not overwritten.',
    'Дождитесь завершения анализа или генерации': 'Wait until the analysis or generation finishes',
    'Чат сменился, изменения не сохранены': 'The chat changed, your edits were not saved',

    // ── Сообщения и ошибки ─────────────────────────────────────────────────
    'Собираю базу истории по началу чата…': 'Building the story baseline from the opening of the chat…',
    'Память отмотана к состоянию на этой точке чата': 'Memory rewound to its state at this point of the chat',
    'Память обрезана по этому чату: снимка на этой точке не нашлось, накопленные значения разделов остались прежними': 'Memory trimmed to this chat: no snapshot was found at this point, so the accumulated section values were kept',
    'Дождитесь завершения анализа': 'Wait until the analysis finishes',
    'Секрет с таким названием уже есть': 'A secret with this title already exists',
    'Не удалось сохранить секрет': 'Could not save the secret',
    'Укажите номера сообщений': 'Enter message numbers',
    'Среди указанных номеров нет подходящих сообщений': 'None of the given numbers point to a suitable message',
    'Не понимаю «{chunk}». Формат: 12-40 или 12,15,18': 'Cannot parse “{chunk}”. Format: 12-40 or 12,15,18',
    'Анализ отменён, данные не изменены': 'Analysis cancelled, nothing was changed',
    'Чат или память изменились во время анализа. Запустите анализ ещё раз.': 'The chat or the memory changed during the analysis. Run it again.',
    'Отправляю {n} сообщений одним запросом…': 'Sending {n} messages in a single request…',
    'Сохраняю арки и память…': 'Saving arcs and memory…',
    'Останавливаю после текущего запроса…': 'Stopping after the current request…',
    'Анализ завершён. Создано арок: {n}{open}{skipped}': 'Analysis finished. Arcs created: {n}{open}{skipped}',
    ' · текущая арка оставлена открытой': ' · the current arc was left open',
    ' · пропущено {n}': ' · {n} skipped',
    'Арка «{title}» завершена': 'Arc “{title}” is complete',
    'Арка «{title}» · {n} сообщений свёрнуто': 'Arc “{title}” · {n} messages collapsed',
    'Свернуть исходные сообщения ({n})': 'Collapse the original messages ({n})',
    'Арка {n}': 'Arc {n}',
    'Нет сообщений для анализа': 'No messages to analyze',
    'Чат сменился, пересчёт отменён': 'The chat changed, the recalculation was cancelled',
    'Пересчитать': 'Recalculate',
    'Пересчитать весь чат с нуля?': 'Recalculate the whole chat from scratch?',
    'Все исходные сообщения будут отправлены одним запросом. Модель сама выделит арки и соберёт итоговое состояние разделов.': 'Every source message will be sent in a single request. The model will pick the arcs itself and assemble the final state of the sections.',
    'После успешного анализа существующие арки ({n}) и память будут заменены. При ошибке или отмене они сохранятся.': 'After a successful analysis the existing arcs ({n}) and memory will be replaced. On an error or a cancellation they are kept.',
    'Демо-данные подставлены. Не сохраняются: перезагрузите чат, чтобы вернуть реальные.': 'Demo data inserted. It is not saved: reload the chat to bring the real data back.',
    'Чат сменился во время анализа': 'The chat changed during the analysis',
    'Чат сменился во время формирования арки': 'The chat changed while the arc was being built',
    'В ответе модели отсутствует event_summary': 'The model response has no event_summary',
    'В ответе модели отсутствует summary': 'The model response has no summary',
    'Модель не вернула ожидаемый JSON': 'The model did not return the expected JSON',
    'Модель не вернула список arcs': 'The model did not return an arcs list',
    'Модель пропустила часть выбранных сообщений': 'The model skipped some of the selected messages',
    'Некорректные границы арок: нужны все выбранные сообщения по порядку, без пропусков и пересечений': 'Invalid arc boundaries: every selected message is required, in order, without gaps or overlaps',
    'Только последняя арка может быть незавершённой; поле closed должно быть true или false': 'Only the last arc may be unfinished; the closed field must be true or false',
    'Выберите профиль подключения SillyTavern': 'Choose a SillyTavern connection profile',
    'Профиль вернул пустой ответ': 'The profile returned an empty response',
    'Укажите API URL и модель': 'Set the API URL and the model',
    'Укажите API URL': 'Set the API URL',
    'Не удалось обратиться к Extra API. Проверьте адрес и настройки CORS': 'Could not reach the Extra API. Check the address and the CORS settings',
    'Не удалось получить список моделей. Проверьте адрес и настройки CORS': 'Could not fetch the model list. Check the address and the CORS settings',
    'Extra API вернул пустой ответ': 'The Extra API returned an empty response',
    'API не вернул ни одной модели': 'The API returned no models',
    'Конспект арки: {title}': 'Arc summary: {title}',
};

const russian = /^ru\b|^ru-/i.test(String(getCurrentLocale() || ''));

/**
 * Переводит строку интерфейса и подставляет значения вида {name}.
 * @param {string} text русский исходник — он же ключ словаря
 * @param {Record<string, string|number>} [vars]
 */
export function t(text, vars = null) {
    return tLang(russian ? 'ru' : 'en', text, vars);
}

/**
 * То же, но язык задаётся явно. Нужно там, где подпись уезжает не в окно, а в
 * чат: заголовки сводок читает и модель, и для неё английский заголовок посреди
 * русской истории — сигнал отвечать по-английски. Язык интерфейса к языку
 * истории отношения не имеет, у половины русскоязычных SillyTavern английский.
 * @param {'ru'|'en'} language
 */
export function tLang(language, text, vars = null) {
    let result = language === 'ru' ? text : (EN[text] ?? text);
    if (vars) for (const [key, value] of Object.entries(vars)) result = result.split(`{${key}}`).join(String(value));
    return result;
}

/**
 * Язык готового текста. Словарь у нас ровно двухсторонний, поэтому и различать
 * нужно две раскладки: кириллица против всего остального. Имена и термины
 * латиницей внутри русской фразы на счёт не влияют — их всегда меньшинство.
 * @returns {'ru'|'en'}
 */
export function textLanguage(text) {
    const sample = String(text || '').slice(0, 4000);
    const cyrillic = (sample.match(/\p{Script=Cyrillic}/gu) || []).length;
    const latin = (sample.match(/\p{Script=Latin}/gu) || []).length;
    return cyrillic > latin ? 'ru' : 'en';
}

export function isRussianUi() {
    return russian;
}

// Статические подписи переводим прямо в DOM: так рендер остаётся русским и
// читаемым, а перевод не размазывается по сотням мест. Меняем только узлы,
// чей текст целиком совпадает с ключом, — пользовательские данные (локации,
// имена, конспекты) под это не попадают.
const ATTRIBUTES = ['title', 'placeholder', 'aria-label'];

function translateElement(element) {
    for (const attribute of ATTRIBUTES) {
        const value = element.getAttribute?.(attribute);
        if (value && EN[value.trim()]) element.setAttribute(attribute, EN[value.trim()]);
    }
}

function translateTextNode(node) {
    const text = node.textContent;
    const trimmed = text.trim();
    const translated = trimmed && EN[trimmed];
    if (translated) node.textContent = text.replace(trimmed, translated);
}

export function translateDom(root) {
    if (russian || !root) return;
    // .text() подменяет единственный текстовый узел — обходить в нём нечего,
    // TreeWalker начинает с потомков корня.
    if (root.nodeType === Node.TEXT_NODE) return translateTextNode(root);
    if (root.nodeType === Node.ELEMENT_NODE) {
        translateElement(root);
        for (const element of root.querySelectorAll(`[${ATTRIBUTES.join('],[')}]`)) translateElement(element);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) translateTextNode(node);
}

let observer = null;

/** Следит за перерисовкой попапа и плашек: рендер вставляет русский HTML. */
export function observeTranslation(selectors) {
    if (russian || observer) return;
    observer = new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) translateDom(node);
            }
        }
    });
    for (const selector of selectors) {
        const root = document.querySelector(selector);
        if (!root) continue;
        translateDom(root);
        observer.observe(root, { childList: true, subtree: true });
    }
}
