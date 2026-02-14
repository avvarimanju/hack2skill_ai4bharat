// Export all models and types
export * from './common';
export * from './aws-types';

// Re-export commonly used validation functions from utils
export {
  validateHeritageSite,
  validateMultimediaContent,
  validateUserSession,
  validateArtifactMetadata,
  validateQAResponse,
  validateContentGenerationRequest,
  validateInput,
  validateAndParseJSON,
} from '../utils/validation';

// Re-export commonly used type guards
export {
  isAWSError,
  isDynamoDBError,
  isS3Error,
  isBedrockError,
  isPollyError,
} from './aws-types';