import { sameSecret, secretSlots, secretKey } from './secrets.js';
import { getContext } from '/scripts/extensions.js';
import { getCurrentChatId } from '/script.js';
import { RELATIONSHIP_LADDER_LIMIT, RELATIONSHIP_METRICS, RELATIONSHIP_RUNG_NOTE_LIMIT, RELATIONSHIP_RUNG_TITLE_LIMIT, STATE_KEY } from './config.js';
import { clampPercent } from './utils.js';
import { galleryEnabled } from './gallery-data.js';

// Заглушка пустой стадии — подпись для окна, а не факт истории. Везде, где
// состояние уезжает в промпт, её приходится отличать от настоящего значения:
// русское слово посреди английской истории модель читает как указание на язык
// ответа. Отсюда и константа вместо строкового литерала в пяти местах.
export const STAGE_UNSET = 'Не определено';

export function createState(chat) {
    return {
        version: 8,
        processedThrough: -1,
        pending: { messageIndices: [], eventNotes: [], closeRequested: false },
        arcs: [],
        secrets: { revealed: [], unrevealed: [] },
        calendar: { currentDate: null, sourceMessageIndex: null, viewOffsetWeeks: 0, birthdays: [], plans: [] },
        health: { satiety: null, energy: null, mood: null, injuries: [] },
        relationship: { ladder: [], phase: '', nextStep: '', stage: STAGE_UNSET, behavior: '', progress: 0, trust: 0, passion: 0, devotion: 0, attachment: 0, trends: {}, updatedAt: null },
        gallery: { memories: [], items: [] },
        world: { location: '', description: '', characterOutfit: '', userOutfit: '', indoor: null, clock: '', clockIndex: null, timeOfDay: '', weather: '', temperature: null, updatedAt: null },
    };
}

export function normalizeState(state, chat) {
    const legacyBootstrap = state.version < 8 && !state.arcs?.length && !state.pending?.eventNotes?.length;
    state.version = 8;
    const rawProcessedThrough = Number(state.processedThrough);
    state.processedThrough = Math.max(-1, Math.min(Number.isFinite(rawProcessedThrough) ? rawProcessedThrough : -1, chat.length - 1));
    if (legacyBootstrap) state.processedThrough = -1;
    state.pending ??= {};
    state.pending.messageIndices = Array.isArray(state.pending.messageIndices) ? state.pending.messageIndices : [];
    state.pending.eventNotes = Array.isArray(state.pending.eventNotes) ? state.pending.eventNotes : [];
    state.pending.closeRequested = Boolean(state.pending.closeRequested);
    state.arcs = Array.isArray(state.arcs) ? state.arcs : [];
    state.secrets ??= {};
    state.secrets.revealed = (Array.isArray(state.secrets.revealed) ? state.secrets.revealed : []).map(normalizeSecretEntry).filter(Boolean);
    state.secrets.unrevealed = (Array.isArray(state.secrets.unrevealed) ? state.secrets.unrevealed : []).map(normalizeSecretEntry).filter(Boolean);
    state.calendar ??= {};
    state.calendar.currentDate = /^\d{4}-\d{2}-\d{2}$/.test(state.calendar.currentDate || '') ? state.calendar.currentDate : null;
    state.calendar.sourceMessageIndex = Number.isInteger(state.calendar.sourceMessageIndex) ? state.calendar.sourceMessageIndex : null;
    state.calendar.viewOffsetWeeks = Number.isInteger(state.calendar.viewOffsetWeeks) ? state.calendar.viewOffsetWeeks : 0;
    state.calendar.birthdays = Array.isArray(state.calendar.birthdays) ? state.calendar.birthdays : [];
    state.calendar.plans = Array.isArray(state.calendar.plans) ? state.calendar.plans : [];
    state.health ??= {};
    state.health.satiety = normalizeVital(state.health.satiety);
    state.health.energy = normalizeVital(state.health.energy);
    state.health.mood = state.health.mood && typeof state.health.mood === 'object' ? state.health.mood : null;
    state.health.injuries = Array.isArray(state.health.injuries) ? state.health.injuries : [];
    state.relationship = normalizeRelationship(state.relationship);
    state.gallery ??= {};
    state.gallery.memories = normalizeGalleryEntries(state.gallery.memories, 'memory');
    state.gallery.items = normalizeGalleryEntries(state.gallery.items, 'item');
    state.world ??= {};
    state.world.location = String(state.world.location || '').trim().slice(0, 120);
    state.world.description = String(state.world.description || '').trim().slice(0, 2400);
    state.world.characterOutfit = String(state.world.characterOutfit || '').trim().slice(0, 1200);
    state.world.userOutfit = String(state.world.userOutfit || '').trim().slice(0, 1200);
    state.world.indoor = typeof state.world.indoor === 'boolean' ? state.world.indoor : null;
    state.world.clock = normalizeClock(state.world.clock);
    // Номер сообщения, из которого взято время. Уехал за пределы чата после
    // удаления или ветвления — забываем: иначе он навсегда заблокирует часы.
    state.world.clockIndex = Number.isInteger(state.world.clockIndex) && state.world.clockIndex < chat.length ? state.world.clockIndex : null;
    state.world.timeOfDay = timeOfDayFromClock(state.world.clock);
    state.world.weather = String(state.world.weather || '').trim().slice(0, 60);
    state.world.temperature = state.world.temperature !== null && state.world.temperature !== '' && Number.isFinite(Number(state.world.temperature)) ? Math.round(Number(state.world.temperature)) : null;
    return state;
}

