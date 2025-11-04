/**
 * RMUFeatures/RMUOther.js
 * Defines smaller, stable panels: Portrait, Movement, Resistance, Special Checks, Rest, and Combat.
 */

// ** CRITICAL FIX: Import formatBonus from window **
const { ICONS, RMUUtils, RMUData, formatBonus } = window;

// -----------------------------------------------------------------------------
// I. Portrait/Movement/Utility Panels
// -----------------------------------------------------------------------------

// --- PORTRAIT ---
export function definePortraitPanel(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const Base = ARGON.PORTRAIT.PortraitPanel;

  if (!Base) {
      console.warn("[ECH-RMU] PortraitPanel base not found; skipping.");
      return;
  }

  // Class Definition (Must use local Base from argument CoreHUD)
  class RMUPortraitPanel extends Base {
    get description() {
      const a = this.actor;
      if (!a) return "";
      const level = a.system?.level ?? a.system?.details?.level;
      const prof  = a.system?.profession ?? a.system?.details?.profession;
      return [level != null ? `Lvl ${level}` : null, prof].filter(Boolean).join(" · ");
    }
    get isDead()  { return this.isDying; }
    get isDying() {
      const hp = this.actor?.system?.health?.hp;
      return Number(hp?.value ?? 0) <= 0;
    }
    async getStatBlocks() {
        const hpVal = Number(this.actor?.system?.health?.hp?.value ?? 0);
        const hpMax = Number(this.actor?.system?.health?.hp?.max ?? 0);
        const ppVal = Number(this.actor?.system?.health?.power?.value ?? 0);
        const ppMax = Number(this.actor?.system?.health?.power?.max ?? 0);
        const dbTot = Number(this.actor?.system?._dbBlock?.totalDB ?? 0);
        return [
          [
            { text: `${hpVal}`, color: hpVal <= 0 ? "var(--ech-danger)" : "var(--ech-success)" },
            { text: "/" },
            { text: `${hpMax}`, color: "var(--ech-fore)" },
            { text: "HP" }
          ],
          [
            { text: "PP" },
            { text: `${ppVal}/${ppMax}`, color: "var(--ech-movement-baseMovement-background)" }
          ],
          [
            { text: "DB" },
            { text: `${dbTot}`, color: "var(--ech-movement-baseMovement-background)" }
          ]
        ];
    }
  }
  CoreHUD.definePortraitPanel(RMUPortraitPanel);
}


// --- MOVEMENT ---
export function defineMovementHud(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const Base = ARGON?.MOVEMENT?.MovementHud || ARGON?.MovementHud || ARGON?.HUD?.MovementHud;

  if (!Base) { console.warn("[ECH-RMU] MovementHud base not found; skipping."); return; }

  class RMUMovementHud extends Base {
    get _mv()      { return this.actor?.system?._movementBlock ?? {}; }
    get _modeKey() { return this._mv._selected; }
    get _modeTbl() { return this._mv._table?.[this._modeKey] ?? null; }
    get _rates()   { return Array.isArray(this._modeTbl?.paceRates) ? this._modeTbl.paceRates : []; }
    _pace(name)    { return this._rates.find(r => r?.pace?.value === name) ?? null; }
    get baseMovement() {
      const walk = this._pace("Walk");
      return Number(walk?.perRound ?? 0); // feet / round
    }
    get movementMax() {
      const feetPerRound = this.baseMovement;
      const gridDist = Number(canvas.scene?.grid?.distance ?? 5);
      const squares = feetPerRound / (gridDist || 5);
      return Math.max(1, Math.round(squares));
    }
    get baseLabel()    { return "Move"; }
    get currentSpeed() { return this.baseMovement; }
    get maxSpeed()     { return this.baseMovement; }
    get speed()        { return this.currentSpeed; }
    get value()        { return this.currentSpeed; }

    async getData(...args) {
      const data = await super.getData?.(...args) ?? {};
      data.current = this.currentSpeed;
      data.max     = this.maxSpeed;
      data.base    = this.baseMovement;
      return data;
    }
  }
  CoreHUD.defineMovementHud(RMUMovementHud);
}

// --- WEAPON SETS ---
export function defineWeaponSets(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const Base = ARGON?.WEAPONS?.WeaponSets || ARGON?.WeaponSets || ARGON?.HUD?.WeaponSets;
  if (!Base) { console.warn("[ECH-RMU] WeaponSets base not found; skipping."); return; }
  class RMUWeaponSets extends Base {
    get sets() { return []; }
    _onSetChange(_id) { /* no-op in RMU */ }
  }
  CoreHUD.defineWeaponSets(RMUWeaponSets);
}


