/**
 * RMUFeatures/RMUAttacks.js
 * Defines the main Attacks panel, including Melee, Ranged,
 * and two Spell Attack categories (Target and Area).
 */

const { ICONS, RMUUtils, RMUData } = window;

/**
 * Stores the armed state (for template placement) of attacks.
 * @type {Map<string, boolean>} Map(tokenAttackKey, isArmed)
 */
const TEMPLATE_STATE = new Map();

/**
 * Generates a unique key for an attack bound to a specific token.
 * @param {Token} token - The token.
 * @param {object} attack - The attack object.
 * @returns {string} The unique key.
 */
function tplKeyFor(token, attack) {
  const id = token?.id ?? ui.ARGON?._token?.id ?? "no-token";
  return `${id}::${RMUData.attackKey(attack)}`;
}

/**
 * Defines and registers the main Attacks panel with Argon.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineAttacksMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;
  const { UIGuards } = window;

  /**
   * Defines the categories for the Attacks panel.
   */
  const CATS = [
    { key: "melee", label: "Melee", icon: ICONS.melee },
    { key: "ranged", label: "Ranged", icon: ICONS.ranged },
    { key: "natural", label: "Natural", icon: ICONS.natural },
    { key: "shield", label: "Shield", icon: ICONS.shield },
    { key: "spellTarget", label: "Spells (Target)", icon: ICONS.beam },
    { key: "spellArea", label: "Spells (Area)", icon: ICONS.explosion }
  ];

  /**
   * An action button representing a single attack (physical or spell).
   * @augments ActionButton
   */
  class RMUAttackActionButton extends ActionButton {
    /**
     * @param {object} attack - The attack object (from RMUData).
     * @param {string} catKey - The category key (e.g., "melee", "spellTarget").
     */
    constructor(attack, catKey) {
      super();
      this.attack = attack;
      this._catKey = catKey;
      this._isSpellAttack = !!attack._isSpellAttack;

      // Check if this is a physical, equip-able item
      this._isPhysicalWeapon = !this._isSpellAttack && this._catKey !== "natural";

      // Get the live equipped state for styling the toggle
      const live = RMUData.getLiveAttack(this.attack);
      this._equipped = this._isSpellAttack ? true : !!(live?.isEquipped ?? live?.readyState ?? false);
    }

    get isInteractive() { return true; }

    /**
     * Button is disabled if the weapon is not equipped.
     * @returns {boolean}
     */
    get disabled() { return !this._equipped; }

    /**
     * Gets the armed state for template placement.
     * @returns {boolean}
     */
    get _armed() { return TEMPLATE_STATE.get(tplKeyFor(ui.ARGON?._token, this.attack)) === true; }
    /**
     * Sets the armed state for template placement.
     * @param {boolean} v - The new armed state.
     */
    set _armed(v) {
      TEMPLATE_STATE.set(tplKeyFor(ui.ARGON?._token, this.attack), !!v);
      this._applyArmedVisual();
      this._updateBadge();
      this._updateOverlay();
      this.refresh?.();
    }

    get label() {
      const name = this.attack?.attackName ?? this.attack?.name ?? "Attack";
      return this._armed ? `Place: ${name}` : name;
    }

    get icon() {
      if (this._isSpellAttack && window.SPELL_ATTACK_ICONS[this.attack.baseName]) {
        return window.SPELL_ATTACK_ICONS[this.attack.baseName];
      }
      if (this._catKey === 'spellTarget') return ICONS.beam;
      if (this._catKey === 'spellArea') return ICONS.explosion;
      return this.attack?.img || ICONS[this._catKey] || ICONS.melee;
    }

    get classes() {
      const c = super.classes.slice().filter(cls => cls !== "disabled");
      if (this.disabled) c.push("disabled");
      if (this._armed) c.push("armed");
      return c;
    }

    async _renderInner() {
      await super._renderInner();
      if (!this.element) return;

      this.element.classList.add("rmu-interactive-button");
      this.element.classList.toggle("disabled", this.disabled);

      this._applyArmedVisual();
      this._updateBadge();
      this._updateOverlay();

      const valueLabel = "Total";
      const value = this._isSpellAttack
        ? this.attack?._totalBonus
        : this.attack?.totalBonus;

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

      try {
        // Call the new system API via the wrapper
        const apiFunctionName = "rmuTokenToggleEquippedState";
        await window.RMUUtils.rmuTokenActionWrapper(
          token,
          apiFunctionName,
          this.attack.itemId // Pass the itemId
        );

        // Refresh the HUD to show the new state
        ui.ARGON?.refresh?.();

      } catch (err) {
        console.error(`[ECH-RMU] Failed to toggle equip state via API (${apiFunctionName})`, err);
        ui.notifications.error("Failed to toggle equip state.");
      }
    }

    /**
     * Applies visual styles for the AoE template "armed" state.
     */
    _applyArmedVisual() {
      if (!this.element) return;
      if (this._armed) {
        this.element.title = "AoE Template active: adjust its position, then click this attack again to resolve.";
      } else {
        this.element.title = "";
      }
    }

    /**
     * Adds or removes the "PLACE TEMPLATE" badge.
     */
    _updateBadge() {
      if (!this.element) return;
      const old = this.element.querySelector(".rmu-place-badge");
      if (old) old.remove();
      if (this._armed) {
        const b = document.createElement("div");
        b.className = "rmu-place-badge";
        b.textContent = "PLACE TEMPLATE";
        this.element.classList.add("rmu-button-relative");
        this.element.appendChild(b);
      }
    }

    /**
     * Adds or removes the orange "armed" overlay.
     */
    _updateOverlay() {
      if (!this.element) return;
      const old = this.element.querySelector(".rmu-armed-overlay");
      if (old) old.remove();
      if (this._armed) {
        const ov = document.createElement("div");
        ov.className = "rmu-armed-overlay";
        this.element.classList.add("rmu-button-relative");
        this.element.appendChild(ov);
      }
    }

    /* ───────── Tooltip ───────── */
    get hasTooltip() { return true; }

    async getTooltipData() {
      const a = this.attack ?? {};

      // Spell Attack Tooltip
      if (this._isSpellAttack) {
        return {
          title: a.name,
          subtitle: `Lvl ${a.level} - ${a.spellList}`,
          details: [
            { label: "Attack Type", value: a.attack },
            { label: "Specialization", value: a.spellAttack.specialization },
            { label: "Size", value: a.spellAttack.size },
            { label: "Chart", value: a.spellAttack.chart?.name },
            { label: "Fumble", value: a.spellAttack.fumble },
            { label: "Range (interval)", value: a._modifiedRange.range || a.range },
            { label: "AoE", value: a._modifiedAoE.range || a.AoE },
            { label: "Targets", value: a._modifiedAoE.targets },
            { label: "Total OB", value: a._totalBonus },
          ].filter(x => x.value !== undefined && x.value !== null && x.value !== "")
        };
      }

      // Physical Attack Tooltip
      const details = [
        { label: "Specialization", value: a.skill?.specialization },
        { label: "Size", value: a.size },
        { label: "Chart", value: a.chart?.name },
        { label: "Fumble", value: a.fumble },
        ...(["melee", "natural", "shield"].includes(this._catKey)
          ? [{ label: "Melee reach", value: a.meleeRange }]
          : []),
        ...(this._catKey === "ranged"
          ? [{ label: "Range (short)", value: RMUData.getShortRange(a.rangeInrements ?? a.rangeIncrements ?? a.rangeIntervals ?? a.range) }]
          : []),
        { label: "Item Strength", value: a.itemStrength },
        { label: "Ranks", value: a.skill?.ranks },
        { label: "Combat Training", value: a.skill?.name },
        { label: "2H", value: (Number(a.twoHandedBonus) === 10 ? "Yes" : "No") },
        { label: "Bonus OB", value: a.itemBonus },
        { label: "Total OB", value: a.totalBonus }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");

      return {
        title: this.label.replace(/^Place:\s*/, ""),
        subtitle: a.skill?.name ?? "",
        details: RMUUtils.formatTooltipDetails(details)
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
      event.preventDefault(); event.stopPropagation();
      await this._invokeAttack();
    }

    async _onLeftClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }

    /**
     * Handles the logic for performing an attack.
     * Manages template placement (AoE) vs. direct rolls.
     */
    async _invokeAttack() {
      const token = ui.ARGON?._token;
      const targets = game.user?.targets ?? new Set();

      if (!targets.size) {
        ui.notifications?.warn?.("Select at least one target before attacking.");
        return;
      }
      await RMUData.ensureExtendedTokenData();

      const live = this._isSpellAttack ? this.attack : RMUData.getLiveAttack(this.attack);

      // This check is redundant due to _onMouseDown, but good defense.
      if (!live.isEquipped && !this._isSpellAttack) {
        ui.notifications?.warn?.(`${(live?.attackName ?? this.label).replace(/^Place:\s*/, "")} is not equipped.`);
        return;
      }

      const apiToCall = this._isSpellAttack
        ? "rmuTokenSpellAttackAction"
        : "rmuTokenAttackAction";

      const needsTemplate = live.isAoE === true;

      // If already armed, fire the attack and disarm
      if (this._armed) {
        await RMUUtils.rmuTokenActionWrapper(token, apiToCall, live);
        this._armed = false;
        return;
      }

      // If needs a template, arm the button and place template
      if (needsTemplate) {
        this._armed = true;
        ui.notifications?.info?.("Place the template on the scene, then click this attack again to resolve.");
        await RMUUtils.rmuTokenActionWrapper(token, apiToCall, live);
        return;
      }

      // Standard attack
      await RMUUtils.rmuTokenActionWrapper(token, apiToCall, live);
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
    get label() { return this.title; }
    get icon() { return this._icon; }
    get hasContents() { return this._attacks.length > 0; }
    get isInteractive() { return true; }

    async _getPanel() {
      const buttons = (this._attacks || []).map(a => new RMUAttackActionButton(a, this.key));
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
    get label() { return "Attacks"; }
    get maxActions() { return null; }
    get currentActions() { return null; }

    async _getButtons() {
      await RMUData.ensureRMUReady();
      const allNormalAttacks = RMUData.getTokenAttacks();
      const allSpellAttacks = RMUData.getDirectedSpellAttacks();

      const buckets = new Map(CATS.map(c => [c.key, []]));

      // 1. Bucket Normal Attacks
      for (const atk of allNormalAttacks) {
        const key = RMUData.bucketOf(atk);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(atk);
      }

      // 2. Bucket Spell Attacks into new categories
      for (const spell of allSpellAttacks) {
        if (spell.isAoE) {
          buckets.get("spellArea").push(spell);
        } else {
          buckets.get("spellTarget").push(spell);
        }
      }

      // 3. Sort attacks within each bucket
      for (const [k, list] of buckets.entries()) {
        if (k === "spellTarget" || k === "spellArea") {
          // Sort spells by Name, then Level
          list.sort((a, b) => {
            const nameA = a.attackName || a.name;
            const nameB = b.attackName || b.name;
            return nameA.localeCompare(nameB) || a.level - b.level;
          });
        } else {
          // Sort physical attacks by Equipped, then Name
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
      }

      // Create category buttons, filtering out empty categories
      const buttons = CATS.map(c =>
        new RMUAttackCategoryButton({
          key: c.key,
          label: c.label,
          icon: c.icon,
          attacks: buckets.get(c.key) || []
        })
      ).filter(b => b.hasContents);

      return buttons;
    }
  }

  CoreHUD.defineMainPanels([RMUAttacksActionPanel]);
}