/**
 * RMUFeatures/RMUAttacks.js
 * Defines the main Attacks panel, including Melee, Ranged, Natural, and Shield.
 * Spell attacks have been moved to the Spells panel (RMUSpells.js).
 */

import { ICONS, RMUUtils, UIGuards } from "../RMUCore.js";
import { RMUData } from "../RMUData.js";

/**
 * Defines and registers the main Attacks panel with Argon.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineAttacksMain(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const { ActionPanel } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;

    /**
     * Defines the categories for the Attacks panel.
     * Spell categories removed to prevent duplication.
     */
    const CATS = [
        { key: "melee", label: "Melee", icon: ICONS.melee },
        { key: "ranged", label: "Ranged", icon: ICONS.ranged },
        { key: "natural", label: "Natural", icon: ICONS.natural },
        { key: "shield", label: "Shield", icon: ICONS.shield },
    ];

    /**
     * An action button representing a single physical attack.
     * @augments ActionButton
     */
    class RMUAttackActionButton extends ActionButton {
        /**
         * @param {object} attack - The attack object (from RMUData).
         * @param {string} catKey - The category key (e.g., "melee").
         */
        constructor(attack, catKey) {
            super();
            this.attack = attack;
            this._catKey = catKey;

            // Check if this is a physical, equip-able item
            this._isPhysicalWeapon = this._catKey !== "natural";

            // Get the live equipped state for styling the toggle
            const live = RMUData.getLiveAttack(this.attack);
            this._equipped = !!(live?.isEquipped ?? live?.readyState ?? false);
        }

        get isInteractive() {
            return true;
        }

        /**
         * Button is disabled if the weapon is not equipped.
         * @returns {boolean}
         */
        get disabled() {
            return !this._equipped;
        }

        get label() {
            return this.attack?.attackName ?? this.attack?.name ?? "Attack";
        }

        get icon() {
            return this.attack?.img || ICONS[this._catKey] || ICONS.melee;
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

            const valueLabel = "Total";
            const value = this.attack?.totalBonus;

            RMUUtils.applyValueOverlay(this.element, value ?? "", valueLabel);

            // Add the Equip Toggle Button
            if (this._isPhysicalWeapon && this.attack.itemId) {
                this._renderEquipToggle();
            }
        }

        /**
         * Creates and appends the equip/unequip toggle button.
         */
        _renderEquipToggle() {
            const toggle = document.createElement("div");
            toggle.className = "rmu-equip-toggle";

            const iconSrc = this._equipped ? ICONS.equip_closed : ICONS.equip_open;
            toggle.innerHTML = `<img src="${iconSrc}" class="rmu-equip-icon" alt="Toggle Equip"/>`;

            toggle.classList.toggle("equipped", this._equipped);
            toggle.title = this._equipped ? "Click to Unequip" : "Click to Equip";

            toggle.addEventListener("pointerdown", (e) => {
                e.stopImmediatePropagation();
            });
            toggle.addEventListener("click", (e) => {
                e.stopImmediatePropagation();
                this._onToggleEquip(e);
            });

            this.element.appendChild(toggle);
        }

        /**
         * Handles the click event on the equip toggle.
         * @param {Event} event - The click event.
         */
        async _onToggleEquip(event) {
            const token = ui.ARGON?._token;
            if (!token || !this.attack.itemId) {
                console.error("[ECH-RMU] Cannot toggle equip: No token or itemID.");
                return;
            }

            const apiFunctionName = "rmuTokenToggleEquippedState";

            try {
                // Call the new system API via the wrapper
                await RMUUtils.rmuTokenActionWrapper(
                    token,
                    apiFunctionName,
                    this.attack.itemId, // Pass the itemId
                );

                // Refresh the HUD to show the new state
                ui.ARGON?.refresh?.();
            } catch (err) {
                console.error(`[ECH-RMU] Failed to toggle equip state via API (${apiFunctionName})`, err);
                ui.notifications.error("Failed to toggle equip state.");
            }
        }

        /* ───────── Tooltip ───────── */
        get hasTooltip() {
            return true;
        }

        async getTooltipData() {
            const a = this.attack ?? {};

            // Physical Attack Tooltip
            const details = [
                { label: "Specialization", value: a.skill?.specialization },
                { label: "Size", value: a.size },
                { label: "Chart", value: a.chart?.name },
                { label: "Fumble", value: a.fumble },
                ...(["melee", "natural", "shield"].includes(this._catKey) ? [{ label: "Melee reach", value: a.meleeRange ? Number.parseFloat(Number(a.meleeRange).toFixed(1)) : null }] : []),
                ...(this._catKey === "ranged" ? [{ label: "Range (short)", value: RMUData.getShortRange(a.rangeInrements ?? a.rangeIncrements ?? a.rangeIntervals ?? a.range) }] : []),
                { label: "Item Strength", value: a.itemStrength },
                { label: "Ranks", value: a.skill?.ranks },
                { label: "Combat Training", value: a.skill?.name },
                { label: "2H", value: Number(a.twoHandedBonus) === 10 ? "Yes" : "No" },
                { label: "Bonus OB", value: a.itemBonus },
                { label: "Total OB", value: a.totalBonus },
            ].filter((x) => x.value !== undefined && x.value !== null && x.value !== "");

            return {
                title: this.label,
                subtitle: a.skill?.name ?? "",
                details: RMUUtils.formatTooltipDetails(details),
            };
        }

        /* ───────── Clicks ───────── */

        async _onMouseDown(event) {
            // 1. Check if button is disabled (weapon not equipped)
            if (event.button !== 0 || this.disabled) return;

            // 2. Check if click was on the equip toggle
            if (event.target.closest(".rmu-equip-toggle")) {
                return; // Handled by the toggle's own click listener
            }

            // 3. OK to proceed with attack
            event.preventDefault();
            event.stopPropagation();
            await this._invokeAttack();
        }

        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }

        /**
         * Handles the logic for performing an attack.
         */
        async _invokeAttack() {
            const token = ui.ARGON?._token;
            const targets = game.user?.targets ?? new Set();

            if (!targets.size) {
                ui.notifications?.warn?.("Select at least one target before attacking.");
                return;
            }

            await RMUData.ensureExtendedTokenData();

            const live = RMUData.getLiveAttack(this.attack);

            if (!live.isEquipped) {
                ui.notifications?.warn?.(`${live?.attackName ?? this.label} is not equipped.`);
                return;
            }

            // Standard attack
            await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenAttackAction", live);
        }
    }

    /**
     * A button representing a category of attacks (e.g., "Melee").
     * Clicking it opens a sub-panel with all attacks in that category.
     * @augments ButtonPanelButton
     */
    class RMUAttackCategoryButton extends ButtonPanelButton {
        constructor({ key, label, icon, attacks }) {
            super();
            this.key = key;
            this.title = label;
            this._icon = icon;
            this._attacks = Array.isArray(attacks) ? attacks : [];
        }
        get label() {
            return this.title;
        }
        get icon() {
            return this._icon;
        }
        get hasContents() {
            return this._attacks.length > 0;
        }
        get isInteractive() {
            return true;
        }

        async _getPanel() {
            const buttons = (this._attacks || []).map((a) => new RMUAttackActionButton(a, this.key));
            const panel = new ButtonPanel({ id: `rmu-attacks-${this.key}`, buttons });
            UIGuards.attachPanelInteractionGuards(panel);
            return panel;
        }
    }

    /**
     * The main "Attacks" panel for the HUD.
     * @augments ActionPanel
     */
    class RMUAttacksActionPanel extends ActionPanel {
        get label() {
            return "Attacks";
        }
        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }

        async _getButtons() {
            await RMUData.ensureRMUReady();
            const allNormalAttacks = RMUData.getTokenAttacks();

            // We initialize buckets based ONLY on the filtered CATS array
            const buckets = new Map(CATS.map((c) => [c.key, []]));

            // Bucket Normal Attacks
            for (const atk of allNormalAttacks) {
                const key = RMUData.bucketOf(atk);
                // Safety check: ensure the bucket exists in our defined categories
                if (buckets.has(key)) {
                    buckets.get(key).push(atk);
                }
            }

            // Sort attacks within each bucket (Physical logic only)
            for (const list of buckets.values()) {
                list.sort((a, b) => {
                    const la = RMUData.getLiveAttack(a);
                    const lb = RMUData.getLiveAttack(b);
                    const ea = !!(la?.isEquipped ?? la?.readyState ?? false);
                    const eb = !!(lb?.isEquipped ?? lb?.readyState ?? false);
                    if (ea !== eb) return ea ? -1 : 1; // Equipped first
                    const na = String(la?.attackName ?? la?.name ?? "");
                    const nb = String(lb?.attackName ?? lb?.name ?? "");
                    return na.localeCompare(nb);
                });
            }

            // Create category buttons, filtering out empty categories
            const buttons = CATS.map(
                (c) =>
                    new RMUAttackCategoryButton({
                        key: c.key,
                        label: c.label,
                        icon: c.icon,
                        attacks: buckets.get(c.key) || [],
                    }),
            ).filter((b) => b.hasContents);

            return buttons;
        }
    }

    CoreHUD.defineMainPanels([RMUAttacksActionPanel]);
}
