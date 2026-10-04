// Журнал отладки: всё, что Mnema сообщает о себе, в одном месте и с выгрузкой
// в файл. Консоль браузера для этого плохо годится: её мало кто открывает,
// чужие расширения пишут туда же, а после перезагрузки она пустая.
//
// Модуль ни от чего не зависит: его импортирует utils.js ради уведомлений,
// и любой импорт отсюда обратно замкнул бы круг.
const LIMIT = 500;
const DATA_LIMIT = 40000;
const PREFIX = '[Mnema]';
const entries = [];
const listeners = new Set();
let installed = false;

const stringify = value => {
    if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
};

export const debugEntries = () => entries;
export const onDebugChange = listener => { listeners.add(listener); return () => listeners.delete(listener); };

let pending = false;
function emit() {
    // Пачка записей подряд — одна перерисовка.
    if (pending) return;
    pending = true;
    setTimeout(() => {
        pending = false;
        for (const listener of listeners) { try { listener(entries); } catch { /* журнал не должен ронять сам себя */ } }
    }, 200);
}

/**
 * @param {'info'|'warn'|'error'|'notify'|'request'|'response'} level
 * @param {string} source кто пишет: модуль, агент, событие
 * @param {string} text одна строка о том, что случилось
 * @param {any} [data] подробности — разворачиваются в журнале и уходят в выгрузку
 */
export function debugLog(level, source, text, data) {
    const entry = { at: Date.now(), level, source: String(source || ''), text: String(text || '') };
    if (data !== undefined && data !== null && data !== '') {
        const full = stringify(data);
        entry.data = full.length > DATA_LIMIT ? `${full.slice(0, DATA_LIMIT)}\n… (${full.length - DATA_LIMIT} more characters cut)` : full;
    }
    entries.unshift(entry);
    if (entries.length > LIMIT) entries.length = LIMIT;
    emit();
    return entry;
}

export function clearDebugLog() {
    entries.length = 0;
    emit();
}

// Перехватываем собственные сообщения Mnema в консоли, а не переписываем
// каждый вызов: их десятки, и новые будут появляться. Чужие строки проходят
// мимо нетронутыми. Ошибки без нашего префикса ловим по файлу, из которого
// они вылетели.
export function installDebugCapture() {
    if (installed) return;
    installed = true;
    for (const [method, level] of [['log', 'info'], ['info', 'info'], ['warn', 'warn'], ['error', 'error']]) {
        const original = console[method].bind(console);
        console[method] = (...args) => {
            if (typeof args[0] === 'string' && args[0].startsWith(PREFIX)) {
                const [first, ...rest] = args;
                debugLog(level, 'console', first.slice(PREFIX.length).trim(), rest.length ? rest.map(stringify).join('\n') : undefined);
            }
            return original(...args);
        };
    }
    const ours = text => /third-party\/Mnema\//.test(String(text || ''));
    window.addEventListener('error', event => {
        if (ours(event.filename) || ours(event.error?.stack)) debugLog('error', 'window', event.message, event.error || `${event.filename}:${event.lineno}`);
    });
    window.addEventListener('unhandledrejection', event => {
        if (ours(event.reason?.stack)) debugLog('error', 'promise', event.reason?.message || String(event.reason), event.reason);
    });
}

const time = at => {
    const date = new Date(at);
    return `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.${String(date.getMilliseconds()).padStart(3, '0')}`;
};

// Выгрузка — то, что пользователь пришлёт разработчику. Ключ API туда не
// попадает ни в каком виде.
export function debugReport({ settings = {}, version = '', extra = {} } = {}) {
    const { apiKey, ...safe } = settings || {};
    const header = [
        `Mnema ${version} — debug log, ${new Date().toISOString()}`,
        `User agent: ${navigator.userAgent}`,
        `Settings: ${stringify({ ...safe, apiKey: apiKey ? '(set, hidden)' : '' })}`,
        ...Object.entries(extra).map(([key, value]) => `${key}: ${stringify(value)}`),
        '',
    ];
    const lines = [...entries].reverse().map(entry => {
        const head = `[${new Date(entry.at).toISOString()}] ${entry.level.toUpperCase()} ${entry.source}: ${entry.text}`;
        return entry.data ? `${head}\n${entry.data.split('\n').map(line => `    ${line}`).join('\n')}` : head;
    });
    return [...header, ...lines].join('\n');
}

export function downloadDebugReport(options) {
    const blob = new Blob([debugReport(options)], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `mnema-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const ICONS = { info: 'fa-circle-info', warn: 'fa-triangle-exclamation', error: 'fa-circle-xmark', notify: 'fa-bell', request: 'fa-arrow-up', response: 'fa-arrow-down' };

export function renderDebugLog() {
    const box = document.getElementById('mnema_debug_list');
    if (!box) return;
    const errors = entries.filter(entry => entry.level === 'error').length;
    const count = document.getElementById('mnema_debug_count');
    if (count) count.textContent = entries.length ? `${entries.length}${errors ? ` · ошибок: ${errors}` : ''}` : '';
    box.innerHTML = entries.length ? entries.slice(0, 150).map(entry => {
        const head = `<i class="fa-solid ${ICONS[entry.level] || 'fa-circle'}" aria-hidden="true"></i><time>${time(entry.at)}</time><b>${escape(entry.source)}</b><span>${escape(entry.text)}</span>`;
        return entry.data
            ? `<details class="mnema-debug-row ${entry.level}"><summary>${head}</summary><pre>${escape(entry.data)}</pre></details>`
            : `<div class="mnema-debug-row ${entry.level}">${head}</div>`;
    }).join('') : '<p class="mnema-empty">Журнал пуст.</p>';
}

export function debugPanelHtml() {
    return `<div class="mnema-settings-section mnema-glass-card">
        <div class="mnema-section-head"><h4>Журнал отладки</h4><span id="mnema_debug_count" class="mnema-debug-count"></span></div>
        <p class="mnema-hint">Всё, что Mnema пишет о своей работе: ошибки, предупреждения, уведомления и запросы к модели. Живёт до перезагрузки страницы. Если что-то сломалось — скачайте журнал и пришлите его вместе с описанием; ключ API в файл не попадает.</p>
        <label class="mnema-check mnema-glass-card"><input id="mnema_debug_prompts" type="checkbox"> <span><strong>Записывать промпты и ответы модели целиком</strong><small>Нужно, когда модель отвечает не то. Журнал станет большим, а в выгрузку попадёт текст вашей истории</small></span></label>
        <div class="mnema-debug-actions">
            <button id="mnema_debug_download" class="menu_button" type="button"><i class="fa-solid fa-download"></i> Скачать журнал</button>
            <button id="mnema_debug_clear" class="menu_button" type="button"><i class="fa-solid fa-broom"></i> Очистить</button>
        </div>
        <div id="mnema_debug_list" class="mnema-debug-list"></div>
    </div>`;
}
