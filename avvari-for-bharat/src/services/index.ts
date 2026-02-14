// Export all service classes
export { QRProcessingService } from './qr-processing-service';
export type { QRProcessingResult } from './qr-processing-service';

export { SessionManagementService } from './session-management-service';
export type { SessionCreationOptions, SessionUpdateOptions } from './session-management-service';

export { BedrockService } from './bedrock-service';
export type { 
  BedrockConfig, 
  ContentGenerationRequest, 
  ContentGenerationResult 
} from './bedrock-service';

export { RAGService } from './rag-service';
export type {
  KnowledgeBaseDocument,
  QuestionRequest,
  QuestionResponse,
} from './rag-service';

export { TranslationService } from './translation-service';
export type {
  TranslationRequest,
  TranslationResult,
  LanguageDetectionResult,
} from './translation-service';

export { PollyService } from './polly-service';
export type {
  TextToSpeechRequest,
  TextToSpeechResult,
  VoiceInfo,
} from './polly-service';

export { VideoService } from './video-service';
export type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProcessingRequest,
  VideoProcessingResult,
  SubtitleGenerationRequest,
  SubtitleGenerationResult,
  SubtitleTrack,
  Timecode,
  VideoQuality,
  VideoFormat,
  VideoMetadata,
} from './video-service';

export { InfographicService } from './infographic-service';
export type {
  InfographicGenerationRequest,
  InfographicGenerationResult,
  InfographicType,
  InfographicFormat,
  InfographicData,
  TimelineEvent,
  MapLocation,
  DiagramNode,
  ArchitecturalElement,
  InfographicMetadata,
  InteractiveElement,
} from './infographic-service';

export { ContentRepositoryService } from './content-repository-service';
export type {
  ContentUploadRequest,
  ContentUploadResult,
  ContentRetrievalRequest,
  ContentRetrievalResult,
  ContentType,
  ContentMetadata,
} from './content-repository-service';

export { CacheManagementService } from './cache-management-service';
export type {
  CacheStrategy,
  CachePriority,
  CacheRefreshRequest,
  CacheInvalidationRequest,
  CacheMetrics,
} from './cache-management-service';

export { PerformanceMonitoringService } from './performance-monitoring-service';
export type {
  PerformanceMetric,
  RequestTrace,
  PerformanceAlert,
  PerformanceDashboardData,
} from './performance-monitoring-service';

export { NetworkAwareDeliveryService } from './network-aware-delivery-service';
export type {
  NetworkQuality,
  ContentQuality,
  ContentPriority,
  NetworkConditions,
  ContentDeliveryOptions,
  AdaptiveQualityRecommendation,
  ProgressiveLoadingStrategy,
} from './network-aware-delivery-service';

export { OfflineCacheService } from './offline-cache-service';
export type {
  CachedContent,
  QRScanCache,
  OfflineCacheStats,
} from './offline-cache-service';

export { ContentSyncService } from './content-sync-service';
export type {
  SyncStatus,
  ConflictResolution,
  SyncItem,
  SyncConflict,
  SyncProgress,
  SyncResult,
} from './content-sync-service';

export { AccessibilityService } from './accessibility-service';
export type {
  AccessibilityMode,
  PlaybackSpeed,
  TextSize,
  ContrastLevel,
  AccessibilitySettings,
  AudioDescription,
  PlaybackControls,
  VisualAccessibilityOptions,
  ContentWithAccessibility,
} from './accessibility-service';

export { AudioPlaybackService } from './audio-playback-service';
export type {
  PlaybackState,
  AudioQuality,
  AudioPlaybackOptions,
  AudioTrack,
  PlaybackStatus,
  VoiceGuidanceOptions,
} from './audio-playback-service';

export { AnalyticsService } from './analytics-service';
export type {
  QRScanEvent,
  ContentViewEvent,
  InteractionEvent,
  UserPreference,
  EngagementPattern,
  AnalyticsMetrics,
} from './analytics-service';

export { ReportingService } from './reporting-service';
export type {
  ReportType,
  ReportFormat,
  UsageReport,
  DashboardData,
  TrendData,
  VisualizationData,
} from './reporting-service';

// Import service classes for factory (after exports to avoid circular dependency)
import type { QRProcessingService } from './qr-processing-service';
import type { SessionManagementService } from './session-management-service';
import type { BedrockService } from './bedrock-service';
import type { RAGService } from './rag-service';
import type { TranslationService } from './translation-service';
import type { PollyService } from './polly-service';
import type { VideoService } from './video-service';
import type { InfographicService } from './infographic-service';
import type { ContentRepositoryService } from './content-repository-service';
import type { CacheManagementService } from './cache-management-service';
import type { PerformanceMonitoringService } from './performance-monitoring-service';
import type { NetworkAwareDeliveryService } from './network-aware-delivery-service';
import type { OfflineCacheService } from './offline-cache-service';
import type { ContentSyncService } from './content-sync-service';
import type { AccessibilityService } from './accessibility-service';
import type { AudioPlaybackService } from './audio-playback-service';
import type { AnalyticsService } from './analytics-service';
import type { ReportingService } from './reporting-service';
import type { SiteManagementService } from './site-management-service';
import type { ConcurrencyManagementService } from './concurrency-management-service';

