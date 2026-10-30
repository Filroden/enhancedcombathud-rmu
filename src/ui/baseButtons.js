/**
 * Shared base classes for the RMU HUD's buttons and panels.
 *
 * Argon CORE only hands over its base classes (ActionButton, ActionPanel, ButtonPanel, ...)
 * when it fires the argonInit hook, so these classes cannot be declared at import time.
 * createBaseClasses builds them from CORE's classes once and caches the result; every panel
 * file calls it with CoreHUD.ARGON and extends what it returns.
 */

import { UIGuards } from "./guards.js";

/** Mouse button number of the primary (usually left) button in MouseEvent.button. */
const PRIMARY_BUTTON = 0;

/** Selector of the equip toggle, whose clicks must never trigger the button underneath. */
const EQUIP_TOGGLE_SELECTOR = ".ech-rmu-equip-toggle";

let cachedClasses = null;

/**
 * Returns the Handlebars partial CORE would use for a class that extends one of its base
 * classes directly.
 *
 * CORE's ArgonComponent picks a component's template from the name of the component's
 * parent class (a class extending ActionButton renders ActionButton.hbs). The RMU base
 * classes add a level of inheritance, so without an override CORE would look for
 * RMUActionButton.hbs, which does not exist. Calling CORE's own getter with the RMU base
 * class as the constructor gives the correct partial without hard-coding CORE's path.
 * @param {Function} ArgonComponent - CORE's ArgonComponent class.
 * @param {Function} directSubclass - An RMU class that directly extends a CORE class.
 * @returns {string} The template path.
 */
function coreTemplateFor(ArgonComponent, directSubclass) {
    const coreGetter = Object.getOwnPropertyDescriptor(ArgonComponent.prototype, "template").get;
    return coreGetter.call({ constructor: directSubclass });
}

/**
 * Builds (once) and returns the RMU base classes.
 * @param {object} ARGON - CoreHUD.ARGON, as passed to the argonInit hook.
 * @returns {{RMUActionButton: Function, RMUEmptyButton: Function, RMUActionPanel: Function, createGuardedPanel: Function}}
 */
export function createBaseClasses(ARGON) {
    if (cachedClasses) return cachedClasses;

    const { ArgonComponent } = ARGON.CORE;
    const { ActionPanel } = ARGON.MAIN;
    const { ButtonPanel } = ARGON.MAIN.BUTTON_PANELS;
    const { ActionButton } = ARGON.MAIN.BUTTONS;

    /**
     * Base for every RMU action button (rolls, accordion headers, item buttons).
     *
     * Activation happens on mousedown rather than CORE's default mouseup/_onLeftClick route.
     * The event is stopped at mousedown so it never reaches the canvas, where it could
     * deselect the token and make CORE close the HUD. _onLeftClick is therefore swallowed.
     * Subclasses implement _onActivate instead of overriding the mouse handlers.
     */
    class RMUActionButton extends ActionButton {
        get template() {
            return coreTemplateFor(ArgonComponent, RMUActionButton);
        }

        get isInteractive() {
            return true;
        }

        /** Whether the button is disabled; disabled buttons ignore clicks and show the disabled style. */
        get disabled() {
            return false;
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.element) return;
            // The interactive class forces pointer events and the pointer cursor in CSS; the
            // disabled class (more specific in CSS) switches to the not-allowed cursor and
            // the hatched overlay.
            this.element.classList.add("ech-rmu-interactive-button");
            this.element.classList.toggle("disabled", this.disabled === true);
        }

        async _onMouseDown(event) {
            if (event?.button !== PRIMARY_BUTTON || this.disabled) return;
            if (event.target?.closest?.(EQUIP_TOGGLE_SELECTOR)) return;
            event.preventDefault();
            event.stopPropagation();
            await this._onActivate(event);
        }

        async _onLeftClick(event) {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        }

        /**
         * Performs the button's action (roll, toggle, ...). Called on a primary-button press
         * that did not land on an equip toggle, when the button is not disabled.
         * @param {MouseEvent} _event - The mousedown event.
         */
        async _onActivate(_event) {}
    }

    /**
     * Disabled placeholder shown when a panel has nothing to list ("No skills").
     */
    class RMUEmptyButton extends RMUActionButton {
        /**
         * @param {string} label - Text to show.
         * @param {string} [icon=""] - Optional icon URL.
         */
        constructor(label, icon = "") {
            super();
            this._label = label;
            this._icon = icon;
        }
        get label() {
            return this._label;
        }
        get icon() {
            return this._icon;
        }
        get disabled() {
            return true;
        }
    }

    /**
     * Base for the RMU top-level panels. RMU has no per-turn action economy shown in the
     * HUD, so the action pips CORE draws above each panel are always switched off.
     */
    class RMUActionPanel extends ActionPanel {
        get template() {
            return coreTemplateFor(ArgonComponent, RMUActionPanel);
        }

        get maxActions() {
            return null;
        }
        get currentActions() {
            return null;
        }
    }

    /**
     * Creates a ButtonPanel with the click-through guard attached.
     * @param {string} id - Panel id. CORE uses it to remember whether the panel is open.
     * @param {Array<object>} buttons - The panel's buttons.
     * @returns {object} The ButtonPanel.
     */
    function createGuardedPanel(id, buttons) {
        const panel = new ButtonPanel({ id, buttons });
        UIGuards.attachPanelInteractionGuards(panel);
        return panel;
    }

    cachedClasses = { RMUActionButton, RMUEmptyButton, RMUActionPanel, createGuardedPanel };
    return cachedClasses;
}
