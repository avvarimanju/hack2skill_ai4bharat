// Input validation utilities using Zod schemas
import { z } from 'zod';
import { 
  Language, 
  ContentType, 
  ArtifactType, 
  InteractionType, 
  EventType 
} from '../models/common';

// Common validation schemas
export const uuidSchema = z.string().uuid();
export const timestampSchema = z.string().datetime();
export const urlSchema = z.string().url();

// Coordinate schemas
export const geoCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
});

export const relativeCoordinatesSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number().optional(),
});

// Enum schemas
export const languageSchema = z.nativeEnum(Language);
export const contentTypeSchema = z.nativeEnum(ContentType);
export const artifactTypeSchema = z.nativeEnum(ArtifactType);

// User preferences schema
export const userPreferencesSchema = z.object({
  language: languageSchema,
  audioSpeed: z.number().min(0.5).max(2.0).default(1.0),
  volume: z.number().min(0.0).max(1.0).default(0.8),
  highContrast: z.boolean().default(false),
  largeText: z.boolean().default(false),
  audioDescriptions: z.boolean().default(false),
});

// QR code processing schemas
export const qrScanRequestSchema = z.object({
  qrData: z.string().min(1),
  sessionId: z.string().optional(),
  userPreferences: userPreferencesSchema.optional(),
  location: geoCoordinatesSchema.optional(),
});

export const artifactIdentifierSchema = z.object({
  siteId: z.string().min(1),
  artifactId: z.string().min(1),
  location: geoCoordinatesSchema.optional(),
  timestamp: timestampSchema,
});

// Content generation schemas
export const contentGenerationRequestSchema = z.object({
  artifactId: z.string().min(1),
  siteId: z.string().min(1),
  language: languageSchema,
  contentTypes: z.array(contentTypeSchema).min(1),
  userPreferences: userPreferencesSchema.optional(),
  sessionId: z.string().optional(),
});

// Q&A processing schemas
export const qaRequestSchema = z.object({
  question: z.string().min(1).max(1000),
  sessionId: z.string().min(1),
  artifactId: z.string().optional(),
  siteId: z.string().optional(),
  language: languageSchema.default(Language.ENGLISH),
});

// Analytics schemas
export const analyticsEventSchema = z.object({
  eventType: z.nativeEnum(EventType),
  sessionId: z.string().min(1),
  siteId: z.string().optional(),
  artifactId: z.string().optional(),
  language: languageSchema.optional(),
  metadata: z.record(z.any()).optional(),
});

// Heritage Site Schemas
export const siteMetadataSchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  version: z.string(),
  curator: z.string(),
  tags: z.array(z.string()),
  status: z.enum(['active', 'inactive', 'maintenance']),
});

export const artifactReferenceSchema = z.object({
  artifactId: z.string().min(1),
  name: z.string().min(1),
  type: z.nativeEnum(ArtifactType),
  location: relativeCoordinatesSchema,
  qrCodeData: z.string().min(1),
  description: z.string(),
});

export const heritageSiteSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1),
  location: geoCoordinatesSchema,
  description: z.string(),
  historicalPeriod: z.string(),
  culturalSignificance: z.string(),
  artifacts: z.array(artifactReferenceSchema),
  supportedLanguages: z.array(languageSchema).min(1),
  metadata: siteMetadataSchema,
});

