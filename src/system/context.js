/**
 * Access to the token and actor the HUD is bound to.
 *
 * Argon CORE keeps these as private members (ui.ARGON._token, ui.ARGON._actor). Reading them
 * only here means a change in CORE is a one-place fix. Inside Argon components, the public
 * getters this.token and this.actor give the same objects.
 */

/** @returns {Token|null} The token the HUD is bound to. */
export function hudToken() {
    return ui.ARGON?._token ?? null;
}

/** @returns {Actor|null} The actor the HUD is bound to (the token's actor for unlinked tokens). */
export function hudActor() {
    return ui.ARGON?._actor ?? ui.ARGON?._token?.actor ?? null;
}
