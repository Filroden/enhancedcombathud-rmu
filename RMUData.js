/**
 * RMUData.js
 *
 * Contains all data fetching, aggregation, transformation, and state management logic
 * for the RMU system extension. Attaches the RMUData object to the window.
 */

// ----------------------------------------------------------------------------
// I. State Management (for search and accordion persistence)
// ----------------------------------------------------------------------------

/** @type {Map<string, string>} Map(tokenId, categoryKey) */
const SKILLS_OPEN_CAT = new Map();
/** @type {Map<string, string>} Map(tokenId, listTypeKey) */
const SPELLS_OPEN_LIST_TYPE = new Map();
/** @type {Map<string, string>} Map(tokenId, listNameKey) */
const SPELLS_OPEN_LIST_NAME = new Map();

/**
 * Stores filter states (e.g., 'favorites') for all panels.
 * @type {Map<string, Object<string, boolean>>} Map(tokenId::panelId, { filterId: isActive })
 */
const FILTER_STATES = new Map();

/**
 * Gets the active token's ID or a fallback string.
 * @returns {string} The active token ID or "no-token".
 */
function getActiveTokenId() {
  return ui.ARGON?._token?.id ?? "no-token";
}

/**
 * Main data access and state management object for the RMU HUD.
 * @global
 */
const RMUData = {};

// --- Generic Filter State Functions ---

/**
 * Gets the active state of a specific filter for the current token and panel.
 * @param {string} panelId - The panel ID (e.g., "rmu-skills").
 * @param {string} filterId - The filter ID (e.g., "fav", "instant").
 * @returns {boolean} True if the filter is active.
 */
RMUData.getFilterActive = (panelId, filterId) => {
  const key = `${getActiveTokenId()}::${panelId}`;
  const panelFilters = FILTER_STATES.get(key);
  return panelFilters?.[filterId] === true;
};

/**
 * Sets the active state of a specific filter.
 * @param {string} panelId - The panel ID.
 * @param {string} filterId - The filter ID.
 * @param {boolean} isActive - The new state.
 */
RMUData.setFilterActive = (panelId, filterId, isActive) => {
  const key = `${getActiveTokenId()}::${panelId}`;
  if (!FILTER_STATES.has(key)) {
    FILTER_STATES.set(key, {});
  }
  const panelFilters = FILTER_STATES.get(key);

  if (isActive) {
    panelFilters[filterId] = true;
  } else {
    delete panelFilters[filterId];
  }
};

/**
 * Clears all active filters for a specific panel for the current token.
 * @param {string} panelId - The panel ID.
 */
RMUData.clearAllFilters = (panelId) => {
  const key = `${getActiveTokenId()}::${panelId}`;
  FILTER_STATES.delete(key);
};

// --- Accordion State Functions ---

/**
 * Gets the open skills category for the current token.
 * @returns {string|null} The key of the open category, or null.
 */
RMUData.getOpenSkillsCategory = () => SKILLS_OPEN_CAT.get(getActiveTokenId()) ?? null;

/**
 * Sets the open skills category for the current token.
 * @param {string|null} catOrNull - The key of the category to open, or null to close all.
 */
RMUData.setOpenSkillsCategory = (catOrNull) => {
  const id = getActiveTokenId();
  if (catOrNull) SKILLS_OPEN_CAT.set(id, String(catOrNull)); else SKILLS_OPEN_CAT.delete(id);
};

/**
 * Gets the open spell list state (type and name) for the current token.
 * @returns {{type: string|null, name: string|null}}
 */
RMUData.getOpenSpellState = () => ({
  type: SPELLS_OPEN_LIST_TYPE.get(getActiveTokenId()) ?? null,
  name: SPELLS_OPEN_LIST_NAME.get(getActiveTokenId()) ?? null
});

/**
 * Sets the open spell list state for the current token.
 * @param {string|null} typeOrNull - The list type (e.g., "Base") or null.
 * @param {string|null} nameOrNull - The list name (e.g., "Blood Mastery") or null.
 */
RMUData.setOpenSpellState = (typeOrNull, nameOrNull) => {
  const id = getActiveTokenId();
  if (typeOrNull) SPELLS_OPEN_LIST_TYPE.set(id, typeOrNull); else SPELLS_OPEN_LIST_TYPE.delete(id);
  if (nameOrNull) SPELLS_OPEN_LIST_NAME.set(id, nameOrNull); else SPELLS_OPEN_LIST_NAME.delete(id);
};

// -----------------------------------------------------------------------------
// II. Data Access and Processing
// -----------------------------------------------------------------------------

/**
 * Ensures the RMU system has derived its extended data for the current token.
 * @returns {Promise<void>}
 */
RMUData.ensureExtendedTokenData = async function() {
  const token = ui.ARGON?._token;
  const doc = token?.document ?? token;
  if (doc && typeof doc.hudDeriveExtendedData === "function") {
    try { await doc.hudDeriveExtendedData(); } catch (e) { console.warn("[ECH-RMU] hudDeriveExtendedData failed:", e); }
  }
};

