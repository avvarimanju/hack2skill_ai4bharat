// RAG (Retrieval-Augmented Generation) Service for Q&A
import { BedrockService } from './bedrock-service';
import { RepositoryFactory } from '../repositories';
import { Language, QAInteraction } from '../models/common';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface KnowledgeBaseDocument {
  id: string;
  content: string;
  metadata: {
    artifactId?: string;
    siteId?: string;
    contentType: string;
    language: Language;
    source: string;
  };
}

export interface QuestionRequest {
  question: string;
  sessionId?: string;
  artifactId?: string;
  siteId?: string;
  language: Language;
  conversationContext?: QAInteraction[];
  maxContextMessages?: number;
}

export interface QuestionResponse {
  success: boolean;
  answer?: string;
  confidence?: number;
  sources?: string[];
  conversationId?: string;
  error?: string;
  metadata?: {
    retrievedDocuments: number;
    generationTime: number;
    isFollowUp: boolean;
  };
}

export class RAGService {
  private bedrockService: BedrockService;
  private artifactsRepository = RepositoryFactory.getArtifactsRepository();
  private heritageSitesRepository = RepositoryFactory.getHeritageSitesRepository();
  private contentCacheRepository = RepositoryFactory.getContentCacheRepository();

  constructor(bedrockService?: BedrockService) {
    this.bedrockService = bedrockService || new BedrockService();
    logger.info('RAG service initialized');
  }

