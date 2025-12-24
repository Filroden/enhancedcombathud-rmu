/**
 * RMUFeatures/RMUOther.js
 *
 * Defines utility panels for the Enhanced Combat HUD (Rolemaster Unified):
 * - Portrait (Defenses configuration)
 * - Movement (Phase-based tracking with AP cost calculation)
 * - WeaponSets (Hidden stub for compatibility)
 * - Resistance Rolls
 * - Special Checks (Endurance/Concentration)
 * - Rest & Combat Turn Management
 * - Macro Drawer
 *
 * @module RMUOther
 */

import { ICONS, RMUUtils, UIGuards } from '../RMUCore.js';
import { RMUData } from '../RMUData.js';

// -----------------------------------------------------------------------------
// Portrait & Defenses
// -----------------------------------------------------------------------------

/**
 * Defines the custom RMU Portrait panel.
 * Adds a button to configure Dodge/Block/Parry defenses directly from the HUD.
 * * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function definePortraitPanel(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const Base = ARGON.PORTRAIT.PortraitPanel;

  if (!Base) {
    console.warn("[ECH-RMU] PortraitPanel base not found; skipping.");
    return;
  }

  /**
   * Custom RMU Portrait Panel.
   * Overrides standard display to show Level/Profession and injects the Defense dialog trigger.
   * @augments Base
   */
  class RMUPortraitPanel extends Base {
    
    /** @override */
    get description() {
      const a = this.actor;
      if (!a) return "";
      const level = a.system?.level ?? a.system?.details?.level;
      const prof = a.system?.profession ?? a.system?.details?.profession;
      return [level != null ? `Lvl ${level}` : null, prof].filter(Boolean).join(" · ");
    }

    /** @override */
    get isDead() { return this.isDying; }

    /** @override */
    get isDying() {
      const hp = this.actor?.system?.health?.hp;
      return Number(hp?.value ?? 0) <= 0;
    }

    /**
     * Renders and handles the Defense Configuration Dialog.
     * Reads current defense options (Passive vs Active) and updates the actor via API.
     * @param {Event} event - The click event.
     * @private
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

              // Locate the specific token instance for the action wrapper
              let targetToken = ui.ARGON?._token;
              if (!targetToken || targetToken.actor?.id !== this.actor.id) {
                if (this.actor.isToken) {
                  targetToken = this.actor.token?.object; 
                } else {
                  targetToken = this.actor.getActiveTokens()[0]; 
                }
              }

              if (!targetToken) {
                ui.notifications.warn("[ECH-RMU] No valid token found on the canvas to update defenses.");
                return;
              }

              if (newDodge !== currentDodge) {
                await RMUUtils.rmuTokenActionWrapper(targetToken, "rmuTokenSetDodgeOption", newDodge);
              }
              if (newBlock !== currentBlock) {
                await RMUUtils.rmuTokenActionWrapper(targetToken, "rmuTokenSetBlockOption", newBlock);
              }
              if (newOther !== currentOther) {
                await RMUUtils.rmuTokenActionWrapper(targetToken, "rmuTokenSetOtherDB", newOther);
              }
            }
          },
          cancel: { label: "Cancel" }
        },
        default: "apply"
      }, {
        classes: ["dialog", "enhancedcombathud-rmu", "rmu-defenses-dialog"]
      }).render(true);
    }

    /**
     * Injects the custom "Set Defenses" button into the Argon player panel.
     * @param {HTMLElement} element - The panel's DOM element.
     */
    async activateListeners(element) {
      await super.activateListeners(element);

      const actorSheetButton = element.querySelector('.player-button[data-tooltip="Open Character Sheet"]');
      if (!actorSheetButton) return;

      const buttonBar = actorSheetButton.parentElement;
      if (!buttonBar) return;

      const defenseButton = document.createElement("div");
      defenseButton.classList.add("player-button");
      defenseButton.dataset.tooltip = "Set Defenses";

      const iconPath = foundry.utils.getRoute("modules/enhancedcombathud-rmu/icons/guardian.svg");
      defenseButton.innerHTML = `<img src="${iconPath}" width="28px" height="28px" alt="Defenses" style="vertical-align: middle; border: none;">`;
      defenseButton.addEventListener("click", this._onOpenDefenseDialog.bind(this));

      buttonBar.insertBefore(defenseButton, actorSheetButton);
    }

    /** @override */
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

// -----------------------------------------------------------------------------
// Movement HUD
// -----------------------------------------------------------------------------

/**
 * Defines the custom RMU Movement panel.
 * Implements a "Snapshot" based tracking system to handle RMU's phase-based movement logic
 * while maintaining compatibility with Foundry's native undo functionality.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineMovementHud(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const Base = ARGON?.HUD?.MovementHud || ARGON?.MovementHud;

  if (!Base) return;

  // ===========================================================================
  // 1. LOGIC HELPERS
  // ===========================================================================

  /**
   * Extractor: Retrieves BMR and Encumbrance Limits from the Actor.
   * Ensures HUD and Commit logic use the exact same values.
   * @param {Actor} actor - The actor document.
   * @returns {object} { roundBMR: number, maxPaceName: string, maxPaceRatio: number }
   */
  function getActorMovementData(actor) {
    const movementBlock = actor?.system?._movementBlock ?? {};
    const modeKey = movementBlock._selected;
    const modeTbl = movementBlock._table?.[modeKey] ?? null;
    const rates = Array.isArray(modeTbl?.paceRates) ? modeTbl.paceRates : [];

    // 1. Determine BMR from the "Walk" entry (Standard RMU definition)
    // This accounts for Stride, Growth, etc. that modify the effective rates.
    const walkEntry = rates.find(r => r.pace?.value === "Walk");
    // Fallback to raw baseRate if table is missing, then to 30.
    const roundBMR = Number(walkEntry?.perRound ?? actor?.system?.movement?.baseRate ?? 30);

    // 2. Determine Limits
    const LIMITS = { "Creep": 0.125, "Walk": 0.25, "Jog": 0.50, "Run": 0.75, "Sprint": 1.00, "Dash": 1.25 };
    const PACES = ["Creep", "Walk", "Jog", "Run", "Sprint", "Dash"];
    
    let maxPaceName = "Sprint";
    let maxPaceRatio = 1.0; 

    // Find first forbidden pace
    const forbidden = rates.find(r => r.allowedPace === false);
    if (forbidden && forbidden.pace?.value) {
        const fName = forbidden.pace.value;
        const fIdx = PACES.indexOf(fName);
        if (fIdx > 0) {
            maxPaceName = PACES[fIdx - 1];
            maxPaceRatio = LIMITS[maxPaceName] ?? 1.0;
        } else {
            maxPaceName = "Stationary";
            maxPaceRatio = 0.001;
        }
    }

    return { roundBMR, maxPaceName, maxPaceRatio };
  }

  /**
   * Calculates pace category based on % of Round BMR.
   * @param {number} dist - Distance moved in phase.
   * @param {number} roundBMR - Full Round BMR.
   * @returns {object} { penalty, pace, ratio }
   */
  function getPaceStats(dist, roundBMR) {
    if (roundBMR <= 0) return { penalty: 0, pace: "Stationary", ratio: 0 };
    const ratio = dist / roundBMR;
    if (ratio <= 0.001) return { penalty: 0, pace: "Stationary", ratio };
    if (ratio <= 0.125) return { penalty: 0, pace: "Creep", ratio };
    if (ratio <= 0.25)  return { penalty: -25, pace: "Walk", ratio };
    if (ratio <= 0.50)  return { penalty: -50, pace: "Jog", ratio };
    if (ratio <= 0.75)  return { penalty: -75, pace: "Run", ratio };
    if (ratio <= 1.00)  return { penalty: -100, pace: "Sprint", ratio };
    return { penalty: -125, pace: "Dash", ratio };
  }

  /**
   * Calculates AP Cost.
   * Creep (<= 12.5%) = 0 AP.
   * Otherwise 1 AP per "Max Allowed Phase Distance".
   * @param {number} dist 
   * @param {number} roundBMR 
   * @param {number} maxPaceRatio 
   * @returns {number} Cost in AP
   */
  function getAPCost(dist, roundBMR, maxPaceRatio = 1.0) {
    if (dist <= 0) return 0;
    if ((dist / roundBMR) <= 0.125) return 0; // Creep is free

    const maxDistPerAP = roundBMR * maxPaceRatio;
    if (maxDistPerAP <= 0) return 1; 

    return Math.ceil(dist / maxDistPerAP);
  }

  /**
   * Commits the current phase's movement data to flags at end of turn.
   */
  async function commitTurnData(token, combat) {
    const doc = token.document || token;

    const startDist = doc.getFlag("enhancedcombathud-rmu", "phaseStartDist") ?? 0;
    const history = doc._movementHistory ?? [];
    const segments = history.map(h => ({ x: h.x, y: h.y }));
    const currentTotal = history.length ? canvas.grid.measurePath(segments).distance : 0;

    // Use a small epsilon/fixed to prevent floating point drift
    const phaseDist = Math.max(0, Number((currentTotal - startDist).toFixed(2)));

    // Update High Water Mark
    let currentMax = doc.getFlag("enhancedcombathud-rmu", "maxCompletedPhases") ?? 0;
    if (phaseDist > currentMax) {
      await doc.setFlag("enhancedcombathud-rmu", "maxCompletedPhases", phaseDist);
    }

    // --- Recalculate AP Cost ---
    // Use the shared extractor to guarantee we use the same BMR/Limits as the HUD.
    const { roundBMR, maxPaceRatio } = getActorMovementData(doc.actor);
    const phaseCost = getAPCost(phaseDist, roundBMR, maxPaceRatio);

    if (phaseCost > 0) {
      const currentAccum = doc.getFlag("enhancedcombathud-rmu", "roundAPSpent") || 0;
      await doc.setFlag("enhancedcombathud-rmu", "roundAPSpent", Number(currentAccum) + Number(phaseCost));
      
      // STICKY FLAG: If this phase exceeded 1 AP, mark the round as "Bonus AP used"
      if (phaseCost > 1) {
          await doc.setFlag("enhancedcombathud-rmu", "hasUsedBonusAP", true);
      }
    }

    // --- Close Phase (Prevent Double Counting) ---
    await doc.setFlag("enhancedcombathud-rmu", "phaseStartDist", currentTotal);

    // --- Action Reset Logic ---
    const actionTaken = doc.getFlag("enhancedcombathud-rmu", "actionTakenThisPhase");
    if (actionTaken) {
      await doc.setFlag("enhancedcombathud-rmu", "maxCompletedPhases", 0);
      await doc.unsetFlag("enhancedcombathud-rmu", "actionTakenThisPhase");
    }
  }

  /**
   * Clears movement tracking flags.
   */
  async function wipeFlags(tokens, fullWipe = false) {
    if (!canvas.scene || !tokens.length) return;
    const updates = tokens.map(t => {
      const flags = {
        "-=phaseStartDist": null,
        "-=maxCompletedPhases": null,
        "-=actionTakenThisPhase": null
      };
      if (fullWipe) {
        flags["-=roundAPSpent"] = null;
        flags["-=hasUsedBonusAP"] = null; // Reset the sticky warning flag on new round
      }
      return { _id: t.id, "flags.enhancedcombathud-rmu": flags };
    });
    await canvas.scene.updateEmbeddedDocuments("Token", updates);
  }

  // ===========================================================================
  // 2. HOOKS
  // ===========================================================================

  Hooks.on("updateCombat", async (combat, updates) => {
    if (!combat.started) return;

    if ("round" in updates) {
      const prevId = combat.previous.combatantId;
      if (prevId) {
        const prevComb = combat.combatants.get(prevId);
        if (prevComb?.token?.object?.isOwner) {
          await commitTurnData(prevComb.token.object, combat);
        }
      }
      const tokens = combat.combatants.map(c => c.token?.object).filter(t => t && t.isOwner);
      await wipeFlags(tokens, true);
      return;
    }

    const prevId = combat.previous.combatantId;
    if (prevId) {
      const prevComb = combat.combatants.get(prevId);
      if (prevComb?.token?.object?.isOwner) {
        await commitTurnData(prevComb.token.object, combat);
      }
    }

    const currId = combat.current.combatantId;
    if (currId) {
      const currComb = combat.combatants.get(currId);
      if (currComb?.token?.object?.isOwner) {
        const token = currComb.token.object;
        const history = token.document._movementHistory ?? [];
        const segments = history.map(h => ({ x: h.x, y: h.y }));
        const total = history.length ? canvas.grid.measurePath(segments).distance : 0;

        await token.document.setFlag("enhancedcombathud-rmu", "phaseStartDist", total);
      }
    }
  });

  Hooks.on("combatStart", async (combat) => {
    const tokens = combat.combatants.map(c => c.token).filter(t => t && t.isOwner);
    await wipeFlags(tokens, true);
  });

  Hooks.on("deleteCombat", async (combat) => {
    const docs = combat.combatants.map(c => c.token).filter(t => t && t.isOwner);
    await wipeFlags(docs, true);
  });

  // ===========================================================================
  // 3. HUD CLASS
  // ===========================================================================

  class RMUMovementHud extends Base {
    get visible() { return true; }
    get movementMax() { return 10; }

    // Use shared extractor for Consistency
    get _actorData() { return getActorMovementData(this.actor); }

    get totalRoundMovement() {
      if (!game.combat?.started || !this.token) return 0;
      const doc = this.token.document;
      const history = Array.isArray(doc._movementHistory) ? doc._movementHistory : [];
      if (history.length === 0) return 0;
      const segments = history.map(h => ({ x: h.x, y: h.y }));
      return canvas.grid.measurePath(segments).distance;
    }

    get phaseMovement() {
      const total = this.totalRoundMovement;
      const startDist = this.token.document.getFlag("enhancedcombathud-rmu", "phaseStartDist") ?? 0;
      return Math.max(0, Number((total - startDist).toFixed(2)));
    }

    get maxHistoryMovement() {
      return this.token.document.getFlag("enhancedcombathud-rmu", "maxCompletedPhases") ?? 0;
    }

    get committedRoundAP() {
      return this.token.document.getFlag("enhancedcombathud-rmu", "roundAPSpent") || 0;
    }

    // New Sticky Flag Getter
    get hasUsedBonusAP() {
      return this.token.document.getFlag("enhancedcombathud-rmu", "hasUsedBonusAP") || false;
    }

    onTokenUpdate(updates, context) {
      if (updates.x !== undefined || updates.y !== undefined || 
          updates.flags?.["enhancedcombathud-rmu"] !== undefined ||
          Object.keys(updates).some(k => k.startsWith("flags.enhancedcombathud-rmu"))) {
          this.updateMovement();
      }
    }

    _buildBarHtml(ratio, maxMarkerIndex = -1) {
      const boxesFilled = Math.min(10, Math.ceil(ratio / 0.125));
      const boxColors = ["rmu-blue", "rmu-green", "rmu-green", "rmu-yellow", "rmu-yellow", "rmu-orange", "rmu-orange", "rmu-red", "rmu-red", "rmu-dark-red"];
      let html = "";
      for (let i = 0; i < 10; i++) {
        const isActive = i < boxesFilled;
        const colorClass = isActive ? boxColors[i] : "";
        const ghostClass = (i === maxMarkerIndex) ? "rmu-ghost-max" : "";
        html += `<div class="movement-space ${colorClass} ${ghostClass}"></div>`;
      }
      return html;
    }

    async updateMovement() {
      const isCombat = !!game.combat?.started;
      const token = this.token;

      if (!this.element.querySelector(".rmu-tactical-info")) {
        const info = document.createElement("div"); info.className = "rmu-tactical-info"; this.element.appendChild(info);
        const sidebar = document.createElement("div"); sidebar.className = "rmu-sidebar";
        sidebar.innerHTML = `<span>Dash</span><span></span><span>Sprint</span><span></span><span>Run</span><span></span><span>Jog</span><span></span><span>Walk</span><span>Creep</span>`;
        this.element.prepend(sidebar);
        const trackContainer = document.createElement("div"); trackContainer.className = "rmu-track-container";
        trackContainer.innerHTML = `<div class="rmu-track-label">PHASE</div><div class="movement-spaces phase-track"></div>`;
        const existingSpaces = this.element.querySelector(".movement-spaces");
        if (existingSpaces && !existingSpaces.classList.contains("phase-track")) { existingSpaces.replaceWith(trackContainer); }
        else if (!this.element.querySelector(".phase-track")) { this.element.appendChild(trackContainer); }
      }

      const infoBox = this.element.querySelector(".rmu-tactical-info");
      const sidebar = this.element.querySelector(".rmu-sidebar");
      const phaseBar = this.element.querySelector(".phase-track");

      const visibilityState = isCombat ? "visible" : "hidden";
      if (infoBox) infoBox.style.visibility = visibilityState;
      if (sidebar) sidebar.style.visibility = visibilityState;
      if (phaseBar) phaseBar.parentElement.style.visibility = visibilityState;

      if (!isCombat || !token) return;

      // --- DATA ---
      const { roundBMR, maxPaceName, maxPaceRatio } = this._actorData;
      const phaseDist = this.phaseMovement;
      const maxHistoryDist = this.maxHistoryMovement;
      const effectivePhaseDist = Math.max(phaseDist, maxHistoryDist);
      const maxDistPerAP = roundBMR * maxPaceRatio;

      // --- CALCULATIONS ---
      const currentPhaseCost = Number(getAPCost(phaseDist, roundBMR, maxPaceRatio));
      const committedAP = Number(this.committedRoundAP);
      const totalRoundAP = committedAP + currentPhaseCost;

      const penaltyStats = getPaceStats(effectivePhaseDist, roundBMR);
      const currentRatio = effectivePhaseDist / roundBMR;
      const isEncumberedAction = currentRatio > maxPaceRatio;

      // --- WARNINGS (Bonus AP) ---
      // 1. Current Cost warning: If current phase exceeds 1 AP
      const isCostBonus = currentPhaseCost > 1;
      
      // 2. Total Round warning: If historical flag is set OR current is high
      const isTotalBonus = this.hasUsedBonusAP || isCostBonus;

      const costStyle = isCostBonus ? 'color:var(--filroden-color-danger);' : '';
      const costSuffix = isCostBonus ? ' <span style="font-size:0.8em">(Bonus AP needed)</span>' : '';
      
      const totalStyle = isTotalBonus ? 'color:var(--filroden-color-danger);' : '';
      const totalSuffix = isTotalBonus ? ' <span style="font-size:0.8em">(Bonus AP needed)</span>' : '';

      // --- PREDICTIONS ---
      let nextApHtml = "";
      if (currentPhaseCost === 0) {
          const distToWalk = Math.max(0, (0.125 * roundBMR) - phaseDist);
          nextApHtml = `<div class="rmu-info-sub">Spend AP in: ${distToWalk.toFixed(2)} ft</div>`;
      } else {
          const currentLimit = currentPhaseCost * maxDistPerAP;
          const distToNextAP = Math.max(0, currentLimit - phaseDist);
          nextApHtml = `<div class="rmu-info-sub">Next AP in: ${distToNextAP.toFixed(2)} ft</div>`;
      }

      const LIMITS = { "Creep": 0.125, "Walk": 0.25, "Jog": 0.50, "Run": 0.75, "Sprint": 1.00, "Dash": 1.25 };
      const thresholds = Object.values(LIMITS).sort((a, b) => a - b);
      const nextThreshold = thresholds.find(t => t > currentRatio);
      let nextPenaltyHtml = "";
      
      if (nextThreshold !== undefined) {
          const distToNextPenalty = Math.max(0, (nextThreshold * roundBMR) - phaseDist);
          nextPenaltyHtml = `<div class="rmu-info-sub">Next Penalty in: ${distToNextPenalty.toFixed(2)} ft</div>`;
      }

      // --- RENDER HTML ---
      infoBox.innerHTML = `
        <div class="rmu-info-header">
            BASE BMR: <span>${roundBMR.toFixed(2)} ft</span>
            <div class="rmu-info-sub">
                Limit: <strong>${maxPaceName.toUpperCase()} (${maxDistPerAP.toFixed(1)} ft/AP)</strong>
            </div>
            <div class="rmu-info-sub">
                Phase Move: <strong>${phaseDist.toFixed(2)} ft</strong>
            </div>
        </div>

        <div class="rmu-info-section">
            <div class="rmu-section-header">Dedicated Movement</div>
            <div class="rmu-info-line">Phase Cost: <strong style="${costStyle}">${currentPhaseCost} AP${costSuffix}</strong></div>
            <div class="rmu-info-line">Round Cost: <strong style="${totalStyle}">${totalRoundAP} AP${totalSuffix}</strong></div>
            ${nextApHtml}
        </div>

        <div class="rmu-info-section">
            <div class="rmu-section-header">Acting While Moving</div>
            <div class="rmu-info-line">Phase Pace: <strong>${penaltyStats.pace}</strong></div>
            <div class="rmu-info-line">Penalty: <strong style="color:var(--filroden-color-danger);">${penaltyStats.penalty}</strong></div>
            ${nextPenaltyHtml}
            ${isEncumberedAction ? `<div class="rmu-info-warn">TOO FAST TO ACT</div>` : ""}
        </div>
      `;

      if (phaseBar) {
        const maxBox = Math.min(9, Math.ceil(maxHistoryDist / roundBMR / 0.125) - 1);
        const curRatio = phaseDist / roundBMR;
        phaseBar.innerHTML = this._buildBarHtml(curRatio, maxBox);
      }
    }

    set movementUsed(value) { }
    get movementUsed() { return this.totalRoundMovement; }

    _onNewRound(combat) {
      if (!this.token) return;
      setTimeout(() => this.updateMovement(), 50);
    }

    async _onCombatEnd(combat) {
      if (!this.token) return;
      this.updateMovement();
    }
  }

  CoreHUD.defineMovementHud(RMUMovementHud);
}

