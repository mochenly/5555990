import { getContext } from '/scripts/extensions.js';
import { getCurrentChatId } from '/script.js';
import { requestModel, parseJsonResponse } from './model-api.js';
import { participantContext } from './analysis.js';
import { buildGalleryPrompt, findGalleryEntry, galleryEnabled, gallerySceneMessages } from './gallery-data.js';
import { notify } from './utils.js';

export function createGalleryController({ getState, getSettings, images, renderGallery, onChanged, isProcessing }) {
    const expanded = new Set();
    let busy = null;
    let activeKind = 'memory';
    let viewer = null;
    const status = () => ({ busy, expanded, activeKind });
    const redraw = () => renderGallery(getState({ create: false }));

    async function reconstruct(id = null, kind = activeKind) {
        if (busy || isProcessing()) return;
        const settings = structuredClone(getSettings());
        if (!id && !galleryEnabled(settings, kind)) kind = kind === 'item' ? 'memory' : 'item';
        if (!galleryEnabled(settings, kind)) return;
        const context = getContext();
        const chatId = getCurrentChatId();
        const state = getState();
        if (!state || !context.chat?.length) return notify('Откройте чат', 'error');
        const previous = id ? findGalleryEntry(state, id) : null;
        if (id && !previous) return;
        const entry = previous ? structuredClone(previous) : { id: `gallery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, kind, title: '', summary: '', detail: '', imageUrl: '', sourceMessages: gallerySceneMessages(context.chat, settings.galleryContext) };
        kind = entry.kind;
        const key = kind === 'item' ? 'items' : 'memories';
        const current = () => getCurrentChatId() === chatId && getContext()?.chat === context.chat && getState({ create: false }) === state;
        const saveEntry = async draft => {
            if (!current()) return false;
            const existing = findGalleryEntry(state, entry.id);
            if (id && !existing) return false;
            const before = existing ? structuredClone(existing) : null;
            if (existing) Object.assign(existing, draft);
            else state.gallery[key].unshift(draft);
            try { await context.saveChat(); }
            catch (error) {
                if (before) Object.assign(findGalleryEntry(state, entry.id) || existing, before);
                else state.gallery[key] = state.gallery[key].filter(item => item.id !== entry.id);
                throw error;
            }
            onChanged();
            return true;
        };
        busy = { id: entry.id, phase: 'memory', kind };
        expanded.add(entry.id);
        redraw();
        try {
            const messages = buildGalleryPrompt({ entry, participants: participantContext(context), messages: gallerySceneMessages(context.chat, settings.galleryContext), titles: state.gallery[key].filter(item => item.id !== id).map(item => item.title) });
            const result = parseJsonResponse(await requestModel(messages, settings, 3200));
            if (!current()) return;
            if (typeof result.detail !== 'string' || !result.detail.trim() || typeof result.image_prompt !== 'string' || !result.image_prompt.trim() || (!id && !String(result.title || '').trim())) throw new Error('Модель не вернула текст воспоминания или визуальный промпт');
            const draft = { ...entry, title: id ? entry.title : String(result.title).trim().slice(0, 120), summary: String(result.summary || entry.summary || '').trim().slice(0, 1200), detail: result.detail.trim().slice(0, 20000), imagePrompt: result.image_prompt.trim().slice(0, 8000), aspectRatio: ['3:2', '4:3', '16:9', '2:3'].includes(result.aspect_ratio) ? result.aspect_ratio : '4:3', createdAt: entry.createdAt || new Date().toISOString() };
            if (images.getGalleryImageConfig()) {
                busy.phase = 'image'; redraw();
                try { draft.imageUrl = await images.requestGalleryImage(draft); }
                catch (error) {
                    if (!previous?.detail) await saveEntry({ ...draft, imageUrl: '' });
                    throw new Error(`Текст восстановлен, но изображение не создано: ${error.message}${previous?.detail ? ' Предыдущая версия сохранена.' : ' Текст сохранён — изображение можно повторить отдельно.'}`);
                }
            } else draft.imageUrl = '';
            if (await saveEntry(draft)) notify(kind === 'item' ? 'Памятный предмет готов' : 'Воспоминание раскрыто', 'success');
        } catch (error) {
            if (current()) notify(error.message || String(error), 'error');
        } finally { busy = null; redraw(); }
    }

    async function generateImage(id) {
        if (busy || isProcessing()) return;
        const context = getContext();
        const chatId = getCurrentChatId();
        const state = getState({ create: false });
        const entry = findGalleryEntry(state, id);
        if (!entry) return;
        if (!entry.imagePrompt) return reconstruct(id, entry.kind);
        busy = { id, phase: 'image', kind: entry.kind }; redraw();
        try {
            const url = await images.requestGalleryImage(structuredClone(entry));
            if (getCurrentChatId() !== chatId || getContext()?.chat !== context.chat || getState({ create: false }) !== state) return;
            const current = findGalleryEntry(state, id);
            if (!current) return;
            const oldUrl = current.imageUrl;
            current.imageUrl = url;
            try { await context.saveChat(); }
            catch (error) { (findGalleryEntry(state, id) || current).imageUrl = oldUrl; throw error; }
            notify('Изображение готово', 'success');
        } catch (error) { if (getCurrentChatId() === chatId) notify(error.message || String(error), 'error'); }
        finally { busy = null; redraw(); }
    }

    function closeViewer() { viewer?.remove(); viewer = null; }
    function openViewer(src) {
        closeViewer();
        const overlay = document.createElement('div');
        overlay.id = 'mnema_image_viewer'; overlay.className = 'fit';
        overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-label', 'Изображение воспоминания');
        const img = document.createElement('img'); img.src = src; img.alt = 'Изображение воспоминания'; img.draggable = false;
        const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Закрыть изображение');
        close.onclick = closeViewer;
        overlay.onclick = event => { if (event.target === overlay) closeViewer(); };
        img.onclick = () => overlay.classList.toggle('zoom');
        overlay.append(img, close); document.body.append(overlay); viewer = overlay; close.focus();
    }

    function bindEvents() {
        $(document).on('click', '#mnema_gallery_add', () => void reconstruct());
        $(document).on('click', '.mnema-gallery-switch button', function () {
            activeKind = this.dataset.galleryKind === 'items' ? 'item' : 'memory'; redraw();
        });
        $(document).on('click', '.mnema-gallery-toggle', function (event) {
            event.preventDefault();
            const id = this.closest('.mnema-gallery-card').dataset.galleryId;
            const entry = findGalleryEntry(getState({ create: false }), id);
            if (!entry) return;
            if (!entry.detail) { void reconstruct(id, entry.kind); return; }
            if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
            redraw();
        });
        $(document).on('click', '.mnema-gallery-image-button', function () { void generateImage(this.closest('.mnema-gallery-card').dataset.galleryId); });
        $(document).on('click', '.mnema-gallery-redo', function () {
            const id = this.closest('.mnema-gallery-card').dataset.galleryId;
            const entry = findGalleryEntry(getState({ create: false }), id);
            if (entry) void reconstruct(id, entry.kind);
        });
        $(document).on('click', '.mnema-gallery-delete', async function () {
            if (busy || isProcessing()) return;
            const state = getState({ create: false });
            const id = this.closest('.mnema-gallery-card').dataset.galleryId;
            if (!state || !globalThis.confirm('Удалить эту запись из галереи?')) return;
            for (const key of ['memories', 'items']) state.gallery[key] = state.gallery[key].filter(entry => entry.id !== id);
            expanded.delete(id); await getContext().saveChat(); onChanged(); redraw();
        });
        $(document).on('click', '.mnema-gallery-view', function () {
            const entry = findGalleryEntry(getState({ create: false }), this.closest('.mnema-gallery-card').dataset.galleryId);
            if (entry?.imageUrl) openViewer(entry.imageUrl);
        });
        $(document).on('keydown.mnemaGallery', event => { if (event.key === 'Escape' && viewer) { event.stopImmediatePropagation(); closeViewer(); } });
    }

    return { status, bindEvents, reconstruct, generateImage, reset: () => { expanded.clear(); closeViewer(); }, closeViewer };
}
