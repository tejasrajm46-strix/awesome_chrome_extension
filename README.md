# ✨ Premium New Tab Dashboard

> **Turn every new tab into your personal productivity workspace.**

A beautiful, modern **Chrome/Edge New Tab extension** built with a sleek **glassmorphism design**, customizable backgrounds, powerful productivity widgets, and a fully personalized dashboard.

Transform your empty new-tab page into a place where you can **search, organize, plan, take notes, manage tasks, check your calendar, set reminders, and access your bookmarks** — all from one elegant interface.

---

## 🌌 Features

### 🎨 Beautiful & Customizable

* **Full-screen Backgrounds** — Upload JPG, PNG, WebP images or MP4/WEBM videos
* **Glassmorphism UI** — Modern translucent interface with smooth visual effects
* **Themes** — Choose between Light, Dark, and Glass modes
* **Accent Colors** — 8 customizable accent colors
* **Widget Visibility** — Show or hide individual widgets
* **Responsive Layout** — Designed to adapt to different screen sizes

### 🕐 Smart Clock

* 12-hour and 24-hour formats
* Live clock updates
* Automatic greetings based on the time of day:

  * 🌅 Good Morning
  * ☀️ Good Afternoon
  * 🌇 Good Evening
  * 🌙 Good Night

### 🔎 Powerful Search

Search the web directly from your new tab using:

* Google
* Bing
* DuckDuckGo
* Brave

Includes search suggestions for a faster browsing experience.

### 🔖 Smart Bookmarks

Keep your favorite websites right on your dashboard.

* Add bookmarks
* Edit bookmarks
* Delete bookmarks
* Drag-and-drop reordering
* Automatic website favicons
* Quick access to frequently used websites

### 📅 Interactive Calendar

Stay organized with an integrated monthly calendar.

* Monthly view
* Navigate between months
* Highlight today's date
* Quick visual overview of your schedule

### ✅ To-Do List

Manage your daily tasks without leaving your new tab.

* Create tasks
* Mark tasks as completed
* Delete tasks
* Keep your daily workflow organized

### 📝 Quick Notes

A lightweight notepad for capturing ideas instantly.

* Auto-saving
* Character counter
* Persistent local storage
* No separate application required

### ⏰ Reminders

Never forget an important task.

* Create date/time reminders
* Browser notification support
* Manage scheduled reminders
* Receive alerts directly from the browser

### 🕘 Recently Visited

Quickly access websites you've recently visited using Chrome's history integration.

### 🍅 Pomodoro Timer

Stay focused with a built-in Pomodoro timer designed for productive work sessions and focused study.

### 🧩 Customizable Dashboard

Make the dashboard fit your workflow.

* Show/hide widgets
* Rearrange dashboard elements
* Resize supported components
* Personalize the overall workspace

### 🚀 Onboarding

A first-launch setup experience helps configure the dashboard before you start using it.

### 💾 Offline-Friendly

Local productivity features continue to work without an internet connection.

Your dashboard data and settings are stored locally in the browser.

---

# 📸 Dashboard

The extension transforms your new-tab page into a personalized workspace containing your most important tools in one place.

**Search • Bookmarks • Calendar • Tasks • Notes • Reminders • Pomodoro • History**

> **One tab. Everything you need.**

---

# 🛠️ Installation

## Option 1 — Load Unpacked

1. Download or clone this repository.
2. Open Chrome and navigate to:

```text
chrome://extensions
```

For Microsoft Edge:

```text
edge://extensions
```

3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extension folder:

```text
my-extensio-2
```

6. Open a new browser tab and enjoy your new dashboard.

---

## 📦 Installing From a Packaged Release

If you download a packaged ZIP from a GitHub Release:

