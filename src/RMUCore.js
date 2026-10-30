/**
 * Contains shared utilities and the core Argon integration points used by multiple panels.
 */

import { SUPPORTED_ACTOR_TYPES } from "./constants.js";
import { ICONS, getUserIcon } from "./icons.js";
import { formatBonus } from "./format.js";
import { UIGuards } from "./ui/guards.js";
import { applyValueOverlay, buildChipContainer } from "./ui/dom.js";

// -----------------------------------------------------------------------------
// I. Core Utilities (Reusable logic, API wrappers, Formatting)
// -----------------------------------------------------------------------------

/**
 * A collection of shared utility functions for the RMU HUD.
 * @global
 */
const RMUUtils = {
    /** Mounts the value overlay on a button (see ui/dom.js). */
    applyValueOverlay,

    /** Creates or refreshes the chip row on a button (see ui/dom.js). */
    buildChipContainer,
};

// -----------------------------------------------------------------------------
// II. Core Argon Definitions (Non-feature logic)
// -----------------------------------------------------------------------------

/**
 * Defines a custom tooltip class for the RMU HUD.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
function defineTooltip(CoreHUD) {
    const ARGON = CoreHUD.ARGON;
    const BaseTooltip = ARGON?.CORE?.Tooltip || ARGON?.HUD?.Tooltip || ARGON?.Tooltip;

    if (!BaseTooltip) {
        console.warn("[ECH-RMU] Argon CORE.Tooltip base class not found; skipping custom tooltip.");
        return;
    }

    /**
     * CORE's tooltip with the module's class added, so the module CSS can adjust our
     * tooltips without touching those of other Argon extensions.
     * @augments BaseTooltip
     */
    class RMUTooltip extends BaseTooltip {
        get classes() {
            return [...super.classes, "ech-rmu-tooltip"];
        }
    }

    CoreHUD.defineTooltip(RMUTooltip);
}

/**
 * Defines the actor types that the RMU HUD will activate for.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
function defineSupportedActorTypes(CoreHUD) {
    CoreHUD.defineSupportedActorTypes([...SUPPORTED_ACTOR_TYPES]);
}

// -----------------------------------------------------------------------------
// III. Export
// -----------------------------------------------------------------------------

// ICONS, getUserIcon, formatBonus and UIGuards are defined in their own modules and
// re-exported here so the feature files can keep importing all shared helpers from one place.
export { ICONS, getUserIcon, RMUUtils, UIGuards, formatBonus, defineTooltip, defineSupportedActorTypes };
