// Unit tests for CacheManagementService
import { CacheManagementService } from '../../src/services/cache-management-service';
import { ContentCacheRepository } from '../../src/repositories/content-cache-repository';
import { Language, ContentType } from '../../src/models/common';

// Mock dependencies
jest.mock('../../src/repositories/content-cache-repository');
jest.mock('../../src/utils/logger');

describe('CacheManagementService', () => {
  let service: CacheManagementService;
  let mockRepository: jest.Mocked<ContentCacheRepository>;

  // Helper function to create test content
  const createTestContent = (overrides: any = {}) => ({
    contentId: 'content-123',
    artifactId: 'artifact-456',
    contentType: 'image' as ContentType,
    language: Language.ENGLISH,
    data: {
      audioUrl: 'https://example.com/content',
      fileSize: 1024,
    },
    metadata: {
      siteId: 'site-123',
      artifactId: 'artifact-456',
      contentType: 'image' as ContentType,
      language: Language.ENGLISH,
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    },
    cacheSettings: {
      ttl: 3600,
      priority: 5,
      tags: [],
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock repository
    mockRepository = {
      cacheContent: jest.fn(),
      getCachedContent: jest.fn(),
      getCachedContentByArtifact: jest.fn(),
      delete: jest.fn(),
      extendContentTTL: jest.fn(),
      invalidateArtifactCache: jest.fn(),
      invalidateSiteCache: jest.fn(),
      preloadArtifactContent: jest.fn(),
      cleanupExpiredContent: jest.fn(),
      getCacheStatistics: jest.fn(),
      getContentCacheStats: jest.fn(),
    } as any;

    service = new CacheManagementService(mockRepository);
  });

  describe('cacheContent', () => {
    it('should cache content with default TTL', async () => {
      const content = createTestContent();

      mockRepository.getCacheStatistics.mockResolvedValue({
        totalCachedItems: 100,
        totalAccessCount: 500,
        averageAccessCount: 5,
        contentTypeDistribution: {},
        languageDistribution: {},
        expiringWithin24Hours: 10,
        topAccessedContent: [],
      });

      await service.cacheContent(content);

      expect(mockRepository.cacheContent).toHaveBeenCalledWith(content, 3600);
    });

    it('should cache content with high priority', async () => {
      const content = createTestContent({
        contentType: 'video' as ContentType,
        language: Language.HINDI,
      });

      mockRepository.getCacheStatistics.mockResolvedValue({
        totalCachedItems: 100,
        totalAccessCount: 500,
        averageAccessCount: 5,
        contentTypeDistribution: {},
        languageDistribution: {},
        expiringWithin24Hours: 10,
        topAccessedContent: [],
      });

      await service.cacheContent(content, 'high');

      expect(mockRepository.cacheContent).toHaveBeenCalledWith(content, 14400); // 4 hours
    });

    it('should cache content with low priority', async () => {
      const content = createTestContent({
        contentType: 'audio_guide' as ContentType,
        language: Language.TAMIL,
      });

      mockRepository.getCacheStatistics.mockResolvedValue({
        totalCachedItems: 100,
        totalAccessCount: 500,
        averageAccessCount: 5,
        contentTypeDistribution: {},
        languageDistribution: {},
        expiringWithin24Hours: 10,
        topAccessedContent: [],
      });

      await service.cacheContent(content, 'low');

      expect(mockRepository.cacheContent).toHaveBeenCalledWith(content, 1800); // 30 minutes
    });
  });

  describe('getCachedContent', () => {
    it('should get cached content and adjust TTL', async () => {
      const cachedContent = {
        contentId: 'content-123',
        artifactId: 'artifact-456',
        contentType: 'image' as ContentType,
        language: Language.ENGLISH,
        url: 'https://example.com/image.jpg',
        format: 'jpeg',
        size: 1024,
        metadata: {},
        accessCount: 150,
        lastAccessed: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      mockRepository.getCachedContent.mockResolvedValue(cachedContent);

      const result = await service.getCachedContent('content-123');

      expect(result).toEqual(cachedContent);
      expect(mockRepository.getCachedContent).toHaveBeenCalledWith('content-123');
      expect(mockRepository.extendContentTTL).toHaveBeenCalledWith('content-123', 14400);
    });

    it('should return null for cache miss', async () => {
      mockRepository.getCachedContent.mockResolvedValue(null);

      const result = await service.getCachedContent('content-123');

      expect(result).toBeNull();
    });

    it('should extend TTL for medium priority content', async () => {
      const cachedContent = {
        contentId: 'content-123',
        artifactId: 'artifact-456',
        contentType: 'video' as ContentType,
        language: Language.HINDI,
        url: 'https://example.com/video.mp4',
        format: 'mp4',
        size: 2048,
        metadata: {},
        accessCount: 75,
        lastAccessed: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      mockRepository.getCachedContent.mockResolvedValue(cachedContent);

      await service.getCachedContent('content-123');

      expect(mockRepository.extendContentTTL).toHaveBeenCalledWith('content-123', 7200);
    });

    it('should not extend TTL for low priority content', async () => {
      const cachedContent = {
        contentId: 'content-123',
        artifactId: 'artifact-456',
        contentType: 'audio' as ContentType,
        language: Language.TAMIL,
        url: 'https://example.com/audio.mp3',
        format: 'mp3',
        size: 512,
        metadata: {},
        accessCount: 5,
        lastAccessed: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      mockRepository.getCachedContent.mockResolvedValue(cachedContent);

      await service.getCachedContent('content-123');

      expect(mockRepository.extendContentTTL).not.toHaveBeenCalled();
    });
  });

  describe('getCachedContentByArtifact', () => {
    it('should get cached content by artifact', async () => {
      const cachedContent = {
        contentId: 'content-123',
        artifactId: 'artifact-456',
        contentType: 'image' as ContentType,
        language: Language.ENGLISH,
        url: 'https://example.com/image.jpg',
        format: 'jpeg',
        size: 1024,
        metadata: {},
        accessCount: 10,
        lastAccessed: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      mockRepository.getCachedContentByArtifact.mockResolvedValue(cachedContent);

      const result = await service.getCachedContentByArtifact(
        'artifact-456',
        'image' as ContentType,
        Language.ENGLISH
      );

      expect(result).toEqual(cachedContent);
      expect(mockRepository.getCachedContentByArtifact).toHaveBeenCalledWith(
        'artifact-456',
        'image',
        Language.ENGLISH
      );
    });
  });

  describe('refreshCache', () => {
    it('should force refresh cache', async () => {
      const content = createTestContent();

      mockRepository.getCacheStatistics.mockResolvedValue({
        totalCachedItems: 100,
        totalAccessCount: 500,
        averageAccessCount: 5,
        contentTypeDistribution: {},
        languageDistribution: {},
        expiringWithin24Hours: 10,
        topAccessedContent: [],
      });

      await service.refreshCache({
        contentId: 'content-123',
        content,
        force: true,
      });

      expect(mockRepository.delete).toHaveBeenCalledWith({ contentId: 'content-123' });
      expect(mockRepository.cacheContent).toHaveBeenCalled();
    });

    it('should refresh cache without force if content missing', async () => {
      const content = createTestContent({
        contentType: 'video' as ContentType,
        language: Language.HINDI,
      });

      mockRepository.getCachedContent.mockResolvedValue(null);
      mockRepository.getCacheStatistics.mockResolvedValue({
        totalCachedItems: 100,
        totalAccessCount: 500,
        averageAccessCount: 5,
        contentTypeDistribution: {},
        languageDistribution: {},
        expiringWithin24Hours: 10,
        topAccessedContent: [],
      });

      await service.refreshCache({
        contentId: 'content-123',
        content,
        force: false,
      });

      expect(mockRepository.cacheContent).toHaveBeenCalled();
    });

    it('should extend TTL if content exists and not forced', async () => {
      const content = createTestContent({
        contentType: 'audio_guide' as ContentType,
        language: Language.TAMIL,
      });

      const cachedContent = {
        ...content,
        accessCount: 10,
        lastAccessed: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      mockRepository.getCachedContent.mockResolvedValue(cachedContent);

      await service.refreshCache({
        contentId: 'content-123',
        content,
        force: false,
      });

      expect(mockRepository.extendContentTTL).toHaveBeenCalledWith('content-123', 3600);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate content cache', async () => {
      const result = await service.invalidateCache({
        scope: 'content',
        id: 'content-123',
      });

      expect(mockRepository.delete).toHaveBeenCalledWith({ contentId: 'content-123' });
      expect(result).toBe(1);
    });

    it('should invalidate artifact cache', async () => {
      mockRepository.invalidateArtifactCache.mockResolvedValue(5);

      const result = await service.invalidateCache({
        scope: 'artifact',
        id: 'artifact-456',
      });

      expect(mockRepository.invalidateArtifactCache).toHaveBeenCalledWith('artifact-456');
      expect(result).toBe(5);
    });

    it('should invalidate site cache', async () => {
      mockRepository.invalidateSiteCache.mockResolvedValue(10);

      const result = await service.invalidateCache({
        scope: 'site',
        id: 'site-789',
      });

      expect(mockRepository.invalidateSiteCache).toHaveBeenCalledWith('site-789');
      expect(result).toBe(10);
    });
  });

  describe('calculateCachePriorities', () => {
    it('should calculate priorities based on access counts', async () => {
      mockRepository.getCacheStatistics.mockResolvedValue({
        totalCachedItems: 3,
        totalAccessCount: 200,
        averageAccessCount: 66.67,
        contentTypeDistribution: {},
        languageDistribution: {},
        expiringWithin24Hours: 0,
        topAccessedContent: [
          {
            contentId: 'content-1',
            artifactId: 'artifact-1',
            contentType: 'image' as ContentType,
            language: Language.ENGLISH,
            accessCount: 150,
          },
          {
            contentId: 'content-2',
            artifactId: 'artifact-2',
            contentType: 'video' as ContentType,
            language: Language.HINDI,
            accessCount: 75,
          },
          {
            contentId: 'content-3',
            artifactId: 'artifact-3',
            contentType: 'audio' as ContentType,
            language: Language.TAMIL,
            accessCount: 5,
          },
        ],
      });

      const priorities = await service.calculateCachePriorities();

      expect(priorities).toHaveLength(3);
      expect(priorities[0]).toEqual({
        contentId: 'content-1',
        priority: 3,
        reason: 'High access frequency',
      });
      expect(priorities[1]).toEqual({
        contentId: 'content-2',
        priority: 2,
        reason: 'Medium access frequency',
      });
      expect(priorities[2]).toEqual({
        contentId: 'content-3',
        priority: 0,
        reason: 'Minimal access',
      });
    });
  });

  describe('preloadHighPriorityContent', () => {
    it('should preload content with extended TTL', async () => {
      const contentItems = [
        createTestContent({ contentId: 'content-1' }),
        createTestContent({ contentId: 'content-2', contentType: 'video' as ContentType }),
      ];

      await service.preloadHighPriorityContent('artifact-456', contentItems);

      expect(mockRepository.preloadArtifactContent).toHaveBeenCalledWith(
        'artifact-456',
        contentItems,
        14400 // 4 hours
      );
    });
  });

  describe('cleanupCache', () => {
    it('should cleanup expired and low-priority content', async () => {
      mockRepository.cleanupExpiredContent.mockResolvedValue(5);
      mockRepository.getCacheStatistics.mockResolvedValue({
        totalCachedItems: 100,
        totalAccessCount: 500,
        averageAccessCount: 5,
        contentTypeDistribution: {},
        languageDistribution: {},
        expiringWithin24Hours: 10,
        topAccessedContent: [],
      });

      const result = await service.cleanupCache();

      expect(result.expiredDeleted).toBe(5);
      expect(mockRepository.cleanupExpiredContent).toHaveBeenCalled();
    });
  });

  describe('getCacheMetrics', () => {
    it('should get cache metrics', async () => {
      mockRepository.getCacheStatistics.mockResolvedValue({
        totalCachedItems: 100,
        totalAccessCount: 500,
        averageAccessCount: 5,
        contentTypeDistribution: {},
        languageDistribution: {},
        expiringWithin24Hours: 10,
        topAccessedContent: [
          {
            contentId: 'content-1',
            artifactId: 'artifact-1',
            contentType: 'image' as ContentType,
            language: Language.ENGLISH,
            accessCount: 150,
          },
        ],
      });

      mockRepository.getContentCacheStats.mockReturnValue({
        size: 100,
        hitRate: 0.75,
      });

      const metrics = await service.getCacheMetrics();

      expect(metrics.totalItems).toBe(100);
      expect(metrics.hitRate).toBe(0.75);
      expect(metrics.missRate).toBe(0.25);
      expect(metrics.averageAccessCount).toBe(5);
      expect(metrics.topContent).toHaveLength(1);
    });
  });

  describe('getCacheStatistics', () => {
    it('should get detailed cache statistics', async () => {
      const stats = {
        totalCachedItems: 100,
        totalAccessCount: 500,
        averageAccessCount: 5,
        contentTypeDistribution: {} as any,
        languageDistribution: {} as any,
        expiringWithin24Hours: 10,
        topAccessedContent: [],
      };

      mockRepository.getCacheStatistics.mockResolvedValue(stats);

      const result = await service.getCacheStatistics();

      expect(result).toEqual(stats);
    });
  });

  describe('setCacheStrategy', () => {
    it('should update cache strategy', () => {
      service.setCacheStrategy({
        defaultTTL: 7200,
        priorityMultiplier: 3,
      });

      const strategy = service.getCacheStrategy();

      expect(strategy.defaultTTL).toBe(7200);
      expect(strategy.priorityMultiplier).toBe(3);
    });
  });

  describe('getCacheStrategy', () => {
    it('should get current cache strategy', () => {
      const strategy = service.getCacheStrategy();

      expect(strategy.defaultTTL).toBe(3600);
      expect(strategy.priorityMultiplier).toBe(2);
      expect(strategy.maxCacheSize).toBe(10000);
    });
  });
});
