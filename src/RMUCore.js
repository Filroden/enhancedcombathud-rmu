/**
 * Contains shared utilities, core Argon integration points, UI guards,
 * and the general reusable search logic used by multiple panels.
 * This file also defines and attaches global utilities (ICONS, RMUUtils, etc.)
 * to the window object.
 */

import { RMUData } from "./RMUData.js";

// -----------------------------------------------------------------------------
// I. Constants & Icon Definitions
// -----------------------------------------------------------------------------

const MODULE_ID = "enhancedcombathud-rmu";

/**
 * Route helper for module icons.
 */
const MOD_ICON = (file) => (foundry?.utils?.getRoute ? foundry.utils.getRoute(`modules/${MODULE_ID}/icons/${file}`) : `modules/${MODULE_ID}/icons/${file}`);

/**
 * Configuration map for all user-customizable icons.
 */
const ICON_CONFIG = {
    // --- MAIN HUD ICONS ---
    melee: { name: "Melee Attack", default: MOD_ICON("sword-brandish.svg") },
    ranged: { name: "Ranged Attack", default: MOD_ICON("high-shot.svg") },
    natural: { name: "Natural Attack", default: MOD_ICON("fist.svg") },
    shield: { name: "Shield Attack", default: MOD_ICON("vibrating-shield.svg") },
    skills: { name: "Skills Category", default: MOD_ICON("skills.svg") },
    skills_muted: { name: "Skill Action (Muted)", default: MOD_ICON("skills-muted.svg") },
    spells: { name: "Spells Category", default: MOD_ICON("spell-book.svg") },
    spells_muted: { name: "Spell Action (Muted)", default: MOD_ICON("spell-book-muted.svg") },
    items: { name: "Items Category", default: MOD_ICON("ring.svg") },
    combat: { name: "End Turn (Combat)", default: MOD_ICON("skip-next-circle.svg") },
    rest: { name: "Rest Action", default: MOD_ICON("rest.svg") },
    special: { name: "Special Checks", default: MOD_ICON("hazard-sign.svg") },
    endurance: { name: "Endurance Check", default: MOD_ICON("mountain-climbing.svg") },
    concentration: { name: "Concentration Check", default: MOD_ICON("meditation.svg") },
    star: { name: "Favorite Star", default: MOD_ICON("star.svg") },
    instant: { name: "Instantaneous Asterisk", default: MOD_ICON("asterisk.svg") },
    subconscious: { name: "Sub-conscious Indicator", default: MOD_ICON("airline_seat_flat.svg") },
    close: { name: "Close/Clear", default: MOD_ICON("clear-text.svg") },
    search: { name: "Search Magnifier", default: MOD_ICON("search.svg") },
    beam: { name: "Directed Attack Beam", default: MOD_ICON("ringed-beam.svg") },
    scroll: { name: "Scroll/Item", default: MOD_ICON("scroll-unfurled.svg") },
    explosion: { name: "Area Attack Explosion", default: MOD_ICON("bright-explosion.svg") },
    equip_closed: { name: "Equipped Shield", default: MOD_ICON("back_hand_closed.svg") },
    equip_open: { name: "Unequipped Shield", default: MOD_ICON("back_hand_open.svg") },
    ranked: { name: "Ranked Skill Chip", default: MOD_ICON("voting_chip.svg") },
    panel: { name: "Generic Panel", default: MOD_ICON("resistance-panel.svg") },

    // --- RESISTANCE ICONS ---
    Channeling: { name: "Resist: Channeling", default: MOD_ICON("resistance-channeling.svg") },
    Essence: { name: "Resist: Essence", default: MOD_ICON("resistance-essence.svg") },
    Mentalism: { name: "Resist: Mentalism", default: MOD_ICON("resistance-mentalism.svg") },
    Physical: { name: "Resist: Physical", default: MOD_ICON("resistance-physical.svg") },
    Fear: { name: "Resist: Fear", default: MOD_ICON("resistance-fear.svg") },
};

/**
 * Global ICONS object using dynamic getters.
 * This ensures backwards compatibility with existing code (e.g., `ICONS.melee`)
 * while pulling live user settings.
 */