// ── Снапшоты состояния ─────────────────────────────────────────────────────
// Ветка наследует chat_metadata родителя целиком (script.js, saveChat), поэтому
// память в ней «из будущего». Разделы кумулятивны и истории не имеют, так что
// откат возможен только по снимкам: кладём их на последнее разобранное
// сообщение каждого анализа.
export const SNAPSHOT_KEY = 'mnema_state';
const SNAPSHOT_LIMIT = 20;

// detail и sourceMessages весят до 20 КБ на запись — в снимок идут только
// лёгкие поля, тяжёлые берутся из текущего состояния по id при восстановлении.
function lightGallery(entries) {
    return (Array.isArray(entries) ? entries : []).map(entry => ({
        id: entry.id, kind: entry.kind, title: entry.title, summary: entry.summary,
        imagePrompt: entry.imagePrompt, aspectRatio: entry.aspectRatio, imageUrl: entry.imageUrl, createdAt: entry.createdAt,
    }));
}

export function createSnapshot(state) {
    return {
        processedThrough: state.processedThrough,
        pending: structuredClone(state.pending),
        world: structuredClone(state.world),
        health: structuredClone(state.health),
        relationship: structuredClone(state.relationship),
        calendar: {
            currentDate: state.calendar.currentDate,
            sourceMessageIndex: state.calendar.sourceMessageIndex,
            birthdays: structuredClone(state.calendar.birthdays),
            plans: structuredClone(state.calendar.plans),
        },
        secrets: structuredClone(state.secrets),
        gallery: { memories: lightGallery(state.gallery.memories), items: lightGallery(state.gallery.items) },
    };
}

export function storeSnapshot(chat, state, messageIndex) {
    const message = chat[messageIndex];
    if (!message) return;
    message.extra ??= {};
    message.extra[SNAPSHOT_KEY] = createSnapshot(state);
    // Снимки нужны только для отката, поэтому храним последние: иначе файл
    // чата растёт на копию разделов каждые N сообщений.
    let kept = 0;
    for (let index = chat.length - 1; index >= 0; index--) {
        if (!chat[index]?.extra?.[SNAPSHOT_KEY]) continue;
        if (++kept > SNAPSHOT_LIMIT) delete chat[index].extra[SNAPSHOT_KEY];
    }
}

function findSnapshot(chat) {
    for (let index = chat.length - 1; index >= 0; index--) {
        const snapshot = chat[index]?.extra?.[SNAPSHOT_KEY];
        if (snapshot) return { snapshot, index };
    }
    return null;
}

// Состояние опережает чат: так выглядит и новая ветка, и откат удалением.
export function stateAheadOfChat(state, chat) {
    const limit = chat.length;
    const beyond = index => Number.isInteger(index) && index >= limit;
    return state.processedThrough >= limit
        || state.pending.messageIndices.some(beyond)
        || state.arcs.some(arc => (arc.messageIndices || []).some(beyond) || (arc.range || []).some(beyond));
}

