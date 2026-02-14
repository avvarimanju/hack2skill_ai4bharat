// Amazon Bedrock Service for AI Content Generation
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { logger } from '../utils/logger';
import { Language } from '../models/common';

export interface BedrockConfig {
  modelId: string;
  region?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface ContentGenerationRequest {
  artifactName: string;
  artifactType: string;
  description: string;
  historicalContext: string;
  culturalSignificance: string;
  language: Language;
  contentType: 'audio_guide' | 'detailed_description' | 'historical_narrative' | 'cultural_context';
  targetAudience?: 'general' | 'children' | 'scholars';
  duration?: number; // For audio guides, in seconds
}

export interface ContentGenerationResult {
  success: boolean;
  content?: string;
  metadata?: {
    modelId: string;
    tokensUsed?: number;
    generationTime: number;
  };
  error?: string;
}

export class BedrockService {
  private client: BedrockRuntimeClient;
  private defaultConfig: BedrockConfig;

  constructor(config?: Partial<BedrockConfig>) {
    const region = config?.region || process.env.AWS_REGION || 'us-east-1';
    
    this.client = new BedrockRuntimeClient({ region });
    
    this.defaultConfig = {
      modelId: config?.modelId || 'anthropic.claude-3-sonnet-20240229-v1:0',
      region,
      maxTokens: config?.maxTokens || 2048,
      temperature: config?.temperature || 0.7,
      topP: config?.topP || 0.9,
    };

    logger.info('Bedrock service initialized', {
      modelId: this.defaultConfig.modelId,
      region: this.defaultConfig.region,
    });
  }