const ICONS = {};
for (const key of Object.keys(ICON_CONFIG)) {
    Object.defineProperty(ICONS, key, {
        get: () => game.settings.get(MODULE_ID, `icon_main_${key}`),
        enumerable: true,
    });
}

/**
 * Safely retrieves a custom icon path defined by the user.
 * @param {string} name - The exact name of the spell or skill.
 */
function getUserIcon(name) {
    if (!name) return null;
    try {
        const icons = game.settings.get(MODULE_ID, "custom_user_icons") || {};
        return icons[name] || null;
    } catch (e) {
        return null;
    }
}

/**
 * Modern ApplicationV2 Settings Menu for Custom Icons.
 */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class RMUCustomIconsMenu extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options) {
        super(options);
        const savedIcons = game.settings.get(MODULE_ID, "custom_user_icons") || {};
        this.iconRows = Object.entries(savedIcons).map(([name, path]) => ({
            id: foundry.utils.randomID(),
            name,
            path,
        }));
    }

    static DEFAULT_OPTIONS = {
        id: "rmu-custom-icons",
        window: {
            title: "Custom Spell & Skill Icons",
            icon: "fas fa-images",
            resizable: true,
        },
        position: { width: 550, height: "auto" },
        actions: {
            addRow: RMUCustomIconsMenu._onAddRow,
            deleteRow: RMUCustomIconsMenu._onDeleteRow,
            pickFile: RMUCustomIconsMenu._onPickFile,
            cancel: RMUCustomIconsMenu._onCancel,
            save: RMUCustomIconsMenu._onSave,
        },
    };

    static PARTS = {
        form: {
            template: "modules/enhancedcombathud-rmu/templates/rmu-custom-icons.hbs",
        },
    };

    async _prepareContext(options) {
        return {
            icons: this.iconRows,
        };
    }

    _syncState() {
        if (!this.element) return;
        const form = this.element.querySelector("form");
        if (!form) return;

        const formData = new FormData(form);
        this.iconRows = (this.iconRows || []).map((row) => ({
            id: row.id,
            name: formData.get(`name_${row.id}`)?.trim() || "",
            path: formData.get(`path_${row.id}`)?.trim() || "",
        }));
    }

    // --- Action Handlers ---

    static async _onAddRow(event, target) {
        this._syncState();
        this.iconRows.push({ id: foundry.utils.randomID(), name: "", path: "" });
        this.render();
    }

    static async _onDeleteRow(event, target) {
        this._syncState();
        const rowId = target.closest(".form-group").dataset.rowId;
        this.iconRows = this.iconRows.filter((r) => r.id !== rowId);
        this.render();
    }

    static async _onPickFile(event, target) {
        const targetName = target.dataset.target;
        const input = this.element.querySelector(`input[name="${targetName}"]`);
        if (!input) return;

        new foundry.applications.apps.FilePicker({
            type: "image",
            current: input.value,
            callback: (path) => {
                input.value = path;
            },
        }).render(true);
    }

    static async _onCancel(event, target) {
        this.close();
    }

    static async _onSave(event, target) {
        event.preventDefault(); // Extra defense against native submission

        // Grab all current inputs directly into our array
        this._syncState();

        const newIcons = {};
        for (const row of this.iconRows) {
            // Only save complete pairs
            if (row.name && row.path) {
                newIcons[row.name] = row.path;
            }
        }

        await game.settings.set(MODULE_ID, "custom_user_icons", newIcons);
        ui.notifications.info("Custom icons saved. Reloading...");
        this.close();

        // Native clean reload
        setTimeout(() => globalThis.location.reload(), 500);
    }
}

/**
 * Registers all icon settings with Foundry VTT.
 */
function registerIconSettings() {
    // 1. Register Main Structural Icons (Melee, Shield, etc.)
    for (const [key, config] of Object.entries(ICON_CONFIG)) {
        game.settings.register(MODULE_ID, `icon_main_${key}`, {
            name: config.name,
            scope: "world",
            config: true,
            type: String,
            filePicker: "image",
            default: config.default,
            requiresReload: true,
        });
    }

    // 2. Hidden Object Setting to store custom pairs
    game.settings.register(MODULE_ID, "custom_user_icons", {
        scope: "world",
        config: false,
        type: Object,
        default: {},
    });

    // 3. The Settings Menu Button that opens the UI
    game.settings.registerMenu(MODULE_ID, "custom_icons_menu", {
        name: "Custom Spell & Skill Icons",
        label: "Configure Icons",
        hint: "Map specific spells and skills to custom icons.",
        icon: "fas fa-images",
        type: RMUCustomIconsMenu,
        restricted: true,
    });
}

