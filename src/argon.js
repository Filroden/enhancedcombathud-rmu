/**
 * The one place this module reaches into Argon CORE's running HUD (ui.ARGON).
 *
 * CORE's public API is the CoreHUD class passed to the argonInit hook (its define* methods
 * and its ARGON namespace of base classes). Everything else used here (the bound token and
 * actor, the rendered components, the bind method) is internal to CORE and can change in
 * any CORE release. Keeping all of it in this file means such a change is a one-file fix.
 * Inside Argon components, the public getters this.token and this.actor give the same
 * objects as hudToken() and hudActor().
 */

/** @returns {object|null} CORE's running HUD, once CORE has created it in its ready hook. */
function coreHud() {
    return ui.ARGON ?? null;
}

/** @returns {Token|null} The token the HUD is bound to. */
export function hudToken() {
    return coreHud()?._token ?? null;
}

/** @returns {Actor|null} The actor the HUD is bound to (the token's actor for unlinked tokens). */
export function hudActor() {
    const hud = coreHud();
    return hud?._actor ?? hud?._token?.actor ?? null;
}

/**
 * Re-checks the visibility of the main panels. CORE only does this for its own combat
 * components when a combat changes, but the Rest and End Turn panels here depend on the
 * combat state too.
 */
export function updateMainPanelVisibility() {
    coreHud()?.components?.main?.forEach((component) => component.updateVisibility?.());
}

/**
 * Re-renders the macro drawer, for example after a hotbar macro is renamed. CORE builds
 * the drawer only when the whole HUD renders. Does nothing while the HUD is closed, as the
 * drawer is rebuilt the next time it opens.
 */
export function renderDrawer() {
    const hud = coreHud();
    if (!hud?.enabled) return;
    hud.components?.drawer?.render?.();
}

/**
 * Makes the HUD close quietly when it is asked to bind to an actor type it does not
 * support (the RMU system's Loot actors), instead of CORE showing an "unsupported actor
 * type" error each time such a token is selected.
 *
 * CORE's bind accepts a Token, a TokenDocument or an Actor; binding to nothing closes the
 * HUD. Must run after CORE's ready hook has created ui.ARGON.
 * @param {ReadonlySet<string>|Set<string>} supportedTypes - Actor types the HUD supports.
 */
export function closeHudForUnsupportedActors(supportedTypes) {
    const hud = coreHud();
    if (typeof hud?.bind !== "function") {
        console.warn("[ECH-RMU] Argon CORE's HUD is not ready; unsupported actors will show CORE's warning.");
        return;
    }
    const originalBind = hud.bind;
    hud.bind = function (target, ...rest) {
        const actor = target instanceof Actor ? target : target?.actor;
        if (actor && !supportedTypes.has(actor.type)) return originalBind.call(this, null);
        return originalBind.call(this, target, ...rest);
    };
}
