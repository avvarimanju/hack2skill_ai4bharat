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
  }
}