// -----------------------------------------------------------------------------
// II. Core Utilities (Reusable logic, API wrappers, Formatting)
// -----------------------------------------------------------------------------

/**
 * Debounce utility to prevent a function from firing too rapidly.
 * @param {function} func - The function to debounce.
 * @param {number} [delay=150] - The delay in milliseconds.
 * @returns {function} The debounced function.
 */
function debounce(func, delay = 150) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Formats a number as a string with a leading plus sign for positive values.
 * @param {*} n - The number or string to format.
 * @returns {string|*} The formatted string, or the original value if not a number.
 */
function formatBonus(n) {
    if (n === null || n === undefined) return n;
    const s = String(n).trim();
    if (s === "") return s;
    const num = Number(s);
    if (Number.isNaN(num)) return n;
    return num > 0 ? `+${num}` : String(num);
}

/**
 * A collection of shared utility functions for the RMU HUD.
 * @global
 */
const RMUUtils = {
    /**
     * Formats tooltip detail values, applying bonus formatting to most.
     * @param {Array<object>} details - Array of {label, value} objects.
     * @returns {Array<object>} The formatted array.
     */
    formatTooltipDetails(details) {
        const excludedLabels = new Set(["Ranks", "Total ranks", "Culture ranks", "Fumble", "Level", "Spells", "Charges"]);
        return details.map((detail) => {
            if (excludedLabels.has(detail.label)) {
                return detail;
            }
            return { ...detail, value: formatBonus(detail.value) };
        });
    },

    /**
     * Mounts a translucent value overlay onto an action button.
     * @param {HTMLElement} buttonEl - The button's DOM element.
     * @param {string|number} [number=""] - The main number to display (e.g., "+10").
     * @param {string} [labelText="Total"] - The small label (e.g., "Total", "SCR").
     */
    applyValueOverlay(buttonEl, number = "", labelText = "Total") {
        if (!buttonEl) return;
        const host = buttonEl.querySelector(".image, .ech-image, .icon, .thumbnail, .main-button__image, .argon-image") || buttonEl;
        host.classList.add("rmu-button-relative", "rmu-overflow-hidden");
        host.querySelector(".rmu-value-overlay")?.remove();

        const root = document.createElement("div");
        root.className = "rmu-value-overlay";
        const txt = document.createElement("div");
        txt.className = "rmu-value-overlay-text";

        if (labelText) {
            const t = document.createElement("div");
            t.className = "rmu-value-overlay-label";
            t.textContent = labelText;
            txt.appendChild(t);
        }

        if (number !== "" && number !== null && number !== undefined) {
            const n = document.createElement("div");
            n.className = "rmu-value-overlay-number";
            const formattedNumber = formatBonus(number);
            n.textContent = formattedNumber;
            txt.appendChild(n);
        }

        root.appendChild(txt);
        host.appendChild(root);
    },

    /**
     * Centralized utility to call an RMU system API function robustly.
     * Ensures a token is selected and handles API errors gracefully.
     * @param {Token} token - The token to perform the action on.
     * @param {string} apiFunctionName - The name of the function on `game.system.api`.
     * @param {...*} args - Arguments to pass to the API function.
     * @returns {Promise<boolean>} True if the API call succeeded, false otherwise.
     */
    async rmuTokenActionWrapper(token, apiFunctionName, ...args) {
        if (!token) {
            ui.notifications?.error?.("No active token for HUD.");
            return false;
        }
        const api = game.system?.api?.[apiFunctionName];
        if (typeof api !== "function") {
            console.warn(`[ECH-RMU] RMU API function not available: ${apiFunctionName}`);
            ui.notifications?.warn?.(`RMU API function not available: ${apiFunctionName}. Action simulated.`);
            return false;
        }

        try {
            // Ensure the token is controlled before acting, if possible
            if (!token.controlled && typeof token.control === "function") {
                await token.control({ releaseOthers: true });
            }
        } catch (_) {
            /* non-fatal if control fails */
        }

        try {
            await api(token, ...args);
            return true;
        } catch (err) {
            console.error(`[ECH-RMU] ${apiFunctionName} error:`, err);
            ui.notifications?.error?.(`${apiFunctionName} failed: ${err?.message ?? err}`);
            return false;
        }
    },

    /**
     * Builds a standardized tooltip data object for a skill.
     * @param {object} skill - The raw skill object.
     * @param {string} title - The main title for the tooltip.
     * @param {string} subtitle - The subtitle for the tooltip.
     * @returns {object} The tooltip data object.
     */
    buildSkillTooltip: function (skill, title, subtitle) {
        const sys = skill?.system ?? {};
        const details = [
            { label: "Total ranks", value: sys._totalRanks },
            { label: "Rank bonus", value: sys._rankBonus },
            { label: "Culture ranks", value: sys.cultureRanks },
            { label: "Stat", value: sys.stat },
            { label: "Stat bonus", value: sys._statBonus },
            { label: "Prof bonus", value: sys._professionalBonus },
            { label: "Knack", value: sys._knack },
            { label: "Total bonus", value: sys._bonus },
        ].filter((x) => x.value !== undefined && x.value !== null && x.value !== "");

        return {
            title: title,
            subtitle: subtitle,
            details: RMUUtils.formatTooltipDetails(details),
        };
    },

    /**
     * Creates and manages the chip container on an action button.
     * @param {HTMLElement} element - The button's DOM element.
     * @param {Array<object>} chips - An array of chip objects to add.
     * E.g., [{ id: "fav", title: "Favorite", icon: ICONS.star, class: "rmu-fav-chip" }]
     * @returns {HTMLElement|null} The chip container element, or null.
     */
    buildChipContainer: function (element, chips = []) {
        if (!element || !chips || chips.length === 0) {
            element.querySelector(".rmu-chip-container")?.remove();
            return null;
        }

        element.classList.add("rmu-button-relative");
        let chipContainer = element.querySelector(".rmu-chip-container");
        if (chipContainer) {
            chipContainer.innerHTML = "";
        } else {
            chipContainer = document.createElement("div");
            chipContainer.className = "rmu-chip-container";
            element.appendChild(chipContainer);
        }

        for (const chipData of chips) {
            const chip = document.createElement("div");
            chip.className = `rmu-chip ${chipData.class}`;
            chip.title = chipData.title;

            // Map the icon dynamically so we don't have to alter other files
            let iconUrl = chipData.icon;
            if (!iconUrl) {
                if (chipData.class.includes("fav-chip")) iconUrl = ICONS.star;
                else if (chipData.class.includes("instant-chip")) iconUrl = ICONS.instant;
                else if (chipData.class.includes("subconscious-chip")) iconUrl = ICONS.subconscious;
            }

            // Mimic the old CSS ::before pseudo-element inline
            if (iconUrl) {
                const iconInner = document.createElement("div");
                iconInner.style.width = "100%";
                iconInner.style.height = "100%";
                iconInner.style.backgroundColor = "var(--filroden-color-success)";
                iconInner.style.maskImage = `url('${iconUrl}')`;
                iconInner.style.webkitMaskImage = `url('${iconUrl}')`;
                iconInner.style.maskSize = "contain";
                iconInner.style.webkitMaskSize = "contain";
                iconInner.style.maskRepeat = "no-repeat";
                iconInner.style.webkitMaskRepeat = "no-repeat";
                iconInner.style.maskPosition = "center";
                iconInner.style.webkitMaskPosition = "center";
                chip.appendChild(iconInner);
            }

            chipContainer.appendChild(chip);
        }
        return chipContainer;
    },
};

