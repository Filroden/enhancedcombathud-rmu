/**
 * Skills: reading the actor's skill list, grouping it for the Skills panel, and the values
 * the Endurance panel shows.
 */

import { DETAIL_FORMAT } from "../format.js";
import { t, term } from "../i18n.js";
import { hudActor } from "../argon.js";

/**
 * Flattens the actor's skill list into skill entries (objects with a system property).
 * The system nests skills in category groups; the walk does not assume a fixed depth.
 * @param {Actor} actor
 * @returns {Array<object>}
 */
export function getAllActorSkills(actor) {
    const src = actor?.system?._skills;
    if (!src) return [];
    const out = [];
    const collect = (v) => {
        if (!v || typeof v !== "object") return;
        if (Array.isArray(v)) {
            v.forEach(collect);
        } else if (v.system && typeof v.system === "object") {
            out.push(v);
        } else {
            Object.values(v).forEach(collect);
        }
    };
    collect(src);
    return out;
}

/**
 * Finds a skill by its untranslated name (for example "Body Development").
 * @param {Actor} actor
 * @param {string} name
 * @returns {object|undefined}
 */
export function getSkillByName(actor, name) {
    return getAllActorSkills(actor).find((s) => (s?.system?.name ?? s?.name) === name);
}

/**
 * Turns a skill entry into what the Skills panel displays.
 * Unspecialised parent entries (for example "Animal Handling" next to "Animal Handling
 * (Horse)") are kept on purpose: the system lets them be rolled for an untrained use.
 * @param {object} sk
 * @returns {{key: string, name: string, spec: string, category: string, total: number, favorite: boolean, disabledBySystem: boolean, raw: object}}
 */
function toDisplaySkill(sk) {
    const s = sk?.system ?? {};
    return {
        key: `${s.name ?? "Skill"}::${s.specialization ?? ""}`,
        name: s.name ?? "",
        spec: s.specialization ?? "",
        category: s.category ?? "Other",
        total: s._bonus,
        favorite: s.favorite === true || sk?.favorite === true,
        disabledBySystem: s._disableSkillRoll === true,
        raw: sk,
    };
}

/** Display name used for sorting: "Name (Specialisation)" or "Name". */
const displayName = (sk) => (sk.spec ? `${sk.name} (${sk.spec})` : sk.name);

/**
 * The HUD actor's skills grouped by category, each group sorted by display name.
 * @returns {Map<string, Array<object>>}
 */
export function getGroupedSkills() {
    const actor = hudActor();
    if (!actor) return new Map();
    const groups = new Map();
    for (const sk of getAllActorSkills(actor).map(toDisplaySkill)) {
        if (!groups.has(sk.category)) groups.set(sk.category, []);
        groups.get(sk.category).push(sk);
    }
    for (const list of groups.values()) {
        list.sort((a, b) => displayName(a).localeCompare(displayName(b)));
    }
    return groups;
}

/**
 * The bonus shown for an Endurance or Concentration check.
 * The character sheet shows the skill bonus plus the racial modifier, which the system
 * keeps in its injury block (_endurance for Physical, _concentration for Mental). The skill's
 * own bonus is returned too, so the tooltip can show the racial part separately.
 * @param {Actor} actor
 * @param {"_endurance"|"_concentration"} injuryKey
 * @param {object|null} skill - The underlying skill (Body Development or Mental Focus).
 * @returns {{total: number|undefined, skillBonus: number|undefined, racial: number|undefined}}
 */
export function getEnduranceValues(actor, injuryKey, skill) {
    const block = actor?.system?._injuryBlock?.[injuryKey];
    const skillBonus = skill?.system?._bonus ?? block?._bonus;
    const total = block?._bonusWithRacial ?? skillBonus;
    const racial = Number.isFinite(total) && Number.isFinite(skillBonus) ? total - skillBonus : undefined;
    return { total, skillBonus, racial };
}

/**
 * A skill's bonus breakdown for its tooltip, in the order the character sheet shows it.
 * Each entry has an id, so callers can find or replace an entry without matching its
 * translated label.
 * @param {object} skill - A skill from the actor's skill list ({system: {...}}).
 * @returns {Array<{id: string, label: string, value: *, format: string}>}
 */
export function skillTooltipDetails(skill) {
    const sys = skill?.system ?? {};
    const { NUMBER, BONUS, TEXT } = DETAIL_FORMAT;
    return [
        { id: "totalRanks", label: t("ECH-RMU.Tooltip.TotalRanks"), value: sys._totalRanks, format: NUMBER },
        { id: "rankBonus", label: t("ECH-RMU.Tooltip.RankBonus"), value: sys._rankBonus, format: BONUS },
        { id: "cultureRanks", label: t("ECH-RMU.Tooltip.CultureRanks"), value: sys.cultureRanks, format: NUMBER },
        { id: "stat", label: term("Stat"), value: sys.stat, format: TEXT },
        { id: "statBonus", label: term("StatBonus"), value: sys._statBonus, format: BONUS },
        { id: "profBonus", label: t("ECH-RMU.Tooltip.ProfessionalBonus"), value: sys._professionalBonus, format: BONUS },
        { id: "knack", label: term("Knack"), value: sys._knack, format: BONUS },
        { id: "totalBonus", label: term("TotalBonus"), value: sys._bonus, format: BONUS },
    ];
}
