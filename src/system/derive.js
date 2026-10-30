/**
 * Makes sure the system has prepared the derived data the HUD reads.
 *
 * The RMU system calculates its extended data (attack lists, skill totals, spell SCRs and
 * so on) through the token document's hudDeriveExtendedData. Reading actor data before
 * that has run gives incomplete lists.
 */

import { hudActor, hudToken } from "./context.js";

/**
 * Asks the system to (re)derive the HUD token's extended data. Used after anything that
 * changes it, such as an equip toggle, and before an attack roll.
 * @returns {Promise<void>}
 */
export async function ensureExtendedTokenData() {
    const token = hudToken();
    const doc = token?.document ?? token;
    if (typeof doc?.hudDeriveExtendedData !== "function") return;
    try {
        await doc.hudDeriveExtendedData();
    } catch (e) {
        console.warn("[ECH-RMU] hudDeriveExtendedData failed:", e);
    }
}

/**
 * Derives the extended data only if the system has not done so for this actor yet.
 * @returns {Promise<void>}
 */
export async function ensureRMUReady() {
    const actor = hudActor();
    if (!actor || actor.system?._hudInitialized === true) return;
    await ensureExtendedTokenData();
}
