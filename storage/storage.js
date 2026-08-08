/**
 * TubeMark Storage Utility Module
 *
 * Provides clean, reusable interface to chrome.storage.local.
 * Separates storage logic from popup UI logic.
 */

const TubeMarkStorage = {
  /**
   * Helper to generate a unique random UUID with a fallback
   */
  generateUUID: () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Reliable fallback ID generator
    return 'bookmark-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
  },

  /**
   * Retrieves all saved bookmarks from chrome.storage.local.
   * Returns a promise resolving to an array of bookmark objects.
   * @returns {Promise<Array>} List of bookmarks
   */
  getBookmarks: async () => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      console.warn('chrome.storage.local not found, returning mock empty list.');
      return [];
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['bookmarks'], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result.bookmarks || []);
        }
      });
    });
  },

  /**
   * Saves or updates a bookmark.
   * Prevents duplicates by matching videoId.
   * If video is already bookmarked, updates properties in place (e.g., currentTime, duration, savedAt).
   * @param {Object} bookmarkData
   * @returns {Promise<Object>} The saved or updated bookmark
   */
  saveBookmark: async (bookmarkData) => {
    if (!bookmarkData || !bookmarkData.videoId) {
      throw new Error('Invalid bookmark data: videoId is required.');
    }

    const bookmarks = await TubeMarkStorage.getBookmarks();
    const existingIndex = bookmarks.findIndex(b => b.videoId === bookmarkData.videoId);

    let savedBookmark = null;

    if (existingIndex !== -1) {
      // Update existing bookmark in place
      const existing = bookmarks[existingIndex];
      savedBookmark = {
        ...existing,
        title: bookmarkData.title || existing.title,
        channel: bookmarkData.channel || existing.channel,
        url: bookmarkData.url || existing.url,
        thumbnail: bookmarkData.thumbnail || existing.thumbnail,
        currentTime: typeof bookmarkData.currentTime === 'number' ? bookmarkData.currentTime : existing.currentTime,
        duration: typeof bookmarkData.duration === 'number' ? bookmarkData.duration : existing.duration,
        note: typeof bookmarkData.note === 'string' ? bookmarkData.note : (existing.note || ''),
        savedAt: Date.now() // Update saved timestamp
      };
      bookmarks[existingIndex] = savedBookmark;
    } else {
      // Insert new bookmark
      savedBookmark = {
        id: bookmarkData.id || TubeMarkStorage.generateUUID(),
        videoId: bookmarkData.videoId,
        title: bookmarkData.title || 'Unknown Title',
        channel: bookmarkData.channel || 'Unknown Channel',
        url: bookmarkData.url || '',
        thumbnail: bookmarkData.thumbnail || '',
        currentTime: typeof bookmarkData.currentTime === 'number' ? bookmarkData.currentTime : 0,
        duration: typeof bookmarkData.duration === 'number' ? bookmarkData.duration : null,
        note: typeof bookmarkData.note === 'string' ? bookmarkData.note : '',
        savedAt: Date.now()
      };
      bookmarks.push(savedBookmark);
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ bookmarks }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } else {
      console.warn('chrome.storage.local not found. Cannot persist changes.');
    }

    return savedBookmark;
  },

  /**
   * Deletes a bookmark by its unique ID.
   * @param {string} id
   * @returns {Promise<boolean>} True if successful
   */
  deleteBookmark: async (id) => {
    if (!id) return false;

    const bookmarks = await TubeMarkStorage.getBookmarks();
    const filtered = bookmarks.filter(b => b.id !== id);

    if (bookmarks.length === filtered.length) {
      return false; // Nothing was deleted
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ bookmarks: filtered }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    }

    return true;
  },

  /**
   * Retrieves a bookmark matching the provided videoId.
   * Returns null if not found.
   * @param {string} videoId
   * @returns {Promise<Object|null>} Bookmark or null
   */
  getBookmarkByVideoId: async (videoId) => {
    if (!videoId) return null;
    const bookmarks = await TubeMarkStorage.getBookmarks();
    return bookmarks.find(b => b.videoId === videoId) || null;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TubeMarkStorage;
}
