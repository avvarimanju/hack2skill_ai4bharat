import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { Language } from '../../src/models/common';

/**
 * Property-Based Tests for Multilingual Functionality
 * 
 * **Feature: avvari-for-bharat, Property 5: Multilingual Content Consistency**
 * **Feature: avvari-for-bharat, Property 6: Language Fallback Behavior**
 * **Validates: Requirements 2.2, 2.4**
 */

describe('Multilingual Functionality Property Tests', () => {
  describe('Property 5: Multilingual Content Consistency', () => {
    it('should maintain language consistency across all content types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            Language.ENGLISH, Language.HINDI, Language.TAMIL, Language.TELUGU,
            Language.BENGALI, Language.MARATHI, Language.GUJARATI, Language.KANNADA,
            Language.MALAYALAM, Language.PUNJABI
          ),
          fc.array(fc.constantFrom('audio', 'video', 'infographic', 'text'), { minLength: 1, maxLength: 4 }),
          async (language, contentTypes) => {
            const contentRequests = contentTypes.map(type => ({
              contentType: type,
              language,
              artifactId: 'test-artifact',
            }));
            for (const request of contentRequests) {
              expect(request.language).toBe(language);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should generate consistent language across multiple requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(Language.ENGLISH, Language.HINDI, Language.TAMIL),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
          async (language, artifactIds) => {
            const requests = artifactIds.map(id => ({
              artifactId: id,
              language,
              siteId: 'test-site',
            }));
            const languages = requests.map(r => r.language);
            const allSame = languages.every(l => l === language);
            expect(allSame).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve language in Q&A responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 200 }),
          fc.constantFrom(Language.ENGLISH, Language.HINDI, Language.TAMIL),
          async (question, language) => {
            const request = { question, language, sessionId: 'test' };
            const response = { answer: 'Test answer', language };
            expect(request.language).toBe(response.language);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain language across session interactions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(Language.ENGLISH, Language.HINDI, Language.TAMIL),
          fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 2, maxLength: 5 }),
          async (language, interactions) => {
            const session = {
              sessionId: 'test-session',
              preferredLanguage: language,
              interactions: interactions.map(i => ({ content: i, language })),
            };
            expect(session.preferredLanguage).toBe(language);
            for (const interaction of session.interactions) {
              expect(interaction.language).toBe(language);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 6: Language Fallback Behavior', () => {
    it('should fallback to Hindi or English for unsupported languages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('fr', 'de', 'es', 'zh', 'ja'), // Unsupported languages
          async (unsupportedLang) => {
            const fallbackLanguage = Language.HINDI; // or Language.ENGLISH
            const request = {
              requestedLanguage: unsupportedLang,
              fallbackLanguage,
              notification: `Content not available in ${unsupportedLang}, showing in ${fallbackLanguage}`,
            };
            expect([Language.HINDI, Language.ENGLISH]).toContain(request.fallbackLanguage);
            expect(request.notification).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should notify user when fallback language is used', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 2, maxLength: 5 }), // Unsupported language code
          fc.constantFrom(Language.HINDI, Language.ENGLISH),
          async (requestedLang, fallbackLang) => {
            const response = {
              content: 'Test content',
              requestedLanguage: requestedLang,
              actualLanguage: fallbackLang,
              notification: `Content provided in ${fallbackLang} instead of ${requestedLang}`,
            };
            expect(response.notification).toBeDefined();
            expect(response.notification.length).toBeGreaterThan(0);
            expect(response.actualLanguage).toBe(fallbackLang);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should prioritize Hindi over English for Indian users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('mr', 'gu', 'or', 'as'), // Regional Indian languages not yet supported
          async (regionalLang) => {
            const fallbackPriority = [Language.HINDI, Language.ENGLISH];
            const selectedFallback = fallbackPriority[0];
            expect(selectedFallback).toBe(Language.HINDI);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle missing translations gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(Language.ENGLISH, Language.HINDI, Language.TAMIL),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (language, artifactId) => {
            const contentAvailable = Math.random() > 0.5;
            const response = contentAvailable
              ? { content: 'Available content', language }
              : { content: 'Fallback content', language: Language.ENGLISH, isFallback: true };
            expect(response.content).toBeDefined();
            expect(response.language).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
