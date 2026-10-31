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
 * CORE inserts the title, subtitle, detail values and property badges as raw HTML, so
 * buildTooltip escapes them. The description is the one field passed through as HTML,
 * because it carries formatted text from the system or the item's notes.
 *
 * Properties are CORE's badge row at the foot of the tooltip. They explain the chips drawn
 * on a button (Favorite, Instantaneous, ...): the chips themselves cannot have their own
 * hover text, because they let the pointer through to the button so a click on a chip
 * still activates it, and a second hover tooltip would compete with CORE's.
 */

import { DETAIL_FORMAT, escapeHTML, formatBonus } from "../format.js";
import { t } from "../i18n.js";

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
 * @param {Array<string>} [data.properties] - Translated badge texts (escaped).
 * @returns {object} title, subtitle, description and details, plus properties and
 *   propertiesLabel when there are properties.
 */
export function buildTooltip({ title, subtitle, description, details, properties }) {
    const tooltip = {
        title: escapeHTML(title),
        subtitle: escapeHTML(subtitle),
        description: description ?? "",
        details: tooltipDetails(details),
    };
    const badges = (properties ?? []).filter((p) => !isEmpty(p));
    if (badges.length) {
        tooltip.properties = badges.map((label) => ({ label: escapeHTML(label) }));
        tooltip.propertiesLabel = t("ECH-RMU.Tooltip.Properties");
    }
    return tooltip;
}
