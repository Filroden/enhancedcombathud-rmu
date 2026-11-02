/**
 * Defines the main Spellcasting panel: a two-level accordion (list type, then list) over the
 * spell buttons, with the shared search bar. Implements standard Spell Casting Rolls (SCR).
 */

import { ICONS, getUserIcon } from "../icons.js";
import { compareText, t, tf, term } from "../i18n.js";
import { escapeHTML, formatBonus } from "../format.js";
import { applyValueOverlay, buildChipContainer } from "../ui/dom.js";
import { createBaseClasses } from "../ui/baseButtons.js";
import { Accordion, ACCORDION_ROLE } from "../ui/accordion.js";
import { ListSearch } from "../ui/search.js";
import { DETAIL_FORMAT, buildTooltip } from "../ui/tooltip.js";
import { callHudTokenAction } from "../system/api.js";
import { ensureRMUReady } from "../system/derive.js";
import {
    compareListTypes,
    getGroupedSpells,
    listTypeDisplayName,
    spellAttackBonus,
    spellDescription,
    spellDisplayName,
    spellListDisplayName,
    spellRealmsText,
} from "../system/spells.js";
import { attackTableName, specializationName } from "../system/names.js";

/**
 * Spell list type headers dim their list headers while another list type is open, so the
 * lists of the open type stand out. Top-level headers are never dimmed.
 * @param {string[]} headerPath - [listType] or [listType, listName].
 * @param {string[]} openPath - The accordion's open path.
 * @returns {boolean}
 */
function isSpellHeaderDimmed(headerPath, openPath) {
    return headerPath.length === 2 && headerPath[0] !== openPath[0];
}

/** Level suffixes on spell names (Regeneration I, ..., Regeneration True). */
const SPELL_LEVEL_SUFFIX = / (I|II|III|IV|V|VI|VII|VIII|IX|X|True)$/;

/**
 * A spell name without its level suffix, so one custom icon covers every level variant.
 * @param {string} name
 * @returns {string}
 */
function baseSpellName(name) {
    return String(name ?? "").replace(SPELL_LEVEL_SUFFIX, "").trim();
}

