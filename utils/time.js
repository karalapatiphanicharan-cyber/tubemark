/**
 * TubeMark Time Utility Module
 *
 * Phase 0: Placeholder helper structure for future timestamp formatting.
 */

const TubeMarkTime = {
  /**
   * Formats a time in seconds to a string (e.g. 1:23 or 1:02:45)
   * @param {number} seconds
   * @returns {string} Formatted timestamp
   */
  formatTime: (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (num) => String(num).padStart(2, '0');

    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${mins}:${pad(secs)}`;
  },

  /**
   * Parses a formatted timestamp string back to seconds
   * @param {string} timeString
   * @returns {number} Time in seconds
   */
  parseTime: (timeString) => {
    if (!timeString) return 0;
    const parts = timeString.split(':').map(Number);
    if (parts.some(isNaN)) return 0;

    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parts[0] || 0;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TubeMarkTime;
}
