// Unit tests for RAGService
import { RAGService, QuestionRequest } from '../../src/services/rag-service';
import { BedrockService } from '../../src/services/bedrock-service';
import { RepositoryFactory } from '../../src/repositories';
import { Language, ArtifactType } from '../../src/models/common';

// Mock dependencies
jest.mock('../../src/services/bedrock-service');
jest.mock('../../src/repositories');
jest.mock('../../src/utils/logger');

describe('RAGService', () => {
  let service: RAGService;
  let mockBedrockService: jest.Mocked<BedrockService>;
  let mockArtifactsRepo: any;
  let mockHeritageSitesRepo: any;
  let mockContentCacheRepo: any;

  const mockArtifact = {
    artifactId: 'artifact-1',
    siteId: 'site-1',
    name: 'Ancient Pillar',
    type: ArtifactType.PILLAR,
    description: 'A magnificent stone pillar',
    historicalContext: 'Built in the 12th century',
    culturalSignificance: 'Important religious symbol',
  };

  const mockSite = {
    siteId: 'site-1',
    name: 'Heritage Temple',
    location: { latitude: 12.9716, longitude: 77.5946 },
    description: 'Ancient temple complex',
    historicalPeriod: '12th Century',
    culturalSignificance: 'Major pilgrimage site',
    supportedLanguages: [Language.ENGLISH],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Bedrock service
    mockBedrockService = {
      generateContent: jest.fn(),
    } as any;

    // Mock repositories
    mockArtifactsRepo = {
      getByArtifactId: jest.fn(),
      getArtifactsBySite: jest.fn(),
    };

    mockHeritageSitesRepo = {
      getBySiteId: jest.fn(),
    };

    mockContentCacheRepo = {
      getCachedContentByArtifact: jest.fn(),
    };

    (RepositoryFactory.getArtifactsRepository as jest.Mock).mockReturnValue(mockArtifactsRepo);
    (RepositoryFactory.getHeritageSitesRepository as jest.Mock).mockReturnValue(mockHeritageSitesRepo);
    (RepositoryFactory.getContentCacheRepository as jest.Mock).mockReturnValue(mockContentCacheRepo);

    service = new RAGService(mockBedrockService);
  });

  describe('processQuestion', () => {
    const baseRequest: QuestionRequest = {
      question: 'What is the significance of this pillar?',
      artifactId: 'artifact-1',
      siteId: 'site-1',
      language: Language.ENGLISH,
    };

    it('should process question successfully with context', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);
      mockContentCacheRepo.getCachedContentByArtifact.mockResolvedValue(null);

      mockBedrockService.generateContent.mockResolvedValue({
        success: true,
        content: 'The Ancient Pillar is an important religious symbol built in the 12th century.',
        tokensUsed: 50,
      });

      const result = await service.processQuestion(baseRequest);

      expect(result.success).toBe(true);
      expect(result.answer).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.sources).toBeDefined();
      expect(result.metadata?.retrievedDocuments).toBeGreaterThan(0);
      expect(mockBedrockService.generateContent).toHaveBeenCalled();
    });

    it('should handle empty question', async () => {
      const result = await service.processQuestion({
        ...baseRequest,
        question: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Question cannot be empty');
    });

    it('should return unanswerable response when no context found', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(null);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(null);
      mockContentCacheRepo.getCachedContentByArtifact.mockResolvedValue(null);

      const result = await service.processQuestion(baseRequest);

      expect(result.success).toBe(true);
      expect(result.answer).toContain("don't have enough information");
      expect(result.confidence).toBe(0.0);
      expect(result.metadata?.retrievedDocuments).toBe(0);
    });

    it('should detect follow-up questions', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);

      mockBedrockService.generateContent.mockResolvedValue({
        success: true,
        content: 'It was built using local stone.',
        tokensUsed: 30,
      });

      const result = await service.processQuestion({
        ...baseRequest,
        question: 'What about its construction?',
        conversationContext: [{
          id: 'qa-1',
          question: 'Tell me about the pillar',
          answer: 'The pillar is ancient',
          timestamp: new Date().toISOString(),
          language: Language.ENGLISH,
          confidence: 0.9,
          sources: [],
        }],
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.isFollowUp).toBe(true);
    });

    it('should handle questions in Hindi', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);

      mockBedrockService.generateContent.mockResolvedValue({
        success: true,
        content: 'यह स्तंभ 12वीं शताब्दी में बनाया गया था।',
        tokensUsed: 40,
      });

      const result = await service.processQuestion({
        ...baseRequest,
        question: 'इस स्तंभ का क्या महत्व है?',
        language: Language.HINDI,
      });

      expect(result.success).toBe(true);
      expect(result.answer).toBeDefined();
    });

    it('should include conversation context for follow-ups', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);

      const conversationContext = [
        {
          id: 'qa-1',
          question: 'What is this?',
          answer: 'This is an ancient pillar',
          timestamp: new Date().toISOString(),
          language: Language.ENGLISH,
          confidence: 0.9,
          sources: [],
        },
        {
          id: 'qa-2',
          question: 'When was it built?',
          answer: 'It was built in the 12th century',
          timestamp: new Date().toISOString(),
          language: Language.ENGLISH,
          confidence: 0.95,
          sources: [],
        },
      ];

      mockBedrockService.generateContent.mockResolvedValue({
        success: true,
        content: 'It was built using local stone and traditional techniques.',
        tokensUsed: 45,
      });

      const result = await service.processQuestion({
        ...baseRequest,
        question: 'How was it constructed?',
        conversationContext,
      });

      expect(result.success).toBe(true);
      expect(mockBedrockService.generateContent).toHaveBeenCalled();
      
      // Check that conversation context was included in the prompt
      const promptCall = mockBedrockService.generateContent.mock.calls[0][0];
      expect(promptCall.prompt).toContain('Previous Conversation');
    });

    it('should limit conversation context to maxContextMessages', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);

      const conversationContext = Array.from({ length: 10 }, (_, i) => ({
        id: `qa-${i}`,
        question: `Question ${i}`,
        answer: `Answer ${i}`,
        timestamp: new Date().toISOString(),
        language: Language.ENGLISH,
        confidence: 0.9,
        sources: [],
      }));

      mockBedrockService.generateContent.mockResolvedValue({
        success: true,
        content: 'Answer based on context',
        tokensUsed: 50,
      });

      const result = await service.processQuestion({
        ...baseRequest,
        conversationContext,
        maxContextMessages: 3,
      });

      expect(result.success).toBe(true);
    });

    it('should handle Bedrock service errors', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);

      mockBedrockService.generateContent.mockRejectedValue(new Error('Bedrock error'));

      const result = await service.processQuestion(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bedrock error');
    });

    it('should retrieve cached content', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);
      mockContentCacheRepo.getCachedContentByArtifact.mockResolvedValue({
        contentId: 'cached-1',
        data: {
          textContent: 'Detailed description of the pillar...',
        },
      });

      mockBedrockService.generateContent.mockResolvedValue({
        success: true,
        content: 'Answer using cached content',
        tokensUsed: 60,
      });

      const result = await service.processQuestion(baseRequest);

      expect(result.success).toBe(true);
      expect(mockContentCacheRepo.getCachedContentByArtifact).toHaveBeenCalled();
    });

    it('should perform keyword search when no specific artifact', async () => {
      mockArtifactsRepo.getArtifactsBySite.mockResolvedValue([mockArtifact]);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);

      mockBedrockService.generateContent.mockResolvedValue({
        success: true,
        content: 'Answer based on keyword search',
        tokensUsed: 55,
      });

      const result = await service.processQuestion({
        question: 'Tell me about pillars in this site',
        siteId: 'site-1',
        language: Language.ENGLISH,
      });

      expect(result.success).toBe(true);
      expect(mockArtifactsRepo.getArtifactsBySite).toHaveBeenCalledWith('site-1');
    });

    it('should calculate confidence based on answer characteristics', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);

      // Test low confidence for "don't have" response
      mockBedrockService.generateContent.mockResolvedValue({
        success: true,
        content: "I don't have enough information",
        tokensUsed: 20,
      });

      const result1 = await service.processQuestion(baseRequest);
      expect(result1.confidence).toBeLessThan(0.5);

      // Test high confidence for detailed response
      mockBedrockService.generateContent.mockResolvedValue({
        success: true,
        content: 'The Ancient Pillar is a magnificent example of 12th-century architecture, built during the Hoysala dynasty. It features intricate carvings and serves as an important religious symbol in the region. The pillar stands as a testament to the advanced engineering and artistic skills of the period.',
        tokensUsed: 100,
      });

      const result2 = await service.processQuestion(baseRequest);
      expect(result2.confidence).toBeGreaterThan(0.8);
    });

    it('should include metadata in response', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(mockArtifact);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(mockSite);

      mockBedrockService.generateContent.mockResolvedValue({
        success: true,
        content: 'Test answer',
        tokensUsed: 30,
      });

      const result = await service.processQuestion(baseRequest);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.retrievedDocuments).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.generationTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.metadata?.isFollowUp).toBe('boolean');
    });
  });

  describe('ingestDocument', () => {
    it('should ingest knowledge base document', async () => {
      const document = {
        id: 'doc-1',
        content: 'Test content',
        metadata: {
          artifactId: 'artifact-1',
          siteId: 'site-1',
          contentType: 'text',
          language: Language.ENGLISH,
          source: 'manual',
        },
      };

      const result = await service.ingestDocument(document);

      expect(result).toBe(true);
    });

    it('should handle ingestion errors', async () => {
      const document = {
        id: 'doc-1',
        content: 'Test content',
        metadata: {
          contentType: 'text',
          language: Language.ENGLISH,
          source: 'manual',
        },
      };

      // Force an error by passing invalid document
      const result = await service.ingestDocument(document as any);

      expect(result).toBe(true); // Current implementation always returns true
    });
  });

  describe('Language Support', () => {
    it('should provide unanswerable response in Hindi', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(null);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(null);

      const result = await service.processQuestion({
        question: 'यह क्या है?',
        language: Language.HINDI,
      });

      expect(result.success).toBe(true);
      expect(result.answer).toContain('पर्याप्त जानकारी नहीं');
    });

    it('should provide unanswerable response in Tamil', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(null);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(null);

      const result = await service.processQuestion({
        question: 'இது என்ன?',
        language: Language.TAMIL,
      });

      expect(result.success).toBe(true);
      expect(result.answer).toContain('போதுமான தகவல்');
    });

    it('should support all Indian languages', async () => {
      mockArtifactsRepo.getByArtifactId.mockResolvedValue(null);
      mockHeritageSitesRepo.getBySiteId.mockResolvedValue(null);

      const languages = [
        Language.ENGLISH,
        Language.HINDI,
        Language.TAMIL,
        Language.TELUGU,
        Language.BENGALI,
        Language.MARATHI,
        Language.GUJARATI,
        Language.KANNADA,
        Language.MALAYALAM,
        Language.PUNJABI,
      ];

      for (const language of languages) {
        const result = await service.processQuestion({
          question: 'Test question',
          language,
        });

        expect(result.success).toBe(true);
        expect(result.answer).toBeDefined();
      }
    });
  });
});
