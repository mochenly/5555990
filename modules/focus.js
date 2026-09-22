import { secretSlots } from './secrets.js';
import { getContext } from '/scripts/extensions.js';
import { getCurrentChatId } from '/script.js';
import { parseJsonResponse, requestModel } from './model-api.js';
import { participantContext } from './analysis.js';
import { gallerySceneMessages } from './gallery-data.js';
import { buildFocusPrompt, buildRelationshipPrompt } from './prompts.js';
import { applyRelationshipUpdate, applySecretsUpdate, normalizeRelationship } from './state.js';
import { applyCalendarUpdates } from './calendar.js';
import { notify } from './utils.js';
import { t } from './i18n.js';

// Фокусная генерация одного раздела по кнопке: анализ читает историю и
// записывает только доказанное, а здесь пользователь прямо просит придумать —
// секреты персонажа или ближайшие поводы пересечься.
const CONTEXT_MESSAGES = 20;
// Пересборка отношений — единственная кнопка, которой нужна вся история: шаг,
// пройденный сорок сообщений назад, для лестницы так же важен, как вчерашний.
const RELATIONSHIP_CONTEXT_MESSAGES = 60;

// Хвост диалога плюс все сводки арок: сводки стоят в ленте вместо свёрнутых
// сообщений, так что через них в запрос попадает и начало истории, которого в
// хвосте уже нет.
function relationshipStoryMessages(chat, count = RELATIONSHIP_CONTEXT_MESSAGES) {
    const visible = chat.map((message, index) => ({ ...message, index }))
        .filter(message => !message.is_system && String(message.mes || '').trim());
    const arcs = visible.filter(message => message.extra?.mnema_arc_id);
    const tail = visible.filter(message => !message.extra?.mnema_arc_id).slice(-count);
    return [...arcs, ...tail].sort((a, b) => a.index - b.index)
        .map(message => ({ index: message.index, speaker: message.name || (message.is_user ? 'User' : 'Character'), role: message.is_user ? 'user' : 'assistant', text: String(message.mes) }));
}

// Раздел пересобирается целиком, поэтому патч ложится не поверх записанного, а
// на пустое место: иначе mergeLadder сохранил бы старые ступени, ради избавления
// от которых кнопку и нажали.
function applyRelationship(state, result, settings) {
    const update = result?.relationship_update || result?.relationship || result;
    if (!update || typeof update !== 'object') throw new Error('Модель вернула пустой раздел отношений');
    const previous = state.relationship;
    state.relationship = normalizeRelationship({});
    applyRelationshipUpdate(state, update, settings);
    if (!state.relationship.updatedAt || !state.relationship.ladder.length) {
        state.relationship = previous;
        throw new Error('Модель не вернула ни одной ступени отношений');
    }
    // Стрелки роста считаются от предыдущего значения, а здесь предыдущего нет —
    // после пересборки они показывали бы рост с нуля по всем шкалам.
    state.relationship.trends = {};
    return state.relationship.ladder.length;
}

function applySecrets(state, result, settings, owner) {
    const list = Array.isArray(result?.secrets) ? result.secrets : Array.isArray(result) ? result : [];
    const before = state.secrets.unrevealed.length;
    // owner берём из кнопки, а не из ответа: колонка уже сказала, чьи секреты
    // просили, и промахнуться здесь модели незачем.
    applySecretsUpdate(state, { new_unrevealed: list.map(item => ({ ...item, owner })) }, settings);
    return state.secrets.unrevealed.length - before;
}

function applyPlans(state, result, settings, kind) {
    const list = Array.isArray(result?.plans) ? result.plans : Array.isArray(result) ? result : [];
    const before = state.calendar.plans.length;
    // Статусы вырезаем: эта кнопка только предлагает новое и не имеет права
    // удалить план, который чат уже согласовал. Род берём из кнопки, а не из
    // ответа: нажавший уже сказал, что именно просит придумать.
    applyCalendarUpdates(state, { plans: list.map(item => ({ ...item, status: undefined, kind })) }, settings.trackCalendar);
    return state.calendar.plans.length - before;
}

export function createFocusController({ getState, getSettings, onChanged, isProcessing }) {
    let busy = null;
    const status = () => ({ busy });

    async function generate(kind, owner = 'char') {
        if (busy || isProcessing()) return;
        const settings = structuredClone(getSettings());
        const secrets = kind === 'secrets';
        const relationship = kind === 'relationship';
        if (secrets && !settings.trackSecrets) return notify('Раздел «Секреты» выключен в настройках', 'info');
        if (relationship && !settings.trackRelationships) return notify('Раздел «Отношения» выключен в настройках', 'info');
        if (!secrets && !relationship && !settings.trackCalendar) return notify('Раздел «Календарь» выключен в настройках', 'info');
        const context = getContext();
        const chatId = getCurrentChatId();
        const state = getState();
        if (!state || !context.chat?.length) return notify('Откройте чат', 'error');
        if (secrets && !secretSlots(state, settings, owner)) return notify('Достигнут лимит секретов в этой категории', 'info');
        const current = () => getCurrentChatId() === chatId && getContext()?.chat === context.chat && getState({ create: false }) === state;

        busy = { kind, owner };
        onChanged();
        try {
            const messages = relationship
                ? buildRelationshipPrompt({
                    participants: participantContext(context),
                    messages: relationshipStoryMessages(context.chat),
                    characterName: context.name2,
                    userName: context.name1,
                })
                : buildFocusPrompt({
                    kind, owner, state, settings,
                    participants: participantContext(context),
                    messages: gallerySceneMessages(context.chat, CONTEXT_MESSAGES),
                    characterName: context.name2,
                    userName: context.name1,
                });
            // Лестница с заметками к каждой ступени в ответ не укладывается в
            // бюджет остальных кнопок.
            const result = parseJsonResponse(await requestModel(messages, settings, relationship ? 3000 : 1600));
            if (!current()) return;
            // Откат держим наготове: раздел уже изменён, а saveChat ещё может
            // упасть — иначе в памяти осталось бы то, чего нет в файле чата.
            const rollback = structuredClone(relationship ? state.relationship : secrets ? state.secrets : state.calendar.plans);
            const restore = () => {
                if (relationship) state.relationship = rollback;
                else if (secrets) state.secrets = rollback;
                else state.calendar.plans = rollback;
            };
            let added = 0;
            try {
                added = relationship ? applyRelationship(state, result, settings)
                    : secrets ? applySecrets(state, result, settings, owner)
                    : applyPlans(state, result, settings, kind === 'events' ? 'world' : 'personal');
                // Ответ мог оказаться пересказом уже записанного: правки в
                // существующие записи тогда уже внесены, а сохранять их незачем.
                if (!added) throw new Error(secrets ? 'Модель не предложила ни одного нового секрета'
                    : kind === 'events' ? 'Модель не предложила ни одного нового события'
                    : 'Модель не предложила ни одного нового плана');
                await context.saveChat();
            } catch (error) {
                restore();
                throw error;
            }
            onChanged();
            notify(t(relationship ? 'Раздел отношений пересобран · ступеней: {n}'
                : secrets ? 'Добавлено секретов: {n}'
                : kind === 'events' ? 'Добавлено событий: {n}'
                : 'Добавлено планов: {n}', { n: added }), 'success');
        } catch (error) {
            if (current()) notify(error.message || String(error), 'error');
        } finally {
            busy = null;
            onChanged();
        }
    }

    return { status, generate };
}
