/**
 * RMUFeatures/RMUAttacks.js
 * Defines the main Attacks panel, including Melee, Ranged, and two new Spell Attack categories.
 */

const { ICONS, RMUUtils, RMUData } = window;

// Attack tile armed state (for template placement)
const TEMPLATE_STATE = new Map();

function tplKeyFor(token, attack) {
  const id = token?.id ?? ui.ARGON?._token?.id ?? "no-token";
  return `${id}::${RMUData.attackKey(attack)}`;
}

// Main function to define the Attacks panel
export function defineAttacksMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;
  const { UIGuards } = window; 

  // ** UPDATED: "spell" is now two separate categories **
  const CATS = [
    { key: "melee",       label: "Melee",           icon: ICONS.melee },
    { key: "ranged",      label: "Ranged",          icon: ICONS.ranged },
    { key: "natural",     label: "Natural",         icon: ICONS.natural },
    { key: "shield",      label: "Shield",          icon: ICONS.shield },
    { key: "spellTarget", label: "Spells (Target)", icon: ICONS.beam },
    { key: "spellArea",   label: "Spells (Area)",   icon: ICONS.explosion }
  ];

  /** @augments ActionButton */
  class RMUAttackActionButton extends ActionButton {
    constructor(attack, catKey) {
      super();
      this.attack = attack;
      this._catKey = catKey;
      this._isSpellAttack = !!attack._isSpellAttack;

      // ** NEW: Check if this is a physical, equip-able item **
      this._isPhysicalWeapon = !this._isSpellAttack && this._catKey !== "natural";
      
      // ** NEW: Get the live equipped state for styling the toggle **
      const live = RMUData.getLiveAttack(this.attack);
      this._equipped = this._isSpellAttack ? true : !!(live?.isEquipped ?? live?.readyState ?? false);
    }

    get isInteractive() { return true; }
    
    // ** UPDATED: Use the new _equipped definition **
    get disabled() { return !this._equipped; }
    
    get _armed() { return TEMPLATE_STATE.get(tplKeyFor(ui.ARGON?._token, this.attack)) === true; }
    set _armed(v) { TEMPLATE_STATE.set(tplKeyFor(ui.ARGON?._token, this.attack), !!v); this._applyArmedVisual(); this._updateBadge(); this._updateOverlay(); this.refresh?.(); }
    get label() { const name = this.attack?.attackName ?? this.attack?.name ?? "Attack"; return this._armed ? `Place: ${name}` : name; }
    
    // This is your up-to-date icon logic from the file
    get icon() { 
        if (this._isSpellAttack && window.SPELL_ATTACK_ICONS[this.attack.baseName]) {
          return window.SPELL_ATTACK_ICONS[this.attack.baseName];
        }
        if (this._catKey === 'spellTarget') return ICONS.wand;
        if (this._catKey === 'spellArea') return ICONS.bolt;
        return this.attack?.img || ICONS[this._catKey] || ICONS.melee; 
    }
    
    get classes() { const c = super.classes.slice().filter(cls => cls !== "disabled"); if (this.disabled) c.push("disabled"); if (this._armed) c.push("armed"); return c; }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.classList.add("rmu-interactive-button");
      }

      this.element?.classList.toggle("disabled", this.disabled);
      this._applyArmedVisual();
      this._updateBadge();
      this._updateOverlay();
      
      const valueLabel = "Total";
      const value = this._isSpellAttack 
        ? this.attack?._totalBonus
        : this.attack?.totalBonus;
        
      RMUUtils.applyValueOverlay(this.element, value ?? "", valueLabel);

      // ** Add the Equip Toggle Button **
      if (this._isPhysicalWeapon && this.attack.itemId) {
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
            this._onToggleEquip(e); // Calls the new method
        });

        this.element.appendChild(toggle);
      }
    }

    // ** Handles the toggle click **
    async _onToggleEquip(event) {
      // Get the token (for the API wrapper)
      const token = ui.ARGON?._token;
      
      // Check for token and the itemId
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
              this.attack.itemId // Pass the itemId as the only argument
          );
          
          // Refresh the HUD to show the new state
          ui.ARGON?.refresh?.();
          
      } catch (err) {
          console.error(`[ECH-RMU] Failed to toggle equip state via API (${apiFunctionName})`, err);
          ui.notifications.error("Failed to toggle equip state.");
      }
    }
    
    _applyArmedVisual() {
      if (!this.element) return;
      if (this._armed) {
        this.element.title = "AoE Template active: adjust its position using the chat card controls, then click this attack again to resolve.";
      } else {
        this.element.title = "";
      }
    }

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

      // ** Spell Attack Tooltip **
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
      
      // ** Physical Attack Tooltip **
      const details = [
        { label: "Specialization", value: a.skill?.specialization },
        { label: "Size", value: a.size },
        { label: "Chart", value: a.chart?.name },
        { label: "Fumble", value: a.fumble },
        ...( ["melee","natural","shield"].includes(this._catKey)
            ? [{ label: "Melee reach", value: a.meleeRange }]
            : [] ),
        ...( this._catKey === "ranged"
            ? [{ label: "Range (short)", value: RMUData.getShortRange(a.rangeInrements ?? a.rangeIncrements ?? a.rangeIntervals ?? a.range) }]
            : [] ),
        { label: "Item Strength", value: a.itemStrength },
        { label: "Ranks", value: a.skill?.ranks },
        { label: "Combat Training", value: a.skill?.name },
        { label: "2H", value: (Number(a.twoHandedBonus) === 10 ? "Yes" : "No") },
        { label: "Bonus OB", value: a.itemBonus },
        { label: "Total OB", value: a.totalBonus }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");

      return {
        title: this.label,
        subtitle: a.skill?.name ?? "",
        details: RMUUtils.formatTooltipDetails(details)
      };
    }


    /* ───────── Clicks ───────── */
    // ** MODIFIED: _onMouseDown to respect 'disabled' and the toggle **
    async _onMouseDown(event) {
      // 1. Check if button is disabled
      if (event.button !== 0 || this.disabled) return;
      
      // 2. Check if click was on the toggle
      if (event.target.closest(".rmu-equip-toggle")) {
          return; 
      }
      
      // 3. OK to attack
      event.preventDefault(); event.stopPropagation();
      await this._invokeAttack();
    }
    async _onLeftClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }

    /** Handles the dual-click logic for template placement (if needed) or direct roll. */
    async _invokeAttack() {
      const token = ui.ARGON?._token;
      const targets = game.user?.targets ?? new Set();

      if (!targets.size) {
        ui.notifications?.warn?.("Select at least one target before attacking.");
        return;
      }
      await RMUData.ensureExtendedTokenData();

      const live = this._isSpellAttack ? this.attack : RMUData.getLiveAttack(this.attack);

      // This check is now redundant because _onMouseDown handles 'this.disabled',
      // but it's good defensive coding to leave it.
      if (!live.isEquipped && !this._isSpellAttack) {
        ui.notifications?.warn?.(`${(live?.attackName ?? this.label).replace(/^Place:\s*/, "")} is not equipped.`);
        return;
      }
      
      const apiToCall = this._isSpellAttack 
        ? "rmuTokenSpellAttackAction"
        : "rmuTokenAttackAction";

      const needsTemplate = live.isAoE === true;

      if (this._armed) {
        await RMUUtils.rmuTokenActionWrapper(token, apiToCall, live);
        this._armed = false;
        return;
      }

      if (needsTemplate) {
        this._armed = true;
        ui.notifications?.info?.("Place the template on the scene, then click this attack again to resolve.");
        await RMUUtils.rmuTokenActionWrapper(token, apiToCall, live);
        return;
      }

      await RMUUtils.rmuTokenActionWrapper(token, apiToCall, live);
    }
  }

  // ** DELETED: RMUSpellAttackFilterButton is no longer needed. **

  /** * @augments ButtonPanelButton
   * REVERTED: This class is now simple again. It just builds a grid.
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
    get icon()  { return this._icon; }
    get hasContents() { return this._attacks.length > 0; }
    get isInteractive() { return true; }

    async _getPanel() {
      // ** REVERTED to original, simple logic **
      const buttons = (this._attacks || []).map(a => new RMUAttackActionButton(a, this.key));
      const panel = new ButtonPanel({ id: `rmu-attacks-${this.key}`, buttons });
      UIGuards.attachPanelInteractionGuards(panel);
      return panel;
    }
  }

  /** @augments ActionPanel */
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
      
      // 2. ** UPDATED: Bucket Spell Attacks into new categories **
      for (const spell of allSpellAttacks) {
        if (spell.isAoE) {
          buckets.get("spellArea").push(spell);
        } else {
          buckets.get("spellTarget").push(spell);
        }
      }

      // 3. ** UPDATED: Sort logic **
      for (const [k, list] of buckets.entries()) {
        if (k === "spellTarget" || k === "spellArea") {
          // Sort spells by Name, then Level
          list.sort((a, b) => {
            const nameA = a.attackName || a.name;
            const nameB = b.attackName || b.name;
            return nameA.localeCompare(nameB) || a.level - b.level;
          });
        } else {
          // Original sort for physical attacks
          list.sort((a, b) => {
            const la = RMUData.getLiveAttack(a);
            const lb = RMUData.getLiveAttack(b);
            const ea = !!(la?.isEquipped ?? la?.readyState ?? false);
            const eb = !!(lb?.isEquipped ?? lb?.readyState ?? false);
            if (ea !== eb) return ea ? -1 : 1;
            const na = String(la?.attackName ?? la?.name ?? "");
            const nb = String(lb?.attackName ?? lb?.name ?? "");
            return na.localeCompare(nb);
          });
        }
      }

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