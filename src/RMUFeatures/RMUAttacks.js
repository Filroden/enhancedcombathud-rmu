/**
 * Defines the main Attacks panel, including Melee, Ranged, Natural, and Shield.
 * Spell attacks have been moved to the Spells panel (RMUSpells.js).
 */

import { ICONS, RMUUtils } from "../RMUCore.js";
import { createEquipToggle } from "../ui/dom.js";
import { createBaseClasses } from "../ui/baseButtons.js";
import { hudToken } from "../system/context.js";
import { callTokenAction } from "../system/api.js";
import { ensureExtendedTokenData, ensureRMUReady } from "../system/derive.js";
import { attackCategory, attackTooltipDetails, getActorAttacks, getLiveAttack, isAttackEquipped } from "../system/attacks.js";

/**
 * Defines and registers the main Attacks panel with Argon.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineAttacksMain(CoreHUD) {
    const { ButtonPanelButton } = CoreHUD.ARGON.MAIN.BUTTONS;
    const { RMUActionButton, RMUActionPanel, createGuardedPanel } = createBaseClasses(CoreHUD.ARGON);

    /**
     * Defines the categories for the Attacks panel.
     * Spell attacks are shown in the Spells panel instead, so there is no spell category.
     */
    const CATS = [
        { key: "melee", label: "Melee", icon: ICONS.melee },
        { key: "ranged", label: "Ranged", icon: ICONS.ranged },
        { key: "natural", label: "Natural", icon: ICONS.natural },
        { key: "shield", label: "Shield", icon: ICONS.shield },
    ];

    /**
     * Attack buttons built for the current HUD render.
     * After an equip toggle every attack button is refreshed, not only the one clicked: one
     * weapon can appear several times (for example 1H and 2H variants), and equipping one
     * item can make the system unequip another. The set is cleared whenever the Attacks panel
     * rebuilds its buttons, so it never holds buttons from an earlier render.
     */
    const liveAttackButtons = new Set();

    /**
     * An action button representing a single physical attack.
     * @augments RMUActionButton
     */
    class RMUAttackActionButton extends RMUActionButton {
        /**
         * @param {object} attack - The attack object (from the system's attack list).
         * @param {string} catKey - The category key (e.g., "melee").
         */
        constructor(attack, catKey) {
            super();
            this.attack = attack;
            this._catKey = catKey;

            // Natural attacks (fists, claws) are not items, so they have no equip toggle.
            this._isPhysicalWeapon = this._catKey !== "natural";

            this._readLiveState();
            liveAttackButtons.add(this);
        }

        /**
         * Re-reads this attack from the actor's current data. The system rebuilds its attack
         * list when equipment changes, so the live copy carries the current equipped state
         * and bonuses.
         */
        _readLiveState() {
            const live = getLiveAttack(this.attack);
            this.attack = live;
            this._equipped = isAttackEquipped(live);
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

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;

            RMUUtils.applyValueOverlay(this.element, this.attack?.totalBonus ?? "", "Total");

            if (this._isPhysicalWeapon && this.attack.itemId) {
                this._renderEquipToggle();
            }
        }

        /**
         * Creates and appends the equip/unequip toggle button.
         */
        _renderEquipToggle() {
            const toggle = createEquipToggle({
                equipped: this._equipped,
                onToggle: () => this._onToggleEquip(),
            });
            this.element.appendChild(toggle);
        }

        /**
         * Toggles the weapon's equipped state, then refreshes the attack buttons in place.
         *
         * Only the attack buttons are re-rendered. A full HUD refresh (ui.ARGON.refresh) would
         * rebuild every panel, and CORE then reopens panels from saved open/closed states that
         * can be stale, which opened the wrong attack category after a toggle. Buttons keep
         * their position until the HUD is next rebuilt; the equipped-first sort applies then.
         */
        async _onToggleEquip() {
            const token = hudToken();
            if (!token || !this.attack.itemId) {
                console.error("[ECH-RMU] Cannot toggle equip: No token or itemID.");
                return;
            }

            const toggled = await callTokenAction(token, "rmuTokenToggleEquippedState", this.attack.itemId);
            if (!toggled) return; // The wrapper has already reported the failure.

            await ensureExtendedTokenData();
            await refreshAttackButtons();
        }

        /* ───────── Tooltip ───────── */
        get hasTooltip() {
            return true;
        }

        async getTooltipData() {
            const a = this.attack ?? {};

            // Physical Attack Tooltip
            const details = attackTooltipDetails(a, this._catKey).filter((x) => x.value !== undefined && x.value !== null && x.value !== "");

            return {
                title: this.label,
                subtitle: a.skill?.name ?? "",
                details: RMUUtils.formatTooltipDetails(details),
            };
        }

        /* ───────── Clicks ───────── */

        /**
         * Performs the attack. Requires a target, and re-checks the equipped state from the
         * actor's live data in case it changed since the button was rendered.
         */
        async _onActivate() {
            const token = hudToken();
            const targets = game.user?.targets ?? new Set();

            if (!targets.size) {
                ui.notifications?.warn?.("Select at least one target before attacking.");
                return;
            }

            await ensureExtendedTokenData();

            const live = getLiveAttack(this.attack);

            if (!live.isEquipped) {
                ui.notifications?.warn?.(`${live?.attackName ?? this.label} is not equipped.`);
                return;
            }

            await callTokenAction(token, "rmuTokenAttackAction", live);
        }
    }

    /**
     * Re-reads and re-renders every attack button of the current render.
     * @returns {Promise<void>}
     */
    async function refreshAttackButtons() {
        const renders = [];
        for (const button of liveAttackButtons) {
            if (!button.element?.isConnected) continue;
            button._readLiveState();
            renders.push(button.render());
        }
        await Promise.all(renders);
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
            const buttons = this._attacks.map((a) => new RMUAttackActionButton(a, this.key));
            return createGuardedPanel(`ech-rmu-attacks-${this.key}`, buttons);
        }
    }

    /**
     * The main "Attacks" panel for the HUD.
     * @augments RMUActionPanel
     */
    class RMUAttacksActionPanel extends RMUActionPanel {
        get label() {
            return "Attacks";
        }

        async _getButtons() {
            // A new set of attack buttons is about to be built, so forget the previous ones.
            liveAttackButtons.clear();
            await ensureRMUReady();
            const allNormalAttacks = getActorAttacks();

            // We initialize buckets based ONLY on the filtered CATS array
            const buckets = new Map(CATS.map((c) => [c.key, []]));

            // Bucket Normal Attacks
            for (const atk of allNormalAttacks) {
                const key = attackCategory(atk);
                // Safety check: ensure the bucket exists in our defined categories
                if (buckets.has(key)) {
                    buckets.get(key).push(atk);
                }
            }

            // Sort attacks within each bucket (Physical logic only)
            for (const list of buckets.values()) {
                list.sort((a, b) => {
                    const la = getLiveAttack(a);
                    const lb = getLiveAttack(b);
                    const ea = isAttackEquipped(la);
                    const eb = isAttackEquipped(lb);
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
