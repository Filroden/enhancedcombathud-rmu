/**
 * Spells: grouping the actor's known spells for the Spells panel, and the item spell groups
 * for the Items panel.
 *
 * Everything the panel derives from a spell uses the system's own fields: favorite,
 * isInstantaneous, isSubconscious, _hasOB and _totalBonus (spell attack OB), _realms. None of
 * them is parsed from display text, so they work the same in every language.
 *
 * Spells, lists and list types are grouped, keyed and sorted by their untranslated
 * identifiers (name, spellList, listType); the display helpers below give the text the
 * player reads.
 */

import { hudActor } from "../argon.js";
import { localizeSystemEntry } from "../i18n.js";

/**
 * The first usable text: a non-empty string that is not an untranslated key.
 * @param {Array<string|undefined>} candidates - In order of preference.
 * @returns {string}
 */
function firstText(candidates) {
    for (const value of candidates) {
        if (typeof value === "string" && value.trim() !== "") return value;
    }
    return "";
}

/**
 * Localises a language key, or returns "" when there is no text for it, so it can sit in a
 * fallback list without its raw key ever being shown.
 * @param {string|undefined} key
 * @param {boolean} [ownLanguageOnly=false] - Only accept a translation in the current
 *   language itself, not Foundry's English fallback.
 * @returns {string}
 */
function keyText(key, ownLanguageOnly = false) {
    if (typeof key !== "string" || key === "") return "";
    if (!game.i18n.has(key, !ownLanguageOnly)) return "";
    return game.i18n.localize(key);
}

/**
 * Language key namespaces that hold spell lists, in the order they are searched.
 * RMU.SpellList is the current structure for every book (Spell Law, Treasure Law, ...).
 * RMU_SL and RMU_SW_SL are the older Spell Law namespaces, still searched so that a world
 * whose Spell Law content has not been updated yet keeps its translated text.
 */
const SPELL_LIST_NAMESPACES = Object.freeze(["RMU.SpellList", "RMU_SL", "RMU_SW_SL"]);

/** Separator between a list's key and its spells' keys ("RMU.SpellList.Hiding.spells.Blur.name"). */
const SPELLS_SEGMENT = ".spells.";

/** List name to the key of the list ("Hiding" to "RMU.SpellList.Hiding"), found once per list. */
const listKeyCache = new Map();

/**
 * The language key of a spell's list, without a trailing ".name".
 *
 * Spells in the current structure carry no key of their own, so the list is found by its
 * name in each namespace in turn. A list found in none of them (a custom list) has no key,
 * and its spells show their stored text.
 * @param {object} spell
 * @returns {string|null}
 */
function spellListKey(spell) {
    const list = spell?._spellListName ?? spell?.spellList;
    if (!list) return null;
    if (!listKeyCache.has(list)) {
        const namespace = SPELL_LIST_NAMESPACES.find((ns) => game.i18n.has(`${ns}.${list}.name`));
        listKeyCache.set(list, namespace ? `${namespace}.${list}` : null);
    }
    return listKeyCache.get(list);
}

/**
 * The language key of a spell's name or description.
 *
 * A spell copied onto an actor before its book moved to the current structure can still
 * carry its old key (label or descriptionLabel), which no longer exists in the language
 * files. Such a key is only used when it still has text; otherwise the key is built from the
 * list's key and the spell's name.
 * @param {object} spell
 * @param {"name"|"description"} field
 * @returns {string|undefined}
 */
function spellKey(spell, field) {
    const own = field === "name" ? spell?.label : spell?.descriptionLabel;
    if (own && game.i18n.has(own)) return own;
    const listKey = spellListKey(spell);
    return listKey && spell?.name ? `${listKey}${SPELLS_SEGMENT}${spell.name}.${field}` : undefined;
}

/**
 * Picks the text for a spell's or a list's name.
 *
 * In order: the language key in the current language; the stored name; the language key
 * in English. The stored name is always filled in, and for a spell from the books it is the
 * English original, so a translation in the player's language replaces it. A renamed or
 * custom spell has no matching key (the key is built from its name), so its stored name
 * shows.
 * @param {string|undefined} key
 * @param {string|undefined} stored
 * @returns {string}
 */
function nameText(key, stored) {
    return firstText([keyText(key, true), stored, keyText(key)]);
}

/**
 * A spell's name as the player reads it.
 * @param {object} spell
 * @returns {string}
 */
export function spellDisplayName(spell) {
    return nameText(spellKey(spell, "name"), spell?.name);
}

/**
 * A spell's description as the player reads it (HTML).
 *
 * In the current spell structure a spell from the books stores no description: its text
 * lives only in the language files. A stored description therefore means a custom or
 * edited spell, and it is shown as written in preference to the books' text. Only an empty
 * description falls through to the language key, in the current language first.
 * @param {object} spell
 * @returns {string}
 */
export function spellDescription(spell) {
    const key = spellKey(spell, "description");
    return firstText([spell?.description, keyText(key, true), keyText(key)]);
}

/**
 * A spell list's name as the player reads it, from one of its spells.
 * @param {object} spell
 * @returns {string}
 */
export function spellListDisplayName(spell) {
    const listKey = spellListKey(spell);
    return nameText(listKey ? `${listKey}.name` : undefined, spell?._spellListName ?? spell?.spellList);
}

/**
 * A spell list type (Base, Open, ...) as the player reads it.
 *
 * The system keys list types as RMU.SpellListType.<type>, but has no such key for
 * Restricted. Spell list types are also skills, so the skill's name (RMU.Skills.<type>.Name)
 * is the fallback; it is only used when the list type key is missing, because the two can be
 * worded differently in some languages.
 * @param {string} listType - The untranslated list type.
 * @returns {string}
 */
export function listTypeDisplayName(listType) {
    const key = `RMU.SpellListType.${listType}`;
    if (listType && game.i18n.has(key)) return game.i18n.localize(key);
    return localizeSystemEntry("RMU.Skills", listType);
}

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
