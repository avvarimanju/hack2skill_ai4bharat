// Offline Content Caching Service
import { logger } from '../utils/logger';

export interface CachedContent {
  id: string;
  type: 'artifact' | 'audio' | 'video' | 'image' | 'infographic' | 'site-info';
  siteId: string;
  artifactId?: string;
  language: string;
  data: any;
  metadata: {
    size: number;
    cachedAt: Date;
    lastAccessedAt: Date;
    expiresAt?: Date;
    priority: 'essential' | 'high' | 'medium' | 'low';
  };
}

export interface QRScanCache {
  qrCode: string;
  artifactId: string;
  siteId: string;
  basicInfo: {
    name: string;
    description: string;
    period?: string;
    significance?: string;
  };
  cachedAt: Date;
}

export interface OfflineCacheStats {
  totalItems: number;
  totalSize: number;
  itemsByType: Record<string, number>;
  lastSyncAt?: Date;
  cacheHitRate: number;
}

export class OfflineCacheService {
  private cache: Map<string, CachedContent>;
  private qrCache: Map<string, QRScanCache>;
  private readonly maxCacheSize: number;
  private readonly maxItemAge: number;
  private cacheHits: number;
  private cacheMisses: number;

  constructor(maxCacheSizeMB: number = 100, maxItemAgeDays: number = 30) {
    this.cache = new Map();
    this.qrCache = new Map();
    this.maxCacheSize = maxCacheSizeMB * 1024 * 1024; // Convert to bytes
    this.maxItemAge = maxItemAgeDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
    this.cacheHits = 0;
    this.cacheMisses = 0;

    logger.info('Offline cache service initialized', {
      maxCacheSizeMB,
      maxItemAgeDays,
    });
  }

  /**
   * Cache content for offline access
   */
  public async cacheContent(content: Omit<CachedContent, 'metadata'> & { 
    metadata: Omit<CachedContent['metadata'], 'cachedAt' | 'lastAccessedAt'> 
  }): Promise<void> {
    const now = new Date();
    
    const cachedContent: CachedContent = {
      ...content,
      metadata: {
        ...content.metadata,
        cachedAt: now,
        lastAccessedAt: now,
      },
    };

    // Check if adding this content would exceed cache size
    const currentSize = this.getCurrentCacheSize();
    if (currentSize + content.metadata.size > this.maxCacheSize) {
      await this.evictLowPriorityContent(content.metadata.size);
    }

    this.cache.set(content.id, cachedContent);

    logger.debug('Content cached for offline access', {
      id: content.id,
      type: content.type,
      size: content.metadata.size,
    });
  }

  /**
   * Get cached content
   */
  public getCachedContent(id: string): CachedContent | null {
    const content = this.cache.get(id);

    if (!content) {
      this.cacheMisses++;
      logger.debug('Cache miss', { id });
      return null;
    }

    // Check if content has expired
    if (content.metadata.expiresAt && content.metadata.expiresAt < new Date()) {
      this.cache.delete(id);
      this.cacheMisses++;
      logger.debug('Cached content expired', { id });
      return null;
    }

    // Update last accessed time
    content.metadata.lastAccessedAt = new Date();
    this.cacheHits++;

    logger.debug('Cache hit', { id, type: content.type });
    return content;
  }

  /**
   * Cache QR code scan data for offline access
   */
  public cacheQRScan(qrData: Omit<QRScanCache, 'cachedAt'>): void {
    const qrCache: QRScanCache = {
      ...qrData,
      cachedAt: new Date(),
    };

    this.qrCache.set(qrData.qrCode, qrCache);

    logger.debug('QR scan cached', {
      qrCode: qrData.qrCode,
      artifactId: qrData.artifactId,
    });
  }

  /**
   * Get cached QR scan data
   */
  public getCachedQRScan(qrCode: string): QRScanCache | null {
    const qrData = this.qrCache.get(qrCode);

    if (!qrData) {
      logger.debug('QR cache miss', { qrCode });
      return null;
    }

    logger.debug('QR cache hit', { qrCode });
    return qrData;
  }

  /**
   * Cache essential content for a site visit
   */
  public async cacheEssentialSiteContent(
    siteId: string,
    language: string,
    content: {
      siteInfo: any;
      artifacts: Array<{ id: string; data: any }>;
      audioGuides: Array<{ artifactId: string; data: any; size: number }>;
    }
  ): Promise<void> {
    // Cache site information
    await this.cacheContent({
      id: `site-${siteId}-${language}`,
      type: 'site-info',
      siteId,
      language,
      data: content.siteInfo,
      metadata: {
        size: JSON.stringify(content.siteInfo).length,
        priority: 'essential',
      },
    });

    // Cache artifact data
    for (const artifact of content.artifacts) {
      await this.cacheContent({
        id: `artifact-${artifact.id}-${language}`,
        type: 'artifact',
        siteId,
        artifactId: artifact.id,
        language,
        data: artifact.data,
        metadata: {
          size: JSON.stringify(artifact.data).length,
          priority: 'essential',
        },
      });
    }

    // Cache audio guides
    for (const audioGuide of content.audioGuides) {
      await this.cacheContent({
        id: `audio-${audioGuide.artifactId}-${language}`,
        type: 'audio',
        siteId,
        artifactId: audioGuide.artifactId,
        language,
        data: audioGuide.data,
        metadata: {
          size: audioGuide.size,
          priority: 'high',
        },
      });
    }

    logger.info('Essential site content cached', {
      siteId,
      language,
      artifactCount: content.artifacts.length,
      audioGuideCount: content.audioGuides.length,
    });
  }

  /**
   * Get offline audio guide
   */
  public getOfflineAudioGuide(artifactId: string, language: string): any | null {
    const content = this.getCachedContent(`audio-${artifactId}-${language}`);
    return content ? content.data : null;
  }