  /**
   * Generate heritage content using Bedrock
   */
  public async generateContent(request: ContentGenerationRequest): Promise<ContentGenerationResult> {
    const startTime = Date.now();
    
    logger.info('Generating content with Bedrock', {
      artifactName: request.artifactName,
      contentType: request.contentType,
      language: request.language,
    });

    try {
      const prompt = this.buildPrompt(request);
      const response = await this.invokeModel(prompt, this.defaultConfig);

      const generationTime = Date.now() - startTime;

      logger.info('Content generated successfully', {
        artifactName: request.artifactName,
        contentType: request.contentType,
        generationTime,
      });

      return {
        success: true,
        content: response.content,
        metadata: {
          modelId: this.defaultConfig.modelId,
          tokensUsed: response.tokensUsed,
          generationTime,
        },
      };
    } catch (error) {
      logger.error('Failed to generate content', {
        error: error instanceof Error ? error.message : String(error),
        artifactName: request.artifactName,
        contentType: request.contentType,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Build prompt based on content type and request parameters
   */
  private buildPrompt(request: ContentGenerationRequest): string {
    const languageInstruction = this.getLanguageInstruction(request.language);
    const audienceInstruction = this.getAudienceInstruction(request.targetAudience);
    
    switch (request.contentType) {
      case 'audio_guide':
        return this.buildAudioGuidePrompt(request, languageInstruction, audienceInstruction);
      
      case 'detailed_description':
        return this.buildDetailedDescriptionPrompt(request, languageInstruction, audienceInstruction);
      
      case 'historical_narrative':
        return this.buildHistoricalNarrativePrompt(request, languageInstruction, audienceInstruction);
      
      case 'cultural_context':
        return this.buildCulturalContextPrompt(request, languageInstruction, audienceInstruction);
      
      default:
        throw new Error(`Unsupported content type: ${request.contentType}`);
    }
  }

  /**
   * Build audio guide prompt
   */
  private buildAudioGuidePrompt(
    request: ContentGenerationRequest,
    languageInstruction: string,
    audienceInstruction: string
  ): string {
    const durationInstruction = request.duration 
      ? `The audio guide should be approximately ${request.duration} seconds when read aloud at a natural pace.`
      : 'The audio guide should be concise, taking about 60-90 seconds to read aloud.';

    return `You are an expert heritage site audio guide narrator. Create an engaging audio guide script for the following artifact.

${languageInstruction}
${audienceInstruction}
${durationInstruction}

Artifact Information:
- Name: ${request.artifactName}
- Type: ${request.artifactType}
- Description: ${request.description}
- Historical Context: ${request.historicalContext}
- Cultural Significance: ${request.culturalSignificance}

Guidelines:
1. Write in a warm, conversational tone suitable for audio narration
2. Start with a captivating opening that draws the listener in
3. Include interesting facts and stories that bring the artifact to life
4. Use vivid, descriptive language that helps listeners visualize the artifact
5. Explain technical or historical terms in simple language
6. End with a memorable conclusion that connects the artifact to broader themes
7. Avoid using phrases like "you can see" - remember this is for audio
8. Use present tense to make the experience more immediate

Generate only the audio guide script, without any meta-commentary or additional formatting.`;
  }

  /**
   * Build detailed description prompt
   */
  private buildDetailedDescriptionPrompt(
    request: ContentGenerationRequest,
    languageInstruction: string,
    audienceInstruction: string
  ): string {
    return `You are a heritage site curator creating detailed artifact descriptions. Write a comprehensive description for the following artifact.

${languageInstruction}
${audienceInstruction}

Artifact Information:
- Name: ${request.artifactName}
- Type: ${request.artifactType}
- Description: ${request.description}
- Historical Context: ${request.historicalContext}
- Cultural Significance: ${request.culturalSignificance}

Guidelines:
1. Provide a thorough, scholarly description of the artifact
2. Include physical characteristics (materials, dimensions, craftsmanship)
3. Explain the artifact's purpose and function
4. Describe any inscriptions, decorations, or unique features
5. Discuss the artifact's condition and any restoration work
6. Use precise, technical language where appropriate
7. Organize information logically with clear sections
8. Include relevant dates, dynasties, or historical periods

Generate a well-structured detailed description without any meta-commentary.`;
  }

  /**
   * Build historical narrative prompt
   */
  private buildHistoricalNarrativePrompt(
    request: ContentGenerationRequest,
    languageInstruction: string,
    audienceInstruction: string
  ): string {
    return `You are a historian crafting engaging narratives about heritage artifacts. Create a compelling historical narrative for the following artifact.

${languageInstruction}
${audienceInstruction}

Artifact Information:
- Name: ${request.artifactName}
- Type: ${request.artifactType}
- Description: ${request.description}
- Historical Context: ${request.historicalContext}
- Cultural Significance: ${request.culturalSignificance}

Guidelines:
1. Tell the story of this artifact through time
2. Include the historical period and key events during its creation
3. Describe the people who created, used, or were associated with it
4. Explain how the artifact reflects the society and culture of its time
5. Discuss any significant events or changes the artifact witnessed
6. Connect the artifact to broader historical trends and movements
7. Use narrative techniques to make history come alive
8. Balance historical accuracy with engaging storytelling

Generate an engaging historical narrative without any meta-commentary.`;
  }

  /**
   * Build cultural context prompt
   */
  private buildCulturalContextPrompt(
    request: ContentGenerationRequest,
    languageInstruction: string,
    audienceInstruction: string
  ): string {
    return `You are a cultural anthropologist explaining the cultural significance of heritage artifacts. Create an insightful cultural context explanation for the following artifact.

${languageInstruction}
${audienceInstruction}

Artifact Information:
- Name: ${request.artifactName}
- Type: ${request.artifactType}
- Description: ${request.description}
- Historical Context: ${request.historicalContext}
- Cultural Significance: ${request.culturalSignificance}

Guidelines:
1. Explain the artifact's role in its cultural context
2. Describe religious, spiritual, or symbolic meanings
3. Discuss social customs, rituals, or practices associated with it
4. Explain artistic traditions and aesthetic principles
5. Connect to broader cultural values and worldviews
6. Discuss how the artifact reflects cultural identity
7. Explain any continuing cultural relevance or influence
8. Be respectful and sensitive to cultural perspectives

Generate a thoughtful cultural context explanation without any meta-commentary.`;
  }

  /**
   * Get language-specific instruction
   */
  private getLanguageInstruction(language: Language): string {
    const languageNames: Record<Language, string> = {
      [Language.ENGLISH]: 'English',
      [Language.HINDI]: 'Hindi (हिंदी)',
      [Language.KANNADA]: 'Kannada (ಕನ್ನಡ)',
      [Language.TAMIL]: 'Tamil (தமிழ்)',
      [Language.TELUGU]: 'Telugu (తెలుగు)',
      [Language.BENGALI]: 'Bengali (বাংলা)',
      [Language.MARATHI]: 'Marathi (मराठी)',
      [Language.GUJARATI]: 'Gujarati (ગુજરાતી)',
      [Language.MALAYALAM]: 'Malayalam (മലയാളം)',
      [Language.PUNJABI]: 'Punjabi (ਪੰਜਾਬੀ)',
    };

    return `Generate the content in ${languageNames[language]}. Use natural, fluent language appropriate for native speakers.`;
  }

  /**
   * Get audience-specific instruction
   */
  private getAudienceInstruction(audience?: 'general' | 'children' | 'scholars'): string {
    switch (audience) {
      case 'children':
        return 'Target audience: Children (ages 8-14). Use simple language, short sentences, and engaging examples. Make it fun and educational.';
      
      case 'scholars':
        return 'Target audience: Scholars and researchers. Use academic language, include technical details, and reference scholarly concepts.';
      
      case 'general':
      default:
        return 'Target audience: General public. Use clear, accessible language that is informative but not overly technical.';
    }
  }

  /**
   * Invoke Bedrock model
   */
  private async invokeModel(
    prompt: string,
    config: BedrockConfig
  ): Promise<{ content: string; tokensUsed?: number }> {
    // Build request body based on model type
    const requestBody = this.buildModelRequest(prompt, config);

    const command = new InvokeModelCommand({
      modelId: config.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    logger.debug('Invoking Bedrock model', {
      modelId: config.modelId,
      promptLength: prompt.length,
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return this.parseModelResponse(responseBody, config.modelId);
  }

  /**
   * Build model-specific request body
   */
  private buildModelRequest(prompt: string, config: BedrockConfig): any {
    // Claude models (Anthropic)
    if (config.modelId.startsWith('anthropic.claude')) {
      return {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };
    }

    // Titan models (Amazon)
    if (config.modelId.startsWith('amazon.titan')) {
      return {
        inputText: prompt,
        textGenerationConfig: {
          maxTokenCount: config.maxTokens,
          temperature: config.temperature,
          topP: config.topP,
        },
      };
    }

    // Default format (works for most models)
    return {
      prompt,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP,
    };
  }

  /**
   * Parse model-specific response
   */
  private parseModelResponse(responseBody: any, modelId: string): { content: string; tokensUsed?: number } {
    // Claude models (Anthropic)
    if (modelId.startsWith('anthropic.claude')) {
      return {
        content: responseBody.content[0].text,
        tokensUsed: responseBody.usage?.output_tokens,
      };
    }

    // Titan models (Amazon)
    if (modelId.startsWith('amazon.titan')) {
      return {
        content: responseBody.results[0].outputText,
        tokensUsed: responseBody.results[0].tokenCount,
      };
    }

    // Default parsing
    return {
      content: responseBody.completion || responseBody.text || responseBody.output,
      tokensUsed: responseBody.usage?.total_tokens,
    };
  }

  /**
   * Test Bedrock connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const testPrompt = 'Hello, this is a test. Please respond with "Connection successful".';
      const response = await this.invokeModel(testPrompt, {
        ...this.defaultConfig,
        maxTokens: 50,
      });

      logger.info('Bedrock connection test successful', {
        modelId: this.defaultConfig.modelId,
        responseLength: response.content.length,
      });

      return true;
    } catch (error) {
      logger.error('Bedrock connection test failed', {
        error: error instanceof Error ? error.message : String(error),
        modelId: this.defaultConfig.modelId,
      });

      return false;
    }
  }
}
