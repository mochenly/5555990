import { ConnectionManagerRequestService } from '/scripts/extensions/shared.js';

// Базовый адрес API: и запрос генерации, и список моделей растут из него.
function apiBase(value) {
    const url = String(value || '').trim().replace(/\/+$/, '');
    if (!url) return '';
    if (/\/chat\/completions$/i.test(url)) return url.replace(/\/chat\/completions$/i, '');
    return /\/v1$/i.test(url) ? url : `${url}/v1`;
}

function normalizeApiUrl(value) {
    const base = apiBase(value);
    return base ? `${base}/chat/completions` : '';
}

function authHeaders(settings) {
    const key = String(settings.apiKey || '').trim();
    return key ? { Authorization: `Bearer ${key}` } : {};
}

// Список моделей ручного подключения: OpenAI-совместимые отдают {data:[{id}]},
// Ollama — {models:[{name}]}, некоторые прокси — просто массив строк.
export async function fetchModels(settings) {
    const base = apiBase(settings.apiUrl);
    if (!base) throw new Error('Укажите API URL');
    let response;
    try {
        response = await fetch(`${base}/models`, { headers: authHeaders(settings) });
    } catch (error) {
        if (error instanceof TypeError) throw new Error('Не удалось получить список моделей. Проверьте адрес и настройки CORS');
        throw error;
    }
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`Extra API: HTTP ${response.status}${details ? ` — ${details.slice(0, 180)}` : ''}`);
    }
    const data = await response.json();
    const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
    const ids = [...new Set(list
        .map(item => String(typeof item === 'string' ? item : item?.id || item?.name || item?.model || '').trim())
        .filter(Boolean))].sort((a, b) => a.localeCompare(b));
    if (!ids.length) throw new Error('API не вернул ни одной модели');
    return ids;
}

function extractText(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(part => part?.text || part?.content || '').join('');
    return value?.content || value?.text || '';
}

export async function requestModel(messages, settings, maxTokens = 1000) {
    if (settings.connectionMode === 'profile') {
        if (!settings.profileId) throw new Error('Выберите профиль подключения SillyTavern');
        const prompt = ConnectionManagerRequestService.constructPrompt(messages, settings.profileId);
        const result = await ConnectionManagerRequestService.sendRequest(
            settings.profileId,
            prompt,
            maxTokens,
            { stream: false, extractData: true, includePreset: false, includeInstruct: false },
        );
        const text = extractText(result);
        if (!String(text).trim()) throw new Error('Профиль вернул пустой ответ');
        return String(text).trim();
    }

    const url = normalizeApiUrl(settings.apiUrl);
    if (!url || !settings.model.trim()) throw new Error('Укажите API URL и модель');
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders(settings) },
            body: JSON.stringify({ model: settings.model.trim(), messages, max_tokens: maxTokens, stream: false }),
        });
    } catch (error) {
        if (error instanceof TypeError) throw new Error('Не удалось обратиться к Extra API. Проверьте адрес и настройки CORS');
        throw error;
    }
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`Extra API: HTTP ${response.status}${details ? ` — ${details.slice(0, 180)}` : ''}`);
    }
    const data = await response.json();
    const text = extractText(data?.choices?.[0]?.message) || extractText(data?.choices?.[0]) || data?.output_text || '';
    if (!String(text).trim()) throw new Error('Extra API вернул пустой ответ');
    return String(text).trim();
}

export function parseJsonResponse(text) {
    const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try {
        return JSON.parse(cleaned);
    } catch {
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
        throw new Error('Модель не вернула ожидаемый JSON');
    }
}


