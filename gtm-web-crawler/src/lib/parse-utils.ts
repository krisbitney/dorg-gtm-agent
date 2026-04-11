/**
 * Utility functions for parsing and normalizing text from HTML.
 */

/**
 * Normalizes whitespace in a string by replacing multiple spaces/newlines with a single space
 * and trimming the result.
 * @param text The text to normalize.
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Parses a compact number string (e.g., "1.2k", "3m", "150") into a number.
 * Returns null if the text cannot be parsed.
 * @param text The compact number string.
 */
export function parseCompactNumber(text: string): number | null {
  if (!text) return null;
  
  const cleanText = text.toLowerCase().replace(/,/g, "").trim();
  const match = cleanText.match(/^([\d.]+)\s*([km])?.*$/);
  
  if (!match) return null;
  
  const value = parseFloat(match[1]);
  const multiplierText = match[2];
  
  if (isNaN(value)) return null;
  
  let multiplier = 1;
  if (multiplierText === "k") {
    multiplier = 1000;
  } else if (multiplierText === "m") {
    multiplier = 1000000;
  }
  
  return Math.floor(value * multiplier);
}
