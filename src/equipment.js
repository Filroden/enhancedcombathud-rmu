/**
 * Keeps the HUD's equipped states in step with the actor's items.
 *
 * Attack buttons (disabled while their weapon is not equipped) and item buttons (whose
 * spells can only be cast while the item is equipped) show an equip toggle. The equipped
 * state can change in three ways: the HUD's own toggle, the character sheet, or another
 * user (a GM editing a player's actor). All three end in an updateItem hook on this
 * client, so the HUD refreshes from that hook rather than only after its own toggle.
 *
 * Panels register a refresh function. refreshEquipment() runs them one after another and
 * never runs two refreshes at the same time: a button rendered twice at once would get two
 * equip toggles, because each render appends its own. A request made while a refresh is
 * running is folded into one more pass after it, so a burst of requests (the HUD's own
 * toggle and the updateItem hook it causes, or several items saved together) costs at
 * most two passes.
 */

import { hudActor } from "./argon.js";
import { ensureExtendedTokenData } from "./system/derive.js";

/** Item field that holds the equipped state ("equipped", "carried", ...). */
const EQUIPPED_PATH = "system.equipped";

/** @type {Set<() => Promise<void>>} */
const refreshers = new Set();

/** The refresh in progress, if any. */
let running = null;

/** Whether another pass was requested while a refresh was running. */
let pending = false;

/**
 * Registers a function that re-renders a panel's equip-dependent buttons. Panels are
 * defined once, in the argonInit hook, so each registers exactly once.
 * @param {() => Promise<void>} refresher
 */
export function onEquipmentChange(refresher) {
    refreshers.add(refresher);
}

/** One pass: re-derive the system data, then let every panel refresh. */
async function runRefreshers() {
    await ensureExtendedTokenData();
    for (const refresher of refreshers) {
        try {
            await refresher();
        } catch (err) {
            console.error("[ECH-RMU] Equipment refresh failed:", err);
        }
    }
}

/**
 * Refreshes every equip-dependent button. Safe to call at any time and from several
 * places at once (see the module comment).
 * @returns {Promise<void>} Resolves when the HUD shows the current equipped states.
 */
export function refreshEquipment() {
    if (running) {
        pending = true;
        return running;
    }
    running = (async () => {
        do {
            pending = false;
            await runRefreshers();
        } while (pending);
        running = null;
    })();
    return running;
}

/**
 * updateItem hook handler: refreshes when an item of the HUD's actor changes its equipped
 * state. Actors are compared by uuid because an unlinked token's actor is a synthetic
 * actor, which is the same document but not always the same object.
 * @param {Item} item
 * @param {object} changes
 */
export function onItemUpdated(item, changes) {
    const actor = hudActor();
    if (!actor || item?.parent?.uuid !== actor.uuid) return;
    if (!foundry.utils.hasProperty(changes ?? {}, EQUIPPED_PATH)) return;
    refreshEquipment();
}
