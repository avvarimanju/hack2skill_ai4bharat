// Unit tests for QR processing Lambda function
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../../src/lambdas/qr-processing';

// Mock context
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '512',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2023/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

describe('QR Processing Lambda', () => {
  it('should handle OPTIONS request for CORS', async () => {
    const event: APIGatewayProxyEvent = {
      httpMethod: 'OPTIONS',
      path: '/qr',
      headers: {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: null,
      isBase64Encoded: false,
    };

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    expect(result.body).toBe('');
  });

  it('should return 404 for unknown endpoints', async () => {
    const event: APIGatewayProxyEvent = {
      httpMethod: 'GET',
      path: '/unknown',
      headers: {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: null,
      isBase64Encoded: false,
    };

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('should handle QR processing endpoint', async () => {
    const event: APIGatewayProxyEvent = {
      httpMethod: 'POST',
      path: '/qr',
      headers: { 'Content-Type': 'application/json' },
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: JSON.stringify({ qrData: 'test-qr-data' }),
      isBase64Encoded: false,
    };

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.requestId).toBe('test-request-id');
  });
});