/**
 * TubeMark YouTube Utility Module
 *
 * Phase 0: Structure for future functions.
 *
 * Future functions to implement:
 *
 * - getVideoId(url)
 *   Extracts the YouTube video ID from a URL.
 *
 * - isYouTubeVideoPage(url)
 *   Checks if a given URL is a YouTube watch page.
 *
 * - createTimestampUrl(videoId, seconds)
 *   Creates a YouTube URL with the specified start time parameter.
 */

const TubeMarkYouTubeUtils = {
  /**
   * Extracts the YouTube video ID from a given URL string.
   * @param {string} url
   * @returns {string|null} Video ID or null if not found
   */
  getVideoId: (url) => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com')) {
        return urlObj.searchParams.get('v');
      } else if (urlObj.hostname.includes('youtu.be')) {
        return urlObj.pathname.substring(1);
      }
    } catch (e) {
      // In case URL is not absolute or valid
    }
    return null;
  },

  /**
   * Checks if a given URL is a YouTube video/watch page.
   * @param {string} url
   * @returns {boolean} True if watch page
   */
  isYouTubeVideoPage: (url) => {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch';
    } catch (e) {
      return false;
    }
  },

  /**
   * Creates a sharing/timestamp link to continue playback at target position.
   * @param {string} videoId
   * @param {number} seconds
   * @returns {string} YouTube url
   */
  createTimestampUrl: (videoId, seconds) => {
    if (!videoId) return '';
    const roundedSeconds = Math.floor(seconds || 0);
    return `https://www.youtube.com/watch?v=${videoId}&t=${roundedSeconds}s`;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TubeMarkYouTubeUtils;
}
