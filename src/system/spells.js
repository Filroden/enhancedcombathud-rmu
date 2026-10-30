/**
 * Spells: grouping the actor's known spells for the Spells panel, and the item spell groups
 * for the Items panel.
 *
 * Everything the panel derives from a spell uses the system's own fields: favorite,
 * isInstantaneous, isSubconscious, _hasOB and _totalBonus (spell attack OB), _realms. These
 * match the old string parsing on every captured spell and do not depend on English text.
 */

import { hudActor } from "./context.js";

/**
 * Order of the spell list types (the untranslated identifiers). Any type not listed, for
 * example one added by a future book, sorts after these, alphabetically, so the order is
 * always the same.
 */
export const SPELL_LIST_TYPE_ORDER = Object.freeze(["Innate", "Base", "Open", "Closed", "Arcane", "Evil", "Restricted"]);

/** The system's collated list of every known spell; shown elsewhere, so skipped here. */
const ALL_KNOWN_SPELLS_TYPE = "All Known Spells";

/** Group kind the system uses for spells carried by items. */
const ITEM_GROUP_KIND = "item";

/**
 * Compares two list types for sorting.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareListTypes(a, b) {
    const rank = (t) => {
        const i = SPELL_LIST_TYPE_ORDER.indexOf(t);
        return i === -1 ? SPELL_LIST_TYPE_ORDER.length : i;
    };
    return rank(a) - rank(b) || a.localeCompare(b);
}

/**
 * Prepares one known spell for the panel: the system's spell plus the list it belongs to.
 * @param {object} spell
 * @param {string} listTypeKey
 * @param {object} spellList
 * @returns {object}
 */
function toPanelSpell(spell, listTypeKey, spellList) {
    return {
        ...spell,
        isFavorite: spell.favorite === true,
        _rawListInfo: {
            groupName: listTypeKey,
            listType: listTypeKey,
            listName: spellList.spellListName,
            realm: spellList.realms,
            listKey: spellList.spellListName,
            spellListSkill: spellList.skill,
        },
    };
}

/**
 * The HUD actor's known spells, grouped by list type, then by list, each list sorted by
 * level. Item spells and the collated "All Known Spells" list are excluded.
 * @returns {Map<string, Map<string, Array<object>>>}
 */
export function getGroupedSpells() {
    const sourceData = hudActor()?.system?._spells;
    if (!Array.isArray(sourceData)) return new Map();

    const groups = new Map();
    for (const listTypeGroup of sourceData) {
        if (!Array.isArray(listTypeGroup.spellLists)) continue;
        if (listTypeGroup.listType === ALL_KNOWN_SPELLS_TYPE || listTypeGroup.kind === ITEM_GROUP_KIND) continue;

        const listTypeKey = listTypeGroup.groupName ?? listTypeGroup.listType;
        if (!groups.has(listTypeKey)) groups.set(listTypeKey, new Map());
        const spellsByList = groups.get(listTypeKey);

        for (const spellList of listTypeGroup.spellLists) {
            if (!Array.isArray(spellList.spells)) continue;
            const known = spellList.spells
                .filter((spell) => spell.known === true)
                .map((spell) => toPanelSpell(spell, listTypeKey, spellList))
                .sort((a, b) => a.level - b.level);
            if (known.length) spellsByList.set(spellList.spellListName, known);
        }
    }
    return groups;
}

/**
 * The spell groups carried by the actor's items (one per item, keyed by the item id in
 * groupName).
 * @param {Actor} actor
 * @returns {Array<object>}
 */
export function getItemSpellGroups(actor) {
    return (actor?.system?._spells || []).filter((g) => g.kind === ITEM_GROUP_KIND);
}

/**
 * The OB of a spell's attack, or null when the spell has no attack roll.
 * @param {object} spell
 * @returns {number|null}
 */
export function spellAttackBonus(spell) {
    return spell?._hasOB ? (spell._totalBonus ?? null) : null;
}

/**
 * The spell's realm or realms as display text.
 * The system stores hybrid realms as one comma-joined identifier ("Essence,Mentalism") and
 * has a language key for each realm and each hybrid pair (RMU.RealmsOfMagic.<identifier>),
 * so the system's own translation is used when it exists. Otherwise the identifiers are
 * shown separated by a comma and a space.
 * @param {object} spell
 * @returns {string}
 */
export function spellRealmsText(spell) {
    const raw = typeof spell?._realms === "string" ? spell._realms.trim() : "";
    if (!raw) return "";
    const key = `RMU.RealmsOfMagic.${raw}`;
    if (game.i18n?.has?.(key)) return game.i18n.localize(key);
    return raw.split(",").map((r) => r.trim()).filter(Boolean).join(", ");
}
