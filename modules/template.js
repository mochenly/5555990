import { MENU_BUTTON_ID, POPUP_ID } from './config.js';
import { infoblockThemesHtml } from './infoblock-themes.js';
import { gallerySettingsHtml } from './gallery-settings.js';

export function menuHtml() {
    return `
        <div id="${MENU_BUTTON_ID}" class="list-group-item flex-container flexGap5 interactable" tabindex="0" role="button" aria-haspopup="dialog" aria-controls="${POPUP_ID}">
            <div class="fa-fw fa-solid fa-brain extensionsMenuExtensionButton"></div>
            <span>Mnema</span>
        </div>`;
}

export function popupHtml() {
    return `
        <div id="${POPUP_ID}" class="mnema-popup" hidden>
            <section class="mnema-popup-card" role="dialog" aria-modal="true" aria-labelledby="mnema_popup_title">
                <header class="mnema-popup-header">
                    <h3 id="mnema_popup_title"><span id="mnema_header_status_dot" class="mnema-header-status-dot" title=""></span> Mnema</h3>
                    <div class="mnema-header-actions">
                        <button id="mnema_analyze_now" type="button" title="Проверить новые сообщения"><i class="fa-solid fa-wand-magic-sparkles"></i><span>Проверить</span></button>
                        <button id="mnema_demo_fill" type="button" title="Временно: заполнить все разделы примерами (без сохранения)"><i class="fa-solid fa-flask"></i><span>Тест</span></button>
                        <button id="mnema_popup_close" type="button" title="Закрыть" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </header>
                <div class="mnema-widget-body">
                    <nav class="mnema-sidebar" aria-label="Разделы Mnema">
                        <div class="mnema-sidebar-label">Основное</div>
                        <button class="mnema-tab-btn active" data-mnema-tab="overview" title="Общая сводка"><span class="mnema-tab-ornament">✦</span><i class="fa-solid fa-gauge"></i><span class="mnema-tab-label">Сводка</span></button>
                        <button class="mnema-tab-btn" data-mnema-tab="memories" title="Воспоминания"><span class="mnema-tab-ornament">✦</span><i class="fa-solid fa-brain"></i><span class="mnema-tab-label">Воспоминания</span><span id="mnema_pending_badge" class="mnema-tab-badge" hidden></span></button>
                        <button class="mnema-tab-btn" data-mnema-tab="gallery" title="Галерея"><span class="mnema-tab-ornament">✦</span><i class="fa-regular fa-images"></i><span class="mnema-tab-label">Галерея</span><span id="mnema_gallery_badge" class="mnema-tab-badge" hidden></span></button>
                        <button class="mnema-tab-btn" data-mnema-tab="secrets" title="Секреты"><span class="mnema-tab-ornament">✦</span><i class="fa-solid fa-key"></i><span class="mnema-tab-label">Секреты</span></button>
                        <div class="mnema-sidebar-label">Статус</div>
                        <button class="mnema-tab-btn" data-mnema-tab="world" title="Мир"><span class="mnema-tab-ornament">✦</span><i class="fa-solid fa-earth-europe"></i><span class="mnema-tab-label">Мир</span></button>
                        <button class="mnema-tab-btn" data-mnema-tab="relationships" title="Отношения"><span class="mnema-tab-ornament">✦</span><i class="fa-solid fa-heart"></i><span class="mnema-tab-label">Отношения</span></button>
                        <button class="mnema-tab-btn" data-mnema-tab="calendar" title="Календарь"><span class="mnema-tab-ornament">✦</span><i class="fa-regular fa-calendar"></i><span class="mnema-tab-label">Календарь</span><span id="mnema_calendar_badge" class="mnema-tab-badge" hidden></span></button>
                        <button class="mnema-tab-btn" data-mnema-tab="health" title="Здоровье"><span class="mnema-tab-ornament">✦</span><i class="fa-solid fa-notes-medical"></i><span class="mnema-tab-label">Здоровье</span><span id="mnema_health_badge" class="mnema-tab-badge critical" hidden>!</span></button>
                        <div class="mnema-sidebar-label">Техническое</div>
                        <button class="mnema-tab-btn" data-mnema-tab="summaries" title="Арки"><span class="mnema-tab-ornament">✦</span><i class="fa-solid fa-book-open"></i><span class="mnema-tab-label">Арки</span><span id="mnema_arc_badge" class="mnema-tab-badge" hidden></span></button>
                        <button class="mnema-tab-btn" data-mnema-tab="manual" title="Ручной анализ"><span class="mnema-tab-ornament">✦</span><i class="fa-solid fa-scissors"></i><span class="mnema-tab-label">Ручной анализ</span></button>
                        <button class="mnema-tab-btn" data-mnema-tab="settings" title="Настройки"><span class="mnema-tab-ornament">✦</span><i class="fa-solid fa-sliders"></i><span class="mnema-tab-label">Настройки</span></button>
                    </nav>
                    <main class="mnema-popup-content">
                        <section class="mnema-tab-panel active" data-mnema-panel="overview">
                            <div class="mnema-tab-title"><span>✦</span> Общая сводка</div>
                            <div id="mnema_status_line" class="mnema-status-line"><strong id="mnema_status_text">Готово</strong></div>
                            <div id="mnema_scene_strip" class="mnema-scene-strip">
                                <div class="mnema-scene-cell" data-scene-cell="date">
                                    <small>дата</small>
                                    <strong id="mnema_scene_date">—</strong>
                                </div>
                                <div class="mnema-scene-cell" data-scene-cell="time">
                                    <small>время</small>
                                    <strong id="mnema_scene_time">—</strong>
                                    <span id="mnema_scene_time_sub"></span>
                                </div>
                                <div class="mnema-scene-cell" data-scene-cell="location">
                                    <small>локация</small>
                                    <strong id="mnema_scene_location">—</strong>
                                    <span id="mnema_scene_location_sub"></span>
                                </div>
                                <div class="mnema-scene-cell" data-scene-cell="weather">
                                    <small>погода</small>
                                    <strong id="mnema_scene_weather">—</strong>
                                </div>
                            </div>
                            <article id="mnema_overview_location" class="mnema-glass-card mnema-world-card" hidden>
                                <div class="mnema-world-head">
                                    <i class="fa-solid fa-location-dot"></i>
                                    <div><h4 id="mnema_overview_location_name">Локация не определена</h4><small id="mnema_overview_location_meta"></small></div>
                                </div>
                                <p id="mnema_overview_location_description" class="mnema-world-description"></p>
                            </article>
                            <article id="mnema_overview_relationship" class="mnema-glass-card mnema-overview-relationship" hidden>
                                <div class="mnema-overview-relationship-people">
                                    <span class="mnema-overview-avatar"><img id="mnema_overview_user_avatar" alt="" class="empty"></span>
                                    <div class="mnema-overview-relationship-mid">
                                        <strong id="mnema_overview_relationship_stage">Не определено</strong>
                                        <div class="mnema-overview-vital-track"><i id="mnema_overview_relationship_fill"></i></div>
                                        <small id="mnema_overview_relationship_value"></small>
                                    </div>
                                    <span class="mnema-overview-avatar"><img id="mnema_overview_char_avatar" alt="" class="empty"></span>
                                </div>
                            </article>
                            <article id="mnema_overview_secrets" class="mnema-glass-card mnema-overview-secrets" hidden>
                                <div><strong id="mnema_overview_secrets_revealed">0</strong><small>ваших тайн</small></div>
                                <div><strong id="mnema_overview_secrets_unrevealed">0/0</strong><small>чужих раскрыто</small></div>
                            </article>
                            <article id="mnema_overview_char" class="mnema-glass-card mnema-overview-char" hidden>
                                <div class="mnema-overview-char-head"><i class="fa-solid fa-user"></i><strong id="mnema_overview_char_name">{{char}}</strong><span id="mnema_overview_char_mood"></span></div>
                                <div class="mnema-overview-vitals">
                                    <div class="mnema-overview-vital"><small>Сытость</small><div class="mnema-overview-vital-track"><i id="mnema_overview_satiety_fill"></i></div></div>
                                    <div class="mnema-overview-vital"><small>Энергия</small><div class="mnema-overview-vital-track"><i id="mnema_overview_energy_fill"></i></div></div>
                                </div>
                            </article>
                        </section>
                        <section class="mnema-tab-panel" data-mnema-panel="world">
                            <div class="mnema-tab-title"><span>✦</span> Мир</div>
                            <article class="mnema-glass-card mnema-world-card">
                                <div class="mnema-world-head">
                                    <i class="fa-solid fa-location-dot"></i>
                                    <div><h4 id="mnema_world_location">Локация не определена</h4><small id="mnema_world_meta"></small></div>
                                </div>
                                <p id="mnema_world_description" class="mnema-world-description">Пока нет данных о месте действия.</p>
                            </article>
                        </section>
                        <section class="mnema-tab-panel" data-mnema-panel="memories">
                            <div class="mnema-tab-title"><span>✦</span> Воспоминания</div>
                            <div class="mnema-section-head"><h4>Текущая арка</h4><span id="mnema_pending_count"></span></div>
                            <div id="mnema_pending"></div>
                        </section>
                        <section class="mnema-tab-panel" data-mnema-panel="gallery">
                            <div class="mnema-tab-title"><span>✦</span> Галерея</div>
                            <div class="mnema-gallery-switch" role="tablist">
                                <button class="active" data-gallery-kind="memories" type="button"><i class="fa-solid fa-camera-retro"></i> Воспоминания <span id="mnema_gallery_memory_count">0</span></button>
                                <button data-gallery-kind="items" type="button"><i class="fa-solid fa-gem"></i> Предметы <span id="mnema_gallery_item_count">0</span></button>
                            </div>
                            <div id="mnema_gallery_memories" class="mnema-gallery-grid active" data-gallery-panel="memories"></div>
                            <div id="mnema_gallery_items" class="mnema-gallery-grid" data-gallery-panel="items"></div>
                            <button id="mnema_gallery_add" class="menu_button" type="button">+ Воспоминание из текущей сцены</button>
                        </section>
                        <section class="mnema-tab-panel" data-mnema-panel="secrets">
                            <div class="mnema-tab-title"><span>✦</span> Секреты</div>
                            <div class="mnema-secrets-layout">
                                <section class="mnema-secret-group revealed">
                                    <header class="mnema-secret-group-head">
                                        <span class="mnema-secret-icon"><i class="fa-solid fa-user"></i></span>
                                        <div><h4 id="mnema_user_secrets_title">Секреты {{user}}</h4><small>Ваши тайны — вы их и так знаете</small></div>
                                        <span id="mnema_user_secrets_count" class="mnema-secret-count">0</span>
                                        <button type="button" class="mnema-section-edit" data-mnema-focus="secrets" data-focus-owner="user" title="Придумать секреты персоны" aria-label="Придумать секреты персоны"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                                        <button type="button" class="mnema-section-edit" data-mnema-edit="secrets" data-edit-owner="user" title="Редактировать секреты персоны" aria-label="Редактировать секреты персоны"><i class="fa-solid fa-pen"></i></button>
                                    </header>
                                    <div id="mnema_user_secrets" class="mnema-secret-list"></div>
                                </section>
                                <section class="mnema-secret-group unrevealed">
                                    <header class="mnema-secret-group-head">
                                        <span class="mnema-secret-icon"><i class="fa-solid fa-mask"></i></span>
                                        <div><h4 id="mnema_char_secrets_title">Секреты {{char}}</h4><small><span id="mnema_char_secrets_progress">0 из 0 раскрыто</span></small></div>
                                        <span id="mnema_char_secrets_count" class="mnema-secret-count">0</span>
                                        <button type="button" class="mnema-section-edit" data-mnema-focus="secrets" data-focus-owner="char" title="Придумать секреты персонажа" aria-label="Придумать секреты персонажа"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                                        <button type="button" class="mnema-section-edit" data-mnema-edit="secrets" data-edit-owner="char" title="Редактировать секреты персонажа" aria-label="Редактировать секреты персонажа"><i class="fa-solid fa-pen"></i></button>
                                    </header>
                                    <div class="mnema-secret-progress"><i id="mnema_char_secrets_fill"></i></div>
                                    <div id="mnema_char_secrets" class="mnema-secret-list"></div>
                                </section>
                                <section class="mnema-secret-group unrevealed">
                                    <header class="mnema-secret-group-head">
                                        <span class="mnema-secret-icon"><i class="fa-solid fa-earth-americas"></i></span>
                                        <div><h4 id="mnema_world_secrets_title">Секреты мира</h4><small>Скрытые истины за пределами двух героев</small></div>
                                        <span id="mnema_world_secrets_count" class="mnema-secret-count">0</span>
                                        <button type="button" class="mnema-section-edit" data-mnema-focus="secrets" data-focus-owner="world" title="Придумать секреты мира" aria-label="Придумать секреты мира"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                                        <button type="button" class="mnema-section-edit" data-mnema-edit="secrets" data-edit-owner="world" title="Редактировать секреты мира" aria-label="Редактировать секреты мира"><i class="fa-solid fa-pen"></i></button>
                                    </header>

                                    <div id="mnema_world_secrets" class="mnema-secret-list"></div>
                                </section>
                            </div>
                        </section>
                        <section class="mnema-tab-panel" data-mnema-panel="relationships">
                            <div class="mnema-tab-title"><span>✦</span> Отношения</div>
                            <article class="mnema-relationship-card">
                                <div class="mnema-relationship-people">
                                    <figure><span><img id="mnema_user_avatar" alt=""></span><figcaption id="mnema_user_name">{{user}}</figcaption></figure>
                                    <div class="mnema-relationship-link"><i class="fa-solid fa-heart"></i><span></span></div>
                                    <figure><span><img id="mnema_char_avatar" alt=""></span><figcaption id="mnema_char_name">{{char}}</figcaption></figure>
                                </div>
                                <div class="mnema-relationship-stage"><small>Стадия отношений</small><strong id="mnema_relationship_stage">Не определено</strong></div>
                                <div id="mnema_relationship_phase" class="mnema-relationship-phase" hidden>
                                    <small>Ступени этой истории</small>
                                    <ol id="mnema_relationship_phase_track" class="mnema-phase-track"></ol>
                                    <p id="mnema_relationship_next" class="mnema-phase-next" hidden><i class="fa-solid fa-arrow-right-long"></i><span><b>Следующий шаг:</b> <span id="mnema_relationship_next_text"></span></span></p>
                                </div>
                                <div class="mnema-relationship-progress">
                                    <div><span>Общий прогресс</span><strong id="mnema_relationship_progress_value">0%</strong></div>
                                    <div class="mnema-relationship-track"><i id="mnema_relationship_progress_fill"></i></div>
                                </div>
                                <div id="mnema_relationship_metrics" class="mnema-relationship-metrics"></div>
                            </article>
                        </section>
                        <section class="mnema-tab-panel" data-mnema-panel="calendar">
                            <div class="mnema-tab-title"><span>✦</span> Календарь</div>
                            <div class="mnema-calendar-toolbar">
                                <button class="mnema-calendar-nav" data-calendar-shift="-1" type="button" title="Предыдущая неделя"><i class="fa-solid fa-chevron-left"></i></button>
                                <button id="mnema_calendar_today" class="mnema-calendar-period" type="button" title="Вернуться к сюжетной дате">
                                    <strong id="mnema_calendar_week_title">Дата не определена</strong>
                                    <small id="mnema_calendar_anchor">Ищу дату в диалоге</small>
                                </button>
                                <button class="mnema-calendar-nav" data-calendar-shift="1" type="button" title="Следующая неделя"><i class="fa-solid fa-chevron-right"></i></button>
                            </div>
                            <div id="mnema_calendar_week" class="mnema-calendar-week"></div>
                            <div class="mnema-calendar-lists">
                                <section class="mnema-calendar-list-block">
                                    <div class="mnema-calendar-list-title"><span><i class="fa-solid fa-cake-candles"></i> Дни рождения</span><b id="mnema_birthday_count">0</b></div>
                                    <div id="mnema_birthdays" class="mnema-calendar-items"></div>
                                </section>
                                <section class="mnema-calendar-list-block">
                                    <div class="mnema-calendar-list-title"><span><i class="fa-solid fa-clock"></i> Ближайшие планы</span><span><b id="mnema_plan_count">0</b><button type="button" class="mnema-section-edit" data-mnema-focus="plans" title="Придумать поводы пересечься" aria-label="Придумать поводы пересечься"><i class="fa-solid fa-wand-magic-sparkles"></i></button></span></div>
                                    <div id="mnema_plans" class="mnema-calendar-items"></div>
                                </section>
                            </div>
                        </section>
                        <section class="mnema-tab-panel" data-mnema-panel="health">
                            <div class="mnema-tab-title"><span>✦</span> Здоровье</div>
                            <article class="mnema-health-card">
                                <header class="mnema-health-header">
                                    <span class="mnema-health-avatar"><i class="fa-solid fa-user"></i></span>
                                    <div><small>Состояние персонажа</small><h4 id="mnema_health_name">{{char}}</h4></div>
                                    <span id="mnema_health_summary" class="mnema-health-summary">Нет данных</span>
                                </header>
                                <div class="mnema-vitals">
                                    <section class="mnema-vital" data-vital="satiety">
                                        <div class="mnema-vital-head"><span><i class="fa-solid fa-utensils"></i> Сытость</span><strong id="mnema_satiety_value">—%</strong></div>
                                        <div class="mnema-vital-pill"><i id="mnema_satiety_fill"></i></div>
                                        <small id="mnema_satiety_label">Нет данных</small>
                                    </section>
                                    <section class="mnema-vital" data-vital="energy">
                                        <div class="mnema-vital-head"><span><i class="fa-solid fa-bolt"></i> Энергия</span><strong id="mnema_energy_value">—%</strong></div>
                                        <div class="mnema-vital-pill"><i id="mnema_energy_fill"></i></div>
                                        <small id="mnema_energy_label">Нет данных</small>
                                    </section>
                                </div>
                                <section class="mnema-mood-card">
                                    <span id="mnema_mood_icon" class="mnema-mood-icon"><i class="fa-regular fa-face-meh"></i></span>
                                    <div><small>Настроение</small><strong id="mnema_mood_label">Не определено</strong></div>
                                </section>
                            </article>
                            <section id="mnema_injuries_section" class="mnema-injuries" hidden>
                                <div class="mnema-calendar-list-title"><span><i class="fa-solid fa-bandage"></i> Травмы</span><b id="mnema_injury_count">0</b></div>
                                <div id="mnema_injuries" class="mnema-injury-list"></div>
                            </section>
                        </section>
                        <section class="mnema-tab-panel" data-mnema-panel="summaries">
                            <div class="mnema-tab-title"><span>✦</span> Арки</div>
                            <div class="mnema-section-head"><h4>Завершённые арки</h4><span id="mnema_arc_count"></span></div>
                            <div id="mnema_arcs"></div>
                        </section>
                        <section class="mnema-tab-panel" data-mnema-panel="manual">
                            <div class="mnema-tab-title"><span>✦</span> Ручной анализ</div>
                            <div class="mnema-settings-section mnema-glass-card">
                                <h4>Выбранные сообщения</h4>
                                <label class="mnema-field">Номера сообщений<input id="mnema_manual_range" class="text_pole" type="text" placeholder="12-40 или 12,15,18" autocomplete="off"></label>
                                <p class="mnema-image-model-note"><i class="fa-solid fa-circle-info"></i> <span id="mnema_manual_hint"></span></p>
                                <p class="mnema-manual-note">Все выбранные сообщения отправляются одним запросом с их номерами. Модель сама разделит их на арки.</p>
                                <button id="mnema_manual_run" class="menu_button" type="button"><i class="fa-solid fa-wand-magic-sparkles"></i> Свести в арки</button>
                            </div>
                            <div class="mnema-settings-section mnema-glass-card">
                                <h4>Весь чат</h4>
                                <p class="mnema-manual-note">Вся переписка отправляется одним запросом с номерами сообщений. Модель сама выделит арки, оставит незавершённую арку открытой и пересчитает память. Старые данные заменяются только после успешного ответа.</p>
                                <button id="mnema_manual_full" class="menu_button" type="button"><i class="fa-solid fa-bars-staggered"></i> Анализ всего чата</button>
                            </div>
                            <div id="mnema_manual_progress" class="mnema-manual-progress mnema-glass-card" hidden>
                                <div class="mnema-manual-progress-head">
                                    <strong id="mnema_manual_progress_text">Анализ…</strong>
                                    <button id="mnema_manual_stop" type="button"><i class="fa-solid fa-stop"></i> Остановить</button>
                                </div>
                                <div class="mnema-manual-progress-track"><i id="mnema_manual_progress_fill"></i></div>
                            </div>
                        </section>
                        <section id="mnema_settings" class="mnema-tab-panel" data-mnema-panel="settings">
                            <div class="mnema-tab-title"><span>✦</span> Настройки</div>
                            <div class="mnema-settings-section">
                                <h4>Расширение</h4>
                                <label class="mnema-check mnema-glass-card"><input id="mnema_enabled" type="checkbox"> <span><strong>Mnema включена</strong><small>Выключение просто останавливает анализ — попап и настройки остаются доступны</small></span></label>
                                <div class="mnema-field-row">
                                    <label class="mnema-field">Проверять каждые N сообщений<input id="mnema_interval" class="text_pole" type="number" min="1" max="100"></label>
                                    <label class="mnema-field">Максимум сообщений в арке<input id="mnema_arc_max_messages" class="text_pole" type="number" min="0" max="500" placeholder="0 — без предела"></label>
                                    <label class="mnema-field">Максимум токенов в арке<input id="mnema_arc_max_tokens" class="text_pole" type="number" min="0" max="200000" step="500" placeholder="0 — без предела"></label>
                                </div>
                                <p class="mnema-hint">Обычно арку закрывает модель, когда сюжет пришёл к развязке. Лимиты — страховка от бесконечной арки: как только накопленные сообщения превышают предел, Mnema закрывает её сама на ближайшем анализе. 0 отключает ограничение.</p>
                                <label class="mnema-check mnema-glass-card"><input id="mnema_infoblock" type="checkbox"> <span><strong>Режим «инфоблок»</strong><small>Основная модель дописывает метку сцены, Mnema превращает её в плашку под сообщением и вырезает метку из контекста</small></span></label>
                            </div>
                            <div class="mnema-settings-section">
                                <button id="mnema_sections_toggle" type="button" class="mnema-section-disclosure" data-mnema-disclosure="mnema_sections_body" aria-expanded="false" aria-controls="mnema_sections_body"><span>Разделы</span><i class="fa-solid fa-chevron-down"></i></button>
                                <div id="mnema_sections_body" class="mnema-toggle-grid mnema-disclosure-body" hidden>
                                    <label class="mnema-check mnema-glass-card"><input id="mnema_track_relationships" type="checkbox"> <span><strong>Отношения</strong><small>Обновлять стадию и шкалы для {{char}} и {{user}}</small></span></label>
                                    <label class="mnema-check mnema-glass-card"><input id="mnema_track_calendar" type="checkbox"> <span><strong>Календарь</strong><small>Отслеживать сюжетную дату, дни рождения и планы</small></span></label>
                                    <label class="mnema-check mnema-glass-card"><input id="mnema_track_health" type="checkbox"> <span><strong>Здоровье</strong><small>Сытость, энергия, настроение и травмы</small></span></label>
                                    <label class="mnema-check mnema-glass-card"><input id="mnema_track_secrets" type="checkbox"> <span><strong>Секреты</strong><small>Раскрытые и нераскрытые сюжетные секреты</small></span></label>
                                    <label class="mnema-check mnema-glass-card"><input id="mnema_collect_gallery" type="checkbox"> <span><strong>Галерея</strong><small>Собирать важные воспоминания и памятные предметы</small></span></label>
                                </div>
                            </div>
                            <div class="mnema-settings-section mnema-glass-card">
                                <h4>Лимиты секретов</h4>
                                <p>Максимум на категорию, включая раскрытые. 0 запрещает новые записи. Уже сохранённые секреты не удаляются.</p>
                                <div class="mnema-field-row">
                                    <label class="mnema-field">Персона<input id="mnema_secret_limit_user" data-secret-limit="user" class="text_pole" type="number" min="0" max="100" step="1"></label>
                                    <label class="mnema-field">Персонаж<input id="mnema_secret_limit_char" data-secret-limit="char" class="text_pole" type="number" min="0" max="100" step="1"></label>
                                    <label class="mnema-field">Мир<input id="mnema_secret_limit_world" data-secret-limit="world" class="text_pole" type="number" min="0" max="100" step="1"></label>
                                </div>
                            </div>
                            ${infoblockThemesHtml()}
                            ${gallerySettingsHtml()}
                            <div class="mnema-settings-section mnema-glass-card">
                                <h4>Подключение</h4>
                                <label class="mnema-field">Режим подключения<select id="mnema_connection_mode" class="text_pole"><option value="profile">Профиль SillyTavern</option><option value="manual">Extra API вручную</option></select></label>
                                <div id="mnema_profile_fields"><label class="mnema-field">Профиль подключения<select id="mnema_profile" class="text_pole"></select></label></div>
                                <div id="mnema_manual_fields" class="mnema-field-row">
                                    <label class="mnema-field">API URL<input id="mnema_api_url" class="text_pole" type="text" placeholder="http://localhost:1234/v1"></label>
                                    <label class="mnema-field">API key<input id="mnema_api_key" class="text_pole" type="password" autocomplete="off"></label>
                                    <label class="mnema-field">Модель
                                        <span class="mnema-field-inline">
                                            <input id="mnema_model" class="text_pole" type="text" list="mnema_model_options" placeholder="model-name" autocomplete="off">
                                            <button id="mnema_model_refresh" class="menu_button mnema-inline-button" type="button" title="Обновить список моделей"><i class="fa-solid fa-rotate"></i></button>
                                        </span>
                                        <datalist id="mnema_model_options"></datalist>
                                    </label>
                                </div>
                                <button id="mnema_test_connection" class="menu_button" type="button"><i class="fa-solid fa-plug"></i> Проверить подключение</button>
                            </div>
                        </section>
                    </main>
                </div>
            </section>
        </div>`;
}

function placeholderTab(id, title, icon) {
    return `<section class="mnema-tab-panel" data-mnema-panel="${id}">
        <div class="mnema-tab-title"><span>✦</span> ${title}</div>
        <div class="mnema-placeholder mnema-glass-card"><i class="fa-solid ${icon}"></i><p>Раздел готов к настройке.</p></div>
    </section>`;
}