// Service factory for dependency injection
export class ServiceFactory {
  private static qrProcessingService: QRProcessingService | null = null;
  private static sessionManagementService: SessionManagementService | null = null;
  private static bedrockService: BedrockService | null = null;
  private static ragService: RAGService | null = null;
  private static translationService: TranslationService | null = null;
  private static pollyService: PollyService | null = null;
  private static videoService: VideoService | null = null;
  private static infographicService: InfographicService | null = null;
  private static contentRepositoryService: ContentRepositoryService | null = null;
  private static cacheManagementService: CacheManagementService | null = null;
  private static performanceMonitoringService: PerformanceMonitoringService | null = null;
  private static networkAwareDeliveryService: NetworkAwareDeliveryService | null = null;
  private static offlineCacheService: OfflineCacheService | null = null;
  private static contentSyncService: ContentSyncService | null = null;
  private static accessibilityService: AccessibilityService | null = null;
  private static audioPlaybackService: AudioPlaybackService | null = null;
  private static analyticsService: AnalyticsService | null = null;
  private static reportingService: ReportingService | null = null;
  private static siteManagementService: SiteManagementService | null = null;
  private static concurrencyManagementService: ConcurrencyManagementService | null = null;

  /**
   * Get QR Processing service instance (singleton)
   */
  public static getQRProcessingService(): QRProcessingService {
    if (!this.qrProcessingService) {
      const { QRProcessingService: Service } = require('./qr-processing-service');
      this.qrProcessingService = new Service();
    }
    return this.qrProcessingService!;
  }

  /**
   * Get Session Management service instance (singleton)
   */
  public static getSessionManagementService(): SessionManagementService {
    if (!this.sessionManagementService) {
      const { SessionManagementService: Service } = require('./session-management-service');
      this.sessionManagementService = new Service();
    }
    return this.sessionManagementService!;
  }

  /**
   * Get Bedrock service instance (singleton)
   */
  public static getBedrockService(): BedrockService {
    if (!this.bedrockService) {
      const { BedrockService: Service } = require('./bedrock-service');
      this.bedrockService = new Service();
    }
    return this.bedrockService!;
  }

  /**
   * Get RAG service instance (singleton)
   */
  public static getRAGService(): RAGService {
    if (!this.ragService) {
      const { RAGService: Service } = require('./rag-service');
      this.ragService = new Service();
    }
    return this.ragService!;
  }

  /**
   * Get Translation service instance (singleton)
   */
  public static getTranslationService(): TranslationService {
    if (!this.translationService) {
      const { TranslationService: Service } = require('./translation-service');
      this.translationService = new Service();
    }
    return this.translationService!;
  }

  /**
   * Get Polly service instance (singleton)
   */
  public static getPollyService(): PollyService {
    if (!this.pollyService) {
      const { PollyService: Service } = require('./polly-service');
      this.pollyService = new Service();
    }
    return this.pollyService!;
  }

  /**
   * Get Video service instance (singleton)
   */
  public static getVideoService(): VideoService {
    if (!this.videoService) {
      const { VideoService: Service } = require('./video-service');
      this.videoService = new Service();
    }
    return this.videoService!;
  }

  /**
   * Get Infographic service instance (singleton)
   */
  public static getInfographicService(): InfographicService {
    if (!this.infographicService) {
      const { InfographicService: Service } = require('./infographic-service');
      this.infographicService = new Service();
    }
    return this.infographicService!;
  }

  /**
   * Get Content Repository service instance (singleton)
   */
  public static getContentRepositoryService(): ContentRepositoryService {
    if (!this.contentRepositoryService) {
      const { ContentRepositoryService: Service } = require('./content-repository-service');
      this.contentRepositoryService = new Service();
    }
    return this.contentRepositoryService!;
  }

  /**
   * Get Cache Management service instance (singleton)
   */
  public static getCacheManagementService(): CacheManagementService {
    if (!this.cacheManagementService) {
      const { CacheManagementService: Service } = require('./cache-management-service');
      this.cacheManagementService = new Service();
    }
    return this.cacheManagementService!;
  }

  /**
   * Get Performance Monitoring service instance (singleton)
   */
  public static getPerformanceMonitoringService(): PerformanceMonitoringService {
    if (!this.performanceMonitoringService) {
      const { PerformanceMonitoringService: Service } = require('./performance-monitoring-service');
      this.performanceMonitoringService = new Service();
    }
    return this.performanceMonitoringService!;
  }

