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

      // Post-write verification (verify that the saved bookmark actually exists)
      const verifyBookmarks = await TubeMarkStorage.getBookmarks();
      const verifiedExist = verifyBookmarks.some(b => b.videoId === bookmarkData.videoId);
      if (!verifiedExist) {
        throw new Error("Post-write storage verification failed: Saved bookmark was not found in local storage.");
      }
      console.log("[TubeMark] Storage verification successful:", verifyBookmarks);
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

    console.log("[TubeMark] Delete started");
    console.log("[TubeMark] Bookmark ID:", id);

    const bookmarks = await TubeMarkStorage.getBookmarks();
    console.log("[TubeMark] Existing bookmark count:", bookmarks.length);

    const filtered = bookmarks.filter(b => b.id !== id);

    if (bookmarks.length === filtered.length) {
      console.warn("[TubeMark] Delete failed: Bookmark ID not found in storage.");
      return false; // Nothing was deleted
    }

    console.log("[TubeMark] Removing bookmark...");

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

      console.log("[TubeMark] Storage update completed");

      // Post-delete verification (verify that the bookmark is actually removed)
      const verifyBookmarks = await TubeMarkStorage.getBookmarks();
      const verifiedDeleted = !verifyBookmarks.some(b => b.id === id);
      if (!verifiedDeleted) {
        throw new Error("Post-delete storage verification failed: Deleted bookmark still exists in local storage.");
      }
      console.log("[TubeMark] Storage verification successful. Remaining bookmarks:", verifyBookmarks.length);
    } else {
      console.warn('chrome.storage.local not found. Cannot persist changes.');
    }

    console.log("[TubeMark] Delete completed");
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
  },

  /**
   * Updates only the note of a bookmark by its unique ID.
   * Preserves all other fields (id, videoId, title, channel, url, thumbnail, currentTime, duration, savedAt).
   * @param {string} bookmarkId
   * @param {string} note
   * @returns {Promise<boolean>} True if successful
   */
  updateBookmarkNote: async (bookmarkId, note) => {
    if (!bookmarkId) return false;

    console.log("[TubeMark] updateBookmarkNote started for ID:", bookmarkId);
    const bookmarks = await TubeMarkStorage.getBookmarks();
    const index = bookmarks.findIndex(b => b.id === bookmarkId);

    if (index === -1) {
      console.warn("[TubeMark] updateBookmarkNote failed: Bookmark ID not found.");
      return false;
    }

    // Preserve all fields, only update note field
    bookmarks[index] = {
      ...bookmarks[index],
      note: typeof note === 'string' ? note : ''
    };

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

      // Post-write verification
      const verifyBookmarks = await TubeMarkStorage.getBookmarks();
      const updatedItem = verifyBookmarks.find(b => b.id === bookmarkId);
      if (!updatedItem || updatedItem.note !== note) {
        throw new Error("Post-write note storage verification failed.");
      }
      console.log("[TubeMark] Note storage verification successful.");
    } else {
      console.warn('chrome.storage.local not found. Cannot persist changes.');
    }

    return true;
  },

  /**
   * Clears all bookmarks by setting the bookmarks array in storage to [].
   * Does NOT touch any other key in storage.
   * @returns {Promise<boolean>} True if successful
   */
  clearBookmarks: async () => {
    const emptyBookmarks = [];
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ bookmarks: emptyBookmarks }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
      console.log("[TubeMark] Storage cleared. Bookmarks is now an empty array.");
    } else {
      console.warn('chrome.storage.local not found. Cannot clear bookmarks.');
    }
    return true;
  },

  /**
   * Imports an array of bookmarks, validating entries and merging duplicates cleanly.
   * @param {Array} importedList
   * @returns {Promise<Array>} The updated bookmarks array
   */
  importBookmarks: async (importedList) => {
    if (!Array.isArray(importedList)) {
      throw new Error("Invalid import: expected an array.");
    }

    const currentBookmarks = await TubeMarkStorage.getBookmarks();
    const currentMap = new Map();
    currentBookmarks.forEach(b => {
      if (b.videoId) {
        currentMap.set(b.videoId, b);
      }
    });

    importedList.forEach(imported => {
      if (!imported || !imported.videoId || !imported.title) {
        // Skip invalid entries safely
        return;
      }

      const existing = currentMap.get(imported.videoId);
      const mergedBookmark = {
        id: imported.id || (existing ? existing.id : TubeMarkStorage.generateUUID()),
        videoId: imported.videoId,
        title: imported.title || (existing ? existing.title : 'Untitled Title'),
        channel: imported.channel || (existing ? existing.channel : 'Unknown Channel'),
        url: imported.url || (existing ? existing.url : ''),
        thumbnail: imported.thumbnail || (existing ? existing.thumbnail : ''),
        currentTime: typeof imported.currentTime === 'number' ? imported.currentTime : (existing ? existing.currentTime : 0),
        duration: typeof imported.duration === 'number' ? imported.duration : (existing ? existing.duration : null),
        note: typeof imported.note === 'string' ? imported.note : (existing ? existing.note || '' : ''),
        savedAt: typeof imported.savedAt === 'number' ? imported.savedAt : (existing ? existing.savedAt : Date.now())
      };

      currentMap.set(imported.videoId, mergedBookmark);
    });

    const updatedBookmarks = Array.from(currentMap.values());

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ bookmarks: updatedBookmarks }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });

      // Post-write verification
      const verify = await TubeMarkStorage.getBookmarks();
      console.log("[TubeMark] Import complete. Stored bookmarks count:", verify.length);
    } else {
      console.warn('chrome.storage.local not found. Cannot persist import.');
    }

    return updatedBookmarks;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TubeMarkStorage;
}