// -----------------------------------------------------------------------------
// Weapon Sets (Hidden Stub)
// -----------------------------------------------------------------------------

/**
 * Defines a (hidden) Weapon Sets panel to satisfy Argon's requirements.
 * RMU does not use Argon's weapon set logic.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineWeaponSets(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const Base = ARGON?.WEAPONS?.WeaponSets || ARGON?.WeaponSets || ARGON?.HUD?.WeaponSets;
    if (!Base) { console.warn("[ECH-RMU] WeaponSets base not found; skipping."); return; }

    class RMUWeaponSets extends Base {
        get sets() { return []; }
        _onSetChange(_id) { }
        get visible() { return false; } 
    }
    CoreHUD.defineWeaponSets(RMUWeaponSets);
}

// -----------------------------------------------------------------------------
// Resistance Rolls
// -----------------------------------------------------------------------------

/**
 * Defines the main Resistance Rolls panel.
 * Dynamically generates buttons based on the actor's configured resistances.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineResistancesMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ButtonPanelButton, ActionButton } = ARGON.MAIN.BUTTONS;

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

  class RMUResistanceActionPanel extends ActionPanel {
    get label() { return "RESISTANCES"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { await RMUData.ensureRMUReady(); return [new RMUResistanceCategoryButton()]; }
  }

  CoreHUD.defineMainPanels([RMUResistanceActionPanel]);
}

// -----------------------------------------------------------------------------
// Special Checks (Endurance/Concentration)
// -----------------------------------------------------------------------------

/**
 * Defines the main Special Checks panel.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineSpecialChecksMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel, BUTTONS } = ARGON.MAIN;
  const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
  const { ActionButton, ButtonPanelButton } = BUTTONS;

  async function rollSkillWithOption(token, skillObj, optionText) {
    await RMUUtils.rmuTokenActionWrapper(token, "rmuTokenSkillAction", skillObj, { specialManeuver: optionText });
  }

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

  class RMUSpecialChecksActionPanel extends ActionPanel {
    get label() { return "ENDURANCE"; }
    get maxActions() { return null; }
    get currentActions() { return null; }
    async _getButtons() { return [new RMUSpecialChecksCategoryButton()]; }
  }
  CoreHUD.defineMainPanels([RMUSpecialChecksActionPanel]);
}

// -----------------------------------------------------------------------------
// Rest & Combat Actions
// -----------------------------------------------------------------------------

/**
 * Defines the main Rest panel.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineRestMain(CoreHUD) {
  const ARGON = CoreHUD.ARGON;
  const { ActionPanel } = ARGON.MAIN;
  const { ActionButton } = ARGON.MAIN.BUTTONS;

  class RMURestActionButton extends ActionButton {
    get label() { return "REST"; }
    get icon() { return ICONS.rest; }
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
    
    async _onLeftClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const c = game.combat;
        if (!c?.started) return;

        try {
            if (typeof c.nextTurn === "function") await c.nextTurn();
            else if (typeof c.advanceTurn === "function") await c.advanceTurn();
            else ui.notifications?.error?.("Combat API does not support advancing turns.");
        } catch (e) {
            console.error("[ECH-RMU] End Turn failed:", e);
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
    async _getButtons() { return [new RMUEndTurnActionButton()]; }
  }
  CoreHUD.defineMainPanels([RMUCombatActionPanel]);
}

// -----------------------------------------------------------------------------
// Macro Drawer
// -----------------------------------------------------------------------------

/**
 * Defines the custom Drawer panel which mirrors the Foundry Hotbar macros.
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
      super(buttonParts); 
      this.macro = macro;
    }

    async getData() {
      const data = await super.getData();
      const part = data.buttons[0]; 
      if (part) {
        part.label = this.macro.name;
      }
      return data;
    }

    setGrid(gridCols) {
      this.element.style.gridTemplateColumns = "1fr"; 
    }

    setAlign(align) {
      this._textAlign = ["left"];
      this.setTextAlign();
    }
  }

  class RMUDrawer extends BaseDrawer {
    get title() { return "Macros"; }

    get categories() {
      const hotbarMacros = Object.values(game.user.hotbar)
        .map(id => game.macros.get(id))
        .filter(macro => macro); 

      let macroButtons;
      if (!hotbarMacros.length) {
        const emptyButtonPart = [{ label: "No Macros in Hotbar" }];
        macroButtons = [new BaseDrawerButton(emptyButtonPart)];
      } else {
        macroButtons = hotbarMacros.map(macro => new RMUMacroDrawerButton(macro));
      }

      return [
        {
          gridCols: "1fr", 
          captions: [{ label: "Hotbar Macros", align: "left" }],
          align: ["left"],
          buttons: macroButtons
        }
      ];
    }
  }

  CoreHUD.defineDrawerPanel(RMUDrawer);
}