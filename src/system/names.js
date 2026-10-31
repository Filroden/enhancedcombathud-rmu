/**
 * Display names for RMU identifiers that appear in several panels: stats, attack tables,
 * specialisations, professions and resistances.
 *
 * Each takes the system's untranslated identifier and returns the name in the current
 * language through the system's own language keys. An identifier without a key (a custom
 * entry, or one the language file does not cover) is shown as stored.
 */

import { localizeSystem, localizeSystemId } from "../i18n.js";

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
 * A skill specialisation (Blade, Crossbow, ...). Most spell list and place names have no
 * key and show as stored.
 * @param {string} specialization - The untranslated specialisation.
 * @returns {string}
 */
export function specializationName(specialization) {
    return localizeSystemId("RMU.Specializations", specialization);
}

/**
 * A profession's name (Mystic, Fighter, ...).
 * @param {string} profession - The untranslated profession.
 * @returns {string}
 */
export function professionName(profession) {
    return localizeSystemId("RMU.Profession", profession);
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
