// Audio Playback Service with Controls and Error Handling
import { logger } from '../utils/logger';
import { PollyService } from './polly-service';
import { Language } from '../models/common';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';
export type AudioQuality = 'low' | 'medium' | 'high';

export interface AudioPlaybackOptions {
  autoPlay?: boolean;
  loop?: boolean;
  volume?: number; // 0.0 to 1.0
  playbackRate?: number; // 0.5 to 2.0
  quality?: AudioQuality;
  enableVoiceGuidance?: boolean;
}

export interface AudioTrack {
  id: string;
  url: string;
  title: string;
  duration: number;
  language: string;
  quality: AudioQuality;
}

export interface PlaybackStatus {
  state: PlaybackState;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isLooping: boolean;
  isMuted: boolean;
  buffered: number;
  error?: string;
}

export interface VoiceGuidanceOptions {
  enabled: boolean;
  announceTrackChanges: boolean;
  announcePlaybackState: boolean;
  announceErrors: boolean;
  language: Language;
}

export class AudioPlaybackService {
  private currentTrack: AudioTrack | null;
  private playbackState: PlaybackState;
  private currentTime: number;
  private volume: number;
  private playbackRate: number;
  private isLooping: boolean;
  private isMuted: boolean;
  private voiceGuidance: VoiceGuidanceOptions;
  private pollyService: PollyService;
  private fallbackAttempts: number;
  private maxFallbackAttempts: number;

  constructor() {
    this.currentTrack = null;
    this.playbackState = 'idle';
    this.currentTime = 0;
    this.volume = 1.0;
    this.playbackRate = 1.0;
    this.isLooping = false;
    this.isMuted = false;
    this.fallbackAttempts = 0;
    this.maxFallbackAttempts = 3;
    
    this.voiceGuidance = {
      enabled: false,
      announceTrackChanges: true,
      announcePlaybackState: true,
      announceErrors: true,
      language: Language.ENGLISH,
    };

    this.pollyService = new PollyService();

    logger.info('Audio playback service initialized');
  }

  /**
   * Load audio track
   */
  public async loadTrack(track: AudioTrack, options?: AudioPlaybackOptions): Promise<void> {
    try {
      this.playbackState = 'loading';
      logger.info('Loading audio track', { trackId: track.id, title: track.title });

      // Simulate loading
      await new Promise(resolve => setTimeout(resolve, 100));

      this.currentTrack = track;
      this.currentTime = 0;

      // Apply options
      if (options) {
        if (options.volume !== undefined) this.volume = options.volume;
        if (options.playbackRate !== undefined) this.playbackRate = options.playbackRate;
        if (options.loop !== undefined) this.isLooping = options.loop;
        if (options.enableVoiceGuidance !== undefined) {
          this.voiceGuidance.enabled = options.enableVoiceGuidance;
        }
      }

      this.playbackState = 'stopped';
      this.fallbackAttempts = 0;

      // Announce track loaded
      if (this.voiceGuidance.enabled && this.voiceGuidance.announceTrackChanges) {
        await this.announceVoiceGuidance(`Loaded ${track.title}`);
      }

      logger.info('Audio track loaded successfully', { trackId: track.id });

      // Auto-play if enabled
      if (options?.autoPlay) {
        await this.play();
      }
    } catch (error) {
      await this.handlePlaybackError(error, 'load');
    }
  }

