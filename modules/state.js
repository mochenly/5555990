import { getContext } from '/scripts/extensions.js';
import { getCurrentChatId } from '/script.js';
import { RELATIONSHIP_METRICS, STATE_KEY } from './config.js';
import { clampPercent } from './utils.js';
import { galleryEnabled } from './gallery-data.js';

export function createState(chat) {
    return {
        version: 8,
        processedThrough: -1,
        pending: { messageIndices: [], eventNotes: [], closeRequested: false },
        arcs: [],
        secrets: { revealed: [], unrevealed: [] },
        calendar: { currentDate: null, sourceMessageIndex: null, viewOffsetWeeks: 0, birthdays: [], plans: [] },
        health: { satiety: null, energy: null, mood: null, injuries: [] },
        relationship: { stage: 'Не определено', behavior: '', progress: 0, trust: 0, passion: 0, devotion: 0, attachment: 0, trends: {}, updatedAt: null },
        gallery: { memories: [], items: [] },
        world: { location: '', description: '', characterOutfit: '', userOutfit: '', indoor: null, clock: '', timeOfDay: '', weather: '', temperature: null, updatedAt: null },
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
    state.world.timeOfDay = String(state.world.timeOfDay || '').trim().slice(0, 40);
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

function normalizeVital(vital) {
    if (vital === null || vital === undefined || vital === '') return null;
    const data = typeof vital === 'object' ? vital : { value: vital };
    const rawValue = data.value ?? data.percent;
    if (rawValue === null || rawValue === undefined || rawValue === '') return null;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return null;
    return { value: Math.round(Math.max(0, Math.min(100, value))), label: String(data.label || '').trim() };
}

export function normalizeRelationship(value) {
    const source = value && typeof value === 'object' ? value : {};
    const relationship = {
        stage: String(source.stage || source.status || 'Не определено').slice(0, 80),
        behavior: String(source.behavior || '').trim().slice(0, 1200),
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

export function applyRelationshipUpdate(state, update, settings) {
    if (!settings.trackRelationships || !update || typeof update !== 'object') return;
    const previous = state.relationship;
    const patch = {};
    if (typeof update.stage === 'string' && update.stage.trim()) patch.stage = update.stage.trim();
    if (typeof update.behavior === 'string' && update.behavior.trim()) patch.behavior = update.behavior.trim();
    else if (patch.stage && patch.stage !== previous.stage) patch.behavior = '';
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
    const findByTitle = (list, title) => list.findIndex(item => String(item.title || '').toLowerCase() === title.toLowerCase());
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
        if (!secret) continue;
        const existing = [...state.secrets.unrevealed, ...state.secrets.revealed].find(item => item.title.toLowerCase() === secret.title.toLowerCase());
        if (existing) { if (secret.summary) existing.summary = secret.summary; existing.owner = secret.owner; }
        else state.secrets.unrevealed.push(secret);
    }
    for (const raw of Array.isArray(update.new_revealed) ? update.new_revealed : []) {
        const secret = normalizeSecretEntry(raw);
        if (!secret) continue;
        const hiddenIndex = findByTitle(state.secrets.unrevealed, secret.title);
        const previous = hiddenIndex >= 0 ? state.secrets.unrevealed.splice(hiddenIndex, 1)[0] : null;
        const existing = state.secrets.revealed.find(item => item.title.toLowerCase() === secret.title.toLowerCase());
        if (existing) { if (secret.summary) existing.summary = secret.summary; existing.owner = secret.owner; }
        else state.secrets.revealed.push({ ...secret, summary: secret.summary || previous?.summary || '', owner: previous?.owner || secret.owner });
    }
}

export function applyWorldUpdate(state, update) {
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
    const clock = normalizeClock(update.clock ?? update.time);
    if (clock) state.world.clock = clock;
    const timeOfDay = String(update.time_of_day || update.timeOfDay || '').trim().slice(0, 40);
    if (timeOfDay) state.world.timeOfDay = timeOfDay;
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
