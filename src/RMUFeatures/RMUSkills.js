/**
 * Defines the main Skills panel, using the shared accordion and search bar.
 */

import { ICONS, getUserIcon } from "../icons.js";
import { t, term } from "../i18n.js";
import { applyValueOverlay, buildChipContainer } from "../ui/dom.js";
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
            return e?.spec ? `${e.name} (${e.spec})` : (e?.name ?? t("ECH-RMU.Fallback.Skill"));
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
        /** @returns {boolean} Whether the skill is marked as a favourite. */
        get _isFavorite() {
            return this.entry?.raw?.system?.favorite === true || this.entry?.favorite === true;
        }

        /**
         * The chips shown on the button, also listed as badges in its tooltip.
         * @returns {Array<{class: string, label: string}>}
         */
        _chips() {
            return this._isFavorite ? [{ class: "ech-rmu-skill-fav-chip", label: t("ECH-RMU.Chip.Favorite") }] : [];
        }

        async getTooltipData() {
            const skill = this.entry?.raw;
            return buildTooltip({
                title: this.label,
                subtitle: skill?.system?.category,
                description: await getSkillDescription(skill),
                details: skillTooltipDetails(skill),
                properties: this._chips().map((c) => c.label),
            });
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            // Apply total bonus overlay
            applyValueOverlay(this.element, this.entry?.total ?? "", term("Total"));

            // Add data-attributes for searching and filtering
            const label = this.label || "";
            const cat = this.entry?.category || "";
            const spec = this.entry?.spec || "";
            const norm = (label + " " + cat + " " + spec).toLowerCase();

            this.element.dataset.name = label;
            this.element.dataset.nameNorm = norm;

            const sys = this.entry?.raw?.system ?? {};
            this.element.dataset.favorite = this._isFavorite ? "true" : "false";

            // Extract total ranks and assign the dataset flag
            const totalRanks = Number(sys._totalRanks || sys.ranks || 0);
            this.element.dataset.ranked = totalRanks > 0 ? "true" : "false";

            buildChipContainer(this.element, this._chips());

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
            this.title = term("Skills");
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
                return createGuardedPanel("ech-rmu-skills", [new RMUEmptyButton(t("ECH-RMU.Empty.Skills"))]);
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
                    tooltip: t("ECH-RMU.Filter.Favorites"),
                },
                {
                    id: "ranked",
                    dataKey: "ranked",
                    icon: ICONS.ranked,
                    tooltip: t("ECH-RMU.Filter.Ranked"),
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
            return term("Skills");
        }
        async _getButtons() {
            return [new RMUSkillsCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMUSkillsActionPanel]);
}
