// Translation Service using Amazon Translate
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { ComprehendClient, DetectDominantLanguageCommand } from '@aws-sdk/client-comprehend';
import { Language } from '../models/common';
import { logger } from '../utils/logger';

export interface TranslationRequest {
  text: string;
  sourceLanguage?: Language | 'auto';
  targetLanguage: Language;
  preserveFormatting?: boolean;
}

export interface TranslationResult {
  success: boolean;
  translatedText?: string;
  detectedSourceLanguage?: Language;
  confidence?: number;
  error?: string;
}

export interface LanguageDetectionResult {
  success: boolean;
  detectedLanguage?: Language;
  confidence?: number;
  error?: string;
}

export class TranslationService {
  private translateClient: TranslateClient;
  private comprehendClient: ComprehendClient;
  private readonly languageCodeMap: Record<Language, string>;
  private readonly reverseLanguageMap: Record<string, Language>;

  constructor(region?: string) {
    const awsRegion = region || process.env.AWS_REGION || 'us-east-1';
    
    this.translateClient = new TranslateClient({ region: awsRegion });
    this.comprehendClient = new ComprehendClient({ region: awsRegion });

    // Map our Language enum to AWS Translate language codes
    this.languageCodeMap = {
      [Language.ENGLISH]: 'en',
      [Language.HINDI]: 'hi',
      [Language.TAMIL]: 'ta',
      [Language.TELUGU]: 'te',
      [Language.BENGALI]: 'bn',
      [Language.MARATHI]: 'mr',
      [Language.GUJARATI]: 'gu',
      [Language.KANNADA]: 'kn',
      [Language.MALAYALAM]: 'ml',
      [Language.PUNJABI]: 'pa',
    };

    // Reverse mapping for detection
    this.reverseLanguageMap = Object.entries(this.languageCodeMap).reduce(
      (acc, [key, value]) => {
        acc[value] = key as Language;
        return acc;
      },
      {} as Record<string, Language>
    );

    logger.info('Translation service initialized', { region: awsRegion });
  }

  /**
   * Translate text from one language to another
   */
  public async translateText(request: TranslationRequest): Promise<TranslationResult> {
    logger.info('Translating text', {
      textLength: request.text.length,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
    });

    try {
      // Validate input
      if (!request.text || request.text.trim().length === 0) {
        return {
          success: false,
          error: 'Text to translate cannot be empty',
        };
      }

      // Detect source language if not provided
      let sourceLanguageCode: string;
      let detectedLanguage: Language | undefined;
      let confidence: number | undefined;

      if (!request.sourceLanguage || request.sourceLanguage === 'auto') {
        const detection = await this.detectLanguage(request.text);
        if (!detection.success || !detection.detectedLanguage) {
          return {
            success: false,
            error: 'Failed to detect source language',
          };
        }
        detectedLanguage = detection.detectedLanguage;
        confidence = detection.confidence;
        sourceLanguageCode = this.languageCodeMap[detectedLanguage];
      } else {
        sourceLanguageCode = this.languageCodeMap[request.sourceLanguage];
      }

      const targetLanguageCode = this.languageCodeMap[request.targetLanguage];

      // Skip translation if source and target are the same
      if (sourceLanguageCode === targetLanguageCode) {
        logger.debug('Source and target languages are the same, skipping translation');
        return {
          success: true,
          translatedText: request.text,
          detectedSourceLanguage: detectedLanguage,
          confidence: 1.0,
        };
      }

      // Perform translation
      const command = new TranslateTextCommand({
        Text: request.text,
        SourceLanguageCode: sourceLanguageCode,
        TargetLanguageCode: targetLanguageCode,
      });

      const response = await this.translateClient.send(command);

      logger.info('Translation completed successfully', {
        sourceLanguage: sourceLanguageCode,
        targetLanguage: targetLanguageCode,
        originalLength: request.text.length,
        translatedLength: response.TranslatedText?.length || 0,
      });

      return {
        success: true,
        translatedText: response.TranslatedText,
        detectedSourceLanguage: detectedLanguage || request.sourceLanguage as Language,
        confidence,
      };
    } catch (error) {
      logger.error('Translation failed', {
        error: error instanceof Error ? error.message : String(error),
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Translation failed',
      };
    }
  }

  /**
   * Detect the language of given text using AWS Comprehend
   */
  public async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    logger.debug('Detecting language', { textLength: text.length });

    try {
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: 'Text cannot be empty',
        };
      }

      const command = new DetectDominantLanguageCommand({ Text: text });
      const response = await this.comprehendClient.send(command);

      if (!response.Languages || response.Languages.length === 0) {
        return {
          success: false,
          error: 'No language detected',
        };
      }

      // Get the most confident language
      const dominantLanguage = response.Languages[0];
      const languageCode = dominantLanguage.LanguageCode;
      const confidence = dominantLanguage.Score;

      // Map to our Language enum
      const detectedLanguage = this.reverseLanguageMap[languageCode || ''];

      if (!detectedLanguage) {
        logger.warn('Detected language not supported', { languageCode });
        return {
          success: false,
          error: `Detected language '${languageCode}' is not supported`,
        };
      }

