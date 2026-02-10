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

// Import service classes for factory (after exports to avoid circular dependency)
import type { QRProcessingService } from './qr-processing-service';
import type { SessionManagementService } from './session-management-service';
import type { BedrockService } from './bedrock-service';
import type { RAGService } from './rag-service';
import type { TranslationService } from './translation-service';
import type { PollyService } from './polly-service';

// Service factory for dependency injection
export class ServiceFactory {
  private static qrProcessingService: QRProcessingService | null = null;
  private static sessionManagementService: SessionManagementService | null = null;
  private static bedrockService: BedrockService | null = null;
  private static ragService: RAGService | null = null;
  private static translationService: TranslationService | null = null;
  private static pollyService: PollyService | null = null;

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
   * Reset all service instances (useful for testing)
   */
  public static resetInstances(): void {
    this.qrProcessingService = null;
    this.sessionManagementService = null;
    this.bedrockService = null;
    this.ragService = null;
    this.translationService = null;
    this.pollyService = null;
  }
}
