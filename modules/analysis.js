export function participantContext(context) {
    const character = context.characters?.[context.characterId] || {};
    const expand = value => {
        const text = typeof value === 'string' ? value.trim() : '';
        return text && context.substituteParams ? context.substituteParams(text) : text;
    };
    return {
        character: {
            name: context.name2 || character.name || '{{char}}',
            description: expand(character.data?.description ?? character.description),
            personality: expand(character.data?.personality ?? character.personality),
            scenario: expand(character.data?.scenario ?? character.scenario),
        },
        persona: { name: context.name1 || '{{user}}', description: expand(context.powerUserSettings?.persona_description) },
    };
}

export function candidateIndices(chat, state) {
    const covered = new Set([...state.pending.messageIndices, ...state.arcs.flatMap(arc => arc.messageIndices || [])]);
    const indices = [];
    for (let index = 0; index < chat.length; index++) {
        const message = chat[index];
        if (!message || message.extra?.mnema_arc_id || message.is_system || !String(message.mes || '').trim() || covered.has(index)) continue;
        // Recover greetings skipped by the old bootstrap watermark as well.
        if (index > state.processedThrough || (index === 0 && !message.is_user)) indices.push(index);
    }
    return indices;
}

export function validateManualArcs(result, indices, allowOpen = false) {
    if (!Array.isArray(result?.arcs) || !result.arcs.length) throw new Error('Модель не вернула список arcs');
    let cursor = 0;
    const arcs = result.arcs.map((arc, position) => {
        const title = typeof arc?.title === 'string' ? arc.title.trim() : '';
        const summary = typeof arc?.summary === 'string' ? arc.summary.trim() : '';
        const end = indices.indexOf(arc?.end_index, cursor);
        if (!title || !summary || !Number.isInteger(arc?.start_index) || !Number.isInteger(arc?.end_index)
            || arc.start_index !== indices[cursor] || end < cursor) {
            throw new Error('Некорректные границы арок: нужны все выбранные сообщения по порядку, без пропусков и пересечений');
        }
        if (allowOpen && (typeof arc.closed !== 'boolean' || (!arc.closed && position !== result.arcs.length - 1))) {
            throw new Error('Только последняя арка может быть незавершённой; поле closed должно быть true или false');
        }
        const covered = indices.slice(cursor, end + 1);
        cursor = end + 1;
        return { title, summary, indices: covered, closed: allowOpen ? arc.closed : true };
    });
    if (cursor !== indices.length) throw new Error('Модель пропустила часть выбранных сообщений');
    return arcs;
}

// Keep original chat numbers in the request, even when old summary messages exist.
export function wholeChatIndices(chat, state) {
    const archived = new Set(state.arcs.flatMap(arc => arc.messageIndices || []));
    return chat.flatMap((message, index) => !message?.extra?.mnema_arc_id && String(message?.mes || '').trim()
        && (archived.has(index) || !message.is_system) ? [index] : []);
}

export function prepareRebuiltChat(chat, state) {
    const archived = new Set(state.arcs.flatMap(arc => arc.messageIndices || []));
    const indexMap = new Map();
    const messages = [];
    chat.forEach((message, index) => {
        if (message?.extra?.mnema_arc_id) return;
        indexMap.set(index, messages.length);
        const copy = structuredClone(message);
        if (archived.has(index)) copy.is_system = false;
        messages.push(copy);
    });
    return { messages, indexMap };
}
