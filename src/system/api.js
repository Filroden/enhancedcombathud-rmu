/**
 * The only module that calls the RMU system's API (game.system.api).
 */

import { hudToken } from "../argon.js";
import { t, tf } from "../i18n.js";

/**
 * Calls an RMU token action (a roll, an equip toggle, the rest dialogue).
 * Makes sure the token is controlled first, because the system acts on controlled tokens,
 * and reports failures to the user instead of throwing.
 * @param {Token} token - The token to act for.
 * @param {string} apiFunctionName - The function on game.system.api (for example "rmuTokenSkillAction").
 * @param {...*} args - Arguments after the token.
 * @returns {Promise<boolean>} True if the call succeeded.
 */
export async function callTokenAction(token, apiFunctionName, ...args) {
    if (!token) {
        ui.notifications?.error?.(t("ECH-RMU.Notify.NoToken"));
        return false;
    }
    const api = game.system?.api?.[apiFunctionName];
    if (typeof api !== "function") {
        console.warn(`[ECH-RMU] RMU API function not available: ${apiFunctionName}`);
        ui.notifications?.warn?.(tf("ECH-RMU.Notify.ApiMissing", { name: apiFunctionName }));
        return false;
    }

    try {
        if (!token.controlled && typeof token.control === "function") {
            await token.control({ releaseOthers: true });
        }
    } catch {
        // Not fatal: the action is still attempted.
    }

    try {
        await api(token, ...args);
        return true;
    } catch (err) {
        console.error(`[ECH-RMU] ${apiFunctionName} error:`, err);
        ui.notifications?.error?.(tf("ECH-RMU.Notify.ApiFailed", { name: apiFunctionName, error: err?.message ?? String(err) }));
        return false;
    }
}

/**
 * Calls a token action for the HUD's token.
 * @param {string} apiFunctionName
 * @param {...*} args
 * @returns {Promise<boolean>}
 */
export function callHudTokenAction(apiFunctionName, ...args) {
    return callTokenAction(hudToken(), apiFunctionName, ...args);
}

/**
 * Gets a skill's description from the system (already localised by the system).
 * @param {object} skill - A skill entry from the actor's skill list.
 * @returns {Promise<string>} The description, or "" when unavailable.
 */
export async function getSkillDescription(skill) {
    const api = game.system?.api?.rmuGetSkillDescription;
    if (typeof api !== "function" || !skill) return "";
    try {
        return (await api(skill)) ?? "";
    } catch (err) {
        console.error("[ECH-RMU] rmuGetSkillDescription API call FAILED!", err);
        return t("ECH-RMU.Description.Error");
    }
}
