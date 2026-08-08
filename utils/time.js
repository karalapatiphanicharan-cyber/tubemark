/**
 * TubeMark Time Utility Module
 *
 * Reusable and defensive functions for formatting and parsing video times.
 */

const TubeMarkTime = {
  /**
   * Formats a time in seconds to a string (e.g. H:MM:SS or MM:SS)
   * Handles invalid inputs defensively.
   * @param {number} seconds
   * @returns {string} Formatted timestamp or '--:--'
   */
  formatTime: (seconds) => {
    if (
      seconds === undefined ||
      seconds === null ||
      isNaN(seconds) ||
      !isFinite(seconds) ||
      seconds < 0
    ) {
      return '--:--';
    }

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (num) => String(num).padStart(2, '0');

    if (hrs > 0) {
      // H:MM:SS
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    // MM:SS (always pad minutes even if single digit, or matches the requirement e.g. 05:05 / 23:45)
    return `${pad(mins)}:${pad(secs)}`;
  },

  /**
   * Parses a formatted timestamp string back to seconds
   * @param {string} timeString
   * @returns {number} Time in seconds
   */
  parseTime: (timeString) => {
    if (!timeString || timeString === '--:--') return 0;
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
