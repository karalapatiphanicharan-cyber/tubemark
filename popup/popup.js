// TubeMark Popup Script - Phase 4 Playback Timestamp Detection, Bookmark Storage, and UI Handling

document.addEventListener('DOMContentLoaded', async () => {
  const saveBtn = document.getElementById('save-bookmark-btn');
  const toast = document.getElementById('toast');
  const currentVideoSection = document.querySelector('.current-video-section');
  const savedBookmarksHeading = document.getElementById('saved-bookmarks-heading');
  const emptyStateContainer = document.querySelector('.saved-bookmarks-section .empty-state');

  // Search input & clear elements
  const searchContainer = document.getElementById('search-container');
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');

  let toastTimeout = null;
  let currentDetectedData = null; // Caches the latest video metadata in the popup
  let currentSearchQuery = ''; // Active normalized search query

  // Wire up search event listeners
  if (searchInput && searchClearBtn) {
    searchInput.addEventListener('input', () => {
      const originalValue = searchInput.value;
      const normalizedQuery = originalValue.trim().toLowerCase();
      currentSearchQuery = normalizedQuery;

      if (originalValue.length > 0) {
        searchClearBtn.classList.remove('hidden');
      } else {
        searchClearBtn.classList.add('hidden');
      }

      // Refresh the saved bookmarks list dynamically using filtered results
      updateSavedBookmarksListState();
    });

    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      currentSearchQuery = '';
      searchClearBtn.classList.add('hidden');
      searchInput.focus();
      updateSavedBookmarksListState();
    });
  }

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

        // Show/hide search bar container based on whether there are saved bookmarks
        if (searchContainer) {
          if (count > 0) {
            searchContainer.classList.remove('hidden');
          } else {
            searchContainer.classList.add('hidden');
            currentSearchQuery = '';
            if (searchInput) searchInput.value = '';
            if (searchClearBtn) searchClearBtn.classList.add('hidden');
          }
        }

        if (count === 0) {
          if (savedBookmarksHeading) {
            savedBookmarksHeading.textContent = `Saved Bookmarks (0)`;
          }
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

        // Filter sorted bookmarks based on current normalized query
        const filteredBookmarks = sortedBookmarks.filter(bookmark => {
          if (!currentSearchQuery) return true;

          const title = (bookmark.title || '').toLowerCase();
          const channel = (bookmark.channel || '').toLowerCase();
          const note = (bookmark.note || '').toLowerCase();
          const videoId = (bookmark.videoId || '').toLowerCase();
          const url = (bookmark.url || '').toLowerCase();

          return title.includes(currentSearchQuery) ||
                 channel.includes(currentSearchQuery) ||
                 note.includes(currentSearchQuery) ||
                 videoId.includes(currentSearchQuery) ||
                 url.includes(currentSearchQuery);
        });

        // Update Section title with count of matching bookmarks
        if (savedBookmarksHeading) {
          savedBookmarksHeading.textContent = `Saved Bookmarks (${filteredBookmarks.length})`;
        }

        if (filteredBookmarks.length === 0) {
          listContainer.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon" aria-hidden="true">🔍</div>
              <h3 class="empty-title">No bookmarks found</h3>
              <p class="empty-text">Try a different search.</p>
            </div>
          `;
          return;
        }

        // Clear loading state
        listContainer.innerHTML = '';

        // Step 3: Dynamically generate clean card nodes for every bookmark securely (textContent)
        filteredBookmarks.forEach((bookmark) => {
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

          const continueBtn = document.createElement('button');
          continueBtn.className = 'continue-watching-btn';
          continueBtn.innerHTML = '▶ Continue Watching';
          continueBtn.title = 'Continue watching from saved position';

          continueBtn.addEventListener('click', async () => {
            console.log("[TubeMark] Continue Watching started");
            console.log("[TubeMark] Bookmark ID:", bookmark.id);
            console.log("[TubeMark] Target URL:", bookmark.url);
            console.log("[TubeMark] Target timestamp:", bookmark.currentTime);

            // 1. Validate YouTube URL
            const isUrlValid = typeof TubeMarkYouTubeUtils !== 'undefined'
              ? TubeMarkYouTubeUtils.isYouTubeVideoPage(bookmark.url)
              : false;

            if (!isUrlValid) {
              console.error("[TubeMark] Invalid YouTube URL:", bookmark.url);
              showToast("Unable to open this video.", true);
              return;
            }

            // 2. Validate saved currentTime
            const currentTime = bookmark.currentTime;
            if (currentTime === undefined || currentTime === null || isNaN(currentTime) || currentTime < 0 || !isFinite(currentTime)) {
              console.error("[TubeMark] Saved playback position is unavailable:", currentTime);
              showToast("Saved playback position is unavailable.", true);
              return;
            }

            // 3. Validate saved duration
            const duration = bookmark.duration;
            if (duration === undefined || duration === null || isNaN(duration) || duration <= 0 || !isFinite(duration)) {
              console.error("[TubeMark] Saved video duration is invalid:", duration);
              showToast("Saved video duration is invalid.", true);
              return;
            }

            // 4. If current time is greater than or equal to duration, show warning or handle it gracefully
            if (currentTime >= duration) {
              console.warn("[TubeMark] Saved playback position is at or beyond duration.");
            }

            // 5. Open YouTube video in active:false state to keep popup context alive for communication
            console.log("[TubeMark] Opening YouTube tab");
            if (typeof chrome !== 'undefined' && chrome.tabs) {
              chrome.tabs.create({ url: bookmark.url, active: false }, (tab) => {
                if (chrome.runtime.lastError || !tab || !tab.id) {
                  console.error("[TubeMark] Failed to open new tab:", chrome.runtime.lastError ? chrome.runtime.lastError.message : "No tab info");
                  showToast("Unable to open this video.", true);
                  return;
                }

                const tabId = tab.id;
                let attempts = 0;
                const maxAttempts = 20; // 10 seconds timeout

                showToast("▶ Loading video player...");

                const intervalId = setInterval(() => {
                  attempts++;
                  console.log(`[TubeMark] Waiting for content script (Attempt ${attempts}/${maxAttempts})`);

                  chrome.tabs.sendMessage(tabId, { action: "ping" }, (res) => {
                    if (chrome.runtime.lastError) {
                      // Tab might still be loading, ignore runtime error during polling
                      if (attempts >= maxAttempts) {
                        clearInterval(intervalId);
                        console.error("[TubeMark] Content script unavailable.");
                        showToast("Unable to resume this video. Please refresh YouTube and try again.", true);
                        // Make tab active anyway so they can see the page
                        chrome.tabs.update(tabId, { active: true });
                      }
                      return;
                    }

                    if (res && res.success) {
                      clearInterval(intervalId);
                      console.log("[TubeMark] Content script is responsive! Sending seek request...");

                      // Format human-readable target position
                      const formatSecs = (seconds) => {
                        const mins = Math.floor(seconds / 60);
                        const secs = Math.floor(seconds % 60);
                        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                      };

                      showToast(`▶ Resuming from ${formatSecs(currentTime)}`);

                      chrome.tabs.sendMessage(tabId, { action: "SEEK_TO_TIMESTAMP", timestamp: currentTime }, (seekRes) => {
                        // Focus/activate the tab now so the user can watch it!
                        chrome.tabs.update(tabId, { active: true });

                        if (chrome.runtime.lastError) {
                          console.error("[TubeMark] Seek message failed:", chrome.runtime.lastError.message);
                        } else if (seekRes && seekRes.success) {
                          console.log("[TubeMark] Seek successful");
                        } else {
                          const errorType = seekRes ? seekRes.error : "unknown";
                          console.error("[TubeMark] Seek failed inside content script:", errorType);
                          if (errorType === "video_not_found") {
                            showToast("Unable to find the video player.", true);
                          } else if (errorType === "invalid_duration") {
                            showToast("Saved video duration is invalid.", true);
                          } else {
                            showToast("Unable to resume from the saved position.", true);
                          }
                        }
                      });
                    } else {
                      if (attempts >= maxAttempts) {
                        clearInterval(intervalId);
                        console.error("[TubeMark] Content script ping response invalid.");
                        showToast("Unable to resume this video. Please refresh YouTube and try again.", true);
                        chrome.tabs.update(tabId, { active: true });
                      }
                    }
                  });
                }, 500);
              });
            } else {
              console.error("[TubeMark] chrome.tabs API not available.");
              showToast("Unable to open this video.", true);
            }
          });

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

          // Phase 11 Edit/Add Note Button
          const editBtn = document.createElement('button');
          editBtn.className = 'edit-note-btn';
          editBtn.textContent = (bookmark.note && bookmark.note.trim() !== '') ? 'Edit Note' : 'Add Note';
          editBtn.title = (bookmark.note && bookmark.note.trim() !== '') ? 'Edit this bookmark\'s note' : 'Add a note to this bookmark';

          // Phase 7 Delete Button
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'delete-bookmark-btn';
          deleteBtn.textContent = 'Delete';
          deleteBtn.title = 'Delete this video bookmark';

          actionGroupDiv.appendChild(continueBtn);
          actionGroupDiv.appendChild(openBtn);
          actionGroupDiv.appendChild(editBtn);
          actionGroupDiv.appendChild(deleteBtn);

          footerRowDiv.appendChild(dateSpan);
          footerRowDiv.appendChild(actionGroupDiv);
          cardDiv.appendChild(footerRowDiv);

          // Inline Confirmation Box (initially not attached)
          let confirmBoxDiv = null;
          let editContainerDiv = null;

          // Wire up Edit Button trigger
          editBtn.addEventListener('click', () => {
            if (editContainerDiv) return;
            if (confirmBoxDiv) return;

            // Hide normal footer row, progress container, and existing note box for editing mode
            footerRowDiv.style.display = 'none';
            const progressContainer = cardDiv.querySelector('.bookmark-progress-container');
            if (progressContainer) progressContainer.style.display = 'none';
            const existingNoteBox = cardDiv.querySelector('.bookmark-note-box');
            if (existingNoteBox) existingNoteBox.style.display = 'none';

            // Create inline edit form container
            editContainerDiv = document.createElement('div');
            editContainerDiv.className = 'bookmark-edit-container';

            const editHeader = document.createElement('div');
            editHeader.className = 'bookmark-edit-header';

            const editLabel = document.createElement('span');
            editLabel.className = 'bookmark-edit-label';
            editLabel.textContent = 'NOTE';

            const editCharCounter = document.createElement('span');
            editCharCounter.className = 'bookmark-edit-char-counter';
            const initialLen = bookmark.note ? bookmark.note.length : 0;
            editCharCounter.textContent = `${initialLen} / 500`;

            editHeader.appendChild(editLabel);
            editHeader.appendChild(editCharCounter);
            editContainerDiv.appendChild(editHeader);

            const editTextarea = document.createElement('textarea');
            editTextarea.className = 'bookmark-edit-textarea';
            editTextarea.placeholder = 'Write your note...';
            editTextarea.value = bookmark.note || '';
            editTextarea.rows = 3;
            editTextarea.setAttribute('aria-label', 'Edit bookmark note');

            function updateEditCharCounter() {
              const len = editTextarea.value.length;
              editCharCounter.textContent = `${len} / 500`;
              if (len >= 500) {
                editCharCounter.classList.add('limit-reached');
              } else {
                editCharCounter.classList.remove('limit-reached');
              }
            }

            editTextarea.addEventListener('input', () => {
              if (editTextarea.value.length > 500) {
                editTextarea.value = editTextarea.value.slice(0, 500);
              }
              updateEditCharCounter();
            });

            editTextarea.addEventListener('paste', () => {
              setTimeout(() => {
                if (editTextarea.value.length > 500) {
                  editTextarea.value = editTextarea.value.slice(0, 500);
                }
                updateEditCharCounter();
              }, 0);
            });

            editContainerDiv.appendChild(editTextarea);

            const editActions = document.createElement('div');
            editActions.className = 'bookmark-edit-actions';

            const cancelEditBtn = document.createElement('button');
            cancelEditBtn.className = 'bookmark-edit-cancel-btn';
            cancelEditBtn.textContent = 'Cancel';
            cancelEditBtn.type = 'button';

            const saveEditBtn = document.createElement('button');
            saveEditBtn.className = 'bookmark-edit-save-btn';
            saveEditBtn.textContent = 'Save';
            saveEditBtn.type = 'button';

            editActions.appendChild(cancelEditBtn);
            editActions.appendChild(saveEditBtn);
            editContainerDiv.appendChild(editActions);

            cardDiv.appendChild(editContainerDiv);

            // Set focus and cursor position at the end of the input
            editTextarea.focus();
            editTextarea.setSelectionRange(editTextarea.value.length, editTextarea.value.length);

            // Wire up Cancel button inside Edit Form
            cancelEditBtn.addEventListener('click', () => {
              editContainerDiv.remove();
              editContainerDiv = null;

              footerRowDiv.style.display = 'flex';
              if (progressContainer) progressContainer.style.display = 'flex';
              if (existingNoteBox) existingNoteBox.style.display = 'block';
            });

            // Wire up Save button inside Edit Form
            saveEditBtn.addEventListener('click', async () => {
              const updatedNote = editTextarea.value.trim();

              try {
                if (typeof TubeMarkStorage !== 'undefined' && typeof TubeMarkStorage.updateBookmarkNote === 'function') {
                  const success = await TubeMarkStorage.updateBookmarkNote(bookmark.id, updatedNote);
                  if (success) {
                    showToast('✓ Note updated');

                    editContainerDiv.remove();
                    editContainerDiv = null;

                    await updateSavedBookmarksListState();
                  } else {
                    console.error("[TubeMark] Note update failed: storage layer returned false.");
                    showToast('Unable to update note. Please try again.', true);
                  }
                } else {
                  showToast('Storage module not loaded.', true);
                }
              } catch (err) {
                console.error("[TubeMark] Note update failed:", err);
                showToast('Unable to update note. Please try again.', true);
              }
            });
          });

          deleteBtn.addEventListener('click', () => {
            // If already confirming or editing, do nothing
            if (confirmBoxDiv) return;
            if (editContainerDiv) return;

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
  const toggleNoteBtn = document.getElementById('toggle-note-btn');
  const noteContainer = document.querySelector('.note-container');
  const MAX_CHAR_LIMIT = 500;

  // Helper function to handle expand/collapse behavior of the note section
  function setNoteExpanded(expanded, shouldFocus = false) {
    if (!toggleNoteBtn || !noteContainer) return;
    if (expanded) {
      noteContainer.classList.remove('collapsed');
      toggleNoteBtn.textContent = '− Hide note';
      toggleNoteBtn.setAttribute('aria-expanded', 'true');
      if (shouldFocus && noteTextarea) {
        noteTextarea.focus();
      }
    } else {
      noteContainer.classList.add('collapsed');
      toggleNoteBtn.textContent = '+ Add a note';
      toggleNoteBtn.setAttribute('aria-expanded', 'false');
    }
  }

  if (toggleNoteBtn) {
    toggleNoteBtn.addEventListener('click', () => {
      const isExpanded = toggleNoteBtn.getAttribute('aria-expanded') === 'true';
      setNoteExpanded(!isExpanded, true);
    });
  }

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
            if (existingBookmark.note && existingBookmark.note.trim() !== '') {
              setNoteExpanded(true, false);
            } else {
              setNoteExpanded(false, false);
            }
          }
        } else {
          saveBtn.innerHTML = '<span>🔖</span> Save Bookmark';
          saveBtn.className = 'save-btn';
          saveBtn.title = 'Save current video bookmark';

          if (noteTextarea) {
            noteTextarea.value = '';
            updateCharCounter();
            setNoteExpanded(false, false);
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
