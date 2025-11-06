/**
 * Enhanced Combat HUD — RMU extension
 *
 * Purpose: Central module definition and initialization for the Rolemaster Unified (RMU) system extension
 * of the Argon Combat HUD. This file handles environment setup and coordinates feature loading.
 */

// Import modular logic (must be loaded in Foundry's setup)
import { RMUUtils, UIGuards, installListSearch, defineTooltip, defineSupportedActorTypes } from './RMUCore.js';
import { RMUData } from './RMUData.js';
import { defineAttacksMain } from './RMUFeatures/RMUAttacks.js';
import { defineSkillsMain } from './RMUFeatures/RMUSkills.js';
import { defineSpellsMain } from './RMUFeatures/RMUSpells.js';
import { defineResistancesMain, defineSpecialChecksMain, defineRestMain, defineCombatMain, definePortraitPanel, defineMovementHud, defineWeaponSets, defineDrawerPanel } from './RMUFeatures/RMUOther.js';

function initConfig(CoreHUD) {
  if (game.system.id !== "rmu") return;

  // Global Utilities and Data Proxy (accessible by all feature files)
  // These are set by RMUCore.js and RMUData.js when they load
  // window.RMUUtils = RMUUtils;
  // window.RMUData = RMUData;
  // window.installListSearch = installListSearch;

  // A. UI Basics
  defineTooltip(CoreHUD);
  defineSupportedActorTypes(CoreHUD);

  // B. Portrait/Movement (from RMUOther.js)
  definePortraitPanel(CoreHUD);
  defineMovementHud(CoreHUD);
  defineWeaponSets(CoreHUD); 

  // C. Main Panels (Attack, Spell, Skill logic split into feature files)
  defineAttacksMain(CoreHUD);
  defineSpellsMain(CoreHUD);
  defineSkillsMain(CoreHUD);
  
  // C. Main Panels (Smaller/Stable Panels from RMUOther.js)
  // ** REMOVED DUPLICATE CALLS **
  defineResistancesMain(CoreHUD);
  defineSpecialChecksMain(CoreHUD);
  defineRestMain(CoreHUD);
  defineCombatMain(CoreHUD);

  // D. Drawer (from RMUOther.js)
  defineDrawerPanel(CoreHUD);
}

// -----------------------------------------------------------------------------
// III. Foundry Hooks
// -----------------------------------------------------------------------------

Hooks.once("init",  () => console.info(`[ECH-RMU] Initializing RMU extension`));
Hooks.once("setup", () => {
  console.info(`[ECH-RMU] Setting up RMU extension hooks`);
  // Install the aggressive, global guard once.
  // This relies on UIGuards being loaded from RMUCore.js
  UIGuards.installGlobalHudInputGuard();
});

// ** CRITICAL FIX: Changed 'registerSystemComponents' to 'initConfig' **
Hooks.on("argonInit", (CoreHUD) => initConfig(CoreHUD));

Hooks.once("ready", () => {
  console.info(`[ECH-RMU] RMU extension is ready`);
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