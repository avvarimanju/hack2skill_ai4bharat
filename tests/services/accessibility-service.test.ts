// Unit tests for AccessibilityService
import { 
  AccessibilityService, 
  TextSize, 
  ContrastLevel, 
  PlaybackSpeed,
  ContentWithAccessibility 
} from '../../src/services/accessibility-service';

jest.mock('../../src/utils/logger');

describe('AccessibilityService', () => {
  let service: AccessibilityService;

  beforeEach(() => {
    service = new AccessibilityService();
  });

  describe('initialization', () => {
    it('should initialize with default settings', () => {
      const settings = service.getSettings();

      expect(settings.audioDescriptions).toBe(false);
      expect(settings.highContrast).toBe(false);
      expect(settings.textSize).toBe('medium');
      expect(settings.contrastLevel).toBe('normal');
      expect(settings.playbackSpeed).toBe(1.0);
      expect(settings.captionsEnabled).toBe(false);
      expect(settings.screenReaderOptimized).toBe(false);
      expect(settings.reduceMotion).toBe(false);
      expect(settings.keyboardNavigationEnabled).toBe(true);
    });

    it('should initialize with default playback controls', () => {
      const controls = service.getPlaybackControls();

      expect(controls.play).toBe(true);
      expect(controls.pause).toBe(true);
      expect(controls.stop).toBe(true);
      expect(controls.rewind).toBe(true);
      expect(controls.fastForward).toBe(true);
      expect(controls.volumeControl).toBe(true);
      expect(controls.speedControl).toBe(true);
      expect(controls.skipSilence).toBe(false);
    });
  });

  describe('updateSettings', () => {
    it('should update accessibility settings', () => {
      service.updateSettings({
        audioDescriptions: true,
        textSize: 'large',
        playbackSpeed: 1.5,
      });

      const settings = service.getSettings();

      expect(settings.audioDescriptions).toBe(true);
      expect(settings.textSize).toBe('large');
      expect(settings.playbackSpeed).toBe(1.5);
    });

    it('should preserve unchanged settings', () => {
      service.updateSettings({
        audioDescriptions: true,
      });

      const settings = service.getSettings();

      expect(settings.audioDescriptions).toBe(true);
      expect(settings.highContrast).toBe(false); // Unchanged
      expect(settings.textSize).toBe('medium'); // Unchanged
    });
  });

  describe('audio descriptions', () => {
    it('should enable audio descriptions', () => {
      service.enableAudioDescriptions();

      const settings = service.getSettings();
      expect(settings.audioDescriptions).toBe(true);
    });

    it('should disable audio descriptions', () => {
      service.enableAudioDescriptions();
      service.disableAudioDescriptions();

      const settings = service.getSettings();
      expect(settings.audioDescriptions).toBe(false);
    });

    it('should generate audio descriptions for video content', async () => {
      const descriptions = await service.generateAudioDescriptions('video-1', 'video');

      expect(descriptions).toBeInstanceOf(Array);
      expect(descriptions.length).toBeGreaterThan(0);
      expect(descriptions[0]).toHaveProperty('timestamp');
      expect(descriptions[0]).toHaveProperty('duration');
      expect(descriptions[0]).toHaveProperty('description');
      expect(descriptions[0]).toHaveProperty('priority');
    });

    it('should generate audio descriptions for infographic content', async () => {
      const descriptions = await service.generateAudioDescriptions('infographic-1', 'infographic');

      expect(descriptions).toBeInstanceOf(Array);
      expect(descriptions.length).toBeGreaterThan(0);
    });

    it('should cache generated audio descriptions', async () => {
      const descriptions1 = await service.generateAudioDescriptions('video-1', 'video');
      const descriptions2 = await service.generateAudioDescriptions('video-1', 'video');

      expect(descriptions1).toEqual(descriptions2);
    });

    it('should retrieve cached audio descriptions', async () => {
      await service.generateAudioDescriptions('video-1', 'video');

      const cached = service.getAudioDescriptions('video-1');

      expect(cached).not.toBeNull();
      expect(cached).toBeInstanceOf(Array);
    });

    it('should return null for non-existent audio descriptions', () => {
      const cached = service.getAudioDescriptions('non-existent');

      expect(cached).toBeNull();
    });
  });

  describe('high contrast mode', () => {
    it('should enable high contrast mode', () => {
      service.enableHighContrast();

      const settings = service.getSettings();
      expect(settings.highContrast).toBe(true);
      expect(settings.contrastLevel).toBe('high');
    });

    it('should disable high contrast mode', () => {
      service.enableHighContrast();
      service.disableHighContrast();

      const settings = service.getSettings();
      expect(settings.highContrast).toBe(false);
      expect(settings.contrastLevel).toBe('normal');
    });
  });

  describe('text size', () => {
    it('should set text size to small', () => {
      service.setTextSize('small');

      const settings = service.getSettings();
      expect(settings.textSize).toBe('small');
    });

    it('should set text size to large', () => {
      service.setTextSize('large');

      const settings = service.getSettings();
      expect(settings.textSize).toBe('large');
    });

    it('should set text size to extra-large', () => {
      service.setTextSize('extra-large');

      const settings = service.getSettings();
      expect(settings.textSize).toBe('extra-large');
    });
  });

  describe('contrast level', () => {
    it('should set contrast level to high', () => {
      service.setContrastLevel('high');

      const settings = service.getSettings();
      expect(settings.contrastLevel).toBe('high');
      expect(settings.highContrast).toBe(true);
    });

    it('should set contrast level to extra-high', () => {
      service.setContrastLevel('extra-high');

      const settings = service.getSettings();
      expect(settings.contrastLevel).toBe('extra-high');
      expect(settings.highContrast).toBe(true);
    });

    it('should set contrast level to normal', () => {
      service.setContrastLevel('high');
      service.setContrastLevel('normal');

      const settings = service.getSettings();
      expect(settings.contrastLevel).toBe('normal');
      expect(settings.highContrast).toBe(false);
    });
  });

  describe('playback speed', () => {
    it('should set playback speed to 0.5x', () => {
      service.setPlaybackSpeed(0.5);

      const settings = service.getSettings();
      expect(settings.playbackSpeed).toBe(0.5);
    });

    it('should set playback speed to 1.5x', () => {
      service.setPlaybackSpeed(1.5);

      const settings = service.getSettings();
      expect(settings.playbackSpeed).toBe(1.5);
    });

    it('should set playback speed to 2.0x', () => {
      service.setPlaybackSpeed(2.0);

      const settings = service.getSettings();
      expect(settings.playbackSpeed).toBe(2.0);
    });
  });

  describe('captions', () => {
    it('should enable captions', () => {
      service.enableCaptions();

      const settings = service.getSettings();
      expect(settings.captionsEnabled).toBe(true);
    });

    it('should disable captions', () => {
      service.enableCaptions();
      service.disableCaptions();

      const settings = service.getSettings();
      expect(settings.captionsEnabled).toBe(false);
    });
  });

  describe('screen reader optimization', () => {
    it('should enable screen reader optimization', () => {
      service.enableScreenReaderOptimization();

      const settings = service.getSettings();
      expect(settings.screenReaderOptimized).toBe(true);
    });

    it('should disable screen reader optimization', () => {
      service.enableScreenReaderOptimization();
      service.disableScreenReaderOptimization();

      const settings = service.getSettings();
      expect(settings.screenReaderOptimized).toBe(false);
    });
  });

  describe('reduce motion', () => {
    it('should enable reduce motion', () => {
      service.enableReduceMotion();

      const settings = service.getSettings();
      expect(settings.reduceMotion).toBe(true);
    });

    it('should disable reduce motion', () => {
      service.enableReduceMotion();
      service.disableReduceMotion();

      const settings = service.getSettings();
      expect(settings.reduceMotion).toBe(false);
    });
  });

  describe('visual accessibility options', () => {
    it('should return visual accessibility options', () => {
      const options = service.getVisualAccessibilityOptions();

      expect(options).toHaveProperty('highContrastMode');
      expect(options).toHaveProperty('largeTextMode');
      expect(options).toHaveProperty('colorBlindMode');
      expect(options).toHaveProperty('reduceAnimations');
      expect(options).toHaveProperty('increasedSpacing');
      expect(options).toHaveProperty('focusIndicators');
    });

    it('should reflect high contrast mode in visual options', () => {
      service.enableHighContrast();

      const options = service.getVisualAccessibilityOptions();
      expect(options.highContrastMode).toBe(true);
    });

    it('should reflect large text mode in visual options', () => {
      service.setTextSize('large');

      const options = service.getVisualAccessibilityOptions();
      expect(options.largeTextMode).toBe(true);
    });

    it('should reflect extra-large text mode in visual options', () => {
      service.setTextSize('extra-large');

      const options = service.getVisualAccessibilityOptions();
      expect(options.largeTextMode).toBe(true);
      expect(options.increasedSpacing).toBe(true);
    });

    it('should reflect reduce motion in visual options', () => {
      service.enableReduceMotion();

      const options = service.getVisualAccessibilityOptions();
      expect(options.reduceAnimations).toBe(true);
    });
  });

  describe('playback controls', () => {
    it('should update playback controls', () => {
      service.updatePlaybackControls({
        skipSilence: true,
        speedControl: false,
      });

      const controls = service.getPlaybackControls();
      expect(controls.skipSilence).toBe(true);
      expect(controls.speedControl).toBe(false);
    });

    it('should preserve unchanged playback controls', () => {
      service.updatePlaybackControls({
        skipSilence: true,
      });

      const controls = service.getPlaybackControls();
      expect(controls.skipSilence).toBe(true);
      expect(controls.play).toBe(true); // Unchanged
      expect(controls.pause).toBe(true); // Unchanged
    });
  });

  describe('applyAccessibilityEnhancements', () => {
    it('should apply enhancements to video content', async () => {
      service.enableAudioDescriptions();
      service.enableCaptions();

      const enhanced = await service.applyAccessibilityEnhancements(
        'video-1',
        'video',
        'video-url'
      );

      expect(enhanced.contentId).toBe('video-1');
      expect(enhanced.contentType).toBe('video');
      expect(enhanced.audioDescriptions).toBeDefined();
      expect(enhanced.captions).toBeDefined();
      expect(enhanced.accessibilityMetadata.hasAudioDescription).toBe(true);
      expect(enhanced.accessibilityMetadata.hasCaptions).toBe(true);
    });

    it('should apply enhancements to infographic content', async () => {
      service.enableAudioDescriptions();

      const enhanced = await service.applyAccessibilityEnhancements(
        'infographic-1',
        'infographic',
        'infographic-url'
      );

      expect(enhanced.contentId).toBe('infographic-1');
      expect(enhanced.contentType).toBe('infographic');
      expect(enhanced.audioDescriptions).toBeDefined();
      expect(enhanced.alternativeText).toBeDefined();
      expect(enhanced.accessibilityMetadata.hasAudioDescription).toBe(true);
    });

    it('should not add audio descriptions when disabled', async () => {
      const enhanced = await service.applyAccessibilityEnhancements(
        'video-1',
        'video',
        'video-url'
      );

      expect(enhanced.audioDescriptions).toBeUndefined();
      expect(enhanced.accessibilityMetadata.hasAudioDescription).toBe(false);
    });

    it('should not add captions when disabled', async () => {
      const enhanced = await service.applyAccessibilityEnhancements(
        'video-1',
        'video',
        'video-url'
      );

      expect(enhanced.captions).toBeUndefined();
      expect(enhanced.accessibilityMetadata.hasCaptions).toBe(false);
    });
  });

  describe('WCAG compliance', () => {
    it('should check WCAG compliance for video with all features', async () => {
      service.enableAudioDescriptions();
      service.enableCaptions();

      const enhanced = await service.applyAccessibilityEnhancements(
        'video-1',
        'video',
        'video-url'
      );

      const compliance = service.checkWCAGCompliance(enhanced);

      expect(compliance.compliant).toBe(true);
      expect(compliance.level).toBe('AAA');
      expect(compliance.issues).toHaveLength(0);
    });

    it('should detect missing audio descriptions', async () => {
      const enhanced = await service.applyAccessibilityEnhancements(
        'video-1',
        'video',
        'video-url'
      );

      const compliance = service.checkWCAGCompliance(enhanced);

      expect(compliance.compliant).toBe(false);
      expect(compliance.level).toBe('none');
      expect(compliance.issues).toContain('Missing audio descriptions for video content');
    });

    it('should detect missing captions', async () => {
      const enhanced = await service.applyAccessibilityEnhancements(
        'video-1',
        'video',
        'video-url'
      );

      const compliance = service.checkWCAGCompliance(enhanced);

      expect(compliance.compliant).toBe(false);
      expect(compliance.issues).toContain('Missing captions for audio/video content');
    });

    it('should detect missing alternative text for infographics', async () => {
      // Create content without alternative text manually
      const enhanced: ContentWithAccessibility = {
        contentId: 'infographic-1',
        contentType: 'infographic',
        originalContent: 'infographic-url',
        accessibilityMetadata: {
          hasAudioDescription: false,
          hasCaptions: false,
          hasTranscript: false,
        },
      };

      const compliance = service.checkWCAGCompliance(enhanced);

      expect(compliance.compliant).toBe(false);
      expect(compliance.issues).toContain('Missing alternative text for infographic');
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all settings to defaults', () => {
      service.enableAudioDescriptions();
      service.enableHighContrast();
      service.setTextSize('large');
      service.setPlaybackSpeed(1.5);

      service.resetToDefaults();

      const settings = service.getSettings();
      expect(settings.audioDescriptions).toBe(false);
      expect(settings.highContrast).toBe(false);
      expect(settings.textSize).toBe('medium');
      expect(settings.playbackSpeed).toBe(1.0);
    });

    it('should reset playback controls to defaults', () => {
      service.updatePlaybackControls({ skipSilence: true });

      service.resetToDefaults();

      const controls = service.getPlaybackControls();
      expect(controls.skipSilence).toBe(false);
    });
  });

  describe('getAccessibilitySummary', () => {
    it('should return accessibility summary', () => {
      const summary = service.getAccessibilitySummary();

      expect(summary).toHaveProperty('audioDescriptionsEnabled');
      expect(summary).toHaveProperty('highContrastEnabled');
      expect(summary).toHaveProperty('textSize');
      expect(summary).toHaveProperty('playbackSpeed');
      expect(summary).toHaveProperty('captionsEnabled');
      expect(summary).toHaveProperty('screenReaderOptimized');
      expect(summary).toHaveProperty('cachedDescriptions');
    });

    it('should reflect current settings in summary', () => {
      service.enableAudioDescriptions();
      service.enableHighContrast();
      service.setTextSize('large');

      const summary = service.getAccessibilitySummary();

      expect(summary.audioDescriptionsEnabled).toBe(true);
      expect(summary.highContrastEnabled).toBe(true);
      expect(summary.textSize).toBe('large');
    });

    it('should track cached descriptions count', async () => {
      await service.generateAudioDescriptions('video-1', 'video');
      await service.generateAudioDescriptions('video-2', 'video');

      const summary = service.getAccessibilitySummary();

      expect(summary.cachedDescriptions).toBe(2);
    });
  });
});
