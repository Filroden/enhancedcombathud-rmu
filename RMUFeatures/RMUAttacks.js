/**
 * RMUFeatures/RMUAttacks.js
 * Defines the main Attacks panel, including Melee, Ranged, and Directed Spell Attacks.
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

  const CATS = [
    { key: "melee",   label: "Melee",   icon: ICONS.melee   },
    { key: "ranged",  label: "Ranged",  icon: ICONS.ranged  },
    { key: "spell",   label: "Spells",  icon: ICONS.spells }, 
    { key: "natural", label: "Natural", icon: ICONS.natural },
    { key: "shield",  label: "Shield",  icon: ICONS.shield  }
  ];

  /** @augments ActionButton */
  class RMUAttackActionButton extends ActionButton {
    constructor(attack, catKey) {
      super();
      this.attack = attack;
      this._catKey = catKey;
      this._isSpellAttack = !!attack._isSpellAttack;
    }

    get isInteractive() { return true; }
    get disabled() { return !this._equipped && !this._isSpellAttack; }
    get _armed() { return TEMPLATE_STATE.get(tplKeyFor(ui.ARGON?._token, this.attack)) === true; }
    set _armed(v) { TEMPLATE_STATE.set(tplKeyFor(ui.ARGON?._token, this.attack), !!v); this._applyArmedVisual(); this._updateBadge(); this._updateOverlay(); this.refresh?.(); }
    get label() { const name = this.attack?.attackName ?? this.attack?.name ?? "Attack"; return this._armed ? `Place: ${name}` : name; }
    get icon() { return this._isSpellAttack ? ICONS.spells : this.attack?.img || ICONS[this._catKey] || ICONS.melee; }
    get _equipped() { const a = RMUData.getLiveAttack(this.attack); return !!(a?.isEquipped ?? a?.readyState ?? false); }
    get classes() { const c = super.classes.slice().filter(cls => cls !== "disabled"); if (this.disabled) c.push("disabled"); if (this._armed) c.push("armed"); return c; }

    _updateDisabledPill() {
      if (!this.element) return;
      const existing = this.element.querySelector(".rmu-disabled-pill");
      if (!this._equipped && !this._isSpellAttack) {
        if (!existing) {
          const pill = document.createElement("div");
          pill.className = "rmu-disabled-pill";
          pill.textContent = "NOT EQUIPPED";
          this.element.classList.add("rmu-button-relative");
          this.element.appendChild(pill);
        }
      } else {
        existing?.remove();
      }
    }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.classList.add("rmu-interactive-button");
      }

      this.element?.classList.toggle("disabled", this.disabled);
      this._applyArmedVisual();
      this._updateBadge();
      this._updateOverlay();
      
      const valueLabel = this._isSpellAttack ? "SCR" : "Total";
      RMUUtils.applyValueOverlay(this.element, this.attack?.totalBonus ?? "", valueLabel);

      this._updateDisabledPill?.();
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

    /* ───────── Tooltip (Restored) ───────── */
    get hasTooltip() { return true; }
    async getTooltipData() {
      const a = this.attack ?? {};

      // Spell Attack Tooltip (New - remains simple)
      if (this._isSpellAttack) {
          return { 
            title: a.name, 
            subtitle: a._spellListInfo,
            details: [
                { label: "Level", value: a.level },
                { label: "SCR Bonus", value: a.scr },
                { label: "Attack Type", value: a.attack },
            ].filter(x => x.value !== undefined && x.value !== null && x.value !== "")
          };
      }
      
      // ** RESTORED: Original Physical Attack Tooltip **
      const details = [
        { label: "Specialization",   value: a.skill?.specialization },
        { label: "Size",             value: a.size },
        { label: "Chart",            value: a.chart?.name },
        { label: "Fumble",           value: a.fumble },
        ...( ["melee","natural","shield"].includes(this._catKey)
            ? [{ label: "Melee reach", value: a.meleeRange }]
            : [] ),
        ...( this._catKey === "ranged"
            ? [{ label: "Range (short)", value: RMUData.getShortRange(a.rangeInrements ?? a.rangeIncrements ?? a.rangeIntervals ?? a.range) }]
            : [] ),
        { label: "Item Strength",    value: a.itemStrength },
        { label: "Ranks",            value: a.skill?.ranks },
        { label: "Combat Training",  value: a.skill?.name },
        { label: "2H",               value: (Number(a.twoHandedBonus) === 10 ? "Yes" : "No") },
        { label: "Bonus OB",         value: a.itemBonus },
        { label: "Total OB",         value: a.totalBonus }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");

      return { title: this.label, subtitle: a.skill?.name ?? "", details: RMUUtils.formatTooltipDetails(details) };
    }


    /* ───────── Clicks ───────── */
    async _onMouseDown(event) {
      if (event.button !== 0) return;
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

      if (!live.isEquipped && !this._isSpellAttack) {
        ui.notifications?.warn?.(`${(live?.attackName ?? this.label).replace(/^Place:\s*/, "")} is not equipped.`);
        return;
      }

      const needsTemplate = live.isAoE === true;

      if (this._armed) {
        await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenAttackAction", live);
        this._armed = false;
        return;
      }

      if (needsTemplate) {
        this._armed = true;
        ui.notifications?.info?.("Place the template on the scene, then click this attack again to resolve.");
        await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenAttackAction", live);
        return;
      }

      await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenAttackAction", live);
    }
  }

  /** @augments ButtonPanelButton */
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
      const buttons = (this._attacks || []).map(a => new RMUAttackActionButton(a, this.key));
      const panel = new ButtonPanel({ id: `rmu-attacks-${this.key}`, buttons });
      UIGuards.attachPanelInputGuards(panel);
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
      
      // 2. Bucket Spell Attacks
      if (allSpellAttacks.length > 0) {
          buckets.get("spell").push(...allSpellAttacks);
      }

      // Sort logic
      for (const [k, list] of buckets.entries()) {
        if (k !== "spell") {
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
        } else {
             list.sort((a, b) => a.level - b.level || String(a.name).localeCompare(String(b.name)));
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