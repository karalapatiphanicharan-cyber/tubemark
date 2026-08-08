/**
 * TubeMark YouTube Utility Module
 *
 * Reusable YouTube URL and validation logic.
 */

const TubeMarkYouTubeUtils = {
  /**
   * Extracts the YouTube video ID from a given URL string.
   * Handles:
   * - https://www.youtube.com/watch?v=VIDEO_ID
   * - https://youtube.com/watch?v=VIDEO_ID
   * - https://youtu.be/VIDEO_ID
   * - https://m.youtube.com/watch?v=VIDEO_ID
   * @param {string} url
   * @returns {string|null} Video ID or null if not found
   */
  getVideoId: (url) => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com')) {
        // Normal watch links (e.g. /watch?v=dQw4w9WgXcQ)
        if (urlObj.pathname === '/watch') {
          return urlObj.searchParams.get('v');
        }
        // Embed links (e.g. /embed/dQw4w9WgXcQ)
        if (urlObj.pathname.startsWith('/embed/')) {
          return urlObj.pathname.split('/')[2];
        }
        // Shorts links (e.g. /shorts/dQw4w9WgXcQ)
        if (urlObj.pathname.startsWith('/shorts/')) {
          return urlObj.pathname.split('/')[2];
        }
      } else if (urlObj.hostname.includes('youtu.be')) {
        // Shortened links (e.g. youtu.be/dQw4w9WgXcQ)
        return urlObj.pathname.substring(1).split('?')[0];
      }
    } catch (e) {
      // Return null if URL is completely malformed
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
      const isYoutubeDomain = urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be');
      if (!isYoutubeDomain) return false;

      // Check if it has a valid video ID
      const videoId = TubeMarkYouTubeUtils.getVideoId(url);
      return !!videoId;
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
