/**
 * Contains shared utilities, core Argon integration points and the general reusable
 * search logic used by multiple panels.
 */

import { RMUData } from "./RMUData.js";
import { SUPPORTED_ACTOR_TYPES } from "./constants.js";
import { ICONS, getUserIcon } from "./icons.js";
import { formatBonus } from "./format.js";
import { UIGuards } from "./ui/guards.js";
import { applyValueOverlay, buildChipContainer } from "./ui/dom.js";

// -----------------------------------------------------------------------------
// I. Core Utilities (Reusable logic, API wrappers, Formatting)
// -----------------------------------------------------------------------------

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

    /** Mounts the value overlay on a button (see ui/dom.js). */
    applyValueOverlay,

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

    /** Creates or refreshes the chip row on a button (see ui/dom.js). */
    buildChipContainer,
};

// -----------------------------------------------------------------------------
// II. General Search Feature (Reusable)
// -----------------------------------------------------------------------------

/**
 * Installs a general-purpose search/filter bar onto a panel.
 * @param {ButtonPanel} panel - The Argon panel instance.
 * @param {string} tileSelector - CSS selector for filterable items (e.g., ".ech-rmu-skill-tile").
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
        const bar = panel?.element?.querySelector(".ech-rmu-search-bar");
        if (!bar) return;

        // Find the summary element
        const summaryEl = bar.querySelector(".ech-rmu-search-summary");

        const activeFilters = filters.filter((f) => {
            return bar.querySelector(`#ech-rmu-filter-${panelId}-${f.id}`)?.classList.contains("active");
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
        if (el.querySelector(".ech-rmu-search-bar")) return;

        log("Mounting search bar...");
        headers = Array.from(el.querySelectorAll(headerSelector));

        // A. Create Search Bar container
        const searchBar = document.createElement("div");
        searchBar.className = "ech-rmu-search-bar";

        // B. Create Text Input
        const search = document.createElement("input");
        search.className = "ech-rmu-search-input";
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
        searchIcon.className = "ech-rmu-search-icon";
        searchIcon.innerHTML = `<img src="${ICONS.search}" alt="Search" style="-webkit-mask-image: url('${ICONS.search}'); mask-image: url('${ICONS.search}');">`;
        searchIcon.addEventListener("click", (e) => {
            e.preventDefault();
            filter(search.value);
        });

        // D. Create "Clear" Button
        const clearBtn = document.createElement("a");
        clearBtn.className = "ech-rmu-search-clear ech-rmu-filter-button";
        clearBtn.title = "Clear search and filters";
        clearBtn.innerHTML = `<img src="${ICONS.close}" alt="Clear" style="-webkit-mask-image: url('${ICONS.close}'); mask-image: url('${ICONS.close}');">`;

        // E. Create Filter Button Container
        const filterContainer = document.createElement("div");
        filterContainer.className = "ech-rmu-search-filters";

        // F. Create all filter buttons
        for (const f of filters) {
            const btn = document.createElement("a");
            const btnId = `ech-rmu-filter-${panelId}-${f.id}`;
            btn.className = "ech-rmu-filter-button";
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
            filterContainer.querySelectorAll(".ech-rmu-filter-button").forEach((b) => {
                b.classList.remove("active");
            });
            filter(""); // Re-run filter (will be caught by the new logic in filter())
        });

        // H. Create Summary Text Element
        const summaryText = document.createElement("div");
        summaryText.className = "ech-rmu-search-summary";
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
// III. Core Argon Definitions (Non-feature logic)
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
            return [...super.classes, "ech-rmu"];
        }
    }

    CoreHUD.defineTooltip(RMUTooltip);
}

/**
 * Defines the actor types that the RMU HUD will activate for.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
function defineSupportedActorTypes(CoreHUD) {
    CoreHUD.defineSupportedActorTypes([...SUPPORTED_ACTOR_TYPES]);
}

// -----------------------------------------------------------------------------
// IV. Export
// -----------------------------------------------------------------------------

// ICONS, getUserIcon, formatBonus and UIGuards are defined in their own modules and
// re-exported here so the feature files can keep importing all shared helpers from one place.
export { ICONS, getUserIcon, RMUUtils, UIGuards, installListSearch, formatBonus, defineTooltip, defineSupportedActorTypes };