1. Download the ZIP.
2. Extract the ZIP to a folder.
3. Open `chrome://extensions` or `edge://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the extracted extension folder.

> ⚠️ **Important:** Do not include, publish, or share the `.pem` signing key.

---

# 🔐 Permissions

The extension uses only the permissions required for its functionality.

| Permission      | Purpose                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| `storage`       | Save settings, preferences, bookmarks, tasks, notes, and other local data |
| `history`       | Display recently visited pages                                            |
| `notifications` | Send reminder notifications                                               |

The extension is designed around a **local-first architecture**, minimizing the need for external services.

---

# 📁 Project Structure

```text
my-extensio-2/
│
├── manifest.json
├── newtab.html
│
├── css/
│   └── style.css
│
├── js/
│   ├── app.js          # Main application orchestrator
│   ├── layout.js       # Widget layout and resizing
│   ├── pomodoro.js     # Pomodoro timer
│   ├── background.js   # Background image/video + storage
│   ├── clock.js        # Clock and greeting
│   ├── search.js       # Multi-engine search
│   ├── bookmarks.js    # Bookmarks + drag-and-drop
│   ├── calendar.js     # Monthly calendar
│   ├── todo.js         # Task manager
│   ├── notes.js        # Notepad
│   ├── reminders.js    # Reminders + notifications
│   ├── history.js      # Recently visited pages
│   └── settings.js     # Settings panel
│
├── assets/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
│
└── README.md
```

---

# 🎥 Video Background

One of the key features of the dashboard is support for **custom video backgrounds**.

Because browser `localStorage` is not suitable for storing large binary files, video backgrounds are stored using **IndexedDB**.

### How it works

```text
User selects video
       ↓
Video stored in IndexedDB
       ↓
Blob retrieved when dashboard loads
       ↓
Object URL created
       ↓
Video displayed as background
       ↓
Autoplay + Muted + Loop
```

Videos can be stored locally and played directly in the new-tab dashboard without requiring a backend server.

> **Recommended maximum video size: ~50 MB**

Supported formats include:

* MP4
* WEBM

---

# 💾 Local-First Architecture

The extension is designed to keep the core experience local.

```text
                    ┌──────────────────────┐
                    │   New Tab Dashboard  │
                    └──────────┬───────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ↓                    ↓                    ↓
      LocalStorage          IndexedDB         Chrome APIs
          │                    │                    │
          ↓                    ↓                    ↓
     Preferences          Video Files       History / Alerts
     Tasks / Notes
     Bookmarks
     Settings
```

This allows the dashboard to remain lightweight and minimizes dependency on external servers.

---

# ⚡ Core Technologies

Built using standard web technologies and browser APIs:

* **HTML5**
* **CSS3**
* **JavaScript**
* **Chrome Extension APIs**
* **Chrome History API**
* **Chrome Notifications API**
* **Chrome Storage API**
* **IndexedDB**
* **Local Storage**

No traditional backend is required for the core dashboard.

---

# 🎯 Designed For

Whether you're:

* 👨‍💻 Coding
* 📚 Studying
* 💼 Working
* 📝 Taking notes
* ✅ Managing tasks
* 📅 Planning your day
* 🔎 Browsing the web
* 🎯 Working through focused sessions

your new tab becomes a **personal command center**.

---

# 🌟 Vision

Most new-tab pages are simply empty spaces.

**Premium New Tab Dashboard** turns that space into something useful.

> ### **Your browser. Your workspace. Your new tab.**

The goal is to create a new-tab experience that combines **beauty, productivity, customization, and simplicity** without overwhelming the user.

---

# 🚀 Future Improvements

Possible future enhancements include:

* ☁️ Optional cloud synchronization
* 📊 Productivity statistics
* 🎵 Background music controls
* 🌤️ Weather widget
* 📌 More dashboard layouts
* 🔗 Additional search engines
* 📱 Improved responsive/mobile experience
* 🎨 More customization options
* 🔄 Backup and restore settings
* 🧩 Additional productivity widgets

---

# ❤️ Contributing

Contributions, ideas, bug reports, and feature suggestions are welcome.

If you have an idea that could make the dashboard better, feel free to open an issue or submit a pull request.

---

# ⭐ Support the Project

If you find **Premium New Tab Dashboard** useful:

⭐ Star the repository
🐛 Report bugs
💡 Suggest features
🔀 Submit improvements

Every contribution helps make the project better.

---

## ✨ Premium New Tab Dashboard

**Search. Organize. Plan. Focus. Create.**

### 🌌 Make every new tab count.
