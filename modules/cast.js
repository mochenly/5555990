import { secretKey } from './secrets.js';
import { escapeHtml } from './utils.js';
import { t } from './i18n.js';

// Второстепенные персонажи и то, что каждый из них знает. Mnema держалась на
// двух героях, и тайна, раскрытая одному встречному, становилась для модели
// известной всем: записать, кто именно её знает, было негде.
//
// Ведёт раздел Хранитель знаний. Включён он — есть и раздел; выключен — раздел
// не разбирается и не попадает в промпт, но записанное не стирается.
export const CAST_LIMIT = 30;
export const castEnabled = settings => Boolean(settings?.agents?.keeper?.enabled);
const nameKey = value => String(value || '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function normalizeMember(entry) {
    const source = typeof entry === 'string' ? { name: entry } : (entry || {});
    const name = String(source.name || '').trim().slice(0, 60);
    if (!name) return null;
    return {
        id: String(source.id || `cast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
        name,
        role: String(source.role || '').trim().slice(0, 120),
        relation: String(source.relation || '').trim().slice(0, 160),
        knows: [...new Set((Array.isArray(source.knows) ? source.knows : String(source.knows || '').split('\n'))
            .map(title => String(title || '').trim()).filter(Boolean))].slice(0, 20),
        lastSeen: Number.isInteger(source.lastSeen) ? source.lastSeen : null,
    };
}

export function normalizeCast(cast) {
    const seen = new Set();
    return (Array.isArray(cast) ? cast : []).map(normalizeMember).filter(member => {
        if (!member || seen.has(nameKey(member.name))) return false;
        seen.add(nameKey(member.name));
        return true;
    }).slice(0, CAST_LIMIT);
}

// knows хранит названия тайн, а не сами тайны: их текст живёт в разделе
// секретов, и копия здесь разошлась бы с ним при первой же правке. Названия,
// которых среди секретов нет, отбрасываем — модель не должна заводить тайны
// через этот раздел.
export function applyCastUpdates(state, updates, settings, messageIndex = null) {
    if (!castEnabled(settings) || !Array.isArray(updates)) return;
    const secrets = new Map([...state.secrets.unrevealed, ...state.secrets.revealed].map(secret => [secretKey(secret.title), secret.title]));
    const known = titles => (Array.isArray(titles) ? titles : []).map(title => secrets.get(secretKey(title))).filter(Boolean);
    const cast = normalizeCast(state.cast);
    for (const raw of updates) {
        const name = String(raw?.name || '').trim();
        if (!name) continue;
        const index = cast.findIndex(member => nameKey(member.name) === nameKey(name));
        if (/^(gone|left|dead|removed)$/i.test(String(raw?.status || '').trim())) {
            if (index >= 0) cast.splice(index, 1);
            continue;
        }
        const member = index >= 0 ? cast[index] : null;
        const patch = {
            name: member?.name || name,
            role: String(raw.role || '').trim() || member?.role || '',
            relation: String(raw.relation || '').trim() || member?.relation || '',
            // Знание не теряется само: забыть тайну человек может только по
            // сюжету, а такой случай правится руками.
            knows: [...new Set([...(member?.knows || []), ...known(raw.knows)])],
            lastSeen: Number.isInteger(messageIndex) ? messageIndex : member?.lastSeen ?? null,
        };
        if (member) Object.assign(member, normalizeMember({ ...member, ...patch }));
        else if (cast.length < CAST_LIMIT) cast.push(normalizeMember(patch));
    }
    state.cast = cast;
}

// Кто сейчас в сцене: тот, чьё имя звучит в последних сообщениях. Без этого
// фильтра в промпт уходил бы весь список, а знания тех, кого рядом нет, ответу
// не нужны.
export function presentCast(cast, recentText) {
    const text = ` ${nameKey(recentText)} `;
    if (!text.trim()) return [];
    // По основе, а не по точной форме: «Марта» в тексте бывает «Марту» и
    // «Марте», «Сайфер» — «Сайфера».
    const stem = word => word.length >= 6 ? word.slice(0, -2) : word.length >= 4 ? word.slice(0, -1) : word;
    return (cast || []).filter(member => {
        const words = nameKey(member.name).split(' ').filter(word => word.length >= 3);
        return words.some(word => text.includes(` ${stem(word)}`));
    });
}

export function renderCastPanel(state, settings) {
    const box = document.getElementById('mnema_cast_list');
    if (!box) return;
    const cast = state?.cast || [];
    $('#mnema_cast_count').text(cast.length ? String(cast.length) : '');
    $('#mnema_cast_off').prop('hidden', castEnabled(settings));
    box.innerHTML = cast.length ? cast.map(member => `<article class="mnema-cast mnema-glass-card">
        <header><i class="fa-solid fa-user" aria-hidden="true"></i><div><strong>${escapeHtml(member.name)}</strong>${member.role ? `<small>${escapeHtml(member.role)}</small>` : ''}</div></header>
        ${member.relation ? `<p>${escapeHtml(member.relation)}</p>` : ''}
        <div class="mnema-cast-knows"><span>${escapeHtml(t('Знает'))}:</span> ${member.knows.length
            ? member.knows.map(title => `<em><i class="fa-solid fa-key" aria-hidden="true"></i> ${escapeHtml(title)}</em>`).join('')
            : `<small>${escapeHtml(t('ни одной записанной тайны'))}</small>`}</div>
    </article>`).join('') : `<p class="mnema-empty">${escapeHtml(t('Второстепенных персонажей пока нет.'))}</p>`;
}

export function castPanelHtml() {
    return `<section class="mnema-tab-panel" data-mnema-panel="cast">
        <div class="mnema-tab-title"><span>✦</span> Персонажи <span id="mnema_cast_count" class="mnema-secret-count"></span></div>
        <p id="mnema_cast_off" class="mnema-hint">Раздел ведёт Хранитель знаний — включите его во вкладке «Агенты». Без него список не обновляется и не попадает в промпт.</p>
        <p class="mnema-hint">Все, кроме двух героев, и какие из записанных тайн каждый знает. Рассказчику уходят только те, кого упоминают в последних сообщениях.</p>
        <div id="mnema_cast_list" class="mnema-cast-list"></div>
    </section>`;
}
