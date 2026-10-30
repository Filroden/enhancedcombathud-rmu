/**
 * RMUFeatures/RMUItems.js
 * Defines the Items panel. Items are accordion headers; opening one shows its spells, which
 * CSS ordering places on a row above the items.
 */

import { ICONS, RMUUtils, UIGuards } from "../RMUCore.js";
import { createEquipToggle } from "../ui/dom.js";
import { createBaseClasses } from "../ui/baseButtons.js";
import { Accordion, ACCORDION_ROLE } from "../ui/accordion.js";
import { DETAIL_FORMAT, buildTooltip } from "../ui/tooltip.js";
import { hudToken } from "../system/context.js";
import { callTokenAction } from "../system/api.js";
import { ensureExtendedTokenData, ensureRMUReady } from "../system/derive.js";
import { getItemSpellGroups } from "../system/spells.js";

/** Equipment states the system uses for an item that is owned but not in use. */
const NOT_IN_USE_STATES = new Set(["carried", "none"]);

/**
 * Whether an item is equipped (worn or held), as opposed to only carried.
 * @param {Item|undefined} itemDoc - The item document.
 * @returns {boolean}
 */
function isItemEquipped(itemDoc) {
    const eq = itemDoc?.system?.equipped;
    return Boolean(eq) && !NOT_IN_USE_STATES.has(eq);
}

/**
 * While an item's spells are open, the other items are dimmed so the open one stands out.
 * @param {string[]} headerPath - [itemId].
 * @param {string[]} openPath - The accordion's open path.
 * @returns {boolean}
 */
function isItemDimmed(headerPath, openPath) {
    return openPath.length > 0 && headerPath[0] !== openPath[0];
}

/**
 * Shows the full-width spacer only while a spell row is open, so the spells wrap onto their
 * own row above the items.
 * @param {HTMLElement} panelEl
 * @param {boolean} anySpellShown
 */
function showSpacerWhenOpen(panelEl, anySpellShown) {
    const spacer = panelEl.querySelector(".ech-rmu-items-flex-break");
    if (spacer) spacer.style.display = anySpellShown ? "" : "none";
}

