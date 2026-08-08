/**
 * TubeMark Content Script - YouTube Video Detection & Scraping
 *
 * Safely extracts video metadata directly from the page DOM when requested.
 */

(() => {
  // Prevent duplicate initialization
  if (window.hasTubeMarkLoaded) {
    console.log("[TubeMark] YouTube content script already loaded on:", window.location.href);
    return;
  }
  window.hasTubeMarkLoaded = true;

  console.log("[TubeMark] YouTube content script loaded");
  console.log("[TubeMark] URL:", window.location.href);

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
      const urlObj = new URL(window.location.href);
      if (urlObj.hostname.includes('youtube.com')) {
        if (urlObj.pathname === '/watch') {
          videoId = urlObj.searchParams.get('v');
        } else if (urlObj.pathname.startsWith('/embed/')) {
          videoId = urlObj.pathname.split('/')[2];
        } else if (urlObj.pathname.startsWith('/shorts/')) {
          videoId = urlObj.pathname.split('/')[2];
        }
      } else if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.substring(1).split('?')[0];
      }
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

  /**
   * Show a subtle, beautiful toast on the YouTube page itself
   */
  function showPageToast(message, isError = false) {
    const existing = document.getElementById("tubemark-page-toast");
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement("div");
    toast.id = "tubemark-page-toast";
    toast.textContent = message;

    // Premium styling matching YouTube theme
    toast.style.position = "fixed";
    toast.style.bottom = "24px";
    toast.style.left = "24px";
    toast.style.zIndex = "999999";
    toast.style.backgroundColor = isError ? "#cc0000" : "#0f0f0f";
    toast.style.color = "#ffffff";
    toast.style.padding = "10px 16px";
    toast.style.borderRadius = "4px";
    toast.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    toast.style.fontSize = "13px";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 4px 16px rgba(0,0,0,0.6)";
    toast.style.borderLeft = isError ? "4px solid #ff4d4d" : "4px solid #ff0000";
    toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.pointerEvents = "none";

    document.body.appendChild(toast);

    // Animate in
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    // Fade out and remove after 3 seconds
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds === null) return "00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const pad = (num) => String(num).padStart(2, '0');

    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  function performSeek(timestamp, sendResponse) {
    const maxAttempts = 20; // 10 seconds timeout (20 * 500ms)
    let attempts = 0;

    const findAndSeek = () => {
      attempts++;
      const videoSelectors = [
        'ytd-player video',
        '#movie_player video',
        '.html5-main-video',
        'video'
      ];

      let video = null;
      for (const selector of videoSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          video = el;
          break;
        }
      }

      if (!video) {
        if (attempts >= maxAttempts) {
          console.error("[TubeMark] Video player not found after 10s.");
          showPageToast("Unable to find the video player.", true);
          sendResponse({ success: false, error: "video_not_found", errorType: "error_video_not_found" });
          return;
        }
        setTimeout(findAndSeek, 500);
        return;
      }

      console.log("[TubeMark] Video player element found:", video);

      // Check if video is loaded and ready
      if (video.readyState < 1 && isNaN(video.duration)) {
        console.log("[TubeMark] Waiting for loadedmetadata event...");
        const onMetadata = () => {
          video.removeEventListener('loadedmetadata', onMetadata);
          doActualSeek(video, timestamp, sendResponse);
        };
        video.addEventListener('loadedmetadata', onMetadata);

        // Fallback timeout in case event doesn't fire but duration becomes available
        setTimeout(() => {
          video.removeEventListener('loadedmetadata', onMetadata);
          if (video.readyState >= 1 || !isNaN(video.duration)) {
            doActualSeek(video, timestamp, sendResponse);
          } else {
            console.error("[TubeMark] Video metadata timeout.");
            showPageToast("Unable to resume from the saved position.", true);
            sendResponse({ success: false, error: "metadata_timeout", errorType: "error_metadata_timeout" });
          }
        }, 5000);
      } else {
        doActualSeek(video, timestamp, sendResponse);
      }
    };

    findAndSeek();
  }

  function doActualSeek(video, timestamp, sendResponse) {
    try {
      const duration = video.duration;
      if (isNaN(duration) || duration <= 0) {
        console.error("[TubeMark] Video duration is invalid:", duration);
        showPageToast("Saved video duration is invalid.", true);
        sendResponse({ success: false, error: "invalid_duration", errorType: "error_invalid_duration" });
        return;
      }

      // Clamp target time slightly before the end of the video
      const targetTime = Math.min(timestamp, Math.max(0, duration - 0.5));
      console.log(`[TubeMark] Seeking to ${targetTime}s (target: ${timestamp}s, duration: ${duration}s)`);

      video.currentTime = targetTime;

      showPageToast(`▶ Resuming from ${formatTime(targetTime)}`, false);
      sendResponse({ success: true });
    } catch (err) {
      console.error("[TubeMark] Seek operation error:", err);
      showPageToast("Unable to resume from the saved position.", true);
      sendResponse({ success: false, error: err.message, errorType: "error_seek" });
    }
  }

  // Set up message listener for on-demand requests from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ success: true, message: "TubeMark content script is active" });
    } else if (request.action === 'getVideoInfo') {
      try {
        const metadata = extractVideoMetadata();
        sendResponse({ success: true, data: metadata });
      } catch (error) {
        console.error('TubeMark: Error extracting video metadata:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else if (request.action === 'SEEK_TO_TIMESTAMP') {
      try {
        console.log("[TubeMark] SEEK_TO_TIMESTAMP received, target timestamp:", request.timestamp);
        performSeek(request.timestamp, sendResponse);
      } catch (error) {
        console.error('TubeMark: Error during seek:', error);
        sendResponse({ success: false, error: error.message, errorType: "error_seek" });
      }
      return true; // Keep message port open for asynchronous response
    }
    return true;
  });
})();