// Content Schemas
export const infographicSectionSchema = z.object({
  id: z.string(),
  type: z.enum(['timeline', 'map', 'diagram', 'chart', 'text']),
  title: z.string(),
  content: z.any(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
});

export const interactiveElementSchema = z.object({
  id: z.string(),
  type: z.enum(['button', 'hotspot', 'slider', 'toggle']),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  action: z.string(),
  data: z.any(),
});

export const infographicDataSchema = z.object({
  title: z.string(),
  sections: z.array(infographicSectionSchema),
  interactiveElements: z.array(interactiveElementSchema),
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
});

export const contentDataSchema = z.object({
  text: z.string().optional(),
  audioUrl: urlSchema.optional(),
  videoUrl: urlSchema.optional(),
  infographicData: infographicDataSchema.optional(),
  duration: z.number().positive().optional(),
  fileSize: z.number().positive().optional(),
});

export const cacheConfigurationSchema = z.object({
  ttl: z.number().positive(),
  priority: z.number().min(1).max(10),
  tags: z.array(z.string()),
});

export const contentMetadataSchema = z.object({
  siteId: z.string().min(1),
  artifactId: z.string().min(1),
  contentType: contentTypeSchema,
  language: languageSchema,
  version: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  tags: z.array(z.string()),
});

export const multimediaContentSchema = z.object({
  contentId: z.string().min(1),
  artifactId: z.string().min(1),
  contentType: contentTypeSchema,
  language: languageSchema,
  data: contentDataSchema,
  metadata: contentMetadataSchema,
  cacheSettings: cacheConfigurationSchema,
});

// User Session Schemas
export const contentInteractionSchema = z.object({
  contentId: z.string().min(1),
  interactionType: z.nativeEnum(InteractionType),
  timestamp: timestampSchema,
  duration: z.number().positive().optional(),
  completionPercentage: z.number().min(0).max(100).optional(),
});

export const contentSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: urlSchema.optional(),
  confidence: z.number().min(0).max(1),
});

export const qaInteractionSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  answer: z.string(),
  timestamp: timestampSchema,
  language: languageSchema,
  confidence: z.number().min(0).max(1),
  sources: z.array(contentSourceSchema),
});

export const userSessionSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  siteId: z.string().min(1),
  preferredLanguage: languageSchema,
  visitStartTime: timestampSchema,
  scannedArtifacts: z.array(z.string()),
  contentInteractions: z.array(contentInteractionSchema),
  conversationHistory: z.array(qaInteractionSchema),
  preferences: userPreferencesSchema,
});

// Artifact Metadata Schema
export const artifactMetadataSchema = z.object({
  artifactId: z.string().min(1),
  siteId: z.string().min(1),
  name: z.string().min(1),
  type: z.nativeEnum(ArtifactType),
  description: z.string(),
  historicalContext: z.string(),
  culturalSignificance: z.string(),
  constructionPeriod: z.string().optional(),
  materials: z.array(z.string()).optional(),
  dimensions: z.object({
    height: z.number().positive().optional(),
    width: z.number().positive().optional(),
    depth: z.number().positive().optional(),
    weight: z.number().positive().optional(),
  }).optional(),
  conservationStatus: z.string().optional(),
  lastUpdated: timestampSchema,
});

// Q&A Response Schema
export const qaResponseSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(contentSourceSchema),
  suggestedFollowUps: z.array(z.string()),
  language: languageSchema,
});

// Validation helper functions
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}

export function validateAndParseJSON<T>(schema: z.ZodSchema<T>, jsonString: string): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const parsed = JSON.parse(jsonString);
    return validateInput(schema, parsed);
  } catch (error: unknown) {
    return { success: false, errors: ['Invalid JSON format'] };
  }
}

// Specific validation functions for main models
export const validateHeritageSite = (data: unknown) => validateInput(heritageSiteSchema, data);
export const validateMultimediaContent = (data: unknown) => validateInput(multimediaContentSchema, data);
export const validateUserSession = (data: unknown) => validateInput(userSessionSchema, data);
export const validateArtifactMetadata = (data: unknown) => validateInput(artifactMetadataSchema, data);
export const validateQAResponse = (data: unknown) => validateInput(qaResponseSchema, data);
export const validateContentGenerationRequest = (data: unknown) => validateInput(contentGenerationRequestSchema, data);
export const validateQrScanRequest = (data: unknown) => validateInput(qrScanRequestSchema, data);
export const validateArtifactIdentifier = (data: unknown) => validateInput(artifactIdentifierSchema, data);

// Type inference helpers
export type HeritageSiteInput = z.infer<typeof heritageSiteSchema>;
export type MultimediaContentInput = z.infer<typeof multimediaContentSchema>;
export type UserSessionInput = z.infer<typeof userSessionSchema>;
export type ArtifactMetadataInput = z.infer<typeof artifactMetadataSchema>;
export type QAResponseInput = z.infer<typeof qaResponseSchema>;
export type ContentGenerationRequestInput = z.infer<typeof contentGenerationRequestSchema>;