export function defineMagicItemsMain(CoreHUD) {
    const { ActionButton, ButtonPanelButton } = CoreHUD.ARGON.MAIN.BUTTONS;
    const { RMUActionButton, RMUActionPanel, createGuardedPanel } = createBaseClasses(CoreHUD.ARGON);

    /**
     * TIER 2 (Top Row): The Spell Action Button
     */
    class RMUItemSpellActionButton extends RMUActionButton {
        constructor(spell, sl, itemGroup, itemDoc, accordion) {
            super();
            this.spell = spell;
            this.sl = sl; // Store the spell list wrapper
            this.itemGroup = itemGroup;
            this.itemDoc = itemDoc;
            this.accordion = accordion;
        }

        /**
         * Item spells can only be cast while the item is equipped, and not at all when the
         * system marks the list as uncastable by the wearer.
         */
        get disabled() {
            return !isItemEquipped(this.itemDoc) || this.sl?.castable === false;
        }

        get label() {
            return this.spell?.name ?? "Item Spell";
        }
        get icon() {
            return ICONS.spells;
        }

        get classes() {
            return [...super.classes, "ech-rmu-item-spell-button"];
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            UIGuards.attachButtonInteractionGuards(this);
            this.accordion.register(this.element, ACCORDION_ROLE.ITEM, [this.itemGroup.groupName]);

            const value = this.spell?.scr;
            if (value !== undefined && value !== null) {
                RMUUtils.applyValueOverlay(this.element, value, "SCR");
            }
        }

        get hasTooltip() {
            return true;
        }

        async getTooltipData() {
            const s = this.spell ?? {};
            const sl = this.sl ?? {};

            // Format Charges
            let charges = game.i18n.localize(sl._usageKey ?? "");
            if (sl._useMax !== undefined && sl._useMax !== null) {
                charges = `${sl._useLeft ?? 0} / ${sl._useMax}`;
            }

            const { TEXT, NUMBER, BONUS } = DETAIL_FORMAT;
            return buildTooltip({
                title: this.label,
                subtitle: this.itemDoc?.name ?? s.spellList ?? "Item Spell",
                description: s._translatedDescription ?? s.description ?? "",
                details: [
                    { label: "Level", value: s.level, format: NUMBER },
                    { label: "Range", value: s._modifiedRange?.range ?? s.range, format: TEXT },
                    { label: "Area of Effect", value: s._modifiedAoE?.aoe ?? s.aoe, format: TEXT },
                    { label: "Duration", value: s._modifiedDuration?.duration ?? s.duration, format: TEXT },
                    { label: "Casting Mode", value: s.castingMode, format: TEXT },
                    { label: "Total SCR", value: s.scr, format: BONUS },
                    { label: "Charges", value: charges, format: TEXT },
                    { label: "Castable by Wearer", value: sl.castable === false ? "No" : "Yes", format: TEXT },
                ],
            });
        }

        async _onActivate() {
            const token = hudToken();
            if (!token) return;
            await ensureExtendedTokenData();
            await callTokenAction(token, "rmuTokenSCRAction", this.spell);
        }
    }

    /**
     * TIER 2 (Bottom Row): The Physical Item Button
     */
    class RMUItemCategoryButton extends RMUActionButton {
        constructor(itemGroup, actor, accordion) {
            super();
            this.itemGroup = itemGroup;
            this.itemDoc = actor.items.get(itemGroup.groupName);
            this._spells = (itemGroup.spellLists || []).flatMap((sl) => sl.spells || []);
            this.accordion = accordion;
            /** This item's spell buttons, re-rendered with it after an equip toggle. */
            this.spellButtons = [];
        }

        get label() {
            return this.itemGroup.groupLabel || this.itemDoc?.name || "Magic Item";
        }
        get icon() {
            return this.itemDoc?.img || ICONS.items;
        }
        get _equipped() {
            return isItemEquipped(this.itemDoc);
        }

        get classes() {
            return [...super.classes, "ech-rmu-item-category-button"];
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            UIGuards.attachButtonInteractionGuards(this);
            this.accordion.register(this.element, ACCORDION_ROLE.HEADER, [this.itemGroup.groupName]);

            if (this.itemDoc) {
                const toggle = createEquipToggle({
                    equipped: this._equipped,
                    onToggle: (e) => this._onToggleEquip(e),
                });

                const nameContainer = this.element.querySelector(".name");
                if (nameContainer) {
                    nameContainer.appendChild(toggle);
                } else {
                    this.element.appendChild(toggle);
                }
            }
        }

        /**
         * Toggles the item's equipped state, then re-renders this item and its spells in place.
         * A full HUD refresh would rebuild every panel and close this one; the item document
         * is updated in place by Foundry, so re-rendering reads the new state directly.
         */
        async _onToggleEquip() {
            const token = hudToken();
            if (!token || !this.itemDoc) return;
            const toggled = await callTokenAction(token, "rmuTokenToggleEquippedState", this.itemDoc.id);
            if (!toggled) return; // The wrapper has already reported the failure.
            await Promise.all([this.render(), ...this.spellButtons.map((b) => b.render())]);
        }

        /** Opens this item's spells, or closes them if they are already open. */
        async _onActivate() {
            this.accordion.toggle([this.itemGroup.groupName]);
        }

        get hasTooltip() {
            return true;
        }

        async getTooltipData() {
            const sys = this.itemDoc?.system ?? {};

            const { TEXT, NUMBER } = DETAIL_FORMAT;
            return buildTooltip({
                title: this.label,
                subtitle: "Magic Item",
                description: sys._notes || sys.notes || "",
                details: [
                    { label: "Level", value: sys.magic?.level, format: NUMBER },
                    { label: "Weight", value: `${sys.weight ?? 0} ${sys.weightUnit ?? ""}`.trim(), format: TEXT },
                    { label: "Spells", value: this._spells.length, format: NUMBER },
                ],
            });
        }
    }

    /**
     * Dummy button to force the layout break between Spells and Items
     */
    class RMUFlexBreakButton extends ActionButton {
        get label() {
            return "";
        }
        get icon() {
            return "";
        }
        get classes() {
            return [...super.classes, "ech-rmu-items-flex-break"];
        }
        /**
         * Renders no template: the element is an empty full-width spacer (sized in CSS). It
         * starts hidden; the panel's accordion shows it while an item's spells are open.
         */
        async _renderInner() {
            if (!this.element) return;
            this.element.style.display = "none";
        }
    }

    /**
     * TIER 1: Master "ITEMS" button returning the unified layout panel
     */
    class RMUItemsMasterCategoryButton extends ButtonPanelButton {
        constructor(itemSpells, actor) {
            super();
            this.title = "ITEMS";
            this._icon = ICONS.items;
            this.itemSpells = itemSpells;
            this._actor = actor;
        }

        get label() {
            return this.title;
        }
        get icon() {
            return this._icon;
        }
        get hasContents() {
            return this.itemSpells.length > 0;
        }
        get isInteractive() {
            return true;
        }

        async _renderInner() {
            await super._renderInner();
            UIGuards.attachButtonInteractionGuards(this);
        }

        async _getPanel() {
            const buttons = [];
            // Item buttons only toggle their own spells; "open"/"closed" classes are not used here.
            const accordion = new Accordion({ isDimmed: isItemDimmed, afterApply: showSpacerWhenOpen, headerStateClasses: false });

            for (const group of this.itemSpells) {
                const itemBtn = new RMUItemCategoryButton(group, this._actor, accordion);
                buttons.push(itemBtn);

                for (const sl of group.spellLists || []) {
                    for (const spell of sl.spells || []) {
                        const spellBtn = new RMUItemSpellActionButton(spell, sl, group, itemBtn.itemDoc, accordion);
                        itemBtn.spellButtons.push(spellBtn);
                        buttons.push(spellBtn);
                    }
                }
            }

            buttons.push(new RMUFlexBreakButton());

            return createGuardedPanel("ech-rmu-magicitems-master", buttons, { accordion });
        }
    }

    /**
     * TIER 0: The main panel definition mounted to CoreHUD.
     */
    class RMUMagicItemsActionPanel extends RMUActionPanel {
        get label() {
            return "ITEMS";
        }

        async _getButtons() {
            const actor = hudToken()?.actor;
            if (!actor) return [];

            await ensureRMUReady();
            const itemSpells = getItemSpellGroups(actor);
            if (itemSpells.length === 0) return [];

            return [new RMUItemsMasterCategoryButton(itemSpells, actor)];
        }
    }

    CoreHUD.defineMainPanels([RMUMagicItemsActionPanel]);
}
