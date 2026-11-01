/**
 * Display names for RMU identifiers that appear in several panels: stats, attack tables,
 * specialisations, professions and resistances.
 *
 * Each takes the system's untranslated identifier and returns the name in the current
 * language through the system's own language keys. An identifier without a key (a custom
 * entry, or one the language file does not cover) is shown as stored.
 */

import { localizeSystem, localizeSystemEntry, localizeSystemId } from "../i18n.js";
import { knownSpellListName } from "./spells.js";

/** Language key prefix of skill specialisations. */
const SPECIALIZATION_PREFIX = "RMU.Specializations";

/**
 * A stat's abbreviation (SD becomes Ad in French).
 * @param {string} stat - The untranslated abbreviation, for example "SD".
 * @returns {string}
 */
export function statAbbreviation(stat) {
    return localizeSystemId("rmu.stats", stat);
}

/**
 * An attack table's name (Scimitar, Bolt, Water, ...).
 * @param {string} chart - The untranslated table name.
 * @returns {string}
 */
export function attackTableName(chart) {
    return localizeSystemId("RMU.AttackTables", chart);
}

/**
 * A skill specialisation (Blade, Crossbow, ...).
 *
 * Spell list skills (Spell Mastery, and the Grace skills of magical expertise) use the
 * list's name as their specialisation, which has no RMU.Specializations key, so a name the
 * system does not key as a specialisation falls back to the spell list of that name. A name
 * with neither key (a place or a language, for example) shows as stored.
 * @param {string} specialization - The untranslated specialisation.
 * @returns {string}
 */
export function specializationName(specialization) {
    if (!specialization) return specialization ?? "";
    if (game.i18n.has(`${SPECIALIZATION_PREFIX}.${specialization}`)) {
        return localizeSystemId(SPECIALIZATION_PREFIX, specialization);
    }
    return knownSpellListName(specialization) || specialization;
}

/**
 * A profession's name (Mystic, Fighter, ...). The system keys each profession under
 * RMU.Profession.<name>, with its name in .Name.
 * @param {string} profession - The untranslated profession.
 * @returns {string}
 */
export function professionName(profession) {
    return localizeSystemEntry("RMU.Profession", profession);
}

/**
 * A resistance's name. The system gives each resistance its language key (label); the
 * untranslated name is the fallback.
 * @param {object} resistance - An entry from the actor's resistance list.
 * @returns {string}
 */
export function resistanceName(resistance) {
    const label = localizeSystem(resistance?.label);
    return label && label !== resistance?.label ? label : (resistance?.name ?? "");
}
