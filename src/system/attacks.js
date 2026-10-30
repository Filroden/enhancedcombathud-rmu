/**
 * Physical attacks: reading the actor's attack list and the facts the Attacks panel shows.
 *
 * Paths are those of the RMU system's derived attack objects (system._attacks), confirmed
 * against captured actors. Category decisions use the system's own flags (isShield,
 * isRanged, isThrown, type) rather than matching skill names, which would break once names
 * are translated.
 */

import { hudActor } from "./context.js";

/** Display order and keys of the attack categories. */
export const ATTACK_CATEGORIES = Object.freeze(["melee", "ranged", "natural", "shield"]);

/** Attack types the system uses for attacks made without a weapon. */
const NATURAL_ATTACK_TYPES = new Set(["unarmed", "natural"]);

/** Two-handed bonus the system gives a weapon wielded two-handed. */
const TWO_HANDED_BONUS = 10;

/** Shown when a value is missing (for example no short range). */
const NO_VALUE = "—";

/**
 * Builds a key that identifies one attack across rebuilds of the attack list.
 * The system rebuilds the list when equipment changes and indexes (attackId) can shift, so
 * the key also includes what makes this usage distinct (handedness, chart, specialisation,
 * ranged or not).
 * @param {object} att
 * @returns {string}
 */
export function attackKey(att) {
    const itemId = att?.itemId ?? att?._id ?? att?.id;
    return `${itemId}::${att?.attackId}::${att?.handed}::${att?.chart?.name}::${att?.specialization}::${att?.isRanged}`;
}

/** @returns {Array<object>} The HUD actor's current attack list. */
export function getActorAttacks() {
    const list = hudActor()?.system?._attacks;
    return Array.isArray(list) ? list : [];
}

/**
 * Returns the current version of an attack from the actor's live attack list, or the
 * attack itself if it can no longer be found.
 * @param {object} srcAttack
 * @returns {object}
 */
export function getLiveAttack(srcAttack) {
    const key = attackKey(srcAttack);
    return getActorAttacks().find((a) => attackKey(a) === key) || srcAttack;
}

/**
 * Whether an attack's weapon is ready to use. The system reports isEquipped; readyState is
 * the older name for the same flag.
 * @param {object|undefined} attack
 * @returns {boolean}
 */
export function isAttackEquipped(attack) {
    return Boolean(attack?.isEquipped ?? attack?.readyState ?? false);
}

/**
 * The Attacks panel category for an attack.
 * @param {object} att
 * @returns {"melee"|"ranged"|"natural"|"shield"}
 */
export function attackCategory(att) {
    if (att?.isShield === true) return "shield";
    if (NATURAL_ATTACK_TYPES.has(att?.type) || att?.isNatural === true) return "natural";
    if (att?.isRanged === true || att?.isThrown === true) return "ranged";
    return "melee";
}

/**
 * Short range as the system formats it (it already includes the actor's modifiers and the
 * unit), falling back to the base short range in feet.
 * @param {object} att
 * @returns {string}
 */
export function attackShortRange(att) {
    const range = att?.usage?.range;
    if (range?._shortRange) return String(range._shortRange);
    if (range?.short !== undefined && range?.short !== null) return `${range.short}'`;
    return NO_VALUE;
}

/**
 * Facts shown in an attack's tooltip, in display order. Values may be undefined; the
 * tooltip drops empty entries.
 * @param {object} a - The attack.
 * @param {string} category - Its category key.
 * @returns {Array<{label: string, value: *}>}
 */
export function attackTooltipDetails(a, category) {
    const meleeReach = a.meleeRange ? Number.parseFloat(Number(a.meleeRange).toFixed(1)) : null;
    return [
        { label: "Specialization", value: a.specialization || a.skill?.specialization },
        { label: "Size", value: a.usage?.size },
        { label: "Chart", value: a.chart?.name },
        { label: "Fumble", value: a.fumble },
        ...(category === "ranged" ? [{ label: "Range (short)", value: attackShortRange(a) }] : [{ label: "Melee reach", value: meleeReach }]),
        { label: "Item Strength", value: a.itemStrength },
        { label: "Ranks", value: a.skill?.ranks },
        { label: "Combat Training", value: a.skill?.name },
        { label: "2H", value: Number(a.twoHandedBonus) === TWO_HANDED_BONUS ? "Yes" : "No" },
        { label: "Bonus OB", value: a.itemBonus },
        { label: "Total OB", value: a.totalBonus },
    ];
}