// -----------------------------------------------------------------------------
// II. Resistance Rolls Panel
// -----------------------------------------------------------------------------

export function defineResistancesMain(CoreHUD) {
  const { ICONS, RMUUtils, RMUData } = window;
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;
  const { UIGuards } = window;

  class RMUResistanceActionButton extends ActionButton {
    constructor(resist) { super(); this.resist = resist; }
    get label() { return this.resist?.name || "Resistance"; }
    get icon()  { return ICONS[this.resist?.name] || ICONS.panel; }
    get isInteractive() { return true; }
    get hasTooltip() { return true; }

		async getTooltipData() {
      const sys = this._skill?.system ?? {};
      const details = [
          { label: "Name",             value: sys.name },
          { label: "Specialization",   value: sys.specialization },
          { label: "Category",         value: sys.category },
          { label: "Total ranks",      value: sys._totalRanks },
          { label: "Rank bonus",       value: sys._rankBonus },
          { label: "Culture ranks",    value: sys.cultureRanks },
          { label: "Stat",             value: sys.stat },
          { label: "Stat bonus",       value: sys._statBonus },
          { label: "Prof bonus",       value: sys._professionalBonus },
          { label: "Knack",            value: sys._knack },
          { label: "Total bonus",      value: sys._bonus }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");

			return { 
        title: this.label, 
        subtitle: sys.name ?? "Endurance Check", 
        details: RMUUtils.formatTooltipDetails(details)
      };
    }

    async _renderInner() {
      await super._renderInner();
      if (this.element) {
        this.element.style.pointerEvents = "auto";
        this.element.style.cursor = "pointer";
        RMUUtils.applyValueOverlay(this.element, this.resist?.total ?? "", "Total");
      }
    }
    async _onMouseDown(event) { if (event?.button !== 0) return; event.preventDefault(); event.stopPropagation(); await this._roll(); }
    async _onLeftClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }
    async _roll() { await RMUUtils.rmuTokenActionWrapper(ui.ARGON?._token, "rmuTokenResistanceRollAction", this.resist?.name); }
  }

  class RMUResistanceCategoryButton extends ButtonPanelButton {
    constructor() { super(); this.title = "RESISTANCE ROLLS"; this._icon = ICONS.panel; }
    get label() { return this.title; }
    get icon()  { return this._icon; }
    get hasContents() { return true; }
    get isInteractive() { return true; }
    async _getPanel() {
      await RMUData.ensureRMUReady();
      const list = RMUData.getTokenResistances();
      if (!list.length) {
        const empty = new (class NoResistButton extends ActionButton { get label() { return "No resistances"; } get icon()  { return ICONS.panel; } get classes() { return [...super.classes, "disabled"]; } })();
        return new ButtonPanel({ id: "rmu-resistances", buttons: [empty] });
      }
      const buttons = list.map(r => new RMUResistanceActionButton(r));
      const panel = new ButtonPanel({ id: "rmu-resistances", buttons });
      UIGuards.attachPanelInputGuards(panel);
      return panel;
    }
  }

  class RMUResistanceActionPanel extends ActionPanel {
    get label() { return "RESISTANCES"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { await RMUData.ensureRMUReady(); return [ new RMUResistanceCategoryButton() ]; }
  }

  CoreHUD.defineMainPanels([RMUResistanceActionPanel]);
}

// -----------------------------------------------------------------------------
// III. Special Checks Panel
// -----------------------------------------------------------------------------

export function defineSpecialChecksMain(CoreHUD) {
  const { ICONS, RMUUtils, RMUData } = window;
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel, BUTTONS } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ActionButton, ButtonPanelButton } = BUTTONS;
  const { UIGuards } = window;

  async function rollSkillWithOption(token, skillObj, optionText) {
    await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenSkillAction", skillObj, { specialManeuver: optionText });
  }

  class RMUSpecialCheck_Endurance extends ActionButton {
    constructor() { super(); this._skill = null; }
    get label() { return "PHYSICAL"; }
    get icon()  { return ICONS.endurance; }
    get isInteractive() { return true; }
    get hasTooltip() { return true; }

    async getTooltipData() {
      const sys = this._skill?.system ?? {};
      const details = [
          { label: "Skill", value: sys.name },
          { label: "Stat", value: sys.stat },
          { label: "Ranks", value: sys._totalRanks },
          { label: "Total Bonus", value: sys._bonus }
      ].filter(x => x.value);
      
      return { 
        title: this.label, 
        subtitle: sys.name ?? "Endurance Check", 
        details: RMUUtils.formatTooltipDetails(details)
      };
    }
    
    async _renderInner() {
      await super._renderInner(); if (!this.element) return;
      this.element.style.pointerEvents = "auto"; this.element.style.cursor = "pointer";
      const actor = ui.ARGON?._token?.actor;
      this._skill = actor ? RMUData.getSkillByName(actor, "Body Development") : null;
      RMUUtils.applyValueOverlay(this.element, this._skill?.system?._bonus ?? "", "Total");
    }
    async _onMouseDown(event) {
      if (event?.button !== 0) return; event.preventDefault(); event.stopPropagation(); await RMUData.ensureRMUReady();
      const token = ui.ARGON?._token; const actor = token?.actor;
      if (!actor) { ui.notifications?.error?.("No active token for HUD."); return; }
      const skill = this._skill ?? RMUData.getSkillByName(actor, "Body Development");
      if (!skill) { ui.notifications?.warn?.("Skill not found: Body Development"); return; }
      await rollSkillWithOption(token, skill, "Endurance");
    }
    async _onLeftClick(e){ e?.preventDefault?.(); e?.stopPropagation?.(); }
  }

  class RMUSpecialCheck_Concentration extends ActionButton {
    constructor() { super(); this._skill = null; }
    get label() { return "MENTAL"; }
    get icon()  { return ICONS.concentration; }
    get isInteractive() { return true; }
    get hasTooltip() { return true; }

		async getTooltipData() {
      const sys = this._skill?.system ?? {};
      const details = [
          { label: "Name",             value: sys.name },
          { label: "Specialization",   value: sys.specialization },
          { label: "Category",         value: sys.category },
          { label: "Total ranks",      value: sys._totalRanks },
          { label: "Rank bonus",       value: sys._rankBonus },
          { label: "Culture ranks",    value: sys.cultureRanks },
          { label: "Stat",             value: sys.stat },
          { label: "Stat bonus",       value: sys._statBonus },
          { label: "Prof bonus",       value: sys._professionalBonus },
          { label: "Knack",            value: sys._knack },
          { label: "Total bonus",      value: sys._bonus }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");

      return { 
        title: this.label, 
        subtitle: sys.name ?? "Concentration Check", 
        details: RMUUtils.formatTooltipDetails(details)
      };
    }
    
    async _renderInner() {
      await super._renderInner(); if (!this.element) return;
      this.element.style.pointerEvents = "auto"; this.element.style.cursor = "pointer";
      const actor = ui.ARGON?._token?.actor;
      this._skill = actor ? RMUData.getSkillByName(actor, "Mental Focus") : null;
      RMUUtils.applyValueOverlay(this.element, this._skill?.system?._bonus ?? "", "Total");
    }
    async _onMouseDown(event) {
      if (event?.button !== 0) return; event.preventDefault(); event.stopPropagation(); await RMUData.ensureRMUReady();
      const token = ui.ARGON?._token; const actor = token?.actor;
      if (!actor) { ui.notifications?.error?.("No active token for HUD."); return; }
      const skill = this._skill ?? RMUData.getSkillByName(actor, "Mental Focus");
      if (!skill) { ui.notifications?.warn?.("Skill not found: Mental Focus"); return; }
      await rollSkillWithOption(token, skill, "Concentration");
    }
    async _onLeftClick(e){ e?.preventDefault?.(); e?.stopPropagation?.(); }
  }

  class RMUSpecialChecksCategoryButton extends ButtonPanelButton {
    get label() { return "ENDURANCE"; }
    get icon()  { return ICONS.special; }
    get isInteractive() { return true; }
    async _getPanel() {
      await RMUData.ensureRMUReady();
      const buttons = [new RMUSpecialCheck_Endurance(), new RMUSpecialCheck_Concentration()];
      const panel = new ButtonPanel({ id: "rmu-special-checks", buttons });
      UIGuards.attachPanelInputGuards(panel);
      return panel;
    }
  }

  class RMUSpecialChecksActionPanel extends ActionPanel {
    get label() { return "ENDURANCE"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [ new RMUSpecialChecksCategoryButton() ]; }
  }
  CoreHUD.defineMainPanels([RMUSpecialChecksActionPanel]);
}

