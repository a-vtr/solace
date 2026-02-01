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
