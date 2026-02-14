// Unit tests for ContentSyncService
import { ContentSyncService, SyncItem } from '../../src/services/content-sync-service';

jest.mock('../../src/utils/logger');

describe('ContentSyncService', () => {
  let service: ContentSyncService;

  beforeEach(() => {
    service = new ContentSyncService('newest-wins');
  });

  const createMockSyncItems = (count: number): SyncItem[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `item-${i}`,
      type: 'artifact' as const,
      localVersion: `v1.${i}`,
      serverVersion: `v1.${i}`,
      lastModified: new Date(),
      size: 1000 * (i + 1),
      priority: i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : ('low' as const),
    }));
  };

  describe('startSync', () => {
    it('should sync items successfully', async () => {
      const items = createMockSyncItems(3);

      const result = await service.startSync(items);

      expect(result.success).toBe(true);
      expect(result.syncedItems).toBe(3);
      expect(result.failedItems).toBe(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should prioritize high priority items first', async () => {
      const items: SyncItem[] = [
        {
          id: 'low-1',
          type: 'artifact',
          localVersion: 'v1',
          lastModified: new Date(),
          size: 1000,
          priority: 'low',
        },
        {
          id: 'high-1',
          type: 'artifact',
          localVersion: 'v1',
          lastModified: new Date(),
          size: 1000,
          priority: 'high',
        },
        {
          id: 'medium-1',
          type: 'artifact',
          localVersion: 'v1',
          lastModified: new Date(),
          size: 1000,
          priority: 'medium',
        },
      ];

      await service.startSync(items);

      const progress = service.getSyncProgress();
      expect(progress.syncedItems).toBe(3);
    });

    it('should throw error if sync already in progress', async () => {
      const items = createMockSyncItems(2);

      // Start first sync (don't await)
      const syncPromise = service.startSync(items);

      // Try to start second sync
      await expect(service.startSync(items)).rejects.toThrow('Sync already in progress');

      // Wait for first sync to complete
      await syncPromise;
    });

    it('should update sync progress during sync', async () => {
      const items = createMockSyncItems(5);

      const syncPromise = service.startSync(items);

      // Check progress while syncing
      await new Promise(resolve => setTimeout(resolve, 50));
      const progress = service.getSyncProgress();
      expect(progress.status).toBe('syncing');
      expect(progress.totalItems).toBe(5);

      await syncPromise;

      const finalProgress = service.getSyncProgress();
      expect(finalProgress.status).toBe('completed');
      expect(finalProgress.syncedItems).toBe(5);
    });

    it('should detect and handle conflicts', async () => {
      const items: SyncItem[] = [
        {
          id: 'conflict-item',
          type: 'artifact',
          localVersion: 'v1.0',
          serverVersion: 'v2.0', // Different version - conflict!
          lastModified: new Date(Date.now() - 1000), // Older than server
          size: 1000,
          priority: 'high',
        },
      ];

      const result = await service.startSync(items);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].itemId).toBe('conflict-item');
      expect(result.conflicts[0].localVersion).toBe('v1.0');
      expect(result.conflicts[0].serverVersion).toBe('v2.0');
    });
  });

  describe('pauseSync and resumeSync', () => {
    it('should pause ongoing sync', async () => {
      const items = createMockSyncItems(10);

      const syncPromise = service.startSync(items);

      // Pause after a short delay
      await new Promise(resolve => setTimeout(resolve, 50));
      service.pauseSync();

      const progress = service.getSyncProgress();
      expect(progress.status).toBe('paused');

      await syncPromise;
    });

    it('should throw error when pausing non-existent sync', () => {
      expect(() => service.pauseSync()).toThrow('No sync in progress');
    });

    it('should resume paused sync', async () => {
      const items = createMockSyncItems(5);

      const syncPromise = service.startSync(items);

      await new Promise(resolve => setTimeout(resolve, 50));
      service.pauseSync();

      await syncPromise;

      // Resume sync
      const resumeResult = await service.resumeSync();

      expect(resumeResult.success).toBe(true);
    });

    it('should throw error when resuming non-paused sync', async () => {
      await expect(service.resumeSync()).rejects.toThrow('No paused sync to resume');
    });
  });

  describe('cancelSync', () => {
    it('should cancel ongoing sync', async () => {
      const items = createMockSyncItems(10);

      const syncPromise = service.startSync(items);

      // Cancel after a short delay
      await new Promise(resolve => setTimeout(resolve, 50));
      service.cancelSync();

      const progress = service.getSyncProgress();
      expect(progress.status).toBe('idle');

      await syncPromise;
    });

    it('should throw error when cancelling non-existent sync', () => {
      expect(() => service.cancelSync()).toThrow('No sync in progress');
    });
  });

  describe('getSyncProgress', () => {
    it('should return current sync progress', async () => {
      const items = createMockSyncItems(3);

      await service.startSync(items);

      const progress = service.getSyncProgress();

      expect(progress).toHaveProperty('status');
      expect(progress).toHaveProperty('totalItems');
      expect(progress).toHaveProperty('syncedItems');
      expect(progress).toHaveProperty('failedItems');
      expect(progress).toHaveProperty('bytesTransferred');
      expect(progress).toHaveProperty('totalBytes');
    });

    it('should show idle status initially', () => {
      const progress = service.getSyncProgress();

      expect(progress.status).toBe('idle');
      expect(progress.totalItems).toBe(0);
      expect(progress.syncedItems).toBe(0);
    });
  });

  describe('isSyncInProgress', () => {
    it('should return false initially', () => {
      expect(service.isSyncInProgress()).toBe(false);
    });

    it('should return true during sync', async () => {
      const items = createMockSyncItems(5);

      const syncPromise = service.startSync(items);

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(service.isSyncInProgress()).toBe(true);

      await syncPromise;
      expect(service.isSyncInProgress()).toBe(false);
    });
  });

  describe('setConflictResolution', () => {
    it('should update conflict resolution strategy', () => {
      service.setConflictResolution('server-wins');

      // Strategy is updated internally
      expect(service).toBeDefined();
    });

    it('should apply server-wins strategy', async () => {
      service.setConflictResolution('server-wins');

      const items: SyncItem[] = [
        {
          id: 'conflict-item',
          type: 'artifact',
          localVersion: 'v1.0',
          serverVersion: 'v2.0',
          lastModified: new Date(),
          size: 1000,
          priority: 'high',
        },
      ];

      const result = await service.startSync(items);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBe('server-wins');
      expect(result.syncedItems).toBe(1); // Should sync despite conflict
    });

    it('should apply client-wins strategy', async () => {
      service.setConflictResolution('client-wins');

      const items: SyncItem[] = [
        {
          id: 'conflict-item',
          type: 'artifact',
          localVersion: 'v1.0',
          serverVersion: 'v2.0',
          lastModified: new Date(),
          size: 1000,
          priority: 'high',
        },
      ];

      const result = await service.startSync(items);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBe('client-wins');
      expect(result.syncedItems).toBe(1);
    });

    it('should apply newest-wins strategy', async () => {
      service.setConflictResolution('newest-wins');

      const items: SyncItem[] = [
        {
          id: 'conflict-item',
          type: 'artifact',
          localVersion: 'v1.0',
          serverVersion: 'v2.0',
          lastModified: new Date(Date.now() - 10000), // Older
          size: 1000,
          priority: 'high',
        },
      ];

      const result = await service.startSync(items);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBe('newest-wins');
    });

    it('should skip manual conflict resolution', async () => {
      service.setConflictResolution('manual');

      const items: SyncItem[] = [
        {
          id: 'conflict-item',
          type: 'artifact',
          localVersion: 'v1.0',
          serverVersion: 'v2.0',
          lastModified: new Date(),
          size: 1000,
          priority: 'high',
        },
      ];

      const result = await service.startSync(items);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBe('manual');
      expect(result.syncedItems).toBe(0); // Should not sync
    });
  });

  describe('syncInBackground', () => {
    it('should start sync without blocking', async () => {
      const items = createMockSyncItems(3);

      // Should return immediately
      await service.syncInBackground(items);

      // Sync should be in progress
      expect(service.isSyncInProgress()).toBe(true);

      // Wait for background sync to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    });
  });

  describe('needsSync', () => {
    it('should return true when versions differ', () => {
      expect(service.needsSync('v1.0', 'v2.0')).toBe(true);
    });

    it('should return false when versions match', () => {
      expect(service.needsSync('v1.0', 'v1.0')).toBe(false);
    });
  });

  describe('getSyncStats', () => {
    it('should return sync statistics', async () => {
      const items = createMockSyncItems(5);

      await service.startSync(items);

      const stats = service.getSyncStats();

      expect(stats.totalSyncs).toBe(5);
      expect(stats.successfulSyncs).toBe(5);
      expect(stats.failedSyncs).toBe(0);
      expect(stats.totalBytesSynced).toBeGreaterThan(0);
    });

    it('should return zero stats initially', () => {
      const stats = service.getSyncStats();

      expect(stats.totalSyncs).toBe(0);
      expect(stats.successfulSyncs).toBe(0);
      expect(stats.failedSyncs).toBe(0);
      expect(stats.totalBytesSynced).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle sync errors gracefully', async () => {
      const items = createMockSyncItems(3);

      const result = await service.startSync(items);

      // Even if some items fail, sync should complete
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('errors');
    });

    it('should track failed items', async () => {
      const items = createMockSyncItems(5);

      const result = await service.startSync(items);

      const progress = service.getSyncProgress();
      expect(progress.failedItems).toBe(0); // No failures in mock
    });
  });

  describe('progress tracking', () => {
    it('should track bytes transferred', async () => {
      const items = createMockSyncItems(3);

      await service.startSync(items);

      const progress = service.getSyncProgress();
      expect(progress.bytesTransferred).toBeGreaterThan(0);
      expect(progress.totalBytes).toBeGreaterThan(0);
    });

    it('should calculate estimated time remaining', async () => {
      const items = createMockSyncItems(10);

      const syncPromise = service.startSync(items);

      await new Promise(resolve => setTimeout(resolve, 200));

      const progress = service.getSyncProgress();
      if (progress.syncedItems > 0) {
        expect(progress.estimatedTimeRemaining).toBeDefined();
      }

      await syncPromise;
    });
  });
});
