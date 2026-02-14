// AWS Service Response Types

// DynamoDB Types
export interface DynamoDBItem {
  [key: string]: any;
}

export interface DynamoDBQueryResponse {
  Items?: DynamoDBItem[];
  Count?: number;
  ScannedCount?: number;
  LastEvaluatedKey?: DynamoDBItem;
  ConsumedCapacity?: {
    TableName?: string;
    CapacityUnits?: number;
  };
}

export interface DynamoDBPutResponse {
  Attributes?: DynamoDBItem;
  ConsumedCapacity?: {
    TableName?: string;
    CapacityUnits?: number;
  };
}

export interface DynamoDBUpdateResponse {
  Attributes?: DynamoDBItem;
  ConsumedCapacity?: {
    TableName?: string;
    CapacityUnits?: number;
  };
}

export interface DynamoDBDeleteResponse {
  Attributes?: DynamoDBItem;
  ConsumedCapacity?: {
    TableName?: string;
    CapacityUnits?: number;
  };
}

// S3 Types
export interface S3Object {
  Key?: string;
  LastModified?: Date;
  ETag?: string;
  Size?: number;
  StorageClass?: string;
  Owner?: {
    DisplayName?: string;
    ID?: string;
  };
}

export interface S3ListObjectsResponse {
  IsTruncated?: boolean;
  Contents?: S3Object[];
  Name?: string;
  Prefix?: string;
  Delimiter?: string;
  MaxKeys?: number;
  CommonPrefixes?: Array<{
    Prefix?: string;
  }>;
  EncodingType?: string;
}

export interface S3PutObjectResponse {
  ETag?: string;
  ServerSideEncryption?: string;
  VersionId?: string;
  SSECustomerAlgorithm?: string;
  SSECustomerKeyMD5?: string;
  SSEKMSKeyId?: string;
  SSEKMSEncryptionContext?: string;
  RequestCharged?: string;
}

export interface S3GetObjectResponse {
  Body?: any;
  DeleteMarker?: boolean;
  AcceptRanges?: string;
  Expiration?: string;
  Restore?: string;
  LastModified?: Date;
  ContentLength?: number;
  ETag?: string;
  ContentEncoding?: string;
  ContentDisposition?: string;
  ContentLanguage?: string;
  ContentRange?: string;
  ContentType?: string;
  CacheControl?: string;
  Metadata?: { [key: string]: string };
  StorageClass?: string;
  ServerSideEncryption?: string;
  SSECustomerAlgorithm?: string;
  SSECustomerKeyMD5?: string;
  SSEKMSKeyId?: string;
  VersionId?: string;
  ReplicationStatus?: string;
  PartsCount?: number;
  TagCount?: number;
  ObjectLockMode?: string;
  ObjectLockRetainUntilDate?: Date;
  ObjectLockLegalHoldStatus?: string;
}

// Amazon Bedrock Types
export interface BedrockInvokeModelRequest {
  modelId: string;
  contentType: string;
  accept: string;
  body: string;
}

export interface BedrockInvokeModelResponse {
  contentType: string;
  body: Uint8Array;
}

export interface BedrockModelResponse {
  completion?: string;
  stop_reason?: string;
  stop?: string;
  generation?: string;
  outputs?: Array<{
    text: string;
    index: number;
    finish_reason: string;
  }>;
}

export interface BedrockClaude3Request {
  anthropic_version: string;
  max_tokens: number;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  system?: string;
}

