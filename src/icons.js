/**
 * Icon configuration for the RMU HUD.
 *
 * Every structural icon (attack categories, panel buttons, chips, filter buttons,
 * resistances) has a default bundled with the module and a world setting that lets a GM
 * replace it. Individual spells and skills can also be given their own icon through the
 * custom icons menu, which stores a name-to-path map.
 */

import { MODULE_ID, MODULE_PATH, SETTING_KEYS } from "./constants.js";

/**
 * Builds the routed URL of an icon bundled with the module.
 * getRoute adds Foundry's route prefix, so the path still resolves when Foundry is hosted
 * under a sub-path (for example https://example.com/foundry/).
 * @param {string} file - File name inside the module's icons folder.
 * @returns {string}
 */
function moduleIcon(file) {
    return foundry.utils.getRoute(`${MODULE_PATH}/icons/${file}`);
}

/**
 * Configuration of every user-customisable structural icon.
 * The key is used in code (ICONS.melee) and in the setting key; the resistance keys must
 * match the system's untranslated resistance identifiers (Channeling, Essence, ...).
 */
export const ICON_CONFIG = {
    // --- MAIN HUD ICONS ---
    melee: { name: "Melee Attack", default: moduleIcon("sword-brandish.svg") },
    ranged: { name: "Ranged Attack", default: moduleIcon("high-shot.svg") },
    natural: { name: "Natural Attack", default: moduleIcon("fist.svg") },
    shield: { name: "Shield Attack", default: moduleIcon("vibrating-shield.svg") },
    skills: { name: "Skills Category", default: moduleIcon("skills.svg") },
    skills_muted: { name: "Skill Action (Muted)", default: moduleIcon("skills-muted.svg") },
    spells: { name: "Spells Category", default: moduleIcon("spell-book.svg") },
    spells_muted: { name: "Spell Action (Muted)", default: moduleIcon("spell-book-muted.svg") },
    items: { name: "Items Category", default: moduleIcon("ring.svg") },
    combat: { name: "End Turn (Combat)", default: moduleIcon("skip-next-circle.svg") },
    rest: { name: "Rest Action", default: moduleIcon("rest.svg") },
    special: { name: "Special Checks", default: moduleIcon("hazard-sign.svg") },
    endurance: { name: "Endurance Check", default: moduleIcon("mountain-climbing.svg") },
    concentration: { name: "Concentration Check", default: moduleIcon("meditation.svg") },
    star: { name: "Favorite Star", default: moduleIcon("star.svg") },
    instant: { name: "Instantaneous Asterisk", default: moduleIcon("asterisk.svg") },
    subconscious: { name: "Sub-conscious Indicator", default: moduleIcon("airline_seat_flat.svg") },
    close: { name: "Close/Clear", default: moduleIcon("clear-text.svg") },
    search: { name: "Search Magnifier", default: moduleIcon("search.svg") },
    equip_closed: { name: "Equipped Shield", default: moduleIcon("back_hand_closed.svg") },
    equip_open: { name: "Unequipped Shield", default: moduleIcon("back_hand_open.svg") },
    ranked: { name: "Ranked Skill Chip", default: moduleIcon("voting_chip.svg") },
    panel: { name: "Generic Panel", default: moduleIcon("resistance-panel.svg") },

    // --- RESISTANCE ICONS ---
    Channeling: { name: "Resist: Channeling", default: moduleIcon("resistance-channeling.svg") },
    Essence: { name: "Resist: Essence", default: moduleIcon("resistance-essence.svg") },
    Mentalism: { name: "Resist: Mentalism", default: moduleIcon("resistance-mentalism.svg") },
    Physical: { name: "Resist: Physical", default: moduleIcon("resistance-physical.svg") },
    Fear: { name: "Resist: Fear", default: moduleIcon("resistance-fear.svg") },
};

/**
 * Live icon lookup (ICONS.melee, ICONS.Channeling, ...).
 * Each property is a getter that reads the icon's world setting when accessed, so code
 * always gets the GM's current choice without caching it. Settings are only readable once
 * they are registered in the init hook, so ICONS must not be read before then.
 */
export const ICONS = {};
for (const key of Object.keys(ICON_CONFIG)) {
    Object.defineProperty(ICONS, key, {
        get: () => game.settings.get(MODULE_ID, `${SETTING_KEYS.mainIconPrefix}${key}`),
        enumerable: true,
    });
}

/**
 * Returns the custom icon the GM has mapped to a spell or skill name, if any.
 * Spell callers pass the base name without its level suffix (I, II, ..., True), so one
 * mapping covers every level variant of a spell.
 * @param {string} name - The exact spell or skill name.
 * @returns {string|null} The icon path, or null when no mapping exists.
 */
export function getUserIcon(name) {
    if (!name) return null;
    try {
        const icons = game.settings.get(MODULE_ID, SETTING_KEYS.customUserIcons) || {};
        return icons[name] || null;
    } catch {
        // The setting is unavailable before registration; treat that as "no custom icon".
        return null;
    }
}
