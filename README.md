# Solace Music Player

A private, offline-first music player for your personal collection.

## Project Structure

```
solace-player/
├── index.html           # Main HTML structure
├── style.css           # All styles (complete CSS)
├── main.js             # Entry point and initialization
├── player.js           # Core MusicPlayer class
└── library.js          # StorageManager for IndexedDB
```

## Bug Fixes Applied

### Fixed Issue: jsmediatags Import Error

**Problem:** The original separated code had `import jsmediatags from 'jsmediatags';` in `player.js`, but jsmediatags is loaded as a global variable via CDN in the HTML file, not as an ES module.

**Solution:** Removed the invalid ES6 import statement. The jsmediatags library is available globally as `window.jsmediatags` after being loaded via the CDN script tag in `index.html`.

## File Responsibilities

### index.html
- Semantic HTML markup only
- All IDs and classes preserved exactly as original
- Links to external CSS and JavaScript modules
- Includes jsmediatags library via CDN (loaded as global variable)

### style.css
- Complete styling extracted from original `<style>` tag
- All selectors, values, and rules preserved exactly
- Includes:
  - CSS variables for theming
  - Light/Dark mode styles
  - All component styles
  - Responsive media queries

### library.js
- **StorageManager class**
- Handles all IndexedDB operations
- Methods for albums, tracks, and artwork storage
- Fully exported ES6 module

### player.js
- **MusicPlayer class**
- Core player functionality
- File upload and processing
- Playback controls
- UI rendering and updates
- Metadata extraction using global `jsmediatags` variable
- Theme management
- All methods preserved exactly as original

### main.js
- Application bootstrap
- Initializes MusicPlayer instance
- Entry point for the application

## Running the Project

### Local Development
1. Serve the project directory with any static file server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve
   
   # Using PHP
   php -S localhost:8000
   ```
2. Open `http://localhost:8000` in a modern browser

**Important:** You must serve the files via HTTP/HTTPS. Opening `index.html` directly via `file://` protocol will cause CORS errors with ES6 modules.

### Deployment
1. Deploy the entire directory to any static hosting service
2. No build step required
3. All files are static

## Dependencies

- **jsmediatags** (3.9.5) - Loaded via CDN as global variable for metadata extraction
- No other external dependencies

## Browser Requirements

- Modern browser with ES6 module support
- IndexedDB support
- File API support
- Recommended: Chrome 61+, Firefox 60+, Safari 11+, Edge 16+

## Features

- Offline-first music player
- Supports MP3, M4A, FLAC formats
- IndexedDB for persistent storage
- Album artwork display
- Playlist management
- Shuffle and repeat modes
- Mini player for background playback
- Light/Dark theme toggle
- Keyboard shortcuts

## Keyboard Shortcuts

- **Space** - Play/Pause
- **→** - Next track
- **←** - Previous track
- **S** - Toggle shuffle
- **L** - Toggle loop

## Notes

This is a strict refactor of the original single-file application. All functionality, styling, and behavior has been preserved exactly. The only changes made were:

1. Separating the code into modular files
2. Fixing the jsmediatags import to work with the CDN global variable
3. Maintaining all original functionality without modification
