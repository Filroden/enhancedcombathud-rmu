/**
 * RMUFeatures/RMUItems.js
 * Defines the Items panel using CSS ordering to display spells above items.
 */

import { ICONS, RMUUtils, UIGuards } from "../RMUCore.js";
import { RMUData } from "../RMUData.js";

// Global state for the magic items panel
let openItemGroupId = null;

/**
 * Applies visibility to the spells and the flex-break based on the open item.
 */
function applyItemAccordionVisibility(panelEl) {
    if (!panelEl) return;

    let anySpellVisible = false;

    // 1. Toggle Spell Visibility
    panelEl.querySelectorAll(".rmu-item-spell-button").forEach((el) => {
        const isVisible = el.dataset.groupId === openItemGroupId;
        el.style.display = isVisible ? "" : "none";
        if (isVisible) anySpellVisible = true;
    });

    // 2. Toggle Flex Break
    const flexBreak = panelEl.querySelector(".rmu-items-flex-break");
    if (flexBreak) {
        flexBreak.style.display = anySpellVisible ? "" : "none";
    }

    // 3. Highlight Active Item
    panelEl.querySelectorAll(".rmu-item-category-button").forEach((el) => {
        const isActive = el.dataset.groupId === openItemGroupId;
        el.style.opacity = openItemGroupId && !isActive ? "0.6" : "1";
    });
}

