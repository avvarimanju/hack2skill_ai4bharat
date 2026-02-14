// Unit tests for PollyService
import { PollyService } from '../../src/services/polly-service';
import { Language } from '../../src/models/common';
import { PollyClient, SynthesizeSpeechCommand, Engine, OutputFormat, VoiceId } from '@aws-sdk/client-polly';

// Mock AWS SDK
jest.mock('@aws-sdk/client-polly');
jest.mock('../../src/utils/logger');

describe('PollyService', () => {
  let service: PollyService;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock PollyClient
    mockSend = jest.fn();
    (PollyClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }));

    service = new PollyService();
  });

  describe('synthesizeSpeech', () => {
    it('should synthesize speech successfully', async () => {
      const mockAudioStream = {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([1, 2, 3, 4]);
        },
      };

      mockSend.mockResolvedValue({
        AudioStream: mockAudioStream,
        ContentType: 'audio/mpeg',
      });

      const result = await service.synthesizeSpeech({
        text: 'Hello world',
        language: Language.ENGLISH,
      });

      expect(result.success).toBe(true);
      expect(result.audioStream).toBeDefined();
      expect(result.contentType).toBe('audio/mpeg');
      expect(result.voiceUsed).toBe('Kajal');
      expect(mockSend).toHaveBeenCalledWith(expect.any(SynthesizeSpeechCommand));
    });

    it('should handle empty text', async () => {
      const result = await service.synthesizeSpeech({
        text: '',
        language: Language.ENGLISH,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Text cannot be empty');
    });

    it('should use Hindi voice for Hindi language', async () => {
      const mockAudioStream = {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([1, 2, 3]);
        },
      };

      mockSend.mockResolvedValue({
        AudioStream: mockAudioStream,
        ContentType: 'audio/mpeg',
      });

      const result = await service.synthesizeSpeech({
        text: 'नमस्ते',
        language: Language.HINDI,
      });

      expect(result.success).toBe(true);
      expect(result.voiceUsed).toBe('Kajal');
    });

    it('should use fallback voice for unsupported languages', async () => {
      const mockAudioStream = {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([1, 2, 3]);
        },
      };

      mockSend.mockResolvedValue({
        AudioStream: mockAudioStream,
        ContentType: 'audio/mpeg',
      });

      const result = await service.synthesizeSpeech({
        text: 'வணக்கம்',
        language: Language.TAMIL,
      });

      expect(result.success).toBe(true);
      expect(result.voiceUsed).toBe('Kajal'); // Fallback to English (Indian) voice
    });

    it('should handle custom voice ID', async () => {
      const mockAudioStream = {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([1, 2, 3]);
        },
      };

      mockSend.mockResolvedValue({
        AudioStream: mockAudioStream,
        ContentType: 'audio/mpeg',
      });

      const result = await service.synthesizeSpeech({
        text: 'Test',
        language: Language.ENGLISH,
        voiceId: 'Aditi' as VoiceId,
      });

      expect(result.success).toBe(true);
      expect(result.voiceUsed).toBe('Aditi');
    });

    it('should handle different output formats', async () => {
      const mockAudioStream = {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([1, 2, 3]);
        },
      };

      mockSend.mockResolvedValue({
        AudioStream: mockAudioStream,
        ContentType: 'audio/ogg',
      });

      const result = await service.synthesizeSpeech({
        text: 'Test',
        language: Language.ENGLISH,
        outputFormat: 'ogg_vorbis' as OutputFormat,
      });

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('audio/ogg');
    });

    it('should handle no audio stream returned', async () => {
      mockSend.mockResolvedValue({
        AudioStream: null,
        ContentType: 'audio/mpeg',
      });

      const result = await service.synthesizeSpeech({
        text: 'Test',
        language: Language.ENGLISH,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No audio stream returned from Polly');
    });

    it('should handle synthesis errors', async () => {
      mockSend.mockRejectedValue(new Error('Polly API error'));

      const result = await service.synthesizeSpeech({
        text: 'Test',
        language: Language.ENGLISH,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Polly API error');
    });
  });

  describe('synthesizeWithSSML', () => {
    it('should synthesize speech with SSML', async () => {
      const mockAudioStream = {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([1, 2, 3]);
        },
      };

      mockSend.mockResolvedValue({
        AudioStream: mockAudioStream,
        ContentType: 'audio/mpeg',
      });

      const ssml = '<speak>Hello <break time="500ms"/> world</speak>';
      const result = await service.synthesizeWithSSML(ssml, Language.ENGLISH);

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('synthesizeMultipleFormats', () => {
    it('should synthesize in multiple formats', async () => {
      const mockAudioStream = {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([1, 2, 3]);
        },
      };

      mockSend.mockResolvedValue({
        AudioStream: mockAudioStream,
        ContentType: 'audio/mpeg',
      });

      const results = await service.synthesizeMultipleFormats(
        'Test',
        Language.ENGLISH,
        ['mp3' as OutputFormat, 'ogg_vorbis' as OutputFormat]
      );

      expect(results.mp3.success).toBe(true);
      expect(results.ogg_vorbis.success).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('getVoiceForLanguage', () => {
    it('should return voice info for English', () => {
      const voice = service.getVoiceForLanguage(Language.ENGLISH);

      expect(voice.voiceId).toBe('Kajal');
      expect(voice.engine).toBe('neural');
      expect(voice.languageCode).toBe('en-IN');
      expect(voice.gender).toBe('Female');
    });

    it('should return voice info for Hindi', () => {
      const voice = service.getVoiceForLanguage(Language.HINDI);

      expect(voice.voiceId).toBe('Kajal');
      expect(voice.languageCode).toBe('hi-IN');
    });

    it('should return fallback voice for unsupported language', () => {
      const voice = service.getVoiceForLanguage(Language.TAMIL);

      expect(voice.voiceId).toBe('Kajal');
      expect(voice.languageCode).toBe('en-IN'); // Fallback to English (Indian)
    });
  });

  describe('hasNativeSupport', () => {
    it('should return true for English', () => {
      expect(service.hasNativeSupport(Language.ENGLISH)).toBe(true);
    });

    it('should return true for Hindi', () => {
      expect(service.hasNativeSupport(Language.HINDI)).toBe(true);
    });

    it('should return false for Tamil', () => {
      expect(service.hasNativeSupport(Language.TAMIL)).toBe(false);
    });

    it('should return false for Telugu', () => {
      expect(service.hasNativeSupport(Language.TELUGU)).toBe(false);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return all supported languages', () => {
      const languages = service.getSupportedLanguages();

      expect(languages).toContain(Language.ENGLISH);
      expect(languages).toContain(Language.HINDI);
      expect(languages).toContain(Language.TAMIL);
      expect(languages.length).toBe(10);
    });
  });

  describe('SSML Utilities', () => {
    it('should create basic SSML', () => {
      const ssml = service.createSSML('Hello world');

      expect(ssml).toBe('<speak>Hello world</speak>');
    });

    it('should create SSML with rate', () => {
      const ssml = service.createSSML('Hello world', { rate: 'slow' });

      expect(ssml).toContain('<prosody rate="slow">');
      expect(ssml).toContain('</prosody>');
    });

    it('should create SSML with pitch', () => {
      const ssml = service.createSSML('Hello world', { pitch: 'high' });

      expect(ssml).toContain('<prosody pitch="high">');
    });

    it('should create SSML with volume', () => {
      const ssml = service.createSSML('Hello world', { volume: 'loud' });

      expect(ssml).toContain('<prosody volume="loud">');
    });

    it('should create SSML with emphasis', () => {
      const ssml = service.createSSML('Hello world', { emphasis: 'strong' });

      expect(ssml).toContain('<emphasis level="strong">');
      expect(ssml).toContain('</emphasis>');
    });

    it('should create SSML with multiple options', () => {
      const ssml = service.createSSML('Hello world', {
        rate: 'fast',
        pitch: 'high',
        volume: 'loud',
        emphasis: 'strong',
      });

      expect(ssml).toContain('<prosody rate="fast" pitch="high" volume="loud">');
      expect(ssml).toContain('<emphasis level="strong">');
    });

    it('should add pause to text', () => {
      const text = service.addPause('Hello', '500ms');

      expect(text).toBe('Hello<break time="500ms"/>');
    });

    it('should validate SSML', () => {
      expect(service.isValidSSML('<speak>Hello</speak>')).toBe(true);
      expect(service.isValidSSML('Hello')).toBe(false);
      expect(service.isValidSSML('<speak>Hello')).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    it('should get optimal sample rate for mp3', () => {
      const sampleRate = service.getOptimalSampleRate('mp3' as OutputFormat);

      expect(sampleRate).toBe('22050');
    });

    it('should get optimal sample rate for ogg_vorbis', () => {
      const sampleRate = service.getOptimalSampleRate('ogg_vorbis' as OutputFormat);

      expect(sampleRate).toBe('22050');
    });

    it('should get optimal sample rate for pcm', () => {
      const sampleRate = service.getOptimalSampleRate('pcm' as OutputFormat);

      expect(sampleRate).toBe('16000');
    });

    it('should estimate audio duration', () => {
      const text = 'This is a test sentence with ten words in it.';
      const duration = service.estimateAudioDuration(text);

      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(60); // Should be less than a minute
    });

    it('should estimate longer audio duration', () => {
      const text = 'word '.repeat(300); // 300 words
      const duration = service.estimateAudioDuration(text);

      expect(duration).toBeGreaterThan(60); // Should be more than a minute
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockSend.mockRejectedValue(new Error('Network timeout'));

      const result = await service.synthesizeSpeech({
        text: 'Test',
        language: Language.ENGLISH,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should handle invalid API responses', async () => {
      mockSend.mockResolvedValue({});

      const result = await service.synthesizeSpeech({
        text: 'Test',
        language: Language.ENGLISH,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No audio stream returned from Polly');
    });
  });
});