/**
 * Awaits the RMU system's readiness flag on the actor.
 * @returns {Promise<void>}
 */
RMUData.ensureRMUReady = async function() {
  const actor = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
  if (!actor) return;
  if (actor.system?._hudInitialized === true) return;
  await RMUData.ensureExtendedTokenData();
};

/**
 * Generates a stable key for an attack object.
 * @param {object} att - The attack object.
 * @returns {string} A unique key.
 */
RMUData.attackKey = function(att) {
  return att?.itemId ?? att?.id ?? att?._id ?? [
    (att?.attackName ?? att?.name ?? "attack"),
    (att?.chart?.name ?? ""),
    (att?.size ?? ""),
    (att?.attackId ?? "")
  ].join("::");
};

/**
 * Gets all physical attacks from the current actor.
 * @returns {Array<object>} The list of attack objects.
 */
RMUData.getTokenAttacks = function() {
  const a = ui.ARGON?._actor;
  const list = a?.system?._attacks;
  return Array.isArray(list) ? list : [];
};

/**
 * Gets the "live" version of an attack from the token actor,
 * which contains up-to-date equipped state.
 * @param {object} srcAttack - The base attack object from the HUD.
 * @returns {object} The live attack object, or the original if not found.
 */
RMUData.getLiveAttack = function(srcAttack) {
  const token = ui.ARGON?._token;
  const list = token?.actor?.system?._attacks ?? [];
  const key = RMUData.attackKey(srcAttack);
  return list.find(a => RMUData.attackKey(a) === key) || srcAttack;
};

/**
 * Gets all resistance rolls from the current actor.
 * @returns {Array<object>} The list of resistance roll objects.
 */
RMUData.getTokenResistances = function() {
  const a = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
  if (!a) return [];
  const block = a.system?._resistanceBlock;
  const list = block?._resistances ?? block?.resistances ?? a.system?._resistances ?? a.system?.resistances;
  return Array.isArray(list) ? list : [];
};

/**
 * Determines the correct attack category (bucket) for a given attack.
 * @param {object} att - The attack object.
 * @returns {string} The category key (e.g., "melee", "ranged", "shield", "natural").
 */
RMUData.bucketOf = function(att) {
  const sName = String(att?.skill?.name ?? "").toLowerCase();
  const sSpec = String(att?.skill?.specialization ?? att?.skill?.specialisation ?? "").toLowerCase();
  const type = String(att?.subType ?? att?.type ?? att?.category ?? att?.attackType ?? "").toLowerCase();
  const incs = att?.rangeInrements ?? att?.rangeIncrements ?? null;

  if (sName.includes("shield") || sSpec.includes("shield") || type.includes("shield")) return "shield";

  if (
    sName.includes("unarmed") || sName.includes("strikes") || sSpec.includes("unarmed") || sSpec.includes("strikes") ||
    type.includes("natural") || att?.isNatural === true
  ) return "natural";

  if (sName.includes("missile") || sName.includes("ranged") || type.includes("ranged") || sSpec.includes("thrown")) {
    return "ranged";
  }

  // Heuristic fallback: only treat as ranged if an increment with a real distance exists
  if (Array.isArray(incs) && incs.some(x => Number(x?.distInFt ?? x?.dist ?? 0) > 0)) {
    return "ranged";
  }

  return "melee";
};

/**
 * Gets the short-range distance string from a range increments array.
 * @param {Array<object>} arr - The range increments array.
 * @returns {string} The formatted short range (e.g., "50'"), or "—".
 */
RMUData.getShortRange = function(arr) {
  if (!Array.isArray(arr)) return "—";
  const short = arr.find(r => String(r.label).toLowerCase() === "short");
  if (!short) return "—";
  const dist = short.distance || (short.distInFt != null ? `${short.distInFt}'` : short.dist ?? "");
  return dist ? `${dist}` : "—";
};

/**
 * Gets all skills from an actor, traversing the system's data structure.
 * @param {Actor} actor - The actor object.
 * @returns {Array<object>} A flattened list of skill objects.
 */
RMUData.getAllActorSkills = function(actor) {
  const src = actor?.system?._skills;
  if (!src) return [];
  const out = [];

  const pushMaybeSkill = (v) => {
    if (!v) return;
    if (Array.isArray(v)) {
      for (const it of v) pushMaybeSkill(it);
    } else if (typeof v === "object") {
      // Check for a standard skill object structure
      if (v.system && (typeof v.system === "object")) out.push(v);
      else {
        // Recurse through properties (handles category/group maps)
        for (const val of Object.values(v)) pushMaybeSkill(val);
      }
    }
  };
  pushMaybeSkill(src);
  return out;
};

/**
 * Finds a specific skill on an actor by its name.
 * @param {Actor} actor - The actor object.
 * @param {string} name - The exact name of the skill (e.g., "Body Development").
 * @returns {object|undefined} The skill object, or undefined.
 */
