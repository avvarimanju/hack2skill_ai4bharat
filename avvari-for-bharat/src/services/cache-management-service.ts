// Cache Management Service for intelligent content caching
import { ContentCacheRepository, CachedContent } from '../repositories/content-cache-repository';
import { MultimediaContent, ContentType, Language } from '../models/common';
import { logger } from '../utils/logger';

export interface CacheStrategy {
  defaultTTL: number; // seconds
  priorityMultiplier: number;
  maxCacheSize?: number;
}

export interface CachePriority {
  contentId: string;
  priority: number;
  reason: string;
}

export interface CacheRefreshRequest {
  contentId: string;
  content: MultimediaContent;
  force?: boolean;
}

export interface CacheInvalidationRequest {
  scope: 'content' | 'artifact' | 'site';
  id: string;
}

export interface CacheMetrics {
  totalItems: number;
  hitRate: number;
  missRate: number;
  averageAccessCount: number;
  topContent: Array<{
    contentId: string;
    accessCount: number;
    contentType: ContentType;
  }>;
}

export class CacheManagementService {
  private readonly cacheRepository: ContentCacheRepository;
  private readonly defaultStrategy: CacheStrategy;
  private readonly priorityThresholds: {
    high: number;
    medium: number;
    low: number;
  };

  constructor(cacheRepository?: ContentCacheRepository) {
    this.cacheRepository = cacheRepository || new ContentCacheRepository();
    
    // Default caching strategy
    this.defaultStrategy = {
      defaultTTL: 3600, // 1 hour
      priorityMultiplier: 2,
      maxCacheSize: 10000,
    };

    // Priority thresholds based on access count
    this.priorityThresholds = {
      high: 100,
      medium: 50,
      low: 10,
    };

    logger.info('Cache management service initialized');
  }

  /**
   * Cache content with intelligent TTL based on priority
   */
  public async cacheContent(
    content: MultimediaContent,
    priority?: 'high' | 'medium' | 'low'
  ): Promise<void> {
    logger.info('Caching content with priority', {
      contentId: content.contentId,
      contentType: content.contentType,
      priority: priority || 'medium',
    });

    // Calculate TTL based on priority
    let ttl = this.defaultStrategy.defaultTTL;
    
    if (priority === 'high') {
      ttl = ttl * 4; // 4 hours
    } else if (priority === 'low') {
      ttl = ttl / 2; // 30 minutes
    }

    // Check cache size and evict if necessary
    await this.evictIfNecessary();

    await this.cacheRepository.cacheContent(content, ttl);
  }

  /**
   * Get cached content with automatic priority adjustment
   */
  public async getCachedContent(contentId: string): Promise<MultimediaContent | null> {
    logger.debug('Getting cached content', { contentId });

    const cachedContent = await this.cacheRepository.getCachedContent(contentId);
    
    if (!cachedContent) {
      return null;
    }

    // Automatically extend TTL for frequently accessed content
    await this.adjustTTLBasedOnAccess(cachedContent);

    return cachedContent;
  }

  /**
   * Get cached content by artifact with fallback
   */
  public async getCachedContentByArtifact(
    artifactId: string,
    contentType: ContentType,
    language: Language
  ): Promise<MultimediaContent | null> {
    logger.debug('Getting cached content by artifact', {
      artifactId,
      contentType,
      language,
    });

    return await this.cacheRepository.getCachedContentByArtifact(
      artifactId,
      contentType,
      language
    );
  }

  /**
   * Refresh cache for specific content
   */
  public async refreshCache(request: CacheRefreshRequest): Promise<void> {
    logger.info('Refreshing cache', {
      contentId: request.contentId,
      force: request.force,
    });

    if (request.force) {
      // Force refresh - delete and re-cache
      await this.cacheRepository.delete({ contentId: request.contentId });
      await this.cacheContent(request.content);
    } else {
      // Check if content exists and is still valid
      const existing = await this.cacheRepository.getCachedContent(request.contentId);
      
      if (!existing) {
        // Content not in cache, add it
        await this.cacheContent(request.content);
      } else {
        // Extend TTL for existing content
        await this.cacheRepository.extendContentTTL(request.contentId, 3600);
      }
    }
  }

  /**
   * Invalidate cache based on scope
   */
  public async invalidateCache(request: CacheInvalidationRequest): Promise<number> {
    logger.info('Invalidating cache', {
      scope: request.scope,
      id: request.id,
    });

    let deletedCount = 0;

    switch (request.scope) {
      case 'content':
        await this.cacheRepository.delete({ contentId: request.id });
        deletedCount = 1;
        break;
      
      case 'artifact':
        deletedCount = await this.cacheRepository.invalidateArtifactCache(request.id);
        break;
      
      case 'site':
        deletedCount = await this.cacheRepository.invalidateSiteCache(request.id);
        break;
    }

    logger.info('Cache invalidated', { scope: request.scope, deletedCount });
    return deletedCount;
  }

