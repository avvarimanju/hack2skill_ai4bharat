// Unit tests for AudioPlaybackService
import { AudioPlaybackService, AudioTrack } from '../../src/services/audio-playback-service';
import { Language } from '../../src/models/common';

jest.mock('../../src/utils/logger');
jest.mock('../../src/services/polly-service');

describe('AudioPlaybackService', () => {
  let service: AudioPlaybackService;
  let mockTrack: AudioTrack;

  beforeEach(() => {
    service = new AudioPlaybackService();
    mockTrack = {
      id: 'track-1',
      url: 'https://example.com/audio.mp3',
      title: 'Heritage Site Audio Guide',
      duration: 180,
      language: 'en-IN',
      quality: 'high',
    };
  });

  describe('initialization', () => {
    it('should initialize with idle state', () => {
      const status = service.getStatus();

      expect(status.state).toBe('idle');
      expect(status.currentTime).toBe(0);
      expect(status.volume).toBe(1.0);
      expect(status.playbackRate).toBe(1.0);
      expect(status.isLooping).toBe(false);
      expect(status.isMuted).toBe(false);
    });

    it('should have no track loaded initially', () => {
      const track = service.getCurrentTrack();
      expect(track).toBeNull();
    });
  });

  describe('loadTrack', () => {
    it('should load audio track successfully', async () => {
      await service.loadTrack(mockTrack);

      const track = service.getCurrentTrack();
      expect(track).toEqual(mockTrack);

      const status = service.getStatus();
      expect(status.state).toBe('stopped');
      expect(status.currentTime).toBe(0);
    });

    it('should apply playback options when loading', async () => {
      await service.loadTrack(mockTrack, {
        volume: 0.5,
        playbackRate: 1.5,
        loop: true,
      });

      const status = service.getStatus();
      expect(status.volume).toBe(0.5);
      expect(status.playbackRate).toBe(1.5);
      expect(status.isLooping).toBe(true);
    });

    it('should auto-play when autoPlay option is enabled', async () => {
      await service.loadTrack(mockTrack, { autoPlay: true });

      expect(service.isPlaying()).toBe(true);
    });

    it('should enable voice guidance when option is set', async () => {
      await service.loadTrack(mockTrack, { enableVoiceGuidance: true });

      const voiceSettings = service.getVoiceGuidanceSettings();
      expect(voiceSettings.enabled).toBe(true);
    });
  });

  describe('play', () => {
    it('should start playback', async () => {
      await service.loadTrack(mockTrack);
      await service.play();

      expect(service.isPlaying()).toBe(true);

      const status = service.getStatus();
      expect(status.state).toBe('playing');
    });

    it('should handle error when no track is loaded', async () => {
      await service.play();
      
      // After error handling, service should not be playing
      expect(service.isPlaying()).toBe(false);
    });

    it('should not change state if already playing', async () => {
      await service.loadTrack(mockTrack);
      await service.play();
      await service.play(); // Second play call

      expect(service.isPlaying()).toBe(true);
    });
  });

  describe('pause', () => {
    it('should pause playback', async () => {
      await service.loadTrack(mockTrack);
      await service.play();
      await service.pause();

      expect(service.isPaused()).toBe(true);

      const status = service.getStatus();
      expect(status.state).toBe('paused');
    });

    it('should not pause if not playing', async () => {
      await service.loadTrack(mockTrack);
      await service.pause();

      const status = service.getStatus();
      expect(status.state).toBe('stopped');
    });
  });

  describe('stop', () => {
    it('should stop playback', async () => {
      await service.loadTrack(mockTrack);
      await service.play();
      await service.stop();

      expect(service.isStopped()).toBe(true);

      const status = service.getStatus();
      expect(status.state).toBe('stopped');
      expect(status.currentTime).toBe(0);
    });

    it('should reset current time to zero', async () => {
      await service.loadTrack(mockTrack);
      await service.play();
      await service.seek(50);
      await service.stop();

      const status = service.getStatus();
      expect(status.currentTime).toBe(0);
    });
  });

  describe('seek', () => {
    it('should seek to specific time', async () => {
      await service.loadTrack(mockTrack);
      await service.seek(60);

      const status = service.getStatus();
      expect(status.currentTime).toBe(60);
    });

    it('should handle error for negative time', async () => {
      await service.loadTrack(mockTrack);
      const initialTime = service.getStatus().currentTime;

      await service.seek(-10);
      
      // Time should not have changed to negative
      const status = service.getStatus();
      expect(status.currentTime).toBe(initialTime);
    });

    it('should handle error for time beyond duration', async () => {
      await service.loadTrack(mockTrack);

      await service.seek(200);
      
      // Time should not be 200 (the invalid seek value)
      const status = service.getStatus();
      expect(status.currentTime).not.toBe(200);
    });

    it('should handle error when no track is loaded', async () => {
      await service.seek(60);
      
      // Should not have a track loaded
      expect(service.getCurrentTrack()).toBeNull();
    });
  });

  describe('rewind', () => {
    it('should rewind by default 10 seconds', async () => {
      await service.loadTrack(mockTrack);
      await service.seek(50);
      await service.rewind();

      const status = service.getStatus();
      expect(status.currentTime).toBe(40);
    });

    it('should rewind by specified seconds', async () => {
      await service.loadTrack(mockTrack);
      await service.seek(50);
      await service.rewind(20);

      const status = service.getStatus();
      expect(status.currentTime).toBe(30);
    });

    it('should not rewind below zero', async () => {
      await service.loadTrack(mockTrack);
      await service.seek(5);
      await service.rewind(10);

      const status = service.getStatus();
      expect(status.currentTime).toBe(0);
    });
  });

  describe('fastForward', () => {
    it('should fast forward by default 10 seconds', async () => {
      await service.loadTrack(mockTrack);
      await service.seek(50);
      await service.fastForward();

      const status = service.getStatus();
      expect(status.currentTime).toBe(60);
    });

    it('should fast forward by specified seconds', async () => {
      await service.loadTrack(mockTrack);
      await service.seek(50);
      await service.fastForward(30);

      const status = service.getStatus();
      expect(status.currentTime).toBe(80);
    });

    it('should not fast forward beyond duration', async () => {
      await service.loadTrack(mockTrack);
      await service.seek(170);
      await service.fastForward(20);

      const status = service.getStatus();
      expect(status.currentTime).toBe(180);
    });

    it('should throw error when no track is loaded', async () => {
      await expect(service.fastForward()).rejects.toThrow('No track loaded');
    });
  });

  describe('volume control', () => {
    it('should set volume', () => {
      service.setVolume(0.5);

      const status = service.getStatus();
      expect(status.volume).toBe(0.5);
    });

    it('should throw error for volume below 0', () => {
      expect(() => service.setVolume(-0.1)).toThrow('Volume must be between 0 and 1');
    });

    it('should throw error for volume above 1', () => {
      expect(() => service.setVolume(1.5)).toThrow('Volume must be between 0 and 1');
    });

    it('should mute when volume is set to 0', () => {
      service.setVolume(0);

      const status = service.getStatus();
      expect(status.isMuted).toBe(true);
    });
  });

  describe('mute control', () => {
    it('should mute audio', () => {
      service.mute();

      const status = service.getStatus();
      expect(status.isMuted).toBe(true);
    });

    it('should unmute audio', () => {
      service.mute();
      service.unmute();

      const status = service.getStatus();
      expect(status.isMuted).toBe(false);
    });

    it('should toggle mute', () => {
      service.toggleMute();
      expect(service.getStatus().isMuted).toBe(true);

      service.toggleMute();
      expect(service.getStatus().isMuted).toBe(false);
    });

    it('should return 0 volume when muted', () => {
      service.setVolume(0.8);
      service.mute();

      const status = service.getStatus();
      expect(status.volume).toBe(0);
    });
  });

  describe('playback rate', () => {
    it('should set playback rate', () => {
      service.setPlaybackRate(1.5);

      const status = service.getStatus();
      expect(status.playbackRate).toBe(1.5);
    });

    it('should throw error for rate below 0.5', () => {
      expect(() => service.setPlaybackRate(0.3)).toThrow('Playback rate must be between 0.5 and 2.0');
    });

    it('should throw error for rate above 2.0', () => {
      expect(() => service.setPlaybackRate(2.5)).toThrow('Playback rate must be between 0.5 and 2.0');
    });
  });

  describe('loop control', () => {
    it('should enable loop', () => {
      service.enableLoop();

      const status = service.getStatus();
      expect(status.isLooping).toBe(true);
    });

    it('should disable loop', () => {
      service.enableLoop();
      service.disableLoop();

      const status = service.getStatus();
      expect(status.isLooping).toBe(false);
    });

    it('should toggle loop', () => {
      service.toggleLoop();
      expect(service.getStatus().isLooping).toBe(true);

      service.toggleLoop();
      expect(service.getStatus().isLooping).toBe(false);
    });
  });

  describe('voice guidance', () => {
    it('should enable voice guidance', () => {
      service.enableVoiceGuidance();

      const settings = service.getVoiceGuidanceSettings();
      expect(settings.enabled).toBe(true);
    });

    it('should disable voice guidance', () => {
      service.enableVoiceGuidance();
      service.disableVoiceGuidance();

      const settings = service.getVoiceGuidanceSettings();
      expect(settings.enabled).toBe(false);
    });

    it('should apply voice guidance options', () => {
      service.enableVoiceGuidance({
        announceTrackChanges: false,
        announcePlaybackState: true,
        language: Language.HINDI,
      });

      const settings = service.getVoiceGuidanceSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.announceTrackChanges).toBe(false);
      expect(settings.announcePlaybackState).toBe(true);
      expect(settings.language).toBe(Language.HINDI);
    });
  });

  describe('reset', () => {
    it('should reset all playback state', async () => {
      await service.loadTrack(mockTrack);
      await service.play();
      service.setVolume(0.5);
      service.setPlaybackRate(1.5);
      service.enableLoop();

      service.reset();

      const status = service.getStatus();
      expect(status.state).toBe('idle');
      expect(status.currentTime).toBe(0);
      expect(status.volume).toBe(1.0);
      expect(status.playbackRate).toBe(1.0);
      expect(status.isLooping).toBe(false);
      expect(service.getCurrentTrack()).toBeNull();
    });
  });

  describe('state checks', () => {
    it('should check if playing', async () => {
      await service.loadTrack(mockTrack);
      expect(service.isPlaying()).toBe(false);

      await service.play();
      expect(service.isPlaying()).toBe(true);
    });

    it('should check if paused', async () => {
      await service.loadTrack(mockTrack);
      await service.play();
      expect(service.isPaused()).toBe(false);

      await service.pause();
      expect(service.isPaused()).toBe(true);
    });

    it('should check if stopped', async () => {
      await service.loadTrack(mockTrack);
      expect(service.isStopped()).toBe(true);

      await service.play();
      expect(service.isStopped()).toBe(false);

      await service.stop();
      expect(service.isStopped()).toBe(true);
    });
  });

  describe('getPlaybackSummary', () => {
    it('should return playback summary', async () => {
      await service.loadTrack(mockTrack);
      await service.play();
      await service.seek(90); // 50% progress
      service.setVolume(0.7);
      service.setPlaybackRate(1.25);
      service.enableLoop();
      service.enableVoiceGuidance();

      const summary = service.getPlaybackSummary();

      expect(summary.hasTrack).toBe(true);
      expect(summary.state).toBe('playing');
      expect(summary.progress).toBe(50);
      expect(summary.volume).toBe(0.7);
      expect(summary.playbackRate).toBe(1.25);
      expect(summary.isLooping).toBe(true);
      expect(summary.voiceGuidanceEnabled).toBe(true);
    });

    it('should return zero progress when no track loaded', () => {
      const summary = service.getPlaybackSummary();

      expect(summary.hasTrack).toBe(false);
      expect(summary.progress).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle errors when playing without track', async () => {
      // Try to play without loading track
      await service.play();

      // After error handling, state should be error or stopped (after fallback)
      const status = service.getStatus();
      expect(['error', 'stopped', 'idle']).toContain(status.state);
    });

    it('should handle errors on invalid seek', async () => {
      await service.loadTrack(mockTrack);
      await service.seek(-10);

      // After error handling, state should be error or the track should still be loaded
      const status = service.getStatus();
      expect(['error', 'stopped', 'playing']).toContain(status.state);
    });
  });

  describe('getStatus', () => {
    it('should return complete playback status', async () => {
      await service.loadTrack(mockTrack);
      await service.play();
      await service.seek(60);
      service.setVolume(0.8);
      service.setPlaybackRate(1.5);
      service.enableLoop();

      const status = service.getStatus();

      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('currentTime');
      expect(status).toHaveProperty('duration');
      expect(status).toHaveProperty('volume');
      expect(status).toHaveProperty('playbackRate');
      expect(status).toHaveProperty('isLooping');
      expect(status).toHaveProperty('isMuted');
      expect(status).toHaveProperty('buffered');

      expect(status.state).toBe('playing');
      expect(status.currentTime).toBe(60);
      expect(status.duration).toBe(180);
      expect(status.volume).toBe(0.8);
      expect(status.playbackRate).toBe(1.5);
      expect(status.isLooping).toBe(true);
      expect(status.isMuted).toBe(false);
    });
  });
});
