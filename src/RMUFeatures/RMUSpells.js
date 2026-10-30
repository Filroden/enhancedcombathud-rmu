/**
 * Defines the main Spellcasting panel: a two-level accordion (list type, then list) over the
 * spell buttons, with the shared search bar. Implements standard Spell Casting Rolls (SCR).
 */

import { ICONS, getUserIcon } from "../icons.js";
import { formatBonus } from "../format.js";
import { applyValueOverlay, buildChipContainer } from "../ui/dom.js";
import { createBaseClasses } from "../ui/baseButtons.js";
import { Accordion, ACCORDION_ROLE } from "../ui/accordion.js";
import { ListSearch } from "../ui/search.js";
import { DETAIL_FORMAT, buildTooltip } from "../ui/tooltip.js";
import { callHudTokenAction } from "../system/api.js";
import { ensureRMUReady } from "../system/derive.js";
import { compareListTypes, getGroupedSpells, spellAttackBonus, spellRealmsText } from "../system/spells.js";

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
            return `${this.spell.name} (Lvl ${this.spell.level})`;
        }

        get icon() {
            // Extract the base spell name
            const spellName = this.spell?.name || "";
            const baseName = spellName.replace(/ (I|II|III|IV|V|VI|VII|VIII|IX|X|True)$/, "").trim();

            // Check if the user has configured a custom icon
            const customIcon = getUserIcon(baseName);
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
                { label: "List type", value: s.listType, format: TEXT },
                { label: "Realm(s)", value: spellRealmsText(s), format: TEXT },
                { label: "AoE", value: aoe, format: TEXT },
                { label: "Duration", value: duration, format: TEXT },
                { label: "Range", value: range, format: TEXT },
                { label: "Spell type", value: s.spellType, format: TEXT },
                { label: "SCR", value: s.scr, format: BONUS },
                { label: "Level", value: s.level, format: NUMBER },
            ];

            // --- 2. ATTACK DETAILS (spells with an attack roll) ---
            if (this._hasAttack) {
                const attackDetails = [
                    { label: "Attack Type", value: s.attack, format: TEXT },
                    { label: "Specialization", value: s.spellAttack?.specialization, format: TEXT },
                    { label: "Size", value: s.spellAttack?.size, format: BONUS },
                    { label: "Chart", value: s.spellAttack?.chart?.name, format: TEXT },
                    { label: "Fumble", value: s.spellAttack?.fumble, format: NUMBER },
                    { label: "Range (interval)", value: s._modifiedRange?.range || s.range, format: TEXT },
                    { label: "Targets", value: s._modifiedAoE?.targets, format: NUMBER },
                    { label: "Total OB", value: spellAttackBonus(s), format: BONUS },
                ];
                details.push(...attackDetails);
            }

            const helpText = "<br><br><b>Left-Click:</b> Cast Spell (SCR)";

            return buildTooltip({
                title: this.label,
                subtitle: `Lvl ${s.level} - ${s.spellList}`,
                description: (s.description || "") + helpText,
                details,
            });
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            this.element.classList.add("ech-rmu-button-relative");

            // Chips
            const isFav = this.spell.isFavorite === true;
            const isInstant = this.spell.isInstantaneous === true;
            const isSubconscious = this.spell.isSubconscious === true;

            // Apply data attributes so the Search Filter can find them
            this.element.dataset.favorite = isFav ? "true" : "false";
            this.element.dataset.isInstant = isInstant ? "true" : "false";
            this.element.dataset.isSubconscious = isSubconscious ? "true" : "false";

            const chips = [];
            if (isFav) chips.push({ class: "ech-rmu-spell-fav-chip", title: "Favorite" });
            if (isInstant) chips.push({ class: "ech-rmu-instant-chip", title: "Instantaneous" });
            if (isSubconscious) chips.push({ class: "ech-rmu-subconscious-chip", title: "Sub-conscious" });
            buildChipContainer(this.element, chips);

            // --- SCR / OB OVERLAY ---
            const scrVal = formatBonus(this.spell.scr);
            if (this._hasAttack) {
                const obVal = formatBonus(spellAttackBonus(this.spell));

                applyValueOverlay(this.element, `${scrVal} / ${obVal}`, "SCR / OB");
                // Ensures custom CSS font-size reduction for dual values is applied
                this.element.classList.add("ech-rmu-combo-spell");
            } else {
                applyValueOverlay(this.element, scrVal ?? "", "SCR");
            }

            // Search text and accordion position.
            const listInfo = this.spell._rawListInfo || {};
            const nameNorm = `${this.spell.name} ${listInfo.listName} ${listInfo.realm} ${listInfo.listType} Lvl ${this.spell.level}`.toLowerCase();
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
        constructor(listName, listTypeKey, accordion) {
            super();
            this._listName = listName;
            this._listTypeKey = listTypeKey;
            this.accordion = accordion;
        }
        get label() {
            return this._listName;
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
            return this._listType;
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
            this.title = "SPELLS";
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
                return createGuardedPanel("ech-rmu-spells-all", [new RMUEmptyButton("No spells known")]);
            }

            const sortedListTypes = Array.from(allSpellsByListType.keys()).sort(compareListTypes);

            const allButtons = [];
            const accordion = new Accordion({ isDimmed: isSpellHeaderDimmed });

            for (const listType of sortedListTypes) {
                const listMap = allSpellsByListType.get(listType);
                allButtons.push(new RMUSpellListTypeButton(listType, accordion));

                const sortedListNames = Array.from(listMap.keys()).sort((a, b) => a.localeCompare(b));

                for (const listName of sortedListNames) {
                    const spells = listMap.get(listName);
                    allButtons.push(new RMUSpellListButton(listName, listType, accordion));

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
                    tooltip: "Show Only Favorites",
                },
                {
                    id: "instant",
                    dataKey: "isInstant",
                    icon: ICONS.instant,
                    tooltip: "Show Only Instantaneous Spells",
                },
                {
                    id: "subcon",
                    dataKey: "isSubconscious",
                    icon: ICONS.subconscious,
                    tooltip: "Show Only Sub-conscious Spells",
                },
            ];

            // Clearing the search closes every list type.
            const search = new ListSearch({ filters: spellFilters, resetOnClear: true });
            return createGuardedPanel("ech-rmu-spells-all", allButtons, { accordion, search });
        }
    }

    class RMUSpellsActionPanel extends RMUActionPanel {
        get label() {
            return "SPELLS";
        }
        async _getButtons() {
            return [new RMUAllSpellsCategoryButton()];
        }
    }

    CoreHUD.defineMainPanels([RMUSpellsActionPanel]);
}