  /**
   * Play audio
   */
  public async play(): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new Error('No track loaded');
      }

      if (this.playbackState === 'playing') {
        logger.debug('Already playing');
        return;
      }

      logger.info('Starting playback', { trackId: this.currentTrack.id });

      this.playbackState = 'playing';

      // Announce playback started
      if (this.voiceGuidance.enabled && this.voiceGuidance.announcePlaybackState) {
        await this.announceVoiceGuidance('Playing');
      }

      logger.info('Playback started', { trackId: this.currentTrack.id });
    } catch (error) {
      await this.handlePlaybackError(error, 'play');
    }
  }

  /**
   * Pause audio
   */
  public async pause(): Promise<void> {
    try {
      if (this.playbackState !== 'playing') {
        logger.debug('Not playing, cannot pause');
        return;
      }

      logger.info('Pausing playback');

      this.playbackState = 'paused';

      // Announce playback paused
      if (this.voiceGuidance.enabled && this.voiceGuidance.announcePlaybackState) {
        await this.announceVoiceGuidance('Paused');
      }

      logger.info('Playback paused');
    } catch (error) {
      await this.handlePlaybackError(error, 'pause');
    }
  }

  /**
   * Stop audio
   */
  public async stop(): Promise<void> {
    try {
      if (this.playbackState === 'idle' || this.playbackState === 'stopped') {
        logger.debug('Already stopped');
        return;
      }

      logger.info('Stopping playback');

      this.playbackState = 'stopped';
      this.currentTime = 0;

      // Announce playback stopped
      if (this.voiceGuidance.enabled && this.voiceGuidance.announcePlaybackState) {
        await this.announceVoiceGuidance('Stopped');
      }

      logger.info('Playback stopped');
    } catch (error) {
      await this.handlePlaybackError(error, 'stop');
    }
  }

  /**
   * Seek to specific time
   */
  public async seek(time: number): Promise<void> {
    try {
      if (!this.currentTrack) {
        throw new Error('No track loaded');
      }

      if (time < 0 || time > this.currentTrack.duration) {
        throw new Error('Invalid seek time');
      }

      logger.info('Seeking to time', { time });

      this.currentTime = time;

      logger.info('Seek completed', { time });
    } catch (error) {
      await this.handlePlaybackError(error, 'seek');
    }
  }

  /**
   * Rewind by specified seconds
   */
  public async rewind(seconds: number = 10): Promise<void> {
    const newTime = Math.max(0, this.currentTime - seconds);
    await this.seek(newTime);
  }

  /**
   * Fast forward by specified seconds
   */
  public async fastForward(seconds: number = 10): Promise<void> {
    if (!this.currentTrack) {
      throw new Error('No track loaded');
    }
    const newTime = Math.min(this.currentTrack.duration, this.currentTime + seconds);
    await this.seek(newTime);
  }

  /**
   * Set volume
   */
  public setVolume(volume: number): void {
    if (volume < 0 || volume > 1) {
      throw new Error('Volume must be between 0 and 1');
    }

    this.volume = volume;
    this.isMuted = volume === 0;

    logger.info('Volume set', { volume });
  }

  /**
   * Mute audio
   */
  public mute(): void {
    this.isMuted = true;
    logger.info('Audio muted');
  }

  /**
   * Unmute audio
   */
  public unmute(): void {
    this.isMuted = false;
    logger.info('Audio unmuted');
  }

  /**
   * Toggle mute
   */
  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    logger.info('Audio mute toggled', { isMuted: this.isMuted });
  }

  /**
   * Set playback rate
   */
  public setPlaybackRate(rate: number): void {
    if (rate < 0.5 || rate > 2.0) {
      throw new Error('Playback rate must be between 0.5 and 2.0');
    }

    this.playbackRate = rate;
    logger.info('Playback rate set', { rate });
  }

  /**
   * Enable loop
   */
  public enableLoop(): void {
    this.isLooping = true;
    logger.info('Loop enabled');
  }

  /**
   * Disable loop
   */
  public disableLoop(): void {
    this.isLooping = false;
    logger.info('Loop disabled');
  }

  /**
   * Toggle loop
   */
  public toggleLoop(): void {
    this.isLooping = !this.isLooping;
    logger.info('Loop toggled', { isLooping: this.isLooping });
  }

  /**
   * Get current playback status
   */
  public getStatus(): PlaybackStatus {
    return {
      state: this.playbackState,
      currentTime: this.currentTime,
      duration: this.currentTrack?.duration || 0,
      volume: this.isMuted ? 0 : this.volume,
      playbackRate: this.playbackRate,
      isLooping: this.isLooping,
      isMuted: this.isMuted,
      buffered: 100, // Simulated
    };
  }

  /**
   * Get current track
   */
  public getCurrentTrack(): AudioTrack | null {
    return this.currentTrack;
  }

  /**
   * Enable voice guidance
   */
  public enableVoiceGuidance(options?: Partial<VoiceGuidanceOptions>): void {
    this.voiceGuidance = {
      ...this.voiceGuidance,
      enabled: true,
      ...options,
    };

    logger.info('Voice guidance enabled', { options: this.voiceGuidance });
  }

  /**
   * Disable voice guidance
   */
  public disableVoiceGuidance(): void {
    this.voiceGuidance.enabled = false;
    logger.info('Voice guidance disabled');
  }

  /**
   * Announce voice guidance message
   */
  private async announceVoiceGuidance(message: string): Promise<void> {
    try {
      logger.debug('Announcing voice guidance', { message });

      // Use Polly service to generate voice guidance
      await this.pollyService.synthesizeSpeech({
        text: message,
        language: this.voiceGuidance.language,
        voiceId: 'Aditi', // Indian English voice
      });

      logger.debug('Voice guidance announced', { message });
    } catch (error) {
      logger.error('Failed to announce voice guidance', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle playback errors with fallback mechanisms
   */
  private async handlePlaybackError(error: unknown, operation: string): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Playback error occurred', {
      operation,
      error: errorMessage,
      fallbackAttempts: this.fallbackAttempts,
    });

    this.playbackState = 'error';

    // Announce error if voice guidance is enabled
    if (this.voiceGuidance.enabled && this.voiceGuidance.announceErrors) {
      await this.announceVoiceGuidance(`Error: ${errorMessage}`);
    }

    // Attempt fallback if available
    if (this.fallbackAttempts < this.maxFallbackAttempts) {
      await this.attemptFallback(operation);
    } else {
      logger.error('Max fallback attempts reached', {
        operation,
        attempts: this.fallbackAttempts,
      });
    }
  }

  /**
   * Attempt fallback mechanism
   */
  private async attemptFallback(operation: string): Promise<void> {
    this.fallbackAttempts++;

    logger.info('Attempting fallback', {
      operation,
      attempt: this.fallbackAttempts,
    });

    try {
      // Fallback strategy: try lower quality audio
      if (this.currentTrack && this.currentTrack.quality !== 'low') {
        const fallbackTrack: AudioTrack = {
          ...this.currentTrack,
          quality: 'low',
          url: this.currentTrack.url.replace(/\.(mp3|wav)$/, '-low.$1'),
        };

        logger.info('Trying lower quality audio', {
          originalQuality: this.currentTrack.quality,
          fallbackQuality: fallbackTrack.quality,
        });

        await this.loadTrack(fallbackTrack);

        // Announce fallback success
        if (this.voiceGuidance.enabled) {
          await this.announceVoiceGuidance('Switched to lower quality audio');
        }

        logger.info('Fallback successful');
      } else {
        // No more fallback options
        logger.warn('No fallback options available');
        
        if (this.voiceGuidance.enabled) {
          await this.announceVoiceGuidance('Audio playback unavailable. Please try again later.');
        }
      }
    } catch (error) {
      logger.error('Fallback failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Reset playback service
   */
  public reset(): void {
    this.currentTrack = null;
    this.playbackState = 'idle';
    this.currentTime = 0;
    this.volume = 1.0;
    this.playbackRate = 1.0;
    this.isLooping = false;
    this.isMuted = false;
    this.fallbackAttempts = 0;

    logger.info('Playback service reset');
  }

  /**
   * Check if audio is playing
   */
  public isPlaying(): boolean {
    return this.playbackState === 'playing';
  }

  /**
   * Check if audio is paused
   */
  public isPaused(): boolean {
    return this.playbackState === 'paused';
  }

  /**
   * Check if audio is stopped
   */
  public isStopped(): boolean {
    return this.playbackState === 'stopped' || this.playbackState === 'idle';
  }

  /**
   * Check if there's an error
   */
  public hasError(): boolean {
    return this.playbackState === 'error';
  }

  /**
   * Get voice guidance settings
   */
  public getVoiceGuidanceSettings(): VoiceGuidanceOptions {
    return { ...this.voiceGuidance };
  }

  /**
   * Get playback summary
   */
  public getPlaybackSummary(): {
    hasTrack: boolean;
    state: PlaybackState;
    progress: number;
    volume: number;
    playbackRate: number;
    isLooping: boolean;
    isMuted: boolean;
    voiceGuidanceEnabled: boolean;
  } {
    return {
      hasTrack: this.currentTrack !== null,
      state: this.playbackState,
      progress: this.currentTrack ? (this.currentTime / this.currentTrack.duration) * 100 : 0,
      volume: this.volume,
      playbackRate: this.playbackRate,
      isLooping: this.isLooping,
      isMuted: this.isMuted,
      voiceGuidanceEnabled: this.voiceGuidance.enabled,
    };
  }
}
