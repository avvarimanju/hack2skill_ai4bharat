// AWS service clients configuration and initialization
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PollyClient } from '@aws-sdk/client-polly';
import { S3Client } from '@aws-sdk/client-s3';
import { TranslateClient } from '@aws-sdk/client-translate';

// AWS Region configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Common client configuration
const clientConfig = {
  region: AWS_REGION,
  maxAttempts: 3,
};

// Initialize AWS service clients
export const bedrockClient = new BedrockRuntimeClient(clientConfig);

export const dynamoDBClient = new DynamoDBClient(clientConfig);

export const docClient = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export const pollyClient = new PollyClient(clientConfig);

export const s3Client = new S3Client(clientConfig);

export const translateClient = new TranslateClient(clientConfig);

// Environment variables for table names and bucket names
export const TABLES = {
  HERITAGE_SITES: process.env.HERITAGE_SITES_TABLE || 'AvvarI-HeritageSites',
  ARTIFACTS: process.env.ARTIFACTS_TABLE || 'AvvarI-Artifacts',
  USER_SESSIONS: process.env.USER_SESSIONS_TABLE || 'AvvarI-UserSessions',
  CONTENT_CACHE: process.env.CONTENT_CACHE_TABLE || 'AvvarI-ContentCache',
  ANALYTICS: process.env.ANALYTICS_TABLE || 'AvvarI-Analytics',
};

export const BUCKETS = {
  CONTENT: process.env.CONTENT_BUCKET || 'avvari-content-bucket',
};

export const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';

// Bedrock model configurations
export const BEDROCK_MODELS = {
  TEXT_GENERATION: 'anthropic.claude-3-sonnet-20240229-v1:0',
  EMBEDDING: 'amazon.titan-embed-text-v1',
};

// Polly voice configurations for Indian languages
export const POLLY_VOICES = {
  en: { VoiceId: 'Joanna', Engine: 'neural' },
  hi: { VoiceId: 'Aditi', Engine: 'standard' },
  ta: { VoiceId: 'Aditi', Engine: 'standard' }, // Fallback to Hindi voice
  te: { VoiceId: 'Aditi', Engine: 'standard' }, // Fallback to Hindi voice
  bn: { VoiceId: 'Aditi', Engine: 'standard' }, // Fallback to Hindi voice
  mr: { VoiceId: 'Aditi', Engine: 'standard' }, // Fallback to Hindi voice
  gu: { VoiceId: 'Aditi', Engine: 'standard' }, // Fallback to Hindi voice
  kn: { VoiceId: 'Aditi', Engine: 'standard' }, // Fallback to Hindi voice
  ml: { VoiceId: 'Aditi', Engine: 'standard' }, // Fallback to Hindi voice
  pa: { VoiceId: 'Aditi', Engine: 'standard' }, // Fallback to Hindi voice
} as const;