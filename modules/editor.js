import { SECRET_OWNERS, secretLimit, secretCount, sameSecret } from './secrets.js';
import { getContext } from '/scripts/extensions.js';
import { arcMessageText } from './arc-summary.js';
import { normalizeState } from './state.js';
import { escapeHtml, notify, resolveSurfaceColor } from './utils.js';

const field = (key, label, type = 'text', options = null) => ({ key, label, type, options });
const SECTIONS = {
    world: { title: 'Мир и одежда', fields: [field('location', 'Локация'), field('description', 'Описание локации', 'textarea'), field('clock', 'Время', 'time'), field('indoor', 'Обстановка', 'select', [['', 'Неизвестно'], ['true', 'Внутри'], ['false', 'Снаружи']]), field('weather', 'Погода'), field('temperature', 'Температура, °C', 'number'), field('characterOutfit', 'Одежда персонажа', 'textarea'), field('userOutfit', 'Одежда персоны', 'textarea')] },
    relationship: {
        title: 'Отношения',
        // Список ступеней редактируется как обычный список записей, а текущая
        // ступень — выбор из него же, поэтому варианты собираются из черновика.
        fields: [field('phase', 'Текущая ступень', 'select', draft => [['', 'Не определена'], ...(draft.ladder || []).map(rung => [rung.id, rung.title])]), field('nextStep', 'Следующий шаг в отношениях', 'textarea'), field('stage', 'Стадия отношений'), field('behavior', 'Как отношение влияет на поведение', 'textarea'), ...['progress', 'trust', 'passion', 'devotion', 'attachment'].map((key, i) => field(key, ['Прогресс', 'Доверие', 'Страсть', 'Преданность', 'Привязанность'][i] + ', 0–100', 'percent'))],
        lists: [{ key: 'ladder', title: 'Ступени этой истории', fields: [field('title', 'Название ступени'), field('note', 'Что должно произойти', 'textarea')] }],
    },
    health: { title: 'Здоровье', fields: [field('satiety.value', 'Сытость, 0–100', 'percent'), field('satiety.label', 'Описание сытости'), field('energy.value', 'Энергия, 0–100', 'percent'), field('energy.label', 'Описание энергии'), field('mood.label', 'Настроение'), field('mood.tone', 'Тон настроения', 'select', [['', 'Не указан'], ['positive', 'Положительный'], ['neutral', 'Нейтральный'], ['negative', 'Отрицательный']])], lists: [{ key: 'injuries', title: 'Травмы и состояния', fields: [field('name', 'Название'), field('severity', 'Тяжесть', 'select', [['minor', 'Лёгкая'], ['moderate', 'Средняя'], ['severe', 'Тяжёлая']]), field('details', 'Симптомы, ограничения, лечение', 'textarea')] }] },
    calendar: { title: 'Календарь', fields: [field('currentDate', 'Сюжетная дата', 'date')], lists: [{ key: 'plans', title: 'Планы', fields: [field('title', 'Название'), field('kind', 'Род записи', 'select', [['personal', 'Личный план героев'], ['world', 'Событие мира']]), field('date', 'Дата', 'date'), field('time', 'Время', 'time'), field('details', 'Подробности', 'textarea')] }, { key: 'birthdays', title: 'Дни рождения', fields: [field('person', 'Имя'), field('monthDay', 'Месяц-день, например 03-08'), field('note', 'Заметка', 'textarea')] }] },
    secrets: { title: 'Секреты', lists: [{ key: 'entries', title: 'Секреты', fields: [field('title', 'Название'), field('summary', 'Содержание и кто знает', 'textarea'), field('owner', 'Чей секрет', 'select', [['char', 'Персонажа'], ['user', 'Персоны'], ['world', 'Мира']]), field('revealed', 'Статус', 'select', [['false', 'Не раскрыт'], ['true', 'Раскрыт']])] }] },
    gallery: { title: 'Галерея', lists: ['memories', 'items'].map(key => ({ key, title: key === 'items' ? 'Предметы' : 'Воспоминания', fields: [field('title', 'Название'), field('summary', 'Факт для памяти', 'textarea'), field('detail', 'Личное воспоминание', 'textarea'), field('imagePrompt', 'Визуальный промпт', 'textarea'), field('aspectRatio', 'Пропорции'), field('imageUrl', 'Путь или URL изображения')] })) },
    pending: { title: 'Заметки текущей арки', lists: [{ key: 'eventNotes', title: 'Конспекты интервалов', fixed: true, fields: [field('summary', 'Конспект', 'textarea'), field('arcReason', 'Причина завершения', 'textarea')] }] },
    arcs: { title: 'Арки', lists: [{ key: 'entries', title: 'Сводки арок', fixed: true, fields: [field('title', 'Название'), field('summary', 'Конспект', 'textarea')] }] },
};
const TAB_SECTIONS = { world: 'world', relationships: 'relationship', health: 'health', calendar: 'calendar', secrets: 'secrets', gallery: 'gallery', memories: 'pending', summaries: 'arcs' };
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
function set(object, path, value) {
    const keys = path.split('.');
    let parent = object;
    for (const key of keys.slice(0, -1)) { parent[key] ??= {}; parent = parent[key]; }
    parent[keys.at(-1)] = value;
}

