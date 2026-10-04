import { AGENTS, agentById, agentConnectionLabel, agentConnectionMode, agentEnabled, agentSettings, clearJournal, journalEntries } from './agents.js';
import { fetchModels, requestModel } from './model-api.js';
import { escapeHtml, notify } from './utils.js';
import { t } from './i18n.js';

export function agentsPanelHtml() {
    return `<section class="mnema-tab-panel" data-mnema-panel="agents">
        <div class="mnema-tab-title"><span>✦</span> Агенты</div>
        <div class="mnema-settings-section mnema-glass-card">
            <h4>Разбор интервала</h4>
            <label class="mnema-field">Режим анализа<select id="mnema_analysis_mode" class="text_pole">
                <option value="agents">Агенты: распорядитель и специалисты</option>
                <option value="single">Один общий запрос</option>
            </select></label>
            <p class="mnema-hint">Агенты: распорядитель читает интервал и зовёт только тех специалистов, чьи разделы задеты; каждый видит лишь свой раздел. Тихий интервал стоит один короткий запрос, насыщенный — несколько параллельных. Один общий запрос — прежний режим: всё за один вызов.</p>
        </div>
        <p class="mnema-hint">Нажмите на агента, чтобы открыть его настройки и подключение.</p>
        <div id="mnema_agent_list" class="mnema-agent-list"></div>
        <div class="mnema-settings-section mnema-glass-card">
            <div class="mnema-section-head"><h4>Журнал</h4><span id="mnema_journal_total" class="mnema-journal-total"></span><button type="button" id="mnema_journal_clear" class="mnema-section-edit" title="Очистить журнал" aria-label="Очистить журнал"><i class="fa-solid fa-broom"></i></button></div>
            <p class="mnema-hint">Вызовы агентов за эту сессию. Токены оценены грубо, по длине текста.</p>
            <div id="mnema_agent_journal" class="mnema-journal"></div>
        </div>
    </section>`;
}

// Списки моделей ручных подключений агентов живут в памяти сессии, как и у
// основного подключения: они зависят от адреса и ключа.
const agentModels = new Map();
const busyModels = new Set();

function statusBadge(agent, enabled) {
    if (agent.kind === 'core') return `<span class="mnema-agent-badge">${escapeHtml(t('Всегда'))}</span>`;
    if (agent.kind === 'section') return `<span class="mnema-agent-badge${enabled ? '' : ' off'}">${escapeHtml(t(enabled ? 'С разделом' : 'Раздел выключен'))}</span>`;
    return `<span class="mnema-agent-badge${enabled ? ' on' : ' off'}">${escapeHtml(t(enabled ? 'Включён' : 'Выключен'))}</span>`;
}

function connectionChip(settings, agent, profiles) {
    const { mode, text } = agentConnectionLabel(settings, agent.id, profiles);
    if (!mode) return '';
    const icon = mode === 'profile' ? 'fa-plug' : 'fa-key';
    return `<span class="mnema-agent-chip" title="${escapeHtml(t(mode === 'profile' ? 'Свой профиль' : 'Своё подключение'))}"><i class="fa-solid ${icon}" aria-hidden="true"></i>${escapeHtml(text)}</span>`;
}

