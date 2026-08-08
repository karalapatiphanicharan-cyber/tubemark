// TubeMark Popup Script - Phase 2 YouTube Video Detection & Popup UI State Handling

document.addEventListener('DOMContentLoaded', async () => {
  const saveBtn = document.getElementById('save-bookmark-btn');
  const toast = document.getElementById('toast');
  const currentVideoSection = document.querySelector('.current-video-section');
  let toastTimeout = null;

  // Initialize Save Bookmark button Coming Soon Toast
  if (saveBtn && toast) {
    saveBtn.addEventListener('click', () => {
      if (toastTimeout) {
        clearTimeout(toastTimeout);
      }
      toast.textContent = 'Coming in the next phase!';
      toast.classList.remove('hidden');
      toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
      }, 2500);
    });
  }

  /**
   * Updates the UI to a specific state:
   * 'loading', 'detected', 'not-detected', 'error'
   */
  function setUIState(state, data = {}) {
    // We clean or update classes in current-video-section to style individual states properly
    if (!currentVideoSection) return;

    // Reset layout
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
      const thumbnailSvg = card.querySelector('.thumbnail-svg');
      const thumbnailPlaceholder = card.querySelector('.thumbnail-placeholder');

      if (titleElem) {
        titleElem.textContent = data.title || 'Unknown Title';
        titleElem.title = data.title || '';
      }
      if (channelElem) {
        channelElem.textContent = data.channel || 'Unknown Channel';
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

        // Hide the dummy SVG
        if (thumbnailSvg) {
          thumbnailSvg.style.display = 'none';
        }
      }
    }
  }

  // Detect and retrieve current YouTube tab details
  try {
    setUIState('loading');

    // Make sure chrome APIs exist (handles non-extension environment tests gracefully)
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      console.warn('Chrome API not found. Showing not-detected state.');
      setUIState('not-detected');
      return;
    }

    const [activeTab] = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });

    if (!activeTab || !activeTab.url) {
      setUIState('not-detected');
      return;
    }

    // Reference utility loaded in popup.html globally
    const isVideo = typeof TubeMarkYouTubeUtils !== 'undefined'
      ? TubeMarkYouTubeUtils.isYouTubeVideoPage(activeTab.url)
      : false;

    if (!isVideo) {
      setUIState('not-detected');
      return;
    }

    // Attempt to communicate with the content script
    try {
      // Use short promise with a timeout to handle un-injected/loading tabs gracefully
      const response = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Content script communication timed out.'));
        }, 1500);

        chrome.tabs.sendMessage(activeTab.id, { action: 'getVideoInfo' }, (res) => {
          clearTimeout(timeoutId);
          // Handle chrome runtime lastError (e.g. content script not ready or doesn't exist)
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(res);
          }
        });
      });

      if (response && response.success && response.data) {
        setUIState('detected', response.data);
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
