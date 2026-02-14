// Content Synchronization Service
import { logger } from '../utils/logger';

export type SyncStatus = 'idle' | 'syncing' | 'completed' | 'failed' | 'paused';
export type ConflictResolution = 'server-wins' | 'client-wins' | 'newest-wins' | 'manual';

export interface SyncItem {
  id: string;
  type: 'artifact' | 'audio' | 'video' | 'image' | 'site-info';
  localVersion: string;
  serverVersion?: string;
  lastModified: Date;
  size: number;
  priority: 'high' | 'medium' | 'low';
}

export interface SyncConflict {
  itemId: string;
  localVersion: string;
  serverVersion: string;
  localModified: Date;
  serverModified: Date;
  resolution?: ConflictResolution;
}

export interface SyncProgress {
  status: SyncStatus;
  totalItems: number;
  syncedItems: number;
  failedItems: number;
  currentItem?: string;
  bytesTransferred: number;
  totalBytes: number;
  startTime?: Date;
  estimatedTimeRemaining?: number;
  errors: Array<{ itemId: string; error: string }>;
}

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  conflicts: SyncConflict[];
  duration: number;
  errors: Array<{ itemId: string; error: string }>;
}

export class ContentSyncService {
  private syncStatus: SyncStatus;
  private syncProgress: SyncProgress;
  private conflictResolutionStrategy: ConflictResolution;
  private syncQueue: SyncItem[];
  private isSyncing: boolean;
  private isPaused: boolean;
  private abortController?: AbortController;

  constructor(conflictResolution: ConflictResolution = 'newest-wins') {
    this.syncStatus = 'idle';
    this.conflictResolutionStrategy = conflictResolution;
    this.syncQueue = [];
    this.isSyncing = false;
    this.isPaused = false;
    
    this.syncProgress = {
      status: 'idle',
      totalItems: 0,
      syncedItems: 0,
      failedItems: 0,
      bytesTransferred: 0,
      totalBytes: 0,
      errors: [],
    };

    logger.info('Content sync service initialized', {
      conflictResolution,
    });
  }

