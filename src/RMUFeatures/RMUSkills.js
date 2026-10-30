/**
 * Defines the main Skills panel, using the shared accordion and search bar.
 */

import { ICONS, getUserIcon, RMUUtils } from "../RMUCore.js";
import { createBaseClasses } from "../ui/baseButtons.js";
import { buildTooltip } from "../ui/tooltip.js";
import { Accordion, ACCORDION_ROLE } from "../ui/accordion.js";
import { ListSearch } from "../ui/search.js";
import { callHudTokenAction, getSkillDescription } from "../system/api.js";
import { ensureRMUReady } from "../system/derive.js";
import { getGroupedSkills, skillTooltipDetails } from "../system/skills.js";

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
        /**
         * @param {string} title - The category name.
         * @param {Accordion} accordion - The panel's accordion.
         */
        constructor(title, accordion) {
            super();
            this._title = title;
            this._catKey = catKeyOf(title);
            this.accordion = accordion;
        }
        get label() {
            return this._title;
        }
        get icon() {
            return "";
        }
        get classes() {
            return [...super.classes, "ech-rmu-skill-header"];
        }
        get hasTooltip() {
            return false;
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;
            this.accordion.register(this.element, ACCORDION_ROLE.HEADER, [this._catKey]);
        }

        /** Opens this category, or closes it if it is already open. */
        async _onActivate() {
            this.accordion.toggle([this._catKey]);
        }
    }

    /**
     * An action button for a single skill (e.g., "Perception").
     * @augments RMUActionButton
     */
    class RMUSkillActionButton extends RMUActionButton {
        /**
         * @param {object} entry - The display-ready skill object (from system/skills.js).
         * @param {Accordion} accordion - The panel's accordion.
         */
        constructor(entry, accordion) {
            super();
            this.entry = entry;
            this.accordion = accordion;
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
            const skill = this.entry?.raw;
            return buildTooltip({
                title: this.label,
                subtitle: skill?.system?.category,
                description: await getSkillDescription(skill),
                details: skillTooltipDetails(skill),
            });
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

            this.accordion.register(this.element, ACCORDION_ROLE.ITEM, [catKeyOf(cat)]);
        }

        /**
         * Rolls the skill using the centralized API wrapper.
         */
        async _onActivate() {
            await callHudTokenAction("rmuTokenSkillAction", this.entry?.raw, undefined);
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
            await ensureRMUReady();
            const groups = getGroupedSkills();
            const buttons = [];

            if (!groups.size) {
                return createGuardedPanel("ech-rmu-skills", [new RMUEmptyButton("No skills")]);
            }

            const cats = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
            const accordion = new Accordion();

            // Headers and tiles; every category starts closed.
            for (const cat of cats) {
                buttons.push(new RMUSkillHeaderButton(cat, accordion));
                for (const entry of groups.get(cat)) {
                    buttons.push(new RMUSkillActionButton(entry, accordion));
                }
            }

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

            // Clearing the search returns to the category that was open before it.
            const search = new ListSearch({ filters: skillFilters, resetOnClear: false });
            return createGuardedPanel("ech-rmu-skills", buttons, { accordion, search });
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