  /**
   * Get offline artifact information
   */
  public getOfflineArtifactInfo(artifactId: string, language: string): any | null {
    const content = this.getCachedContent(`artifact-${artifactId}-${language}`);
    return content ? content.data : null;
  }

  /**
   * Get offline site information
   */
  public getOfflineSiteInfo(siteId: string, language: string): any | null {
    const content = this.getCachedContent(`site-${siteId}-${language}`);
    return content ? content.data : null;
  }

  /**
   * Check if content is available offline
   */
  public isContentAvailableOffline(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Get all cached content for a site
   */
  public getCachedSiteContent(siteId: string, language: string): {
    siteInfo: any | null;
    artifacts: Array<{ id: string; data: any }>;
    audioGuides: Array<{ artifactId: string; data: any }>;
  } {
    const siteInfo = this.getOfflineSiteInfo(siteId, language);
    const artifacts: Array<{ id: string; data: any }> = [];
    const audioGuides: Array<{ artifactId: string; data: any }> = [];

    // Find all cached artifacts and audio guides for this site
    for (const [id, content] of this.cache.entries()) {
      if (content.siteId === siteId && content.language === language) {
        if (content.type === 'artifact' && content.artifactId) {
          artifacts.push({
            id: content.artifactId,
            data: content.data,
          });
        } else if (content.type === 'audio' && content.artifactId) {
          audioGuides.push({
            artifactId: content.artifactId,
            data: content.data,
          });
        }
      }
    }

    return { siteInfo, artifacts, audioGuides };
  }

  /**
   * Clear cache for a specific site
   */
  public clearSiteCache(siteId: string): void {
    const keysToDelete: string[] = [];

    for (const [id, content] of this.cache.entries()) {
      if (content.siteId === siteId) {
        keysToDelete.push(id);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    logger.info('Site cache cleared', { siteId, itemsRemoved: keysToDelete.length });
  }

  /**
   * Clear all cached content
   */
  public clearAllCache(): void {
    const itemCount = this.cache.size;
    this.cache.clear();
    this.qrCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;

    logger.info('All cache cleared', { itemsRemoved: itemCount });
  }

  /**
   * Get current cache size in bytes
   */
  private getCurrentCacheSize(): number {
    let totalSize = 0;
    for (const content of this.cache.values()) {
      totalSize += content.metadata.size;
    }
    return totalSize;
  }

  /**
   * Evict low priority content to make space
   */
  private async evictLowPriorityContent(requiredSpace: number): Promise<void> {
    const priorityOrder = ['low', 'medium', 'high', 'essential'];
    let freedSpace = 0;

    // Sort cache items by priority (lowest first) and last accessed time (oldest first)
    const sortedItems = Array.from(this.cache.entries()).sort((a, b) => {
      const priorityDiff = 
        priorityOrder.indexOf(a[1].metadata.priority) - 
        priorityOrder.indexOf(b[1].metadata.priority);
      
      if (priorityDiff !== 0) return priorityDiff;
      
      return a[1].metadata.lastAccessedAt.getTime() - b[1].metadata.lastAccessedAt.getTime();
    });

    // Evict items until we have enough space
    for (const [id, content] of sortedItems) {
      if (freedSpace >= requiredSpace) break;
      
      // Don't evict essential content
      if (content.metadata.priority === 'essential') continue;

      this.cache.delete(id);
      freedSpace += content.metadata.size;

      logger.debug('Content evicted from cache', {
        id,
        type: content.type,
        priority: content.metadata.priority,
        size: content.metadata.size,
      });
    }

    logger.info('Cache eviction completed', {
      freedSpace,
      requiredSpace,
    });
  }

  /**
   * Clean up expired content
   */
  public cleanupExpiredContent(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [id, content] of this.cache.entries()) {
      // Check expiration date
      if (content.metadata.expiresAt && content.metadata.expiresAt < now) {
        keysToDelete.push(id);
        continue;
      }

      // Check max age
      const age = now.getTime() - content.metadata.cachedAt.getTime();
      if (age > this.maxItemAge) {
        keysToDelete.push(id);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    logger.info('Expired content cleaned up', { itemsRemoved: keysToDelete.length });
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): OfflineCacheStats {
    const itemsByType: Record<string, number> = {};
    let totalSize = 0;

    for (const content of this.cache.values()) {
      itemsByType[content.type] = (itemsByType[content.type] || 0) + 1;
      totalSize += content.metadata.size;
    }

    const totalRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    return {
      totalItems: this.cache.size,
      totalSize,
      itemsByType,
      cacheHitRate,
    };
  }

  /**
   * Export cache for persistence
   */
  public exportCache(): {
    content: Array<CachedContent>;
    qrScans: Array<QRScanCache>;
    stats: { cacheHits: number; cacheMisses: number };
  } {
    return {
      content: Array.from(this.cache.values()),
      qrScans: Array.from(this.qrCache.values()),
      stats: {
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
      },
    };
  }

  /**
   * Import cache from persistence
   */
  public importCache(data: {
    content: Array<CachedContent>;
    qrScans: Array<QRScanCache>;
    stats?: { cacheHits: number; cacheMisses: number };
  }): void {
    this.cache.clear();
    this.qrCache.clear();

    for (const content of data.content) {
      this.cache.set(content.id, content);
    }

    for (const qrScan of data.qrScans) {
      this.qrCache.set(qrScan.qrCode, qrScan);
    }

    if (data.stats) {
      this.cacheHits = data.stats.cacheHits;
      this.cacheMisses = data.stats.cacheMisses;
    }

    logger.info('Cache imported', {
      contentItems: data.content.length,
      qrScans: data.qrScans.length,
    });
  }
}