// -----------------------------------------------------------------------------
// IV. Rest, Combat, and Drawer Panels
// -----------------------------------------------------------------------------

export function defineRestMain(CoreHUD) {
  const { ICONS, RMUUtils } = window;
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ActionButton } = ARGON.MAIN.BUTTONS;

  class RMURestActionButton extends ActionButton {
    get label() { return "REST"; }
    get icon()  { return ICONS.rest; }
    get visible() { return !game.combat?.started; }
    get isInteractive() { return true; }
    get hasTooltip() { return true; }
    async getTooltipData() { return { title: "Rest", subtitle: "Recover resources", details: [{ label: "Info", value: "Open the rest dialog." }] }; }
    async _renderInner() { await super._renderInner(); if (this.element) { this.element.style.pointerEvents = "auto"; this.element.style.cursor = "pointer"; } }
    async _onMouseDown(event) { if (event?.button !== 0) return; event.preventDefault(); event.stopPropagation(); await this._run(); }
    async _onLeftClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }
    async _run() { await RMUUtils.rmuTokenActionWrapper(ui.ARGON?._token, "rmuTokenRestAction"); }
  }

  class RMURestActionPanel extends ActionPanel {
    get label() { return "REST"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [ new RMURestActionButton() ]; }
  }
  CoreHUD.defineMainPanels([RMURestActionPanel]);
}

