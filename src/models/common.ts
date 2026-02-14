// Common types and interfaces used across the platform

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface RelativeCoordinates {
  x: number;
  y: number;
  z?: number;
}

export enum Language {
  ENGLISH = 'en',
  HINDI = 'hi',
  TAMIL = 'ta',
  TELUGU = 'te',
  BENGALI = 'bn',
  MARATHI = 'mr',
  GUJARATI = 'gu',
  KANNADA = 'kn',
  MALAYALAM = 'ml',
  PUNJABI = 'pa',
}

export enum ContentType {
  AUDIO_GUIDE = 'audio_guide',
  VIDEO = 'video',
  INFOGRAPHIC = 'infographic',
  TEXT = 'text',
  IMAGE = 'image',
}

export enum ArtifactType {
  PILLAR = 'pillar',
  STATUE = 'statue',
  TEMPLE = 'temple',
  CARVING = 'carving',
  INSCRIPTION = 'inscription',
  ARCHITECTURE = 'architecture',
  PAINTING = 'painting',
  ARTIFACT = 'artifact',
}

export enum InteractionType {
  VIEW = 'view',
  PLAY = 'play',
  PAUSE = 'pause',
  COMPLETE = 'complete',
  SKIP = 'skip',
  SHARE = 'share',
}

export enum EventType {
  QR_SCAN = 'qr_scan',
  CONTENT_VIEW = 'content_view',
  CONTENT_GENERATION = 'content_generation',
  QUESTION_ASKED = 'question_asked',
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  ERROR = 'error',
}

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
}

export interface CacheConfiguration {
  ttl: number; // Time to live in seconds
  priority: number; // Cache priority (1-10, 10 being highest)
  tags: string[]; // Cache tags for invalidation
}

export interface UserPreferences {
  language: Language;
  audioSpeed: number; // 0.5 to 2.0
  volume: number; // 0.0 to 1.0
  highContrast: boolean;
  largeText: boolean;
  audioDescriptions: boolean;
}

export interface ContentSource {
  id: string;
  title: string;
  url?: string;
  confidence: number;
}

export interface VoiceProfile {
  id: string;
  name: string;
  language: Language;
  gender: 'male' | 'female' | 'neutral';
  engine: 'standard' | 'neural';
}

// Heritage Site Models
export interface HeritageSite {
  siteId: string;
  name: string;
  location: GeoCoordinates;
  description: string;
  historicalPeriod: string;
  culturalSignificance: string;
  artifacts: ArtifactReference[];
  supportedLanguages: Language[];
  metadata: SiteMetadata;
}

export interface ArtifactReference {
  artifactId: string;
  name: string;
  type: ArtifactType;
  location: RelativeCoordinates;
  qrCodeData: string;
  description: string;
}

export interface SiteMetadata {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: string;
  curator: string;
  tags: string[];
  status: 'active' | 'inactive' | 'maintenance';
}

// Content Models
export interface MultimediaContent {
  contentId: string;
  artifactId: string;
  contentType: ContentType;
  language: Language;
  data: ContentData;
  metadata: ContentMetadata;
  cacheSettings: CacheConfiguration;
}

export interface ContentData {
  text?: string;
  audioUrl?: string;
  videoUrl?: string;
  infographicData?: InfographicData;
  duration?: number;
  fileSize?: number;
}

export interface ContentMetadata {
  siteId: string;
  artifactId: string;
  contentType: ContentType;
  language: Language;
  version: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  tags: string[];
}

export interface InfographicData {
  title: string;
  sections: InfographicSection[];
  interactiveElements: InteractiveElement[];
  dimensions: {
    width: number;
    height: number;
  };
}

