/**
 * TubeMark Content Script - YouTube Video Detection & Scraping
 *
 * Safely extracts video metadata directly from the page DOM when requested.
 */

(() => {
  // Prevent duplicate initialization
  if (window.hasTubeMarkLoaded) {
    return;
  }
  window.hasTubeMarkLoaded = true;

  console.log('TubeMark YouTube content script initialized for Page & Playback Detection (Phase 3).');

  /**
   * Safe selector retriever to avoid throwing errors on dynamic SPA nodes
   */
  function safeQueryText(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || element.innerText;
        if (text && text.trim()) {
          return text.trim();
        }
      }
    }
    return null;
  }

  /**
   * Scrapes metadata for the current video from the YouTube watch page DOM
   */
  function extractVideoMetadata() {
    // 1. Extract Title
    // YouTube has updated watch page selectors dynamically, so we check a list of common selectors
    const titleSelectors = [
      'ytd-watch-metadata h1.ytd-watch-metadata', // Modern standard
      'h1.title.style-scope.ytd-video-primary-info-renderer', // Legacy desktop
      '#container h1.title', // Fallback container
      'meta[name="title"]', // Meta tags (might not update on SPA navigation immediately, but good backup)
      'title' // Window/tab title
    ];
    let title = safeQueryText(titleSelectors);

    // If using window title fallback, clean up the trailing " - YouTube" part
    if (title && title.endsWith(' - YouTube')) {
      title = title.slice(0, -10);
    }
    if (!title) {
      title = 'Unknown Title';
    }

    // 2. Extract Channel Name
    const channelSelectors = [
      'ytd-watch-metadata #owner #channel-name a', // Modern watch metadata owner link
      'ytd-video-owner-renderer .yt-formatted-string', // Video owner element formatted string
      '#upload-info #channel-name a', // Older layouts
      '#owner-name a', // Miniplayer or other structures
      'meta[itemprop="name"]' // Meta tag for channel name
    ];
    let channel = safeQueryText(channelSelectors);

    // Additional backup check for channels (some might have empty text if a elements are not yet populated)
    if (!channel) {
      const ownerLink = document.querySelector('ytd-video-owner-renderer a');
      if (ownerLink) {
        channel = ownerLink.textContent || ownerLink.innerText;
      }
    }
    if (channel) {
      channel = channel.trim();
    } else {
      channel = 'Unknown Channel';
    }

    // 3. Extract Video ID from current URL
    let videoId = null;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      videoId = urlParams.get('v');
    } catch (e) {
      // ignore
    }

    // 4. Extract Current Playback Position & Duration from the HTML5 video element (Phase 3)
    let currentTime = 0;
    let duration = null;

    try {
      // Query common selectors for the HTML5 video tag on YouTube
      const videoSelectors = [
        'ytd-player video',
        '#movie_player video',
        '.html5-main-video',
        'video'
      ];

      let videoElement = null;
      for (const selector of videoSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          videoElement = el;
          break;
        }
      }

      if (videoElement) {
        currentTime = typeof videoElement.currentTime === 'number' ? videoElement.currentTime : 0;
        duration = typeof videoElement.duration === 'number' && !isNaN(videoElement.duration) ? videoElement.duration : null;
      }
    } catch (err) {
      console.warn('TubeMark: Failed to read from video element:', err);
    }

    return {
      videoId: videoId || '',
      title: title,
      channel: channel,
      url: window.location.href,
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '',
      currentTime: currentTime,
      duration: duration
    };
  }

  // Set up message listener for on-demand requests from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getVideoInfo') {
      try {
        const metadata = extractVideoMetadata();
        sendResponse({ success: true, data: metadata });
      } catch (error) {
        console.error('TubeMark: Error extracting video metadata:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });
})();