function applySnapshot(state, snapshot, chat) {
    const heavy = new Map([...state.gallery.memories, ...state.gallery.items].map(entry => [entry.id, entry]));
    const restore = entries => (entries || []).map(entry => {
        const current = heavy.get(entry.id);
        return current ? { ...entry, detail: current.detail, sourceMessages: current.sourceMessages } : entry;
    });
    state.processedThrough = Math.min(Number(snapshot.processedThrough ?? -1), chat.length - 1);
    state.pending = structuredClone(snapshot.pending);
    state.world = structuredClone(snapshot.world);
    state.world.timeOfDay = timeOfDayFromClock(state.world.clock);
    state.health = structuredClone(snapshot.health);
    state.relationship = structuredClone(snapshot.relationship);
    state.calendar = { ...state.calendar, ...structuredClone(snapshot.calendar) };
    state.secrets = structuredClone(snapshot.secrets);
    state.gallery = { memories: restore(snapshot.gallery?.memories), items: restore(snapshot.gallery?.items) };
}

/**
 * Приводит память к фактическому чату после ветвления или удаления сообщений.
 * Арки восстанавливать из снимка не нужно: пережившие обрезку — это ровно те,
 * чьи сообщения-конспекты остались в чате.
 * @returns {'snapshot'|'pruned'|null} что именно пришлось сделать
 */
export function reconcileStateWithChat(state, chat) {
    if (!stateAheadOfChat(state, chat)) return null;
    const limit = chat.length;
    const found = findSnapshot(chat);
    if (found) applySnapshot(state, found.snapshot, chat);
    state.arcs = state.arcs.filter(arc => !(arc.messageIndices || []).some(index => index >= limit) && !(arc.range || []).some(index => index >= limit));
    state.pending.messageIndices = state.pending.messageIndices.filter(index => index < limit);
    state.pending.eventNotes = state.pending.eventNotes.filter(note => !(note.range || []).some(index => index >= limit));
    if (!state.pending.messageIndices.length) state.pending.closeRequested = false;
    state.processedThrough = Math.min(state.processedThrough, limit - 1);
    if (Number.isInteger(state.calendar.sourceMessageIndex) && state.calendar.sourceMessageIndex >= limit) state.calendar.sourceMessageIndex = null;
    return found ? 'snapshot' : 'pruned';
}

export function getState({ create = true } = {}) {
    if (!getCurrentChatId()) return null;
    const context = getContext();
    const chat = context?.chat;
    const metadata = context?.chatMetadata;
    if (!Array.isArray(chat) || !chat.length || !metadata) return null;
    if (!metadata[STATE_KEY] && chat[0]?.[STATE_KEY]) {
        // Migrate legacy state that used to live on the first chat message.
        metadata[STATE_KEY] = chat[0][STATE_KEY];
        delete chat[0][STATE_KEY];
    }
    if (!metadata[STATE_KEY] && create) metadata[STATE_KEY] = createState(chat);
    return metadata[STATE_KEY] ? normalizeState(metadata[STATE_KEY], chat) : null;
}