  /**
   * Process a question using RAG
   */
  public async processQuestion(request: QuestionRequest): Promise<QuestionResponse> {
    const startTime = Date.now();

    logger.info('Processing question with RAG', {
      question: request.question.substring(0, 100),
      sessionId: request.sessionId,
      artifactId: request.artifactId,
      language: request.language,
    });

    try {
      // Validate question
      if (!request.question || request.question.trim().length === 0) {
        return {
          success: false,
          error: 'Question cannot be empty',
        };
      }

      // Check if this is a follow-up question
      const isFollowUp = this.isFollowUpQuestion(request.question, request.conversationContext);

      // Retrieve relevant context from knowledge base
      const retrievedDocs = await this.retrieveContext(request);

      if (retrievedDocs.length === 0) {
        logger.warn('No relevant context found for question', {
          question: request.question,
          artifactId: request.artifactId,
        });

        return {
          success: true,
          answer: this.getUnanswerableResponse(request.language),
          confidence: 0.0,
          sources: [],
          conversationId: uuidv4(),
          metadata: {
            retrievedDocuments: 0,
            generationTime: Date.now() - startTime,
            isFollowUp,
          },
        };
      }

      // Build context-aware prompt
      const prompt = this.buildRAGPrompt(
        request.question,
        retrievedDocs,
        request.language,
        request.conversationContext,
        isFollowUp
      );

      // Generate answer using Bedrock
      const response = await this.bedrockService['invokeModel'](prompt, {
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        maxTokens: 1024,
        temperature: 0.3, // Lower temperature for more factual responses
        topP: 0.9,
      });

      // Extract confidence and sources
      const { answer, confidence, sources } = this.parseRAGResponse(response.content, retrievedDocs);

      const generationTime = Date.now() - startTime;

      logger.info('Question processed successfully', {
        questionLength: request.question.length,
        answerLength: answer.length,
        confidence,
        retrievedDocuments: retrievedDocs.length,
        generationTime,
      });

      return {
        success: true,
        answer,
        confidence,
        sources,
        conversationId: uuidv4(),
        metadata: {
          retrievedDocuments: retrievedDocs.length,
          generationTime,
          isFollowUp,
        },
      };
    } catch (error) {
      logger.error('Error processing question', {
        error: error instanceof Error ? error.message : String(error),
        question: request.question,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Retrieve relevant context from knowledge base
   */
  private async retrieveContext(request: QuestionRequest): Promise<KnowledgeBaseDocument[]> {
    const documents: KnowledgeBaseDocument[] = [];

    try {
      // Retrieve artifact information if specified
      if (request.artifactId && request.siteId) {
        const artifact = await this.artifactsRepository.getByArtifactId(
          request.artifactId,
          request.siteId
        );

        if (artifact) {
          documents.push({
            id: artifact.artifactId,
            content: this.formatArtifactContent(artifact),
            metadata: {
              artifactId: artifact.artifactId,
              siteId: artifact.siteId,
              contentType: 'artifact_metadata',
              language: request.language,
              source: 'artifact_database',
            },
          });
        }
      }

      // Retrieve site information if specified
      if (request.siteId) {
        const site = await this.heritageSitesRepository.getBySiteId(request.siteId);

        if (site) {
          documents.push({
            id: site.siteId,
            content: this.formatSiteContent(site),
            metadata: {
              siteId: site.siteId,
              contentType: 'site_metadata',
              language: request.language,
              source: 'site_database',
            },
          });
        }
      }

      // Retrieve cached content (previously generated descriptions, guides, etc.)
      if (request.artifactId) {
        const cachedContent = await this.contentCacheRepository.getCachedContentByArtifact(
          request.artifactId,
          'TEXT' as any, // ContentType.TEXT
          request.language
        );

        if (cachedContent) {
          documents.push({
            id: cachedContent.contentId,
            content: cachedContent.data.textContent || '',
            metadata: {
              artifactId: request.artifactId,
              contentType: 'cached_content',
              language: request.language,
              source: 'content_cache',
            },
          });
        }
      }

      // Perform semantic search based on question keywords
      const keywordDocs = await this.searchByKeywords(request.question, request.siteId);
      documents.push(...keywordDocs);

      logger.debug('Retrieved context documents', {
        count: documents.length,
        sources: documents.map(d => d.metadata.source),
      });

      return documents;
    } catch (error) {
      logger.error('Error retrieving context', {
        error: error instanceof Error ? error.message : String(error),
      });
      return documents;
    }
  }

  /**
   * Search for documents by keywords
   */
  private async searchByKeywords(
    question: string,
    siteId?: string
  ): Promise<KnowledgeBaseDocument[]> {
    const documents: KnowledgeBaseDocument[] = [];

    try {
      // Extract keywords from question (simple implementation)
      const keywords = this.extractKeywords(question);

      // Search artifacts by keywords
      if (siteId) {
        const artifacts = await this.artifactsRepository.getArtifactsBySite(siteId);

        for (const artifact of artifacts) {
          const relevanceScore = this.calculateRelevance(keywords, artifact);

          if (relevanceScore > 0.3) {
            documents.push({
              id: artifact.artifactId,
              content: this.formatArtifactContent(artifact),
              metadata: {
                artifactId: artifact.artifactId,
                siteId: artifact.siteId,
                contentType: 'artifact_metadata',
                language: 'en' as Language,
                source: 'keyword_search',
              },
            });
          }
        }
      }

      return documents.slice(0, 5); // Limit to top 5 results
    } catch (error) {
      logger.error('Error in keyword search', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Extract keywords from question
   */
  private extractKeywords(question: string): string[] {
    // Simple keyword extraction (in production, use NLP library)
    const stopWords = new Set([
      'what', 'when', 'where', 'who', 'why', 'how', 'is', 'are', 'was', 'were',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'about', 'this', 'that', 'these', 'those',
    ]);

    return question
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(keywords: string[], artifact: any): number {
    const searchText = `${artifact.name} ${artifact.description} ${artifact.historicalContext} ${artifact.culturalSignificance}`.toLowerCase();

    let matches = 0;
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        matches++;
      }
    }

    return keywords.length > 0 ? matches / keywords.length : 0;
  }

  /**
   * Format artifact content for RAG
   */
  private formatArtifactContent(artifact: any): string {
    return `Artifact: ${artifact.name}
Type: ${artifact.type}
Description: ${artifact.description}
Historical Context: ${artifact.historicalContext}
Cultural Significance: ${artifact.culturalSignificance}`;
  }

  /**
   * Format site content for RAG
   */
  private formatSiteContent(site: any): string {
    return `Heritage Site: ${site.name}
Location: ${site.location.latitude}, ${site.location.longitude}
Description: ${site.description}
Historical Period: ${site.historicalPeriod}
Cultural Significance: ${site.culturalSignificance}
Supported Languages: ${site.supportedLanguages.join(', ')}`;
  }

  /**
   * Check if question is a follow-up
   */
  private isFollowUpQuestion(question: string, context?: QAInteraction[]): boolean {
    if (!context || context.length === 0) {
      return false;
    }

    // Simple heuristics for follow-up detection
    const followUpIndicators = [
      'it', 'that', 'this', 'they', 'them', 'also', 'more', 'tell me more',
      'what about', 'and', 'but', 'however', 'additionally',
    ];

    const lowerQuestion = question.toLowerCase();
    return followUpIndicators.some(indicator => lowerQuestion.includes(indicator));
  }

  /**
   * Build RAG prompt with context
   */
  private buildRAGPrompt(
    question: string,
    documents: KnowledgeBaseDocument[],
    language: Language,
    conversationContext?: QAInteraction[],
    isFollowUp: boolean = false
  ): string {
    const languageInstruction = this.getLanguageInstruction(language);

    let prompt = `You are a knowledgeable heritage site guide assistant. Answer the user's question based on the provided context.

${languageInstruction}

Guidelines:
1. Answer based ONLY on the provided context
2. If the context doesn't contain enough information, say "I don't have enough information to answer that question accurately"
3. Be concise but informative
4. Use a friendly, conversational tone
5. If relevant, mention specific artifacts or historical details from the context
6. Do not make up information not present in the context

`;

    // Add conversation context for follow-up questions
    if (isFollowUp && conversationContext && conversationContext.length > 0) {
      prompt += `Previous Conversation:\n`;
      const recentContext = conversationContext.slice(-3); // Last 3 exchanges
      for (const interaction of recentContext) {
        prompt += `User: ${interaction.question}\nAssistant: ${interaction.answer}\n\n`;
      }
    }

    // Add retrieved context
    prompt += `Context Information:\n`;
    for (const doc of documents) {
      prompt += `\n---\nSource: ${doc.metadata.source}\n${doc.content}\n`;
    }

    prompt += `\n---\n\nUser Question: ${question}\n\nAssistant Answer:`;

    return prompt;
  }

  /**
   * Parse RAG response to extract answer, confidence, and sources
   */
  private parseRAGResponse(
    response: string,
    documents: KnowledgeBaseDocument[]
  ): { answer: string; confidence: number; sources: string[] } {
    // Extract answer (the response itself)
    const answer = response.trim();

    // Calculate confidence based on response characteristics
    let confidence = 0.8; // Default confidence

    if (answer.toLowerCase().includes("i don't have") || answer.toLowerCase().includes("not enough information")) {
      confidence = 0.2;
    } else if (answer.length < 50) {
      confidence = 0.6;
    } else if (answer.length > 200) {
      confidence = 0.9;
    }

    // Extract sources from documents
    const sources = documents.map(doc => doc.metadata.source);

    return { answer, confidence, sources: [...new Set(sources)] };
  }

  /**
   * Get unanswerable response in specified language
   */
  private getUnanswerableResponse(language: Language): string {
    const responses: Record<Language, string> = {
      [Language.ENGLISH]: "I don't have enough information to answer that question accurately. Could you please ask about a specific artifact or aspect of the heritage site?",
      [Language.HINDI]: "मेरे पास इस प्रश्न का सटीक उत्तर देने के लिए पर्याप्त जानकारी नहीं है। क्या आप किसी विशिष्ट कलाकृति या विरासत स्थल के पहलू के बारे में पूछ सकते हैं?",
      [Language.TAMIL]: "இந்த கேள்விக்கு துல்லியமாக பதிலளிக்க என்னிடம் போதுமான தகவல் இல்லை. குறிப்பிட்ட கலைப்பொருள் அல்லது பாரம்பரிய தளத்தின் அம்சம் பற்றி கேட்க முடியுமா?",
      [Language.TELUGU]: "ఈ ప్రశ్నకు ఖచ్చితంగా సమాధానం ఇవ్వడానికి నా వద్ద తగినంత సమాచారం లేదు. దయచేసి నిర్దిష్ట కళాఖండం లేదా వారసత్వ ప్రదేశం యొక్క అంశం గురించి అడగగలరా?",
      [Language.BENGALI]: "এই প্রশ্নের সঠিক উত্তর দেওয়ার জন্য আমার কাছে পর্যাপ্ত তথ্য নেই। আপনি কি একটি নির্দিষ্ট শিল্পকর্ম বা ঐতিহ্যবাহী স্থানের দিক সম্পর্কে জিজ্ঞাসা করতে পারেন?",
      [Language.MARATHI]: "या प्रश्नाचे अचूक उत्तर देण्यासाठी माझ्याकडे पुरेशी माहिती नाही. तुम्ही एखाद्या विशिष्ट कलाकृती किंवा वारसा स्थळाच्या पैलूबद्दल विचारू शकता का?",
      [Language.GUJARATI]: "આ પ્રશ્નનો ચોક્કસ જવાબ આપવા માટે મારી પાસે પૂરતી માહિતી નથી. શું તમે કોઈ ચોક્કસ કલાકૃતિ અથવા વારસા સ્થળના પાસા વિશે પૂછી શકો છો?",
      [Language.KANNADA]: "ಈ ಪ್ರಶ್ನೆಗೆ ನಿಖರವಾಗಿ ಉತ್ತರಿಸಲು ನನ್ನ ಬಳಿ ಸಾಕಷ್ಟು ಮಾಹಿತಿ ಇಲ್ಲ. ನೀವು ನಿರ್ದಿಷ್ಟ ಕಲಾಕೃತಿ ಅಥವಾ ಪರಂಪರೆಯ ಸ್ಥಳದ ಅಂಶದ ಬಗ್ಗೆ ಕೇಳಬಹುದೇ?",
      [Language.MALAYALAM]: "ഈ ചോദ്യത്തിന് കൃത്യമായി ഉത്തരം നൽകാൻ എനിക്ക് മതിയായ വിവരങ്ങൾ ഇല്ല. ഒരു നിർദ്ദിഷ്ട കലാസൃഷ്ടിയെക്കുറിച്ചോ പൈതൃക സ്ഥലത്തിന്റെ വശത്തെക്കുറിച്ചോ ചോദിക്കാമോ?",
      [Language.PUNJABI]: "ਇਸ ਸਵਾਲ ਦਾ ਸਹੀ ਜਵਾਬ ਦੇਣ ਲਈ ਮੇਰੇ ਕੋਲ ਕਾਫ਼ੀ ਜਾਣਕਾਰੀ ਨਹੀਂ ਹੈ। ਕੀ ਤੁਸੀਂ ਕਿਸੇ ਖਾਸ ਕਲਾਕ੍ਰਿਤੀ ਜਾਂ ਵਿਰਾਸਤੀ ਸਥਾਨ ਦੇ ਪਹਿਲੂ ਬਾਰੇ ਪੁੱਛ ਸਕਦੇ ਹੋ?",
    };

    return responses[language] || responses[Language.ENGLISH];
  }

  /**
   * Get language instruction
   */
  private getLanguageInstruction(language: Language): string {
    const languageNames: Record<Language, string> = {
      [Language.ENGLISH]: 'English',
      [Language.HINDI]: 'Hindi (हिंदी)',
      [Language.TAMIL]: 'Tamil (தமிழ்)',
      [Language.TELUGU]: 'Telugu (తెలుగు)',
      [Language.BENGALI]: 'Bengali (বাংলা)',
      [Language.MARATHI]: 'Marathi (मराठी)',
      [Language.GUJARATI]: 'Gujarati (ગુજરાતી)',
      [Language.KANNADA]: 'Kannada (ಕನ್ನಡ)',
      [Language.MALAYALAM]: 'Malayalam (മലയാളം)',
      [Language.PUNJABI]: 'Punjabi (ਪੰਜਾਬੀ)',
    };

    return `Respond in ${languageNames[language]}. Use natural, conversational language.`;
  }

  /**
   * Ingest knowledge base document (for future use with vector databases)
   */
  public async ingestDocument(document: KnowledgeBaseDocument): Promise<boolean> {
    try {
      logger.info('Ingesting knowledge base document', {
        documentId: document.id,
        contentType: document.metadata.contentType,
      });

      // In a production system, this would:
      // 1. Generate embeddings for the document
      // 2. Store in a vector database (e.g., Amazon OpenSearch, Pinecone)
      // 3. Enable semantic search

      // For now, we rely on the existing repositories
      return true;
    } catch (error) {
      logger.error('Error ingesting document', {
        error: error instanceof Error ? error.message : String(error),
        documentId: document.id,
      });
      return false;
    }
  }
}
