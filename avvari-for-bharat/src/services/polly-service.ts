// Polly Service for Text-to-Speech using Amazon Polly
import { PollyClient, SynthesizeSpeechCommand, Engine, OutputFormat, VoiceId, TextType } from '@aws-sdk/client-polly';
import { Language } from '../models/common';
import { logger } from '../utils/logger';

export interface TextToSpeechRequest {
  text: string;
  language: Language;
  voiceId?: VoiceId;
  engine?: Engine;
  outputFormat?: OutputFormat;
  sampleRate?: string;
  ssml?: boolean;
}

export interface TextToSpeechResult {
  success: boolean;
  audioStream?: Uint8Array;
  contentType?: string;
  voiceUsed?: VoiceId;
  error?: string;
}

export interface VoiceInfo {
  voiceId: VoiceId;
  engine: Engine;
  languageCode: string;
  gender: 'Female' | 'Male';
}

export class PollyService {
  private client: PollyClient;
  private readonly voiceMap: Record<Language, VoiceInfo>;
  private readonly defaultVoice: VoiceInfo;

  constructor(region?: string) {
    this.client = new PollyClient({ 
      region: region || process.env.AWS_REGION || 'us-east-1' 
    });

    // Map languages to available Polly voices
    // Note: Not all Indian languages have direct Polly support
    // We use English (Indian) as fallback for unsupported languages
    this.voiceMap = {
      [Language.ENGLISH]: {
        voiceId: 'Kajal' as VoiceId,
        engine: 'neural' as Engine,
        languageCode: 'en-IN',
        gender: 'Female',
      },
      [Language.HINDI]: {
        voiceId: 'Kajal' as VoiceId, // Bilingual Hindi/English voice
        engine: 'neural' as Engine,
        languageCode: 'hi-IN',
        gender: 'Female',
      },
      // Fallback to English (Indian) for languages without direct Polly support
      [Language.TAMIL]: {
        voiceId: 'Kajal' as VoiceId,
        engine: 'neural' as Engine,
        languageCode: 'en-IN',
        gender: 'Female',
      },
      [Language.TELUGU]: {
        voiceId: 'Kajal' as VoiceId,
        engine: 'neural' as Engine,
        languageCode: 'en-IN',
        gender: 'Female',
      },
      [Language.BENGALI]: {
        voiceId: 'Kajal' as VoiceId,
        engine: 'neural' as Engine,
        languageCode: 'en-IN',
        gender: 'Female',
      },
      [Language.MARATHI]: {
        voiceId: 'Kajal' as VoiceId,
        engine: 'neural' as Engine,
        languageCode: 'en-IN',
        gender: 'Female',
      },
      [Language.GUJARATI]: {
        voiceId: 'Kajal' as VoiceId,
        engine: 'neural' as Engine,
        languageCode: 'en-IN',
        gender: 'Female',
      },
      [Language.KANNADA]: {
        voiceId: 'Kajal' as VoiceId,
        engine: 'neural' as Engine,
        languageCode: 'en-IN',
        gender: 'Female',
      },
      [Language.MALAYALAM]: {
        voiceId: 'Kajal' as VoiceId,
        engine: 'neural' as Engine,
        languageCode: 'en-IN',
        gender: 'Female',
      },
      [Language.PUNJABI]: {
        voiceId: 'Kajal' as VoiceId,
        engine: 'neural' as Engine,
        languageCode: 'en-IN',
        gender: 'Female',
      },
    };

    this.defaultVoice = this.voiceMap[Language.ENGLISH];

    logger.info('Polly service initialized', { region: region || 'default' });
  }

