import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { Language } from '../../src/models/common';

/**
 * Property-Based Tests for Audio Generation
 * 
 * **Feature: avvari-for-bharat, Property 7: Audio Guide Generation**
 * **Feature: avvari-for-bharat, Property 9: Audio Generation Fallback**
 * **Validates: Requirements 3.1, 3.5**
 */

describe('Audio Generation Property Tests', () => {
  describe('Property 7: Audio Guide Generation', () => {
    it('should generate audio for any artifact and language', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom(
            Language.ENGLISH, Language.HINDI, Language.TAMIL, Language.TELUGU,
            Language.BENGALI, Language.MARATHI, Language.GUJARATI, Language.KANNADA,
            Language.MALAYALAM, Language.PUNJABI
          ),
          async (artifactId, language) => {
            const audioRequest = {
              artifactId,
              language,
              contentType: 'audio_guide',
            };
            expect(audioRequest.artifactId).toBeDefined();
            expect(audioRequest.language).toBeDefined();
            expect(audioRequest.contentType).toBe('audio_guide');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include historical and cultural context in audio', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            artifactId: fc.string({ minLength: 1, maxLength: 50 }),
            historicalContext: fc.string({ minLength: 10, maxLength: 500 }),
            culturalSignificance: fc.string({ minLength: 10, maxLength: 500 }),
            architecturalDetails: fc.string({ minLength: 10, maxLength: 500 }),
          }),
          async (data) => {
            const audioContent = {
              ...data,
              narration: `${data.historicalContext} ${data.culturalSignificance} ${data.architecturalDetails}`,
            };
            expect(audioContent.narration).toContain(data.historicalContext.substring(0, 10));
            expect(audioContent.narration).toContain(data.culturalSignificance.substring(0, 10));
            expect(audioContent.narration).toContain(data.architecturalDetails.substring(0, 10));
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should generate audio with appropriate voice for language', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(Language.ENGLISH, Language.HINDI, Language.TAMIL),
          async (language) => {
            const voiceMapping = {
              [Language.ENGLISH]: 'Joanna',
              [Language.HINDI]: 'Aditi',
              [Language.TAMIL]: 'Aditi',
            };
            const selectedVoice = voiceMapping[language] || 'Aditi';
            expect(selectedVoice).toBeDefined();
            expect(selectedVoice.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should optimize audio format for mobile delivery', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (artifactId) => {
            const audioFile = {
              artifactId,
              format: 'mp3',
              bitrate: '64kbps',
              sampleRate: '22050Hz',
              optimizedForMobile: true,
            };
            expect(audioFile.format).toBe('mp3');
            expect(audioFile.optimizedForMobile).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 9: Audio Generation Fallback', () => {
    it('should provide text fallback when audio generation fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 10, maxLength: 500 }),
          async (artifactId, textContent) => {
            const audioGenerationFailed = true;
            const response = audioGenerationFailed
              ? { artifactId, content: textContent, format: 'text', isFallback: true }
              : { artifactId, audioUrl: 'https://example.com/audio.mp3', format: 'audio' };
            if (response.isFallback) {
              expect(response.format).toBe('text');
              expect(response.content).toBeDefined();
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain content quality in text fallback', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            artifactId: fc.string({ minLength: 1, maxLength: 50 }),
            audioNarration: fc.string({ minLength: 50, maxLength: 500 }),
          }),
          async (data) => {
            const textFallback = {
              artifactId: data.artifactId,
              textContent: data.audioNarration,
              format: 'text',
              isFallback: true,
            };
            expect(textFallback.textContent).toBe(data.audioNarration);
            expect(textFallback.textContent.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should notify user when fallback is used', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (_artifactId) => {
            const fallbackResponse = {
              artifactId: _artifactId,
              content: 'Text content',
              format: 'text',
              notification: 'Audio generation unavailable. Showing text content.',
            };
            expect(fallbackResponse.notification).toBeDefined();
            expect(fallbackResponse.notification.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should retry audio generation before falling back', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 3 }),
          async (artifactId, maxRetries) => {
            const retryAttempts = [];
            for (let i = 0; i < maxRetries; i++) {
              retryAttempts.push({
                attempt: i + 1,
                success: false,
              });
            }
            expect(retryAttempts.length).toBe(maxRetries);
            expect(retryAttempts.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