export function defineSpellsMain(CoreHUD) {
    const { ButtonPanelButton } = CoreHUD.ARGON.MAIN.BUTTONS;
    const { RMUActionButton, RMUEmptyButton, RMUActionPanel, createGuardedPanel } = createBaseClasses(CoreHUD.ARGON);

    /**
     * L3: An action button for a single spell.
     * Handles standard SCR (Casting).
     */
    class RMUSpellActionButton extends RMUActionButton {
        /**
         * @param {object} spell - The spell, with its _rawListInfo (from system/spells.js).
         * @param {Accordion} accordion - The panel's accordion.
         */
        constructor(spell, accordion) {
            super();
            this.spell = spell;
            this.accordion = accordion;
            if (spell) {
                this._listKey = spell._rawListInfo.listKey;
                this._listTypeKey = spell._rawListInfo.groupName ?? spell._rawListInfo.listType;
            }
        }

        /** Whether the spell also has an attack roll (it then shows its OB beside its SCR). */
        get _hasAttack() {
            return spellAttackBonus(this.spell) !== null;
        }

        get label() {
            return tf("ECH-RMU.Spell.Label", { name: spellDisplayName(this.spell), level: this.spell.level });
        }

        get icon() {
            // A custom icon is mapped to the spell's base name (without its level suffix), so
            // one mapping covers every level variant. The untranslated name is tried first,
            // then the name as shown.
            const customIcon = getUserIcon(baseSpellName(this.spell?.name)) ?? getUserIcon(baseSpellName(spellDisplayName(this.spell)));
            if (customIcon) return customIcon;

            // Fallback for all spells
            return ICONS.spells_muted;
        }

        get classes() {
            return [...super.classes, "ech-rmu-spell-tile"];
        }

        get hasTooltip() {
            return true;
        }

        async getTooltipData() {
            const s = this.spell;
            const { TEXT, NUMBER, BONUS } = DETAIL_FORMAT;

            // --- 1. BASE SPELL DETAILS (SCR) ---
            const duration = s._modifiedDuration?.duration || s._modifiedDuration?.dur?.duration || s.duration;
            const aoe = s._modifiedAoE?.aoe || s.aoe;
            const range = s._modifiedRange?.range || s.range;

            const details = [
                { label: t("ECH-RMU.Tooltip.ListType"), value: listTypeDisplayName(s.listType), format: TEXT },
                { label: t("ECH-RMU.Tooltip.Realms"), value: spellRealmsText(s), format: TEXT },
                { label: term("AoE"), value: aoe, format: TEXT },
                { label: term("Duration"), value: duration, format: TEXT },
                { label: term("Range"), value: range, format: TEXT },
                { label: term("SpellType"), value: s.spellType, format: TEXT },
                { label: term("SCR"), value: s.scr, format: BONUS },
                { label: term("Level"), value: s.level, format: NUMBER },
            ];

            // --- 2. ATTACK DETAILS (spells with an attack roll) ---
            if (this._hasAttack) {
                const attackDetails = [
                    { label: term("AttackType"), value: attackTableName(s.attack), format: TEXT },
                    { label: term("Specialization"), value: specializationName(s.spellAttack?.specialization), format: TEXT },
                    { label: term("Size"), value: s.spellAttack?.size, format: BONUS },
                    { label: term("Chart"), value: attackTableName(s.spellAttack?.chart?.name), format: TEXT },
                    { label: term("Fumble"), value: s.spellAttack?.fumble, format: NUMBER },
                    { label: t("ECH-RMU.Tooltip.IntervalRange"), value: s._modifiedRange?.range || s.range, format: TEXT },
                    { label: term("Targets"), value: s._modifiedAoE?.targets, format: NUMBER },
                    { label: term("TotalOB"), value: spellAttackBonus(s), format: BONUS },
                ];
                details.push(...attackDetails);
            }

            // The description is inserted as HTML, so the translated help text is escaped and
            // only the line breaks and bold markup come from here.
            const helpText = `<br><br><b>${escapeHTML(t("ECH-RMU.Spell.Help.LeftClick"))}</b> ${escapeHTML(t("ECH-RMU.Spell.Help.Cast"))}`;

            return buildTooltip({
                title: this.label,
                subtitle: tf("ECH-RMU.Spell.Subtitle", { level: s.level, list: spellListDisplayName(s) }),
                description: spellDescription(s) + helpText,
                details,
                properties: this._chips().map((c) => c.label),
            });
        }

        /**
         * The chips shown on the button, also listed as badges in its tooltip.
         * @returns {Array<{class: string, label: string}>}
         */
        _chips() {
            const chips = [];
            if (this.spell.isFavorite === true) chips.push({ class: "ech-rmu-spell-fav-chip", label: t("ECH-RMU.Chip.Favorite") });
            if (this.spell.isInstantaneous === true) chips.push({ class: "ech-rmu-instant-chip", label: term("Instantaneous") });
            if (this.spell.isSubconscious === true) chips.push({ class: "ech-rmu-subconscious-chip", label: term("Subconscious") });
            return chips;
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            this.element.classList.add("ech-rmu-button-relative");

            // Flags shown as chips and read by the search filters
            const isFav = this.spell.isFavorite === true;
            const isInstant = this.spell.isInstantaneous === true;
            const isSubconscious = this.spell.isSubconscious === true;

            // Apply data attributes so the Search Filter can find them
            this.element.dataset.favorite = isFav ? "true" : "false";
            this.element.dataset.isInstant = isInstant ? "true" : "false";
            this.element.dataset.isSubconscious = isSubconscious ? "true" : "false";

            buildChipContainer(this.element, this._chips());

            // --- SCR / OB OVERLAY ---
            const scrVal = formatBonus(this.spell.scr);
            if (this._hasAttack) {
                const obVal = formatBonus(spellAttackBonus(this.spell));

                applyValueOverlay(this.element, `${scrVal} / ${obVal}`, `${term("SCR")} / ${term("OB")}`);
                // Ensures custom CSS font-size reduction for dual values is applied
                this.element.classList.add("ech-rmu-combo-spell");
            } else {
                applyValueOverlay(this.element, scrVal ?? "", term("SCR"));
            }

            // Search text and accordion position.
            const listInfo = this.spell._rawListInfo || {};
            // The level is searchable as it reads on the button ("Lvl 5" in English).
            const levelText = tf("ECH-RMU.Spell.Level", { level: this.spell.level });
            // Both the text the player reads and the untranslated names are searchable.
            const nameNorm = [
                spellDisplayName(this.spell),
                spellListDisplayName(this.spell),
                listTypeDisplayName(listInfo.listType),
                this.spell.name,
                listInfo.listName,
                listInfo.realm,
                listInfo.listType,
                levelText,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            this.element.dataset.nameNorm = nameNorm;
            this.accordion.register(this.element, ACCORDION_ROLE.ITEM, [this._listTypeKey, this._listKey]);
        }

        /** Casts the spell (Spell Casting Roll). */
        async _onActivate() {
            await callHudTokenAction("rmuTokenSCRAction", this.spell);
        }
    }

    // --- Accordion Headers (Standard) ---
    /**
     * Level 2 accordion header: one spell list (for example "Hiding").
     */
    class RMUSpellListButton extends RMUActionButton {
        /**
         * @param {string} listName - The untranslated list name, which keys the accordion.
         * @param {string} title - The list name as the player reads it.
         * @param {string} listTypeKey - The untranslated list type.
         * @param {Accordion} accordion
         */
        constructor(listName, title, listTypeKey, accordion) {
            super();
            this._listName = listName;
            this._title = title;
            this._listTypeKey = listTypeKey;
            this.accordion = accordion;
        }
        get label() {
            return this._title;
        }
        get icon() {
            return "";
        }
        get hasTooltip() {
            return false;
        }
        get classes() {
            return [...super.classes, "ech-rmu-skill-header", "ech-rmu-spell-list-header"];
        }
        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;
            this.accordion.register(this.element, ACCORDION_ROLE.HEADER, [this._listTypeKey, this._listName]);
        }
        /** Opens this list's spells, or closes them if already open. */
        async _onActivate() {
            this.accordion.toggle([this._listTypeKey, this._listName]);
        }
    }

    /**
     * Level 1 accordion header: one spell list type (for example "Base").
     */
    class RMUSpellListTypeButton extends RMUActionButton {
        constructor(listType, accordion) {
            super();
            this._listType = listType;
            this.accordion = accordion;
        }
        get label() {
            return listTypeDisplayName(this._listType);
        }
        get icon() {
            return "";
        }
        get hasTooltip() {
            return false;
        }
        get classes() {
            return [...super.classes, "ech-rmu-skill-header", "ech-rmu-spell-type-header"];
        }
        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;
            this.accordion.register(this.element, ACCORDION_ROLE.HEADER, [this._listType]);
        }
        /** Opens this list type, or closes it (and any open list) if already open. */
        async _onActivate() {
            this.accordion.toggle([this._listType]);
        }
    }

    class RMUAllSpellsCategoryButton extends ButtonPanelButton {
        constructor() {
            super();
            this.title = term("Spells");
            this._icon = ICONS.spells;
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
            const allSpellsByListType = getGroupedSpells();

            if (!allSpellsByListType.size) {
                return createGuardedPanel("ech-rmu-spells-all", [new RMUEmptyButton(t("ECH-RMU.Empty.Spells"))]);
            }

            const sortedListTypes = Array.from(allSpellsByListType.keys()).sort(compareListTypes);

            const allButtons = [];
            const accordion = new Accordion({ isDimmed: isSpellHeaderDimmed });

            for (const listType of sortedListTypes) {
                const listMap = allSpellsByListType.get(listType);
                allButtons.push(new RMUSpellListTypeButton(listType, accordion));

                // Lists in the alphabetical order of the names the player reads.
                const titleOf = (listName) => spellListDisplayName(listMap.get(listName)[0]) || listName;
                const sortedListNames = Array.from(listMap.keys()).sort((a, b) => compareText(titleOf(a), titleOf(b)));

                for (const listName of sortedListNames) {
                    const spells = listMap.get(listName);
                    allButtons.push(new RMUSpellListButton(listName, titleOf(listName), listType, accordion));

                    for (const spell of spells) {
                        allButtons.push(new RMUSpellActionButton(spell, accordion));
                    }
                }
            }

            const spellFilters = [
                {
                    id: "fav",
                    dataKey: "favorite",
                    icon: ICONS.star,
                    tooltip: t("ECH-RMU.Filter.Favorites"),
                },
                {
                    id: "instant",
                    dataKey: "isInstant",
                    icon: ICONS.instant,
                    tooltip: t("ECH-RMU.Filter.Instantaneous"),
                },
                {
                    id: "subcon",
                    dataKey: "isSubconscious",
                    icon: ICONS.subconscious,
                    tooltip: t("ECH-RMU.Filter.Subconscious"),
                },
            ];

            // Clearing the search closes every list type.
            const search = new ListSearch({ filters: spellFilters, resetOnClear: true });
            return createGuardedPanel("ech-rmu-spells-all", allButtons, { accordion, search });
        }
    }

    class RMUSpellsActionPanel extends RMUActionPanel {
        get label() {
            return term("Spells");
        }
        async _getButtons() {
            return [new RMUAllSpellsCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMUSpellsActionPanel]);
}