  /**
   * Convert text to speech
   */
  public async synthesizeSpeech(request: TextToSpeechRequest): Promise<TextToSpeechResult> {
    logger.info('Synthesizing speech', {
      textLength: request.text.length,
      language: request.language,
      voiceId: request.voiceId,
    });

    try {
      // Validate input
      if (!request.text || request.text.trim().length === 0) {
        return {
          success: false,
          error: 'Text cannot be empty',
        };
      }

      // Get voice configuration
      const voiceInfo = this.voiceMap[request.language] || this.defaultVoice;
      const voiceId = request.voiceId || voiceInfo.voiceId;
      const engine = request.engine || voiceInfo.engine;
      const outputFormat = request.outputFormat || ('mp3' as OutputFormat);
      const textType = request.ssml ? ('ssml' as TextType) : ('text' as TextType);

      // Prepare synthesis command
      const command = new SynthesizeSpeechCommand({
        Text: request.text,
        VoiceId: voiceId,
        Engine: engine,
        OutputFormat: outputFormat,
        TextType: textType,
        SampleRate: request.sampleRate,
        LanguageCode: voiceInfo.languageCode as any, // Cast to any to avoid type issues
      });

      const response = await this.client.send(command);

      if (!response.AudioStream) {
        return {
          success: false,
          error: 'No audio stream returned from Polly',
        };
      }

      // Convert audio stream to Uint8Array
      const audioStream = await this.streamToUint8Array(response.AudioStream);

      logger.info('Speech synthesis completed', {
        voiceUsed: voiceId,
        audioSize: audioStream.length,
        contentType: response.ContentType,
      });

      return {
        success: true,
        audioStream,
        contentType: response.ContentType,
        voiceUsed: voiceId,
      };
    } catch (error) {
      logger.error('Speech synthesis failed', {
        error: error instanceof Error ? error.message : String(error),
        language: request.language,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Speech synthesis failed',
      };
    }
  }

  /**
   * Generate audio with SSML markup for enhanced control
   */
  public async synthesizeWithSSML(
    ssmlText: string,
    language: Language,
    voiceId?: VoiceId
  ): Promise<TextToSpeechResult> {
    return this.synthesizeSpeech({
      text: ssmlText,
      language,
      voiceId,
      ssml: true,
    });
  }

  /**
   * Generate audio in multiple formats
   */
  public async synthesizeMultipleFormats(
    text: string,
    language: Language,
    formats: OutputFormat[]
  ): Promise<Record<OutputFormat, TextToSpeechResult>> {
    logger.info('Synthesizing speech in multiple formats', {
      textLength: text.length,
      language,
      formats,
    });

    const results: Record<string, TextToSpeechResult> = {};

    for (const format of formats) {
      const result = await this.synthesizeSpeech({
        text,
        language,
        outputFormat: format,
      });
      results[format] = result;
    }

    return results as Record<OutputFormat, TextToSpeechResult>;
  }

  /**
   * Get available voice for a language
   */
  public getVoiceForLanguage(language: Language): VoiceInfo {
    return this.voiceMap[language] || this.defaultVoice;
  }

  /**
   * Check if language has native Polly support
   */
  public hasNativeSupport(language: Language): boolean {
    const voiceInfo = this.voiceMap[language];
    // Only English and Hindi have native support
    return language === Language.ENGLISH || language === Language.HINDI;
  }

  /**
   * Get all supported languages
   */
  public getSupportedLanguages(): Language[] {
    return Object.keys(this.voiceMap) as Language[];
  }

  /**
   * Create SSML markup for enhanced speech control
   */
  public createSSML(text: string, options?: {
    rate?: 'x-slow' | 'slow' | 'medium' | 'fast' | 'x-fast';
    pitch?: 'x-low' | 'low' | 'medium' | 'high' | 'x-high';
    volume?: 'silent' | 'x-soft' | 'soft' | 'medium' | 'loud' | 'x-loud';
    emphasis?: 'strong' | 'moderate' | 'reduced';
  }): string {
    let ssml = '<speak>';

    if (options?.rate || options?.pitch || options?.volume) {
      ssml += '<prosody';
      if (options.rate) ssml += ` rate="${options.rate}"`;
      if (options.pitch) ssml += ` pitch="${options.pitch}"`;
      if (options.volume) ssml += ` volume="${options.volume}"`;
      ssml += '>';
    }

    if (options?.emphasis) {
      ssml += `<emphasis level="${options.emphasis}">`;
    }

    ssml += text;

    if (options?.emphasis) {
      ssml += '</emphasis>';
    }

    if (options?.rate || options?.pitch || options?.volume) {
      ssml += '</prosody>';
    }

    ssml += '</speak>';

    return ssml;
  }

  /**
   * Add pause to SSML
   */
  public addPause(text: string, pauseDuration: string): string {
    return `${text}<break time="${pauseDuration}"/>`;
  }

  /**
   * Validate SSML markup
   */
  public isValidSSML(ssml: string): boolean {
    // Basic SSML validation
    return ssml.startsWith('<speak>') && ssml.endsWith('</speak>');
  }

  /**
   * Convert stream to Uint8Array
   */
  private async streamToUint8Array(stream: any): Promise<Uint8Array> {
    const chunks: Uint8Array[] = [];
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // Calculate total length
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    
    // Combine all chunks
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Get optimal sample rate for format
   */
  public getOptimalSampleRate(format: OutputFormat): string {
    const sampleRates: Record<string, string> = {
      mp3: '22050',
      ogg_vorbis: '22050',
      pcm: '16000',
    };

    return sampleRates[format] || '22050';
  }

  /**
   * Estimate audio duration (approximate)
   */
  public estimateAudioDuration(text: string, wordsPerMinute: number = 150): number {
    const words = text.split(/\s+/).length;
    const minutes = words / wordsPerMinute;
    return Math.ceil(minutes * 60); // Return duration in seconds
  }
}