export interface BedrockClaude3Response {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface BedrockTitanRequest {
  inputText: string;
  textGenerationConfig: {
    maxTokenCount: number;
    stopSequences?: string[];
    temperature?: number;
    topP?: number;
  };
}

export interface BedrockTitanResponse {
  inputTextTokenCount: number;
  results: Array<{
    tokenCount: number;
    outputText: string;
    completionReason: string;
  }>;
}

// Amazon Polly Types
export interface PollyVoice {
  Gender?: 'Female' | 'Male';
  Id?: string;
  LanguageCode?: string;
  LanguageName?: string;
  Name?: string;
  AdditionalLanguageCodes?: string[];
  SupportedEngines?: Array<'standard' | 'neural'>;
}

export interface PollySynthesizeSpeechRequest {
  Engine?: 'standard' | 'neural';
  LanguageCode?: string;
  LexiconNames?: string[];
  OutputFormat: 'json' | 'mp3' | 'ogg_vorbis' | 'pcm';
  SampleRate?: string;
  SpeechMarkTypes?: Array<'sentence' | 'ssml' | 'viseme' | 'word'>;
  Text: string;
  TextType?: 'ssml' | 'text';
  VoiceId: string;
}

export interface PollySynthesizeSpeechResponse {
  AudioStream?: Uint8Array;
  ContentType?: string;
  RequestCharacters?: number;
}

export interface PollyDescribeVoicesResponse {
  Voices?: PollyVoice[];
  NextToken?: string;
}

// Amazon Translate Types
export interface TranslateTextRequest {
  Text: string;
  SourceLanguageCode: string;
  TargetLanguageCode: string;
  TerminologyNames?: string[];
  Settings?: {
    Formality?: 'FORMAL' | 'INFORMAL';
    Profanity?: 'MASK';
  };
}

export interface TranslateTextResponse {
  TranslatedText: string;
  SourceLanguageCode: string;
  TargetLanguageCode: string;
  AppliedTerminologies?: Array<{
    Name?: string;
    Terms?: Array<{
      SourceText?: string;
      TargetText?: string;
    }>;
  }>;
  AppliedSettings?: {
    Formality?: 'FORMAL' | 'INFORMAL';
    Profanity?: 'MASK';
  };
}

export interface TranslateDetectLanguageRequest {
  Text: string;
}

export interface TranslateDetectLanguageResponse {
  LanguageCode: string;
  Score: number;
}

// Amazon Rekognition Types
export interface RekognitionDetectTextRequest {
  Image: {
    Bytes?: Uint8Array;
    S3Object?: {
      Bucket: string;
      Name: string;
      Version?: string;
    };
  };
  Filters?: {
    WordFilter?: {
      MinConfidence?: number;
      MinBoundingBoxHeight?: number;
      MinBoundingBoxWidth?: number;
    };
    RegionsOfInterest?: Array<{
      BoundingBox?: {
        Width?: number;
        Height?: number;
        Left?: number;
        Top?: number;
      };
      Polygon?: Array<{
        X?: number;
        Y?: number;
      }>;
    }>;
  };
}

export interface RekognitionTextDetection {
  DetectedText?: string;
  Type?: 'LINE' | 'WORD';
  Id?: number;
  ParentId?: number;
  Confidence?: number;
  Geometry?: {
    BoundingBox?: {
      Width?: number;
      Height?: number;
      Left?: number;
      Top?: number;
    };
    Polygon?: Array<{
      X?: number;
      Y?: number;
    }>;
  };
}

export interface RekognitionDetectTextResponse {
  TextDetections?: RekognitionTextDetection[];
  TextModelVersion?: string;
}

// CloudWatch Types
export interface CloudWatchMetricDatum {
  MetricName: string;
  Dimensions?: Array<{
    Name: string;
    Value: string;
  }>;
  Unit?: string;
  Value?: number;
  Values?: number[];
  Counts?: number[];
  Timestamp?: Date;
  StatisticValues?: {
    SampleCount: number;
    Sum: number;
    Minimum: number;
    Maximum: number;
  };
}

export interface CloudWatchPutMetricDataRequest {
  Namespace: string;
  MetricData: CloudWatchMetricDatum[];
}

export interface CloudWatchPutMetricDataResponse {
  // Empty response on success
}

// Lambda Types
export interface LambdaContext {
  callbackWaitsForEmptyEventLoop: boolean;
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  identity?: {
    cognitoIdentityId?: string;
    cognitoIdentityPoolId?: string;
  };
  clientContext?: {
    client: {
      installationId: string;
      appTitle: string;
      appVersionName: string;
      appVersionCode: string;
      appPackageName: string;
    };
    Custom?: any;
    env: {
      platformVersion: string;
      platform: string;
      make: string;
      model: string;
      locale: string;
    };
  };
  getRemainingTimeInMillis(): number;
}

export interface APIGatewayProxyEvent {
  resource: string;
  path: string;
  httpMethod: string;
  headers: { [name: string]: string } | null;
  multiValueHeaders: { [name: string]: string[] } | null;
  queryStringParameters: { [name: string]: string } | null;
  multiValueQueryStringParameters: { [name: string]: string[] } | null;
  pathParameters: { [name: string]: string } | null;
  stageVariables: { [name: string]: string } | null;
  requestContext: {
    resourceId: string;
    resourcePath: string;
    httpMethod: string;
    extendedRequestId: string;
    requestTime: string;
    path: string;
    accountId: string;
    protocol: string;
    stage: string;
    domainPrefix: string;
    requestTimeEpoch: number;
    requestId: string;
    identity: {
      cognitoIdentityPoolId: string | null;
      accountId: string | null;
      cognitoIdentityId: string | null;
      caller: string | null;
      sourceIp: string;
      principalOrgId: string | null;
      accessKey: string | null;
      cognitoAuthenticationType: string | null;
      cognitoAuthenticationProvider: string | null;
      userArn: string | null;
      userAgent: string | null;
      user: string | null;
    };
    domainName: string;
    apiId: string;
  };
  body: string | null;
  isBase64Encoded: boolean;
}

export interface APIGatewayProxyResult {
  statusCode: number;
  headers?: { [header: string]: boolean | number | string };
  multiValueHeaders?: { [header: string]: Array<boolean | number | string> };
  body: string;
  isBase64Encoded?: boolean;
}

// Error Types
export interface AWSError {
  code: string;
  message: string;
  retryable?: boolean;
  statusCode?: number;
  time: Date;
  hostname?: string;
  region?: string;
  retryDelay?: number;
  requestId?: string;
  extendedRequestId?: string;
  cfId?: string;
}

// Common AWS Response Metadata
export interface AWSResponseMetadata {
  RequestId?: string;
  HTTPStatusCode?: number;
  HTTPHeaders?: { [key: string]: string };
  RetryAttempts?: number;
}

// Service-specific error types
export interface DynamoDBError extends AWSError {
  code: 
    | 'ConditionalCheckFailedException'
    | 'ItemCollectionSizeLimitExceededException'
    | 'LimitExceededException'
    | 'ProvisionedThroughputExceededException'
    | 'RequestLimitExceeded'
    | 'ResourceInUseException'
    | 'ResourceNotFoundException'
    | 'ThrottlingException'
    | 'UnrecognizedClientException'
    | 'ValidationException';
}

export interface S3Error extends AWSError {
  code:
    | 'AccessDenied'
    | 'BucketAlreadyExists'
    | 'BucketAlreadyOwnedByYou'
    | 'InvalidBucketName'
    | 'NoSuchBucket'
    | 'NoSuchKey'
    | 'NotFound'
    | 'PreconditionFailed'
    | 'SlowDown'
    | 'TooManyBuckets';
}

export interface BedrockError extends AWSError {
  code:
    | 'AccessDeniedException'
    | 'InternalServerException'
    | 'ModelNotReadyException'
    | 'ModelTimeoutException'
    | 'ResourceNotFoundException'
    | 'ServiceQuotaExceededException'
    | 'ThrottlingException'
    | 'ValidationException';
}

export interface PollyError extends AWSError {
  code:
    | 'EngineNotSupportedException'
    | 'InvalidLexiconException'
    | 'InvalidS3BucketException'
    | 'InvalidS3KeyException'
    | 'InvalidSampleRateException'
    | 'InvalidSsmlException'
    | 'LanguageNotSupportedException'
    | 'LexiconNotFoundException'
    | 'LexiconSizeExceededException'
    | 'MarksNotSupportedForFormatException'
    | 'MaxLexemeLengthExceededException'
    | 'MaxLexiconsNumberExceededException'
    | 'ServiceFailureException'
    | 'SsmlMarksNotSupportedForTextTypeException'
    | 'TextLengthExceededException'
    | 'UnsupportedPlsAlphabetException'
    | 'UnsupportedPlsLanguageException';
}

// Type guards for AWS responses
export const isAWSError = (error: any): error is AWSError => {
  return error && typeof error.code === 'string' && typeof error.message === 'string';
};

export const isDynamoDBError = (error: any): error is DynamoDBError => {
  return isAWSError(error) && [
    'ConditionalCheckFailedException',
    'ItemCollectionSizeLimitExceededException',
    'LimitExceededException',
    'ProvisionedThroughputExceededException',
    'RequestLimitExceeded',
    'ResourceInUseException',
    'ResourceNotFoundException',
    'ThrottlingException',
    'UnrecognizedClientException',
    'ValidationException'
  ].includes(error.code);
};

export const isS3Error = (error: any): error is S3Error => {
  return isAWSError(error) && [
    'AccessDenied',
    'BucketAlreadyExists',
    'BucketAlreadyOwnedByYou',
    'InvalidBucketName',
    'NoSuchBucket',
    'NoSuchKey',
    'NotFound',
    'PreconditionFailed',
    'SlowDown',
    'TooManyBuckets'
  ].includes(error.code);
};

export const isBedrockError = (error: any): error is BedrockError => {
  return isAWSError(error) && [
    'AccessDeniedException',
    'InternalServerException',
    'ModelNotReadyException',
    'ModelTimeoutException',
    'ResourceNotFoundException',
    'ServiceQuotaExceededException',
    'ThrottlingException',
    'ValidationException'
  ].includes(error.code);
};

export const isPollyError = (error: any): error is PollyError => {
  return isAWSError(error) && [
    'EngineNotSupportedException',
    'InvalidLexiconException',
    'InvalidS3BucketException',
    'InvalidS3KeyException',
    'InvalidSampleRateException',
    'InvalidSsmlException',
    'LanguageNotSupportedException',
    'LexiconNotFoundException',
    'LexiconSizeExceededException',
    'MarksNotSupportedForFormatException',
    'MaxLexemeLengthExceededException',
    'MaxLexiconsNumberExceededException',
    'ServiceFailureException',
    'SsmlMarksNotSupportedForTextTypeException',
    'TextLengthExceededException',
    'UnsupportedPlsAlphabetException',
    'UnsupportedPlsLanguageException'
  ].includes(error.code);
};