export function gallerySettingsHtml() {
    return `<div class="mnema-settings-section" id="mnema_gallery_settings">
        <button type="button" class="mnema-section-disclosure" data-mnema-disclosure="mnema_gallery_settings_body" aria-expanded="false" aria-controls="mnema_gallery_settings_body"><span>Галерея · воспоминания и предметы</span><i class="fa-solid fa-chevron-down"></i></button>
        <div id="mnema_gallery_settings_body" class="mnema-disclosure-body mnema-glass-card" hidden>
            <label class="mnema-check"><input type="checkbox" data-gallery-setting="galleryMemoriesEnabled"> Воспоминания</label>
            <label class="mnema-field">Сбор воспоминаний<select class="text_pole" data-gallery-setting="galleryMemoryMode"><option value="auto">Автоматически</option><option value="manual">Только вручную</option></select></label>
            <label class="mnema-check"><input type="checkbox" data-gallery-setting="galleryKeepsakesEnabled"> Памятные предметы</label>
            <label class="mnema-field">Сбор предметов<select class="text_pole" data-gallery-setting="galleryKeepsakeMode"><option value="auto">Автоматически</option><option value="manual">Только вручную</option></select></label>
            <label class="mnema-field">Сообщений для воспоминания из текущей сцены<input class="text_pole" type="number" min="1" max="200" data-gallery-setting="galleryContext"></label>
            <p class="mnema-manual-note">Нажми на карточку, чтобы раскрыть воспоминание от лица персонажа. Текст создаётся через подключение Mnema. Изображения используют текущие настройки SillyImages, включая модель и референсы.</p>
        </div>
    </div>`;
}

export function createGallerySettings({ getSettings, saveSettings, onChanged }) {
    function sync() {
        const settings = getSettings();
        $('[data-gallery-setting]').each(function () {
            const value = settings[this.dataset.gallerySetting];
            if (this.type === 'checkbox') this.checked = Boolean(value); else this.value = value ?? '';
        });
    }
    function bindEvents() {
        $(document).on('change', '[data-gallery-setting]', function () {
            getSettings()[this.dataset.gallerySetting] = this.type === 'checkbox' ? this.checked
                : this.type === 'number' ? Math.max(1, Math.min(200, Number(this.value) || 12)) : this.value;
            saveSettings(); sync(); onChanged();
        });
    }
    return { sync, bindEvents };
}
