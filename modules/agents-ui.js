import { AGENTS, agentById, agentEnabled, clearJournal, journalEntries } from './agents.js';
import { escapeHtml } from './utils.js';
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
        <div id="mnema_agent_list" class="mnema-agent-list"></div>
        <div class="mnema-settings-section mnema-glass-card">
            <div class="mnema-section-head"><h4>Журнал</h4><span id="mnema_journal_total" class="mnema-journal-total"></span><button type="button" id="mnema_journal_clear" class="mnema-section-edit" title="Очистить журнал" aria-label="Очистить журнал"><i class="fa-solid fa-broom"></i></button></div>
            <p class="mnema-hint">Вызовы агентов за эту сессию. Токены оценены грубо, по длине текста.</p>
            <div id="mnema_agent_journal" class="mnema-journal"></div>
        </div>
    </section>`;
}

function agentCard(agent, settings, profiles) {
    const own = settings.agents?.[agent.id] || {};
    const enabled = agentEnabled(settings, agent.id);
    const manual = settings.connectionMode === 'manual';
    const toggle = agent.kind === 'optional'
        ? `<label class="mnema-agent-switch"><input type="checkbox" data-agent-enabled="${agent.id}" ${enabled ? 'checked' : ''}><span>${enabled ? 'Включён' : 'Выключен'}</span></label>`
        : agent.kind === 'section'
            ? `<span class="mnema-agent-badge${enabled ? '' : ' off'}">${enabled ? 'С разделом' : 'Раздел выключен'}</span>`
            : '<span class="mnema-agent-badge">Всегда</span>';
    const connection = manual
        ? `<label class="mnema-field">Модель<input class="text_pole" type="text" data-agent-model="${agent.id}" value="${escapeHtml(own.model || '')}" placeholder="${escapeHtml(t('Как основная: {model}', { model: settings.model || '—' }))}" list="mnema_model_options" autocomplete="off"></label>`
        : `<label class="mnema-field">Подключение<select class="text_pole" data-agent-profile="${agent.id}">
            <option value="">${escapeHtml(t('Как основное'))}</option>
            ${profiles.map(profile => `<option value="${escapeHtml(profile.id)}" ${own.profileId === profile.id ? 'selected' : ''}>${escapeHtml(profile.name || profile.model || profile.id)}</option>`).join('')}
        </select></label>`;
    return `<article class="mnema-agent mnema-glass-card${enabled ? '' : ' disabled'}" data-agent="${agent.id}">
        <header><i class="fa-solid ${agent.icon}" aria-hidden="true"></i><div><strong>${escapeHtml(agent.title)}</strong><small>${escapeHtml(agent.description)}</small></div>${toggle}</header>
        ${connection}
    </article>`;
}

export function renderAgentList(settings, profiles = []) {
    const list = document.getElementById('mnema_agent_list');
    if (!list) return;
    // Перерисовка не должна выбивать фокус из поля модели, пока его правят.
    if (list.contains(document.activeElement) && document.activeElement.matches('input[type="text"]')) return;
    $('#mnema_analysis_mode').val(settings.analysisMode === 'single' ? 'single' : 'agents');
    list.innerHTML = AGENTS.map(agent => agentCard(agent, settings, profiles)).join('');
}

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
            <strong>${escapeHtml(agent?.title || entry.agent)}</strong>
            <span class="mnema-journal-meta">${entry.status === 'running' ? escapeHtml(t('работает…')) : `${seconds(entry.ms)} · ≈${entry.inTokens.toLocaleString()} → ${entry.outTokens.toLocaleString()}`}</span>
            ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ''}
        </div>`;
    }).join('') : `<p class="mnema-empty">${escapeHtml(t('Агенты ещё не запускались.'))}</p>`;
}

export function bindAgentEvents({ getSettings, saveSettings, rerender }) {
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
    $(document).on('change', '[data-agent-profile]', function () { update(this.dataset.agentProfile, { profileId: this.value }); });
    $(document).on('change', '[data-agent-model]', function () { update(this.dataset.agentModel, { model: this.value.trim() }); });
    $(document).on('click', '#mnema_journal_clear', () => clearJournal());
}