  /**
   * Get Network-Aware Delivery service instance (singleton)
   */
  public static getNetworkAwareDeliveryService(): NetworkAwareDeliveryService {
    if (!this.networkAwareDeliveryService) {
      const { NetworkAwareDeliveryService: Service } = require('./network-aware-delivery-service');
      this.networkAwareDeliveryService = new Service();
    }
    return this.networkAwareDeliveryService!;
  }

  /**
   * Get Offline Cache service instance (singleton)
   */
  public static getOfflineCacheService(): OfflineCacheService {
    if (!this.offlineCacheService) {
      const { OfflineCacheService: Service } = require('./offline-cache-service');
      this.offlineCacheService = new Service();
    }
    return this.offlineCacheService!;
  }

  /**
   * Get Content Sync service instance (singleton)
   */
  public static getContentSyncService(): ContentSyncService {
    if (!this.contentSyncService) {
      const { ContentSyncService: Service } = require('./content-sync-service');
      this.contentSyncService = new Service();
    }
    return this.contentSyncService!;
  }

  /**
   * Get Accessibility service instance (singleton)
   */
  public static getAccessibilityService(): AccessibilityService {
    if (!this.accessibilityService) {
      const { AccessibilityService: Service } = require('./accessibility-service');
      this.accessibilityService = new Service();
    }
    return this.accessibilityService!;
  }

  /**
   * Get Audio Playback service instance (singleton)
   */
  public static getAudioPlaybackService(): AudioPlaybackService {
    if (!this.audioPlaybackService) {
      const { AudioPlaybackService: Service } = require('./audio-playback-service');
      this.audioPlaybackService = new Service();
    }
    return this.audioPlaybackService!;
  }

  /**
   * Get Analytics service instance (singleton)
   */
  public static getAnalyticsService(): AnalyticsService {
    if (!this.analyticsService) {
      const { AnalyticsService: Service } = require('./analytics-service');
      this.analyticsService = new Service();
    }
    return this.analyticsService!;
  }

  /**
   * Get Reporting service instance (singleton)
   */
  public static getReportingService(): ReportingService {
    if (!this.reportingService) {
      const { ReportingService: Service } = require('./reporting-service');
      const analyticsService = this.getAnalyticsService();
      this.reportingService = new Service(analyticsService);
    }
    return this.reportingService!;
  }

  /**
   * Get Site Management service instance (singleton)
   */
  public static getSiteManagementService(): SiteManagementService {
    if (!this.siteManagementService) {
      const { SiteManagementService: Service } = require('./site-management-service');
      const { RepositoryFactory } = require('../repositories');
      const sitesRepository = RepositoryFactory.getHeritageSitesRepository();
      this.siteManagementService = new Service(sitesRepository);
    }
    return this.siteManagementService!;
  }

  /**
   * Get Concurrency Management service instance (singleton)
   */
  public static getConcurrencyManagementService(): ConcurrencyManagementService {
    if (!this.concurrencyManagementService) {
      const { ConcurrencyManagementService: Service } = require('./concurrency-management-service');
      this.concurrencyManagementService = new Service({
        maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '1000'),
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
        queueSize: parseInt(process.env.QUEUE_SIZE || '500'),
        enableGracefulDegradation: process.env.ENABLE_GRACEFUL_DEGRADATION !== 'false',
        degradationThreshold: parseInt(process.env.DEGRADATION_THRESHOLD || '80'),
      });
    }
    return this.concurrencyManagementService!;
  }

  /**
   * Reset all service instances (useful for testing)
   */
  public static resetInstances(): void {
    this.qrProcessingService = null;
    this.sessionManagementService = null;
    this.bedrockService = null;
    this.ragService = null;
    this.translationService = null;
    this.pollyService = null;
    this.videoService = null;
    this.infographicService = null;
    this.contentRepositoryService = null;
    this.cacheManagementService = null;
    this.performanceMonitoringService = null;
    this.networkAwareDeliveryService = null;
    this.offlineCacheService = null;
    this.contentSyncService = null;
    this.accessibilityService = null;
    this.audioPlaybackService = null;
    this.analyticsService = null;
    this.reportingService = null;
    this.siteManagementService = null;
    this.concurrencyManagementService = null;
  }
}

export { SiteManagementService, createSiteManagementService } from './site-management-service';
export type {
  SiteCreationRequest,
  ArtifactCreationRequest,
  BulkSiteUpdate,
  SiteManagementStats,
} from './site-management-service';

export { ConcurrencyManagementService, createConcurrencyManagementService } from './concurrency-management-service';
export type {
  ConcurrencyConfig,
  RequestMetrics,
  RequestContext,
} from './concurrency-management-service';
export { ServiceMode } from './concurrency-management-service';
