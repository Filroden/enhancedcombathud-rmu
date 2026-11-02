/**
 * Click-through protection for the HUD.
 *
 * Argon CORE's buttons act on mouseup and its panels do not stop events from bubbling. A
 * click that bubbles up to Foundry's canvas handling can deselect the token, which makes
 * CORE unbind and close the HUD. These guards stop pointer events at the panel or button
 * so they never reach the canvas.
 *
 * CORE creates each component's element in the component's constructor, so the element
 * always exists by the time a guard is attached and no waiting or polling is needed.
 */

/** Events stopped at a panel so they cannot bubble through to the canvas. */
const PANEL_GUARDED_EVENTS = Object.freeze([
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "click",
    "touchstart",
    "touchend",
    "contextmenu",
    "wheel",
    "focusin",
    "focusout",
    "blur",
    "keydown",
    "keyup",
]);

/** Events stopped at an individual button. */
const BUTTON_GUARDED_EVENTS = Object.freeze(["pointerdown", "pointerup", "mousedown", "mouseup", "click", "contextmenu", "touchstart", "touchend"]);

/**
 * Elements that already have a button guard. A component's element survives re-renders
 * (CORE only replaces its contents), so without this check every render would add another
 * set of listeners to the same element.
 */
const guardedButtons = new WeakSet();

/**
 * Stops events from bubbling out of a panel to the canvas.
 * Listeners are non-capturing, so buttons and inputs inside the panel still receive the
 * event first and behave normally.
 * @param {object} panel - An Argon ButtonPanel instance.
 */
function attachPanelInteractionGuards(panel) {
    const el = panel?.element;
    if (!el) return;
    const stop = (e) => e.stopPropagation();
    for (const type of PANEL_GUARDED_EVENTS) {
        el.addEventListener(type, stop, { capture: false });
    }
}

/**
 * Makes a button catch its own pointer events and stops them bubbling to the canvas.
 * The ech-rmu-interactive-button class forces pointer-events and the pointer cursor in CSS.
 * Safe to call on every render: listeners are only added once per element.
 * @param {object} component - An Argon button component.
 */
function attachButtonInteractionGuards(component) {
    const el = component?.element;
    if (!el) return;
    el.classList.add("ech-rmu-interactive-button");
    if (guardedButtons.has(el)) return;
    guardedButtons.add(el);

    const stop = (e) => e.stopPropagation();
    for (const type of BUTTON_GUARDED_EVENTS) {
        el.addEventListener(type, stop, { capture: false });
    }
}

/** Guard helpers, grouped for the panels that import them. */
export const UIGuards = {
    attachPanelInteractionGuards,
    attachButtonInteractionGuards,
};