function connectionFields(agent, settings, profiles) {
    const own = settings.agents?.[agent.id] || {};
    const mode = agentConnectionMode(settings, agent.id);
    const option = (value, label) => `<label class="mnema-agent-mode${mode === value ? ' active' : ''}"><input type="radio" name="mnema_agent_mode_${agent.id}" value="${value}" data-agent-mode="${agent.id}" ${mode === value ? 'checked' : ''}><span>${escapeHtml(t(label))}</span></label>`;
    const modes = `<div class="mnema-agent-modes" role="radiogroup" aria-label="${escapeHtml(t('Подключение'))}">${option('', 'Как основное')}${option('profile', 'Профиль SillyTavern')}${option('manual', 'Вручную')}</div>`;
    if (mode === 'profile') {
        return modes + `<label class="mnema-field">${escapeHtml(t('Профиль подключения'))}<select class="text_pole" data-agent-field="profileId" data-agent="${agent.id}">
            ${profiles.length ? '' : `<option value="">${escapeHtml(t('Нет доступных профилей'))}</option>`}
            ${profiles.map(profile => `<option value="${escapeHtml(profile.id)}" ${(own.profileId || settings.profileId) === profile.id ? 'selected' : ''}>${escapeHtml(profile.name || profile.model || profile.id)}</option>`).join('')}
        </select></label>`;
    }
    if (mode === 'manual') {
        const models = agentModels.get(agent.id) || [];
        const busy = busyModels.has(agent.id);
        return modes + `<div class="mnema-field-row">
            <label class="mnema-field">API URL<input class="text_pole" type="text" data-agent-field="apiUrl" data-agent="${agent.id}" value="${escapeHtml(own.apiUrl || '')}" placeholder="${escapeHtml(settings.apiUrl || 'http://localhost:1234/v1')}" autocomplete="off"></label>
            <label class="mnema-field">API key<input class="text_pole" type="password" data-agent-field="apiKey" data-agent="${agent.id}" value="${escapeHtml(own.apiKey || '')}" placeholder="${escapeHtml(t(settings.apiKey ? 'Как в основных настройках' : 'Если нужен'))}" autocomplete="off"></label>
            <label class="mnema-field">${escapeHtml(t('Модель'))}
                <span class="mnema-field-inline">
                    <input class="text_pole" type="text" data-agent-field="model" data-agent="${agent.id}" value="${escapeHtml(own.model || '')}" list="mnema_agent_models_${agent.id}" placeholder="model-name" autocomplete="off">
                    <button class="menu_button mnema-inline-button" type="button" data-agent-models="${agent.id}" title="${escapeHtml(t('Обновить список моделей'))}" ${busy ? 'disabled' : ''}><i class="fa-solid fa-rotate${busy ? ' fa-spin' : ''}"></i></button>
                </span>
                <datalist id="mnema_agent_models_${agent.id}">${models.map(model => `<option value="${escapeHtml(model)}"></option>`).join('')}</datalist>
            </label>
        </div>
        <p class="mnema-hint">${escapeHtml(t('Пустые адрес и ключ берутся из основных ручных настроек Mnema.'))}</p>`;
    }
    return modes + `<p class="mnema-hint">${escapeHtml(t('Агент ходит туда же, куда весь остальной анализ: основное подключение из настроек Mnema.'))}</p>`;
}

function agentCard(agent, settings, profiles, open) {
    const own = settings.agents?.[agent.id] || {};
    const enabled = agentEnabled(settings, agent.id);
    const toggle = agent.kind === 'optional'
        ? `<label class="mnema-check mnema-agent-toggle"><input type="checkbox" data-agent-enabled="${agent.id}" ${own.enabled ? 'checked' : ''}> <span><strong>${escapeHtml(t('Агент включён'))}</strong><small>${escapeHtml(t('Каждый включённый агент — дополнительные запросы через ваш API'))}</small></span></label>`
        : '';
    const actions = enabled && agent.actions?.length
        ? `<div class="mnema-agent-actions">${agent.actions.map(action => `<button type="button" class="menu_button" data-agent-action="${agent.id}:${action.id}"><i class="fa-solid ${action.icon}" aria-hidden="true"></i> ${escapeHtml(t(action.label))}</button>`).join('')}</div>`
        : '';
    return `<details class="mnema-agent mnema-glass-card${enabled ? '' : ' disabled'}" data-agent="${agent.id}"${open ? ' open' : ''}>
        <summary>
            <i class="fa-solid ${agent.icon} mnema-agent-icon" aria-hidden="true"></i>
            <span class="mnema-agent-name"><strong>${escapeHtml(t(agent.title))}</strong><small>${escapeHtml(t(agent.description))}</small></span>
            ${connectionChip(settings, agent, profiles)}
            ${statusBadge(agent, enabled)}
            <i class="fa-solid fa-chevron-down mnema-agent-chevron" aria-hidden="true"></i>
        </summary>
        <div class="mnema-agent-body">
            ${toggle}
            <h5>${escapeHtml(t('Подключение'))}</h5>
            ${connectionFields(agent, settings, profiles)}
            <div class="mnema-agent-actions">
                <button type="button" class="menu_button" data-agent-test="${agent.id}"><i class="fa-solid fa-plug-circle-check" aria-hidden="true"></i> ${escapeHtml(t('Проверить подключение'))}</button>
            </div>
            ${actions}
        </div>
    </details>`;
}

let lastArgs = null;

