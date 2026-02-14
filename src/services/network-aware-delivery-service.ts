// Network-Aware Content Delivery Service
import { logger } from '../utils/logger';

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
export type ContentQuality = 'ultra' | 'high' | 'medium' | 'low';
export type ContentPriority = 'critical' | 'high' | 'medium' | 'low';

export interface NetworkConditions {
  quality: NetworkQuality;
  bandwidth: number; // Mbps
  latency: number; // ms
  isOnline: boolean;
  connectionType?: string;
}

export interface ContentDeliveryOptions {
  contentType: 'video' | 'audio' | 'image' | 'infographic' | 'document';
  priority: ContentPriority;
  size: number; // bytes
  duration?: number; // seconds (for video/audio)
  allowProgressive?: boolean;
}

export interface AdaptiveQualityRecommendation {
  recommendedQuality: ContentQuality;
  shouldUseProgressive: boolean;
  estimatedLoadTime: number; // seconds
  shouldCache: boolean;
  fallbackQuality?: ContentQuality;
}

export interface ProgressiveLoadingStrategy {
  chunkSize: number; // bytes
  initialChunks: number;
  prefetchChunks: number;
  bufferSize: number; // bytes
}

export class NetworkAwareDeliveryService {
  private currentNetworkConditions: NetworkConditions;
  private readonly qualityThresholds: Map<NetworkQuality, { minBandwidth: number; maxLatency: number }>;

  constructor() {
    // Initialize with default network conditions
    this.currentNetworkConditions = {
      quality: 'good',
      bandwidth: 10, // 10 Mbps
      latency: 50, // 50ms
      isOnline: true,
    };

    // Define quality thresholds
    this.qualityThresholds = new Map([
      ['excellent', { minBandwidth: 25, maxLatency: 30 }],
      ['good', { minBandwidth: 10, maxLatency: 100 }],
      ['fair', { minBandwidth: 2, maxLatency: 300 }],
      ['poor', { minBandwidth: 0.5, maxLatency: 1000 }],
      ['offline', { minBandwidth: 0, maxLatency: Infinity }],
    ]);

    logger.info('Network-aware delivery service initialized');
  }

  /**
   * Update current network conditions
   */
  public updateNetworkConditions(conditions: Partial<NetworkConditions>): void {
    this.currentNetworkConditions = {
      ...this.currentNetworkConditions,
      ...conditions,
    };

    // Determine quality based on bandwidth and latency
    if (!this.currentNetworkConditions.isOnline) {
      this.currentNetworkConditions.quality = 'offline';
    } else {
      this.currentNetworkConditions.quality = this.determineNetworkQuality(
        this.currentNetworkConditions.bandwidth,
        this.currentNetworkConditions.latency
      );
    }

    logger.debug('Network conditions updated', {
      quality: this.currentNetworkConditions.quality,
      bandwidth: this.currentNetworkConditions.bandwidth,
      latency: this.currentNetworkConditions.latency,
    });
  }

  /**
   * Get current network conditions
   */
  public getNetworkConditions(): NetworkConditions {
    return { ...this.currentNetworkConditions };
  }

  /**
   * Determine network quality based on bandwidth and latency
   */
  private determineNetworkQuality(bandwidth: number, latency: number): NetworkQuality {
    if (bandwidth >= 25 && latency <= 30) return 'excellent';
    if (bandwidth >= 10 && latency <= 100) return 'good';
    if (bandwidth >= 2 && latency <= 300) return 'fair';
    if (bandwidth >= 0.5 && latency <= 1000) return 'poor';
    return 'offline';
  }

  /**
   * Get adaptive quality recommendation based on network conditions
   */
  public getAdaptiveQualityRecommendation(
    options: ContentDeliveryOptions
  ): AdaptiveQualityRecommendation {
    const { quality, bandwidth, isOnline } = this.currentNetworkConditions;
    const { contentType, priority, size, duration, allowProgressive } = options;

    // Handle offline scenario
    if (!isOnline) {
      return {
        recommendedQuality: 'low',
        shouldUseProgressive: false,
        estimatedLoadTime: Infinity,
        shouldCache: true,
        fallbackQuality: 'low',
      };
    }

    // Determine recommended quality based on network quality and content type
    let recommendedQuality: ContentQuality;
    let fallbackQuality: ContentQuality | undefined;

    switch (quality) {
      case 'excellent':
        recommendedQuality = 'ultra';
        fallbackQuality = 'high';
        break;
      case 'good':
        recommendedQuality = contentType === 'video' ? 'high' : 'ultra';
        fallbackQuality = 'medium';
        break;
      case 'fair':
        recommendedQuality = 'medium';
        fallbackQuality = 'low';
        break;
      case 'poor':
        recommendedQuality = 'low';
        fallbackQuality = undefined;
        break;
      default:
        recommendedQuality = 'low';
        fallbackQuality = undefined;
    }

    // Adjust for critical priority content
    if (priority === 'critical' && quality !== 'poor') {
      recommendedQuality = this.upgradeQuality(recommendedQuality);
    }

    // Calculate estimated load time
    const bandwidthBytesPerSecond = (bandwidth * 1024 * 1024) / 8;
    const estimatedLoadTime = size / bandwidthBytesPerSecond;

    // Determine if progressive loading should be used
    const shouldUseProgressive =
      allowProgressive !== false &&
      (contentType === 'video' || contentType === 'audio') &&
      estimatedLoadTime > 3 &&
      quality !== 'excellent';

    // Determine if content should be cached
    const shouldCache =
      priority === 'critical' ||
      priority === 'high' ||
      quality === 'poor' ||
      quality === 'fair';

    logger.debug('Adaptive quality recommendation generated', {
      contentType,
      networkQuality: quality,
      recommendedQuality,
      shouldUseProgressive,
      estimatedLoadTime,
    });

    return {
      recommendedQuality,
      shouldUseProgressive,
      estimatedLoadTime,
      shouldCache,
      fallbackQuality,
    };
  }

