/**
 * Module-wide constants for the RMU extension of the Argon Combat HUD.
 *
 * Anything referred to from more than one file (the module id, setting keys, the actor
 * types the HUD supports) lives here so a rename only ever happens in one place.
 */

/** The module's package id, as declared in module.json. */
export const MODULE_ID = "enhancedcombathud-rmu";

/** Root path of the module's bundled files, used to build template and icon paths. */
export const MODULE_PATH = `modules/${MODULE_ID}`;

/**
 * Actor types the HUD supports.
 *
 * The RMU system defines three actor types: Character, Creature and Loot. Loot actors have
 * no actions, so the HUD must close silently for them instead of letting Argon CORE show
 * an "unsupported actor type" error. This list is passed to CORE's
 * defineSupportedActorTypes and is also used by the bind guard in main.js, so both always
 * agree on what is supported.
 */
export const SUPPORTED_ACTOR_TYPES = Object.freeze(["Character", "Creature"]);

/** Keys of the module's world settings. */
export const SETTING_KEYS = Object.freeze({
    /** Prefix of the per-icon settings; the full key is the prefix followed by the icon key. */
    mainIconPrefix: "icon_main_",
    /** Hidden setting holding the user's name-to-icon map for individual spells and skills. */
    customUserIcons: "custom_user_icons",
    /** Settings menu that opens the custom icon editor. */
    customIconsMenu: "custom_icons_menu",
});