export interface InfographicSection {
  id: string;
  type: 'timeline' | 'map' | 'diagram' | 'chart' | 'text';
  title: string;
  content: any; // Flexible content structure
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface InteractiveElement {
  id: string;
  type: 'button' | 'hotspot' | 'slider' | 'toggle';
  position: {
    x: number;
    y: number;
  };
  action: string;
  data: any;
}

// User Session Models
export interface UserSession {
  sessionId: string;
  userId?: string;
  siteId: string;
  preferredLanguage: Language;
  visitStartTime: Timestamp;
  scannedArtifacts: string[];
  contentInteractions: ContentInteraction[];
  conversationHistory: QAInteraction[];
  preferences: UserPreferences;
}

export interface ContentInteraction {
  contentId: string;
  interactionType: InteractionType;
  timestamp: Timestamp;
  duration?: number;
  completionPercentage?: number;
}

export interface QAInteraction {
  id: string;
  question: string;
  answer: string;
  timestamp: Timestamp;
  language: Language;
  confidence: number;
  sources: ContentSource[];
}

// Analytics Models
export interface AnalyticsEvent {
  eventId: string;
  sessionId: string;
  eventType: EventType;
  timestamp: Timestamp;
  siteId: string;
  artifactId?: string;
  language: Language;
  metadata: EventMetadata;
}

export interface EventMetadata {
  userAgent?: string;
  deviceType?: string;
  networkType?: string;
  location?: GeoCoordinates;
  duration?: number;
  errorCode?: string;
  errorMessage?: string;
  customData?: Record<string, any>;
}

export interface UsageMetrics {
  siteId: string;
  date: string; // YYYY-MM-DD format
  totalVisitors: number;
  qrScansCount: number;
  contentGenerations: number;
  languageDistribution: LanguageStats[];
  popularArtifacts: ArtifactStats[];
  averageSessionDuration: number;
}

export interface LanguageStats {
  language: Language;
  count: number;
  percentage: number;
}

export interface ArtifactStats {
  artifactId: string;
  name: string;
  scanCount: number;
  averageEngagementTime: number;
}

// QR Processing Models
export interface ArtifactIdentifier {
  siteId: string;
  artifactId: string;
  location?: GeoCoordinates;
  timestamp: Timestamp;
}

export interface QRScanRequest {
  qrData: string;
  sessionId?: string;
  userPreferences?: UserPreferences;
  location?: GeoCoordinates;
}

export interface ArtifactMetadata {
  artifactId: string;
  siteId: string;
  name: string;
  type: ArtifactType;
  description: string;
  historicalContext: string;
  culturalSignificance: string;
  constructionPeriod?: string;
  materials?: string[];
  dimensions?: {
    height?: number;
    width?: number;
    depth?: number;
    weight?: number;
  };
  conservationStatus?: string;
  lastUpdated: Timestamp;
}

// Q&A System Models
export interface QAResponse {
  answer: string;
  confidence: number;
  sources: ContentSource[];
  suggestedFollowUps: string[];
  language: Language;
}

export interface ConversationHistory {
  sessionId: string;
  interactions: QAInteraction[];
  context: ConversationContext;
}

export interface ConversationContext {
  currentArtifact?: string;
  currentSite: string;
  topics: string[];
  lastInteractionTime: Timestamp;
}

// Content Generation Models
export interface ContentGenerationRequest {
  artifactId: string;
  siteId: string;
  language: Language;
  contentTypes: ContentType[];
  userPreferences: UserPreferences;
}

export interface AudioFile {
  url: string;
  format: string;
  duration: number;
  fileSize: number;
  quality: 'low' | 'medium' | 'high';
  language: Language;
  voiceProfile: VoiceProfile;
}

export interface VideoFile {
  url: string;
  format: string;
  duration: number;
  fileSize: number;
  resolution: string;
  quality: 'low' | 'medium' | 'high' | 'adaptive';
  subtitles?: SubtitleTrack[];
}

export interface SubtitleTrack {
  language: Language;
  url: string;
  format: string;
}

// Content Repository Models
export interface ContentSummary {
  contentId: string;
  artifactId: string;
  contentType: ContentType;
  language: Language;
  title: string;
  description: string;
  createdAt: Timestamp;
  fileSize: number;
  duration?: number;
}

export interface ContentUpdates {
  data?: Partial<ContentData>;
  metadata?: Partial<ContentMetadata>;
  cacheSettings?: Partial<CacheConfiguration>;
}

// Utility types
export type Timestamp = string; // ISO 8601 format
export type UUID = string;
export type URL = string;