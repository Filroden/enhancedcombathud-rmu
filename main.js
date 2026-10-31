/**
 * Enhanced Combat HUD — RMU extension
 *
 * Central module definition and initialisation for the Rolemaster Unified (RMU)
 * system extension of the Argon Combat HUD. This file handles environment
 * setup and coordinates feature loading.
 */

// Import modular logic
import { SUPPORTED_ACTOR_TYPES } from "./src/constants.js";
import { registerIconSettings } from "./src/settings.js";
import { defineTooltip, defineSupportedActorTypes } from "./src/RMUCore.js";
import { closeHudForUnsupportedActors, renderDrawer, updateMainPanelVisibility } from "./src/argon.js";
import { onItemUpdated } from "./src/equipment.js";
import { defineAttacksMain } from "./src/RMUFeatures/RMUAttacks.js";
import { defineSkillsMain } from "./src/RMUFeatures/RMUSkills.js";
import { defineSpellsMain } from "./src/RMUFeatures/RMUSpells.js";
import { defineMagicItemsMain } from "./src/RMUFeatures/RMUItems.js";
import {
    defineResistancesMain,
    defineSpecialChecksMain,
    defineRestMain,
    defineCombatMain,
    definePortraitPanel,
    defineMovementHud,
    defineWeaponSets,
    defineDrawerPanel,
} from "./src/RMUFeatures/RMUOther.js";

const VALID_ACTOR_TYPES = new Set(SUPPORTED_ACTOR_TYPES);

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

    // C. Main Panels (Attacks, Spells, Items, Skills)
    defineAttacksMain(CoreHUD);
    defineSpellsMain(CoreHUD);
    defineMagicItemsMain(CoreHUD);
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

Hooks.once("init", () => {
    console.info(`[ECH-RMU] Initializing RMU extension`);
    registerIconSettings();
});

// Register the main configuration function with Argon
Hooks.on("argonInit", (CoreHUD) => initConfig(CoreHUD));

Hooks.once("ready", () => {
    console.info(`[ECH-RMU] RMU extension is ready`);
    // Add a system-specific class to the body for CSS scoping
    const body = document.body;
    if (!body.classList.contains("enhancedcombathud-rmu")) {
        body.classList.add("enhancedcombathud-rmu");
    }

    // Loot actors have no actions: close the HUD quietly instead of CORE's warning.
    // CORE's own ready hook runs first (it is a required module), so ui.ARGON exists here.
    closeHudForUnsupportedActors(VALID_ACTOR_TYPES);
});

// Update visibility of REST and COMBAT buttons when combat starts/ends
Hooks.on("updateCombat", () => updateMainPanelVisibility());
Hooks.on("deleteCombat", () => updateMainPanelVisibility());

// Keep equip toggles and disabled attacks in step with items changed elsewhere (the
// character sheet, or another user).
Hooks.on("updateItem", (item, changes) => onItemUpdated(item, changes));

// Keep the macro drawer in step with the hotbar. CORE builds the drawer only when the whole
// HUD renders, so a renamed, added or removed macro would otherwise not show until then.
// Debounced so that changing several macros at once re-renders the drawer once.
const renderDrawerSoon = foundry.utils.debounce(renderDrawer, 100);
Hooks.on("createMacro", () => renderDrawerSoon());
Hooks.on("updateMacro", () => renderDrawerSoon());
Hooks.on("deleteMacro", () => renderDrawerSoon());
Hooks.on("updateUser", (user, changes) => {
    if (user === game.user && "hotbar" in (changes ?? {})) renderDrawerSoon();
});
