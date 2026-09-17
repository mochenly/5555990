import { extension_settings, getContext } from '/scripts/extensions.js';
import { getCurrentChatId } from '/script.js';

// SillyImages owns provider selection, styles, references and retries.
// Mnema only supplies the scene prompt and stores the returned image.
export function createGalleryImages() {
    let controller = null;
    function getGalleryImageConfig() {
        const config = extension_settings.inline_image_gen;
        return config && config.enabled !== false ? config : null;
    }

    async function requestGalleryImage(entry) {
        if (!getGalleryImageConfig()) throw new Error('Включите генерацию изображений в SillyImages');
        const context = getContext();
        const chatId = getCurrentChatId();
        const active = () => getCurrentChatId() === chatId && getContext()?.chat === context.chat;
        const request = new AbortController();
        controller = request;
        try {
            let pipeline;
            try { pipeline = await import('../../sillyimages/src/pipeline.js'); }
            catch { throw new Error('Не удалось подключить генерацию SillyImages. Проверьте, что расширение установлено и включено.'); }
            if (!active() || request.signal.aborted) throw new Error('Чат сменился, генерация отменена');
            const generated = await pipeline.generateImageWithRetry(
                entry.imagePrompt, '', undefined,
                { aspectRatio: entry.aspectRatio || '4:3', messageId: context.chat.length - 1, signal: request.signal },
            );
            if (!active() || request.signal.aborted) throw new Error('Чат сменился, генерация отменена');
            if (typeof generated !== 'string' || !generated) throw new Error('Для галереи выберите в SillyImages модель изображений, а не видео');
            if (!generated.startsWith('data:image/')) return generated;
            const mime = generated.match(/^data:image\/([^;]+)/i)?.[1] || 'png';
            const response = await fetch('/api/images/upload', {
                method: 'POST', headers: context.getRequestHeaders(), signal: request.signal,
                body: JSON.stringify({ image: generated.slice(generated.indexOf(',') + 1), format: mime === 'jpeg' ? 'jpg' : mime, ch_name: context.name2 || 'Mnema', filename: 'mnema_gallery_' + Date.now() }),
            });
            if (!response.ok) throw new Error('Не удалось сохранить изображение: HTTP ' + response.status);
            const path = (await response.json()).path;
            if (!path) throw new Error('Сервер не вернул путь изображения');
            return path;
        } finally { if (controller === request) controller = null; }
    }

    return { requestGalleryImage, getGalleryImageConfig, cancel: () => controller?.abort() };
}
