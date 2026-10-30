/**
 * Tooltip data for Argon CORE's tooltip template.
 *
 * Each panel describes its tooltip as a title, subtitle, optional description and a list of
 * details. Every detail says how its value is formatted, instead of the formatter guessing
 * from the English label text:
 *
 * - DETAIL_FORMAT.BONUS: a modifier, shown with a sign (+5, 0, -5).
 * - DETAIL_FORMAT.NUMBER: a count or measure, shown as is (ranks, level, targets).
 * - DETAIL_FORMAT.TEXT: anything else (the default).
 *
 * CORE inserts the title, subtitle and detail values as raw HTML, so buildTooltip escapes
 * them. The description is the one field passed through as HTML, because it carries
 * formatted text from the system or the item's notes.
 */

import { DETAIL_FORMAT, escapeHTML, formatBonus } from "../format.js";

export { DETAIL_FORMAT };

/**
 * @param {*} value
 * @returns {boolean} True when the value should not be shown at all.
 */
function isEmpty(value) {
    return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

/**
 * Formats and escapes the details, dropping any without a value.
 * @param {Array<{label: string, value: *, format?: string}>} details
 * @returns {Array<{label: string, value: string}>}
 */
export function tooltipDetails(details) {
    return (details ?? [])
        .filter((d) => d && !isEmpty(d.value))
        .map(({ label, value, format }) => {
            const shown = format === DETAIL_FORMAT.BONUS ? formatBonus(value) : value;
            return { label, value: escapeHTML(shown) };
        });
}

/**
 * Builds the object CORE's tooltip renders.
 * @param {object} data
 * @param {string} data.title - Plain text (escaped).
 * @param {string} [data.subtitle] - Plain text (escaped).
 * @param {string} [data.description] - HTML (not escaped).
 * @param {Array<{label: string, value: *, format?: string}>} [data.details]
 * @returns {{title: string, subtitle: string, description: string, details: Array<{label: string, value: string}>}}
 */
export function buildTooltip({ title, subtitle, description, details }) {
    return {
        title: escapeHTML(title),
        subtitle: escapeHTML(subtitle),
        description: description ?? "",
        details: tooltipDetails(details),
    };
}