  /**
   * Upgrade quality to next level
   */
  private upgradeQuality(quality: ContentQuality): ContentQuality {
    const qualityLevels: ContentQuality[] = ['low', 'medium', 'high', 'ultra'];
    const currentIndex = qualityLevels.indexOf(quality);
    return currentIndex < qualityLevels.length - 1
      ? qualityLevels[currentIndex + 1]
      : quality;
  }

  /**
   * Get progressive loading strategy
   */
  public getProgressiveLoadingStrategy(
    contentSize: number,
    contentType: 'video' | 'audio'
  ): ProgressiveLoadingStrategy {
    const { quality, bandwidth } = this.currentNetworkConditions;

    // Base chunk size on network quality
    let chunkSize: number;
    let initialChunks: number;
    let prefetchChunks: number;

    switch (quality) {
      case 'excellent':
        chunkSize = 2 * 1024 * 1024; // 2MB
        initialChunks = 3;
        prefetchChunks = 5;
        break;
      case 'good':
        chunkSize = 1 * 1024 * 1024; // 1MB
        initialChunks = 2;
        prefetchChunks = 3;
        break;
      case 'fair':
        chunkSize = 512 * 1024; // 512KB
        initialChunks = 2;
        prefetchChunks = 2;
        break;
      case 'poor':
        chunkSize = 256 * 1024; // 256KB
        initialChunks = 1;
        prefetchChunks = 1;
        break;
      default:
        chunkSize = 256 * 1024;
        initialChunks = 1;
        prefetchChunks = 1;
    }

    // Adjust for content type
    if (contentType === 'audio') {
      chunkSize = Math.floor(chunkSize / 2); // Audio needs smaller chunks
    }

    // Calculate buffer size (3x chunk size)
    const bufferSize = chunkSize * 3;

    logger.debug('Progressive loading strategy generated', {
      contentType,
      networkQuality: quality,
      chunkSize,
      initialChunks,
      prefetchChunks,
    });

    return {
      chunkSize,
      initialChunks,
      prefetchChunks,
      bufferSize,
    };
  }

  /**
   * Prioritize content delivery based on priority and network conditions
   */
  public prioritizeContent(
    contentItems: Array<{ id: string; priority: ContentPriority; size: number }>
  ): string[] {
    const { quality } = this.currentNetworkConditions;

    // Sort by priority first, then by size (smaller first for poor networks)
    const sorted = [...contentItems].sort((a, b) => {
      // Priority order: critical > high > medium > low
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // For poor networks, prioritize smaller content
      if (quality === 'poor' || quality === 'fair') {
        return a.size - b.size;
      }

      // For good networks, size doesn't matter as much
      return 0;
    });

    const prioritizedIds = sorted.map(item => item.id);

    logger.debug('Content prioritized', {
      networkQuality: quality,
      itemCount: contentItems.length,
      prioritizedOrder: prioritizedIds,
    });

    return prioritizedIds;
  }

  /**
   * Detect if offline mode should be activated
   */
  public shouldActivateOfflineMode(): boolean {
    return !this.currentNetworkConditions.isOnline || 
           this.currentNetworkConditions.quality === 'offline';
  }

  /**
   * Get graceful degradation strategy
   */
  public getGracefulDegradationStrategy(contentType: string): {
    fallbackContent: string[];
    userMessage: string;
  } {
    const { quality, isOnline } = this.currentNetworkConditions;

    if (!isOnline) {
      return {
        fallbackContent: ['cached-content', 'basic-info', 'text-only'],
        userMessage: 'You are offline. Showing cached content only.',
      };
    }

    if (quality === 'poor') {
      return {
        fallbackContent: ['low-quality-media', 'text-content', 'thumbnails'],
        userMessage: 'Network connection is slow. Loading reduced quality content.',
      };
    }

    if (quality === 'fair') {
      return {
        fallbackContent: ['medium-quality-media', 'compressed-images'],
        userMessage: 'Network connection is limited. Optimizing content delivery.',
      };
    }

    return {
      fallbackContent: [],
      userMessage: '',
    };
  }

  /**
   * Estimate time to download content
   */
  public estimateDownloadTime(sizeInBytes: number): number {
    const { bandwidth } = this.currentNetworkConditions;
    const bandwidthBytesPerSecond = (bandwidth * 1024 * 1024) / 8;
    return sizeInBytes / bandwidthBytesPerSecond;
  }

  /**
   * Check if content should be preloaded
   */
  public shouldPreloadContent(
    priority: ContentPriority,
    sizeInBytes: number
  ): boolean {
    const { quality, bandwidth, isOnline } = this.currentNetworkConditions;

    // Don't preload if offline
    if (!isOnline || quality === 'offline') {
      return false;
    }

    // Always preload critical content if online
    if (priority === 'critical') {
      return true;
    }

    // Preload high priority content on good networks
    if (priority === 'high' && (quality === 'excellent' || quality === 'good')) {
      return true;
    }

    // Don't preload on poor networks or large files
    if (quality === 'poor' || quality === 'fair') {
      return false;
    }

    // Check if file size is reasonable for preloading
    const maxPreloadSize = bandwidth * 1024 * 1024; // 1 second worth of bandwidth
    return sizeInBytes <= maxPreloadSize;
  }
}
