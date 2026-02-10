import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { APIResponse } from '../models/common';

/**
 * Lambda function for processing QR code scans and artifact identification
 * Handles QR code validation, artifact lookup, and session management
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  
  try {
    console.log('QR Processing Lambda invoked', {
      requestId,
      httpMethod: event.httpMethod,
      path: event.path,
    });

    // CORS headers
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: '',
      };
    }

    // Route based on HTTP method and path
    const path = event.path;
    const method = event.httpMethod;

    let response: APIResponse;

    if (method === 'POST' && path === '/qr') {
      response = await processQRScan(event, requestId);
    } else {
      response = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
        },
        timestamp: new Date().toISOString(),
        requestId,
      };
    }

    return {
      statusCode: response.success ? 200 : 400,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error in QR Processing Lambda:', error);
    
    const errorResponse: APIResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(errorResponse),
    };
  }
};

/**
 * Process QR code scan request
 */
async function processQRScan(event: APIGatewayProxyEvent, requestId: string): Promise<APIResponse> {
  const { ServiceFactory } = await import('../services');
  const qrProcessingService = ServiceFactory.getQRProcessingService();
  const sessionManagementService = ServiceFactory.getSessionManagementService();

  try {
    // Parse request body
    if (!event.body) {
      return {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body is required',
        },
        timestamp: new Date().toISOString(),
        requestId,
      };
    }

    const request = JSON.parse(event.body);

    // Process QR code
    const result = await qrProcessingService.processQRScan(request);

    if (!result.success) {
      return {
        success: false,
        error: {
          code: 'QR_PROCESSING_FAILED',
          message: result.error || 'Failed to process QR code',
          details: result.validationErrors,
        },
        timestamp: new Date().toISOString(),
        requestId,
      };
    }

    // If session ID is provided, add scanned artifact to session
    if (request.sessionId && result.artifactIdentifier) {
      try {
        await sessionManagementService.addScannedArtifact(
          request.sessionId,
          result.artifactIdentifier.artifactId
        );
      } catch (error) {
        console.warn('Failed to add artifact to session', {
          sessionId: request.sessionId,
          artifactId: result.artifactIdentifier.artifactId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't fail the request if session update fails
      }
    }

    // Return successful response
    return {
      success: true,
      data: {
        artifactIdentifier: result.artifactIdentifier,
        artifact: result.artifactMetadata,
        site: result.siteMetadata,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };
  } catch (error) {
    console.error('Error processing QR scan:', error);
    
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal error processing QR code',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };
  }
}