/**
 * RMUFeatures/RMUOther.js
 *
 * Defines smaller, stable panels:
 * - Portrait, Movement, WeaponSets
 * - Resistance Rolls
 * - Special Checks (Endurance)
 * - Rest
 * - Combat (End Turn)
 * - Drawer (Macros)
 */

const { ICONS, RMUUtils, RMUData, formatBonus } = window;

// -----------------------------------------------------------------------------
// I. Portrait/Movement/Utility Panels
// -----------------------------------------------------------------------------

/**
 * Defines the custom RMU Portrait panel.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function definePortraitPanel(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const Base = ARGON.PORTRAIT.PortraitPanel;

  if (!Base) {
    console.warn("[ECH-RMU] PortraitPanel base not found; skipping.");
    return;
  }

  /**
   * Custom RMU Portrait Panel
   * @augments Base
   */
  class RMUPortraitPanel extends Base {
    get description() {
      const a = this.actor;
      if (!a) return "";
      const level = a.system?.level ?? a.system?.details?.level;
      const prof = a.system?.profession ?? a.system?.details?.profession;
      return [level != null ? `Lvl ${level}` : null, prof].filter(Boolean).join(" · ");
    }
    get isDead() { return this.isDying; }
    get isDying() {
      const hp = this.actor?.system?.health?.hp;
      return Number(hp?.value ?? 0) <= 0;
    }

    /**
     * Opens the Defenses Dialog when the new button is clicked.
     * @param {Event} event - The click event.
     */
    async _onOpenDefenseDialog(event) {
      event.preventDefault();
      event.stopPropagation();

      const actor = this.actor;
      if (!actor) return;
      await RMUData.ensureRMUReady();

      const dbBlock = actor.system?._dbBlock;
      const defenseState = actor.system?.defense;

      const dodgeOptions = dbBlock?.dodgeOptions;
      const blockOptions = dbBlock?.blockOptions;
      const currentDodge = defenseState?.dodge;
      const currentBlock = defenseState?.block;
      const currentOther = defenseState?.other ?? 0;

      /** Helper function to build <option> tags */
      const buildOptions = (options, selectedValue) => {
        if (!Array.isArray(options)) return "";
        return options.map(opt => `
          <option value="${opt.value}" ${opt.value === selectedValue ? "selected" : ""}>
            ${opt.label}
          </option>
        `).join("");
      };

      const content = `
        <form style="display: flex; flex-direction: column; gap: 10px;">
          <div class="form-group">
            <label>Dodge</label>
            <select name="dodge">
              ${buildOptions(dodgeOptions, currentDodge)}
            </select>
          </div>
          <div class="form-group">
            <label>Block</label>
            <select name="block">
              ${buildOptions(blockOptions, currentBlock)}
            </select>
          </div>
          <div class="form-group">
            <label>Other DB modifiers</label>
            <input type="number" name="other" value="${currentOther}">
          </div>
        </form>
      `;

      new Dialog({
        title: "Set Defenses",
        content: content,
        buttons: {
          apply: {
            label: "Apply Changes",
            callback: async (html) => {
              const newDodge = html.find('[name="dodge"]').val();
              const newBlock = html.find('[name="block"]').val();
              const newOther = parseInt(html.find('[name="other"]').val()) || 0;

              if (newDodge === "passive" && newBlock === "passive") {
                ui.notifications.warn("You cannot use Passive Dodge and Passive Block at the same time.");
                return;
              }

              // Robustly find the correct token for the API
              let targetToken = ui.ARGON?._token;
              if (!targetToken || targetToken.actor?.id !== this.actor.id) {
                if (this.actor.isToken) {
                  targetToken = this.actor.token?.object; // Synthetic
                } else {
                  targetToken = this.actor.getActiveTokens()[0]; // First placed
                }
              }

              if (!targetToken) {
                ui.notifications.warn("[ECH-RMU] No valid token found on the canvas to update defenses.");
                return;
              }

              // Call APIs with the valid token
              if (newDodge !== currentDodge) {
                await RMUUtils.rmuTokenActionWrapper(
                  targetToken, "rmuTokenSetDodgeOption", newDodge
                );
              }
              if (newBlock !== currentBlock) {
                await RMUUtils.rmuTokenActionWrapper(
                  targetToken, "rmuTokenSetBlockOption", newBlock
                );
              }
              if (newOther !== currentOther) {
                await RMUUtils.rmuTokenActionWrapper(
                  targetToken, "rmuTokenSetOtherDB", newOther
                );
              }
            }
          },
          cancel: {
            label: "Cancel"
          }
        },
        default: "apply"
      }, {
        classes: ["dialog", "enhancedcombathud-rmu", "rmu-defenses-dialog"]
      }).render(true);
    }

    /**
     * Activates listeners for the panel.
     * This is where we inject the "Set Defenses" button.
     * @param {HTMLElement} element - The panel's DOM element.
     */
    async activateListeners(element) {
      await super.activateListeners(element);

      // Find the existing "Open Character Sheet" button
      const actorSheetButton = element.querySelector('.player-button[data-tooltip="Open Character Sheet"]');
      if (!actorSheetButton) {
        console.warn("[ECH-RMU] Could not find actor sheet button to inject defense button.");
        return;
      }

      const buttonBar = actorSheetButton.parentElement;
      if (!buttonBar) {
        console.warn("[ECH-RMU] Could not find parent of actor sheet button.");
        return;
      }

      // Create the new Defenses button
      const defenseButton = document.createElement("div");
      defenseButton.classList.add("player-button");
      defenseButton.dataset.tooltip = "Set Defenses";

      const iconPath = foundry.utils.getRoute("modules/enhancedcombathud-rmu/icons/guardian.svg");
      defenseButton.innerHTML = `<img src="${iconPath}" width="28px" height="28px" alt="Defenses" style="vertical-align: middle; border: none;">`;

      // Add the click listener
      defenseButton.addEventListener("click", this._onOpenDefenseDialog.bind(this));

      // Insert the button before the character sheet button
      buttonBar.insertBefore(defenseButton, actorSheetButton);
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

/**
 * Defines the custom RMU Movement panel.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineMovementHud(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const Base = ARGON?.MOVEMENT?.MovementHud || ARGON?.MovementHud || ARGON?.HUD?.MovementHud;

  if (!Base) { console.warn("[ECH-RMU] MovementHud base not found; skipping."); return; }

  /**
   * Custom RMU Movement Panel
   * @augments Base
   */
  class RMUMovementHud extends Base {
    get _mv() { return this.actor?.system?._movementBlock ?? {}; }
    get _modeKey() { return this._mv._selected; }
    get _modeTbl() { return this._mv._table?.[this._modeKey] ?? null; }
    get _rates() { return Array.isArray(this._modeTbl?.paceRates) ? this._modeTbl.paceRates : []; }
    _pace(name) { return this._rates.find(r => r?.pace?.value === name) ?? null; }
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
    get baseLabel() { return "Move"; }
    get currentSpeed() { return this.baseMovement; }
    get maxSpeed() { return this.baseMovement; }
    get speed() { return this.currentSpeed; }
    get value() { return this.currentSpeed; }

    async getData(...args) {
      const data = await super.getData?.(...args) ?? {};
      data.current = this.currentSpeed;
      data.max = this.maxSpeed;
      data.base = this.baseMovement;
      return data;
    }
  }
  CoreHUD.defineMovementHud(RMUMovementHud);
}

/**
 * Defines a (hidden) Weapon Sets panel to satisfy Argon's requirements
 * while not being used in RMU.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineWeaponSets(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const Base = ARGON?.WEAPONS?.WeaponSets || ARGON?.WeaponSets || ARGON?.HUD?.WeaponSets;
  if (!Base) { console.warn("[ECH-RMU] WeaponSets base not found; skipping."); return; }

  /**
   * Hidden RMU Weapon Sets Panel
   * @augments Base
   */
  class RMUWeaponSets extends Base {
    get sets() { return []; }
    _onSetChange(_id) { /* no-op in RMU */ }
    get visible() { return false; } // Always hidden
  }

  CoreHUD.defineWeaponSets(RMUWeaponSets);
}


