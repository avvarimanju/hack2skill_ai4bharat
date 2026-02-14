// Content Generation Lambda Handler
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ServiceFactory } from '../services';
import { Language } from '../models/common';

interface ContentGenerationRequestBody {
  artifactId: string;
  siteId: string;
  contentType: 'audio_guide' | 'detailed_description' | 'historical_narrative' | 'cultural_context';
  language: Language;
  targetAudience?: 'general' | 'children' | 'scholars';
  duration?: number;
}

/**
 * Lambda handler for content generation using Amazon Bedrock
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Content Generation Lambda invoked', {
    requestId: context.awsRequestId,
    httpMethod: event.httpMethod,
    path: event.path,
  });

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' }),
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed. Use POST.',
        requestId: context.requestId,
      }),
    };
  }

  try {
    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Request body is required',
          requestId: context.requestId,
        }),
      };
    }

    const requestBody: ContentGenerationRequestBody = JSON.parse(event.body);

    // Validate required fields
    if (!requestBody.artifactId || !requestBody.siteId || !requestBody.contentType || !requestBody.language) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: artifactId, siteId, contentType, language',
          requestId: context.requestId,
        }),
      };
    }

    // Route to appropriate handler
    const result = await generateContent(requestBody);

    return {
      statusCode: result.success ? 200 : 500,
      headers,
      body: JSON.stringify({
        ...result,
        requestId: context.requestId,
      }),
    };
  } catch (error) {
    console.error('Error in content generation handler:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        requestId: context.requestId,
      }),
    };
  }
};

/**
 * Generate content using Bedrock
 */
async function generateContent(request: ContentGenerationRequestBody) {
  const bedrockService = ServiceFactory.getBedrockService();
  const artifactsRepository = require('../repositories').RepositoryFactory.getArtifactsRepository();

  // Fetch artifact metadata
  const artifact = await artifactsRepository.getByArtifactId(request.artifactId, request.siteId);

  if (!artifact) {
    return {
      success: false,
      error: `Artifact not found: ${request.artifactId}`,
    };
  }

  // Generate content using Bedrock
  const result = await bedrockService.generateContent({
    artifactName: artifact.name,
    artifactType: artifact.type,
    description: artifact.description,
    historicalContext: artifact.historicalContext,
    culturalSignificance: artifact.culturalSignificance,
    language: request.language,
    contentType: request.contentType,
    targetAudience: request.targetAudience,
    duration: request.duration,
  });

  return result;
}
