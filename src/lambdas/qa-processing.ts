// Q&A Processing Lambda Handler
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ServiceFactory } from '../services';
import { Language } from '../models/common';

interface QARequestBody {
  question: string;
  sessionId?: string;
  artifactId?: string;
  siteId?: string;
  language: Language;
  maxContextMessages?: number;
}

/**
 * Lambda handler for Q&A processing using RAG
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Q&A Processing Lambda invoked', {
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
          requestId: context.awsRequestId,
        }),
      };
    }

    const requestBody: QARequestBody = JSON.parse(event.body);

    // Validate required fields
    if (!requestBody.question || !requestBody.language) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: question, language',
          requestId: context.awsRequestId,
        }),
      };
    }

    // Process question
    const result = await processQuestion(requestBody);

    // If session ID provided, save Q&A interaction
    if (result.success && requestBody.sessionId) {
      await saveQAInteraction(requestBody.sessionId, requestBody.question, result);
    }

    return {
      statusCode: result.success ? 200 : 500,
      headers,
      body: JSON.stringify({
        ...result,
        requestId: context.requestId,
      }),
    };
  } catch (error) {
    console.error('Error in Q&A processing handler:', error);

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
 * Process question using RAG service
 */
async function processQuestion(request: QARequestBody) {
  const ragService = ServiceFactory.getRAGService();
  const sessionService = ServiceFactory.getSessionManagementService();

  // Get conversation context if session ID provided
  let conversationContext;
  if (request.sessionId) {
    try {
      conversationContext = await sessionService.getConversationContext(
        request.sessionId,
        request.maxContextMessages || 5
      );
    } catch (error) {
      console.warn('Failed to retrieve conversation context', {
        sessionId: request.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Process question with RAG
  const result = await ragService.processQuestion({
    question: request.question,
    sessionId: request.sessionId,
    artifactId: request.artifactId,
    siteId: request.siteId,
    language: request.language,
    conversationContext,
    maxContextMessages: request.maxContextMessages,
  });

  return result;
}

/**
 * Save Q&A interaction to session
 */
async function saveQAInteraction(
  sessionId: string,
  question: string,
  result: any
) {
  if (!result.success || !result.answer) {
    return;
  }

  const sessionService = ServiceFactory.getSessionManagementService();

  try {
    await sessionService.addQAInteraction(sessionId, {
      id: result.conversationId || require('uuid').v4(),
      question,
      answer: result.answer,
      language: result.language || 'en',
      confidence: result.confidence || 0.8,
      sources: result.sources || [],
    });
  } catch (error) {
    console.error('Failed to save Q&A interaction', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
