/**
 * Defines the main Spellcasting panel: a two-level accordion (list type, then list) over the
 * spell buttons, with the shared search bar. Implements standard Spell Casting Rolls (SCR).
 */

import { ICONS, getUserIcon, RMUUtils, formatBonus } from "../RMUCore.js";
import { createBaseClasses } from "../ui/baseButtons.js";
import { Accordion, ACCORDION_ROLE } from "../ui/accordion.js";
import { ListSearch } from "../ui/search.js";
import { RMUData } from "../RMUData.js";

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
         * @param {object} spell - The spell, with its _rawListInfo (from RMUData).
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
            this._relatedAttack = this._findRelatedAttack();
        }

        /**
         * Finds the attack data.
         */
        _findRelatedAttack() {
            if (!this.spell) return null;
            const attacks = RMUData.getDirectedSpellAttacks();
            return attacks.find((a) => a.name === this.spell.name);
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
            const a = this._relatedAttack;

            // --- 1. BASE SPELL DETAILS (SCR) ---
            const duration = s._modifiedDuration?.duration || s._modifiedDuration?.dur?.duration || s.duration;
            const aoe = s._modifiedAoE?.aoe || s.aoe;
            const range = s._modifiedRange?.range || s.range;

            const details = [
                { label: "List type", value: s.listType },
                { label: "Realm(s)", value: s.realms },
                { label: "AoE", value: aoe },
                { label: "Duration", value: duration },
                { label: "Range", value: range },
                { label: "Spell type", value: s.spellType },
                { label: "SCR", value: s.scr },
                { label: "Level", value: s.level },
            ];

            // --- 2. COMBO ATTACK DETAILS ---
            if (a) {
                const attackDetails = [
                    { label: "Attack Type", value: a.attack },
                    { label: "Specialization", value: a.spellAttack?.specialization },
                    { label: "Size", value: a.spellAttack?.size },
                    { label: "Chart", value: a.spellAttack?.chart?.name },
                    { label: "Fumble", value: a.spellAttack?.fumble },
                    { label: "Range (interval)", value: a._modifiedRange?.range || a.range },
                    { label: "AoE", value: a._modifiedAoE?.range || a.AoE },
                    { label: "Targets", value: a._modifiedAoE?.targets },
                    { label: "Total OB", value: a._totalBonus ?? a.totalBonus },
                ];
                details.push(...attackDetails);
            }

            const helpText = "<br><br><b>Left-Click:</b> Cast Spell (SCR)";

            return {
                title: this.label,
                subtitle: `Lvl ${s.level} - ${s.spellList}`,
                description: (s.description || "") + helpText,
                details: RMUUtils.formatTooltipDetails(details.filter((x) => x.value !== undefined && x.value !== null && x.value !== "")),
            };
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            this.element.classList.add("ech-rmu-button-relative");

            // Chips
            const modifiersStr = this.spell.modifiers || "";
            const isFav = this.spell.isFavorite === true;
            const isInstant = modifiersStr.includes("*");
            const isSubconscious = (this.spell.spellType || "").substring(1).includes("s");

            // Apply data attributes so the Search Filter can find them
            this.element.dataset.favorite = isFav ? "true" : "false";
            this.element.dataset.isInstant = isInstant ? "true" : "false";
            this.element.dataset.isSubconscious = isSubconscious ? "true" : "false";

            const chips = [];
            if (isFav) chips.push({ class: "ech-rmu-spell-fav-chip", title: "Favorite" });
            if (isInstant) chips.push({ class: "ech-rmu-instant-chip", title: "Instantaneous" });
            if (isSubconscious) chips.push({ class: "ech-rmu-subconscious-chip", title: "Sub-conscious" });
            RMUUtils.buildChipContainer(this.element, chips);

            // --- SCR / OB OVERLAY ---
            const scrVal = formatBonus(this.spell.scr);
            if (this._relatedAttack) {
                const rawOb = this._relatedAttack._totalBonus ?? this._relatedAttack.totalBonus;
                const obVal = formatBonus(rawOb);

                RMUUtils.applyValueOverlay(this.element, `${scrVal} / ${obVal}`, "SCR / OB");
                // Ensures custom CSS font-size reduction for dual values is applied
                this.element.classList.add("ech-rmu-combo-spell");
            } else {
                RMUUtils.applyValueOverlay(this.element, scrVal ?? "", "SCR");
            }

            // Search text and accordion position.
            const listInfo = this.spell._rawListInfo || {};
            const nameNorm = `${this.spell.name} ${listInfo.listName} ${listInfo.realm} ${listInfo.listType} Lvl ${this.spell.level}`.toLowerCase();
            this.element.dataset.nameNorm = nameNorm;
            this.accordion.register(this.element, ACCORDION_ROLE.ITEM, [this._listTypeKey, this._listKey]);
        }

        /** Casts the spell (Spell Casting Roll). */
        async _onActivate() {
            await RMUUtils.rmuTokenActionWrapper(ui.ARGON?._token, "rmuTokenSCRAction", this.spell);
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
            await RMUData.ensureRMUReady();
            const allSpellsByListType = RMUData.getGroupedSpellsForHUD();

            if (!allSpellsByListType.size) {
                return createGuardedPanel("ech-rmu-spells-all", [new RMUEmptyButton("No spells known")]);
            }

            const listOrder = {
                Innate: 0,
                Base: 1,
                Open: 2,
                Closed: 3,
                Arcane: 4,
                Restricted: 5,
            };
            const sortedListTypes = Array.from(allSpellsByListType.keys()).sort((a, b) => {
                const rankA = listOrder[a] ?? 99;
                const rankB = listOrder[b] ?? 99;
                return rankA - rankB;
            });

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
