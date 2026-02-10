// Unit tests for TranslationService
import { TranslationService } from '../../src/services/translation-service';
import { Language } from '../../src/models/common';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { ComprehendClient, DetectDominantLanguageCommand } from '@aws-sdk/client-comprehend';

// Mock AWS SDK
jest.mock('@aws-sdk/client-translate');
jest.mock('@aws-sdk/client-comprehend');
jest.mock('../../src/utils/logger');

describe('TranslationService', () => {
  let service: TranslationService;
  let mockTranslateSend: jest.Mock;
  let mockComprehendSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock TranslateClient
    mockTranslateSend = jest.fn();
    (TranslateClient as jest.Mock).mockImplementation(() => ({
      send: mockTranslateSend,
    }));

    // Mock ComprehendClient
    mockComprehendSend = jest.fn();
    (ComprehendClient as jest.Mock).mockImplementation(() => ({
      send: mockComprehendSend,
    }));

    service = new TranslationService();
  });

  describe('translateText', () => {
    it('should translate text successfully', async () => {
      mockTranslateSend.mockResolvedValue({
        TranslatedText: 'यह एक परीक्षण है',
      });

      const result = await service.translateText({
        text: 'This is a test',
        sourceLanguage: Language.ENGLISH,
        targetLanguage: Language.HINDI,
      });

      expect(result.success).toBe(true);
      expect(result.translatedText).toBe('यह एक परीक्षण है');
      expect(mockTranslateSend).toHaveBeenCalledWith(expect.any(TranslateTextCommand));
    });

    it('should handle empty text', async () => {
      const result = await service.translateText({
        text: '',
        sourceLanguage: Language.ENGLISH,
        targetLanguage: Language.HINDI,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Text to translate cannot be empty');
    });

    it('should skip translation when source and target are same', async () => {
      const result = await service.translateText({
        text: 'Hello',
        sourceLanguage: Language.ENGLISH,
        targetLanguage: Language.ENGLISH,
      });

      expect(result.success).toBe(true);
      expect(result.translatedText).toBe('Hello');
      expect(result.confidence).toBe(1.0);
      expect(mockTranslateSend).not.toHaveBeenCalled();
    });

    it('should auto-detect source language', async () => {
      // Mock language detection
      mockComprehendSend.mockResolvedValueOnce({
        Languages: [{ LanguageCode: 'en', Score: 0.95 }],
      });
      mockTranslateSend.mockResolvedValueOnce({
        TranslatedText: 'नमस्ते',
      });

      const result = await service.translateText({
        text: 'Hello',
        sourceLanguage: 'auto',
        targetLanguage: Language.HINDI,
      });

      expect(result.success).toBe(true);
      expect(result.translatedText).toBe('नमस्ते');
      expect(result.detectedSourceLanguage).toBe(Language.ENGLISH);
      expect(result.confidence).toBe(0.95);
    });

    it('should handle translation errors', async () => {
      mockTranslateSend.mockRejectedValue(new Error('Translation API error'));

      const result = await service.translateText({
        text: 'Test',
        sourceLanguage: Language.ENGLISH,
        targetLanguage: Language.HINDI,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Translation API error');
    });

    it('should translate between Indian languages', async () => {
      mockTranslateSend.mockResolvedValue({
        TranslatedText: 'இது ஒரு சோதனை',
      });

      const result = await service.translateText({
        text: 'यह एक परीक्षण है',
        sourceLanguage: Language.HINDI,
        targetLanguage: Language.TAMIL,
      });

      expect(result.success).toBe(true);
      expect(result.translatedText).toBeDefined();
    });
  });

  describe('detectLanguage', () => {
    it('should detect language successfully', async () => {
      mockComprehendSend.mockResolvedValue({
        Languages: [
          { LanguageCode: 'hi', Score: 0.98 },
          { LanguageCode: 'en', Score: 0.02 },
        ],
      });

      const result = await service.detectLanguage('यह हिंदी में है');

      expect(result.success).toBe(true);
      expect(result.detectedLanguage).toBe(Language.HINDI);
      expect(result.confidence).toBe(0.98);
    });

    it('should handle empty text', async () => {
      const result = await service.detectLanguage('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Text cannot be empty');
    });

    it('should handle no language detected', async () => {
      mockComprehendSend.mockResolvedValue({
        Languages: [],
      });

      const result = await service.detectLanguage('Test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No language detected');
    });

    it('should handle unsupported language', async () => {
      mockComprehendSend.mockResolvedValue({
        Languages: [{ LanguageCode: 'fr', Score: 0.95 }],
      });

      const result = await service.detectLanguage('Bonjour');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });

    it('should detect all supported languages', async () => {
      const languages = [
        { code: 'en', lang: Language.ENGLISH },
        { code: 'hi', lang: Language.HINDI },
        { code: 'ta', lang: Language.TAMIL },
        { code: 'te', lang: Language.TELUGU },
        { code: 'bn', lang: Language.BENGALI },
      ];

      for (const { code, lang } of languages) {
        mockComprehendSend.mockResolvedValue({
          Languages: [{ LanguageCode: code, Score: 0.95 }],
        });

        const result = await service.detectLanguage('Test text');

        expect(result.success).toBe(true);
        expect(result.detectedLanguage).toBe(lang);
      }
    });
  });

  describe('translateBatch', () => {
    it('should translate multiple texts', async () => {
      mockTranslateSend
        .mockResolvedValueOnce({ TranslatedText: 'नमस्ते' })
        .mockResolvedValueOnce({ TranslatedText: 'धन्यवाद' })
        .mockResolvedValueOnce({ TranslatedText: 'अलविदा' });

      const results = await service.translateBatch(
        ['Hello', 'Thank you', 'Goodbye'],
        Language.ENGLISH,
        Language.HINDI
      );

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(results[0].translatedText).toBe('नमस्ते');
      expect(results[1].translatedText).toBe('धन्यवाद');
      expect(results[2].translatedText).toBe('अलविदा');
    });

    it('should handle partial failures in batch', async () => {
      mockTranslateSend
        .mockResolvedValueOnce({ TranslatedText: 'नमस्ते' })
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({ TranslatedText: 'अलविदा' });

      const results = await service.translateBatch(
        ['Hello', 'Thank you', 'Goodbye'],
        Language.ENGLISH,
        Language.HINDI
      );

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('getUserPreferredLanguage', () => {
    it('should prioritize user language', () => {
      const result = service.getUserPreferredLanguage(
        Language.HINDI,
        [Language.ENGLISH, Language.TAMIL],
        'ta'
      );

      expect(result).toBe(Language.HINDI);
    });

    it('should use device language if user preference not set', () => {
      const result = service.getUserPreferredLanguage(
        undefined,
        [Language.ENGLISH, Language.TAMIL],
        'ta'
      );

      expect(result).toBe(Language.TAMIL);
    });

    it('should use first site language if device language not supported', () => {
      const result = service.getUserPreferredLanguage(
        undefined,
        [Language.ENGLISH, Language.HINDI],
        'fr'
      );

      expect(result).toBe(Language.ENGLISH);
    });

    it('should default to English if nothing else available', () => {
      const result = service.getUserPreferredLanguage();

      expect(result).toBe(Language.ENGLISH);
    });
  });

  describe('getLanguageFallbackChain', () => {
    it('should create fallback chain for Hindi', () => {
      const chain = service.getLanguageFallbackChain(Language.HINDI);

      expect(chain[0]).toBe(Language.HINDI);
      expect(chain).toContain(Language.ENGLISH);
      expect(chain).toContain(Language.MARATHI);
      expect(chain).toContain(Language.GUJARATI);
    });

    it('should create fallback chain for Tamil', () => {
      const chain = service.getLanguageFallbackChain(Language.TAMIL);

      expect(chain[0]).toBe(Language.TAMIL);
      expect(chain).toContain(Language.ENGLISH);
      expect(chain).toContain(Language.TELUGU);
      expect(chain).toContain(Language.KANNADA);
    });

    it('should not duplicate languages in fallback chain', () => {
      const chain = service.getLanguageFallbackChain(Language.HINDI);

      const uniqueLanguages = new Set(chain);
      expect(chain.length).toBe(uniqueLanguages.size);
    });

    it('should handle English as preferred language', () => {
      const chain = service.getLanguageFallbackChain(Language.ENGLISH);

      expect(chain).toEqual([Language.ENGLISH]);
    });
  });

  describe('Utility Methods', () => {
    it('should check if translation is needed', () => {
      expect(service.needsTranslation(Language.ENGLISH, Language.HINDI)).toBe(true);
      expect(service.needsTranslation(Language.HINDI, Language.HINDI)).toBe(false);
    });

    it('should get supported languages', () => {
      const languages = service.getSupportedLanguages();

      expect(languages).toContain(Language.ENGLISH);
      expect(languages).toContain(Language.HINDI);
      expect(languages).toContain(Language.TAMIL);
      expect(languages.length).toBe(10);
    });

    it('should validate language support', () => {
      expect(service.isLanguageSupported(Language.ENGLISH)).toBe(true);
      expect(service.isLanguageSupported(Language.HINDI)).toBe(true);
      expect(service.isLanguageSupported('fr' as Language)).toBe(false);
    });

    it('should get language name in native script', () => {
      expect(service.getLanguageName(Language.HINDI)).toBe('हिंदी');
      expect(service.getLanguageName(Language.TAMIL)).toBe('தமிழ்');
      expect(service.getLanguageName(Language.ENGLISH)).toBe('English');
    });

    it('should get language name in English', () => {
      expect(service.getLanguageName(Language.HINDI, Language.ENGLISH)).toBe('Hindi');
      expect(service.getLanguageName(Language.TAMIL, Language.ENGLISH)).toBe('Tamil');
      expect(service.getLanguageName(Language.TELUGU, Language.ENGLISH)).toBe('Telugu');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockTranslateSend.mockRejectedValue(new Error('Network timeout'));

      const result = await service.translateText({
        text: 'Test',
        sourceLanguage: Language.ENGLISH,
        targetLanguage: Language.HINDI,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should handle invalid API responses', async () => {
      mockTranslateSend.mockResolvedValue({});

      const result = await service.translateText({
        text: 'Test',
        sourceLanguage: Language.ENGLISH,
        targetLanguage: Language.HINDI,
      });

      expect(result.success).toBe(true);
      expect(result.translatedText).toBeUndefined();
    });
  });
});
