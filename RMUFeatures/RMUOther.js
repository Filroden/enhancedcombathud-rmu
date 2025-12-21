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

import { ICONS, RMUUtils, formatBonus, UIGuards } from '../RMUCore.js';
import { RMUData } from '../RMUData.js';

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
  const Base = ARGON?.HUD?.MovementHud || ARGON?.MovementHud;

  if (!Base) return;

  // --- GLOBAL HOOK: Strict Ownership Management for Phase History ---
  Hooks.on("updateCombat", async (combat, updates) => {
    if (!combat.started) return;

    // 1. ENDING TURN LOGIC (Save High Water Mark)
    // We check if *I* am the one who just finished a turn.
    const prevId = combat.previous.combatantId;
    if (prevId) {
        const prevCombatant = combat.combatants.get(prevId);
        // Only run this if I OWN the previous combatant
        if (prevCombatant?.tokenId && prevCombatant.isOwner) {
            const token = canvas.tokens.get(prevCombatant.tokenId);
            if (token) {
                // Calculate distance moved in that just-finished phase
                const history = token.document._movementHistory ?? [];
                const segments = history.map(h => ({ x: h.x, y: h.y }));
                const currentTotal = history.length ? canvas.grid.measurePath(segments).distance : 0;
                
                const startDist = token.document.getFlag("enhancedcombathud-rmu", "phaseStartDist") ?? 0;
                const distTraveled = Math.max(0, currentTotal - startDist);
                
                // Compare against existing max for the round
                const currentMax = token.document.getFlag("enhancedcombathud-rmu", "maxCompletedPhases") ?? 0;
                
                if (distTraveled > currentMax) {
                    await token.document.setFlag("enhancedcombathud-rmu", "maxCompletedPhases", distTraveled);
                }
            }
        }
    }

    // 2. STARTING TURN LOGIC (Set Phase Baseline)
    // We check if *I* am the one starting a turn.
    const currentId = combat.current.combatantId;
    const currentCombatant = combat.combatants.get(currentId);
    if (currentCombatant?.tokenId && currentCombatant.isOwner) {
        const token = canvas.tokens.get(currentCombatant.tokenId);
        if (token) {
            const history = token.document._movementHistory ?? [];
            const segments = history.map(h => ({ x: h.x, y: h.y }));
            const total = history.length ? canvas.grid.measurePath(segments).distance : 0;
            
            // Snapshot my total distance as the "Floor" for this new phase
            await token.document.setFlag("enhancedcombathud-rmu", "phaseStartDist", total);
        }
    }
  });

  class RMUMovementHud extends Base {
    // --- Data Helpers ---
    get _mv() { return this.actor?.system?._movementBlock ?? {}; }
    get _modeKey() { return this._mv._selected; }
    get _modeTbl() { return this._mv._table?.[this._modeKey] ?? null; }
    get _rates() { return Array.isArray(this._modeTbl?.paceRates) ? this._modeTbl.paceRates : []; }
    _pace(name) { return this._rates.find(r => r?.pace?.value === name) ?? null; }

    get visible() { return true; }
    get movementMax() { return 10; }

    /** Round BMR (e.g. 30ft) */
    get _roundBMR() {
      const walk = this._pace("Walk");
      return Number(walk?.perRound ?? 0); 
    }

    get totalRoundMovement() {
      if (!game.combat?.started || !this.token) return 0;
      const doc = this.token.document;
      const history = Array.isArray(doc._movementHistory) ? doc._movementHistory : [];
      if (history.length === 0) return 0;
      const segments = history.map(h => ({ x: h.x, y: h.y }));
      return canvas.grid.measurePath(segments).distance;
    }

    /** Distance moved in current active phase */
    get phaseMovement() {
        const total = this.totalRoundMovement;
        const startDist = this.token.document.getFlag("enhancedcombathud-rmu", "phaseStartDist") ?? 0;
        return Math.max(0, total - startDist);
    }

    /** Max distance moved in any COMPLETED phase this round */
    get maxHistoryMovement() {
        return this.token.document.getFlag("enhancedcombathud-rmu", "maxCompletedPhases") ?? 0;
    }

    onTokenUpdate(updates, context) {
      if (updates.x === undefined && updates.y === undefined) return;
      this.updateMovement();
    }

    /** Helper to generate HTML for a 10-box bar */
    _buildBarHtml(ratio, maxMarkerIndex = -1) {
        // Standard RMU Scale: Walk (1.0 ratio) = 2 boxes.
        const boxesFilled = Math.min(10, Math.ceil(ratio * 2));

        const boxColors = [
            "rmu-blue", "rmu-green",        // 0.5x, 1.0x (Walk)
            "rmu-yellow", "rmu-yellow",     // 1.5x, 2.0x (Jog)
            "rmu-orange", "rmu-orange",     // 2.5x, 3.0x (Run)
            "rmu-red", "rmu-red",           // 3.5x, 4.0x (Sprint)
            "rmu-dark-red", "rmu-dark-red"  // 4.5x, 5.0x (Dash)
        ];

        let html = "";
        for (let i = 0; i < 10; i++) {
            const isActive = i < boxesFilled;
            const colorClass = isActive ? boxColors[i] : "";
            // Apply ghost marker ONLY if this box matches the max history index
            const ghostClass = (i === maxMarkerIndex) ? "rmu-ghost-max" : "";
            
            html += `<div class="movement-space ${colorClass} ${ghostClass}"></div>`;
        }
        return html;
    }

    async updateMovement() {
      const isCombat = !!game.combat?.started;
      
      // 1. UI Setup
      if (!this.element.querySelector(".rmu-tactical-info")) {
        const textEl = this.element.querySelector(".movement-text");
        if (textEl) textEl.style.display = "none";

        const info = document.createElement("div");
        info.className = "rmu-tactical-info";
        this.element.appendChild(info);

        const sidebar = document.createElement("div");
        sidebar.className = "rmu-sidebar";
        sidebar.innerHTML = `
            <span>D</span><span></span>
            <span>S</span><span></span>
            <span>R</span><span></span>
            <span>J</span><span></span>
            <span>W</span><span>C</span>`;
        this.element.prepend(sidebar);

        const track1 = document.createElement("div");
        track1.className = "rmu-track-container";
        track1.innerHTML = `<div class="rmu-track-label">RND</div><div class="movement-spaces round-track"></div>`;
        
        const track2 = document.createElement("div");
        track2.className = "rmu-track-container";
        track2.innerHTML = `<div class="rmu-track-label">PHS</div><div class="movement-spaces phase-track"></div>`;
        
        const existingSpaces = this.element.querySelector(".movement-spaces");
        if (existingSpaces && !existingSpaces.classList.contains("round-track")) {
            existingSpaces.replaceWith(track1);
            track1.after(track2);
        } else if (!this.element.querySelector(".round-track")) {
             this.element.appendChild(track1);
             this.element.appendChild(track2);
        }
      }

      // --- DEFINITIONS (Declared once here) ---
      const infoBox = this.element.querySelector(".rmu-tactical-info");
      const sidebar = this.element.querySelector(".rmu-sidebar");
      const roundBar = this.element.querySelector(".round-track");
      const phaseBar = this.element.querySelector(".phase-track");

      const visibilityState = isCombat ? "visible" : "hidden";
      if (infoBox) infoBox.style.visibility = visibilityState;
      if (sidebar) sidebar.style.visibility = visibilityState;
      if (roundBar) roundBar.parentElement.style.visibility = visibilityState;
      if (phaseBar) phaseBar.parentElement.style.visibility = visibilityState;

      if (!isCombat) return;

      // --- 2. DATA CALCULATIONS ---
      
      // A. Baselines
      const roundBMR = Math.max(0.01, this._roundBMR); 
      const phases = game.combat?.flags?.rmu?.actionPhase?.phasesPerRound ?? 4;
      const phaseBMR = roundBMR / phases; 
      
      // B. Distances
      const totalDist = this.totalRoundMovement; // For Middle Section
      const phaseDist = this.phaseMovement;       // For Phase Bar
      const maxHistoryDist = this.maxHistoryMovement; // For Bottom Section
      const effectivePhaseDist = Math.max(phaseDist, maxHistoryDist);

      // C. Ratios
      const roundRatio = totalDist / roundBMR; // 1.0 = Walk (1x BMR)
      const penaltyRatio = effectivePhaseDist / phaseBMR; // 1.0 = Walk (1x Phase BMR)

      // --- 3. MIDDLE SECTION: DEDICATED MOVEMENT (AP COST) ---
      let apCost = 0;
      if (totalDist > 0) apCost = Math.ceil(roundRatio);
      if (apCost === 0 && totalDist > 0) apCost = 1; 
      if (totalDist > 0 && apCost < 1) apCost = 1;

      // Warning: Exceeding Dash (5x BMR)
      const isDashExceeded = roundRatio > 5.0;
      
      // Next AP Calculation
      const currentAPTier = Math.floor(totalDist / roundBMR);
      const nextAPDist = (currentAPTier + 1) * roundBMR;
      const distToNextAP = nextAPDist - totalDist;

      // --- 4. BOTTOM SECTION: ACTING WHILE MOVING (PENALTIES) ---
      let paceName = "Stationary";
      let penalty = 0;
      
      if (effectivePhaseDist > 0) { paceName = "Creep"; penalty = 0; }
      if (penaltyRatio > 0.5) { paceName = "Walk";  penalty = -25; }
      if (penaltyRatio > 1.0) { paceName = "Jog";   penalty = -50; }
      if (penaltyRatio > 2.0) { paceName = "Run";   penalty = -75; }
      if (penaltyRatio > 3.0) { paceName = "Sprint"; penalty = -100; }
      if (penaltyRatio > 4.0) { paceName = "Dash";   penalty = -125; }

      // Warning: Exceeding Run Pace? (Cannot act if > Run)
      const isActionInvalid = penaltyRatio > 3.0;

      // --- 5. RENDER HTML ---
      
      infoBox.innerHTML = `
        <div class="rmu-info-header" style="font-size: var(--filroden-font-size-l);">BASE BMR: <span>${roundBMR.toFixed(2)} ft</span></div>

        <div class="rmu-info-section">
            <div class="rmu-info-header">Dedicated Move</div>
            <div class="rmu-info-line">Round Total: <strong>${totalDist.toFixed(2)} ft</strong></div>
            <div class="rmu-info-line">Current Cost: <strong>${apCost} AP</strong></div>
            ${!isDashExceeded ? `<div class="rmu-info-sub">Next AP in: ${distToNextAP.toFixed(2)} ft</div>` : ""}
            ${isDashExceeded ? `<div class="rmu-info-warn" >MAX ROUND LIMIT</div>` : ""}
        </div>

        <div class="rmu-info-section">
            <div class="rmu-info-header">Acting While Moving</div>
            <div class="rmu-info-line">Phase Max: <strong>${effectivePhaseDist.toFixed(2)} ft</strong></div>
            <div class="rmu-info-line">Effective Pace: <strong>${paceName}</strong></div>
            <div class="rmu-info-line">Penalty: <strong style="color:var(--filroden-color-danger);">${penalty} OB</strong></div>
            ${isActionInvalid ? `<div class="rmu-info-warn">TOO FAST TO ACT</div>` : ""}
        </div>
      `;

      // --- 6. RENDER BARS ---
      // We reuse the variables declared at the top.
      if (roundBar) roundBar.innerHTML = this._buildBarHtml(roundRatio);

      if (phaseBar) {
        // Ghost Marker Index
        const maxRatio = maxHistoryDist / phaseBMR;
        const markerIndex = Math.min(9, Math.ceil(maxRatio * 2) - 1);
        
        // Phase Bar Ratio
        const phaseRatio = phaseDist / phaseBMR;
        phaseBar.innerHTML = this._buildBarHtml(phaseRatio, markerIndex);
      }
    }

    set movementUsed(value) { }
    get movementUsed() { return this.totalRoundMovement; }

    _onNewRound(combat) {
        // Reset flags for the new round
        this.token.document.setFlag("enhancedcombathud-rmu", "phaseStartDist", 0);
        this.token.document.setFlag("enhancedcombathud-rmu", "maxCompletedPhases", 0);
        setTimeout(() => this.updateMovement(), 50);
    }

    async _onCombatEnd(combat) {
        await this.token.document.unsetFlag("enhancedcombathud-rmu", "phaseStartDist");
        await this.token.document.unsetFlag("enhancedcombathud-rmu", "maxCompletedPhases");
        
        this.updateMovement(); 
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
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;

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
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel, BUTTONS } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ActionButton, ButtonPanelButton } = BUTTONS;

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
      const title = this.label;
      const subtitle = this._skill?.system?.name ?? "Endurance Check";
      return RMUUtils.buildSkillTooltip(this._skill, title, subtitle);
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
      const title = this.label;
      const subtitle = this._skill?.system?.name ?? "Concentration Check";
      return RMUUtils.buildSkillTooltip(this._skill, title, subtitle);
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
    get visible() {
      const tokenId = ui.ARGON?._token?.id;
      const c = game.combat;
      if (!c?.started || !tokenId) return false;
      const activeId = c.combatant?.tokenId ?? c.current?.tokenId ?? null;
      return activeId === tokenId;
    }
    
    // Argon Buttons prefer _onLeftClick for interaction
    async _onLeftClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const c = game.combat;
        if (!c?.started) return;

        try {
            // Support both standard Foundry and common module combat extensions
            if (typeof c.nextTurn === "function") await c.nextTurn();
            else if (typeof c.advanceTurn === "function") await c.advanceTurn();
            else ui.notifications?.error?.("Combat API does not support advancing turns.");
        } catch (e) {
            console.error("[ECH-RMU] End Turn failed:", e);
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