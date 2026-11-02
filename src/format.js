/**
 * Pure formatting helpers shared by the panels. Nothing here touches the DOM or Foundry,
 * so these functions can be unit tested outside Foundry.
 */

/**
 * Formats a number as a string with a leading plus sign for positive values.
 * Non-numeric input (for example a range string such as "30'") is returned unchanged, so
 * callers can pass any tooltip value through it safely.
 * @param {*} n - The number or string to format.
 * @returns {string|*} The formatted string, or the original value if not a number.
 */
export function formatBonus(n) {
    if (n === null || n === undefined) return n;
    const s = String(n).trim();
    if (s === "") return s;
    const num = Number(s);
    if (Number.isNaN(num)) return n;
    return num > 0 ? `+${num}` : String(num);
}

/**
 * How a tooltip detail's value is formatted (see ui/tooltip.js).
 * BONUS: a modifier, shown with a sign (+5, 0, -5). NUMBER: a count or measure, shown as is
 * (ranks, level, targets). TEXT: anything else, and the default.
 */
export const DETAIL_FORMAT = Object.freeze({
    TEXT: "text",
    NUMBER: "number",
    BONUS: "bonus",
});

/** Characters that change meaning in HTML, and their entity replacements. */
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * Escapes text for safe insertion into HTML.
 * Argon CORE's templates insert labels and tooltip values as raw HTML ({{{...}}}), so any
 * text that comes from an actor, item or the system (a name, a range such as <25'>) must be
 * escaped before it reaches them. null and undefined become an empty string.
 * @param {*} value
 * @returns {string}
 */
export function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}
