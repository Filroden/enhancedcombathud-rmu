/**
 * Localisation helpers.
 *
 * The module's own strings live in languages/en.json (US English, every key) and
 * languages/en-gb.json (only the keys whose British wording differs). Keys are flat and
 * start with the "ECH-RMU." namespace.
 *
 * Much of the HUD's text is really RMU terminology (Knack, SCR, Fumble, HP, ...). For those
 * terms the RMU system's own translation is preferred, so the HUD reads the same as the
 * character sheet in every language the system supports and translators only translate a
 * term once. Each such term still has a module string, used when the system has no key
 * for it or no translation in the current language.
 */

/** Namespace of the module's language keys. */
export const I18N_NAMESPACE = "ECH-RMU";

/**
 * Terms the HUD shares with the RMU system: the module term id mapped to the system's
 * language key. The module's own key for a term is "ECH-RMU.Term.<id>".
 *
 * Only plain terms are mapped. A system key that carries extra meaning (a tooltip title, a
 * sentence, a key that is lower case because the sheet capitalises it in context) is left
 * out, and the term uses the module string alone. Labels shown in tooltips are capitalised
 * by Argon CORE's CSS, so a difference in case between the system and the module text does
 * not show there.
 */
export const SYSTEM_TERM_KEYS = Object.freeze({
    AoE: "RMU.Terms.AoEHeader",
    AttackType: "RMU.Terms.AttackType",
    Charges: "RMU.Enchantment.Charges",
    Chart: "RMU.Terms.Chart",
    CombatTraining: "RMU.Terms.CombatTraining",
    DB: "RMU.Terms.DB",
    Duration: "RMU.Terms.DurationLabel",
    Endurance: "RMU.Terms.EnduranceLabel",
    Fumble: "RMU.Terms.FumbleLabel",
    HP: "RMU.Terms.HitPointsLabel",
    Instantaneous: "RMU.Filter.Instantaneous",
    ItemStrength: "RMU.EquipmentSheet.StrengthLegend",
    Knack: "RMU.Terms.Knack",
    Level: "RMU.Terms.Level",
    PP: "RMU.Terms.PowerPointsLabel",
    Range: "RMU.Terms.Range",
    Ranks: "RMU.Terms.RanksHeader",
    Rest: "RMU.RestInputs.RestLabel",
    SCR: "RMU.Terms.SCR",
    Size: "RMU.Terms.Size",
    Skills: "RMU.Terms.Skills",
    Specialization: "RMU.Terms.Specialization",
    Spells: "RMU.Terms.Spells",
    SpellType: "RMU.Terms.SpellType",
    Stat: "RMU.Terms.StatHeader",
    StatBonus: "RMU.Terms.StatBonus",
    Subconscious: "RMU.Filter.Subconscious",
    Targets: "RMU.Terms.Targets",
    Total: "RMU.Terms.Total",
    TotalBonus: "RMU.Terms.TotalBonus",
    TotalOB: "RMU.Terms.ArmsTotalOBHeader",
    TwoHanded: "RMU.Terms.2H",
    Weight: "RMU.Terms.Weight",
});

/**
 * Localises one of the module's keys.
 * @param {string} key - The full key, for example ECH-RMU.Panel.Skills.
 * @returns {string}
 */
export function t(key) {
    return game.i18n.localize(key);
}

/**
 * Localises one of the module's keys and fills its {placeholders}.
 * @param {string} key - The full key, for example ECH-RMU.Search.Summary.
 * @param {object} data - Placeholder values, for example { visible: 3, total: 10 }.
 * @returns {string}
 */
export function tf(key, data) {
    return game.i18n.format(key, data);
}

/**
 * @param {string} key
 * @returns {boolean} True when the current language itself translates the key (the English
 * fallback does not count).
 */
function hasOwnTranslation(key) {
    return game.i18n.has(key, false);
}

/**
 * Localises a term the HUD shares with the RMU system.
 *
 * The order is: the system's translation in the current language, then the module's, then
 * the system's English, then the module's English. Preferring the current language over
 * the source means a translation from either package beats English from the other; for
 * example a British English user sees the module's "Specialisation" rather than the
 * system's US "Specialization", while a Spanish user sees the system's Spanish term even
 * when the module has no Spanish file.
 * @param {string} id - A key of SYSTEM_TERM_KEYS, or any id with a module key
 *   "ECH-RMU.Term.<id>".
 * @returns {string}
 */
export function term(id) {
    const moduleKey = `${I18N_NAMESPACE}.Term.${id}`;
    const systemKey = SYSTEM_TERM_KEYS[id];
    if (systemKey && hasOwnTranslation(systemKey)) return game.i18n.localize(systemKey);
    if (hasOwnTranslation(moduleKey)) return game.i18n.localize(moduleKey);
    if (systemKey && game.i18n.has(systemKey)) return game.i18n.localize(systemKey);
    return game.i18n.localize(moduleKey);
}

/**
 * Localises a value that may be a language key. RMU data mixes keys (for example a spell's
 * label "RMU_SL.<list>.spells.<spell>.name") with text that is already readable, and which
 * fields are keys can change between system versions. A value that is not a known key is
 * returned unchanged.
 * @param {*} value
 * @returns {*}
 */
export function localizeSystem(value) {
    if (typeof value !== "string" || value === "") return value;
    return game.i18n.has(value) ? game.i18n.localize(value) : value;
}

/**
 * Localises a system identifier through one of the system's key prefixes, for example a
 * skill name through "RMU.Skills" ("Perception" becomes "RMU.Skills.Perception"). An
 * identifier without a key is returned unchanged, so custom names still show.
 *
 * An identifier that itself contains a dot (for example "Seer's Pres. True") cannot be
 * reached as a key, because Foundry reads dots in a key as nesting; it is returned as is.
 * @param {string} prefix - The system's key prefix, without a trailing dot.
 * @param {string} id - The untranslated identifier.
 * @returns {string}
 */
export function localizeSystemId(prefix, id) {
    if (typeof id !== "string" || id === "") return id ?? "";
    const key = `${prefix}.${id}`;
    return game.i18n.has(key) ? game.i18n.localize(key) : id;
}
