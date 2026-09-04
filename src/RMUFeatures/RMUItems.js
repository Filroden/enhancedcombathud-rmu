/**
 * Defines the Items panel for casting spells embedded within physical items.
 */

import { ICONS, RMUUtils, UIGuards } from "../RMUCore.js";
import { RMUData } from "../RMUData.js";

export function defineMagicItemsMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;

    /**
     * An action button representing a single spell castable from an item.
     * @augments ActionButton
     */
    class RMUItemSpellActionButton extends ActionButton {
        constructor(spell, itemDoc) {
            super();
            this.spell = spell;
            this.itemDoc = itemDoc; // Reference to the physical item
        }

        get isInteractive() {
            return true;
        }

        get disabled() {
            // Disable the spell if the parent item is not equipped
            return this.itemDoc?.system?.equipped !== "equipped";
        }

        get label() {
            return this.spell?.name ?? "Item Spell";
        }

        get icon() {
            // Fallback to a generic magic icon if the spell has no specific art
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

            // If charge tracking is added by the system later, we can overlay it here
            const valueLabel = "SCR";
            const value = this.spell?.scr;
            if (value !== undefined && value !== null) {
                RMUUtils.applyValueOverlay(this.element, value, valueLabel);
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

            // Cast the spell using the exact data object provided by the item
            await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenSCRAction", this.spell);
        }

        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }
    }

    /**
     * A category button representing the Physical Item containing the spells.
     * @augments ButtonPanelButton
     */
    class RMUMagicItemCategoryButton extends ButtonPanelButton {
        constructor(itemGroup, actor) {
            super();
            this.itemGroup = itemGroup;
            // groupName is the item ID
            this.itemDoc = actor.items.get(itemGroup.groupName);

            // Flatten all spells from the nested spellLists array
            this._spells = (itemGroup.spellLists || []).flatMap((sl) => sl.spells || []);
        }

        get label() {
            return this.itemGroup.groupLabel || this.itemDoc?.name || "Magic Item";
        }

        get icon() {
            return this.itemDoc?.img || ICONS.inventory;
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

            // Inject the Equip Toggle directly onto the Category Button
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

                // Position the toggle appropriately within the Argon button structure
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
     * The main "Items" panel for the HUD.
     * @augments ActionPanel
     */
    class RMUMagicItemsActionPanel extends ActionPanel {
        get label() {
            return "Items";
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

            // Extract only the spell blocks flagged as items
            const itemSpells = (actor.system._spells || []).filter((s) => s.kind === "item");

            const buttons = itemSpells.map((group) => new RMUMagicItemCategoryButton(group, actor)).filter((b) => b.hasContents);

            return buttons;
        }
    }

    CoreHUD.defineMainPanels([RMUMagicItemsActionPanel]);
}