// -----------------------------------------------------------------------------
// II. Resistance Rolls Panel
// -----------------------------------------------------------------------------

/**
 * Defines the main Resistance Rolls panel.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineResistancesMain(CoreHUD) {
  const { ICONS, RMUUtils, RMUData } = window;
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;
  const { UIGuards } = window;

  /**
   * An action button for a single Resistance Roll (e.g., "Essence").
   * @augments ActionButton
   */
  class RMUResistanceActionButton extends ActionButton {
    constructor(resist) { super(); this.resist = resist; }
    get label() { return this.resist?.name || "Resistance"; }
    get icon() { return ICONS[this.resist?.name] || ICONS.panel; }
    get isInteractive() { return true; }
    get hasTooltip() { return true; }

    async getTooltipData() {
      const r = this.resist ?? {};
      const details = [
        { label: "Stat Bonus", value: r.statBonus },
        { label: "Level Bonus", value: r.levelBonus },
        { label: "Racial Bonus", value: r.racialBonus },
        { label: "Special Bonus", value: r.specialBonus },
        { label: "Armour Bonus", value: r.armorBonus },
        { label: "Helmet Bonus", value: r.helmetBonus },
        { label: "Same Realm", value: r.sameRealmBonus },
        { label: "Total", value: r.total }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");

      return {
        title: this.label,
        subtitle: r.statShortName,
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

  /**
   * The category button that opens the Resistance Rolls panel.
   * @augments ButtonPanelButton
   */
  class RMUResistanceCategoryButton extends ButtonPanelButton {
    constructor() { super(); this.title = "RESISTANCE ROLLS"; this._icon = ICONS.panel; }
    get label() { return this.title; }
    get icon() { return this._icon; }
    get hasContents() { return true; }
    get isInteractive() { return true; }

    async _getPanel() {
      await RMUData.ensureRMUReady();
      const list = RMUData.getTokenResistances();
      if (!list.length) {
        const empty = new (class NoResistButton extends ActionButton { get label() { return "No resistances"; } get icon() { return ICONS.panel; } get classes() { return [...super.classes, "disabled"]; } })();
        return new ButtonPanel({ id: "rmu-resistances", buttons: [empty] });
      }
      const buttons = list.map(r => new RMUResistanceActionButton(r));
      const panel = new ButtonPanel({ id: "rmu-resistances", buttons });
      UIGuards.attachPanelInteractionGuards(panel);
      return panel;
    }
  }

  /**
   * The main "Resistances" panel for the HUD.
   * @augments ActionPanel
   */
  class RMUResistanceActionPanel extends ActionPanel {
    get label() { return "RESISTANCES"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { await RMUData.ensureRMUReady(); return [new RMUResistanceCategoryButton()]; }
  }

  CoreHUD.defineMainPanels([RMUResistanceActionPanel]);
}

// -----------------------------------------------------------------------------
// III. Special Checks Panel
// -----------------------------------------------------------------------------

/**
 * Defines the main Special Checks (Endurance/Concentration) panel.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineSpecialChecksMain(CoreHUD) {
  const { ICONS, RMUUtils, RMUData } = window;
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel, BUTTONS } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ActionButton, ButtonPanelButton } = BUTTONS;
  const { UIGuards } = window;

  /**
   * Helper to roll a skill with a specific "Special Maneuver" option.
   * @param {Token} token - The token.
   * @param {object} skillObj - The raw skill object.
   * @param {string} optionText - The special maneuver text (e.g., "Endurance").
   */
  async function rollSkillWithOption(token, skillObj, optionText) {
    await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenSkillAction", skillObj, { specialManeuver: optionText });
  }

  /**
   * Action button for the Physical (Endurance) check.
   * @augments ActionButton
   */
  class RMUSpecialCheck_Endurance extends ActionButton {
    constructor() { super(); this._skill = null; }
    get label() { return "PHYSICAL"; }
    get icon() { return ICONS.endurance; }
    get isInteractive() { return true; }
    get hasTooltip() { return true; }

    async getTooltipData() {
      const sys = this._skill?.system ?? {};
      const details = [
        { label: "Total ranks", value: sys._totalRanks },
        { label: "Rank bonus", value: sys._rankBonus },
        { label: "Culture ranks", value: sys.cultureRanks },
        { label: "Stat", value: sys.stat },
        { label: "Stat bonus", value: sys._statBonus },
        { label: "Prof bonus", value: sys._professionalBonus },
        { label: "Knack", value: sys._knack },
        { label: "Total bonus", value: sys._bonus }
      ].filter(x => x.value !== undefined && x.value !== null && x.value !== "");

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
    async _onLeftClick(e) { e?.preventDefault?.(); e?.stopPropagation?.(); }
  }

  /**
   * Action button for the Mental (Concentration) check.
   * @augments ActionButton
   */
  class RMUSpecialCheck_Concentration extends ActionButton {
    constructor() { super(); this._skill = null; }
    get label() { return "MENTAL"; }
    get icon() { return ICONS.concentration; }
    get isInteractive() { return true; }
    get hasTooltip() { return true; }

    async getTooltipData() {
      const sys = this._skill?.system ?? {};
      const details = [
        { label: "Total ranks", value: sys._totalRanks },
        { label: "Rank bonus", value: sys._rankBonus },
        { label: "Culture ranks", value: sys.cultureRanks },
        { label: "Stat", value: sys.stat },
        { label: "Stat bonus", value: sys._statBonus },
        { label: "Prof bonus", value: sys._professionalBonus },
        { label: "Knack", value: sys._knack },
        { label: "Total bonus", value: sys._bonus }
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
    async _onLeftClick(e) { e?.preventDefault?.(); e?.stopPropagation?.(); }
  }

  /**
   * The category button that opens the Special Checks panel.
   * @augments ButtonPanelButton
   */
  class RMUSpecialChecksCategoryButton extends ButtonPanelButton {
    get label() { return "ENDURANCE"; }
    get icon() { return ICONS.special; }
    get isInteractive() { return true; }
    async _getPanel() {
      await RMUData.ensureRMUReady();
      const buttons = [new RMUSpecialCheck_Endurance(), new RMUSpecialCheck_Concentration()];
      const panel = new ButtonPanel({ id: "rmu-special-checks", buttons });
      UIGuards.attachPanelInteractionGuards(panel);
      return panel;
    }
  }

  /**
   * The main "Endurance" panel for the HUD.
   * @augments ActionPanel
   */
  class RMUSpecialChecksActionPanel extends ActionPanel {
    get label() { return "ENDURANCE"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [new RMUSpecialChecksCategoryButton()]; }
  }
  CoreHUD.defineMainPanels([RMUSpecialChecksActionPanel]);
}

// -----------------------------------------------------------------------------
// IV. Rest, Combat, and Drawer Panels
// -----------------------------------------------------------------------------

/**
 * Defines the main Rest panel.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineRestMain(CoreHUD) {
  const { ICONS, RMUUtils } = window;
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ActionButton } = ARGON.MAIN.BUTTONS;

  /**
   * Action button to open the Rest dialog.
   * @augments ActionButton
   */
  class RMURestActionButton extends ActionButton {
    get label() { return "REST"; }
    get icon() { return ICONS.rest; }
    get visible() { return !game.combat?.started; } // Hide in combat
    get isInteractive() { return true; }
    get hasTooltip() { return true; }
    async getTooltipData() { return { title: "Rest", subtitle: "Recover resources", details: [{ label: "Info", value: "Open the rest dialog." }] }; }
    async _renderInner() { await super._renderInner(); if (this.element) { this.element.style.pointerEvents = "auto"; this.element.style.cursor = "pointer"; } }
    async _onMouseDown(event) { if (event?.button !== 0) return; event.preventDefault(); event.stopPropagation(); await this._run(); }
    async _onLeftClick(event) { event?.preventDefault?.(); event?.stopPropagation?.(); }
    async _run() { await RMUUtils.rmuTokenActionWrapper(ui.ARGON?._token, "rmuTokenRestAction"); }
  }

  /**
   * The main "Rest" panel for the HUD.
   * @augments ActionPanel
   */
  class RMURestActionPanel extends ActionPanel {
    get label() { return "REST"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [new RMURestActionButton()]; }
  }
  CoreHUD.defineMainPanels([RMURestActionPanel]);
}

/**
 * Defines the main Combat (End Turn) panel.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineCombatMain(CoreHUD) {
  const { ICONS } = window;
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ActionButton } = ARGON.MAIN.BUTTONS;

  /**
   * Action button to end the current combatant's turn.
   * @augments ActionButton
   */
  class RMUEndTurnActionButton extends ActionButton {
    get label() { return "End Turn"; }
    get icon() { return ICONS.combat; }
    get isInteractive() { return true; }
    get hasTooltip() { return true; }
    /** Only visible if it's this token's turn in active combat. */
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

  /**
   * The main "Combat" panel for the HUD.
   * @augments ActionPanel
   */
  class RMUCombatActionPanel extends ActionPanel {
    get label() { return "COMBAT"; }
    /** Only visible if it's this token's turn in active combat. */
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
    async _getButtons() { return [new RMUEndTurnActionButton()]; }
  }
  CoreHUD.defineMainPanels([RMUCombatActionPanel]);
}

/**
 * Defines the custom Drawer panel (for macros).
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineDrawerPanel(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const BaseDrawer = ARGON.DRAWER.DrawerPanel;
  const BaseDrawerButton = ARGON.DRAWER.DrawerButton;

  if (!BaseDrawer || !BaseDrawerButton) {
    console.warn("[ECH-RMU] DrawerPanel or DrawerButton base not found; skipping macro drawer.");
    return;
  }

  /**
   * A single button in the drawer, representing one macro.
   * @augments BaseDrawerButton
   */
  class RMUMacroDrawerButton extends BaseDrawerButton {
    constructor(macro) {
      const buttonParts = [
        {
          label: macro.name,
          onClick: (e) => {
            if (this.interceptDialogs) ui.ARGON.interceptNextDialog(e.currentTarget.closest(".ability"));
            macro.execute();
          }
        }
      ];
      super(buttonParts); // Pass to base constructor
      this.macro = macro;
    }

    async getData() {
      const data = await super.getData();
      const part = data.buttons[0]; // Get the first (and only) button part
      if (part) {
        part.label = this.macro.name;
      }
      return data;
    }

    setGrid(gridCols) {
      this.element.style.gridTemplateColumns = "1fr"; // Force single column
    }

    setAlign(align) {
      this._textAlign = ["left"];
      this.setTextAlign();
    }
  }

  /**
   * The custom RMU Drawer, which displays hotbar macros.
   * @augments BaseDrawer
   */
  class RMUDrawer extends BaseDrawer {
    get title() { return "Macros"; }

    get categories() {
      const hotbarMacros = Object.values(game.user.hotbar)
        .map(id => game.macros.get(id))
        .filter(macro => macro); // Filter out empty slots

      let macroButtons;
      if (!hotbarMacros.length) {
        const emptyButtonPart = [{ label: "No Macros in Hotbar" }];
        macroButtons = [new BaseDrawerButton(emptyButtonPart)];
      } else {
        macroButtons = hotbarMacros.map(macro => new RMUMacroDrawerButton(macro));
      }

      return [
        {
          gridCols: "1fr", // Each button is a full row
          captions: [{ label: "Hotbar Macros", align: "left" }],
          align: ["left"],
          buttons: macroButtons
        }
      ];
    }
  }

  CoreHUD.defineDrawerPanel(RMUDrawer);
}