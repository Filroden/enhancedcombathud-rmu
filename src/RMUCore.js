/**
 * Registrations with Argon CORE that are not tied to one panel: the tooltip class and the
 * supported actor types. Called from main.js in the argonInit hook.
 *
 * Shared helpers live in their own modules and are imported from there directly:
 * icons.js (ICONS, getUserIcon), format.js, ui/dom.js, ui/guards.js and ui/tooltip.js.
 */

import { SUPPORTED_ACTOR_TYPES } from "./constants.js";

/**
 * Defines a custom tooltip class for the RMU HUD.
 * @param {object} CoreHUD - The Argon CoreHUD object.
 */
export function defineTooltip(CoreHUD) {
    const BaseTooltip = CoreHUD.ARGON?.CORE?.Tooltip;

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
export function defineSupportedActorTypes(CoreHUD) {
    CoreHUD.defineSupportedActorTypes([...SUPPORTED_ACTOR_TYPES]);
}