      logger.info('Language detected', {
        language: detectedLanguage,
        confidence,
      });

      return {
        success: true,
        detectedLanguage,
        confidence,
      };
    } catch (error) {
      logger.error('Language detection failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Language detection failed',
      };
    }
  }

  /**
   * Translate multiple texts in batch
   */
  public async translateBatch(
    texts: string[],
    sourceLanguage: Language | 'auto',
    targetLanguage: Language
  ): Promise<TranslationResult[]> {
    logger.info('Batch translation started', {
      count: texts.length,
      sourceLanguage,
      targetLanguage,
    });

    const results: TranslationResult[] = [];

    for (const text of texts) {
      const result = await this.translateText({
        text,
        sourceLanguage,
        targetLanguage,
      });
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    logger.info('Batch translation completed', {
      total: texts.length,
      successful: successCount,
      failed: texts.length - successCount,
    });

    return results;
  }

  /**
   * Get user's preferred language based on various factors
   */
  public getUserPreferredLanguage(
    userLanguage?: Language,
    siteLanguages?: Language[],
    deviceLanguage?: string
  ): Language {
    // Priority: user preference > site languages > device language > default
    
    if (userLanguage) {
      return userLanguage;
    }

    if (deviceLanguage) {
      const mappedLanguage = this.reverseLanguageMap[deviceLanguage];
      if (mappedLanguage && (!siteLanguages || siteLanguages.includes(mappedLanguage))) {
        return mappedLanguage;
      }
    }

    if (siteLanguages && siteLanguages.length > 0) {
      return siteLanguages[0];
    }

    return Language.ENGLISH; // Default fallback
  }

  /**
   * Get language fallback chain
   */
  public getLanguageFallbackChain(preferredLanguage: Language): Language[] {
    const fallbackChain: Language[] = [preferredLanguage];

    // Add English as universal fallback if not already preferred
    if (preferredLanguage !== Language.ENGLISH) {
      fallbackChain.push(Language.ENGLISH);
    }

    // Add regional fallbacks based on language family
    const regionalFallbacks: Record<Language, Language[]> = {
      [Language.HINDI]: [Language.MARATHI, Language.GUJARATI],
      [Language.TAMIL]: [Language.TELUGU, Language.KANNADA, Language.MALAYALAM],
      [Language.TELUGU]: [Language.TAMIL, Language.KANNADA],
      [Language.BENGALI]: [Language.HINDI],
      [Language.MARATHI]: [Language.HINDI, Language.GUJARATI],
      [Language.GUJARATI]: [Language.HINDI, Language.MARATHI],
      [Language.KANNADA]: [Language.TAMIL, Language.TELUGU],
      [Language.MALAYALAM]: [Language.TAMIL, Language.KANNADA],
      [Language.PUNJABI]: [Language.HINDI],
      [Language.ENGLISH]: [],
    };

    const regional = regionalFallbacks[preferredLanguage] || [];
    for (const lang of regional) {
      if (!fallbackChain.includes(lang)) {
        fallbackChain.push(lang);
      }
    }

    return fallbackChain;
  }

  /**
   * Check if translation is needed
   */
  public needsTranslation(sourceLanguage: Language, targetLanguage: Language): boolean {
    return sourceLanguage !== targetLanguage;
  }

  /**
   * Get supported languages
   */
  public getSupportedLanguages(): Language[] {
    return Object.keys(this.languageCodeMap) as Language[];
  }

  /**
   * Validate language code
   */
  public isLanguageSupported(language: Language): boolean {
    return language in this.languageCodeMap;
  }

  /**
   * Get language name in native script
   */
  public getLanguageName(language: Language, inLanguage?: Language): string {
    const nativeNames: Record<Language, string> = {
      [Language.ENGLISH]: 'English',
      [Language.HINDI]: 'हिंदी',
      [Language.TAMIL]: 'தமிழ்',
      [Language.TELUGU]: 'తెలుగు',
      [Language.BENGALI]: 'বাংলা',
      [Language.MARATHI]: 'मराठी',
      [Language.GUJARATI]: 'ગુજરાતી',
      [Language.KANNADA]: 'ಕನ್ನಡ',
      [Language.MALAYALAM]: 'മലയാളം',
      [Language.PUNJABI]: 'ਪੰਜਾਬੀ',
    };

    const englishNames: Record<Language, string> = {
      [Language.ENGLISH]: 'English',
      [Language.HINDI]: 'Hindi',
      [Language.TAMIL]: 'Tamil',
      [Language.TELUGU]: 'Telugu',
      [Language.BENGALI]: 'Bengali',
      [Language.MARATHI]: 'Marathi',
      [Language.GUJARATI]: 'Gujarati',
      [Language.KANNADA]: 'Kannada',
      [Language.MALAYALAM]: 'Malayalam',
      [Language.PUNJABI]: 'Punjabi',
    };

    if (inLanguage === Language.ENGLISH) {
      return englishNames[language];
    }

    return nativeNames[language];
  }
}
