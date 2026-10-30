/**
 * Defines the main Skills panel, using an accordion and the shared search filter.
 */

import { ICONS, getUserIcon, RMUUtils, installListSearch } from "../RMUCore.js";
import { createBaseClasses } from "../ui/baseButtons.js";
import { RMUData } from "../RMUData.js";

/**
 * Normalizes a category string into a key.
 * @param {string} s - The category name.
 * @returns {string} The normalized key.
 */
function catKeyOf(s) {
    return String(s ?? "")
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replaceAll(/\s+/g, " ");
}

/**
 * MASTER VISIBILITY FUNCTION:
 * Updates the visibility of all skill headers and tiles based on the accordion state.
 * Resets search-hidden headers.
 */
function applySkillsAccordionVisibility(panelEl) {
    if (!panelEl) return;
    const openKey = getOpenSkillsCategory();

    // 1. Restore and update Headers
    panelEl.querySelectorAll(".ech-rmu-skill-header").forEach((header) => {
        const key = header.dataset.catKey || "";
        header.style.display = "";
        header.classList.toggle("open", key === openKey);
        header.classList.toggle("closed", key !== openKey);
    });

    // 2. Update Skill Tiles
    panelEl.querySelectorAll(".ech-rmu-skill-tile").forEach((tile) => {
        const key = tile.dataset.catKey || "";
        // Only show tiles if their category is currently open
        tile.style.display = openKey && key === openKey ? "" : "none";
    });
}

// Global state helpers retrieved from RMUData
const getOpenSkillsCategory = () => RMUData.getOpenSkillsCategory();
const setOpenSkillsCategory = (catOrNull) => RMUData.setOpenSkillsCategory(catOrNull);

