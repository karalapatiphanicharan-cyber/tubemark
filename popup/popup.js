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

  const listContainer = document.querySelector('.bookmarks-list-container');

  // Human-readable date formatting helper (Phase 6)
  function formatHumanDate(timestamp) {
    if (!timestamp || isNaN(timestamp)) return '';
    try {
      const now = new Date();
      const savedDate = new Date(timestamp);

      // Check if same day, same month, same year
      const isToday = now.getDate() === savedDate.getDate() &&
                      now.getMonth() === savedDate.getMonth() &&
                      now.getFullYear() === savedDate.getFullYear();

      if (isToday) {
        return 'Saved today';
      }

      // Check if yesterday
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = yesterday.getDate() === savedDate.getDate() &&
                          yesterday.getMonth() === savedDate.getMonth() &&
                          yesterday.getFullYear() === savedDate.getFullYear();

      if (isYesterday) {
        return 'Saved yesterday';
      }

      // Format as "Saved MMM D" (e.g. Saved Aug 5)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `Saved ${months[savedDate.getMonth()]} ${savedDate.getDate()}`;
    } catch (err) {
      return '';
    }
  }

  // Updates the visual bookmark counter and renders bookmark cards (Phase 6)
  async function updateSavedBookmarksListState() {
    if (!listContainer) return;

    try {
      // Step 14: show visual "Loading bookmarks..." during storage request
      listContainer.innerHTML = `
        <div class="state-container loading-state" style="width: 100%;">
          <p class="state-text">Loading bookmarks...</p>
        </div>
      `;

      if (typeof TubeMarkStorage !== 'undefined') {
        const bookmarks = await TubeMarkStorage.getBookmarks();
        const count = bookmarks.length;

        // Update Section title with count: e.g. "Saved Bookmarks (3)"
        if (savedBookmarksHeading) {
          savedBookmarksHeading.textContent = `Saved Bookmarks (${count})`;
        }

        if (count === 0) {
          // Step 15: Empty State
          listContainer.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon" aria-hidden="true">📭</div>
              <h3 class="empty-title">No bookmarks yet</h3>
              <p class="empty-text">Save a YouTube video to see it here.</p>
            </div>
          `;
          return;
        }

        // Step 12: Sort descending by bookmark.savedAt on a cloned array (newest first)
        const sortedBookmarks = [...bookmarks].sort((a, b) => {
          const dateA = a.savedAt || 0;
          const dateB = b.savedAt || 0;
          return dateB - dateA;
        });

        // Clear loading state
        listContainer.innerHTML = '';

        // Step 3: Dynamically generate clean card nodes for every bookmark securely (textContent)
        sortedBookmarks.forEach((bookmark) => {
          const cardDiv = document.createElement('div');
          cardDiv.className = 'bookmark-card';

          // Thumbnail component
          const mainRowDiv = document.createElement('div');
          mainRowDiv.className = 'bookmark-main-row';

          const thumbDiv = document.createElement('div');
          thumbDiv.className = 'thumbnail-placeholder';

          // Create real image (Phase 6 placeholder fallback)
          const imgElem = document.createElement('img');
          imgElem.className = 'real-thumbnail';
          imgElem.style.width = '100%';
          imgElem.style.height = '100%';
          imgElem.style.objectFit = 'cover';
          imgElem.src = bookmark.thumbnail || 'https://img.youtube.com/vi/placeholder/hqdefault.jpg';
          imgElem.alt = bookmark.title ? `${bookmark.title} Thumbnail` : 'Video Thumbnail';
          thumbDiv.appendChild(imgElem);

          // Details component (Title, Channel, Playback position / duration)
          const detailsDiv = document.createElement('div');
          detailsDiv.className = 'bookmark-details';

          const titleH3 = document.createElement('h3');
          titleH3.className = 'bookmark-title';
          titleH3.textContent = bookmark.title || 'Untitled video';
          titleH3.title = bookmark.title || 'Untitled video';

          const channelP = document.createElement('p');
          channelP.className = 'bookmark-channel';
          channelP.textContent = bookmark.channel || 'Unknown channel';

          // Playback progress duration timestamps
          const timeMetaDiv = document.createElement('div');
          timeMetaDiv.className = 'video-meta';

          const timestampSpan = document.createElement('span');
          timestampSpan.className = 'timestamp';

          const formattedCurrent = typeof TubeMarkTime !== 'undefined'
            ? TubeMarkTime.formatTime(bookmark.currentTime)
            : '--:--';
          const formattedDuration = typeof TubeMarkTime !== 'undefined'
            ? TubeMarkTime.formatTime(bookmark.duration)
            : '--:--';
          timestampSpan.textContent = `⏱ ${formattedCurrent} / ${formattedDuration}`;
          timeMetaDiv.appendChild(timestampSpan);

          detailsDiv.appendChild(titleH3);
          detailsDiv.appendChild(channelP);
          detailsDiv.appendChild(timeMetaDiv);

          mainRowDiv.appendChild(thumbDiv);
          mainRowDiv.appendChild(detailsDiv);
          cardDiv.appendChild(mainRowDiv);

          // Step 8: Visual progress bar (calculated from currentTime / duration)
          const durationVal = Number(bookmark.duration);
          const currentVal = Number(bookmark.currentTime);

          if (durationVal && durationVal > 0 && !isNaN(currentVal)) {
            const pct = Math.min(100, Math.max(0, Math.round((currentVal / durationVal) * 100)));
            const progressContainer = document.createElement('div');
            progressContainer.className = 'bookmark-progress-container';

            const progressTrack = document.createElement('div');
            progressTrack.className = 'progress-track';

            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            progressFill.style.width = `${pct}%`;
            progressTrack.appendChild(progressFill);

            const progressPercent = document.createElement('span');
            progressPercent.className = 'progress-percent';
            progressPercent.textContent = `${pct}%`;

            progressContainer.appendChild(progressTrack);
            progressContainer.appendChild(progressPercent);
            cardDiv.appendChild(progressContainer);
          }

          // Step 9: Notes Display (Optional check)
          if (bookmark.note && bookmark.note.trim() !== '') {
            const noteBox = document.createElement('div');
            noteBox.className = 'bookmark-note-box';

            const noteTitle = document.createElement('div');
            noteTitle.className = 'bookmark-note-title';
            noteTitle.textContent = 'Note';

            const noteContent = document.createElement('span');
            noteContent.textContent = bookmark.note;

            noteBox.appendChild(noteTitle);
            noteBox.appendChild(noteContent);
            cardDiv.appendChild(noteBox);
          }

          // Step 10 & 11: Footer display row (relative date and Open Video/Delete triggers)
          const footerRowDiv = document.createElement('div');
          footerRowDiv.className = 'bookmark-footer-row';

          const dateSpan = document.createElement('span');
          dateSpan.className = 'bookmark-saved-date';
          dateSpan.textContent = formatHumanDate(bookmark.savedAt);

          const actionGroupDiv = document.createElement('div');
          actionGroupDiv.className = 'bookmark-actions';
          actionGroupDiv.style.display = 'flex';
          actionGroupDiv.style.gap = '8px';

          const openBtn = document.createElement('button');
          openBtn.className = 'open-video-btn';
          openBtn.textContent = 'Open Video';
          openBtn.title = 'Open video URL in a new browser tab';

          // Action listener to safely launch target link in new tab without seeking
          openBtn.addEventListener('click', () => {
            if (bookmark.url) {
              window.open(bookmark.url, '_blank');
            }
          });

          // Phase 7 Delete Button
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'delete-bookmark-btn';
          deleteBtn.textContent = 'Delete';
          deleteBtn.title = 'Delete this video bookmark';

          actionGroupDiv.appendChild(openBtn);
          actionGroupDiv.appendChild(deleteBtn);

          footerRowDiv.appendChild(dateSpan);
          footerRowDiv.appendChild(actionGroupDiv);
          cardDiv.appendChild(footerRowDiv);

          // Inline Confirmation Box (initially not attached)
          let confirmBoxDiv = null;

          deleteBtn.addEventListener('click', () => {
            // If already confirming, do nothing
            if (confirmBoxDiv) return;

            // Hide normal footer row and progress container temporarily for clean aesthetic
            footerRowDiv.style.display = 'none';
            const progressContainer = cardDiv.querySelector('.bookmark-progress-container');
            if (progressContainer) progressContainer.style.display = 'none';

            // Create inline confirmation box
            confirmBoxDiv = document.createElement('div');
            confirmBoxDiv.className = 'delete-confirm-box';

            const confirmMsg = document.createElement('p');
            confirmMsg.className = 'delete-confirm-msg';
            confirmMsg.textContent = 'Delete this bookmark?';

            const confirmActions = document.createElement('div');
            confirmActions.className = 'delete-confirm-actions';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'confirm-cancel-btn';
            cancelBtn.textContent = 'Cancel';

            const confirmDeleteBtn = document.createElement('button');
            confirmDeleteBtn.className = 'confirm-delete-btn';
            confirmDeleteBtn.textContent = 'Delete';

            // Cancel trigger
            cancelBtn.addEventListener('click', () => {
              confirmBoxDiv.remove();
              confirmBoxDiv = null;
              footerRowDiv.style.display = 'flex';
              if (progressContainer) progressContainer.style.display = 'flex';
            });

            // Confirm Delete Trigger (call to storage layer)
            confirmDeleteBtn.addEventListener('click', async () => {
              try {
                console.log("[TubeMark] Delete clicked for bookmark ID:", bookmark.id);
                if (typeof TubeMarkStorage !== 'undefined') {
                  const success = await TubeMarkStorage.deleteBookmark(bookmark.id);
                  if (success) {
                    showToast('✓ Bookmark deleted');

                    // Reload bookmarks list and update active save button visual state
                    await updateSavedBookmarksListState();

                    // If the currently open video was deleted, revert Save button style back to unsaved
                    const activeTab = await getActiveTab();
                    if (activeTab && activeTab.url) {
                      const activeVideoId = typeof TubeMarkYouTubeUtils !== 'undefined'
                        ? TubeMarkYouTubeUtils.getVideoId(activeTab.url)
                        : null;
                      if (activeVideoId && activeVideoId === bookmark.videoId) {
                        await updateSaveButtonVisualState(activeVideoId);
                      }
                    }
                  } else {
                    console.error("[TubeMark] Delete failed: storage function returned false.");
                    showToast('Unable to delete bookmark. Please try again.', true);
                    // Revert UI on failure
                    cancelBtn.click();
                  }
                } else {
                  showToast('Storage module not loaded.', true);
                  cancelBtn.click();
                }
              } catch (err) {
                console.error("[TubeMark] Delete failed:", err);
                showToast('Unable to delete bookmark. Please try again.', true);
                cancelBtn.click();
              }
            });

            confirmActions.appendChild(cancelBtn);
            confirmActions.appendChild(confirmDeleteBtn);
            confirmBoxDiv.appendChild(confirmMsg);
            confirmBoxDiv.appendChild(confirmActions);

            cardDiv.appendChild(confirmBoxDiv);
          });

          listContainer.appendChild(cardDiv);
        });

      } else {
        // Step 16: Module loading error fallback
        listContainer.innerHTML = `
          <div class="state-container error-state" style="width: 100%;">
            <p class="state-title error-text">Unable to load bookmarks.</p>
            <p class="state-message">Please try again.</p>
          </div>
        `;
      }
    } catch (e) {
      console.error("[TubeMark]", e);
      // Step 16: Exception display rendering safely
      listContainer.innerHTML = `
        <div class="state-container error-state" style="width: 100%;">
          <p class="state-title error-text">Unable to load bookmarks.</p>
          <p class="state-message">Please try again.</p>
        </div>
      `;
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