  /**
   * Calculate cache priorities based on access patterns
   */
  public async calculateCachePriorities(): Promise<CachePriority[]> {
    logger.debug('Calculating cache priorities');

    const stats = await this.cacheRepository.getCacheStatistics();
    const priorities: CachePriority[] = [];

    for (const content of stats.topAccessedContent) {
      let priority = 0;
      let reason = '';

      if (content.accessCount >= this.priorityThresholds.high) {
        priority = 3;
        reason = 'High access frequency';
      } else if (content.accessCount >= this.priorityThresholds.medium) {
        priority = 2;
        reason = 'Medium access frequency';
      } else if (content.accessCount >= this.priorityThresholds.low) {
        priority = 1;
        reason = 'Low access frequency';
      } else {
        priority = 0;
        reason = 'Minimal access';
      }

      priorities.push({
        contentId: content.contentId,
        priority,
        reason,
      });
    }

    return priorities;
  }

  /**
   * Preload high-priority content
   */
  public async preloadHighPriorityContent(
    artifactId: string,
    contentItems: MultimediaContent[]
  ): Promise<void> {
    logger.info('Preloading high-priority content', {
      artifactId,
      contentCount: contentItems.length,
    });

    // Use longer TTL for preloaded content
    const ttl = this.defaultStrategy.defaultTTL * 4; // 4 hours

    await this.cacheRepository.preloadArtifactContent(
      artifactId,
      contentItems,
      ttl
    );
  }

  /**
   * Clean up expired and low-priority content
   */
  public async cleanupCache(): Promise<{
    expiredDeleted: number;
    lowPriorityDeleted: number;
  }> {
    logger.info('Cleaning up cache');

    // Clean up expired content
    const expiredDeleted = await this.cacheRepository.cleanupExpiredContent();

    // Clean up low-priority content if cache is too large
    let lowPriorityDeleted = 0;
    const stats = await this.cacheRepository.getCacheStatistics();

    if (
      this.defaultStrategy.maxCacheSize &&
      stats.totalCachedItems > this.defaultStrategy.maxCacheSize
    ) {
      lowPriorityDeleted = await this.evictLowPriorityContent(
        stats.totalCachedItems - this.defaultStrategy.maxCacheSize
      );
    }

    logger.info('Cache cleanup completed', {
      expiredDeleted,
      lowPriorityDeleted,
    });

    return {
      expiredDeleted,
      lowPriorityDeleted,
    };
  }

  /**
   * Get cache metrics
   */
  public async getCacheMetrics(): Promise<CacheMetrics> {
    logger.debug('Getting cache metrics');

    const stats = await this.cacheRepository.getCacheStatistics();
    const repoStats = this.cacheRepository.getContentCacheStats();

    return {
      totalItems: stats.totalCachedItems,
      hitRate: repoStats.hitRate || 0,
      missRate: repoStats.hitRate ? 1 - repoStats.hitRate : 1,
      averageAccessCount: stats.averageAccessCount,
      topContent: stats.topAccessedContent.map(c => ({
        contentId: c.contentId,
        accessCount: c.accessCount,
        contentType: c.contentType,
      })),
    };
  }

  /**
   * Get cache statistics
   */
  public async getCacheStatistics(): Promise<{
    totalCachedItems: number;
    totalAccessCount: number;
    averageAccessCount: number;
    contentTypeDistribution: Record<ContentType, number>;
    languageDistribution: Record<Language, number>;
    expiringWithin24Hours: number;
  }> {
    return await this.cacheRepository.getCacheStatistics();
  }

  /**
   * Adjust TTL based on access patterns
   */
  private async adjustTTLBasedOnAccess(content: CachedContent): Promise<void> {
    // Extend TTL for frequently accessed content
    if (content.accessCount >= this.priorityThresholds.high) {
      // High priority - extend by 4 hours
      await this.cacheRepository.extendContentTTL(
        content.contentId,
        4 * 3600
      );
    } else if (content.accessCount >= this.priorityThresholds.medium) {
      // Medium priority - extend by 2 hours
      await this.cacheRepository.extendContentTTL(
        content.contentId,
        2 * 3600
      );
    }
    // Low priority content - no extension
  }

  /**
   * Evict content if cache size exceeds limit
   */
  private async evictIfNecessary(): Promise<void> {
    if (!this.defaultStrategy.maxCacheSize) {
      return;
    }

    const stats = await this.cacheRepository.getCacheStatistics();

    if (stats.totalCachedItems >= this.defaultStrategy.maxCacheSize) {
      logger.info('Cache size limit reached, evicting low-priority content');
      await this.evictLowPriorityContent(1);
    }
  }

  /**
   * Evict low-priority content
   */
  private async evictLowPriorityContent(count: number): Promise<number> {
    logger.debug('Evicting low-priority content', { count });

    const stats = await this.cacheRepository.getCacheStatistics();
    
    // Get all content sorted by access count (ascending)
    const allContent = stats.topAccessedContent;
    
    // Find content with lowest access counts
    const toEvict = allContent
      .sort((a, b) => a.accessCount - b.accessCount)
      .slice(0, count);

    let evictedCount = 0;
    for (const content of toEvict) {
      await this.cacheRepository.delete({ contentId: content.contentId });
      evictedCount++;
    }

    logger.info('Evicted low-priority content', { evictedCount });
    return evictedCount;
  }

  /**
   * Set cache strategy
   */
  public setCacheStrategy(strategy: Partial<CacheStrategy>): void {
    Object.assign(this.defaultStrategy, strategy);
    logger.info('Cache strategy updated', { strategy: this.defaultStrategy });
  }

  /**
   * Get current cache strategy
   */
  public getCacheStrategy(): CacheStrategy {
    return { ...this.defaultStrategy };
  }
}
