import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class AvvarIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for content storage
    const contentBucket = new s3.Bucket(this, 'AvvarIContentBucket', {
      bucketName: `avvari-content-${this.account}-${this.region}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
        {
          id: 'TransitionToIA',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // CloudFront Distribution for global content delivery
    const distribution = new cloudfront.Distribution(this, 'AvvarIContentDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(contentBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enableLogging: true,
      comment: 'AvvarI for Bharat Content Distribution',
    });

    // DynamoDB Tables
    
    // Heritage Sites table
    const heritageSitesTable = new dynamodb.Table(this, 'HeritageSitesTable', {
      tableName: 'AvvarI-HeritageSites',
      partitionKey: { name: 'siteId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Artifacts table
    const artifactsTable = new dynamodb.Table(this, 'ArtifactsTable', {
      tableName: 'AvvarI-Artifacts',
      partitionKey: { name: 'artifactId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'siteId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for querying artifacts by site
    artifactsTable.addGlobalSecondaryIndex({
      indexName: 'SiteIdIndex',
      partitionKey: { name: 'siteId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'artifactId', type: dynamodb.AttributeType.STRING },
    });

    // User Sessions table
    const userSessionsTable = new dynamodb.Table(this, 'UserSessionsTable', {
      tableName: 'AvvarI-UserSessions',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Content Cache table
    const contentCacheTable = new dynamodb.Table(this, 'ContentCacheTable', {
      tableName: 'AvvarI-ContentCache',
      partitionKey: { name: 'cacheKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Analytics table
    const analyticsTable = new dynamodb.Table(this, 'AnalyticsTable', {
      tableName: 'AvvarI-Analytics',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for querying analytics by site and date
    analyticsTable.addGlobalSecondaryIndex({
      indexName: 'SiteDateIndex',
      partitionKey: { name: 'siteId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
    });

    // IAM Role for Lambda functions
    const lambdaExecutionRole = new iam.Role(this, 'AvvarILambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        AvvarILambdaPolicy: new iam.PolicyDocument({
          statements: [
            // DynamoDB permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:BatchGetItem',
                'dynamodb:BatchWriteItem',
              ],
              resources: [
                heritageSitesTable.tableArn,
                artifactsTable.tableArn,
                userSessionsTable.tableArn,
                contentCacheTable.tableArn,
                analyticsTable.tableArn,
                `${artifactsTable.tableArn}/index/*`,
                `${analyticsTable.tableArn}/index/*`,
              ],
            }),
            // S3 permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket',
              ],
              resources: [
                contentBucket.bucketArn,
                `${contentBucket.bucketArn}/*`,
              ],
            }),
            // Amazon Bedrock permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
              ],
              resources: [
                `arn:aws:bedrock:${this.region}::foundation-model/*`,
              ],
            }),
            // Amazon Polly permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'polly:SynthesizeSpeech',
                'polly:DescribeVoices',
              ],
              resources: ['*'],
            }),
            // Amazon Translate permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'translate:TranslateText',
                'translate:DetectDominantLanguage',
              ],
              resources: ['*'],
            }),
            // CloudWatch Logs permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: [`arn:aws:logs:${this.region}:${this.account}:*`],
            }),
          ],
        }),
      },
    });

    // Lambda Layer for common dependencies
    const commonLayer = new lambda.LayerVersion(this, 'AvvarICommonLayer', {
      layerVersionName: 'avvari-common-layer',
      code: lambda.Code.fromAsset('src/layers/common'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Common utilities and AWS SDK for AvvarI Lambda functions',
    });

    // Lambda Functions

    // QR Processing Lambda
    const qrProcessingLambda = new lambda.Function(this, 'QRProcessingLambda', {
      functionName: 'AvvarI-QRProcessing',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'qr-processing.handler',
      code: lambda.Code.fromAsset('dist/lambdas'),
      role: lambdaExecutionRole,
      layers: [commonLayer],
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        HERITAGE_SITES_TABLE: heritageSitesTable.tableName,
        ARTIFACTS_TABLE: artifactsTable.tableName,
        USER_SESSIONS_TABLE: userSessionsTable.tableName,
        CONTENT_BUCKET: contentBucket.bucketName,
        CLOUDFRONT_DOMAIN: distribution.distributionDomainName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Content Generation Lambda
    const contentGenerationLambda = new lambda.Function(this, 'ContentGenerationLambda', {
      functionName: 'AvvarI-ContentGeneration',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'content-generation.handler',
      code: lambda.Code.fromAsset('dist/lambdas'),
      role: lambdaExecutionRole,
      layers: [commonLayer],
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        HERITAGE_SITES_TABLE: heritageSitesTable.tableName,
        ARTIFACTS_TABLE: artifactsTable.tableName,
        CONTENT_CACHE_TABLE: contentCacheTable.tableName,
        CONTENT_BUCKET: contentBucket.bucketName,
        CLOUDFRONT_DOMAIN: distribution.distributionDomainName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Q&A Processing Lambda
    const qaProcessingLambda = new lambda.Function(this, 'QAProcessingLambda', {
      functionName: 'AvvarI-QAProcessing',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'qa-processing.handler',
      code: lambda.Code.fromAsset('dist/lambdas'),
      role: lambdaExecutionRole,
      layers: [commonLayer],
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      environment: {
        HERITAGE_SITES_TABLE: heritageSitesTable.tableName,
        ARTIFACTS_TABLE: artifactsTable.tableName,
        USER_SESSIONS_TABLE: userSessionsTable.tableName,
        CONTENT_CACHE_TABLE: contentCacheTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Analytics Lambda
    const analyticsLambda = new lambda.Function(this, 'AnalyticsLambda', {
      functionName: 'AvvarI-Analytics',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'analytics.handler',
      code: lambda.Code.fromAsset('dist/lambdas'),
      role: lambdaExecutionRole,
      layers: [commonLayer],
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ANALYTICS_TABLE: analyticsTable.tableName,
        USER_SESSIONS_TABLE: userSessionsTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'AvvarIAPI', {
      restApiName: 'AvvarI for Bharat API',
      description: 'API for AvvarI heritage site digitization platform',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
        ],
      },
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
    });

    // API Gateway Integrations
    const qrProcessingIntegration = new apigateway.LambdaIntegration(qrProcessingLambda);
    const contentGenerationIntegration = new apigateway.LambdaIntegration(contentGenerationLambda);
    const qaProcessingIntegration = new apigateway.LambdaIntegration(qaProcessingLambda);
    const analyticsIntegration = new apigateway.LambdaIntegration(analyticsLambda);

    // API Routes
    
    // QR Processing routes
    const qrResource = api.root.addResource('qr');
    qrResource.addMethod('POST', qrProcessingIntegration, {
      requestValidator: new apigateway.RequestValidator(this, 'QRRequestValidator', {
        restApi: api,
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
    });

    // Content Generation routes
    const contentResource = api.root.addResource('content');
    contentResource.addMethod('POST', contentGenerationIntegration);
    
    const artifactContentResource = contentResource.addResource('{artifactId}');
    artifactContentResource.addMethod('GET', contentGenerationIntegration);

    // Q&A routes
    const qaResource = api.root.addResource('qa');
    qaResource.addMethod('POST', qaProcessingIntegration);
    
    const sessionQAResource = qaResource.addResource('{sessionId}');
    sessionQAResource.addMethod('GET', qaProcessingIntegration);

    // Analytics routes
    const analyticsResource = api.root.addResource('analytics');
    analyticsResource.addMethod('POST', analyticsIntegration);
    analyticsResource.addMethod('GET', analyticsIntegration);

    // Health check endpoint
    const healthResource = api.root.addResource('health');
    healthResource.addMethod('GET', new apigateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseTemplates: {
            'application/json': JSON.stringify({
              status: 'healthy',
              timestamp: '$context.requestTime',
              service: 'AvvarI for Bharat API',
            }),
          },
        },
      ],
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'APIGatewayURL', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: 'AvvarI-API-URL',
    });

    new cdk.CfnOutput(this, 'ContentBucketName', {
      value: contentBucket.bucketName,
      description: 'S3 Content Bucket Name',
      exportName: 'AvvarI-Content-Bucket',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain',
      exportName: 'AvvarI-CloudFront-Domain',
    });

    new cdk.CfnOutput(this, 'HeritageSitesTableName', {
      value: heritageSitesTable.tableName,
      description: 'Heritage Sites DynamoDB Table Name',
      exportName: 'AvvarI-HeritageSites-Table',
    });

    new cdk.CfnOutput(this, 'ArtifactsTableName', {
      value: artifactsTable.tableName,
      description: 'Artifacts DynamoDB Table Name',
      exportName: 'AvvarI-Artifacts-Table',
    });
  }
}