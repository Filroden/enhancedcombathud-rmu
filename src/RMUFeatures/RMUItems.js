/**
 * RMUFeatures/RMUItems.js
 * Defines the Items panel using a strict 3-tier nested hierarchy to prevent horizontal sprawl.
 */

import { ICONS, RMUUtils, UIGuards } from "../RMUCore.js";
import { RMUData } from "../RMUData.js";

export function defineMagicItemsMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;

    /**
     * TIER 3: An action button representing a single spell castable from an item.
     * @augments ActionButton
     */
    class RMUItemSpellActionButton extends ActionButton {
        constructor(spell, itemDoc) {
            super();
            this.spell = spell;
            this.itemDoc = itemDoc;
        }

        get isInteractive() {
            return true;
        }

        get disabled() {
            return this.itemDoc?.system?.equipped !== "equipped";
        }

        get label() {
            return this.spell?.name ?? "Item Spell";
        }

        get icon() {
            return ICONS.spells;
        }

        get classes() {
            const c = super.classes.slice().filter((cls) => cls !== "disabled");
            if (this.disabled) c.push("disabled");
            return c;
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            this.element.classList.add("rmu-interactive-button");
            this.element.classList.toggle("disabled", this.disabled);
            this.element.dataset.tooltipDirection = "UP";

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
            if (event.button !== 0 || this.disabled) return;
            event.preventDefault();
            event.stopPropagation();

            const token = ui.ARGON?._token;
            if (!token) return;

            await RMUData.ensureExtendedTokenData();
            await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenSCRAction", this.spell);
        }

        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }
    }

    /**
     * TIER 2: A category button representing the Physical Item.
     * Clicking it opens a higher tier containing the spells.
     * @augments ButtonPanelButton
     */
    class RMUMagicItemCategoryButton extends ButtonPanelButton {
        constructor(itemGroup, actor) {
            super();
            this.itemGroup = itemGroup;
            this.itemDoc = actor.items.get(itemGroup.groupName);
            this._spells = (itemGroup.spellLists || []).flatMap((sl) => sl.spells || []);
        }

        get label() {
            return this.itemGroup.groupLabel || this.itemDoc?.name || "Magic Item";
        }

        get icon() {
            return this.itemDoc?.img || ICONS.items;
        }

        get hasContents() {
            return this._spells.length > 0;
        }

        get isInteractive() {
            return true;
        }

        get _equipped() {
            return this.itemDoc?.system?.equipped === "equipped";
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            // Trap the click so it doesn't bleed to the canvas
            UIGuards.attachButtonInteractionGuards(this);

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

        async _getPanel() {
            const buttons = this._spells.map((s) => new RMUItemSpellActionButton(s, this.itemDoc));
            const panel = new ButtonPanel({ id: `rmu-magicitem-${this.itemGroup.groupName}`, buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            return panel;
        }
    }

    /**
     * TIER 1: The single master "Items" category button on the main HUD row.
     * Clicking it opens the tier containing the physical items.
     * @augments ButtonPanelButton
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
            const buttons = this.itemSpells.map((group) => new RMUMagicItemCategoryButton(group, this._actor)).filter((b) => b.hasContents);

            const panel = new ButtonPanel({ id: "rmu-magicitems-master", buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            return panel;
        }
    }

    /**
     * TIER 0: The main panel definition mounted to CoreHUD.
     * @augments ActionPanel
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
