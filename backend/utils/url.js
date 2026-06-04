/**
 * URL and link generation utilities.
 */

const { FRONTEND_URL: CONFIG_FRONTEND_URL } = require('../lib/config');

/**
 * Generates an absolute booking link for a clinic.
 * Handles trailing slashes in the base URL and ensures the link is absolute.
 * 
 * @param {string} clinicId - The unique ID of the clinic.
 * @param {string} [missedCallId] - Optional ID for recovery tracking.
 * @returns {string} The complete, absolute booking URL.
 */
function getBookingLink(clinicId, missedCallId = null) {
  // Use config default if process.env is not set, or fallback to a safe default
  const baseUrl = (process.env.FRONTEND_URL || CONFIG_FRONTEND_URL || 'https://clinicflow.app').replace(/\/+$/, '');
  
  let url = `${baseUrl}/book?clinicId=${clinicId}`;
  if (missedCallId) {
    url += `&missedCallId=${missedCallId}`;
  }
  
  return url;
}

/**
 * Ensures a URL is absolute and handles template replacement safely.
 * 
 * @param {string} template - The SMS or message template.
 * @param {Object} data - Key-value pairs for replacement.
 * @returns {string} The processed string with all occurrences replaced.
 */
function processTemplate(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{${key}}`;
    // Node 18+ supports replaceAll, use it for safety
    if (result.replaceAll) {
      result = result.replaceAll(placeholder, String(value));
    } else {
      // Fallback for older environments
      result = result.split(placeholder).join(String(value));
    }
  }
  return result;
}

module.exports = {
  getBookingLink,
  processTemplate
};
