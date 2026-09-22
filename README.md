# Premium New Tab Dashboard

A premium Chrome/Edge new tab extension with glassmorphism design, customizable backgrounds, and productivity widgets.

## Features

- **Full-screen Backgrounds** - Upload JPG/PNG/WebP images or MP4/WEBM videos
- **Clock** - 12/24 hour format with automatic greeting (morning/afternoon/evening/night)
- **Search** - Multi-engine search (Google, Bing, DuckDuckGo, Brave) with suggestions
- **Bookmarks** - Add, edit, delete, drag-and-drop reorder with auto-favicon
- **Calendar** - Monthly calendar with today highlight and navigation
- **To-Do List** - Task management with complete/delete
- **Notes** - Auto-save notepad with character count
- **Reminders** - Date/time reminders with browser notifications
- **Recently Visited** - Chrome history integration
- **Themes** - Light, Dark, and Glass modes
- **Accent Colors** - 8 customizable accent colors
- **Widget Visibility** - Show/hide any widget
- **Onboarding** - First-launch setup flow
- **Offline** - Works without internet for local features

## Installation

1. Open `chrome://extensions` or `edge://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `my-extensio-2` folder

For a packaged download, extract the ZIP attached to the GitHub release and select the extracted folder with **Load unpacked**. Do not include or share the `.pem` signing key.

## Permissions

- `storage` - Save settings and data locally
- `history` - Show recently visited pages
- `notifications` - Reminder alerts

## File Structure

```
my-extensio-2/
├── manifest.json
├── newtab.html
├── css/
│   └── style.css
├── js/
│   ├── app.js          # Main orchestrator
│   ├── layout.js        # Widget layout and resizing
│   ├── pomodoro.js      # Pomodoro timer
│   ├── background.js    # Background image/video + storage
│   ├── clock.js         # Clock and greeting
│   ├── search.js        # Multi-engine search
│   ├── bookmarks.js     # Bookmarks with drag-drop
│   ├── calendar.js      # Monthly calendar
│   ├── todo.js          # Task manager
│   ├── notes.js         # Notepad
│   ├── reminders.js     # Reminders with notifications
│   ├── history.js       # Recently visited
│   └── settings.js      # Settings panel
├── assets/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── README.md
```

## Video Background

Videos are stored in IndexedDB (not localStorage) to handle files up to ~50MB. On load, the blob is converted to an object URL for playback. Videos autoplay muted and loop automatically.
