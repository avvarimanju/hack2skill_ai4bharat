// Content Cache repository for DynamoDB operations
import { BaseRepository } from './base-repository';
import { MultimediaContent, ValidationResult, ContentType, Language } from '../models/common';
import { validateMultimediaContent } from '../utils/validation';
import { TABLES } from '../utils/aws-clients';
import { logger } from '../utils/logger';

export interface CachedContent extends MultimediaContent {
  accessCount: number;
  lastAccessed: string;
  expiresAt: string;
}

export class ContentCacheRepository extends BaseRepository<CachedContent> {
  constructor() {
    super(
      TABLES.CONTENT_CACHE,
      {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
      },
      true, // Enable caching
      900000 // 15 minutes cache TTL for content cache entries
    );
  }

  protected validateEntity(content: CachedContent): ValidationResult {
    // Validate the base multimedia content
    const baseValidation = validateMultimediaContent(content);
    if (!baseValidation.success) {
      return { isValid: false, errors: baseValidation.errors };
    }

    // Additional validation for cached content
    const errors: string[] = [];
    
    if (typeof content.accessCount !== 'number' || content.accessCount < 0) {
      errors.push('Access count must be a non-negative number');
    }
    
    if (!content.lastAccessed || isNaN(Date.parse(content.lastAccessed))) {
      errors.push('Last accessed timestamp is required and must be valid');
    }
    
    if (!content.expiresAt || isNaN(Date.parse(content.expiresAt))) {
      errors.push('Expires at timestamp is required and must be valid');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  protected getPrimaryKey(content: CachedContent): Record<string, any> {
    return { contentId: content.contentId };
  }

  protected getCacheKey(key: Record<string, any>): string {
    return `content-cache:${key.contentId}`;
  }

  /**
   * Get cached content by ID
   */
  public async getCachedContent(contentId: string): Promise<CachedContent | null> {
    logger.debug('Getting cached content by ID', { contentId });
    
    const content = await this.get({ contentId });
    
    if (content) {
      // Check if content has expired
      const now = new Date();
      const expiresAt = new Date(content.expiresAt);
      
      if (now > expiresAt) {
        logger.debug('Cached content has expired, removing', { contentId, expiresAt });
        await this.delete({ contentId });
        return null;
      }
      
      // Update access count and last accessed time
      await this.updateAccessMetrics(contentId);
    }
    
    return content;
  }

  /**
   * Cache content with TTL
   */
  public async cacheContent(
    content: MultimediaContent,
    ttlSeconds: number = 3600
  ): Promise<void> {
    logger.info('Caching content', { 
      contentId: content.contentId,
      contentType: content.contentType,
      language: content.language,
      ttlSeconds 
    });
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    
    const cachedContent: CachedContent = {
      ...content,
      accessCount: 0,
      lastAccessed: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    
    await this.put(cachedContent, { overwrite: true });
  }

  /**
   * Update access metrics for cached content
   */
  private async updateAccessMetrics(contentId: string): Promise<void> {
    const now = new Date().toISOString();
    
    await this.update(
      { contentId },
      {
        accessCount: { $add: 1 }, // DynamoDB atomic counter
        lastAccessed: now,
      }
    ).catch(error => {
      // If atomic update fails, try regular update
      logger.warn('Atomic update failed, using regular update', { contentId, error: error.message });
      
      return this.get({ contentId }).then(content => {
        if (content) {
          return this.update(
            { contentId },
            {
              accessCount: content.accessCount + 1,
              lastAccessed: now,
            }
          );
        }
        return undefined;
      }).catch(updateError => {
        logger.error('Failed to update access metrics', { contentId, error: updateError.message });
        return undefined;
      });
    });
  }

  /**
   * Get cached content by artifact and type
   */
  public async getCachedContentByArtifact(
    artifactId: string,
    contentType: ContentType,
    language: Language
  ): Promise<CachedContent | null> {
    logger.debug('Getting cached content by artifact', { artifactId, contentType, language });
    
    const results = await this.scan({
      FilterExpression: 'artifactId = :artifactId AND contentType = :contentType AND #lang = :language',
      ExpressionAttributeNames: {
        '#lang': 'language',
      },
      ExpressionAttributeValues: {
        ':artifactId': artifactId,
        ':contentType': contentType,
        ':language': language,
      },
    });
    
    if (results.length === 0) {
      return null;
    }
    
    // Return the most recently accessed content if multiple exist
    const sortedResults = results.sort((a, b) => 
      new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
    );
    
    const content = sortedResults[0];
    
    // Check if content has expired
    const now = new Date();
    const expiresAt = new Date(content.expiresAt);
    
    if (now > expiresAt) {
      logger.debug('Cached content has expired, removing', { contentId: content.contentId, expiresAt });
      await this.delete({ contentId: content.contentId });
      return null;
    }
    
    // Update access metrics
    await this.updateAccessMetrics(content.contentId);
    
    return content;
  }

  /**
   * Get most frequently accessed content
   */
  public async getMostAccessedContent(limit: number = 10): Promise<CachedContent[]> {
    logger.debug('Getting most accessed content', { limit });
    
    const allContent = await this.scan();
    
    // Filter out expired content
    const now = new Date();
    const validContent = allContent.filter(content => {
      const expiresAt = new Date(content.expiresAt);
      return now <= expiresAt;
    });
    
    // Sort by access count and return top results
    return validContent
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  /**
   * Get content by site
   */
  public async getCachedContentBySite(siteId: string): Promise<CachedContent[]> {
    logger.debug('Getting cached content by site', { siteId });
    
    const results = await this.scan({
      FilterExpression: 'metadata.siteId = :siteId',
      ExpressionAttributeValues: {
        ':siteId': siteId,
      },
    });
    
    // Filter out expired content
    const now = new Date();
    return results.filter(content => {
      const expiresAt = new Date(content.expiresAt);
      return now <= expiresAt;
    });
  }

  /**
   * Clean up expired content
   */
  public async cleanupExpiredContent(): Promise<number> {
    logger.info('Cleaning up expired content');
    
    const now = new Date().toISOString();
    
    const expiredContent = await this.scan({
      FilterExpression: 'expiresAt < :now',
      ExpressionAttributeValues: {
        ':now': now,
      },
    });
    
    if (expiredContent.length === 0) {
      return 0;
    }
    
    // Delete in batches
    const batchSize = 25; // DynamoDB batch write limit
    let deletedCount = 0;
    
    for (let i = 0; i < expiredContent.length; i += batchSize) {
      const batch = expiredContent.slice(i, i + batchSize);
      const deleteKeys = batch.map(content => ({ contentId: content.contentId }));
      
      await this.batchWrite([], deleteKeys);
      deletedCount += batch.length;
    }
    
    logger.info('Cleaned up expired content', { deletedCount });
    return deletedCount;
  }

  /**
   * Extend content TTL
   */
  public async extendContentTTL(contentId: string, additionalSeconds: number): Promise<CachedContent | null> {
    logger.debug('Extending content TTL', { contentId, additionalSeconds });
    
    const content = await this.get({ contentId });
    if (!content) {
      return null;
    }
    
    const currentExpiresAt = new Date(content.expiresAt);
    const newExpiresAt = new Date(currentExpiresAt.getTime() + additionalSeconds * 1000);
    
    return await this.update(
      { contentId },
      { expiresAt: newExpiresAt.toISOString() }
    );
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
    topAccessedContent: Array<{
      contentId: string;
      artifactId: string;
      contentType: ContentType;
      language: Language;
      accessCount: number;
    }>;
  }> {
    logger.debug('Getting cache statistics');
    
    const allContent = await this.scan();
    
    // Filter out expired content
    const now = new Date();
    const validContent = allContent.filter(content => {
      const expiresAt = new Date(content.expiresAt);
      return now <= expiresAt;
    });
    
    const totalCachedItems = validContent.length;
    const totalAccessCount = validContent.reduce((sum, content) => sum + content.accessCount, 0);
    const averageAccessCount = totalCachedItems > 0 ? totalAccessCount / totalCachedItems : 0;
    
    // Content type distribution
    const contentTypeDistribution: Record<ContentType, number> = {} as Record<ContentType, number>;
    for (const content of validContent) {
      contentTypeDistribution[content.contentType] = 
        (contentTypeDistribution[content.contentType] || 0) + 1;
    }
    
    // Language distribution
    const languageDistribution: Record<Language, number> = {} as Record<Language, number>;
    for (const content of validContent) {
      languageDistribution[content.language] = 
        (languageDistribution[content.language] || 0) + 1;
    }
    
    // Content expiring within 24 hours
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const expiringWithin24Hours = validContent.filter(content => {
      const expiresAt = new Date(content.expiresAt);
      return expiresAt <= twentyFourHoursFromNow;
    }).length;
    
    // Top accessed content
    const topAccessedContent = validContent
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map(content => ({
        contentId: content.contentId,
        artifactId: content.artifactId,
        contentType: content.contentType,
        language: content.language,
        accessCount: content.accessCount,
      }));
    
    return {
      totalCachedItems,
      totalAccessCount,
      averageAccessCount,
      contentTypeDistribution,
      languageDistribution,
      expiringWithin24Hours,
      topAccessedContent,
    };
  }

  /**
   * Invalidate cache for specific artifact
   */
  public async invalidateArtifactCache(artifactId: string): Promise<number> {
    logger.info('Invalidating cache for artifact', { artifactId });
    
    const artifactContent = await this.scan({
      FilterExpression: 'artifactId = :artifactId',
      ExpressionAttributeValues: {
        ':artifactId': artifactId,
      },
    });
    
    if (artifactContent.length === 0) {
      return 0;
    }
    
    // Delete all content for this artifact
    const deleteKeys = artifactContent.map(content => ({ contentId: content.contentId }));
    await this.batchWrite([], deleteKeys);
    
    logger.info('Invalidated artifact cache', { artifactId, deletedCount: artifactContent.length });
    return artifactContent.length;
  }

  /**
   * Invalidate cache for specific site
   */
  public async invalidateSiteCache(siteId: string): Promise<number> {
    logger.info('Invalidating cache for site', { siteId });
    
    const siteContent = await this.getCachedContentBySite(siteId);
    
    if (siteContent.length === 0) {
      return 0;
    }
    
    // Delete all content for this site
    const deleteKeys = siteContent.map(content => ({ contentId: content.contentId }));
    await this.batchWrite([], deleteKeys);
    
    logger.info('Invalidated site cache', { siteId, deletedCount: siteContent.length });
    return siteContent.length;
  }

  /**
   * Preload content for artifact
   */
  public async preloadArtifactContent(
    artifactId: string,
    contentItems: MultimediaContent[],
    ttlSeconds: number = 3600
  ): Promise<void> {
    logger.info('Preloading content for artifact', { 
      artifactId, 
      contentCount: contentItems.length,
      ttlSeconds 
    });
    
    const cachePromises = contentItems.map(content => 
      this.cacheContent(content, ttlSeconds)
    );
    
    await Promise.all(cachePromises);
  }

  /**
   * Get content cache repository specific cache stats
   */
  public getContentCacheStats(): { size: number; hitRate?: number } {
    return this.getCacheStats();
  }
}