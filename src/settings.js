/**
 * Registers the module's world settings and settings menu.
 * Called from the init hook, before anything reads ICONS or the custom icon map.
 */

import { MODULE_ID, SETTING_KEYS } from "./constants.js";
import { ICON_CONFIG } from "./icons.js";
import { RMUCustomIconsMenu } from "./apps/CustomIconsMenu.js";

/**
 * Registers every icon setting and the custom icons menu.
 */
export function registerIconSettings() {
    // 1. One setting per structural icon (melee, shield, resistances, ...). Icons are read
    //    when the HUD is built, so a change only applies after a reload.
    for (const [key, config] of Object.entries(ICON_CONFIG)) {
        game.settings.register(MODULE_ID, `${SETTING_KEYS.mainIconPrefix}${key}`, {
            name: config.name,
            scope: "world",
            config: true,
            type: String,
            filePicker: "image",
            default: config.default,
            requiresReload: true,
        });
    }

    // 2. Hidden setting holding the custom spell and skill icon map.
    game.settings.register(MODULE_ID, SETTING_KEYS.customUserIcons, {
        scope: "world",
        config: false,
        type: Object,
        default: {},
    });

    // 3. Settings menu button that opens the custom icon editor (GM only).
    game.settings.registerMenu(MODULE_ID, SETTING_KEYS.customIconsMenu, {
        name: "Custom Spell & Skill Icons",
        label: "Configure Icons",
        hint: "Map specific spells and skills to custom icons.",
        icon: "fas fa-images",
        type: RMUCustomIconsMenu,
        restricted: true,
    });
}
