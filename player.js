/**
 * player.js
 * Core Music Player class for Solace Music Player
 * Handles all player logic, file management, and UI coordination
 */

import { StorageManager } from "./library.js";

export class MusicPlayer {
            constructor() {
                this.audio = new Audio();
                this.tracks = [];
                this.currentTrackIndex = -1;
                this.nextTrackIndex = -1;
                this.isPlaying = false;
                this.isShuffle = false;
                this.isLoop = false;
                this.albumInfo = {};
                this.currentAlbumId = null;
                this.storage = new StorageManager();

                this.init();
            }

            async init() {
                // Initialize IndexedDB
                await this.storage.init();

                // Event listeners
                this.audio.addEventListener('timeupdate', () => this.updateProgress());
                this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
                this.audio.addEventListener('ended', () => this.handleTrackEnd());

                // Control buttons
                document.getElementById('playBtn').addEventListener('click', () => this.togglePlay());
                document.getElementById('nextBtn').addEventListener('click', () => this.playNext());
                document.getElementById('prevBtn').addEventListener('click', () => this.playPrevious());
                document.getElementById('shuffleBtn').addEventListener('click', () => this.toggleShuffle());
                document.getElementById('loopBtn').addEventListener('click', () => this.toggleLoop());

                // Theme toggle
                document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
                document.getElementById('homeThemeToggle').addEventListener('click', () => this.toggleTheme());

                // Back button
                document.getElementById('backButton').addEventListener('click', () => this.showHomeScreen());

                // Mini player controls
                document.getElementById('miniPlayBtn').addEventListener('click', () => this.togglePlay());
                document.getElementById('miniNextBtn').addEventListener('click', () => this.playNext());
                document.getElementById('miniPrevBtn').addEventListener('click', () => this.playPrevious());
                
                const miniProgressBar = document.getElementById('miniProgressBar');
                miniProgressBar.addEventListener('click', (e) => {
                    const rect = miniProgressBar.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const width = rect.width;
                    const percentage = Math.max(0, Math.min(1, clickX / width));
                    this.audio.currentTime = percentage * this.audio.duration;
                });

                // Progress bar with drag support
                const progressBar = document.getElementById('progressBar');
                let isDragging = false;
                
                progressBar.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    this.seek(e);
                });
                
                document.addEventListener('mousemove', (e) => {
                    if (isDragging) {
                        this.seek(e);
                    }
                });
                
                document.addEventListener('mouseup', () => {
                    isDragging = false;
                });
                
                progressBar.addEventListener('click', (e) => this.seek(e));

                // Volume controls
                const volumeTrack = document.getElementById('volumeTrack');
                const volumeFill  = document.getElementById('volumeFill');
                const volumeThumb = document.getElementById('volumeThumb');
                let volDragging = false;

                const setVolume = (pct) => {
                    pct = Math.max(0, Math.min(100, pct));
                    this.audio.volume = pct / 100;
                    volumeFill.style.width  = pct + '%';
                    volumeThumb.style.left  = pct + '%';
                };

                const getVolPct = (e) => {
                    const rect = volumeTrack.getBoundingClientRect();
                    return ((e.clientX - rect.left) / rect.width) * 100;
                };

                volumeThumb.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    volDragging = true;
                });
                volumeTrack.addEventListener('mousedown', (e) => {
                    volDragging = true;
                    setVolume(getVolPct(e));
                });
                document.addEventListener('mousemove', (e) => {
                    if (volDragging) setVolume(getVolPct(e));
                });
                document.addEventListener('mouseup', () => { volDragging = false; });

                // Tracklist toggle
                const tracklistToggle = document.getElementById('tracklistToggle');
                const tracklistBody   = document.getElementById('tracklistBody');
                tracklistToggle.addEventListener('click', () => {
                    const isOpen = tracklistBody.classList.toggle('open');
                    tracklistToggle.classList.toggle('open', isOpen);
                });

                // File inputs
                document.getElementById('homeFileInput').addEventListener('change', (e) => this.handleFileSelect(e));

                // Keyboard shortcuts
                document.addEventListener('keydown', (e) => this.handleKeyboard(e));

                // Load saved session
                this.loadSession();

                // Save session on changes
                window.addEventListener('beforeunload', () => this.saveSession());

                // Check for existing albums
                await this.loadAlbumLibrary();
            }

            validateFileFormat(file) {
                const validExtensions = ['.mp3', '.m4a', '.flac'];
                const validMimeTypes = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/flac'];
                
                const fileName = file.name.toLowerCase();
                const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
                const hasValidMimeType = validMimeTypes.includes(file.type);
                
                return hasValidExtension || hasValidMimeType;
            }

            showFormatWarning(isHomeScreen = false) {
                const warningId = isHomeScreen ? 'formatWarningHome' : 'formatWarning';
                const warning = document.getElementById(warningId);
                warning.style.display = 'block';
                setTimeout(() => {
                    warning.style.display = 'none';
                }, 5000);
            }

            async handleFileSelect(event) {
                const files = Array.from(event.target.files);
                const processedTracks = [];
                let hasInvalidFiles = false;
                
                for (const file of files) {
                    if (!this.validateFileFormat(file)) {
                        hasInvalidFiles = true;
                        continue;
                    }
                    
                    if (file.type.startsWith('audio/')) {
                        const track = await this.extractMetadata(file);
                        processedTracks.push(track);
                    }
                }

                if (hasInvalidFiles) {
                    const isHomeScreen = event.target.id === 'homeFileInput';
                    this.showFormatWarning(isHomeScreen);
                }

                if (processedTracks.length > 0) {
                    // Group by album
                    const albumGroups = this.groupByAlbum(processedTracks);
                    
                    // Save all albums to IndexedDB
                    for (const [albumName, tracks] of Object.entries(albumGroups)) {
                        await this.saveAlbumToStorage(albumName, tracks);
                    }

                    // Load the first album
                    const firstAlbumName = Object.keys(albumGroups)[0];
                    await this.loadAlbumById(this.generateAlbumId(firstAlbumName, albumGroups[firstAlbumName][0].artist));
                    this.showPlayerScreen();
                }

                // Clear input
                event.target.value = '';
            }

            generateAlbumId(albumName, artistName) {
                return `${albumName}-${artistName}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            }

            async saveAlbumToStorage(albumName, tracks) {
                const albumId = this.generateAlbumId(albumName, tracks[0].artist);
                
                // Calculate total size
                let totalSize = 0;
                for (const track of tracks) {
                    totalSize += track.blob.size;
                }
                
                // Add artwork size if present
                if (tracks[0].albumArtBlob) {
                    totalSize += tracks[0].albumArtBlob.size;
                }
                
                // Prepare album metadata
                const albumData = {
                    id: albumId,
                    name: albumName,
                    artist: tracks[0].artist,
                    genre: tracks[0].genre || '—',
                    year: tracks[0].year || '—',
                    trackCount: tracks.length,
                    trackIds: [],
                    size: totalSize
                };

                // Save album artwork
                if (tracks[0].albumArtBlob) {
                    await this.storage.saveArtwork(albumId, tracks[0].albumArtBlob);
                }

                // Save each track
                for (const track of tracks) {
                    const trackId = `${albumId}_track_${track.track || tracks.indexOf(track)}`;
                    albumData.trackIds.push(trackId);
                    
                    await this.storage.saveTrack({
                        id: trackId,
                        albumId: albumId,
                        title: track.title,
                        artist: track.artist,
                        album: track.album,
                        track: track.track,
                        year: track.year,
                        genre: track.genre,
                        duration: track.duration,
                        blob: track.blob
                    });
                }

                // Save album metadata
                await this.storage.saveAlbum(albumData);
            }

            async loadAlbumLibrary() {
                const albums = await this.storage.getAllAlbums();
                const homeAlbumList = document.getElementById('homeAlbumList');
                const homeAlbumItems = document.getElementById('homeAlbumItems');
                
                if (albums.length > 0) {
                    await this.renderHomeAlbumList(albums);
                } else {
                    // No albums - hide the album list
                    homeAlbumList.style.display = 'none';
                    homeAlbumItems.innerHTML = '';
                }
            }

            async renderHomeAlbumList(albums) {
                const homeAlbumList = document.getElementById('homeAlbumList');
                const homeAlbumItems = document.getElementById('homeAlbumItems');
                
                homeAlbumList.style.display = 'block';
                homeAlbumItems.innerHTML = '';

                for (const album of albums) {
                    const albumItem = document.createElement('div');
                    albumItem.className = 'home-album-item';
                    
                    // Calculate size if not already stored
                    let albumSize = album.size;
                    if (!albumSize) {
                        albumSize = await this.calculateAlbumSize(album.id, album.trackIds);
                        // Update the album with the calculated size
                        album.size = albumSize;
                        await this.storage.saveAlbum(album);
                    }
                    
                    // Get artwork
                    const artworkData = await this.storage.getArtwork(album.id);
                    let artworkHTML = '';
                    if (artworkData && artworkData.blob) {
                        const artUrl = URL.createObjectURL(artworkData.blob);
                        artworkHTML = `<img src="${artUrl}" class="home-album-art-small">`;
                    } else {
                        artworkHTML = '<div class="home-album-art-small"></div>';
                    }
                    
                    albumItem.innerHTML = `
                        ${artworkHTML}
                        <div class="home-album-info">
                            <div class="home-album-name">${album.name}</div>
                            <div class="home-album-artist">${album.artist}${albumSize ? ` • ${this.formatBytes(albumSize)}` : ''}</div>
                        </div>
                        <button class="home-album-delete" data-album-id="${album.id}">Delete</button>
                    `;
                    
                    // Click handler for album (not delete button)
                    const albumInfo = albumItem.querySelector('.home-album-info');
                    const albumArt = albumItem.querySelector('.home-album-art-small');
                    
                    const openAlbum = async () => {
                        // Only reload album if it's different from current one
                        if (this.currentAlbumId !== album.id) {
                            await this.loadAlbumById(album.id);
                        }
                        this.showPlayerScreen();
                    };
                    
                    albumInfo.addEventListener('click', openAlbum);
                    albumArt.addEventListener('click', openAlbum);
                    albumInfo.style.cursor = 'pointer';
                    albumArt.style.cursor = 'pointer';
                    
                    // Delete button handler
                    const deleteBtn = albumItem.querySelector('.home-album-delete');
                    deleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        await this.deleteAlbumCompletely(album.id);
                    });
                    
                    homeAlbumItems.appendChild(albumItem);
                }
            }

            async calculateAlbumSize(albumId, trackIds) {
                let totalSize = 0;
                
                // Calculate size of all tracks
                for (const trackId of trackIds) {
                    const trackData = await this.storage.getTrack(trackId);
                    if (trackData && trackData.blob) {
                        totalSize += trackData.blob.size;
                    }
                }
                
                // Add artwork size
                const artworkData = await this.storage.getArtwork(albumId);
                if (artworkData && artworkData.blob) {
                    totalSize += artworkData.blob.size;
                }
                
                return totalSize;
            }

            async deleteAlbumCompletely(albumId) {
                if (!confirm('Are you sure you want to delete this album? This cannot be undone.')) {
                    return;
                }

                try {
                    // Get album data to find all track IDs
                    const albumData = await this.storage.getAlbum(albumId);
                    
                    if (albumData && albumData.trackIds) {
                        // Delete all tracks
                        for (const trackId of albumData.trackIds) {
                            await this.storage.deleteTrack(trackId);
                        }
                    }
                    
                    // Delete artwork
                    await this.storage.deleteArtwork(albumId);
                    
                    // Delete album metadata
                    await this.storage.deleteAlbum(albumId);
                    
                    // If the deleted album is currently playing, stop playback
                    if (this.currentAlbumId === albumId) {
                        this.audio.pause();
                        this.audio.src = '';
                        this.tracks = [];
                        this.currentTrackIndex = -1;
                        this.isPlaying = false;
                        
                        // Clear any saved state
                        localStorage.removeItem('musicPlayerState');
                        
                        // Return to home screen
                        this.showHomeScreen();
                    }
                    
                    // Reload the album library to refresh the UI
                    await this.loadAlbumLibrary();
                    
                } catch (error) {
                    console.error('Error deleting album:', error);
                    alert('Failed to delete album. Please try again.');
                }
            }

            async loadAlbumById(albumId) {
                const albumData = await this.storage.getAlbum(albumId);
                if (!albumData) return;

                // Stop and clear any currently playing audio
                if (this.audio.src) {
                    this.audio.pause();
                    this.audio.src = '';
                    this.audio.currentTime = 0;
                }
                
                // Reset player state
                this.isPlaying = false;
                this.currentTrackIndex = -1;
                this.nextTrackIndex = -1;
                
                // Clear UI elements
                document.getElementById('nowPlaying').textContent = 'Select a track to play';
                document.getElementById('nextUp').classList.remove('visible');
                document.getElementById('nextUpTitle').textContent = '—';
                
                this.currentAlbumId = albumId;
                this.tracks = [];

                // Load all tracks
                for (const trackId of albumData.trackIds) {
                    const trackData = await this.storage.getTrack(trackId);
                    if (trackData) {
                        const trackUrl = URL.createObjectURL(trackData.blob);
                        this.tracks.push({
                            id: trackData.id,
                            url: trackUrl,
                            title: trackData.title,
                            artist: trackData.artist,
                            album: trackData.album,
                            track: trackData.track,
                            year: trackData.year,
                            genre: trackData.genre,
                            duration: trackData.duration,
                            albumArt: null
                        });
                    }
                }

                // Sort tracks by track number
                this.tracks.sort((a, b) => {
                    const trackA = parseInt(a.track) || 0;
                    const trackB = parseInt(b.track) || 0;
                    return trackA - trackB;
                });

                // Load album artwork
                const artworkData = await this.storage.getArtwork(albumId);
                let albumArtUrl = null;
                if (artworkData && artworkData.blob) {
                    albumArtUrl = URL.createObjectURL(artworkData.blob);
                }

                // Set album info
                this.albumInfo = {
                    name: albumData.name,
                    artist: albumData.artist,
                    genre: albumData.genre,
                    year: albumData.year,
                    art: albumArtUrl
                };

                this.renderUI();
                
                // Restore playback state if returning to same album
                const savedState = localStorage.getItem('musicPlayerState');
                let stateRestored = false;
                
                if (savedState) {
                    const state = JSON.parse(savedState);
                    if (state.albumId === albumId && state.trackIndex >= 0 && state.trackIndex < this.tracks.length) {
                        this.playTrack(state.trackIndex);
                        if (state.currentTime) {
                            this.audio.currentTime = state.currentTime;
                        }
                        if (!state.isPlaying) {
                            this.audio.pause();
                            this.isPlaying = false;
                            this.updatePlayButton();
                        }
                        stateRestored = true;
                    }
                }
                
                // If no state was restored and we have tracks, load the first track (but don't play)
                if (!stateRestored && this.tracks.length > 0) {
                    this.currentTrackIndex = 0;
                    const track = this.tracks[0];
                    this.audio.src = track.url;
                    document.getElementById('nowPlaying').textContent = track.title;
                    this.updateActiveTrack();
                    this.updateNextUp();
                    this.updateMiniPlayer();
                }
            }

            showHomeScreen() {
                document.getElementById('homeScreen').classList.remove('hidden');
                document.getElementById('console').classList.add('hidden');
                
                // Show mini player if music is playing or loaded
                const miniPlayer = document.getElementById('miniPlayer');
                if (this.tracks.length > 0 && this.currentTrackIndex >= 0) {
                    miniPlayer.classList.add('active');
                    this.updateMiniPlayer();
                } else {
                    miniPlayer.classList.remove('active');
                }
                
                // Reload album library
                this.loadAlbumLibrary();
            }

            showPlayerScreen() {
                document.getElementById('homeScreen').classList.add('hidden');
                document.getElementById('console').classList.remove('hidden');
                
                // Hide mini player when in full player view
                document.getElementById('miniPlayer').classList.remove('active');
            }

            groupByAlbum(tracks) {
                const groups = {};
                
                tracks.forEach(track => {
                    const album = track.album || 'Unknown Album';
                    if (!groups[album]) {
                        groups[album] = [];
                    }
                    groups[album].push(track);
                });
                
                // Sort tracks within each album by track number
                Object.values(groups).forEach(albumTracks => {
                    albumTracks.sort((a, b) => {
                        const trackA = parseInt(a.track) || 0;
                        const trackB = parseInt(b.track) || 0;
                        return trackA - trackB;
                    });
                });
                
                return groups;
            }

            async extractMetadata(file) {
                return new Promise((resolve) => {
                    new jsmediatags.Reader(file)
                        .setTagsToRead(['title', 'artist', 'album', 'track', 'year', 'genre', 'picture'])
                        .read({
                            onSuccess: (tag) => {
                                const tags = tag.tags;
                                let albumArt = null;
                                let albumArtBlob = null;

                                if (tags.picture) {
                                    const { data, format } = tags.picture;
                                    const byteArray = new Uint8Array(data);
                                    albumArtBlob = new Blob([byteArray], { type: format });
                                    albumArt = URL.createObjectURL(albumArtBlob);
                                }

                                resolve({
                                    file: file,
                                    blob: file,
                                    url: URL.createObjectURL(file),
                                    title: tags.title || file.name,
                                    artist: tags.artist || 'Unknown Artist',
                                    album: tags.album || 'Unknown Album',
                                    track: tags.track || '',
                                    year: tags.year || '',
                                    genre: tags.genre || '',
                                    albumArt: albumArt,
                                    albumArtBlob: albumArtBlob,
                                    duration: 0
                                });
                            },
                            onError: () => {
                                resolve({
                                    file: file,
                                    blob: file,
                                    url: URL.createObjectURL(file),
                                    title: file.name,
                                    artist: 'Unknown Artist',
                                    album: 'Unknown Album',
                                    track: '',
                                    year: '',
                                    genre: '',
                                    albumArt: null,
                                    albumArtBlob: null,
                                    duration: 0
                                });
                            }
                        });
                });
            }

            renderUI() {
                this.renderAlbumInfo();
                this.renderTracklist();
            }

            renderAlbumInfo() {
                const albumArt = document.getElementById('albumArt');
                const currentTitle = document.getElementById('currentTitle');
                const currentArtist = document.getElementById('currentArtist');
                const albumMetadata = document.getElementById('albumMetadata');
                const albumGenre = document.getElementById('albumGenre');
                const albumTrackCount = document.getElementById('albumTrackCount');

                currentTitle.textContent = this.albumInfo.name;
                currentArtist.textContent = this.albumInfo.artist;

                if (this.albumInfo.art) {
                    albumArt.src = this.albumInfo.art;
                    albumArt.classList.add('visible');
                } else {
                    albumArt.classList.remove('visible');
                }

                // Show metadata
                albumMetadata.style.display = 'flex';
                albumGenre.textContent = this.albumInfo.genre;
                albumTrackCount.textContent = `${this.tracks.length} tracks`;

                // Calculate total duration
                const totalSeconds = this.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
                document.getElementById('albumDuration').textContent = this.formatDuration(totalSeconds);
            }

            renderTracklist() {
                const tracklist = document.getElementById('tracklist');
                const tracklistCount = document.getElementById('tracklistCount');
                
                // Force clear the tracklist
                tracklist.innerHTML = '';
                
                // If no tracks, show empty state
                if (this.tracks.length === 0) {
                    tracklistCount.textContent = '0 TRACKS';
                    return;
                }
                
                tracklistCount.textContent = `${this.tracks.length} TRACKS`;

                this.tracks.forEach((track, index) => {
                    const li = document.createElement('li');
                    li.className = 'track-item';
                    li.innerHTML = `
                        <div class="track-number">
                            ${String(index + 1).padStart(2, '0')}
                            <div class="track-eq">
                                <span></span><span></span><span></span><span></span><span></span>
                            </div>
                        </div>
                        <div class="track-details">
                            <div class="track-name">${track.title}</div>
                            <div class="track-artist-name">${track.artist}</div>
                        </div>
                        <div class="track-duration">${this.formatTime(track.duration)}</div>
                    `;
                    
                    li.addEventListener('click', () => this.playTrack(index));
                    tracklist.appendChild(li);
                });

                // Load durations asynchronously
                this.loadTrackDurations();
            }

            async loadTrackDurations() {
                for (let i = 0; i < this.tracks.length; i++) {
                    const track = this.tracks[i];
                    if (track.duration === 0) {
                        const audio = new Audio(track.url);
                        await new Promise((resolve) => {
                            audio.addEventListener('loadedmetadata', () => {
                                track.duration = audio.duration;
                                
                                // Update UI
                                const trackItems = document.querySelectorAll('.track-item');
                                if (trackItems[i]) {
                                    const durationEl = trackItems[i].querySelector('.track-duration');
                                    durationEl.textContent = this.formatTime(track.duration);
                                }
                                
                                // Update total duration
                                const totalSeconds = this.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
                                document.getElementById('albumDuration').textContent = this.formatDuration(totalSeconds);
                                
                                resolve();
                            });
                        });
                    }
                }
            }

            playTrack(index) {
                if (index < 0 || index >= this.tracks.length) return;

                this.currentTrackIndex = index;
                const track = this.tracks[index];

                this.audio.src = track.url;
                this.audio.play();
                this.isPlaying = true;

                // Update now playing
                document.getElementById('nowPlaying').textContent = track.title;

                // Update active track in list
                this.updateActiveTrack();

                // Update play button
                this.updatePlayButton();

                // Update next up
                this.updateNextUp();
                
                // Update mini player
                this.updateMiniPlayer();

                // Save state
                this.savePlaybackState();
            }

            updateNextUp() {
                const nextUp = document.getElementById('nextUp');
                const nextUpTitle = document.getElementById('nextUpTitle');

                if (this.tracks.length > 1) {
                    if (this.isShuffle) {
                        // Generate random index different from current
                        do {
                            this.nextTrackIndex = Math.floor(Math.random() * this.tracks.length);
                        } while (this.nextTrackIndex === this.currentTrackIndex && this.tracks.length > 1);
                    } else {
                        this.nextTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
                    }
                    nextUpTitle.textContent = this.tracks[this.nextTrackIndex].title;
                    nextUp.classList.add('visible');
                } else {
                    nextUp.classList.remove('visible');
                }
            }

            updateActiveTrack() {
                const items = document.querySelectorAll('.track-item');
                items.forEach((item, index) => {
                    item.classList.toggle('active', index === this.currentTrackIndex);
                });
            }

            togglePlay() {
                if (this.tracks.length === 0) return;

                if (this.isPlaying) {
                    this.audio.pause();
                    this.isPlaying = false;
                } else {
                    if (this.currentTrackIndex === -1) {
                        this.playTrack(0);
                    } else {
                        this.audio.play();
                        this.isPlaying = true;
                    }
                }

                this.updatePlayButton();
                this.savePlaybackState();
            }

            updatePlayButton() {
                const playIcon = document.getElementById('playIcon');
                const pauseIcon = document.getElementById('pauseIcon');
                const miniPlayIcon = document.getElementById('miniPlayIcon');
                const miniPauseIcon = document.getElementById('miniPauseIcon');

                if (this.isPlaying) {
                    playIcon.style.display = 'none';
                    pauseIcon.style.display = 'block';
                    miniPlayIcon.style.display = 'none';
                    miniPauseIcon.style.display = 'block';
                } else {
                    playIcon.style.display = 'block';
                    pauseIcon.style.display = 'none';
                    miniPlayIcon.style.display = 'block';
                    miniPauseIcon.style.display = 'none';
                }
            }

            playNext() {
                if (this.tracks.length === 0) return;

                // Use the predetermined next track index if available, otherwise calculate it
                let nextIndex;
                if (this.nextTrackIndex !== -1 && this.nextTrackIndex < this.tracks.length) {
                    nextIndex = this.nextTrackIndex;
                } else if (this.isShuffle) {
                    nextIndex = Math.floor(Math.random() * this.tracks.length);
                } else {
                    nextIndex = (this.currentTrackIndex + 1) % this.tracks.length;
                }

                this.playTrack(nextIndex);
            }

            playPrevious() {
                if (this.tracks.length === 0) return;

                // If more than 3 seconds played, restart current track
                if (this.audio.currentTime > 3) {
                    this.audio.currentTime = 0;
                    return;
                }

                const prevIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
                this.playTrack(prevIndex);
            }

            handleTrackEnd() {
                if (this.isLoop) {
                    this.audio.currentTime = 0;
                    this.audio.play();
                } else {
                    this.playNext();
                }
            }

            toggleShuffle() {
                this.isShuffle = !this.isShuffle;
                document.getElementById('shuffleBtn').classList.toggle('active', this.isShuffle);
                // Update next track display when shuffle is toggled
                if (this.currentTrackIndex !== -1) {
                    this.updateNextUp();
                }
            }

            toggleLoop() {
                this.isLoop = !this.isLoop;
                document.getElementById('loopBtn').classList.toggle('active', this.isLoop);
            }

            toggleTheme() {
                const body = document.body;
                const lightIcon = document.getElementById('lightIcon');
                const darkIcon = document.getElementById('darkIcon');
                const homeLightIcon = document.getElementById('homeLightIcon');
                const homeDarkIcon = document.getElementById('homeDarkIcon');
                
                body.classList.toggle('dark-mode');
                
                if (body.classList.contains('dark-mode')) {
                    lightIcon.style.display = 'none';
                    darkIcon.style.display = 'block';
                    homeLightIcon.style.display = 'none';
                    homeDarkIcon.style.display = 'block';
                    localStorage.setItem('theme', 'dark');
                } else {
                    lightIcon.style.display = 'block';
                    darkIcon.style.display = 'none';
                    homeLightIcon.style.display = 'block';
                    homeDarkIcon.style.display = 'none';
                    localStorage.setItem('theme', 'light');
                }
            }

            updateProgress() {
                const progress = (this.audio.currentTime / this.audio.duration) * 100;
                document.getElementById('progressFill').style.width = progress + '%';
                document.getElementById('currentTime').textContent = this.formatTime(this.audio.currentTime);
                
                // Update mini player progress
                document.getElementById('miniProgressFill').style.width = progress + '%';
                document.getElementById('miniCurrentTime').textContent = this.formatTime(this.audio.currentTime);
            }

            updateDuration() {
                document.getElementById('duration').textContent = this.formatTime(this.audio.duration);
                
                // Update mini player duration
                document.getElementById('miniDuration').textContent = this.formatTime(this.audio.duration);
            }

            seek(e) {
                const bar = document.getElementById('progressBar');
                const rect = bar.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const width = rect.width;
                const percentage = Math.max(0, Math.min(1, clickX / width));
                
                this.audio.currentTime = percentage * this.audio.duration;
            }

            formatTime(seconds) {
                if (isNaN(seconds)) return '0:00';
                
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            }

            formatDuration(seconds) {
                if (isNaN(seconds) || seconds === 0) return '—';
                
                const hours = Math.floor(seconds / 3600);
                const mins = Math.floor((seconds % 3600) / 60);
                
                if (hours > 0) {
                    return `${hours}hr ${mins}min`;
                } else {
                    return `${mins}min`;
                }
            }

            updateMiniPlayer() {
                if (this.currentTrackIndex >= 0 && this.currentTrackIndex < this.tracks.length) {
                    const track = this.tracks[this.currentTrackIndex];
                    document.getElementById('miniPlayerTitle').textContent = track.title || 'Unknown Track';
                    document.getElementById('miniPlayerArtist').textContent = track.artist || 'Unknown Artist';
                    
                    // Update album art in mini player
                    const miniPlayerArt = document.getElementById('miniPlayerArt');
                    if (this.albumInfo.art) {
                        miniPlayerArt.src = this.albumInfo.art;
                    } else {
                        miniPlayerArt.src = '';
                    }
                }
            }

            formatBytes(bytes) {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
            }

            handleKeyboard(e) {
                // Space: play/pause
                if (e.code === 'Space' && e.target === document.body) {
                    e.preventDefault();
                    this.togglePlay();
                }
                // Arrow Left: previous
                else if (e.code === 'ArrowLeft') {
                    this.playPrevious();
                }
                // Arrow Right: next
                else if (e.code === 'ArrowRight') {
                    this.playNext();
                }
                // S: shuffle
                else if (e.code === 'KeyS') {
                    this.toggleShuffle();
                }
                // L: loop
                else if (e.code === 'KeyL') {
                    this.toggleLoop();
                }
            }

            savePlaybackState() {
                try {
                    const state = {
                        albumId: this.currentAlbumId,
                        trackIndex: this.currentTrackIndex,
                        currentTime: this.audio.currentTime,
                        isPlaying: this.isPlaying
                    };
                    localStorage.setItem('musicPlayerState', JSON.stringify(state));
                } catch (error) {
                    console.error('Error saving playback state:', error);
                }
            }

            saveSession() {
                try {
                    const session = {
                        volume: this.audio.volume,
                        isShuffle: this.isShuffle,
                        isLoop: this.isLoop
                    };
                    localStorage.setItem('musicPlayerSession', JSON.stringify(session));
                    
                    // Save playback state
                    this.savePlaybackState();
                } catch (error) {
                    console.error('Error saving session:', error);
                }
            }

            loadSession() {
                try {
                    const session = localStorage.getItem('musicPlayerSession');
                    if (session) {
                        const data = JSON.parse(session);
                        this.audio.volume = data.volume || 0.7;
                        this.isShuffle = data.isShuffle || false;
                        this.isLoop = data.isLoop || false;
                        
                        // Sync custom volume slider visuals
                        const savedPct = (this.audio.volume * 100);
                        document.getElementById('volumeFill').style.width  = savedPct + '%';
                        document.getElementById('volumeThumb').style.left  = savedPct + '%';
                        document.getElementById('shuffleBtn').classList.toggle('active', this.isShuffle);
                        document.getElementById('loopBtn').classList.toggle('active', this.isLoop);
                    }

                    // Load theme preference
                    const theme = localStorage.getItem('theme');
                    const body = document.body;
                    const lightIcon = document.getElementById('lightIcon');
                    const darkIcon = document.getElementById('darkIcon');
                    const homeLightIcon = document.getElementById('homeLightIcon');
                    const homeDarkIcon = document.getElementById('homeDarkIcon');
                    
                    if (theme === 'dark') {
                        body.classList.add('dark-mode');
                        lightIcon.style.display = 'none';
                        darkIcon.style.display = 'block';
                        homeLightIcon.style.display = 'none';
                        homeDarkIcon.style.display = 'block';
                    } else {
                        body.classList.remove('dark-mode');
                        lightIcon.style.display = 'block';
                        darkIcon.style.display = 'none';
                        homeLightIcon.style.display = 'block';
                        homeDarkIcon.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error loading session:', error);
                }
            }
        }
