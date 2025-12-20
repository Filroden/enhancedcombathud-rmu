/**
 * Enhanced Combat HUD — RMU extension
 *
 * Central module definition and initialization for the Rolemaster Unified (RMU)
 * system extension of the Argon Combat HUD. This file handles environment
 * setup and coordinates feature loading.
 */

// Import modular logic
import { UIGuards, defineTooltip, defineSupportedActorTypes } from './RMUCore.js';
import './RMUData.js'; // Imports RMUData for its side effects (attaching to window)
import { defineAttacksMain } from './RMUFeatures/RMUAttacks.js';
import { defineSkillsMain } from './RMUFeatures/RMUSkills.js';
import { defineSpellsMain } from './RMUFeatures/RMUSpells.js';
import {
  defineResistancesMain,
  defineSpecialChecksMain,
  defineRestMain,
  defineCombatMain,
  definePortraitPanel,
  defineMovementHud,
  defineWeaponSets,
  defineDrawerPanel
} from './RMUFeatures/RMUOther.js';

/**
 * Initializes the RMU-specific configuration for the Argon HUD.
 * This function is called by the 'argonInit' hook.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
function initConfig(CoreHUD) {
  if (game.system.id !== "rmu") return;

  // A. UI Basics
  defineTooltip(CoreHUD);
  defineSupportedActorTypes(CoreHUD);

  // B. Portrait/Movement
  definePortraitPanel(CoreHUD);
  defineMovementHud(CoreHUD);
  defineWeaponSets(CoreHUD);

  // C. Main Panels (Attacks, Spells, Skills)
  defineAttacksMain(CoreHUD);
  defineSpellsMain(CoreHUD);
  defineSkillsMain(CoreHUD);

  // D. Main Panels (Resistances, Special, Rest, Combat)
  defineResistancesMain(CoreHUD);
  defineSpecialChecksMain(CoreHUD);
  defineRestMain(CoreHUD);
  defineCombatMain(CoreHUD);

  // E. Drawer (Macros)
  defineDrawerPanel(CoreHUD);
}

// -----------------------------------------------------------------------------
// III. Foundry Hooks
// -----------------------------------------------------------------------------

Hooks.once("init", () => console.info(`[ECH-RMU] Initializing RMU extension`));

Hooks.once("setup", () => {
  console.info(`[ECH-RMU] Setting up RMU extension hooks`);
  // Install the aggressive, global guard to prevent keydown conflicts.
  UIGuards.installGlobalHudInputGuard();
});

// Register the main configuration function with Argon
Hooks.on("argonInit", (CoreHUD) => initConfig(CoreHUD));

Hooks.once("ready", () => {
  console.info(`[ECH-RMU] RMU extension is ready`);
  // Add a system-specific class to the body for CSS scoping
  const body = document.body;
  if (!body.classList.contains("enhancedcombathud-rmu")) {
    body.classList.add("enhancedcombathud-rmu");
    console.info("[ECH-RMU] Added .enhancedcombathud-rmu to <body> for scoped CSS");
  }
});

Hooks.once("shutdown", () => {
  document.body.classList.remove("enhancedcombathud-rmu");
});

// Update visibility of REST and COMBAT buttons when combat starts/ends
Hooks.on("updateCombat", () => ui.ARGON?.components?.main?.forEach(c => c.updateVisibility?.()));
Hooks.on("deleteCombat", () => ui.ARGON?.components?.main?.forEach(c => c.updateVisibility?.()));