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
