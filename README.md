# 🎬 TubeMark

### Save YouTube videos. Remember where you stopped. Come back anytime.

TubeMark is a lightweight Chrome extension that helps you save YouTube videos with their playback progress and personal notes.

Instead of bookmarking a YouTube URL and forgetting why you saved it, TubeMark remembers the video, where you stopped watching, and what you wanted to remember about it.

> **Built by Phani Charan**

---

## ✨ Features

### 🔖 Smart YouTube Bookmarking

Save the YouTube video you are currently watching with a single click.

TubeMark stores important information about the video, including:

- Video title
- YouTube channel
- Video ID
- Video URL
- Thumbnail
- Current playback position
- Video duration
- Personal note
- Saved timestamp

---

### ▶️ Continue Watching

Don't remember where you stopped?

TubeMark remembers your playback position.

For example:

```text
05:00 / 12:31
40% watched
```

Click **Continue Watching** and TubeMark opens the video and attempts to resume from your saved position.

---

### 📝 Personal Notes

Add a custom note explaining why you saved a video.

Examples:

```text
Important section about Java Collections.
```

```text
Watch this before the DSA interview.
```

```text
Good explanation of React hooks.
```

Notes support up to **500 characters**.

---

### 📂 Collapsible Notes

Keep the popup clean and compact.

The note editor can be expanded when you want to write something and collapsed when you don't.

Existing note content is preserved when the editor is collapsed.

---

### 🔎 Search Your Bookmarks

Search through your saved videos instantly.

TubeMark searches across:

- Video title
- Channel name
- Personal notes
- Video ID
- Video URL

Search is:

- Case-insensitive
- Partial-match based
- Real-time
- Fully local

Example:

```text
Search: collections
```

TubeMark can find a video even when `collections` only appears inside your personal note.

---

### ✏️ Edit Notes

Already saved a video but want to change your note?

Edit the existing note without creating a duplicate bookmark.

Only the note is updated while the rest of the bookmark remains unchanged.

---

### 🗑️ Delete Bookmarks

Remove individual bookmarks whenever you no longer need them.

TubeMark uses the bookmark's unique ID to safely remove the correct saved video.

---

### ⚙️ Settings

TubeMark includes a dedicated settings view with:

#### Data Management

- Export bookmarks
- Import bookmarks
- Clear all bookmarks

#### Storage Information

- Saved bookmark count
- Local browser storage information

#### About

- Extension information
- Version
- GitHub repository

---

### 💾 Local Storage

TubeMark stores bookmark data locally using:

```text
chrome.storage.local
```

Your saved bookmarks are available without requiring an external backend.

---

## 🧠 How TubeMark Works

The basic flow is:

```text
          YouTube Video
                │
                ▼
       ┌─────────────────┐
       │ YouTube Content │
       │     Script      │
       └────────┬────────┘
                │
                │ Video information
                ▼
       ┌─────────────────┐
       │     Popup UI    │
       └────────┬────────┘
                │
                │ Save Bookmark
                ▼
       ┌─────────────────┐
       │ Chrome Storage  │
       │     Local       │
       └────────┬────────┘
                │
                ▼
       ┌─────────────────┐
       │ Saved Bookmarks │
       └────────┬────────┘
                │
       ┌────────┼───────────┐
       ▼        ▼           ▼
    Search   Continue     Edit
             Watching      Note
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **JavaScript** | Extension logic |
| **HTML5** | Popup structure |
| **CSS3** | UI and styling |
| **Chrome Extension API** | Browser integration |
| **Manifest V3** | Extension architecture |
| **Chrome Storage API** | Local bookmark persistence |
| **YouTube DOM / HTML5 Video API** | Video detection and playback position |
| **Git & GitHub** | Version control |

---

## 📁 Project Structure

```text
tubemark/
│
├── assets/
│   └── screenshots/
│
├── background/
│   └── service-worker.js
│
├── content/
│   ├── youtube.js
│   └── youtube.css
│
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
│
├── storage/
│   └── storage.js
│
├── utils/
│   └── time.js
│
├── manifest.json
└── README.md
```

---

## 🚀 Installation

TubeMark can currently be installed locally as an unpacked Chrome extension.

### 1. Clone the repository

```bash
git clone https://github.com/karalapatiphanicharan-cyber/tubemark.git
```

### 2. Open the project

```bash
cd tubemark
```

### 3. Open Chrome Extensions

Go to:

```text
chrome://extensions
```

### 4. Enable Developer Mode

Turn on:

```text
Developer mode
```

### 5. Load TubeMark

Click:

```text
Load unpacked
```

Select the cloned `tubemark` folder.

### 6. Open YouTube

Go to YouTube and open any video.

Click the TubeMark extension icon to start saving videos.

---

## 🔄 Development Workflow

TubeMark is developed as a local unpacked Chrome extension.

---

## 🧪 Testing

TubeMark is tested against common extension workflows including:

### Bookmarking

- Save a YouTube video
- Prevent duplicate bookmarks
- Persist bookmarks after extension reload

### Playback

- Store current playback position
- Continue watching from saved position
- Handle YouTube navigation

### Notes

- Create notes
- Edit notes
- Cancel note editing
- 500-character limit
- Search notes
- Collapsible note editor

### Search

- Search titles
- Search channels
- Search notes
- Search video IDs
- Search URLs
- Case-insensitive matching
- Partial matching
- Clear search
- Search result counts

### Data Management

- Export bookmarks
- Import bookmarks
- Clear all bookmarks
- Preserve bookmark data

### Extension

- Reload extension
- Reopen popup
- Persist local storage
- Handle errors gracefully

---

## 🔐 Privacy

TubeMark is designed around local browser storage.

Bookmark information is stored using:

```text
chrome.storage.local
```

TubeMark does not require a user account or a dedicated backend server for bookmark storage.

The extension only requests the permissions necessary for its current functionality.

---

## 🧩 Chrome Extension Architecture

TubeMark uses **Manifest V3**.

The extension consists of several main components:

### Popup

Responsible for:

- Current video UI
- Saving bookmarks
- Searching bookmarks
- Editing notes
- Continue Watching
- Settings

### Content Script

Responsible for interacting with YouTube pages and obtaining video-related information.

### Service Worker

Provides the extension's background service-worker context.

### Storage Layer

Handles bookmark persistence through Chrome's storage API.

### Utility Layer

Contains reusable helper functionality such as time formatting.

---

## 🎯 Why I Built TubeMark

TubeMark started as a simple idea:

> **"I found a useful YouTube video, but I don't have time to watch it right now."**

A normal browser bookmark can save the URL, but it doesn't remember:

- Where I stopped
- Why I saved it
- What I wanted to learn
- What part of the video was important

TubeMark solves that problem by combining:

```text
Bookmark
    +
Playback Progress
    +
Personal Notes
    +
Search
    +
Resume
```

into one lightweight browser extension.

---

## 🗺️ Roadmap

Planned improvements include:

- [x] YouTube video detection
- [x] Save bookmarks
- [x] Playback progress
- [x] Continue Watching
- [x] Personal notes
- [x] Collapsible notes
- [x] Search bookmarks
- [x] Edit notes
- [x] Delete bookmarks
- [x] Settings
- [x] Export bookmarks
- [x] Import bookmarks
- [ ] Advanced sorting and filtering
- [ ] Tags and categories
- [ ] Automatic playback progress updates
- [ ] Bookmark statistics
- [ ] Additional UI/UX improvements
- [ ] Chrome Web Store release

---

## 📸 Screenshots

> Screenshots will be added here.

### Main Popup

```text
Coming soon
```

### Saved Bookmarks

```text
Coming soon
```

### Settings

```text
Coming soon
```

---

## 🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

If you find a problem or have an idea for improving TubeMark:

1. Open an issue.
2. Describe the problem or feature clearly.
3. Include steps to reproduce bugs when possible.
4. Submit a pull request if you want to contribute a fix.

---

## 📌 Project Status

**Status:** Active Development

**Version:** 1.0.0

TubeMark is currently being developed and tested as an unpacked Chrome extension.

---

## 👨‍💻 Author

### Phani Charan

Computer Science Engineering student interested in:

- Software Development
- AI / Machine Learning
- Full-Stack Development
- Data Structures & Algorithms
- Developer Tools

### GitHub

[GitHub Profile](https://github.com/karalapatiphanicharan-cyber)

### TubeMark Repository

[View TubeMark on GitHub](https://github.com/karalapatiphanicharan-cyber/tubemark)

---

## ⭐ Support

If you find TubeMark useful, consider giving the repository a ⭐ on GitHub.

It helps support the project and future development.

---

<div align="center">

### 🎬 TubeMark

**Save it. Remember it. Continue it.**

<br>

**Done by Phani Charan**

</div>
