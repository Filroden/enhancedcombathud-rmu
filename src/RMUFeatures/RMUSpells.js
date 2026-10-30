/**
 * Defines the main Spellcasting panel (3-Level Nested Accordion)
 * Implements standard Spell Casting Rolls (SCR).
 */

import { ICONS, getUserIcon, RMUUtils, installListSearch, formatBonus } from "../RMUCore.js";
import { createBaseClasses } from "../ui/baseButtons.js";
import { RMUData } from "../RMUData.js";

// Global state helpers
const getOpenSpellState = RMUData.getOpenSpellState;
const setOpenSpellState = RMUData.setOpenSpellState;

/**
 * Applies visibility to the 3-level accordion based on global state.
 */
function applyAccordionVisibility(panelEl) {
    if (!panelEl) return;
    const { type: openType, name: openName } = getOpenSpellState();

    // L1 Headers
    panelEl.querySelectorAll(`.ech-rmu-spell-type-header`).forEach((h) => {
        const hType = h.dataset.listTypeKey || "";
        const isOpen = hType === openType;
        h.classList.toggle("open", isOpen);
        h.classList.toggle("closed", !isOpen);
    });

    // L2 Headers
    panelEl.querySelectorAll(`.ech-rmu-spell-list-header`).forEach((h) => {
        const hType = h.dataset.listTypeKey || "";
        const hName = h.dataset.listNameKey || "";
        const isMyParentOpen = hType === openType;
        const isMeOpen = isMyParentOpen && hName === openName;

        h.style.display = "";
        h.classList.toggle("open", isMeOpen);
        h.classList.toggle("closed", !isMeOpen);
        h.style.opacity = isMyParentOpen ? "1" : "0.6";
    });

    // L3 Tiles
    panelEl.querySelectorAll(`.ech-rmu-spell-tile`).forEach((t) => {
        const tType = t.dataset.listTypeKey || "";
        const tName = t.dataset.listNameKey || "";
        const isSearchHidden = t.classList.contains("hidden");
        const visible = tType === openType && tName === openName && !isSearchHidden;
        t.style.display = visible ? "" : "none";
    });
}

export function defineSpellsMain(CoreHUD) {
    const { ButtonPanelButton } = CoreHUD.ARGON.MAIN.BUTTONS;
    const { RMUActionButton, RMUEmptyButton, RMUActionPanel, createGuardedPanel } = createBaseClasses(CoreHUD.ARGON);

    /**
     * L3: An action button for a single spell.
     * Handles standard SCR (Casting).
     */
    class RMUSpellActionButton extends RMUActionButton {
        constructor(spell) {
            super();
            this.spell = spell;
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

            // Attributes
            const listInfo = this.spell._rawListInfo || {};
            const nameNorm = `${this.spell.name} ${listInfo.listName} ${listInfo.realm} ${listInfo.listType} Lvl ${this.spell.level}`.toLowerCase();

            this.element.dataset.listTypeKey = this._listTypeKey;
            this.element.dataset.listNameKey = this._listKey;
            this.element.dataset.nameNorm = nameNorm;
            this.element.dataset.catKey = this._listKey;

            const { type: openType, name: openName } = getOpenSpellState();
            const isVisible = this._listTypeKey === openType && this._listKey === openName;
            this.element.style.display = isVisible ? "" : "none";
        }

        /** Casts the spell (Spell Casting Roll). */
        async _onActivate() {
            await RMUUtils.rmuTokenActionWrapper(ui.ARGON?._token, "rmuTokenSCRAction", this.spell);
        }
    }

    // --- Accordion Headers (Standard) ---
    class RMUSpellListButton extends RMUActionButton {
        constructor(listName, listTypeKey) {
            super();
            this._listName = listName;
            this._listTypeKey = listTypeKey;
            this._panelEl = null;
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
            const { type: openType, name: openName } = getOpenSpellState();
            const isOpen = openType === this._listTypeKey && openName === this._listName;
            return [...super.classes, "ech-rmu-skill-header", "ech-rmu-spell-list-header", isOpen ? "open" : "closed"];
        }
        _bindPanel(panelEl) {
            this._panelEl = panelEl;
        }
        async _renderInner() {
            await super._renderInner();
            if (this.element) {
                this.element.dataset.listTypeKey = this._listTypeKey;
                this.element.dataset.listNameKey = this._listName;
                this.element.dataset.nameNorm = this.label.toLowerCase();
                this.element.dataset.catKey = this._listName;
            }
        }
        /** Opens this list's spells, or closes them if already open. */
        async _onActivate() {
            const { name: openName } = getOpenSpellState();
            const isOpen = openName === this._listName;
            setOpenSpellState(this._listTypeKey, isOpen ? null : this._listName);
            applyAccordionVisibility(this._panelEl);
        }
    }

    class RMUSpellListTypeButton extends RMUActionButton {
        constructor(listType) {
            super();
            this._listType = listType;
            this._panelEl = null;
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
            const { type: openType } = getOpenSpellState();
            const isOpen = openType === this._listType;
            return [...super.classes, "ech-rmu-skill-header", "ech-rmu-spell-type-header", isOpen ? "open" : "closed"];
        }
        _bindPanel(panelEl) {
            this._panelEl = panelEl;
        }
        async _renderInner() {
            await super._renderInner();
            if (this.element) {
                this.element.dataset.listTypeKey = this._listType;
                this.element.dataset.nameNorm = this.label.toLowerCase();
                this.element.dataset.catKey = this._listType;
            }
        }
        /** Opens this list type, or closes it (and any open list) if already open. */
        async _onActivate() {
            const { type: openType } = getOpenSpellState();
            const isOpen = openType === this._listType;
            setOpenSpellState(isOpen ? null : this._listType, null);
            applyAccordionVisibility(this._panelEl);
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
            setOpenSpellState(null, null);
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
            const allHeaderInstances = [];

            for (const listType of sortedListTypes) {
                const listMap = allSpellsByListType.get(listType);
                const l1Button = new RMUSpellListTypeButton(listType);
                allButtons.push(l1Button);
                allHeaderInstances.push(l1Button);

                const sortedListNames = Array.from(listMap.keys()).sort((a, b) => a.localeCompare(b));

                for (const listName of sortedListNames) {
                    const spells = listMap.get(listName);
                    const l2Button = new RMUSpellListButton(listName, listType);
                    allButtons.push(l2Button);
                    allHeaderInstances.push(l2Button);

                    for (const spell of spells) {
                        allButtons.push(new RMUSpellActionButton(spell));
                    }
                }
            }

            const panel = createGuardedPanel("ech-rmu-spells-all", allButtons);

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

            installListSearch(panel, ".ech-rmu-spell-tile", ".ech-rmu-spell-type-header, .ech-rmu-spell-list-header", "spell", {
                filters: spellFilters,
                onClear: (panelEl) => {
                    if (!panelEl) return;
                    setOpenSpellState(null, null);
                    applyAccordionVisibility(panelEl);
                    const summaryEl = panelEl.querySelector(".ech-rmu-search-summary");
                    if (summaryEl) summaryEl.style.display = "none";
                },
            });

            const panelEl = panel.element;
            allHeaderInstances.forEach((h) => h._bindPanel(panelEl));
            applyAccordionVisibility(panelEl);

            return panel;
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