export function createSectionEditor({ getSettings, getState, isBusy, onSaved }) {
    let dialog;
    let session;
    const close = () => { dialog?.close(); dialog?.remove(); dialog = null; session = null; };
    function inputHtml(def, value, list = '', index = '') {
        const attrs = `data-edit-key="${def.key}" data-edit-list="${list}" data-edit-index="${index}"`;
        const text = value === null || value === undefined ? '' : String(value);
        let control;
        if (def.type === 'textarea') control = `<textarea class="text_pole" rows="4" ${attrs}>${escapeHtml(text)}</textarea>`;
        else if (def.type === 'select') {
            const options = typeof def.options === 'function' ? def.options(session.draft) : def.options;
            control = `<select class="text_pole" ${attrs}>${options.map(([key, label]) => `<option value="${key}" ${text === key ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>`;
        }
        else control = `<input class="text_pole" type="${def.type === 'percent' ? 'number' : def.type}" ${def.type === 'percent' ? 'min="0" max="100"' : ''} ${attrs} value="${escapeHtml(text)}">`;
        return `<label class="mnema-edit-field">${def.label}${control}</label>`;
    }
    function renderList(list) {
        const { section, draft, owner, expanded } = session;
        const compact = ['arcs', 'pending', 'secrets', 'calendar'].includes(section);
        const rows = (draft[list.key] || []).map((item, index) => {
            if (section === 'secrets' && (item.owner || 'char') !== owner) return '';
            const token = list.key + ':' + index;
            const title = item.title || item.person || (section === 'pending' ? 'Конспект #' + (item.range?.[0] ?? index + 1) + '–' + (item.range?.[1] ?? index + 1) : list.key === 'plans' ? 'Новый план' : list.key === 'birthdays' ? 'Новый день рождения' : 'Новая запись');
            const preview = section === 'calendar'
                ? list.key === 'birthdays'
                    ? (item.monthDay ? item.monthDay.split('-').reverse().join('.') : 'Дата не указана')
                    : [item.date ? item.date.split('-').reverse().join('.') : 'Без даты', item.time].filter(Boolean).join(' · ')
                : String(item.summary || '').replace(/\s+/g, ' ').slice(0, 100);
            const fields = list.fields.filter(def => section !== 'secrets' || def.key !== 'owner');
            const body = fields.map(def => inputHtml(def, get(item, def.key), list.key, index)).join('')
                + (list.fixed ? '' : `<button class="menu_button" type="button" data-edit-remove="${list.key}" data-index="${index}">Удалить запись</button>`);
            return compact
                ? `<details class="mnema-edit-row mnema-edit-card" data-edit-card="${token}" ${expanded.has(token) ? 'open' : ''}><summary><strong>${escapeHtml(title)}</strong><small>${section === 'secrets' ? (item.revealed ? 'Раскрыт' : 'Не раскрыт') : escapeHtml(preview)}</small><i class="fa-solid fa-chevron-down"></i></summary><div class="mnema-edit-card-body">${body}</div></details>`
                : `<article class="mnema-edit-row">${body}</article>`;
        }).join('');
        return `<section><h4>${list.title}</h4>${rows || '<p>Записей пока нет.</p>'}${list.fixed ? '' : `<button class="menu_button" type="button" data-edit-add="${list.key}">Добавить запись</button>`}</section>`;
    }
    function render() {
        const { section, draft, owner, context } = session;
        const definition = SECTIONS[section];
        const ownerSelector = section === 'secrets' ? `<label class="mnema-edit-field">Чьи секреты<select class="text_pole" id="mnema_edit_owner"><option value="user" ${owner === 'user' ? 'selected' : ''}>${escapeHtml(context.name1 || 'Персона')}</option><option value="char" ${owner === 'char' ? 'selected' : ''}>${escapeHtml(context.name2 || 'Персонаж')}</option><option value="world" ${owner === 'world' ? 'selected' : ''}>Мир</option></select></label>` : '';
        dialog.innerHTML = `<form method="dialog"><header><h3>Редактировать: ${definition.title}</h3><button type="button" data-edit-close aria-label="Закрыть">×</button></header><p>Изменения сохранятся после нажатия «Сохранить».</p><label class="mnema-edit-field">Раздел<select class="text_pole" id="mnema_edit_section">${Object.entries(SECTIONS).map(([key, value]) => `<option value="${key}" ${key === section ? 'selected' : ''}>${value.title}</option>`).join('')}</select></label>${ownerSelector}<div class="mnema-edit-fields">${(definition.fields || []).map(def => inputHtml(def, get(draft, def.key))).join('')}</div>${(definition.lists || []).map(renderList).join('')}<footer><button class="menu_button" type="button" data-edit-close>Отмена</button><button class="menu_button" type="submit">Сохранить</button></footer></form>`;
    }
    function collect() {
        const definition = SECTIONS[session.section];
        dialog.querySelectorAll('[data-edit-key]').forEach(input => {
            const list = input.dataset.editList;
            const def = (list ? definition.lists.find(item => item.key === list).fields : definition.fields).find(item => item.key === input.dataset.editKey);
            let value = input.value.trim();
            if (def.type === 'number' || def.type === 'percent') value = value === '' ? null : Number(value);
            if (def.key === 'indoor' || def.key === 'revealed') value = value === '' ? null : value === 'true';
            if (def.type === 'date' && !value) value = null;
            set(list ? session.draft[list][Number(input.dataset.editIndex)] : session.draft, def.key, value);
        });
    }
    function select(section, target = {}) {
        const state = session.state;
        session.section = section;
        session.original = JSON.stringify(state[section]);
        session.draft = structuredClone(section === 'arcs' ? { entries: state.arcs } : section === 'secrets' ? { entries: [...state.secrets.unrevealed.map(item => ({ ...item, revealed: false })), ...state.secrets.revealed.map(item => ({ ...item, revealed: true }))] } : state[section]);
        session.dirty = false;
        session.owner = SECRET_OWNERS.includes(target.owner) ? target.owner : 'user';
        session.expanded = new Set();
        if (section === 'arcs' && target.id) {
            const index = session.draft.entries.findIndex(item => item.id === target.id);
            if (index >= 0) session.expanded.add(`entries:${index}`);
        }
        if (section === 'pending' && Number.isInteger(target.index)) session.expanded.add(`eventNotes:${target.index}`);
        render();
    }
    async function save(event) {
        event.preventDefault();
        if (isBusy()) return notify('Дождитесь завершения анализа или генерации', 'info');
        const { state, context, section, original } = session;
        if (getContext()?.chat !== context.chat || getState({ create: false }) !== state) { close(); return notify('Чат сменился, изменения не сохранены', 'info'); }
        if (JSON.stringify(state[section]) !== original) return notify('Раздел обновился во время редактирования. Откройте редактор заново, чтобы не затереть новые данные.', 'info');
        collect();
        const draft = session.draft;
        let value = draft;
        if (section === 'secrets') value = { revealed: draft.entries.filter(item => item.revealed).map(({ revealed, ...item }) => item), unrevealed: draft.entries.filter(item => !item.revealed).map(({ revealed, ...item }) => item) };
        if (section === 'secrets') {
            for (const owner of SECRET_OWNERS) {
                if (secretCount({ secrets: value }, owner) > Math.max(secretLimit(getSettings(), owner), secretCount(state, owner))) return notify('Достигнут лимит секретов в этой категории', 'info');
            }
            const entries = [...value.revealed, ...value.unrevealed];
            const oldEntries = [...state.secrets.revealed, ...state.secrets.unrevealed];
            for (let i = 0; i < entries.length; i++) {
                if (oldEntries.some(old => JSON.stringify(old) === JSON.stringify(entries[i]))) continue;
                if (entries[i].title.length > 60 || entries[i].summary.length > 180) return notify('Сократите секрет: название до 60, содержание до 180 символов', 'info');
                if (entries.some((other, j) => i !== j && sameSecret(entries[i], other))) return notify('Такой секрет уже есть', 'info');
            }
        }
        if (section === 'arcs') value = draft.entries;
        if (section === 'world' || section === 'relationship') value.updatedAt = new Date().toISOString();
        // Правка руками — самый свежий источник времени: помечаем её концом
        // чата, иначе отставший анализ перебьёт только что выставленные часы.
        if (section === 'world') value.clockIndex = Math.max(0, context.chat.length - 1);
        if (section === 'relationship') value.trends = {};
        if (section === 'health') {
            for (const key of ['satiety', 'energy']) if (value[key]?.value === null) value[key] = null;
            if (!value.mood?.label) value.mood = null;
        }
        for (const list of SECTIONS[section].lists || []) {
            for (const item of draft[list.key] || []) {
                const required = list.fields[0].key;
                if (!String(item[required] || '').trim()) return notify(`Заполните поле «${list.fields[0].label}» или удалите пустую запись`, 'error');
                if (list.key === 'birthdays' && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(item.monthDay || '')) return notify('День рождения: укажите месяц-день, например 03-08', 'error');
            }
        }
        const normalized = normalizeState({ ...structuredClone(state), [section]: value }, context.chat)[section];
        const before = state[section];
        const changedMessages = [];
        state[section] = normalized;
        if (section === 'arcs') for (const arc of state.arcs) {
            const index = context.chat.findIndex(message => message.extra?.mnema_arc_id === arc.id);
            if (index < 0) continue;
            changedMessages.push({ index, text: context.chat[index].mes });
            // Общий сборщик, а не своя строка: иначе правка заголовка тихо
            // стирала бы перечень, про который редактор ничего не знает.
            context.chat[index].mes = arcMessageText(arc);
        }
        dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
        try {
            await context.saveChat();
            close();
            if (getContext()?.chat === context.chat) {
                for (const { index } of changedMessages) context.updateMessageBlock?.(index, context.chat[index]);
                onSaved(section);
            }
            notify('Изменения сохранены', 'success');
        } catch (error) {
            state[section] = before;
            for (const { index, text } of changedMessages) context.chat[index].mes = text;
            dialog?.querySelectorAll('button').forEach(button => { button.disabled = false; });
            notify(error.message || String(error), 'error');
        }
    }
    function open(section = 'world', target = {}) {
        if (isBusy()) return notify('Дождитесь завершения анализа или генерации', 'info');
        const state = getState();
        if (!state) return notify('Откройте чат', 'info');
        close();
        session = { state, context: getContext() };
        dialog = document.createElement('dialog'); dialog.id = 'mnema_section_editor';
        // Диалог живёт в body, а не внутри окна Мнемы, поэтому сплошной фон
        // считает себе сам: править текст сквозь просвечивающий чат тяжелее
        // всего, а редактор открывается и из плашки под сообщением, когда окно
        // Мнемы даже не открывали.
        dialog.style.setProperty('--mnema-surface', resolveSurfaceColor(getComputedStyle(document.body)));
        document.body.append(dialog);
        select(SECTIONS[section] ? section : 'world', target);
        dialog.addEventListener('submit', save);
        dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
        dialog.addEventListener('keydown', event => event.stopPropagation());
        dialog.addEventListener('input', event => { if (event.target.id !== 'mnema_edit_section') session.dirty = true; });
        dialog.addEventListener('change', event => {
            if (event.target.id === 'mnema_edit_owner') {
                collect(); session.owner = event.target.value; render(); return;
            }
            if (event.target.id !== 'mnema_edit_section') return;
            if (session.dirty && !globalThis.confirm('Перейти в другой раздел без сохранения правок?')) { event.target.value = session.section; return; }
            select(event.target.value);
        });
        dialog.addEventListener('toggle', event => {
            const key = event.target.dataset?.editCard;
            if (!key || !session || !dialog?.contains(event.target)) return;
            if (event.target.open) session.expanded.add(key); else session.expanded.delete(key);
        }, true);
        dialog.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (!button) return;
            if (button.hasAttribute('data-edit-close')) return close();
            if (button.dataset.editAdd) {
                collect();
                const key = button.dataset.editAdd;
                const item = { id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` };
                if (session.section === 'gallery') item.kind = key === 'items' ? 'item' : 'memory';
                if (session.section === 'secrets') { item.owner = session.owner; item.revealed = false; }
                session.expanded.add(`${key}:${session.draft[key].length}`);
                session.draft[key].push(item); session.dirty = true; render();
            }
            if (button.dataset.editRemove) { collect(); session.draft[button.dataset.editRemove].splice(Number(button.dataset.index), 1); session.expanded.clear(); session.dirty = true; render(); }
        });
        dialog.showModal();
        dialog.querySelector('details[open]')?.scrollIntoView({ block: 'nearest' });
    }
    function bindEvents() {
        for (const [tab, section] of Object.entries(TAB_SECTIONS)) {
            $(`.mnema-tab-panel[data-mnema-panel="${tab}"] > .mnema-tab-title`).append(`<button type="button" class="mnema-section-edit" data-mnema-edit="${section}" title="Редактировать раздел" aria-label="Редактировать раздел"><i class="fa-solid fa-pen"></i></button>`);
        }
        $(document).on('click', '[data-mnema-edit]', function (event) {
            event.stopPropagation();
            open(this.dataset.mnemaEdit, { owner: this.dataset.editOwner, id: this.dataset.editId, index: this.dataset.editNote !== undefined ? Number(this.dataset.editNote) : undefined });
        });
    }
    return { open, close, bindEvents };
}