export function defineCombatMain(CoreHUD) {
  const { ICONS } = window;
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ActionButton } = ARGON.MAIN.BUTTONS;

  class RMUEndTurnActionButton extends ActionButton {
    get label() { return "End Turn"; }
    get icon()  { return ICONS.combat; }
    get isInteractive() { return true; }
    get hasTooltip() { return true; }
    get visible() {
      const tokenId = ui.ARGON?._token?.id;
      const c = game.combat;
      if (!c?.started || !tokenId) return false;
      const activeId = c.combatant?.tokenId ?? c.current?.tokenId ?? null;
      return activeId === tokenId;
    }
    async getTooltipData() { return { title: "End Turn", subtitle: "Advance to next combatant", details: [{ label: "Action", value: "Ends this token’s turn." }] }; }
    async _renderInner() { await super._renderInner(); if (this.element) { this.element.style.pointerEvents = "auto"; this.element.style.cursor = "pointer"; } }
    async _onMouseDown(ev) { if (ev?.button !== 0) return; ev.preventDefault(); ev.stopPropagation(); await this._endTurn(); }
    async _onLeftClick(ev) { ev?.preventDefault?.(); ev?.stopPropagation?.(); }
    async _endTurn() {
      const c = game.combat;
      const tokenId = ui.ARGON?._token?.id;
      const activeId = c?.combatant?.tokenId ?? c?.current?.tokenId ?? null;
      if (!c?.started || !tokenId || activeId !== tokenId) { ui.notifications?.warn?.("It is not this token’s turn."); return; }
      try {
        if (typeof c.nextTurn === "function") await c.nextTurn();
        else if (typeof c.advanceTurn === "function") await c.advanceTurn();
        else ui.notifications?.error?.("Combat API does not support advancing turns.");
      } catch (e) {
        console.error("[ECH-RMU] End Turn failed:", e);
        ui.notifications?.error?.(`End Turn failed: ${e?.message ?? e}`);
      }
    }
  }

  class RMUCombatActionPanel extends ActionPanel {
    get label() { return "COMBAT"; }
    get visible() {
      const c = game.combat;
      const tokenId = ui.ARGON?._token?.id;
      if (!c?.started || !tokenId) return false;
      const activeId = c.combatant?.tokenId ?? c.current?.tokenId ?? null;
      const isActorMatch = c.combatant?.actorId && (c.combatant.actorId === ui.ARGON?._token?.actor?.id);
      return activeId === tokenId || isActorMatch;
    }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [ new RMUEndTurnActionButton() ]; }
  }
  CoreHUD.defineMainPanels([RMUCombatActionPanel]);
}

export function defineDrawerPanel(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const Base = ARGON.DRAWER.DrawerPanel;
  if (!Base) { console.warn("[ECH-RMU] DrawerPanel base not found; skipping."); return; }

  class RMUDrawer extends Base {
    get title()   { return "Actions"; }
    get buttons() { return []; }
  }
  CoreHUD.defineDrawerPanel(RMUDrawer);
}