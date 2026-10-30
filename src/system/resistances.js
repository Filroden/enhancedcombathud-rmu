/**
 * Resistance rolls: reading the actor's resistance list.
 */

import { hudActor } from "./context.js";

/**
 * Turns a list-like value into an array. The system has held the resistances as a plain
 * array in exports, but live data can expose them through a getter or a collection, so
 * Maps (their values), Sets and other iterables are accepted too, as is a plain object
 * keyed by resistance whose entries look like resistances (they have a name or value).
 * @param {*} value
 * @returns {Array<object>}
 */
function toList(value) {
    if (!value || typeof value === "string") return [];
    if (Array.isArray(value)) return value;
    if (value instanceof Map) return [...value.values()];
    if (typeof value[Symbol.iterator] === "function") return Array.from(value);
    if (typeof value === "object") {
        return Object.values(value).filter((r) => r && typeof r === "object" && (r.name || r.value));
    }
    return [];
}

/**
 * @returns {Array<object>} The HUD actor's resistances (Channeling, Essence, Mentalism,
 * Physical, Fear). Each has value (the untranslated identifier), name, label (a
 * localisation key), statShortName and the bonus breakdown.
 *
 * In 1.4.133 the block's only own keys are _npc, _activeEffects and _resistances;
 * resistances is a getter on the block's class that calculates the list, and _resistances
 * is its internal store, which can be empty or out of date until the getter has run. The
 * getter is therefore read first, and the store only as a fallback.
 */
export function getActorResistances() {
    const system = hudActor()?.system;
    const block = system?._resistanceBlock;
    const candidates = [block?.resistances, block?._resistances, system?.resistances, system?._resistances];
    for (const candidate of candidates) {
        const list = toList(candidate);
        if (list.length) return list;
    }
    return [];
}
