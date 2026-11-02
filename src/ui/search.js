/**
 * Search and filter bar for panels with an accordion (Skills, Spells).
 *
 * The bar is mounted by the panel itself at the end of each render, when every button is
 * already in the panel, so there is no waiting for elements to appear. It filters the
 * panel's accordion items by text and by toggle filters, hides headers whose groups have no
 * matching item, and shows a "Showing X of Y" summary. Clearing the search hands control
 * back to the accordion.
 *
 * Filter toggles only last for the life of the panel: rebuilding the HUD (for example when
 * switching tokens) starts with no filters active.
 */

import { ICONS } from "../icons.js";
import { t, tf } from "../i18n.js";
import { ACCORDION_ROLE, isPathPrefix, readAccordionData } from "./accordion.js";

/**
 * Normalises text for matching: compatibility-normalised, trimmed and lower case, so for
 * example full-width characters and different capitalisations match.
 * @param {string} text
 * @returns {string}
 */
function normaliseSearchText(text) {
    return String(text ?? "")
        .normalize("NFKC")
        .trim()
        .toLowerCase();
}

/**
 * Creates an icon button (search, clear or filter). The icon is drawn as a mask in CSS; its
 * URL comes from the GM's icon settings, so it is passed as the --ech-rmu-icon-url property.
 * @param {string} className
 * @param {string} iconUrl
 * @param {string} title
 * @returns {HTMLAnchorElement}
 */
function createIconButton(className, iconUrl, title) {
    const button = document.createElement("a");
    button.className = className;
    if (title) button.title = title;
    const img = document.createElement("img");
    img.src = iconUrl;
    img.alt = title || "";
    img.style.setProperty("--ech-rmu-icon-url", `url("${iconUrl}")`);
    button.appendChild(img);
    return button;
}

export class ListSearch {
    /**
     * @param {object} [options]
     * @param {Array<{id: string, dataKey: string, icon: string, tooltip: string}>} [options.filters]
     *        Toggle filters. An item passes a filter when its element's data-<dataKey> is "true".
     * @param {boolean} [options.resetOnClear=false] Close every accordion group when the search
     *        is cleared (Spells); otherwise the group open before the search is shown again (Skills).
     */
    constructor({ filters = [], resetOnClear = false } = {}) {
        this.filters = filters;
        this.resetOnClear = resetOnClear;
        this.panel = null;
        this.input = null;
        this.summary = null;
        this.filterButtons = new Map();
    }

    /**
     * Adds the bar to the top of the panel. Called after every panel render; the render
     * replaces the panel's contents, so a bar from an earlier render is never present.
     * @param {object} panel - The RMU button panel, with its accordion.
     */
    mount(panel) {
        this.panel = panel;
        const el = panel.element;
        if (!el || el.querySelector(".ech-rmu-search-bar")) return;

        const bar = document.createElement("div");
        bar.className = "ech-rmu-search-bar";

        const filterContainer = document.createElement("div");
        filterContainer.className = "ech-rmu-search-filters";
        this.filterButtons.clear();
        for (const f of this.filters) {
            const btn = createIconButton("ech-rmu-filter-button", f.icon, f.tooltip);
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                btn.classList.toggle("active");
                this.run();
            });
            this.filterButtons.set(f.id, btn);
            filterContainer.appendChild(btn);
        }

        this.input = document.createElement("input");
        this.input.className = "ech-rmu-search-input";
        this.input.type = "text";
        this.input.placeholder = t("ECH-RMU.Search.Placeholder");
        // Typing must never reach Foundry's key handling (for example WASD token movement),
        // so key events are stopped at the input in the capture phase.
        this.input.addEventListener(
            "keydown",
            (e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                    e.preventDefault();
                    this.run();
                }
            },
            true,
        );

        const searchIcon = createIconButton("ech-rmu-search-icon", ICONS.search, "");
        searchIcon.addEventListener("click", (e) => {
            e.preventDefault();
            this.run();
        });

        const clearBtn = createIconButton("ech-rmu-search-clear ech-rmu-filter-button", ICONS.close, t("ECH-RMU.Search.Clear"));
        clearBtn.addEventListener("click", (e) => {
            e.preventDefault();
            this.input.value = "";
            for (const btn of this.filterButtons.values()) btn.classList.remove("active");
            this.run();
        });

        this.summary = document.createElement("div");
        this.summary.className = "ech-rmu-search-summary";
        this.summary.style.display = "none";

        bar.append(filterContainer, this.input, searchIcon, clearBtn, this.summary);
        el.prepend(bar);
    }

    /** @returns {Array<object>} The filter definitions whose toggle is active. */
    activeFilters() {
        return this.filters.filter((f) => this.filterButtons.get(f.id)?.classList.contains("active"));
    }

    /** Applies the current text and filters, or hands back to the accordion when both are empty. */
    run() {
        const accordion = this.panel?.accordion;
        if (!accordion) return;

        const terms = normaliseSearchText(this.input?.value).split(" ").filter(Boolean);
        const active = this.activeFilters();

        if (!terms.length && !active.length) {
            this._clear(accordion);
            return;
        }

        const elements = accordion.elements().map((el) => ({ el, ...readAccordionData(el) }));
        const items = elements.filter((e) => e.role === ACCORDION_ROLE.ITEM);
        const visiblePaths = [];

        for (const item of items) {
            const name = item.el.dataset.nameNorm || "";
            const visible = terms.every((t) => name.includes(t)) && active.every((f) => item.el.dataset[f.dataKey] === "true");
            item.el.style.display = visible ? "" : "none";
            if (visible) visiblePaths.push(item.path);
        }

        // A header stays visible only if at least one matching item is inside its group.
        for (const header of elements.filter((e) => e.role === ACCORDION_ROLE.HEADER)) {
            const hasMatch = visiblePaths.some((p) => isPathPrefix(header.path, p));
            header.el.style.display = hasMatch ? "" : "none";
        }

        this.summary.textContent = tf("ECH-RMU.Search.Summary", { visible: visiblePaths.length, total: items.length });
        this.summary.style.display = "";
    }

    /**
     * Restores the accordion view after the search is emptied.
     * @param {object} accordion
     */
    _clear(accordion) {
        if (this.resetOnClear) accordion.reset();
        accordion.apply();
        if (this.summary) this.summary.style.display = "none";
    }
}