// Единый формат времени по всему расширению: 24-часовое HH:MM.
export function normalizeClock(value) {
    const match = /^(\d{1,2})\s*[:.]\s*(\d{2})$/.exec(String(value ?? '').trim());
    if (!match) return '';
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return '';
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function timeOfDayFromClock(value) {
    const clock = normalizeClock(value);
    if (!clock) return '';
    const hour = Number(clock.slice(0, 2));
    if (hour < 6) return 'ночь';
    if (hour < 12) return 'утро';
    if (hour < 18) return 'день';
    return 'вечер';
}

function normalizeVital(vital) {
    if (vital === null || vital === undefined || vital === '') return null;
    const data = typeof vital === 'object' ? vital : { value: vital };
    const rawValue = data.value ?? data.percent;
    if (rawValue === null || rawValue === undefined || rawValue === '') return null;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return null;
    return { value: Math.round(Math.max(0, Math.min(100, value))), label: String(data.label || '').trim() };
}

const rungKey = title => String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');

// id ступени живёт только внутри чата: он нужен, чтобы переименование ступени в
// редакторе не сбрасывало текущую позицию на лестнице.
function normalizeLadder(value) {
    const source = (Array.isArray(value) ? value : []).map(item => {
        const rung = typeof item === 'string' ? { title: item } : (item || {});
        return {
            id: String(rung.id || '').trim().slice(0, 40),
            title: String(rung.title || rung.label || rung.name || '').trim().slice(0, RELATIONSHIP_RUNG_TITLE_LIMIT),
            note: String(rung.note || rung.hint || rung.description || '').trim().slice(0, RELATIONSHIP_RUNG_NOTE_LIMIT),
            // Ступень, на которой история уже побывала. Отсюда — граница, ниже
            // которой лестницу переписывать нельзя.
            reached: Boolean(rung.reached),
        };
    }).filter(rung => rung.title);

    // Повтор ступени превращает лестницу в петлю, поэтому одинаковые названия
    // схлопываем, сохраняя первое вхождение и его порядок.
    const seen = new Set();
    const rungs = source.filter(rung => {
        const key = rungKey(rung.title);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, RELATIONSHIP_LADDER_LIMIT);

    const taken = new Set(rungs.map(rung => rung.id).filter(Boolean));
    let counter = 0;
    for (const rung of rungs) {
        if (rung.id) continue;
        while (taken.has(`r${++counter}`));
        rung.id = `r${counter}`;
        taken.add(rung.id);
    }
    return rungs;
}

export const findRung = (ladder, reference) => {
    const value = String(reference || '').trim();
    if (!value) return -1;
    const byId = ladder.findIndex(rung => rung.id === value);
    return byId >= 0 ? byId : ladder.findIndex(rung => rungKey(rung.title) === rungKey(value));
};

export function normalizeRelationship(value) {
    const source = value && typeof value === 'object' ? value : {};
    const ladder = normalizeLadder(source.ladder || source.phases);
    const phaseIndex = findRung(ladder, source.phase);
    // Стоять на ступени, не пройдя предыдущие, история не может — отмечаем всё
    // до текущей включительно, даже если пометка пришла неполной.
    for (let index = 0; index <= phaseIndex; index++) ladder[index].reached = true;
    const relationship = {
        ladder,
        phase: phaseIndex >= 0 ? ladder[phaseIndex].id : '',
        nextStep: String(source.nextStep ?? source.next_step ?? '').trim().slice(0, 120),
        stage: String(ladder[phaseIndex]?.title || source.stage || source.status || STAGE_UNSET).slice(0, 40),
        // Не реплика и не заметка, а разбор того, как при этих шкалах держится
        // именно этот персонаж: в промпте просят 2-4 фразы, и обрезка нужна
        // только как предохранитель, а не как настоящая граница — иначе она
        // срезает ответ модели на полуслове.
        behavior: String(source.behavior || '').trim().slice(0, 900),
        progress: clampPercent(source.progress),
        trust: clampPercent(source.trust),
        passion: clampPercent(source.passion),
        devotion: clampPercent(source.devotion),
        attachment: clampPercent(source.attachment),
        trends: source.trends && typeof source.trends === 'object' ? source.trends : {},
        updatedAt: source.updatedAt || null,
    };
    return relationship;
}

function normalizeGalleryEntries(entries, kind) {
    if (!Array.isArray(entries)) return [];
    return entries.map((entry, index) => {
        const source = typeof entry === 'string' ? { title: entry } : (entry || {});
        const title = String(source.title || source.name || '').trim().slice(0, 120);
        if (!title) return null;
        return {
            id: source.id || `${kind}_${index}_${title}`,
            kind,
            title,
            summary: String(source.summary || source.detail || source.description || '').trim().slice(0, 1200),
            detail: String(source.detail || '').trim().slice(0, 20000),
            sourceMessages: Array.isArray(source.sourceMessages) ? source.sourceMessages : [],
            imagePrompt: String(source.imagePrompt || source.image_prompt || '').trim(),
            aspectRatio: String(source.aspectRatio || source.aspect_ratio || '4:3'),
            imageUrl: String(source.imageUrl || source.image_url || ''),
            createdAt: source.createdAt || new Date().toISOString(),
        };
    }).filter(Boolean).slice(0, 50);
}

// Пройденные этапы сохраняют порядок и id. Анализ может уточнить название
// по существующему id, не меняя факты и прогресс отношений.
function mergeLadder(previous, phase, incoming) {
    if (!Array.isArray(incoming) || !incoming.length) return null;
    const lastReached = previous.map(rung => rung.reached).lastIndexOf(true);
    const history = previous.slice(0, Math.max(lastReached, findRung(previous, phase)) + 1).map(rung => ({ ...rung }));
    const known = new Map(history.map(rung => [rungKey(rung.title), rung]));
    const ahead = [];
    for (const item of incoming) {
        const source = typeof item === 'string' ? { title: item } : (item || {});
        const title = String(source.title || source.label || source.name || '').trim();
        const note = String(source.note || source.hint || source.description || '').trim();
        if (!title) continue;
        const rung = history.find(item => source.id && item.id === source.id) || known.get(rungKey(title));
        if (rung) {
            const collision = known.get(rungKey(title));
            if (!collision || collision === rung) {
                known.delete(rungKey(rung.title));
                rung.title = title;
                known.set(rungKey(title), rung);
            }
            if (typeof source.note === 'string') rung.note = note;
            continue;
        }
        const prior = previous.find(item => source.id && item.id === source.id);
        const fresh = { id: prior?.id || '', title, note };
        known.set(rungKey(title), fresh);
        ahead.push(fresh);
    }
    return [...history, ...ahead];
}

// Разбор длинного куска истории легко перепрыгивает через ступень: модель видит
// итог и записывает его, а промежуточная так и не случается в памяти. Поэтому
// вперёд пускаем ровно на одну ступень за анализ. Первая запись — исключение: до
// неё лестницы ещё нет, и разбор всего чата обязан сразу встать туда, куда
// история дошла. Движение вниз — хоть с верхней ступени на нижнюю: разрыв и
// охлаждение случаются разом, и придумывать для них отдельную ветку незачем.
function advance(ladder, previousPhase, target) {
    const to = findRung(ladder, target);
    if (to < 0) return null;
    const from = findRung(ladder, previousPhase);
    if (from < 0 || to <= from) return ladder[to].id;
    return ladder[Math.min(to, from + 1)].id;
}

export function applyRelationshipUpdate(state, update, settings) {
    if (!settings.trackRelationships || !update || typeof update !== 'object') return;
    const previous = state.relationship;
    const patch = {};

    let ladder = mergeLadder(previous.ladder, previous.phase, update.ladder || update.phases);
    if (ladder) patch.ladder = ladder;
    ladder = normalizeRelationship({ ...previous, ...patch }).ladder;
    // Модель назвала ступень, которой на лестнице нет: это не ошибка, а ещё не
    // записанная ступень — ставим её сразу за текущей, чтобы позиция не потерялась.
    const requested = String(update.phase || '').trim();
    if (requested && findRung(ladder, requested) < 0) {
        const inserted = [...ladder];
        inserted.splice(findRung(ladder, previous.phase) + 1, 0, { title: requested });
        ladder = normalizeRelationship({ ...previous, ladder: inserted }).ladder;
        patch.ladder = ladder;
    }
    const phase = requested ? advance(ladder, previous.phase, requested) : null;
    if (phase && phase !== previous.phase) patch.phase = phase;
    const nextStep = typeof update.next_step === 'string' ? update.next_step : update.nextStep;
    if (requested && phase && findRung(ladder, requested) !== findRung(ladder, phase)) patch.nextStep = ladder[findRung(ladder, phase) + 1]?.note || '';
    else if (typeof nextStep === 'string') patch.nextStep = nextStep.trim();
    // Следующий шаг всегда относится к текущей фазе: сменилась фаза — старый шаг
    // уже пройден, и лучше пустое поле, чем описание вчерашнего порога.
    else if (patch.phase) patch.nextStep = '';
    if (typeof update.stage === 'string' && update.stage.trim()) patch.stage = update.stage.trim();
    if (typeof update.behavior === 'string') patch.behavior = update.behavior.trim();
    else if ((patch.stage && patch.stage !== previous.stage) || patch.phase) patch.behavior = '';
    for (const key of ['progress', ...RELATIONSHIP_METRICS.map(([metric]) => metric)]) {
        if (typeof update[key] === 'number' && Number.isFinite(update[key])) patch[key] = update[key];
    }
    if (!Object.keys(patch).length) return;
    const next = normalizeRelationship({ ...previous, ...patch, updatedAt: new Date().toISOString() });
    next.trends = {};
    for (const key of ['progress', ...RELATIONSHIP_METRICS.map(([metric]) => metric)]) next.trends[key] = Math.sign(next[key] - previous[key]);
    state.relationship = next;
}

export function applyGalleryUpdates(state, updates, settings, sourceMessages = []) {
    if (!settings.collectGallery || !updates || typeof updates !== 'object') return;
    const asArray = value => Array.isArray(value) ? value : value ? [value] : [];
    let remaining = 2;
    const merge = (current, incoming, kind) => {
        const result = normalizeGalleryEntries(current, kind);
        for (const entry of normalizeGalleryEntries(incoming, kind).slice(0, 2)) {
            const duplicate = result.find(item => item.title.toLowerCase() === entry.title.toLowerCase());
            if (duplicate) {
                if (!duplicate.detail) for (const key of ['summary', 'imagePrompt']) if (entry[key]) duplicate[key] = entry[key];
            }
            else if (remaining > 0) {
                result.unshift({ ...entry, sourceMessages: structuredClone(sourceMessages), id: `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` });
                remaining--;
            }
        }
        return result.slice(0, 50);
    };
    if (galleryEnabled(settings, 'memory', true)) state.gallery.memories = merge(state.gallery.memories, asArray(updates.memories || updates.memory), 'memory');
    if (galleryEnabled(settings, 'item', true)) state.gallery.items = merge(state.gallery.items, asArray(updates.items || updates.keepsakes || updates.keepsake), 'item');
}

// owner решает только одно: показывать секрет игроку сразу или прятать под
// кнопку. Свои секреты игрок и так знает, чужие — спойлер.
function normalizeSecretOwner(value) {
    if (/^(world|мир)$/iu.test(String(value || '').trim())) return 'world';
    return /^(?:user|player|persona|\{\{user\}\}|юзер|игрок|пользовател)/iu.test(String(value || '').trim()) ? 'user' : 'char';
}

function normalizeSecretEntry(entry) {
    const source = typeof entry === 'string' ? { title: entry } : (entry || {});
    const title = String(source.title || source.name || '').trim().slice(0, 120);
    if (!title) return null;
    return {
        title,
        summary: String(source.summary || source.details || source.description || '').trim().slice(0, 600),
        owner: normalizeSecretOwner(source.owner ?? source.whose ?? source.holder),
    };
}

export function applySecretsUpdate(state, update, settings) {
    if (!settings.trackSecrets || !update || typeof update !== 'object') return;
    const findByTitle = (list, title) => list.findIndex(item => secretKey(item.title) === secretKey(title));
    for (const raw of Array.isArray(update.reveal) ? update.reveal : []) {
        const title = String(typeof raw === 'string' ? raw : raw?.title || '').trim();
        if (!title) continue;
        const index = findByTitle(state.secrets.unrevealed, title);
        if (index < 0) continue;
        const [secret] = state.secrets.unrevealed.splice(index, 1);
        if (findByTitle(state.secrets.revealed, secret.title) < 0) state.secrets.revealed.push(secret);
    }
    for (const raw of Array.isArray(update.new_unrevealed) ? update.new_unrevealed : []) {
        const secret = normalizeSecretEntry(raw);
        if (secret) { secret.summary = secret.summary.slice(0, 180); }
        if (!secret) continue;
        const existing = [...state.secrets.unrevealed, ...state.secrets.revealed].find(item => sameSecret(item, secret));
        if (existing) { if (secret.summary) existing.summary = secret.summary; /* Keep the existing owner and disclosure state. */ }
        else if (secretSlots(state, settings, secret.owner)) state.secrets.unrevealed.push({ ...secret, title: secret.title.slice(0, 60) });
    }
    for (const raw of Array.isArray(update.new_revealed) ? update.new_revealed : []) {
        const secret = normalizeSecretEntry(raw);
        if (secret) { secret.summary = secret.summary.slice(0, 180); }
        if (!secret) continue;
        const hiddenIndex = state.secrets.unrevealed.findIndex(item => sameSecret(item, secret));
        const previous = hiddenIndex >= 0 ? state.secrets.unrevealed.splice(hiddenIndex, 1)[0] : null;
        const existing = state.secrets.revealed.find(item => sameSecret(item, secret));
        if (existing) { if (secret.summary) existing.summary = secret.summary; /* Keep the existing owner and disclosure state. */ }
        else if (previous || secretSlots(state, settings, secret.owner)) state.secrets.revealed.push({ ...secret, title: previous?.title || secret.title.slice(0, 60), summary: secret.summary || previous?.summary || '', owner: previous?.owner || secret.owner });
    }
}

/**
 * @param {number|null} messageIndex номер последнего сообщения, которое видел
 * источник обновления. Нужен только часам: остальные поля кумулятивны, а время
 * монотонно, и отставший источник не должен отматывать его назад.
 * @param {boolean} tieWins побеждает ли этот источник при равном номере. Метка
 * инфоблока идёт по каждому сообщению и точнее оценки анализа, поэтому при
 * включённом инфоблоке ничья остаётся за ней.
 */
export function applyWorldUpdate(state, update, messageIndex = null, { tieWins = true } = {}) {
    if (!update || typeof update !== 'object') return;
    const location = String(update.location || '').trim().slice(0, 120);
    const locationChanged = location && location.toLowerCase() !== state.world.location.toLowerCase();
    if (location) {
        state.world.location = location;
        if (locationChanged) {
            state.world.description = '';
            state.world.indoor = null;
        }
    }
    const description = String(update.location_description || update.description || '').trim().slice(0, 2400);
    if (description) state.world.description = description;
    for (const [key, alias] of [['characterOutfit', 'char_outfit'], ['userOutfit', 'user_outfit']]) {
        const outfit = update[alias] ?? update[key];
        if (typeof outfit === 'string' && outfit.trim()) state.world[key] = outfit.trim().slice(0, 1200);
    }
    if (typeof update.indoor === 'boolean') state.world.indoor = update.indoor;
    // Анализ идёт по пачке сообщений и почти всегда отстаёт от чата: метка
    // инфоблока уже записала время из свежего ответа, а разбор старого
    // интервала вернул бы стрелки назад. Побеждает источник, который видел чат
    // дальше; без известного номера сообщения оставляем прежнюю пометку.
    const clock = normalizeClock(update.clock ?? update.time);
    const recorded = state.world.clockIndex;
    const fresher = messageIndex === null || recorded === null || (tieWins ? messageIndex >= recorded : messageIndex > recorded);
    if (clock && fresher) {
        state.world.clock = clock;
        state.world.clockIndex = messageIndex ?? state.world.clockIndex;
    }
    state.world.timeOfDay = timeOfDayFromClock(state.world.clock);
    const weather = String(update.weather || '').trim().slice(0, 60);
    if (weather) state.world.weather = weather;
    if (update.temperature !== null && update.temperature !== undefined && Number.isFinite(Number(update.temperature))) {
        state.world.temperature = Math.round(Number(update.temperature));
    }
    state.world.updatedAt = new Date().toISOString();
}

export function applyHealthUpdate(state, update, settings) {
    if (!settings.trackHealth || !update || typeof update !== 'object') return;
    for (const key of ['satiety', 'energy']) {
        if (update[key] !== null && update[key] !== undefined) {
            const incoming = typeof update[key] === 'object' ? update[key] : { value: update[key] };
            const fields = Object.fromEntries(Object.entries(incoming).filter(([, value]) => value !== null && value !== undefined && value !== ''));
            if (fields.percent !== undefined && fields.value === undefined) fields.value = fields.percent;
            const vital = normalizeVital({ ...state.health[key], ...fields });
            if (vital) state.health[key] = vital;
        }
    }
    if (update.mood !== null && update.mood !== undefined) {
        const mood = typeof update.mood === 'string' ? { label: update.mood } : update.mood;
        const label = String(mood?.label || mood?.name || '').trim();
        if (label) state.health.mood = { label, tone: String(mood.tone || state.health.mood?.tone || '').trim().toLowerCase() };
    }
    for (const injury of Array.isArray(update.injuries) ? update.injuries : []) {
        const name = String(injury?.name || injury?.title || '').trim();
        if (!name) continue;
        const existing = state.health.injuries.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
        if (/^(?:healed|resolved|исцелена|исцелено|прошла|зажила)$/iu.test(String(injury.status || ''))) {
            if (existing >= 0) state.health.injuries.splice(existing, 1);
            continue;
        }
        const previous = existing >= 0 ? state.health.injuries[existing] : {};
        const next = { id: injury.id || `injury_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, severity: String(injury.severity || previous.severity || 'minor').toLowerCase(), details: String(injury.details || previous.details || '').trim() };
        if (existing >= 0) state.health.injuries[existing] = { ...state.health.injuries[existing], ...next, id: state.health.injuries[existing].id };
        else state.health.injuries.push(next);
    }
}
