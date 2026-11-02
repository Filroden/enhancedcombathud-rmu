/**
 * Shared accordion behaviour for the Skills, Spells and Items panels.
 *
 * Each panel owns one Accordion. Buttons register their element with a role and a key
 * path:
 *   - a header's path identifies the group it opens: ["Awareness"] for a skill category,
 *     ["Base"] for a spell list type, ["Base", "Hiding"] for a spell list;
 *   - an item's (tile's) path is the full path of the group it belongs to.
 * The open state is a single path. A header is open when its path is a prefix of the open
 * path; an item is shown only when its path equals the open path exactly.
 *
 * The open state lives on the panel's accordion, so it starts closed every time the panel
 * is built (the same as before this was shared: every panel reset its state when built).
 */

/** Data attribute holding an element's role ("header" or "item"). */
const ROLE_ATTR = "echRmuAccordionRole";
/** Data attribute holding an element's key path, JSON encoded. */
const PATH_ATTR = "echRmuAccordionPath";

/** Class added to dimmed headers (styled in the module CSS). */
const DIMMED_CLASS = "ech-rmu-accordion-dimmed";

export const ACCORDION_ROLE = Object.freeze({ HEADER: "header", ITEM: "item" });

/**
 * Reads the role and key path stored on an element.
 * @param {HTMLElement} el
 * @returns {{role: string|undefined, path: string[]}}
 */
export function readAccordionData(el) {
    const raw = el?.dataset?.[PATH_ATTR];
    return { role: el?.dataset?.[ROLE_ATTR], path: raw ? JSON.parse(raw) : [] };
}

/**
 * Whether `prefix` matches the start of `path`, level by level.
 * @param {string[]} prefix
 * @param {string[]} path
 * @returns {boolean}
 */
export function isPathPrefix(prefix, path) {
    if (prefix.length > path.length) return false;
    return prefix.every((key, i) => key === path[i]);
}

export class Accordion {
    /**
     * @param {object} [options]
     * @param {(headerPath: string[], openPath: string[]) => boolean} [options.isDimmed]
     *        Whether a header should be dimmed for the current open state. Defaults to never.
     * @param {(panelEl: HTMLElement, anyItemShown: boolean) => void} [options.afterApply]
     *        Called after every full refresh, for panel-specific extras.
     * @param {boolean} [options.headerStateClasses=true] Add "open"/"closed" classes to headers.
     */
    constructor({ isDimmed = () => false, afterApply = null, headerStateClasses = true } = {}) {
        this.openPath = [];
        this.panelEl = null;
        this._isDimmed = isDimmed;
        this._afterApply = afterApply;
        this._headerStateClasses = headerStateClasses;
    }

    /** @param {HTMLElement} panelEl - The panel element whose buttons this accordion controls. */
    bind(panelEl) {
        this.panelEl = panelEl;
    }

    /** Closes every group. */
    reset() {
        this.openPath = [];
    }

    /**
     * Whether the group at `path` is currently open.
     * @param {string[]} path
     * @returns {boolean}
     */
    isOpen(path) {
        return path.length > 0 && isPathPrefix(path, this.openPath);
    }

    /**
     * Opens the group at `path`, or closes it (leaving its parent open) if already open.
     * Opening a group closes any sibling and any deeper group.
     * @param {string[]} path
     */
    toggle(path) {
        this.openPath = this.isOpen(path) ? path.slice(0, -1) : [...path];
        this.apply();
    }

    /**
     * Stores an element's role and path and gives it the correct state straight away. Called
     * from a button's _renderInner, so a single button re-render keeps the right state.
     * @param {HTMLElement} el
     * @param {string} role - One of ACCORDION_ROLE.
     * @param {string[]} path
     */
    register(el, role, path) {
        el.dataset[ROLE_ATTR] = role;
        el.dataset[PATH_ATTR] = JSON.stringify(path);
        this._applyTo(el);
    }

    /** Re-applies the open state to every registered element in the panel. */
    apply() {
        if (!this.panelEl) return;
        let anyItemShown = false;
        for (const el of this.elements()) {
            if (this._applyTo(el)) anyItemShown = true;
        }
        this._afterApply?.(this.panelEl, anyItemShown);
    }

    /** @returns {HTMLElement[]} Every element registered with this accordion's panel. */
    elements() {
        return this.panelEl ? Array.from(this.panelEl.querySelectorAll(`[data-ech-rmu-accordion-role]`)) : [];
    }

    /**
     * Applies the open state to one element.
     * Headers are always displayed (a search may have hidden them, and closing the search
     * must bring them back); items are displayed only when their group is the open group.
     * @param {HTMLElement} el
     * @returns {boolean} True when the element is an item that is now shown.
     */
    _applyTo(el) {
        const { role, path } = readAccordionData(el);
        if (role === ACCORDION_ROLE.HEADER) {
            const open = this.isOpen(path);
            el.style.display = "";
            if (this._headerStateClasses) {
                el.classList.toggle("open", open);
                el.classList.toggle("closed", !open);
            }
            el.classList.toggle(DIMMED_CLASS, this._isDimmed(path, this.openPath));
            return false;
        }
        const shown = this.openPath.length > 0 && path.length === this.openPath.length && isPathPrefix(path, this.openPath);
        el.style.display = shown ? "" : "none";
        return shown;
    }
}