/**
 * Defines and registers the main Skills panel with Argon.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineSkillsMain(CoreHUD) {
    const { ButtonPanelButton } = CoreHUD.ARGON.MAIN.BUTTONS;
    const { RMUActionButton, RMUEmptyButton, RMUActionPanel, createGuardedPanel } = createBaseClasses(CoreHUD.ARGON);

    /**
     * An accordion header button for a skill category (e.g., "Awareness").
     * @augments RMUActionButton
     */
    class RMUSkillHeaderButton extends RMUActionButton {
        constructor(title) {
            super();
            this._title = title;
            this._catKey = catKeyOf(title);
            this._panelEl = null; // Reference to the parent panel's element
        }
        get label() {
            return this._title;
        }
        get icon() {
            return "";
        }
        get classes() {
            const open = getOpenSkillsCategory() === this._catKey;
            return [...super.classes, "ech-rmu-skill-header", open ? "open" : "closed"];
        }
        get hasTooltip() {
            return false;
        }

        /**
         * Binds the parent panel's element to this button for accordion logic.
         * @param {ButtonPanel} panel - The parent panel.
         */
        _bindPanel(panel) {
            const tryBind = () => {
                const el = panel?.element;
                if (!el) return requestAnimationFrame(tryBind);
                this._panelEl = el;
                this._applyVisibility();
            };
            requestAnimationFrame(tryBind);
        }

        /**
         * Applies visibility to all headers and tiles in the panel
         * based on the currently open category.
         */
        _applyVisibility() {
            if (!this._panelEl) return;
            const openKey = getOpenSkillsCategory();

            // Toggle 'open'/'closed' classes on all headers
            const headers = this._panelEl.querySelectorAll(".ech-rmu-skill-header");
            headers.forEach((h) => {
                const key = h.dataset.catKey || "";
                h.classList.toggle("open", key === openKey);
                h.classList.toggle("closed", key !== openKey);
            });

            // Show/hide skill tiles
            const tiles = this._panelEl.querySelectorAll(".ech-rmu-skill-tile");
            tiles.forEach((t) => {
                const key = t.dataset.catKey || "";
                // Only show if it's not hidden by search AND its category is open
                const isSearchHidden = t.style.display === "none" && key !== openKey;
                const visible = !!openKey && key === openKey && !isSearchHidden;
                t.style.display = visible ? "" : "none";
            });
        }

        async _renderInner() {
            await super._renderInner();
            if (this.element) {
                this.element.dataset.catKey = this._catKey;
                // Add data for search filtering
                this.element.dataset.nameNorm = this.label.toLowerCase();
                this.element.dataset.favorite = "false";
            }
        }

        /** Opens this category, or closes it if it is already open. */
        async _onActivate() {
            const currentOpen = getOpenSkillsCategory();
            const myKey = this._catKey;

            // Toggle: if clicking the open one, close it; otherwise open this one.
            const newKey = currentOpen === myKey ? null : myKey;
            setOpenSkillsCategory(newKey);

            // Refresh the UI
            applySkillsAccordionVisibility(this._panelEl);
        }
    }

    /**
     * An action button for a single skill (e.g., "Perception").
     * @augments RMUActionButton
     */
    class RMUSkillActionButton extends RMUActionButton {
        /**
         * @param {object} entry - The display-ready skill object from RMUData.
         * @param {boolean} [startHidden=false] - Whether the tile should start hidden.
         */
        constructor(entry, startHidden = false) {
            super();
            this.entry = entry;
            this._startHidden = !!startHidden;
        }
        get label() {
            const e = this.entry;
            return e?.spec ? `${e.name} (${e.spec})` : (e?.name ?? "Skill");
        }
        get icon() {
            const skillName = this.entry?.name;

            // Check if the user has configured a custom icon
            const customIcon = getUserIcon(skillName);
            if (customIcon) return customIcon;

            // Fallback for all skills
            return ICONS.skills_muted;
        }
        /** Skills the system marks as not rollable (for example Combat Styles) are disabled. */
        get disabled() {
            return !!this.entry?.disabledBySystem;
        }
        get classes() {
            return [...super.classes, "ech-rmu-skill-tile"];
        }

        get hasTooltip() {
            return true;
        }
        async getTooltipData() {
            const sys = this.entry?.raw?.system ?? {};
            const skill = this.entry?.raw;

            // 1. Get the standard details
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

            // 2. Get skill description via RMU API
            let description = "";
            const api = game.system?.api?.rmuGetSkillDescription;
            if (typeof api === "function" && skill) {
                try {
                    description = (await api(skill)) ?? "";
                } catch (err) {
                    console.error("[ECH-RMU] rmuGetSkillDescription API call FAILED!", err);
                    description = "Error loading description.";
                }
            }

            // 3. Return the tooltip data
            return {
                title: this.label,
                subtitle: sys.category ?? "",
                description: description,
                details: RMUUtils.formatTooltipDetails(details),
            };
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            // Apply total bonus overlay
            RMUUtils.applyValueOverlay(this.element, this.entry?.total ?? "", "Total");

            // Add data-attributes for searching and filtering
            const label = this.label || "";
            const cat = this.entry?.category || "";
            const spec = this.entry?.spec || "";
            const norm = (label + " " + cat + " " + spec).toLowerCase();

            this.element.dataset.catKey = catKeyOf(cat);
            this.element.dataset.name = label;
            this.element.dataset.nameNorm = norm;

            const sys = this.entry?.raw?.system ?? {};
            const isFav = sys.favorite === true || this.entry?.favorite === true;
            this.element.dataset.favorite = isFav ? "true" : "false";

            // Extract total ranks and assign the dataset flag
            const totalRanks = Number(sys._totalRanks || sys.ranks || 0);
            this.element.dataset.ranked = totalRanks > 0 ? "true" : "false";

            // Add "Favorite" chip
            const chips = [];
            if (isFav) {
                chips.push({
                    class: "ech-rmu-skill-fav-chip",
                    title: "Favorite",
                });
            }
            RMUUtils.buildChipContainer(this.element, chips);

            if (this._startHidden) this.element.style.display = "none";
        }

        /**
         * Rolls the skill using the centralized API wrapper.
         */
        async _onActivate() {
            await RMUUtils.rmuTokenActionWrapper(
                ui.ARGON?._token,
                "rmuTokenSkillAction",
                this.entry?.raw,
                undefined, // No special options needed
            );
        }
    }

    /**
     * The category button that opens the main Skills panel accordion.
     * @augments ButtonPanelButton
     */
    class RMUSkillsCategoryButton extends ButtonPanelButton {
        constructor() {
            super();
            this.title = "SKILLS";
            this._icon = ICONS.skills;
        }
        get label() {
            return this.title;
        }
        get icon() {
            return this._icon;
        }
        get hasContents() {
            return true;
        }
        get isInteractive() {
            return true;
        }

        async _getPanel() {
            await RMUData.ensureRMUReady();
            const groups = RMUData.getGroupedSkillsForHUD_All();
            const buttons = [];

            if (!groups.size) {
                return createGuardedPanel("ech-rmu-skills", [new RMUEmptyButton("No skills")]);
            }

            const cats = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

            // Build headers and tiles
            const headerInstances = [];
            for (const cat of cats) {
                const header = new RMUSkillHeaderButton(cat);
                headerInstances.push(header);
                buttons.push(header);
                for (const entry of groups.get(cat)) {
                    buttons.push(new RMUSkillActionButton(entry, true)); // Start hidden
                }
            }

            const panel = createGuardedPanel("ech-rmu-skills", buttons);

            // Install the search/filter bar
            const skillFilters = [
                {
                    id: "fav",
                    dataKey: "favorite",
                    icon: ICONS.star,
                    tooltip: "Show Favorites Only",
                },
                {
                    id: "ranked",
                    dataKey: "ranked",
                    icon: ICONS.ranked,
                    tooltip: "Show Ranked Skills Only",
                },
            ];

            installListSearch(panel, ".ech-rmu-skill-tile", ".ech-rmu-skill-header", "skill", {
                filters: skillFilters,
                onClear: (panelEl) => {
                    if (!panelEl) return;

                    applySkillsAccordionVisibility(panelEl);

                    const summaryEl = panelEl.querySelector(".ech-rmu-search-summary");
                    if (summaryEl) summaryEl.style.display = "none";
                },
            });

            // Bind all headers to the panel
            headerInstances.forEach((h) => h._bindPanel(panel));

            // Start with all categories closed
            setOpenSkillsCategory(null);
            requestAnimationFrame(() => {
                const el = panel.element;
                if (!el) return;
                el.querySelectorAll(".ech-rmu-skill-tile").forEach((t) => (t.style.display = "none"));
            });

            return panel;
        }
    }

    /**
     * The main "Skills" panel entry point for the HUD.
     * @augments RMUActionPanel
     */
    class RMUSkillsActionPanel extends RMUActionPanel {
        get label() {
            return "SKILLS";
        }
        async _getButtons() {
            return [new RMUSkillsCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMUSkillsActionPanel]);
}
