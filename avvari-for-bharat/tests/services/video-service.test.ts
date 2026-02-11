// Unit tests for VideoService
import { VideoService } from '../../src/services/video-service';
import { Language } from '../../src/models/common';
import { TranslationService } from '../../src/services/translation-service';

// Mock dependencies
jest.mock('../../src/services/translation-service');
jest.mock('../../src/utils/logger');

describe('VideoService', () => {
  let service: VideoService;
  let mockTranslationService: jest.Mocked<TranslationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock TranslationService
    mockTranslationService = {
      translateText: jest.fn(),
    } as any;

    service = new VideoService(mockTranslationService);
  });

  describe('generateVideo', () => {
    it('should generate video successfully', async () => {
      const result = await service.generateVideo({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        contentType: 'historical-reconstruction',
        language: Language.ENGLISH,
      });

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBeDefined();
      expect(result.thumbnailUrl).toBeDefined();
      expect(result.duration).toBe(120); // Default duration
      expect(result.format).toBe('mp4');
      expect(result.quality).toBe('medium'); // Default quality
    });

    it('should handle missing artifact ID', async () => {
      const result = await service.generateVideo({
        artifactId: '',
        siteId: 'site-456',
        contentType: 'artifact-showcase',
        language: Language.HINDI,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Artifact ID and Site ID are required');
    });

    it('should handle missing site ID', async () => {
      const result = await service.generateVideo({
        artifactId: 'artifact-123',
        siteId: '',
        contentType: 'site-tour',
        language: Language.TAMIL,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Artifact ID and Site ID are required');
    });

    it('should generate video with custom quality', async () => {
      const result = await service.generateVideo({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        contentType: 'cultural-context',
        language: Language.ENGLISH,
        quality: 'high',
      });

      expect(result.success).toBe(true);
      expect(result.quality).toBe('high');
    });

    it('should generate video with custom duration', async () => {
      const result = await service.generateVideo({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        contentType: 'historical-reconstruction',
        language: Language.ENGLISH,
        duration: 300,
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBe(300);
    });

    it('should generate video with subtitles', async () => {
      mockTranslationService.translateText.mockResolvedValue({
        success: true,
        translatedText: 'Translated subtitle text',
      });

      const result = await service.generateVideo({
        artifactId: 'artifact-123',
        siteId: 'site-456',
        contentType: 'artifact-showcase',
        language: Language.ENGLISH,
        includeSubtitles: true,
        subtitleLanguages: [Language.HINDI, Language.TAMIL],
      });

      expect(result.success).toBe(true);
      expect(result.subtitles).toBeDefined();
      expect(result.subtitles?.length).toBe(2);
    });
  });

  describe('processVideo', () => {
    it('should process video successfully', async () => {
      const result = await service.processVideo({
        sourceVideoUrl: 'https://example.com/video.mp4',
        targetQuality: 'high',
        targetFormat: 'mp4',
      });

      expect(result.success).toBe(true);
      expect(result.processedVideoUrl).toBeDefined();
      expect(result.format).toBe('mp4');
      expect(result.quality).toBe('high');
      expect(result.fileSize).toBeGreaterThan(0);
    });

    it('should handle missing source URL', async () => {
      const result = await service.processVideo({
        sourceVideoUrl: '',
        targetQuality: 'medium',
        targetFormat: 'webm',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Source video URL is required');
    });

    it('should generate thumbnail when requested', async () => {
      const result = await service.processVideo({
        sourceVideoUrl: 'https://example.com/video.mp4',
        targetQuality: 'medium',
        targetFormat: 'mp4',
        generateThumbnail: true,
      });

      expect(result.success).toBe(true);
      expect(result.thumbnailUrl).toBeDefined();
      expect(result.thumbnailUrl).toContain('.jpg');
    });

    it('should extract audio when requested', async () => {
      const result = await service.processVideo({
        sourceVideoUrl: 'https://example.com/video.mp4',
        targetQuality: 'medium',
        targetFormat: 'mp4',
        extractAudio: true,
      });

      expect(result.success).toBe(true);
      expect(result.audioUrl).toBeDefined();
      expect(result.audioUrl).toContain('.mp3');
    });

    it('should process video to different formats', async () => {
      const formats: Array<'mp4' | 'webm' | 'hls'> = ['mp4', 'webm', 'hls'];

      for (const format of formats) {
        const result = await service.processVideo({
          sourceVideoUrl: 'https://example.com/video.mp4',
          targetQuality: 'medium',
          targetFormat: format,
        });

        expect(result.success).toBe(true);
        expect(result.format).toBe(format);
      }
    });

    it('should process video to different qualities', async () => {
      const qualities: Array<'low' | 'medium' | 'high' | 'ultra'> = ['low', 'medium', 'high', 'ultra'];

      for (const quality of qualities) {
        const result = await service.processVideo({
          sourceVideoUrl: 'https://example.com/video.mp4',
          targetQuality: quality,
          targetFormat: 'mp4',
        });

        expect(result.success).toBe(true);
        expect(result.quality).toBe(quality);
      }
    });
  });

  describe('generateSubtitles', () => {
    it('should generate subtitles successfully', async () => {
      mockTranslationService.translateText.mockResolvedValue({
        success: true,
        translatedText: 'Translated text',
      });

      const result = await service.generateSubtitles({
        videoId: 'video-123',
        transcript: 'This is a test transcript',
        sourceLanguage: Language.ENGLISH,
        targetLanguages: [Language.HINDI, Language.TAMIL],
      });

      expect(result.success).toBe(true);
      expect(result.subtitles).toBeDefined();
      expect(result.subtitles?.length).toBe(2);
      expect(mockTranslationService.translateText).toHaveBeenCalledTimes(2);
    });

    it('should handle empty transcript', async () => {
      const result = await service.generateSubtitles({
        videoId: 'video-123',
        transcript: '',
        sourceLanguage: Language.ENGLISH,
        targetLanguages: [Language.HINDI],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transcript is required');
    });

    it('should not translate when source and target are same', async () => {
      const result = await service.generateSubtitles({
        videoId: 'video-123',
        transcript: 'Test transcript',
        sourceLanguage: Language.ENGLISH,
        targetLanguages: [Language.ENGLISH],
      });

      expect(result.success).toBe(true);
      expect(mockTranslationService.translateText).not.toHaveBeenCalled();
    });

    it('should generate subtitles in multiple languages', async () => {
      mockTranslationService.translateText.mockResolvedValue({
        success: true,
        translatedText: 'Translated',
      });

      const result = await service.generateSubtitles({
        videoId: 'video-123',
        transcript: 'Test',
        sourceLanguage: Language.ENGLISH,
        targetLanguages: [Language.HINDI, Language.TAMIL, Language.TELUGU, Language.BENGALI],
      });

      expect(result.success).toBe(true);
      expect(result.subtitles?.length).toBe(4);
    });

    it('should handle translation failures gracefully', async () => {
      mockTranslationService.translateText.mockResolvedValue({
        success: false,
        error: 'Translation failed',
      });

      const result = await service.generateSubtitles({
        videoId: 'video-123',
        transcript: 'Test',
        sourceLanguage: Language.ENGLISH,
        targetLanguages: [Language.HINDI],
      });

      // Should still succeed but use original text
      expect(result.success).toBe(true);
      expect(result.subtitles?.length).toBe(1);
    });
  });

  describe('generateSRTContent', () => {
    it('should generate SRT content correctly', () => {
      const timecodes = [
        { startTime: 0, endTime: 2.5, text: 'First subtitle' },
        { startTime: 3, endTime: 5.5, text: 'Second subtitle' },
        { startTime: 6, endTime: 8, text: 'Third subtitle' },
      ];

      const srtContent = service.generateSRTContent(timecodes);

      expect(srtContent).toContain('1\n');
      expect(srtContent).toContain('00:00:00,000 --> 00:00:02,500');
      expect(srtContent).toContain('First subtitle');
      expect(srtContent).toContain('2\n');
      expect(srtContent).toContain('00:00:03,000 --> 00:00:05,500');
      expect(srtContent).toContain('Second subtitle');
    });

    it('should handle empty timecodes', () => {
      const srtContent = service.generateSRTContent([]);

      expect(srtContent).toBe('');
    });

    it('should format time correctly for hours', () => {
      const timecodes = [
        { startTime: 3661.5, endTime: 3665, text: 'After one hour' },
      ];

      const srtContent = service.generateSRTContent(timecodes);

      expect(srtContent).toContain('01:01:01,500 --> 01:01:05,000');
    });
  });

  describe('getOptimalQuality', () => {
    it('should return low quality for slow network', () => {
      const quality = service.getOptimalQuality('slow');

      expect(quality).toBe('low');
    });

    it('should return medium quality for medium network', () => {
      const quality = service.getOptimalQuality('medium');

      expect(quality).toBe('medium');
    });

    it('should return high quality for fast network', () => {
      const quality = service.getOptimalQuality('fast');

      expect(quality).toBe('high');
    });
  });

  describe('Quality and Format Configuration', () => {
    it('should get quality configuration', () => {
      const config = service.getQualityConfig('high');

      expect(config.resolution).toBe('1080p');
      expect(config.bitrate).toBe('3000k');
      expect(config.fps).toBe(30);
      expect(config.codec).toBe('h264');
    });

    it('should get format configuration', () => {
      const config = service.getFormatConfig('mp4');

      expect(config.container).toBe('mp4');
      expect(config.videoCodec).toBe('h264');
      expect(config.audioCodec).toBe('aac');
      expect(config.extension).toBe('.mp4');
    });

    it('should get all quality configurations', () => {
      const qualities: Array<'low' | 'medium' | 'high' | 'ultra'> = ['low', 'medium', 'high', 'ultra'];

      qualities.forEach(quality => {
        const config = service.getQualityConfig(quality);
        expect(config).toBeDefined();
        expect(config.resolution).toBeDefined();
        expect(config.bitrate).toBeDefined();
      });
    });

    it('should get all format configurations', () => {
      const formats: Array<'mp4' | 'webm' | 'hls'> = ['mp4', 'webm', 'hls'];

      formats.forEach(format => {
        const config = service.getFormatConfig(format);
        expect(config).toBeDefined();
        expect(config.container).toBeDefined();
        expect(config.extension).toBeDefined();
      });
    });
  });

  describe('estimateFileSize', () => {
    it('should estimate file size for low quality', () => {
      const fileSize = service.estimateFileSize(120, 'low');

      expect(fileSize).toBeGreaterThan(0);
      expect(fileSize).toBeLessThan(10); // Should be less than 10 MB for 2 min low quality
    });

    it('should estimate file size for high quality', () => {
      const fileSize = service.estimateFileSize(120, 'high');

      expect(fileSize).toBeGreaterThan(10); // Should be more than 10 MB for 2 min high quality
    });

    it('should scale with duration', () => {
      const size1min = service.estimateFileSize(60, 'medium');
      const size2min = service.estimateFileSize(120, 'medium');

      expect(size2min).toBeCloseTo(size1min * 2, 1);
    });

    it('should scale with quality', () => {
      const sizeLow = service.estimateFileSize(120, 'low');
      const sizeHigh = service.estimateFileSize(120, 'high');

      expect(sizeHigh).toBeGreaterThan(sizeLow);
    });
  });

  describe('Validation Methods', () => {
    it('should validate supported formats', () => {
      expect(service.isFormatSupported('mp4')).toBe(true);
      expect(service.isFormatSupported('webm')).toBe(true);
      expect(service.isFormatSupported('hls')).toBe(true);
      expect(service.isFormatSupported('avi')).toBe(false);
      expect(service.isFormatSupported('mkv')).toBe(false);
    });

    it('should validate supported qualities', () => {
      expect(service.isQualitySupported('low')).toBe(true);
      expect(service.isQualitySupported('medium')).toBe(true);
      expect(service.isQualitySupported('high')).toBe(true);
      expect(service.isQualitySupported('ultra')).toBe(true);
      expect(service.isQualitySupported('super')).toBe(false);
    });

    it('should get list of supported formats', () => {
      const formats = service.getSupportedFormats();

      expect(formats).toContain('mp4');
      expect(formats).toContain('webm');
      expect(formats).toContain('hls');
      expect(formats.length).toBe(3);
    });

    it('should get list of supported qualities', () => {
      const qualities = service.getSupportedQualities();

      expect(qualities).toContain('low');
      expect(qualities).toContain('medium');
      expect(qualities).toContain('high');
      expect(qualities).toContain('ultra');
      expect(qualities.length).toBe(4);
    });
  });
});