// -----------------------------------------------------------------------------
// III. UI Guards (Interaction Protection)
// -----------------------------------------------------------------------------

/**
 * A collection of utilities to manage user input focus and
 * prevent unwanted event propagation (e.g., hotkeys firing).
 * @global
 */
const UIGuards = {
    /**
     * Attaches aggressive event stoppers to a panel to prevent
     * focus/click/key events from bubbling *out* of the panel.
     * This is used for panels that contain interactive inputs like search bars.
     * @param {ButtonPanel} panel - The Argon ButtonPanel instance.
     */
    attachPanelInputGuards(panel) {
        const arm = () => {
            const el = panel?.element;
            if (!el) return requestAnimationFrame(arm);

            const cap = { capture: true };
            const stopIfControl = (ev) => {
                const t = ev.target;
                if (t?.closest?.(".rmu-skill-search__fav, .rmu-skill-search__clear")) return;
                if (ev.type === "input") return;
                if (!t) return;

                // This guard is designed to *stop* interaction.
                // It is now only used where we explicitly want to block inputs.
                if (t.closest("input, textarea, select, .rmu-skill-search, .rmu-skill-search__input, .rmu-skill-search__clear")) {
                    if (ev.type === "pointerdown" || ev.type === "mousedown" || ev.type === "touchstart") {
                        ev.preventDefault();
                    }
                    ev.stopImmediatePropagation();
                    ev.stopPropagation();
                }
            };
            ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "touchstart", "touchend", "contextmenu", "wheel", "focus", "focusin", "focusout", "blur", "keydown", "keyup"].forEach(
                (type) => el.addEventListener(type, stopIfControl, cap),
            );
        };
        requestAnimationFrame(arm);
    },

    /**
     * Installs a global, aggressive keydown guard to prevent
     * canvas hotkeys (like WSAD) from firing while the HUD is open
     * AND the user is not interacting with a designated input field.
     */
    installGlobalHudInputGuard: () => {
        const guardHandler = (event) => {
            // Only run if Argon is open
            if (!ui.ARGON?.isOpen) return;

            const target = event.target;
            const targetTag = target.tagName;

            // Check for standard form elements OR our manual guard attribute
            if (targetTag === "INPUT" || targetTag === "SELECT" || targetTag === "TEXTAREA" || target.closest('[data-argon-input-guard="true"]')) {
                return; // Let the key event proceed to the input
            }

            // Block the keypress to prevent token movement, etc.
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        };

        document.body.addEventListener("keydown", guardHandler, true);
        console.log("[ECH-RMU] Global HUD input guard installed.");
    },

    /**
     * Attaches simple event stoppers to a panel to prevent
     * events from propagating *through* it to the canvas.
     * This is a "lighter" guard for non-interactive panels.
     * @param {ButtonPanel} panel - The Argon ButtonPanel instance.
     */
    attachPanelInteractionGuards(panel) {
        const tryAttach = () => {
            const el = panel?.element;
            if (!el) return requestAnimationFrame(tryAttach);
            const stop = (e) => {
                e.stopPropagation();
            };
            // This list is non-capturing and just stops bubbling.
            ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "touchstart", "touchend", "contextmenu", "wheel", "focusin", "focusout", "blur", "keydown", "keyup"].forEach((type) => {
                el.addEventListener(type, stop, { capture: false });
            });
        };
        requestAnimationFrame(tryAttach);
    },

    /**
     * Attaches targeted event stoppers to an individual button.
     * Ensures the button intercepts pointer events and prevents
     * clicks from falling through to the canvas below.
     * @param {object} component - The Argon button component.
     */
    attachButtonInteractionGuards(component) {
        const tryAttach = () => {
            const el = component?.element;
            if (!el) return requestAnimationFrame(tryAttach);

            // 1. Force the element to act as a physical click barrier
            el.classList.add("rmu-interactive-button");
            el.style.pointerEvents = "auto";
            el.style.cursor = "pointer";

            // 2. Prevent the event from bubbling up to the window/canvas
            const stop = (e) => e.stopPropagation();
            ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "contextmenu", "touchstart", "touchend"].forEach((type) => {
                el.addEventListener(type, stop, { capture: false });
            });
        };
        requestAnimationFrame(tryAttach);
    },
};

