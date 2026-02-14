// Unit tests for BedrockService
import { BedrockService, ContentGenerationRequest } from '../../src/services/bedrock-service';
import { Language } from '../../src/models/common';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Mock AWS SDK
jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('../../src/utils/logger');

describe('BedrockService', () => {
  let service: BedrockService;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock BedrockRuntimeClient
    mockSend = jest.fn();
    (BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }));

    service = new BedrockService();
  });

  describe('generateContent', () => {
    const baseRequest: ContentGenerationRequest = {
      artifactName: 'Ancient Pillar',
      artifactType: 'Pillar',
      description: 'A stone pillar from the 12th century',
      historicalContext: 'Built during the Hoysala dynasty',
      culturalSignificance: 'Represents architectural excellence',
      language: Language.ENGLISH,
      contentType: 'audio_guide',
    };

    it('should generate audio guide content successfully', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'Welcome to the Ancient Pillar. This magnificent stone structure...',
          }],
          usage: {
            output_tokens: 150,
          },
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.generateContent(baseRequest);

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content).toContain('Ancient Pillar');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.tokensUsed).toBe(150);
      expect(mockSend).toHaveBeenCalledWith(expect.any(InvokeModelCommand));
    });

    it('should generate detailed description content', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'The Ancient Pillar is a remarkable example of 12th-century architecture...',
          }],
          usage: {
            output_tokens: 200,
          },
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.generateContent({
        ...baseRequest,
        contentType: 'detailed_description',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('should generate historical narrative content', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'In the 12th century, during the reign of the Hoysala dynasty...',
          }],
          usage: {
            output_tokens: 250,
          },
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.generateContent({
        ...baseRequest,
        contentType: 'historical_narrative',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('should generate cultural context content', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'This pillar holds deep cultural significance in the region...',
          }],
          usage: {
            output_tokens: 180,
          },
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.generateContent({
        ...baseRequest,
        contentType: 'cultural_context',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('should generate content in Hindi', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'प्राचीन स्तंभ में आपका स्वागत है...',
          }],
          usage: {
            output_tokens: 150,
          },
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.generateContent({
        ...baseRequest,
        language: Language.HINDI,
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('should generate content for children audience', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'Hey kids! Let me tell you about this amazing pillar...',
          }],
          usage: {
            output_tokens: 120,
          },
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.generateContent({
        ...baseRequest,
        targetAudience: 'children',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('should generate content for scholars audience', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'This architectural specimen exhibits characteristics typical of Hoysala construction...',
          }],
          usage: {
            output_tokens: 300,
          },
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.generateContent({
        ...baseRequest,
        targetAudience: 'scholars',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('should respect duration parameter for audio guides', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'A brief introduction to the Ancient Pillar...',
          }],
          usage: {
            output_tokens: 80,
          },
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.generateContent({
        ...baseRequest,
        duration: 30, // 30 seconds
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('should handle Bedrock API errors gracefully', async () => {
      mockSend.mockRejectedValue(new Error('Bedrock API error'));

      const result = await service.generateContent(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bedrock API error');
      expect(result.content).toBeUndefined();
    });

    it('should handle invalid model responses', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          // Missing expected fields
          invalid: 'response',
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.generateContent(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include generation metadata', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'Test content',
          }],
          usage: {
            output_tokens: 100,
          },
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.generateContent(baseRequest);

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.modelId).toBeDefined();
      expect(result.metadata?.generationTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.tokensUsed).toBe(100);
    });
  });

  describe('testConnection', () => {
    it('should successfully test Bedrock connection', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'Connection successful',
          }],
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.testConnection();

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalled();
    });

    it('should handle connection test failures', async () => {
      mockSend.mockRejectedValue(new Error('Connection failed'));

      const result = await service.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Model Support', () => {
    it('should support Claude models', async () => {
      const claudeService = new BedrockService({
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      });

      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'Claude response',
          }],
          usage: {
            output_tokens: 50,
          },
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await claudeService.generateContent({
        artifactName: 'Test',
        artifactType: 'Test',
        description: 'Test',
        historicalContext: 'Test',
        culturalSignificance: 'Test',
        language: Language.ENGLISH,
        contentType: 'audio_guide',
      });

      expect(result.success).toBe(true);
    });

    it('should support Titan models', async () => {
      const titanService = new BedrockService({
        modelId: 'amazon.titan-text-express-v1',
      });

      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          results: [{
            outputText: 'Titan response',
            tokenCount: 50,
          }],
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await titanService.generateContent({
        artifactName: 'Test',
        artifactType: 'Test',
        description: 'Test',
        historicalContext: 'Test',
        culturalSignificance: 'Test',
        language: Language.ENGLISH,
        contentType: 'audio_guide',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customService = new BedrockService({
        modelId: 'custom-model',
        region: 'us-west-2',
        maxTokens: 4096,
        temperature: 0.5,
        topP: 0.95,
      });

      expect(customService).toBeDefined();
    });

    it('should use default configuration when not provided', () => {
      const defaultService = new BedrockService();

      expect(defaultService).toBeDefined();
    });

    it('should use environment variables for region', () => {
      process.env.AWS_REGION = 'eu-west-1';
      
      const envService = new BedrockService();

      expect(envService).toBeDefined();
      
      delete process.env.AWS_REGION;
    });
  });
});