export function defineMagicItemsMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ActionButton, ButtonPanelButton } = ARGON.MAIN.BUTTONS;

    /**
     * TIER 2 (Top Row): The Spell Action Button
     */
    class RMUItemSpellActionButton extends ActionButton {
        constructor(spell, itemGroup, itemDoc) {
            super();
            this.spell = spell;
            this.itemGroup = itemGroup;
            this.itemDoc = itemDoc;
        }

        get isInteractive() {
            return true;
        }

        // Renamed to avoid being overwritten by the Argon base constructor
        get _isDisabled() {
            const eq = this.itemDoc?.system?.equipped;
            // RMU items can be "equipped", "worn", "1h", "2h". Anything other than carried/none is equipped.
            return !eq || eq === "carried" || eq === "none";
        }

        get label() {
            return this.spell?.name ?? "Item Spell";
        }
        get icon() {
            return ICONS.spells;
        }

        get classes() {
            const c = super.classes.slice().filter((cls) => cls !== "disabled");
            if (this._isDisabled) c.push("disabled");
            c.push("rmu-item-spell-button");
            return c;
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            UIGuards.attachButtonInteractionGuards(this);

            this.element.dataset.groupId = this.itemGroup.groupName;
            this.element.dataset.tooltipDirection = "UP";

            const isVisible = this.itemGroup.groupName === openItemGroupId;
            this.element.style.display = isVisible ? "" : "none";

            // Explicitly toggle the visual class using our custom getter
            this.element.classList.toggle("disabled", this._isDisabled);

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
            const details = [
                { label: "Level", value: s.level },
                { label: "Range", value: s._modifiedRange?.range ?? s.range },
                { label: "Area of Effect", value: s._modifiedAoE?.aoe ?? s.aoe },
                { label: "Duration", value: s._modifiedDuration?.duration ?? s.duration },
                { label: "Casting Mode", value: s.castingMode },
                { label: "Total SCR", value: s.scr },
            ].filter((x) => x.value !== undefined && x.value !== null && x.value !== "");

            return {
                title: this.label,
                subtitle: this.itemDoc?.name ?? s.spellList ?? "Item Spell",
                description: s._translatedDescription ?? s.description ?? "",
                details: RMUUtils.formatTooltipDetails(details),
            };
        }

        async _onMouseDown(event) {
            if (event.button !== 0 || this._isDisabled) return;
            event.preventDefault();
            event.stopPropagation();
            const token = ui.ARGON?._token;
            if (!token) return;
            await RMUData.ensureExtendedTokenData();
            await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenSCRAction", this.spell);
        }

        // Silently catch native Argon click routing
        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }
    }

    /**
     * TIER 2 (Bottom Row): The Physical Item Button
     */
    class RMUItemCategoryButton extends ActionButton {
        constructor(itemGroup, actor) {
            super();
            this.itemGroup = itemGroup;
            this.itemDoc = actor.items.get(itemGroup.groupName);
            this._panelEl = null;
        }

        get label() {
            return this.itemGroup.groupLabel || this.itemDoc?.name || "Magic Item";
        }
        get icon() {
            return this.itemDoc?.img || ICONS.items;
        }
        get isInteractive() {
            return true;
        }

        get _equipped() {
            const eq = this.itemDoc?.system?.equipped;
            return !!(eq && eq !== "carried" && eq !== "none");
        }

        get classes() {
            return [...super.classes, "rmu-item-category-button"];
        }

        _bindPanel(panelEl) {
            this._panelEl = panelEl;
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            UIGuards.attachButtonInteractionGuards(this);
            this.element.dataset.groupId = this.itemGroup.groupName;

            const isActive = this.itemGroup.groupName === openItemGroupId;
            this.element.style.opacity = openItemGroupId && !isActive ? "0.6" : "1";

            if (this.itemDoc) {
                const toggle = document.createElement("div");
                toggle.className = "rmu-equip-toggle";

                const iconSrc = this._equipped ? ICONS.equip_closed : ICONS.equip_open;
                toggle.innerHTML = `<img src="${iconSrc}" class="rmu-equip-icon" alt="Toggle Equip"/>`;

                toggle.classList.toggle("equipped", this._equipped);
                toggle.title = this._equipped ? "Click to Unequip" : "Click to Equip";

                toggle.addEventListener("pointerdown", (e) => e.stopImmediatePropagation());
                toggle.addEventListener("click", (e) => {
                    e.stopImmediatePropagation();
                    this._onToggleEquip(e);
                });

                const nameContainer = this.element.querySelector(".name");
                if (nameContainer) {
                    nameContainer.appendChild(toggle);
                } else {
                    this.element.appendChild(toggle);
                }
            }
        }

        async _onToggleEquip(event) {
            const token = ui.ARGON?._token;
            if (!token || !this.itemDoc) return;
            try {
                await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenToggleEquippedState", this.itemDoc.id);
                ui.ARGON?.refresh?.();
            } catch (err) {
                console.error("[ECH-RMU] Failed to toggle item equip state", err);
            }
        }

        async _onMouseDown(event) {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();

            openItemGroupId = openItemGroupId === this.itemGroup.groupName ? null : this.itemGroup.groupName;
            applyItemAccordionVisibility(this._panelEl);
        }

        // Silently catch native Argon click routing
        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
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
            return [...super.classes, "rmu-items-flex-break"];
        }
        async _renderInner() {
            if (!this.element) return;
            this.element.style.flexBasis = "100%";
            this.element.style.height = "0px";
            this.element.style.minHeight = "0px";
            this.element.style.margin = "0px";
            this.element.style.padding = "0px";
            this.element.style.border = "none";
            this.element.style.display = openItemGroupId ? "" : "none";
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
            const allItemInstances = [];

            openItemGroupId = null; // Reset state when reopening the panel

            for (const group of this.itemSpells) {
                // Generate the item button
                const itemBtn = new RMUItemCategoryButton(group, this._actor);
                buttons.push(itemBtn);
                allItemInstances.push(itemBtn);

                // Generate the spell buttons
                const spells = (group.spellLists || []).flatMap((sl) => sl.spells || []);
                for (const spell of spells) {
                    buttons.push(new RMUItemSpellActionButton(spell, group, this._actor.items.get(group.groupName)));
                }
            }

            buttons.push(new RMUFlexBreakButton());

            const panel = new ButtonPanel({ id: "rmu-magicitems-master", buttons });
            UIGuards.attachPanelInteractionGuards(panel);

            // Bind the panel reference to the items so they can trigger DOM updates
            const panelEl = panel.element;
            allItemInstances.forEach((h) => h._bindPanel(panelEl));

            return panel;
        }
    }

    /**
     * TIER 0: The main panel definition mounted to CoreHUD.
     */
    class RMUMagicItemsActionPanel extends ActionPanel {
        get label() {
            return "ITEMS";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }

        async _getButtons() {
            const actor = ui.ARGON?._token?.actor;
            if (!actor) return [];

            await RMUData.ensureRMUReady();
            const itemSpells = (actor.system._spells || []).filter((s) => s.kind === "item");
            if (itemSpells.length === 0) return [];

            return [new RMUItemsMasterCategoryButton(itemSpells, actor)];
        }
    }

    CoreHUD.defineMainPanels([RMUMagicItemsActionPanel]);
}