// -----------------------------------------------------------------------------
// IV. General Search Feature (Reusable)
// -----------------------------------------------------------------------------

/**
 * Installs a general-purpose search/filter bar onto a panel.
 * @param {ButtonPanel} panel - The Argon panel instance.
 * @param {string} tileSelector - CSS selector for filterable items (e.g., ".rmu-skill-tile").
 * @param {string} headerSelector - CSS selector for headers to hide when empty.
 * @param {string} logPrefix - Logging prefix (e.g., "skill", "spell").
 * @param {object} [options={}] - Configuration options.
 * @param {Array<object>} [options.filters=[]] - Array of filter definitions.
 * @param {function} [options.onClear=null] - Callback(panelEl) to run when filters are cleared.
 * @global
 */
function installListSearch(panel, tileSelector, headerSelector, logPrefix, options = {}) {
    // 1. Get options
    const { filters = [], onClear = null } = options;
    const panelId = panel.id;
    if (!panelId) {
        console.error("[ECH-RMU] installListSearch failed: Panel has no 'id' property.", panel);
        return;
    }

    // 2. State & Helpers
    let tiles = [];
    let headers = [];
    const log = (msg) => console.log(`[ECH-RMU] [${logPrefix}] ${msg}`);

    // 3. Main Filter Logic
    const filter = (text) => {
        const terms = text.normalize("NFKC").trim().toLowerCase().split(" ").filter(Boolean);
        const bar = panel?.element?.querySelector(".rmu-search-bar");
        if (!bar) return;

        // Find the summary element
        const summaryEl = bar.querySelector(".rmu-search-summary");

        const activeFilters = filters.filter((f) => {
            return bar.querySelector(`#rmu-filter-${panelId}-${f.id}`)?.classList.contains("active");
        });

        // Check if this is a "clear" event (no text, no active filters)
        const isFiltered = terms.length > 0 || activeFilters.length > 0;

        if (!isFiltered) {
            // This is a "clear" event.
            if (typeof onClear === "function") {
                // Run the custom accordion-closing logic
                onClear(panel.element);
            } else {
                // Fallback for panels without an accordion
                tiles.forEach((tile) => (tile.style.display = ""));
                showHeaders(tiles, headers);
                if (summaryEl) summaryEl.style.display = "none";
            }
            return; // Stop here
        }

        // Check Tile Visibility (This logic now only runs if isFiltered is true)
        const visibleTiles = [];
        tiles.forEach((tile) => {
            const name = tile.dataset.nameNorm || "";
            const textMatch = terms.every((t) => name.includes(t));
            const filterMatch = activeFilters.every((f) => {
                return tile.dataset[f.dataKey] === "true";
            });
            const isVisible = textMatch && filterMatch;

            tile.style.display = isVisible ? "" : "none";
            if (isVisible) visibleTiles.push(tile);
        });

        // Header Visibility
        showHeaders(visibleTiles, headers);

        // Update Summary Text
        if (summaryEl) {
            const total = tiles.length;
            const visible = visibleTiles.length;

            summaryEl.textContent = `Showing ${visible} of ${total}`;
            summaryEl.style.display = "";
        }
    };

    // 4. Header Hiding Logic
    const showHeaders = (visibleTiles, headers) => {
        headers.forEach((h) => {
            const key = h.dataset.catKey || h.dataset.listTypeKey || h.dataset.listNameKey;
            if (!key) {
                h.style.display = "";
                return;
            }
            const hasVisibleChild = visibleTiles.some((t) => t.dataset.catKey === key || t.dataset.listNameKey === key || t.dataset.listTypeKey === key);
            h.style.display = hasVisibleChild ? "" : "none";
        });
    };

    // 5. DOM Mounting
    const waitAndMount = () => {
        const el = panel?.element;
        if (!el) return requestAnimationFrame(waitAndMount);

        tiles = Array.from(el.querySelectorAll(tileSelector));
        if (!tiles.length) {
            return requestAnimationFrame(waitAndMount);
        }
        if (el.querySelector(".rmu-search-bar")) return;

        log("Mounting search bar...");
        headers = Array.from(el.querySelectorAll(headerSelector));

        // A. Create Search Bar container
        const searchBar = document.createElement("div");
        searchBar.className = "rmu-search-bar";

        // B. Create Text Input
        const search = document.createElement("input");
        search.className = "rmu-search-input";
        search.type = "text";
        search.placeholder = "Filter...";
        search.dataset.argonInputGuard = "true"; // For global guard

        // Stop keydown events from bubbling to global guard (e.g., "Enter")
        search.addEventListener(
            "keydown",
            (e) => {
                e.stopPropagation();
            },
            true,
        );

        // Search on "Enter" key (in capture phase)
        search.addEventListener(
            "keydown",
            (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    filter(search.value);
                }
            },
            true,
        );

        // C. Create Search Icon
        const searchIcon = document.createElement("a");
        searchIcon.className = "rmu-search-icon";
        searchIcon.innerHTML = `<img src="${ICONS.search}" alt="Search" style="-webkit-mask-image: url('${ICONS.search}'); mask-image: url('${ICONS.search}');">`;
        searchIcon.addEventListener("click", (e) => {
            e.preventDefault();
            filter(search.value);
        });

        // D. Create "Clear" Button
        const clearBtn = document.createElement("a");
        clearBtn.className = "rmu-search-clear rmu-filter-button";
        clearBtn.title = "Clear search and filters";
        clearBtn.innerHTML = `<img src="${ICONS.close}" alt="Clear" style="-webkit-mask-image: url('${ICONS.close}'); mask-image: url('${ICONS.close}');">`;

        // E. Create Filter Button Container
        const filterContainer = document.createElement("div");
        filterContainer.className = "rmu-search-filters";

        // F. Create all filter buttons
        for (const f of filters) {
            const btn = document.createElement("a");
            const btnId = `rmu-filter-${panelId}-${f.id}`;
            btn.className = "rmu-filter-button";
            btn.id = btnId;
            btn.title = f.tooltip;
            btn.innerHTML = `<img src="${f.icon}" alt="${f.tooltip}" style="-webkit-mask-image: url('${f.icon}'); mask-image: url('${f.icon}');">`;
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                const isActive = e.currentTarget.classList.toggle("active");
                RMUData.setFilterActive(panelId, f.id, isActive);
                filter(search.value); // Re-run filter on click
            });
            filterContainer.appendChild(btn);
        }

        // G. Clear Button Click Event
        clearBtn.addEventListener("click", (e) => {
            e.preventDefault();
            search.value = "";
            RMUData.clearAllFilters(panelId);
            filterContainer.querySelectorAll(".rmu-filter-button").forEach((b) => {
                b.classList.remove("active");
            });
            filter(""); // Re-run filter (will be caught by the new logic in filter())
        });

        // H. Create Summary Text Element
        const summaryText = document.createElement("div");
        summaryText.className = "rmu-search-summary";
        summaryText.style.display = "none"; // Hide it by default

        // I. Append elements
        searchBar.appendChild(filterContainer); // 1. Filters
        searchBar.appendChild(search); // 2. Input
        searchBar.appendChild(searchIcon); // 3. Search Icon
        searchBar.appendChild(clearBtn); // 4. Clear Button
        searchBar.appendChild(summaryText); // 5. Summary

        el.prepend(searchBar);
    };

    requestAnimationFrame(waitAndMount);
}

// -----------------------------------------------------------------------------
// V. Core Argon Definitions (Non-feature logic)
// -----------------------------------------------------------------------------

/**
 * Defines a custom tooltip class for the RMU HUD.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
function defineTooltip(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const BaseTooltip = ARGON?.CORE?.Tooltip || ARGON?.HUD?.Tooltip || ARGON?.Tooltip;

    if (!BaseTooltip) {
        console.warn("[ECH-RMU] Argon CORE.Tooltip base class not found; skipping custom tooltip.");
        return;
    }

    /** @augments BaseTooltip */
    class RMUTooltip extends BaseTooltip {
        get classes() {
            return [...super.classes, "rmu"];
        }
    }

    CoreHUD.defineTooltip(RMUTooltip);
}

/**
 * Defines the actor types that the RMU HUD will activate for.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
function defineSupportedActorTypes(CoreHUD) {
    CoreHUD.defineSupportedActorTypes(["Character", "Creature", "character", "creature"]);
}

// -----------------------------------------------------------------------------
// VI. Export
// -----------------------------------------------------------------------------

export { ICONS, getUserIcon, RMUUtils, UIGuards, installListSearch, formatBonus, defineTooltip, defineSupportedActorTypes, registerIconSettings };
