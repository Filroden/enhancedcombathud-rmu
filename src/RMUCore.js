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
    /**
     * Formats tooltip detail values, applying bonus formatting to most.
     * @param {Array<object>} details - Array of {label, value} objects.
     * @returns {Array<object>} The formatted array.
     */
    formatTooltipDetails(details) {
        const excludedLabels = new Set(["Ranks", "Total ranks", "Culture ranks", "Fumble", "Level", "Spells", "Charges"]);
        return details.map((detail) => {
            if (excludedLabels.has(detail.label)) {
                return detail;
            }
            return { ...detail, value: formatBonus(detail.value) };
        });
    },

    /** Mounts the value overlay on a button (see ui/dom.js). */
    applyValueOverlay,

    /**
     * Centralized utility to call an RMU system API function robustly.
     * Ensures a token is selected and handles API errors gracefully.
     * @param {Token} token - The token to perform the action on.
     * @param {string} apiFunctionName - The name of the function on `game.system.api`.
     * @param {...*} args - Arguments to pass to the API function.
     * @returns {Promise<boolean>} True if the API call succeeded, false otherwise.
     */
    async rmuTokenActionWrapper(token, apiFunctionName, ...args) {
        if (!token) {
            ui.notifications?.error?.("No active token for HUD.");
            return false;
        }
        const api = game.system?.api?.[apiFunctionName];
        if (typeof api !== "function") {
            console.warn(`[ECH-RMU] RMU API function not available: ${apiFunctionName}`);
            ui.notifications?.warn?.(`RMU API function not available: ${apiFunctionName}. Action simulated.`);
            return false;
        }

        try {
            // Ensure the token is controlled before acting, if possible
            if (!token.controlled && typeof token.control === "function") {
                await token.control({ releaseOthers: true });
            }
        } catch (_) {
            /* non-fatal if control fails */
        }

        try {
            await api(token, ...args);
            return true;
        } catch (err) {
            console.error(`[ECH-RMU] ${apiFunctionName} error:`, err);
            ui.notifications?.error?.(`${apiFunctionName} failed: ${err?.message ?? err}`);
            return false;
        }
    },

    /**
     * Builds a standardized tooltip data object for a skill.
     * @param {object} skill - The raw skill object.
     * @param {string} title - The main title for the tooltip.
     * @param {string} subtitle - The subtitle for the tooltip.
     * @returns {object} The tooltip data object.
     */
    buildSkillTooltip: function (skill, title, subtitle) {
        const sys = skill?.system ?? {};
        const details = [
            { label: "Total ranks", value: sys._totalRanks },
            { label: "Rank bonus", value: sys._rankBonus },
            { label: "Culture ranks", value: sys.cultureRanks },
            { label: "Stat", value: sys.stat },
            { label: "Stat bonus", value: sys._statBonus },
            { label: "Prof bonus", value: sys._professionalBonus },
            { label: "Knack", value: sys._knack },
            { label: "Total bonus", value: sys._bonus },
        ].filter((x) => x.value !== undefined && x.value !== null && x.value !== "");

        return {
            title: title,
            subtitle: subtitle,
            details: RMUUtils.formatTooltipDetails(details),
        };
    },

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

    /** @augments BaseTooltip */
    class RMUTooltip extends BaseTooltip {
        get classes() {
            return [...super.classes, "ech-rmu"];
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
