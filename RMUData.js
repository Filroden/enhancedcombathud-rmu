/**
 * RMUData.js
 * Contains all data fetching, aggregation, transformation, and state management logic
 * for the RMU system extension.
 */

// -----------------------------------------------------------------------------
// I. State Management (for search and accordion persistence)
// -----------------------------------------------------------------------------

const SKILLS_FAV_ONLY = new Map();
const SKILLS_OPEN_CAT = new Map(); 
const SPELLS_OPEN_LIST_TYPE = new Map();
const SPELLS_OPEN_LIST_NAME = new Map();

function getActiveTokenId() {
  return ui.ARGON?._token?.id ?? "no-token";
}

// UI State Functions (Proxies for external use)
const RMUData = {}; // Initialize main data container

RMUData.getFavOnly = () => SKILLS_FAV_ONLY.get(getActiveTokenId()) === true;
RMUData.setFavOnly = (v) => {
  const id = getActiveTokenId();
  if (v) SKILLS_FAV_ONLY.set(id, true); else SKILLS_FAV_ONLY.delete(id);
};

RMUData.getOpenSkillsCategory = () => SKILLS_OPEN_CAT.get(getActiveTokenId()) ?? null;
RMUData.setOpenSkillsCategory = (catOrNull) => {
  const id = getActiveTokenId();
  if (catOrNull) SKILLS_OPEN_CAT.set(id, String(catOrNull)); else SKILLS_OPEN_CAT.delete(id);
};

RMUData.getOpenSpellState = () => ({
  type: SPELLS_OPEN_LIST_TYPE.get(getActiveTokenId()) ?? null,
  name: SPELLS_OPEN_LIST_NAME.get(getActiveTokenId()) ?? null
});
RMUData.setOpenSpellState = (typeOrNull, nameOrNull) => {
  const id = getActiveTokenId();
  if (typeOrNull) SPELLS_OPEN_LIST_TYPE.set(id, typeOrNull); else SPELLS_OPEN_LIST_TYPE.delete(id);
  if (nameOrNull) SPELLS_OPEN_LIST_NAME.set(id, nameOrNull); else SPELLS_OPEN_LIST_NAME.delete(id);
};

// -----------------------------------------------------------------------------
// II. Data Access and Processing
// -----------------------------------------------------------------------------

RMUData.ensureExtendedTokenData = async function() {
    const token = ui.ARGON?._token;
    const doc = token?.document ?? token;
    if (doc && typeof doc.hudDeriveExtendedData === "function") {
      try { await doc.hudDeriveExtendedData(); } catch (e) { console.warn("[ECH-RMU] hudDeriveExtendedData failed:", e); }
    }
};

RMUData.ensureRMUReady = async function() {
    const actor = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
    if (!actor) return;
    if (actor.system?._hudInitialized === true) return;
    await RMUData.ensureExtendedTokenData();
};

RMUData.attackKey = function(att) {
    return att?.itemId ?? att?.id ?? att?._id ?? [
        (att?.attackName ?? att?.name ?? "attack"),
        (att?.chart?.name ?? ""),
        (att?.size ?? ""),
        (att?.attackId ?? "")
    ].join("::");
};

RMUData.getTokenAttacks = function() {
    const a = ui.ARGON?._actor;
    const list = a?.system?._attacks;
    return Array.isArray(list) ? list : [];
};

RMUData.getLiveAttack = function(srcAttack) {
    const token = ui.ARGON?._token;
    const list = token?.actor?.system?._attacks ?? [];
    const key = RMUData.attackKey(srcAttack);
    return list.find(a => RMUData.attackKey(a) === key) || srcAttack;
};

RMUData.getTokenResistances = function() {
    const a = ui.ARGON?._actor ?? ui.ARGON?._token?.actor;
    if (!a) return [];
    const block = a.system?._resistanceBlock;
    const list = block?._resistances ?? block?.resistances ?? a.system?._resistances ?? a.system?.resistances;
    return Array.isArray(list) ? list : [];
};

RMUData.bucketOf = function(att) {
    const sName = String(att?.skill?.name ?? "").toLowerCase();
    const sSpec = String(att?.skill?.specialization ?? att?.skill?.specialisation ?? "").toLowerCase();
    const type  = String(att?.subType ?? att?.type ?? att?.category ?? att?.attackType ?? "").toLowerCase();
    const incs  = att?.rangeInrements ?? att?.rangeIncrements ?? null;

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

RMUData.getShortRange = function(arr) {
    if (!Array.isArray(arr)) return "—";
    const short = arr.find(r => String(r.label).toLowerCase() === "short");
    if (!short) return "—";
    const dist = short.distance || (short.distInFt != null ? `${short.distInFt}'` : short.dist ?? "");
    return dist ? `${dist}` : "—";
};

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

RMUData.getSkillByName = function(actor, name) {
    const list = RMUData.getAllActorSkills(actor);
    return list.find(s => (s?.system?.name ?? s?.name) === name);
};


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
        
        // ** CRITICAL FIX (Bug a): Removed realm from the key **
        const listKey = listName; // Was: `${listName} (${realm})`

        const knownSpells = spellList.spells
          .filter(spell => spell.known === true)
          .map(spell => ({
            ...spell,
            _rawListInfo: {
              listType: listTypeKey,
              listName: listName,
              realm: realm,
              listKey: listKey,
              spellListSkill: spellList.skill
            }
          }))
          .sort((a, b) => a.level - b.level);

        if (knownSpells.length > 0) {
          spellsByList.set(listKey, knownSpells);
        }
      }
    }

    return groups;
};

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
                if (spell.known === true && spell.spellAttack && spell.spellAttack.chart?.name) {
                    const attack = {
                        ...spell,
                        attackName: `${spell.name} (Lvl ${spell.level})`,
                        totalBonus: spell.scr,
                        chart: spell.spellAttack.chart,
                        size: spell.spellAttack.size,
                        fumble: spell.spellAttack.fumble,
                        _spellListInfo: `${spellList.spellListName} (${spellList.listType})`,
                        _isSpellAttack: true,
                        isEquipped: true,
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

window.RMUData = RMUData;

export { RMUData };