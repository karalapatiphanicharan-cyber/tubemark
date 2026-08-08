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

  // Utility to query freshest info from content script
  async function queryFreshestVideoInfo(tabId) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Content script communication timed out.'));
      }, 1500);

      chrome.tabs.sendMessage(tabId, { action: 'getVideoInfo' }, (res) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(res);
        }
      });
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

  // Helper to check and update the Save Button visual states (Already Saved Detection)
  async function updateSaveButtonVisualState(videoId) {
    if (!saveBtn || !videoId) return;

    try {
      if (typeof TubeMarkStorage !== 'undefined') {
        const existingBookmark = await TubeMarkStorage.getBookmarkByVideoId(videoId);
        if (existingBookmark) {
          saveBtn.innerHTML = '<span>✓</span> Already Saved';
          saveBtn.className = 'save-btn already-saved';
          saveBtn.title = 'Click to update to latest playback position';
        } else {
          saveBtn.innerHTML = '<span>🔖</span> Save Bookmark';
          saveBtn.className = 'save-btn';
          saveBtn.title = 'Save current video bookmark';
        }
      }
    } catch (err) {
      console.warn('Error reading bookmark status:', err);
    }
  }

  // Initialize Save Button click listener (Phase 4 save bookmark flow)
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        const activeTab = await getActiveTab();
        if (!activeTab || !currentDetectedData) {
          showToast('No active YouTube video found.', true);
          return;
        }

        // Section 7: Query freshest video position immediately before saving
        let freshestData = currentDetectedData;
        try {
          const res = await queryFreshestVideoInfo(activeTab.id);
          if (res && res.success && res.data) {
            freshestData = res.data;
          }
        } catch (freshestErr) {
          console.warn('Could not query freshest playback position, using cached metadata:', freshestErr);
        }

        // Assemble Phase 4 bookmark object
        const bookmarkObject = {
          videoId: freshestData.videoId,
          title: freshestData.title,
          channel: freshestData.channel,
          url: freshestData.url,
          thumbnail: freshestData.thumbnail,
          currentTime: freshestData.currentTime,
          duration: freshestData.duration
        };

        if (typeof TubeMarkStorage !== 'undefined') {
          await TubeMarkStorage.saveBookmark(bookmarkObject);

          // Show visual success states
          showToast('✓ Bookmark saved');
          await updateSaveButtonVisualState(freshestData.videoId);
          await updateSavedBookmarksListState();

          // Temporarily show "✓ Saved" on button for feedback
          const originalHTML = saveBtn.innerHTML;
          const originalClass = saveBtn.className;
          saveBtn.innerHTML = '<span>✓</span> Saved!';
          saveBtn.className = 'save-btn save-success';

          setTimeout(() => {
            updateSaveButtonVisualState(freshestData.videoId);
          }, 1500);

        } else {
          showToast('Storage module not loaded.', true);
        }

      } catch (err) {
        console.error('Failed to save bookmark:', err);
        showToast('Unable to save bookmark. Please try again.', true);
      }
    });
  }

  /**
   * Updates the UI to a specific state:
   * 'loading', 'detected', 'not-detected', 'error'
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

    // Query content script
    try {
      const response = await queryFreshestVideoInfo(activeTab.id);

      if (response && response.success && response.data) {
        currentDetectedData = response.data;
        setUIState('detected', currentDetectedData);
        await updateSaveButtonVisualState(currentDetectedData.videoId);
      } else {
        setUIState('error');
      }
    } catch (msgError) {
      console.warn('Messaging failure (might need reload):', msgError);
      setUIState('error');
    }

  } catch (error) {
    console.error('Fatal initialization error:', error);
    setUIState('error');
  }
});
