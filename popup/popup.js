// TubeMark Popup Script - Phase 4 Playback Timestamp Detection, Bookmark Storage, and UI Handling

document.addEventListener('DOMContentLoaded', async () => {
  const saveBtn = document.getElementById('save-bookmark-btn');
  const toast = document.getElementById('toast');
  const currentVideoSection = document.querySelector('.current-video-section');
  const savedBookmarksHeading = document.getElementById('saved-bookmarks-heading');
  const emptyStateContainer = document.querySelector('.saved-bookmarks-section .empty-state');

  let toastTimeout = null;
  let currentDetectedData = null; // Caches the latest video metadata in the popup

  // Utility to safely retrieve the active tab
  async function getActiveTab() {
    if (typeof chrome === 'undefined' || !chrome.tabs) return null;
    const [activeTab] = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });
    return activeTab;
  }

  // Utility to ping content script
  async function pingContentScript(tabId) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('PING timed out.'));
      }, 1000);

      try {
        chrome.tabs.sendMessage(tabId, { action: 'ping' }, (res) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(res);
          }
        });
      } catch (err) {
        clearTimeout(timeoutId);
        reject(err);
      }
    });
  }

  // Utility to query freshest info from content script
  async function queryFreshestVideoInfo(tabId) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Content script communication timed out.'));
      }, 1500);

      try {
        chrome.tabs.sendMessage(tabId, { action: 'getVideoInfo' }, (res) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(res);
          }
        });
      } catch (err) {
        clearTimeout(timeoutId);
        reject(err);
      }
    });
  }

  // Updates the visual bookmark counter and empty state
  async function updateSavedBookmarksListState() {
    try {
      if (typeof TubeMarkStorage !== 'undefined') {
        const bookmarks = await TubeMarkStorage.getBookmarks();
        const count = bookmarks.length;

        // Update Section title with count: e.g. "Saved Bookmarks (3)"
        if (savedBookmarksHeading) {
          savedBookmarksHeading.textContent = `Saved Bookmarks (${count})`;
        }

        // Section 15: basic count or "Your bookmarks are saved."
        if (emptyStateContainer) {
          if (count > 0) {
            emptyStateContainer.innerHTML = `
              <div class="empty-icon" aria-hidden="true">🔖</div>
              <h3 class="empty-title">Your bookmarks are saved</h3>
              <p class="empty-text">You have saved ${count} video bookmark${count > 1 ? 's' : ''}. Full list display is coming soon!</p>
            `;
          } else {
            emptyStateContainer.innerHTML = `
              <div class="empty-icon" aria-hidden="true">📭</div>
              <h3 class="empty-title">No bookmarks yet</h3>
              <p class="empty-text">Your saved YouTube videos will appear here.</p>
            `;
          }
        }
      }
    } catch (e) {
      console.error('Error updating saved bookmarks state:', e);
    }
  }

  // Helper to show visual toast feedback
  function showToast(message, isError = false) {
    if (!toast) return;
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    toast.textContent = message;
    toast.className = isError ? 'toast error-toast' : 'toast';
    toast.classList.remove('hidden');

    toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }

  const noteTextarea = document.getElementById('video-note');
  const charCounter = document.getElementById('char-counter');
  const MAX_CHAR_LIMIT = 500;

  // Function to update the character counter state and UI
  function updateCharCounter() {
    if (!noteTextarea || !charCounter) return;
    const len = noteTextarea.value.length;
    charCounter.textContent = `${len} / ${MAX_CHAR_LIMIT}`;
    if (len >= MAX_CHAR_LIMIT) {
      charCounter.classList.add('limit-reached');
    } else {
      charCounter.classList.remove('limit-reached');
    }
  }

  // Handle Note input and paste events to strictly enforce character limits (Phase 5)
  if (noteTextarea) {
    noteTextarea.addEventListener('input', () => {
      if (noteTextarea.value.length > MAX_CHAR_LIMIT) {
        noteTextarea.value = noteTextarea.value.slice(0, MAX_CHAR_LIMIT);
      }
      updateCharCounter();
    });

    noteTextarea.addEventListener('paste', (e) => {
      // Allow the default paste, but truncate on next tick
      setTimeout(() => {
        if (noteTextarea.value.length > MAX_CHAR_LIMIT) {
          noteTextarea.value = noteTextarea.value.slice(0, MAX_CHAR_LIMIT);
        }
        updateCharCounter();
      }, 0);
    });
  }

  // Helper to check and update the Save Button visual states and pre-populate note field (Phase 5)
  async function updateSaveButtonVisualState(videoId) {
    if (!saveBtn || !videoId) return;

    try {
      if (typeof TubeMarkStorage !== 'undefined') {
        const existingBookmark = await TubeMarkStorage.getBookmarkByVideoId(videoId);
        if (existingBookmark) {
          saveBtn.innerHTML = '<span>✓</span> Already Saved';
          saveBtn.className = 'save-btn already-saved';
          saveBtn.title = 'Click to update to latest playback position and note';

          // Pre-populate note from existing bookmark securely (fallback to empty string)
          if (noteTextarea) {
            noteTextarea.value = existingBookmark.note || '';
            updateCharCounter();
          }
        } else {
          saveBtn.innerHTML = '<span>🔖</span> Save Bookmark';
          saveBtn.className = 'save-btn';
          saveBtn.title = 'Save current video bookmark';

          if (noteTextarea) {
            noteTextarea.value = '';
            updateCharCounter();
          }
        }
      }
    } catch (err) {
      console.warn('Error reading bookmark status:', err);
    }
  }

  // Initialize Save Button click listener (Phase 5 save bookmark with optional note flow)
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      console.log("[TubeMark] Save started");
      try {
        const activeTab = await getActiveTab();
        console.log("[TubeMark] Active tab:", activeTab);
        if (!activeTab || !currentDetectedData) {
          console.error("[TubeMark] Save failed: No active YouTube video found.");
          showToast('No active YouTube video found.', true);
          return;
        }

        console.log("[TubeMark] Checking YouTube page");
        const isVideo = typeof TubeMarkYouTubeUtils !== 'undefined'
          ? TubeMarkYouTubeUtils.isYouTubeVideoPage(activeTab.url)
          : false;
        if (!isVideo) {
          console.error("[TubeMark] Save failed: Not a valid YouTube video page.");
          showToast('No active YouTube video found.', true);
          return;
        }

        // Verify active connection ping before querying freshest position
        console.log("[TubeMark] Sending Ping check...");
        try {
          await pingContentScript(activeTab.id);
        } catch (pingErr) {
          console.error("[TubeMark] Connection lost. Redirecting to reconnect state.");
          setUIState('reconnect');
          return;
        }

        console.log("[TubeMark] Requesting video information");
        let freshestData = currentDetectedData;
        try {
          const res = await queryFreshestVideoInfo(activeTab.id);
          if (res && res.success && res.data) {
            console.log("[TubeMark] Video information received:", res.data);
            freshestData = res.data;
          }
        } catch (freshestErr) {
          console.warn('[TubeMark] Could not query freshest playback position, using cached metadata:', freshestErr);
        }

        // Fallback for missing/invalid timestamps (Bugfix requirements)
        if (freshestData.currentTime === undefined || freshestData.currentTime === null || isNaN(freshestData.currentTime)) {
          console.error("[TubeMark] Save failed: Current playback position is currently unavailable.");
          setUIState('playback-failure');
          return;
        }
        console.log("[TubeMark] Current time:", freshestData.currentTime);

        // Whitespace and length handling for optional note (Phase 5)
        let noteValue = '';
        if (noteTextarea) {
          noteValue = noteTextarea.value.trim();
          if (noteValue.length > MAX_CHAR_LIMIT) {
            noteValue = noteValue.slice(0, MAX_CHAR_LIMIT);
          }
        }

        // Assemble Phase 5 bookmark object
        const bookmarkObject = {
          videoId: freshestData.videoId,
          title: freshestData.title,
          channel: freshestData.channel,
          url: freshestData.url,
          thumbnail: freshestData.thumbnail,
          currentTime: freshestData.currentTime,
          duration: freshestData.duration,
          note: noteValue
        };

        if (typeof TubeMarkStorage !== 'undefined') {
          const existingBookmarks = await TubeMarkStorage.getBookmarks();
          console.log("[TubeMark] Existing bookmarks:", existingBookmarks);
          console.log("[TubeMark] Bookmark object to save:", bookmarkObject);

          console.log("[TubeMark] Writing to chrome.storage.local");
          await TubeMarkStorage.saveBookmark(bookmarkObject);
          console.log("[TubeMark] Storage write completed");

          // Post-write confirmation step using direct chrome.storage.local.get logic
          const verifiedBookmarks = await TubeMarkStorage.getBookmarks();
          const verifiedItem = verifiedBookmarks.find(b => b.videoId === bookmarkObject.videoId);
          if (!verifiedItem) {
            throw new Error("Local bookmark missing after read-back verify.");
          }
          console.log("[TubeMark] Storage verification successful:", verifiedBookmarks);

          // Show visual success states
          showToast('✓ Bookmark saved');
          await updateSaveButtonVisualState(freshestData.videoId);
          await updateSavedBookmarksListState();

          // Temporarily show "✓ Saved" on button for feedback
          saveBtn.innerHTML = '<span>✓</span> Saved!';
          saveBtn.className = 'save-btn save-success';

          setTimeout(() => {
            updateSaveButtonVisualState(freshestData.videoId);
          }, 1500);

          console.log("[TubeMark] Save completed");

        } else {
          console.error("[TubeMark] Storage module not loaded.");
          showToast('Storage module not loaded.', true);
        }

      } catch (err) {
        console.error("[TubeMark] Save failed:", err);
        setUIState('storage-failure');
      }
    });
  }

  /**
   * Updates the UI to a specific state:
   * 'loading', 'detected', 'not-detected', 'reconnect', 'error'
   */
  function setUIState(state, data = {}) {
    if (!currentVideoSection) return;

    // Reset layout class
    currentVideoSection.className = 'section current-video-section ' + state;

    // Remove any state container if present
    const existingStateDiv = currentVideoSection.querySelector('.state-container');
    if (existingStateDiv) {
      existingStateDiv.remove();
    }

    const card = currentVideoSection.querySelector('.video-card');
    const saveButton = document.getElementById('save-bookmark-btn');
    const noteContainer = document.querySelector('.note-container');

    // Hide note field in non-detected, error, loading, and reconnect states
    if (noteContainer) {
      if (state === 'detected') {
        noteContainer.style.display = 'flex';
      } else {
        noteContainer.style.display = 'none';
      }
    }

    if (state === 'loading') {
      if (card) card.style.display = 'none';
      if (saveButton) saveButton.style.display = 'none';

      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'state-container loading-state';
      loadingDiv.innerHTML = `<p class="state-text">Loading video information...</p>`;
      currentVideoSection.insertBefore(loadingDiv, card);
    }
    else if (state === 'not-detected') {
      if (card) card.style.display = 'none';
      if (saveButton) saveButton.style.display = 'none';

      const notDetectedDiv = document.createElement('div');
      notDetectedDiv.className = 'state-container not-detected-state';
      notDetectedDiv.innerHTML = `
        <div class="empty-state-small">
          <p class="state-title">No YouTube video detected</p>
          <p class="state-message">Open a YouTube video to use TubeMark.</p>
        </div>
      `;
      currentVideoSection.insertBefore(notDetectedDiv, card);
    }
    else if (state === 'reconnect') {
      if (card) card.style.display = 'none';
      if (saveButton) saveButton.style.display = 'none';

      const reconnectDiv = document.createElement('div');
      reconnectDiv.className = 'state-container reconnect-state';
      reconnectDiv.innerHTML = `
        <div class="empty-state-small">
          <p class="state-title">TubeMark needs to reconnect to this YouTube page</p>
          <p class="state-message">Please refresh the YouTube page and try again.</p>
        </div>
      `;
      currentVideoSection.insertBefore(reconnectDiv, card);
    }
    else if (state === 'error') {
      if (card) card.style.display = 'none';
      if (saveButton) saveButton.style.display = 'none';

      const errorDiv = document.createElement('div');
      errorDiv.className = 'state-container error-state';
      errorDiv.innerHTML = `
        <div class="empty-state-small">
          <p class="state-title error-text">Unable to detect this video</p>
          <p class="state-message">Please refresh YouTube and try again.</p>
        </div>
      `;
      currentVideoSection.insertBefore(errorDiv, card);
    }
    else if (state === 'playback-failure') {
      if (card) card.style.display = 'none';
      if (saveButton) saveButton.style.display = 'none';

      const playbackFailureDiv = document.createElement('div');
      playbackFailureDiv.className = 'state-container playback-failure-state';
      playbackFailureDiv.innerHTML = `
        <div class="empty-state-small">
          <p class="state-title error-text">Playback position is currently unavailable</p>
          <p class="state-message">Please play the video briefly and try again.</p>
        </div>
      `;
      currentVideoSection.insertBefore(playbackFailureDiv, card);
    }
    else if (state === 'storage-failure') {
      if (card) card.style.display = 'none';
      if (saveButton) saveButton.style.display = 'none';

      const storageFailureDiv = document.createElement('div');
      storageFailureDiv.className = 'state-container storage-failure-state';
      storageFailureDiv.innerHTML = `
        <div class="empty-state-small">
          <p class="state-title error-text">Unable to save bookmark</p>
          <p class="state-message">Please try again.</p>
        </div>
      `;
      currentVideoSection.insertBefore(storageFailureDiv, card);
    }
    else if (state === 'detected') {
      if (card) card.style.display = 'flex';
      if (saveButton) saveButton.style.display = 'flex';

      // Update the DOM card elements with real details
      const titleElem = card.querySelector('.video-title');
      const channelElem = card.querySelector('.channel-name');
      const timestampElem = card.querySelector('.timestamp');
      const thumbnailSvg = card.querySelector('.thumbnail-svg');
      const thumbnailPlaceholder = card.querySelector('.thumbnail-placeholder');

      if (titleElem) {
        titleElem.textContent = data.title || 'Unknown Title';
        titleElem.title = data.title || '';
      }
      if (channelElem) {
        channelElem.textContent = data.channel || 'Unknown Channel';
      }

      // Display formatted playback time and duration (Phase 3)
      if (timestampElem) {
        const formattedCurrent = typeof TubeMarkTime !== 'undefined'
          ? TubeMarkTime.formatTime(data.currentTime)
          : '--:--';
        const formattedDuration = typeof TubeMarkTime !== 'undefined'
          ? TubeMarkTime.formatTime(data.duration)
          : '--:--';

        timestampElem.textContent = `⏱ ${formattedCurrent} / ${formattedDuration}`;
        timestampElem.setAttribute('aria-label', `Playback progress: ${formattedCurrent} of ${formattedDuration}`);
      }

      // Replace or insert an actual image instead of just the SVG
      if (thumbnailPlaceholder) {
        let imgElem = thumbnailPlaceholder.querySelector('.real-thumbnail');
        if (!imgElem) {
          imgElem = document.createElement('img');
          imgElem.className = 'real-thumbnail';
          imgElem.style.width = '100%';
          imgElem.style.height = '100%';
          imgElem.style.objectFit = 'cover';
          thumbnailPlaceholder.appendChild(imgElem);
        }
        imgElem.src = data.thumbnail || 'https://img.youtube.com/vi/placeholder/hqdefault.jpg';
        imgElem.alt = data.title || 'Video Thumbnail';

        if (thumbnailSvg) {
          thumbnailSvg.style.display = 'none';
        }

        const demoBadge = thumbnailPlaceholder.querySelector('.demo-badge');
        if (demoBadge) {
          demoBadge.style.display = 'none';
        }
      }
    }
  }

  // Load Initial Saved Bookmarks Counter State (Phase 4)
  await updateSavedBookmarksListState();

  // Detect and retrieve current YouTube tab details
  try {
    setUIState('loading');

    const activeTab = await getActiveTab();
    if (!activeTab || !activeTab.url) {
      setUIState('not-detected');
      return;
    }

    const isVideo = typeof TubeMarkYouTubeUtils !== 'undefined'
      ? TubeMarkYouTubeUtils.isYouTubeVideoPage(activeTab.url)
      : false;

    if (!isVideo) {
      setUIState('not-detected');
      return;
    }

    // Ping content script to verify active connection before messaging
    try {
      await pingContentScript(activeTab.id);
    } catch (pingErr) {
      console.error("[TubeMark] Connection Ping failed:", pingErr);
      setUIState('reconnect');
      return;
    }

    // Query content script
    try {
      const response = await queryFreshestVideoInfo(activeTab.id);

      if (response && response.success && response.data) {
        const data = response.data;

        // Strictly verify video information is valid (Phase 5/Bugfix requirements)
        if (!data.videoId) {
          console.error("[TubeMark] Video detection failed: videoId missing.");
          setUIState('error');
          return;
        }

        currentDetectedData = data;
        setUIState('detected', currentDetectedData);
        await updateSaveButtonVisualState(currentDetectedData.videoId);
      } else {
        console.error("[TubeMark] Video metadata parsing returned success=false.");
        setUIState('error');
      }
    } catch (msgError) {
      console.error('[TubeMark] Messaging failure:', msgError);
      const errMsg = msgError.message || '';
      if (
        errMsg.includes('Could not establish connection') ||
        errMsg.includes('Receiving end does not exist') ||
        errMsg.includes('connection')
      ) {
        setUIState('reconnect');
      } else {
        setUIState('error');
      }
    }

  } catch (error) {
    console.error('[TubeMark] Fatal initialization error:', error);
    setUIState('error');
  }
});
