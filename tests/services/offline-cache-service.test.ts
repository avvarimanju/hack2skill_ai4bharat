// Unit tests for OfflineCacheService
import { OfflineCacheService } from '../../src/services/offline-cache-service';

jest.mock('../../src/utils/logger');

describe('OfflineCacheService', () => {
  let service: OfflineCacheService;

  beforeEach(() => {
    service = new OfflineCacheService(10, 30); // 10MB max, 30 days max age
  });

  describe('cacheContent', () => {
    it('should cache content successfully', async () => {
      await service.cacheContent({
        id: 'test-content-1',
        type: 'artifact',
        siteId: 'site-1',
        artifactId: 'artifact-1',
        language: 'en',
        data: { name: 'Test Artifact' },
        metadata: {
          size: 1000,
          priority: 'high',
        },
      });

      const cached = service.getCachedContent('test-content-1');
      expect(cached).toBeDefined();
      expect(cached?.data.name).toBe('Test Artifact');
    });

    it('should set cachedAt and lastAccessedAt timestamps', async () => {
      const beforeCache = new Date();
      
      await service.cacheContent({
        id: 'test-content-2',
        type: 'audio',
        siteId: 'site-1',
        language: 'en',
        data: { url: 'audio.mp3' },
        metadata: {
          size: 5000,
          priority: 'medium',
        },
      });

      const cached = service.getCachedContent('test-content-2');
      expect(cached?.metadata.cachedAt).toBeInstanceOf(Date);
      expect(cached?.metadata.lastAccessedAt).toBeInstanceOf(Date);
      expect(cached?.metadata.cachedAt.getTime()).toBeGreaterThanOrEqual(beforeCache.getTime());
    });

    it('should evict low priority content when cache is full', async () => {
      // Fill cache with low priority content
      for (let i = 0; i < 5; i++) {
        await service.cacheContent({
          id: `low-priority-${i}`,
          type: 'image',
          siteId: 'site-1',
          language: 'en',
          data: { url: `image-${i}.jpg` },
          metadata: {
            size: 2 * 1024 * 1024, // 2MB each
            priority: 'low',
          },
        });
      }

      // Add high priority content that exceeds cache size
      await service.cacheContent({
        id: 'high-priority-1',
        type: 'artifact',
        siteId: 'site-1',
        language: 'en',
        data: { name: 'Important Artifact' },
        metadata: {
          size: 1 * 1024 * 1024, // 1MB
          priority: 'high',
        },
      });

      // High priority content should be cached
      expect(service.getCachedContent('high-priority-1')).toBeDefined();
      
      // Some low priority content should be evicted
      const stats = service.getCacheStats();
      expect(stats.totalSize).toBeLessThanOrEqual(10 * 1024 * 1024);
    });
  });

  describe('getCachedContent', () => {
    it('should return null for non-existent content', () => {
      const cached = service.getCachedContent('non-existent');
      expect(cached).toBeNull();
    });

    it('should update lastAccessedAt when content is accessed', async () => {
      await service.cacheContent({
        id: 'test-content-3',
        type: 'artifact',
        siteId: 'site-1',
        language: 'en',
        data: { name: 'Test' },
        metadata: {
          size: 1000,
          priority: 'medium',
        },
      });

      const firstAccess = service.getCachedContent('test-content-3');
      const firstAccessTime = firstAccess?.metadata.lastAccessedAt.getTime();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const secondAccess = service.getCachedContent('test-content-3');
      const secondAccessTime = secondAccess?.metadata.lastAccessedAt.getTime();

      expect(secondAccessTime).toBeGreaterThan(firstAccessTime!);
    });

    it('should return null and remove expired content', async () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago
      
      await service.cacheContent({
        id: 'expired-content',
        type: 'artifact',
        siteId: 'site-1',
        language: 'en',
        data: { name: 'Expired' },
        metadata: {
          size: 1000,
          priority: 'low',
          expiresAt: pastDate,
        },
      });

      const cached = service.getCachedContent('expired-content');
      expect(cached).toBeNull();
      expect(service.isContentAvailableOffline('expired-content')).toBe(false);
    });
  });

  describe('cacheQRScan', () => {
    it('should cache QR scan data', () => {
      service.cacheQRScan({
        qrCode: 'QR123',
        artifactId: 'artifact-1',
        siteId: 'site-1',
        basicInfo: {
          name: 'Test Artifact',
          description: 'A test artifact',
        },
      });

      const cached = service.getCachedQRScan('QR123');
      expect(cached).toBeDefined();
      expect(cached?.artifactId).toBe('artifact-1');
      expect(cached?.basicInfo.name).toBe('Test Artifact');
    });

    it('should return null for non-existent QR code', () => {
      const cached = service.getCachedQRScan('NON-EXISTENT');
      expect(cached).toBeNull();
    });
  });

  describe('cacheEssentialSiteContent', () => {
    it('should cache all essential site content', async () => {
      await service.cacheEssentialSiteContent('site-1', 'en', {
        siteInfo: { name: 'Test Site', location: 'Test Location' },
        artifacts: [
          { id: 'artifact-1', data: { name: 'Artifact 1' } },
          { id: 'artifact-2', data: { name: 'Artifact 2' } },
        ],
        audioGuides: [
          { artifactId: 'artifact-1', data: { url: 'audio1.mp3' }, size: 5000 },
          { artifactId: 'artifact-2', data: { url: 'audio2.mp3' }, size: 6000 },
        ],
      });

      // Check site info
      const siteInfo = service.getOfflineSiteInfo('site-1', 'en');
      expect(siteInfo).toBeDefined();
      expect(siteInfo.name).toBe('Test Site');

      // Check artifacts
      const artifact1 = service.getOfflineArtifactInfo('artifact-1', 'en');
      expect(artifact1).toBeDefined();
      expect(artifact1.name).toBe('Artifact 1');

      // Check audio guides
      const audio1 = service.getOfflineAudioGuide('artifact-1', 'en');
      expect(audio1).toBeDefined();
      expect(audio1.url).toBe('audio1.mp3');
    });
  });

  describe('getOfflineAudioGuide', () => {
    it('should return cached audio guide', async () => {
      await service.cacheContent({
        id: 'audio-artifact-1-en',
        type: 'audio',
        siteId: 'site-1',
        artifactId: 'artifact-1',
        language: 'en',
        data: { url: 'audio.mp3', duration: 120 },
        metadata: {
          size: 5000,
          priority: 'high',
        },
      });

      const audio = service.getOfflineAudioGuide('artifact-1', 'en');
      expect(audio).toBeDefined();
      expect(audio.url).toBe('audio.mp3');
      expect(audio.duration).toBe(120);
    });

    it('should return null for non-existent audio guide', () => {
      const audio = service.getOfflineAudioGuide('non-existent', 'en');
      expect(audio).toBeNull();
    });
  });

  describe('getOfflineArtifactInfo', () => {
    it('should return cached artifact info', async () => {
      await service.cacheContent({
        id: 'artifact-artifact-1-en',
        type: 'artifact',
        siteId: 'site-1',
        artifactId: 'artifact-1',
        language: 'en',
        data: { name: 'Test Artifact', period: '1000 BC' },
        metadata: {
          size: 2000,
          priority: 'essential',
        },
      });

      const artifact = service.getOfflineArtifactInfo('artifact-1', 'en');
      expect(artifact).toBeDefined();
      expect(artifact.name).toBe('Test Artifact');
      expect(artifact.period).toBe('1000 BC');
    });

    it('should return null for non-existent artifact', () => {
      const artifact = service.getOfflineArtifactInfo('non-existent', 'en');
      expect(artifact).toBeNull();
    });
  });

  describe('getOfflineSiteInfo', () => {
    it('should return cached site info', async () => {
      await service.cacheContent({
        id: 'site-site-1-en',
        type: 'site-info',
        siteId: 'site-1',
        language: 'en',
        data: { name: 'Test Site', description: 'A test heritage site' },
        metadata: {
          size: 3000,
          priority: 'essential',
        },
      });

      const siteInfo = service.getOfflineSiteInfo('site-1', 'en');
      expect(siteInfo).toBeDefined();
      expect(siteInfo.name).toBe('Test Site');
      expect(siteInfo.description).toBe('A test heritage site');
    });

    it('should return null for non-existent site', () => {
      const siteInfo = service.getOfflineSiteInfo('non-existent', 'en');
      expect(siteInfo).toBeNull();
    });
  });

  describe('isContentAvailableOffline', () => {
    it('should return true for cached content', async () => {
      await service.cacheContent({
        id: 'test-content-4',
        type: 'artifact',
        siteId: 'site-1',
        language: 'en',
        data: { name: 'Test' },
        metadata: {
          size: 1000,
          priority: 'medium',
        },
      });

      expect(service.isContentAvailableOffline('test-content-4')).toBe(true);
    });

    it('should return false for non-cached content', () => {
      expect(service.isContentAvailableOffline('non-existent')).toBe(false);
    });
  });

  describe('getCachedSiteContent', () => {
    it('should return all cached content for a site', async () => {
      await service.cacheEssentialSiteContent('site-1', 'en', {
        siteInfo: { name: 'Test Site' },
        artifacts: [
          { id: 'artifact-1', data: { name: 'Artifact 1' } },
          { id: 'artifact-2', data: { name: 'Artifact 2' } },
        ],
        audioGuides: [
          { artifactId: 'artifact-1', data: { url: 'audio1.mp3' }, size: 5000 },
        ],
      });

      const siteContent = service.getCachedSiteContent('site-1', 'en');
      
      expect(siteContent.siteInfo).toBeDefined();
      expect(siteContent.siteInfo.name).toBe('Test Site');
      expect(siteContent.artifacts).toHaveLength(2);
      expect(siteContent.audioGuides).toHaveLength(1);
    });

    it('should return empty arrays for non-existent site', () => {
      const siteContent = service.getCachedSiteContent('non-existent', 'en');
      
      expect(siteContent.siteInfo).toBeNull();
      expect(siteContent.artifacts).toHaveLength(0);
      expect(siteContent.audioGuides).toHaveLength(0);
    });
  });

  describe('clearSiteCache', () => {
    it('should clear all content for a specific site', async () => {
      await service.cacheEssentialSiteContent('site-1', 'en', {
        siteInfo: { name: 'Site 1' },
        artifacts: [{ id: 'artifact-1', data: { name: 'Artifact 1' } }],
        audioGuides: [{ artifactId: 'artifact-1', data: { url: 'audio1.mp3' }, size: 5000 }],
      });

      await service.cacheEssentialSiteContent('site-2', 'en', {
        siteInfo: { name: 'Site 2' },
        artifacts: [{ id: 'artifact-2', data: { name: 'Artifact 2' } }],
        audioGuides: [],
      });

      service.clearSiteCache('site-1');

      // Site 1 content should be cleared
      expect(service.getOfflineSiteInfo('site-1', 'en')).toBeNull();
      expect(service.getOfflineArtifactInfo('artifact-1', 'en')).toBeNull();

      // Site 2 content should still exist
      expect(service.getOfflineSiteInfo('site-2', 'en')).toBeDefined();
    });
  });

  describe('clearAllCache', () => {
    it('should clear all cached content', async () => {
      await service.cacheContent({
        id: 'test-content-5',
        type: 'artifact',
        siteId: 'site-1',
        language: 'en',
        data: { name: 'Test' },
        metadata: {
          size: 1000,
          priority: 'medium',
        },
      });

      service.cacheQRScan({
        qrCode: 'QR456',
        artifactId: 'artifact-1',
        siteId: 'site-1',
        basicInfo: { name: 'Test', description: 'Test description' },
      });

      service.clearAllCache();

      expect(service.getCachedContent('test-content-5')).toBeNull();
      expect(service.getCachedQRScan('QR456')).toBeNull();
      
      const stats = service.getCacheStats();
      expect(stats.totalItems).toBe(0);
    });
  });

  describe('cleanupExpiredContent', () => {
    it('should remove expired content', async () => {
      const pastDate = new Date(Date.now() - 1000);
      
      await service.cacheContent({
        id: 'expired-1',
        type: 'artifact',
        siteId: 'site-1',
        language: 'en',
        data: { name: 'Expired' },
        metadata: {
          size: 1000,
          priority: 'low',
          expiresAt: pastDate,
        },
      });

      await service.cacheContent({
        id: 'valid-1',
        type: 'artifact',
        siteId: 'site-1',
        language: 'en',
        data: { name: 'Valid' },
        metadata: {
          size: 1000,
          priority: 'medium',
        },
      });

      service.cleanupExpiredContent();

      expect(service.isContentAvailableOffline('expired-1')).toBe(false);
      expect(service.isContentAvailableOffline('valid-1')).toBe(true);
    });
  });

  describe('getCacheStats', () => {
    it('should return accurate cache statistics', async () => {
      await service.cacheContent({
        id: 'artifact-1',
        type: 'artifact',
        siteId: 'site-1',
        language: 'en',
        data: { name: 'Artifact 1' },
        metadata: {
          size: 1000,
          priority: 'high',
        },
      });

      await service.cacheContent({
        id: 'audio-1',
        type: 'audio',
        siteId: 'site-1',
        language: 'en',
        data: { url: 'audio.mp3' },
        metadata: {
          size: 5000,
          priority: 'medium',
        },
      });

      const stats = service.getCacheStats();
      
      expect(stats.totalItems).toBe(2);
      expect(stats.totalSize).toBe(6000);
      expect(stats.itemsByType.artifact).toBe(1);
      expect(stats.itemsByType.audio).toBe(1);
    });

    it('should calculate cache hit rate', async () => {
      await service.cacheContent({
        id: 'test-1',
        type: 'artifact',
        siteId: 'site-1',
        language: 'en',
        data: { name: 'Test' },
        metadata: {
          size: 1000,
          priority: 'medium',
        },
      });

      // 2 hits
      service.getCachedContent('test-1');
      service.getCachedContent('test-1');
      
      // 1 miss
      service.getCachedContent('non-existent');

      const stats = service.getCacheStats();
      expect(stats.cacheHitRate).toBeCloseTo(2 / 3, 2);
    });
  });

  describe('exportCache and importCache', () => {
    it('should export and import cache successfully', async () => {
      await service.cacheContent({
        id: 'test-export',
        type: 'artifact',
        siteId: 'site-1',
        language: 'en',
        data: { name: 'Export Test' },
        metadata: {
          size: 1000,
          priority: 'high',
        },
      });

      service.cacheQRScan({
        qrCode: 'QR789',
        artifactId: 'artifact-1',
        siteId: 'site-1',
        basicInfo: { name: 'Test', description: 'Test description' },
      });

      const exported = service.exportCache();
      
      expect(exported.content).toHaveLength(1);
      expect(exported.qrScans).toHaveLength(1);

      // Create new service and import
      const newService = new OfflineCacheService();
      newService.importCache(exported);

      const imported = newService.getCachedContent('test-export');
      expect(imported).toBeDefined();
      expect(imported?.data.name).toBe('Export Test');

      const importedQR = newService.getCachedQRScan('QR789');
      expect(importedQR).toBeDefined();
    });
  });
});