  /**
   * Start synchronization process
   */
  public async startSync(items: SyncItem[]): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.syncStatus = 'syncing';
    this.syncQueue = [...items].sort((a, b) => {
      // Sort by priority: high > medium > low
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const startTime = Date.now();
    this.abortController = new AbortController();

    this.syncProgress = {
      status: 'syncing',
      totalItems: items.length,
      syncedItems: 0,
      failedItems: 0,
      bytesTransferred: 0,
      totalBytes: items.reduce((sum, item) => sum + item.size, 0),
      startTime: new Date(),
      errors: [],
    };

    const conflicts: SyncConflict[] = [];
    const errors: Array<{ itemId: string; error: string }> = [];

    logger.info('Sync started', {
      totalItems: items.length,
      totalBytes: this.syncProgress.totalBytes,
    });

    try {
      for (const item of this.syncQueue) {
        if (this.abortController.signal.aborted) {
          logger.info('Sync aborted by user');
          break;
        }

        // Check if sync was paused
        if (this.isPaused) {
          logger.info('Sync paused, stopping processing');
          break;
        }

        this.syncProgress.currentItem = item.id;

        try {
          // Check for conflicts
          const conflict = await this.checkForConflict(item);
          
          if (conflict) {
            conflicts.push(conflict);
            
            // Resolve conflict based on strategy
            const shouldSync = await this.resolveConflict(conflict);
            
            if (!shouldSync) {
              logger.debug('Skipping item due to conflict resolution', {
                itemId: item.id,
                resolution: conflict.resolution,
              });
              continue;
            }
          }

          // Sync the item
          await this.syncItem(item);
          
          this.syncProgress.syncedItems++;
          this.syncProgress.bytesTransferred += item.size;

          logger.debug('Item synced successfully', {
            itemId: item.id,
            type: item.type,
          });
        } catch (error) {
          this.syncProgress.failedItems++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({ itemId: item.id, error: errorMessage });

          logger.error('Failed to sync item', {
            itemId: item.id,
            error: errorMessage,
          });
        }

        // Update estimated time remaining
        this.updateEstimatedTime(startTime);
      }

      // Only mark as completed if not paused
      if (!this.isPaused) {
        this.syncStatus = 'completed';
        this.syncProgress.status = 'completed';
      } else {
        // If paused, keep status as paused and reset isSyncing flag
        this.isSyncing = false;
      }

      const duration = Date.now() - startTime;

      logger.info('Sync completed', {
        syncedItems: this.syncProgress.syncedItems,
        failedItems: this.syncProgress.failedItems,
        conflicts: conflicts.length,
        duration,
      });

      return {
        success: this.syncProgress.failedItems === 0,
        syncedItems: this.syncProgress.syncedItems,
        failedItems: this.syncProgress.failedItems,
        conflicts,
        duration,
        errors,
      };
    } catch (error) {
      this.syncStatus = 'failed';
      this.syncProgress.status = 'failed';

      logger.error('Sync failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      this.isSyncing = false;
      this.abortController = undefined;
    }
  }

  /**
   * Pause ongoing synchronization
   */
  public pauseSync(): void {
    if (!this.isSyncing) {
      throw new Error('No sync in progress');
    }

    this.isPaused = true;
    this.syncStatus = 'paused';
    this.syncProgress.status = 'paused';

    logger.info('Sync paused', {
      syncedItems: this.syncProgress.syncedItems,
      remainingItems: this.syncProgress.totalItems - this.syncProgress.syncedItems,
    });
  }

  /**
   * Resume paused synchronization
   */
  public async resumeSync(): Promise<SyncResult> {
    if (this.syncStatus !== 'paused') {
      throw new Error('No paused sync to resume');
    }

    logger.info('Resuming sync', {
      remainingItems: this.syncQueue.length - this.syncProgress.syncedItems,
    });

    // Reset pause flag and syncing flag to allow resume
    this.isPaused = false;
    this.isSyncing = false;
    
    // Continue with remaining items
    const remainingItems = this.syncQueue.slice(this.syncProgress.syncedItems);
    return this.startSync(remainingItems);
  }

  /**
   * Cancel ongoing synchronization
   */
  public cancelSync(): void {
    if (!this.isSyncing) {
      throw new Error('No sync in progress');
    }

    if (this.abortController) {
      this.abortController.abort();
    }

    this.syncStatus = 'idle';
    this.syncProgress.status = 'idle';
    this.isSyncing = false;

    logger.info('Sync cancelled', {
      syncedItems: this.syncProgress.syncedItems,
      cancelledItems: this.syncProgress.totalItems - this.syncProgress.syncedItems,
    });
  }

  /**
   * Get current sync progress
   */
  public getSyncProgress(): SyncProgress {
    return { ...this.syncProgress };
  }

  /**
   * Check if sync is in progress
   */
  public isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Set conflict resolution strategy
   */
  public setConflictResolution(strategy: ConflictResolution): void {
    this.conflictResolutionStrategy = strategy;
    logger.info('Conflict resolution strategy updated', { strategy });
  }

  /**
   * Check for conflicts between local and server versions
   */
  private async checkForConflict(item: SyncItem): Promise<SyncConflict | null> {
    // Simulate checking server version
    // In production, this would make an API call to check server version
    
    if (!item.serverVersion) {
      return null; // No server version, no conflict
    }

    if (item.localVersion === item.serverVersion) {
      return null; // Versions match, no conflict
    }

    // Conflict detected
    return {
      itemId: item.id,
      localVersion: item.localVersion,
      serverVersion: item.serverVersion,
      localModified: item.lastModified,
      serverModified: new Date(), // In production, get from server
    };
  }

  /**
   * Resolve conflict based on strategy
   */
  private async resolveConflict(conflict: SyncConflict): Promise<boolean> {
    let resolution: ConflictResolution;

    switch (this.conflictResolutionStrategy) {
      case 'server-wins':
        resolution = 'server-wins';
        conflict.resolution = resolution;
        return true; // Sync server version to local

      case 'client-wins':
        resolution = 'client-wins';
        conflict.resolution = resolution;
        return true; // Upload local version to server

      case 'newest-wins':
        resolution = 'newest-wins';
        conflict.resolution = resolution;
        // Compare timestamps
        return conflict.serverModified > conflict.localModified;

      case 'manual':
        resolution = 'manual';
        conflict.resolution = resolution;
        // Skip for now, require manual intervention
        logger.warn('Manual conflict resolution required', {
          itemId: conflict.itemId,
        });
        return false;

      default:
        return false;
    }
  }

  /**
   * Sync individual item
   */
  private async syncItem(item: SyncItem): Promise<void> {
    // Simulate sync operation
    // In production, this would:
    // 1. Download content from server
    // 2. Update local cache
    // 3. Update metadata
    
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay

    logger.debug('Item sync operation completed', {
      itemId: item.id,
      type: item.type,
      size: item.size,
    });
  }

  /**
   * Update estimated time remaining
   */
  private updateEstimatedTime(startTime: number): void {
    const elapsed = Date.now() - startTime;
    const itemsProcessed = this.syncProgress.syncedItems + this.syncProgress.failedItems;
    
    if (itemsProcessed === 0) {
      return;
    }

    const avgTimePerItem = elapsed / itemsProcessed;
    const remainingItems = this.syncProgress.totalItems - itemsProcessed;
    this.syncProgress.estimatedTimeRemaining = Math.round(avgTimePerItem * remainingItems);
  }

  /**
   * Sync content in background
   */
  public async syncInBackground(items: SyncItem[]): Promise<void> {
    logger.info('Starting background sync', { itemCount: items.length });

    // Start sync without blocking
    this.startSync(items).catch(error => {
      logger.error('Background sync failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Check if item needs sync
   */
  public needsSync(localVersion: string, serverVersion: string): boolean {
    return localVersion !== serverVersion;
  }

  /**
   * Get sync statistics
   */
  public getSyncStats(): {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    totalBytesSynced: number;
  } {
    return {
      totalSyncs: this.syncProgress.syncedItems + this.syncProgress.failedItems,
      successfulSyncs: this.syncProgress.syncedItems,
      failedSyncs: this.syncProgress.failedItems,
      totalBytesSynced: this.syncProgress.bytesTransferred,
    };
  }
}
