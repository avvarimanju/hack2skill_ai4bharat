// Test setup and configuration
import { jest } from '@jest/globals';

// Mock AWS SDK clients for testing
jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-polly');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-translate');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.HERITAGE_SITES_TABLE = 'test-heritage-sites';
process.env.ARTIFACTS_TABLE = 'test-artifacts';
process.env.USER_SESSIONS_TABLE = 'test-user-sessions';
process.env.CONTENT_CACHE_TABLE = 'test-content-cache';
process.env.ANALYTICS_TABLE = 'test-analytics';
process.env.CONTENT_BUCKET = 'test-content-bucket';
process.env.CLOUDFRONT_DOMAIN = 'test.cloudfront.net';

// Global test timeout
jest.setTimeout(30000);