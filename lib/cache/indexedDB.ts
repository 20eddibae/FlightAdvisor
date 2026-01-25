/**
 * IndexedDB wrapper for persistent airport cache storage
 * Handles versioning, corruption recovery, and quota management
 */

import type { RegionCache, CacheMetadata } from './types';

const DB_NAME = 'FlightAdvisorCache';
const DB_VERSION = 1;
const STORE_REGIONS = 'regions';
const STORE_METADATA = 'metadata';

export class CacheDB {
  private db: IDBDatabase | null = null;
  private opening: Promise<void> | null = null;

  /**
   * Open database connection
   * Handles version upgrades and creates object stores
   */
  async open(): Promise<void> {
    // Return existing promise if already opening
    if (this.opening) return this.opening;

    // Return immediately if already open
    if (this.db) return Promise.resolve();

    this.opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        this.opening = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.opening = null;

        // Handle unexpected close
        this.db.onclose = () => {
          console.warn('IndexedDB connection closed unexpectedly');
          this.db = null;
        };

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(STORE_REGIONS)) {
          db.createObjectStore(STORE_REGIONS, { keyPath: 'regionName' });
        }

        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA);
        }
      };
    });

    return this.opening;
  }

  /**
   * Ensure database is open before operations
   */
  private async ensureOpen(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.open();
    }

    if (!this.db) {
      throw new Error('Failed to open database');
    }

    return this.db;
  }

  /**
   * Get region cache data
   */
  async getRegion(name: string): Promise<RegionCache | null> {
    try {
      const db = await this.ensureOpen();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_REGIONS, 'readonly');
        const store = transaction.objectStore(STORE_REGIONS);
        const request = store.get(name);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get region from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Save region cache data
   */
  async putRegion(region: RegionCache): Promise<void> {
    try {
      const db = await this.ensureOpen();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_REGIONS, 'readwrite');
        const store = transaction.objectStore(STORE_REGIONS);
        const request = store.put(region);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);

        // Also handle transaction errors
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Failed to save region to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Get all cached regions
   * Used during initialization
   */
  async getAllRegions(): Promise<RegionCache[]> {
    try {
      const db = await this.ensureOpen();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_REGIONS, 'readonly');
        const store = transaction.objectStore(STORE_REGIONS);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get all regions from IndexedDB:', error);
      return [];
    }
  }

  /**
   * Delete a specific region
   */
  async deleteRegion(name: string): Promise<void> {
    try {
      const db = await this.ensureOpen();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_REGIONS, 'readwrite');
        const store = transaction.objectStore(STORE_REGIONS);
        const request = store.delete(name);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to delete region from IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Get cache metadata
   */
  async getMetadata(): Promise<CacheMetadata | null> {
    try {
      const db = await this.ensureOpen();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_METADATA, 'readonly');
        const store = transaction.objectStore(STORE_METADATA);
        const request = store.get('global');

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get metadata from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Save cache metadata
   */
  async putMetadata(metadata: CacheMetadata): Promise<void> {
    try {
      const db = await this.ensureOpen();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_METADATA, 'readwrite');
        const store = transaction.objectStore(STORE_METADATA);
        const request = store.put(metadata, 'global');

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to save metadata to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Clear all cached data
   * Used for cache invalidation or corruption recovery
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.ensureOpen();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_REGIONS, STORE_METADATA], 'readwrite');

        const regionsStore = transaction.objectStore(STORE_REGIONS);
        const metadataStore = transaction.objectStore(STORE_METADATA);

        regionsStore.clear();
        metadataStore.clear();

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Failed to clear IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Delete entire database
   * Used for catastrophic failure recovery
   */
  static async deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);

      request.onsuccess = () => {
        console.log('Database deleted successfully');
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to delete database:', request.error);
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn('Database deletion blocked - close all tabs');
      };
    });
  }

  /**
   * Check if IndexedDB is available
   */
  static isAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  /**
   * Estimate storage usage
   */
  async estimateStorage(): Promise<{ usage: number; quota: number } | null> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    } catch (error) {
      console.error('Failed to estimate storage:', error);
      return null;
    }
  }
}
