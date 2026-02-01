/**
 * library.js
 * IndexedDB Storage Manager for Solace Music Player
 * Handles all database operations for albums, tracks, and artwork
 */

export class StorageManager {
    constructor() {
        this.dbName = 'SolaceMusicDB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store for albums metadata
                if (!db.objectStoreNames.contains('albums')) {
                    db.createObjectStore('albums', { keyPath: 'id' });
                }

                // Store for audio file blobs
                if (!db.objectStoreNames.contains('tracks')) {
                    db.createObjectStore('tracks', { keyPath: 'id' });
                }

                // Store for album art blobs
                if (!db.objectStoreNames.contains('artwork')) {
                    db.createObjectStore('artwork', { keyPath: 'albumId' });
                }
            };
        });
    }

    async saveAlbum(albumData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['albums'], 'readwrite');
            const store = transaction.objectStore('albums');
            const request = store.put(albumData);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async saveTrack(trackData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tracks'], 'readwrite');
            const store = transaction.objectStore('tracks');
            const request = store.put(trackData);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async saveArtwork(albumId, artworkBlob) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['artwork'], 'readwrite');
            const store = transaction.objectStore('artwork');
            const request = store.put({ albumId, blob: artworkBlob });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllAlbums() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['albums'], 'readonly');
            const store = transaction.objectStore('albums');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAlbum(albumId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['albums'], 'readonly');
            const store = transaction.objectStore('albums');
            const request = store.get(albumId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getTrack(trackId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tracks'], 'readonly');
            const store = transaction.objectStore('tracks');
            const request = store.get(trackId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getArtwork(albumId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['artwork'], 'readonly');
            const store = transaction.objectStore('artwork');
            const request = store.get(albumId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteAlbum(albumId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['albums'], 'readwrite');
            const store = transaction.objectStore('albums');
            const request = store.delete(albumId);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteTrack(trackId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tracks'], 'readwrite');
            const store = transaction.objectStore('tracks');
            const request = store.delete(trackId);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteArtwork(albumId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['artwork'], 'readwrite');
            const store = transaction.objectStore('artwork');
            const request = store.delete(albumId);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}
