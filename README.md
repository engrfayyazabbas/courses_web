# 📚 Course Library Web App

A static frontend web application ("CourseLib") designed for browsing a local library of courses, searching files, and tracking your learning progress.

## 📖 Overview

The Course Library Web App is a client-side only interface. It relies on a pre-generated `data.json` file to understand the hierarchical structure of course folders and files. The app dynamically builds a file explorer and tracks a user's completion progress across the library.

### ✨ Key Features
- **Folder Navigation:** Browse through nested course directories via the sidebar tree.
- **Progress Tracking:** Mark individual files as "Completed." Progress dynamically rolls up to the folder and overall library level, visualized with rich progress bars and rings.
- **Fast Client-Side Search:** Quickly filter and find courses and files in the library.
- **Folder Pinning:** Pin specific folders to the top of the sidebar for immediate access across sessions.
- **Seamless Resuming:** The application remembers the last folder you were viewing, presenting a distinct "Resume" banner when you return.

## 🛠 Tech Stack

- **HTML5:** Interface layout (`index.html`)
- **Vanilla CSS:** Custom styling, themes, and responsive design (`style.css`)
- **Vanilla JavaScript:** Core logic, Tree rendering, and Local Storage management (`app.js`)
- **JSON:** External data source schema (`data.json`)

## 🧱 Architecture & Data Flow

1. **Backend / Data Generation (External):** A separate Python script (e.g., `scanner.py`) scans a local directory of course files and generates the `data.json` file.
2. **Frontend:** The web application (`app.js`) fetches `data.json` on initialization and uses the nested hierarchy to render the application dynamically. Note: There is no backend runtime needed for the frontend app.

## 🗃 Storage & Persistence

The application relies entirely on browser `localStorage` for persisting user state. Nothing is sent to a server.
- `courselib_progress`: Map of completed file IDs.
- `courselib_last_path`: Tracks the last visited path to populate the "Resume where you left off" feature.
- `courselib_sidebar`: Sidebar visibility state (open/closed).
- `courselib_pins`: Set of pinned folder paths.

## 🚀 Run Locally

Because the application fetches external data (`data.json`) via `fetch()`, it requires a local web server to bypass CORS restrictions.

1. Ensure `data.json` is generated and located in the application root directory.
2. Serve the folder using a local web server, for example, Python:
   ```bash
   python -m http.server 8080
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

## 📁 Project Files

- `index.html`: Main layout structure, including the header, sidebar, search overlay, and main content area.
- `app.js`: Core bootstrapping logic. Handles fetching `data.json`, rendering the nested folder tree, handling client-side search, managing state updates, and interacting with `localStorage`.
- `style.css`: All themes, responsiveness, and component designs (badges, progress rings, cards).
- `data.json`: The generated course library data schema. Expected to include fields like `root_name`, `total_files`, `total_folders`, and a nested `tree`. *(Do not edit manually)*.
- `context.md`: Additional architectural breakdown notes.

## ⚠️ Notes

- If `data.json` is missing or invalid, the app gracefully fallback and shows an error hinting to re-run the scanner and startup a local server.
