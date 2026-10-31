/**
 * Small DOM builders shared by the panels: the value overlay on action buttons, the chip
 * row (favourite, instantaneous, sub-conscious) and the equip toggle.
 *
 * Static styling lives in the module stylesheet. The only inline value set here is an
 * icon URL passed as a CSS custom property, because the URL depends on the GM's icon
 * settings and cannot be known in the stylesheet.
 */

import { ICONS } from "../icons.js";
import { formatBonus } from "../format.js";

/**
 * Selectors for the image element inside an Argon button, tried together. The overlay is
 * mounted on the first match so it sits over the icon; the button itself is the fallback.
 */
const OVERLAY_HOST_SELECTOR = ".image, .ech-image, .icon, .thumbnail, .main-button__image, .argon-image";

/**
 * Mounts a translucent value overlay (label above, number below) onto an action button.
 * Any previous overlay is replaced, so this is safe to call on every render.
 * @param {HTMLElement} buttonEl - The button's DOM element.
 * @param {string|number} [number=""] - The main value (for example 10 or "+10 / +5").
 * @param {string} [labelText=""] - The small label, already localised (for example the
 *   "Total" or "SCR" term). No label element is added when it is empty.
 */
export function applyValueOverlay(buttonEl, number = "", labelText = "") {
    if (!buttonEl) return;
    const host = buttonEl.querySelector(OVERLAY_HOST_SELECTOR) || buttonEl;
    host.classList.add("ech-rmu-button-relative", "ech-rmu-overflow-hidden");
    host.querySelector(".ech-rmu-value-overlay")?.remove();

    const root = document.createElement("div");
    root.className = "ech-rmu-value-overlay";
    const txt = document.createElement("div");
    txt.className = "ech-rmu-value-overlay-text";

    if (labelText) {
        const label = document.createElement("div");
        label.className = "ech-rmu-value-overlay-label";
        label.textContent = labelText;
        txt.appendChild(label);
    }

    if (number !== "" && number !== null && number !== undefined) {
        const value = document.createElement("div");
        value.className = "ech-rmu-value-overlay-number";
        value.textContent = formatBonus(number);
        txt.appendChild(value);
    }

    root.appendChild(txt);
    host.appendChild(root);
}

/**
 * Picks the icon for a chip that was not given one explicitly, from its class name.
 * @param {string} chipClass - The chip's class list (for example "ech-rmu-skill-fav-chip").
 * @returns {string|null} The icon URL, or null for no icon.
 */
function defaultChipIcon(chipClass) {
    if (chipClass.includes("fav-chip")) return ICONS.star;
    if (chipClass.includes("instant-chip")) return ICONS.instant;
    if (chipClass.includes("subconscious-chip")) return ICONS.subconscious;
    return null;
}

/**
 * Builds one chip element. The icon is drawn as a mask over the chip's colour, so the GM's
 * icon choice is passed as the --ech-rmu-chip-icon-url custom property.
 * @param {{class: string, title: string, icon?: string}} chipData - The chip definition.
 * @returns {HTMLElement}
 */
function buildChip(chipData) {
    const chip = document.createElement("div");
    chip.className = `ech-rmu-chip ${chipData.class}`;
    chip.title = chipData.title;

    const iconUrl = chipData.icon || defaultChipIcon(chipData.class);
    if (iconUrl) {
        const icon = document.createElement("div");
        icon.className = "ech-rmu-chip-icon";
        icon.style.setProperty("--ech-rmu-chip-icon-url", `url("${iconUrl}")`);
        chip.appendChild(icon);
    }
    return chip;
}

/**
 * Creates or refreshes the chip row on an action button. Passing no chips removes the row.
 * @param {HTMLElement} element - The button's DOM element.
 * @param {Array<{class: string, title: string, icon?: string}>} [chips=[]] - Chips to show.
 * @returns {HTMLElement|null} The chip container, or null when there are no chips.
 */
export function buildChipContainer(element, chips = []) {
    if (!element) return null;
    if (!chips?.length) {
        element.querySelector(".ech-rmu-chip-container")?.remove();
        return null;
    }

    element.classList.add("ech-rmu-button-relative");
    let chipContainer = element.querySelector(".ech-rmu-chip-container");
    if (chipContainer) {
        chipContainer.replaceChildren();
    } else {
        chipContainer = document.createElement("div");
        chipContainer.className = "ech-rmu-chip-container";
        element.appendChild(chipContainer);
    }

    for (const chipData of chips) {
        chipContainer.appendChild(buildChip(chipData));
    }
    return chipContainer;
}

/**
 * Creates the equip/unequip toggle shown on weapons and items.
 *
 * The toggle sits inside an action button, so its events must not also trigger the
 * button: pointerdown and click are stopped with stopImmediatePropagation. The button's
 * own mousedown handler is a separate event and must still ignore clicks that land on the
 * toggle (it checks event.target).
 * @param {object} options
 * @param {boolean} options.equipped - Current equipped state, which sets the icon and title.
 * @param {(event: MouseEvent) => void} options.onToggle - Called when the toggle is clicked.
 * @returns {HTMLElement}
 */
export function createEquipToggle({ equipped, onToggle }) {
    const toggle = document.createElement("div");
    toggle.className = "ech-rmu-equip-toggle";
    toggle.classList.toggle("equipped", equipped);
    toggle.title = equipped ? "Click to Unequip" : "Click to Equip";

    const icon = document.createElement("img");
    icon.className = "ech-rmu-equip-icon";
    icon.src = equipped ? ICONS.equip_closed : ICONS.equip_open;
    icon.alt = "Toggle Equip";
    toggle.appendChild(icon);

    toggle.addEventListener("pointerdown", (e) => e.stopImmediatePropagation());
    toggle.addEventListener("click", (e) => {
        e.stopImmediatePropagation();
        onToggle(e);
    });
    return toggle;
}
