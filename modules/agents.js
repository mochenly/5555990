import { parseJsonResponse, requestModel } from './model-api.js';

// Агент — это роль со своим узким входом. Один общий запрос, который делает
// всё сразу, смешивает задачи: так поведение персонажа превращалось в пересказ
// только что прочитанного интервала. Здесь каждый видит только своё.
//
// kind решает, кто включает агента:
//   core     — без него Mnema не работает, выключить нельзя;
//   section  — включается вместе со своим разделом в настройках;
//   optional — свой переключатель, по умолчанию выключен: каждый такой агент —
//              лишние запросы через API пользователя.
export const AGENTS = Object.freeze([
    { id: 'router', kind: 'core', icon: 'fa-signs-post', title: 'Распорядитель', description: 'Читает новый интервал, пишет его конспект, решает, закончилась ли арка, и зовёт только тех специалистов, чьи разделы задеты' },
    { id: 'world', kind: 'core', icon: 'fa-earth-europe', title: 'Летописец мира', description: 'Место, время, погода и одежда героев' },
    { id: 'calendar', kind: 'section', section: 'trackCalendar', icon: 'fa-calendar', title: 'Календарь', description: 'Сюжетная дата, дни рождения и планы' },
    { id: 'health', kind: 'section', section: 'trackHealth', icon: 'fa-notes-medical', title: 'Здоровье', description: 'Сытость, энергия, настроение и травмы персонажа' },
    { id: 'relationship', kind: 'section', section: 'trackRelationships', icon: 'fa-heart', title: 'Отношения', description: 'Лестница отношений и шкалы' },
    { id: 'behavior', kind: 'section', section: 'trackRelationships', icon: 'fa-masks-theater', title: 'Поведение', description: 'Пишет, как персонажу держаться с собеседником, из его характера и уровней отношений. Чата не видит намеренно, чтобы не списывать с него' },
    { id: 'secrets', kind: 'section', section: 'trackSecrets', icon: 'fa-key', title: 'Хранитель тайн', description: 'Секреты, их раскрытие и от кого они скрыты' },
    { id: 'gallery', kind: 'section', section: 'collectGallery', icon: 'fa-images', title: 'Галерея', description: 'Важные воспоминания и памятные предметы' },
    { id: 'editor', kind: 'optional', icon: 'fa-feather-pointed', title: 'Редактор', description: 'Сверяет каждый новый ответ с памятью и прошлыми сообщениями и отмечает противоречия под ответом; по кнопке переписывает его с поправкой. Один запрос на каждый ответ' },
    { id: 'keeper', kind: 'optional', icon: 'fa-people-group', title: 'Хранитель знаний', description: 'Ведёт раздел «Персонажи»: второстепенные герои, кто они и какие записанные тайны каждый знает. Рассказчику уходят те, кто сейчас в сцене' },
    { id: 'archivist', kind: 'optional', icon: 'fa-box-archive', title: 'Архивариус', description: 'Перед отправкой вашего сообщения достаёт из памяти то, что ему нужно, но чего нет в контексте: подробности старых арок, воспоминания, дальние планы. Отправка ждёт его, поэтому лучше дать ему быструю модель' },
    { id: 'director', kind: 'optional', icon: 'fa-clapperboard', title: 'Режиссёр', description: 'Когда закрывается арка, предлагает 2–3 направления, куда история могла бы повернуть, из уже установленного. Рассказчик получает их как возможность, а не задание', actions: [{ id: 'run', icon: 'fa-clapperboard', label: 'Предложить направления' }] },
    { id: 'janitor', kind: 'optional', icon: 'fa-broom', title: 'Уборщик', description: 'Когда закрывается арка, сливает тайны и персонажей, записанных дважды, и убирает отжившие планы. Действует только по явным совпадениям; последнюю уборку можно отменить', actions: [{ id: 'run', icon: 'fa-broom', label: 'Убрать сейчас' }, { id: 'undo', icon: 'fa-rotate-left', label: 'Отменить последнюю уборку' }] },
    { id: 'arcs', kind: 'core', icon: 'fa-book-open', title: 'Летописец арок', description: 'Сводит конспекты закончившейся арки в одну сводку и сливает старые арки' },
]);

export const agentById = id => AGENTS.find(agent => agent.id === id);

export function agentEnabled(settings, id) {
    const agent = agentById(id);
    if (!agent) return false;
    if (agent.kind === 'core') return true;
    if (agent.kind === 'section') return Boolean(settings?.[agent.section]);
    return Boolean(settings?.agents?.[id]?.enabled);
}

// Своё подключение у агента — только замена профиля или модели поверх общих
// настроек: распорядителю хватает дешёвой быстрой модели, редактору нужна
// внимательная. Пустое значение — «как основное».
export function agentSettings(settings, id) {
    const own = settings?.agents?.[id] || {};
    return {
        ...settings,
        profileId: String(own.profileId || '').trim() || settings.profileId,
        model: String(own.model || '').trim() || settings.model,
    };
}

// Журнал живёт только в памяти сессии: он нужен, чтобы видеть, кто и сколько
// работает прямо сейчас, а не как архив. Токены оцениваем грубо, по символам:
// точный счёт стоил бы по запросу к токенизатору на каждый вызов.
const JOURNAL_LIMIT = 200;
const journal = [];
const listeners = new Set();
let sequence = 0;
const estimateTokens = text => Math.ceil(String(text || '').length / 4);

export const journalEntries = () => journal;
export const onJournalChange = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const emit = () => { for (const listener of listeners) { try { listener(journal); } catch (error) { console.warn('[Mnema] Journal listener failed:', error); } } };

export function clearJournal() {
    journal.length = 0;
    emit();
}

/**
 * Единственная дверь агентов к модели: подставляет подключение агента и
 * пишет вызов в журнал.
 * @param {object} options
 * @param {boolean} [options.json=true] разбирать ли ответ как JSON
 * @param {(result: any) => string} [options.describe] короткая строка в журнал о том, что агент вернул
 */
export async function callAgent(id, messages, settings, maxTokens, { json = true, describe = null } = {}) {
    const entry = {
        id: ++sequence,
        agent: id,
        at: Date.now(),
        ms: 0,
        inTokens: estimateTokens(messages.map(message => message.content).join('\n')),
        outTokens: 0,
        status: 'running',
        note: '',
    };
    journal.unshift(entry);
    if (journal.length > JOURNAL_LIMIT) journal.length = JOURNAL_LIMIT;
    emit();
    const started = performance.now();
    try {
        const text = await requestModel(messages, agentSettings(settings, id), maxTokens, `agent:${id}`);
        entry.outTokens = estimateTokens(text);
        const result = json ? parseJsonResponse(text) : text;
        entry.status = 'ok';
        if (describe) {
            try { entry.note = String(describe(result) || ''); } catch { /* журнал не должен ронять агента */ }
        }
        return result;
    } catch (error) {
        entry.status = 'error';
        entry.note = error?.message || String(error);
        throw error;
    } finally {
        entry.ms = Math.round(performance.now() - started);
        emit();
    }
}

// Пометка для уже завершённого вызова: что из ответа реально легло в память,
// видно только после применения.
export function annotateLatest(id, note) {
    const entry = journal.find(item => item.agent === id && item.status !== 'running');
    if (!entry || !note) return;
    entry.note = entry.note ? `${entry.note} · ${note}` : note;
    emit();
}
