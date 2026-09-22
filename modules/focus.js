import { secretSlots } from './secrets.js';
import { getContext } from '/scripts/extensions.js';
import { getCurrentChatId } from '/script.js';
import { parseJsonResponse, requestModel } from './model-api.js';
import { participantContext } from './analysis.js';
import { gallerySceneMessages } from './gallery-data.js';
import { buildFocusPrompt } from './prompts.js';
import { applySecretsUpdate } from './state.js';
import { applyCalendarUpdates } from './calendar.js';
import { notify } from './utils.js';
import { t } from './i18n.js';

// Фокусная генерация одного раздела по кнопке: анализ читает историю и
// записывает только доказанное, а здесь пользователь прямо просит придумать —
// секреты персонажа или ближайшие поводы пересечься.
const CONTEXT_MESSAGES = 20;

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
        if (secrets && !settings.trackSecrets) return notify('Раздел «Секреты» выключен в настройках', 'info');
        if (!secrets && !settings.trackCalendar) return notify('Раздел «Календарь» выключен в настройках', 'info');
        const context = getContext();
        const chatId = getCurrentChatId();
        const state = getState();
        if (!state || !context.chat?.length) return notify('Откройте чат', 'error');
        if (secrets && !secretSlots(state, settings, owner)) return notify('Достигнут лимит секретов в этой категории', 'info');
        const current = () => getCurrentChatId() === chatId && getContext()?.chat === context.chat && getState({ create: false }) === state;

        busy = { kind, owner };
        onChanged();
        try {
            const messages = buildFocusPrompt({
                kind, owner, state, settings,
                participants: participantContext(context),
                messages: gallerySceneMessages(context.chat, CONTEXT_MESSAGES),
                characterName: context.name2,
                userName: context.name1,
            });
            const result = parseJsonResponse(await requestModel(messages, settings, 1600));
            if (!current()) return;
            // Откат держим наготове: раздел уже изменён, а saveChat ещё может
            // упасть — иначе в памяти осталось бы то, чего нет в файле чата.
            const rollback = secrets ? structuredClone(state.secrets) : structuredClone(state.calendar.plans);
            const restore = () => { if (secrets) state.secrets = rollback; else state.calendar.plans = rollback; };
            let added = 0;
            try {
                added = secrets ? applySecrets(state, result, settings, owner) : applyPlans(state, result, settings, kind === 'events' ? 'world' : 'personal');
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
            notify(t(secrets ? 'Добавлено секретов: {n}' : kind === 'events' ? 'Добавлено событий: {n}' : 'Добавлено планов: {n}', { n: added }), 'success');
        } catch (error) {
            if (current()) notify(error.message || String(error), 'error');
        } finally {
            busy = null;
            onChanged();
        }
    }

    return { status, generate };
}