RMUData.getSkillByName = function(actor, name) {
  const list = RMUData.getAllActorSkills(actor);
  return list.find(s => (s?.system?.name ?? s?.name) === name);
};

/**
 * Transforms a raw skill object into a display-ready object for the HUD.
 * @param {object} sk - The raw skill object.
 * @returns {object} A standardized object for the HUD.
 */
RMUData.toDisplaySkill = function(sk) {
  const s = sk?.system ?? {};
  return {
    key: `${s.name ?? "Skill"}::${s.specialization ?? ""}`,
    name: s.name ?? "",
    spec: s.specialization ?? "",
    category: s.category ?? "Other",
    total: s._bonus,
    favorite: (s.favorite === true) || (sk?.favorite === true),
    disabledBySystem: s._disableSkillRoll === true,
    raw: sk
  };
};

/**
 * Gets all skills for the current HUD actor, grouped by category.
 * @returns {Map<string, Array<object>>} A Map where keys are category names
 * and values are arrays of display-ready skill objects.
 */
RMUData.getGroupedSkillsForHUD_All = function() {
  const actor = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
  if (!actor) return new Map();
  const all = RMUData.getAllActorSkills(actor)
    .map(RMUData.toDisplaySkill)
    .filter(Boolean);
  const groups = new Map();
  for (const sk of all) {
    if (!groups.has(sk.category)) groups.set(sk.category, []);
    groups.get(sk.category).push(sk);
  }
  // Sort alpha by display name within each category
  for (const [cat, list] of groups.entries()) {
    list.sort((a, b) => {
      const da = a.spec ? `${a.name} (${a.spec})` : a.name;
      const db = b.spec ? `${b.name} (${b.spec})` : b.name;
      return da.localeCompare(db);
    });
  }
  return groups;
};

/**
 * Gets all known spells for the current HUD actor, grouped by list type and list name.
 * @returns {Map<string, Map<string, Array<object>>>}
 * Map(ListType -> Map(ListName -> [Spell, ...]))
 */
RMUData.getGroupedSpellsForHUD = function() {
  const actor = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
  if (!actor) return new Map();

  const sourceData = actor.system?._spells;
  if (!Array.isArray(sourceData)) return new Map();

  const groups = new Map(); // Key: ListType (Base, Open, Closed, etc.)

  for (const listTypeGroup of sourceData) {
    if (!Array.isArray(listTypeGroup.spellLists)) continue;

    const listTypeKey = listTypeGroup.listType;
    if (!groups.has(listTypeKey)) groups.set(listTypeKey, new Map());
    const spellsByList = groups.get(listTypeKey);

    for (const spellList of listTypeGroup.spellLists) {
      if (!Array.isArray(spellList.spells)) continue;

      const listName = spellList.spellListName;
      const realm = spellList.realms;
      const listKey = listName; // Key is just the list name

      const knownSpells = spellList.spells
        .filter(spell => spell.known === true)
        .map(spell => ({
          ...spell,
          // Attach raw list info for later reference
          _rawListInfo: {
            listType: listTypeKey,
            listName: listName,
            realm: realm,
            listKey: listKey,
            spellListSkill: spellList.skill
          }
        }))
        .sort((a, b) => a.level - b.level); // Sort spells by level

      if (knownSpells.length > 0) {
        spellsByList.set(listKey, knownSpells);
      }
    }
  }
  return groups;
};

/**
 * Gets all known spells that are also "directed" (spell attacks)
 * from the current HUD actor.
 * @returns {Array<object>} A flattened list of spell attack objects.
 */
RMUData.getDirectedSpellAttacks = function() {
  const actor = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
  if (!actor) return [];

  const sourceData = actor.system?._spells;
  if (!Array.isArray(sourceData)) return [];

  const attacks = [];
  for (const listTypeGroup of sourceData) {
    if (!Array.isArray(listTypeGroup.spellLists)) continue;
    for (const spellList of listTypeGroup.spellLists) {
      if (!Array.isArray(spellList.spells)) continue;
      for (const spell of spellList.spells) {
        // Find known spells that have a spellAttack chart
        if (spell.known === true && spell.spellAttack && spell.spellAttack.chart?.name) {
          const baseName = spell.name.replace(/ (I|II|III|IV|V|VI|VII|VIII|IX|X|True)$/, '').trim();
          // Create a standardized attack-like object
          const attack = {
            ...spell,
            baseName: baseName,
            attackName: `${spell.name} (Lvl ${spell.level})`,
            totalBonus: spell.scr, // Use SCR as the total bonus
            chart: spell.spellAttack.chart,
            size: spell.spellAttack.size,
            fumble: spell.spellAttack.fumble,
            _spellListInfo: `${spellList.spellListName} (${spellList.listType})`,
            _isSpellAttack: true,
            isEquipped: true, // Spells are always "equipped"
            isAoE: spell._modifiedAoE?.shape === "ball",
            level: spell.level
          };
          attacks.push(attack);
        }
      }
    }
  }
  return attacks;
};

// Attach to the window object for global access
window.RMUData = RMUData;

export { RMUData };