export function renderAgentList(settings, profiles = []) {
    lastArgs = { settings, profiles };
    const list = document.getElementById('mnema_agent_list');
    if (!list) return;
    // Перерисовка не должна выбивать фокус из поля, пока его правят.
    if (list.contains(document.activeElement) && document.activeElement.matches('input[type="text"], input[type="password"]')) return;
    $('#mnema_analysis_mode').val(settings.analysisMode === 'single' ? 'single' : 'agents');
    // Раскрытые карточки запоминаем по самому DOM: перерисовка на каждое
    // изменение иначе захлопывала бы карточку прямо под курсором.
    const open = new Set([...list.querySelectorAll('details.mnema-agent[open]')].map(node => node.dataset.agent));
    list.innerHTML = AGENTS.map(agent => agentCard(agent, settings, profiles, open.has(agent.id))).join('');
}

const rerenderLast = () => { if (lastArgs) renderAgentList(lastArgs.settings, lastArgs.profiles); };

const clock = at => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const seconds = ms => `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} ${t('с')}`;

export function renderJournal() {
    const box = document.getElementById('mnema_agent_journal');
    if (!box) return;
    const entries = journalEntries();
    const done = entries.filter(entry => entry.status !== 'running');
    const tokens = done.reduce((sum, entry) => sum + entry.inTokens + entry.outTokens, 0);
    $('#mnema_journal_total').text(entries.length ? t('{n} вызовов · ≈{tokens} токенов', { n: done.length, tokens: tokens.toLocaleString() }) : '');
    box.innerHTML = entries.length ? entries.slice(0, 80).map(entry => {
        const agent = agentById(entry.agent);
        const icon = entry.status === 'running' ? 'fa-spinner fa-spin' : entry.status === 'ok' ? 'fa-check' : 'fa-triangle-exclamation';
        return `<div class="mnema-journal-row ${entry.status}">
            <i class="fa-solid ${icon}" aria-hidden="true"></i>
            <time>${clock(entry.at)}</time>
            <strong>${escapeHtml(t(agent?.title || entry.agent))}</strong>
            <span class="mnema-journal-meta">${entry.status === 'running' ? escapeHtml(t('работает…')) : `${seconds(entry.ms)} · ≈${entry.inTokens.toLocaleString()} → ${entry.outTokens.toLocaleString()}`}</span>
            ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ''}
        </div>`;
    }).join('') : `<p class="mnema-empty">${escapeHtml(t('Агенты ещё не запускались.'))}</p>`;
}

export function bindAgentEvents({ getSettings, saveSettings, rerender, onAction = () => {} }) {
    const update = (id, patch) => {
        const settings = getSettings();
        settings.agents = { ...(settings.agents || {}), [id]: { ...(settings.agents?.[id] || {}), ...patch } };
        saveSettings();
    };
    $(document).on('change', '#mnema_analysis_mode', function () {
        getSettings().analysisMode = this.value === 'single' ? 'single' : 'agents';
        saveSettings();
    });
    $(document).on('change', '[data-agent-enabled]', function () { update(this.dataset.agentEnabled, { enabled: this.checked }); rerender(); });
    $(document).on('change', '[data-agent-mode]', function () { update(this.dataset.agentMode, { mode: this.value }); rerender(); });
    $(document).on('change', '[data-agent-field]', function () {
        update(this.dataset.agent, { [this.dataset.agentField]: this.value.trim() });
        // Подпись подключения в шапке карточки должна догнать правку.
        if (this.dataset.agentField !== 'apiKey') setTimeout(rerender, 0);
    });
    $(document).on('click', '[data-agent-models]', async function () {
        const id = this.dataset.agentModels;
        const settings = agentSettings(getSettings(), id);
        busyModels.add(id);
        rerenderLast();
        try {
            const models = await fetchModels(settings);
            agentModels.set(id, models);
            notify(t('Доступно моделей: {n}', { n: models.length }), 'success');
        } catch (error) {
            notify(error.message || String(error), 'error');
        } finally {
            busyModels.delete(id);
            rerenderLast();
        }
    });
    $(document).on('click', '[data-agent-test]', async function () {
        const id = this.dataset.agentTest;
        const button = $(this).prop('disabled', true);
        try {
            const response = await requestModel([{ role: 'user', content: 'Reply with one word: OK' }], agentSettings(getSettings(), id), 16, `test:${id}`);
            notify(t('{agent}: подключение работает — {reply}', { agent: t(agentById(id)?.title || id), reply: response.slice(0, 60) }), 'success');
        } catch (error) {
            notify(`${t(agentById(id)?.title || id)}: ${error.message || error}`, 'error');
        } finally {
            button.prop('disabled', false);
        }
    });
    $(document).on('click', '#mnema_journal_clear', () => clearJournal());
    $(document).on('click', '[data-agent-action]', function () {
        const [agent, action] = String(this.dataset.agentAction).split(':');
        onAction(agent, action);
    });
}
