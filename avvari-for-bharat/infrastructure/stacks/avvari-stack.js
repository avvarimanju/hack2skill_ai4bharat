"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvvarIStack = void 0;
const cdk = require("aws-cdk-lib");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const s3 = require("aws-cdk-lib/aws-s3");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const lambda = require("aws-cdk-lib/aws-lambda");
const iam = require("aws-cdk-lib/aws-iam");
const logs = require("aws-cdk-lib/aws-logs");
class AvvarIStack extends cdk.Stack {
    constructor(scope, id, props) {
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
                throttle: {
                    rateLimit: 1000,
                    burstLimit: 2000,
                },
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
exports.AvvarIStack = AvvarIStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXZ2YXJpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXZ2YXJpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyx5REFBeUQ7QUFDekQscURBQXFEO0FBQ3JELHlDQUF5QztBQUN6Qyx5REFBeUQ7QUFDekQsOERBQThEO0FBQzlELGlEQUFpRDtBQUNqRCwyQ0FBMkM7QUFDM0MsNkNBQTZDO0FBRzdDLE1BQWEsV0FBWSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3hDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsZ0NBQWdDO1FBQ2hDLE1BQU0sYUFBYSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDL0QsVUFBVSxFQUFFLGtCQUFrQixJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDM0QsU0FBUyxFQUFFLElBQUk7WUFDZixVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVU7WUFDMUMsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7WUFDakQsSUFBSSxFQUFFO2dCQUNKO29CQUNFLGNBQWMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO29CQUM3RSxjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUM7b0JBQ3JCLGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQztvQkFDckIsTUFBTSxFQUFFLElBQUk7aUJBQ2I7YUFDRjtZQUNELGNBQWMsRUFBRTtnQkFDZDtvQkFDRSxFQUFFLEVBQUUsa0NBQWtDO29CQUN0QyxtQ0FBbUMsRUFBRSxHQUFH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QUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLGFBQWEsQ0FBQyxVQUFVO1lBQy9CLFdBQVcsRUFBRSx3QkFBd0I7WUFDckMsVUFBVSxFQUFFLHVCQUF1QjtTQUNwQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDhCQUE4QixFQUFFO1lBQ3RELEtBQUssRUFBRSxZQUFZLENBQUMsc0JBQXNCO1lBQzFDLFdBQVcsRUFBRSxnQ0FBZ0M7WUFDN0MsVUFBVSxFQUFFLDBCQUEwQjtTQUN2QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQ2hELEtBQUssRUFBRSxrQkFBa0IsQ0FBQyxTQUFTO1lBQ25DLFdBQVcsRUFBRSxvQ0FBb0M7WUFDakQsVUFBVSxFQUFFLDRCQUE0QjtTQUN6QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxjQUFjLENBQUMsU0FBUztZQUMvQixXQUFXLEVBQUUsK0JBQStCO1lBQzVDLFVBQVUsRUFBRSx3QkFBd0I7U0FDckMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBbGFELGtDQWthQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XHJcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xyXG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xyXG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xyXG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcclxuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuXHJcbmV4cG9ydCBjbGFzcyBBdnZhcklTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgLy8gUzMgQnVja2V0IGZvciBjb250ZW50IHN0b3JhZ2VcclxuICAgIGNvbnN0IGNvbnRlbnRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdBdnZhcklDb250ZW50QnVja2V0Jywge1xyXG4gICAgICBidWNrZXROYW1lOiBgYXZ2YXJpLWNvbnRlbnQtJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259YCxcclxuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxyXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXHJcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXHJcbiAgICAgIGNvcnM6IFtcclxuICAgICAgICB7XHJcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVCwgczMuSHR0cE1ldGhvZHMuUFVULCBzMy5IdHRwTWV0aG9kcy5QT1NUXSxcclxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcclxuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcclxuICAgICAgICAgIG1heEFnZTogMzAwMCxcclxuICAgICAgICB9LFxyXG4gICAgICBdLFxyXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIGlkOiAnRGVsZXRlSW5jb21wbGV0ZU11bHRpcGFydFVwbG9hZHMnLFxyXG4gICAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDcpLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgaWQ6ICdUcmFuc2l0aW9uVG9JQScsXHJcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5GUkVRVUVOVF9BQ0NFU1MsXHJcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzMCksXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIF0sXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIGZvciBnbG9iYWwgY29udGVudCBkZWxpdmVyeVxyXG4gICAgY29uc3QgZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdBdnZhcklDb250ZW50RGlzdHJpYnV0aW9uJywge1xyXG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcclxuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKGNvbnRlbnRCdWNrZXQpLFxyXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxyXG4gICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxyXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFEX09QVElPTlMsXHJcbiAgICAgICAgY2FjaGVkTWV0aG9kczogY2xvdWRmcm9udC5DYWNoZWRNZXRob2RzLkNBQ0hFX0dFVF9IRUFEX09QVElPTlMsXHJcbiAgICAgIH0sXHJcbiAgICAgIHByaWNlQ2xhc3M6IGNsb3VkZnJvbnQuUHJpY2VDbGFzcy5QUklDRV9DTEFTU18xMDAsXHJcbiAgICAgIGVuYWJsZUxvZ2dpbmc6IHRydWUsXHJcbiAgICAgIGNvbW1lbnQ6ICdBdnZhckkgZm9yIEJoYXJhdCBDb250ZW50IERpc3RyaWJ1dGlvbicsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBEeW5hbW9EQiBUYWJsZXNcclxuICAgIFxyXG4gICAgLy8gSGVyaXRhZ2UgU2l0ZXMgdGFibGVcclxuICAgIGNvbnN0IGhlcml0YWdlU2l0ZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSGVyaXRhZ2VTaXRlc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdBdnZhckktSGVyaXRhZ2VTaXRlcycsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc2l0ZUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxyXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBcnRpZmFjdHMgdGFibGVcclxuICAgIGNvbnN0IGFydGlmYWN0c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBcnRpZmFjdHNUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnQXZ2YXJJLUFydGlmYWN0cycsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnYXJ0aWZhY3RJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3NpdGVJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcclxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQWRkIEdTSSBmb3IgcXVlcnlpbmcgYXJ0aWZhY3RzIGJ5IHNpdGVcclxuICAgIGFydGlmYWN0c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnU2l0ZUlkSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3NpdGVJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2FydGlmYWN0SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gVXNlciBTZXNzaW9ucyB0YWJsZVxyXG4gICAgY29uc3QgdXNlclNlc3Npb25zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1VzZXJTZXNzaW9uc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdBdnZhckktVXNlclNlc3Npb25zJyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdzZXNzaW9uSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXHJcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29udGVudCBDYWNoZSB0YWJsZVxyXG4gICAgY29uc3QgY29udGVudENhY2hlVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0NvbnRlbnRDYWNoZVRhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdBdnZhckktQ29udGVudENhY2hlJyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjYWNoZUtleScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcclxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCcsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBbmFseXRpY3MgdGFibGVcclxuICAgIGNvbnN0IGFuYWx5dGljc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBbmFseXRpY3NUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnQXZ2YXJJLUFuYWx5dGljcycsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZXZlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQWRkIEdTSSBmb3IgcXVlcnlpbmcgYW5hbHl0aWNzIGJ5IHNpdGUgYW5kIGRhdGVcclxuICAgIGFuYWx5dGljc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnU2l0ZURhdGVJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc2l0ZUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnZGF0ZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBJQU0gUm9sZSBmb3IgTGFtYmRhIGZ1bmN0aW9uc1xyXG4gICAgY29uc3QgbGFtYmRhRXhlY3V0aW9uUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQXZ2YXJJTGFtYmRhRXhlY3V0aW9uUm9sZScsIHtcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXHJcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xyXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxyXG4gICAgICBdLFxyXG4gICAgICBpbmxpbmVQb2xpY2llczoge1xyXG4gICAgICAgIEF2dmFySUxhbWJkYVBvbGljeTogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XHJcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXHJcbiAgICAgICAgICAgIC8vIER5bmFtb0RCIHBlcm1pc3Npb25zXHJcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkdldEl0ZW0nLFxyXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlB1dEl0ZW0nLFxyXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlVwZGF0ZUl0ZW0nLFxyXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkRlbGV0ZUl0ZW0nLFxyXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlF1ZXJ5JyxcclxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpTY2FuJyxcclxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpCYXRjaEdldEl0ZW0nLFxyXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkJhdGNoV3JpdGVJdGVtJyxcclxuICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xyXG4gICAgICAgICAgICAgICAgaGVyaXRhZ2VTaXRlc1RhYmxlLnRhYmxlQXJuLFxyXG4gICAgICAgICAgICAgICAgYXJ0aWZhY3RzVGFibGUudGFibGVBcm4sXHJcbiAgICAgICAgICAgICAgICB1c2VyU2Vzc2lvbnNUYWJsZS50YWJsZUFybixcclxuICAgICAgICAgICAgICAgIGNvbnRlbnRDYWNoZVRhYmxlLnRhYmxlQXJuLFxyXG4gICAgICAgICAgICAgICAgYW5hbHl0aWNzVGFibGUudGFibGVBcm4sXHJcbiAgICAgICAgICAgICAgICBgJHthcnRpZmFjdHNUYWJsZS50YWJsZUFybn0vaW5kZXgvKmAsXHJcbiAgICAgICAgICAgICAgICBgJHthbmFseXRpY3NUYWJsZS50YWJsZUFybn0vaW5kZXgvKmAsXHJcbiAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgIC8vIFMzIHBlcm1pc3Npb25zXHJcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgICAgICAgJ3MzOkdldE9iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcclxuICAgICAgICAgICAgICAgICdzMzpEZWxldGVPYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgJ3MzOkxpc3RCdWNrZXQnLFxyXG4gICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXHJcbiAgICAgICAgICAgICAgICBjb250ZW50QnVja2V0LmJ1Y2tldEFybixcclxuICAgICAgICAgICAgICAgIGAke2NvbnRlbnRCdWNrZXQuYnVja2V0QXJufS8qYCxcclxuICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgLy8gQW1hem9uIEJlZHJvY2sgcGVybWlzc2lvbnNcclxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcclxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXHJcbiAgICAgICAgICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbScsXHJcbiAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcclxuICAgICAgICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvKmAsXHJcbiAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgIC8vIEFtYXpvbiBQb2xseSBwZXJtaXNzaW9uc1xyXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICAgICAgICdwb2xseTpTeW50aGVzaXplU3BlZWNoJyxcclxuICAgICAgICAgICAgICAgICdwb2xseTpEZXNjcmliZVZvaWNlcycsXHJcbiAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgLy8gQW1hem9uIFRyYW5zbGF0ZSBwZXJtaXNzaW9uc1xyXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICAgICAgICd0cmFuc2xhdGU6VHJhbnNsYXRlVGV4dCcsXHJcbiAgICAgICAgICAgICAgICAndHJhbnNsYXRlOkRldGVjdERvbWluYW50TGFuZ3VhZ2UnLFxyXG4gICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgIC8vIENsb3VkV2F0Y2ggTG9ncyBwZXJtaXNzaW9uc1xyXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICAgICAgICdsb2dzOkNyZWF0ZUxvZ0dyb3VwJyxcclxuICAgICAgICAgICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXHJcbiAgICAgICAgICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnLFxyXG4gICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06KmBdLFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSksXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBMYW1iZGEgTGF5ZXIgZm9yIGNvbW1vbiBkZXBlbmRlbmNpZXNcclxuICAgIGNvbnN0IGNvbW1vbkxheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ0F2dmFySUNvbW1vbkxheWVyJywge1xyXG4gICAgICBsYXllclZlcnNpb25OYW1lOiAnYXZ2YXJpLWNvbW1vbi1sYXllcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnc3JjL2xheWVycy9jb21tb24nKSxcclxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1hdLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbW1vbiB1dGlsaXRpZXMgYW5kIEFXUyBTREsgZm9yIEF2dmFySSBMYW1iZGEgZnVuY3Rpb25zJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExhbWJkYSBGdW5jdGlvbnNcclxuXHJcbiAgICAvLyBRUiBQcm9jZXNzaW5nIExhbWJkYVxyXG4gICAgY29uc3QgcXJQcm9jZXNzaW5nTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUVJQcm9jZXNzaW5nTGFtYmRhJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdBdnZhckktUVJQcm9jZXNzaW5nJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGhhbmRsZXI6ICdxci1wcm9jZXNzaW5nLmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2Rpc3QvbGFtYmRhcycpLFxyXG4gICAgICByb2xlOiBsYW1iZGFFeGVjdXRpb25Sb2xlLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIEhFUklUQUdFX1NJVEVTX1RBQkxFOiBoZXJpdGFnZVNpdGVzVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIEFSVElGQUNUU19UQUJMRTogYXJ0aWZhY3RzVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFVTRVJfU0VTU0lPTlNfVEFCTEU6IHVzZXJTZXNzaW9uc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBDT05URU5UX0JVQ0tFVDogY29udGVudEJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICAgIENMT1VERlJPTlRfRE9NQUlOOiBkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcclxuICAgICAgfSxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDb250ZW50IEdlbmVyYXRpb24gTGFtYmRhXHJcbiAgICBjb25zdCBjb250ZW50R2VuZXJhdGlvbkxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NvbnRlbnRHZW5lcmF0aW9uTGFtYmRhJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdBdnZhckktQ29udGVudEdlbmVyYXRpb24nLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgaGFuZGxlcjogJ2NvbnRlbnQtZ2VuZXJhdGlvbi5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdkaXN0L2xhbWJkYXMnKSxcclxuICAgICAgcm9sZTogbGFtYmRhRXhlY3V0aW9uUm9sZSxcclxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcclxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBIRVJJVEFHRV9TSVRFU19UQUJMRTogaGVyaXRhZ2VTaXRlc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBBUlRJRkFDVFNfVEFCTEU6IGFydGlmYWN0c1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBDT05URU5UX0NBQ0hFX1RBQkxFOiBjb250ZW50Q2FjaGVUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgQ09OVEVOVF9CVUNLRVQ6IGNvbnRlbnRCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgICBDTE9VREZST05UX0RPTUFJTjogZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUSZBIFByb2Nlc3NpbmcgTGFtYmRhXHJcbiAgICBjb25zdCBxYVByb2Nlc3NpbmdMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdRQVByb2Nlc3NpbmdMYW1iZGEnLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ0F2dmFySS1RQVByb2Nlc3NpbmcnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgaGFuZGxlcjogJ3FhLXByb2Nlc3NpbmcuaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnZGlzdC9sYW1iZGFzJyksXHJcbiAgICAgIHJvbGU6IGxhbWJkYUV4ZWN1dGlvblJvbGUsXHJcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMiksXHJcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBIRVJJVEFHRV9TSVRFU19UQUJMRTogaGVyaXRhZ2VTaXRlc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBBUlRJRkFDVFNfVEFCTEU6IGFydGlmYWN0c1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBVU0VSX1NFU1NJT05TX1RBQkxFOiB1c2VyU2Vzc2lvbnNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgQ09OVEVOVF9DQUNIRV9UQUJMRTogY29udGVudENhY2hlVGFibGUudGFibGVOYW1lLFxyXG4gICAgICB9LFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFuYWx5dGljcyBMYW1iZGFcclxuICAgIGNvbnN0IGFuYWx5dGljc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FuYWx5dGljc0xhbWJkYScsIHtcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnQXZ2YXJJLUFuYWx5dGljcycsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBoYW5kbGVyOiAnYW5hbHl0aWNzLmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2Rpc3QvbGFtYmRhcycpLFxyXG4gICAgICByb2xlOiBsYW1iZGFFeGVjdXRpb25Sb2xlLFxyXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIEFOQUxZVElDU19UQUJMRTogYW5hbHl0aWNzVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFVTRVJfU0VTU0lPTlNfVEFCTEU6IHVzZXJTZXNzaW9uc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgfSxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBUEkgR2F0ZXdheVxyXG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnQXZ2YXJJQVBJJywge1xyXG4gICAgICByZXN0QXBpTmFtZTogJ0F2dmFySSBmb3IgQmhhcmF0IEFQSScsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIGZvciBBdnZhckkgaGVyaXRhZ2Ugc2l0ZSBkaWdpdGl6YXRpb24gcGxhdGZvcm0nLFxyXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcclxuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcclxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcclxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcclxuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxyXG4gICAgICAgICAgJ1gtQW16LURhdGUnLFxyXG4gICAgICAgICAgJ0F1dGhvcml6YXRpb24nLFxyXG4gICAgICAgICAgJ1gtQXBpLUtleScsXHJcbiAgICAgICAgICAnWC1BbXotU2VjdXJpdHktVG9rZW4nLFxyXG4gICAgICAgICAgJ1gtQW16LVVzZXItQWdlbnQnLFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcclxuICAgICAgICBzdGFnZU5hbWU6ICdwcm9kJyxcclxuICAgICAgICB0aHJvdHRsZToge1xyXG4gICAgICAgICAgcmF0ZUxpbWl0OiAxMDAwLFxyXG4gICAgICAgICAgYnVyc3RMaW1pdDogMjAwMCxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGxvZ2dpbmdMZXZlbDogYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcclxuICAgICAgICBkYXRhVHJhY2VFbmFibGVkOiB0cnVlLFxyXG4gICAgICAgIG1ldHJpY3NFbmFibGVkOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQVBJIEdhdGV3YXkgSW50ZWdyYXRpb25zXHJcbiAgICBjb25zdCBxclByb2Nlc3NpbmdJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHFyUHJvY2Vzc2luZ0xhbWJkYSk7XHJcbiAgICBjb25zdCBjb250ZW50R2VuZXJhdGlvbkludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oY29udGVudEdlbmVyYXRpb25MYW1iZGEpO1xyXG4gICAgY29uc3QgcWFQcm9jZXNzaW5nSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihxYVByb2Nlc3NpbmdMYW1iZGEpO1xyXG4gICAgY29uc3QgYW5hbHl0aWNzSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhbmFseXRpY3NMYW1iZGEpO1xyXG5cclxuICAgIC8vIEFQSSBSb3V0ZXNcclxuICAgIFxyXG4gICAgLy8gUVIgUHJvY2Vzc2luZyByb3V0ZXNcclxuICAgIGNvbnN0IHFyUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgncXInKTtcclxuICAgIHFyUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgcXJQcm9jZXNzaW5nSW50ZWdyYXRpb24sIHtcclxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogbmV3IGFwaWdhdGV3YXkuUmVxdWVzdFZhbGlkYXRvcih0aGlzLCAnUVJSZXF1ZXN0VmFsaWRhdG9yJywge1xyXG4gICAgICAgIHJlc3RBcGk6IGFwaSxcclxuICAgICAgICB2YWxpZGF0ZVJlcXVlc3RCb2R5OiB0cnVlLFxyXG4gICAgICAgIHZhbGlkYXRlUmVxdWVzdFBhcmFtZXRlcnM6IHRydWUsXHJcbiAgICAgIH0pLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29udGVudCBHZW5lcmF0aW9uIHJvdXRlc1xyXG4gICAgY29uc3QgY29udGVudFJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2NvbnRlbnQnKTtcclxuICAgIGNvbnRlbnRSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBjb250ZW50R2VuZXJhdGlvbkludGVncmF0aW9uKTtcclxuICAgIFxyXG4gICAgY29uc3QgYXJ0aWZhY3RDb250ZW50UmVzb3VyY2UgPSBjb250ZW50UmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3thcnRpZmFjdElkfScpO1xyXG4gICAgYXJ0aWZhY3RDb250ZW50UmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBjb250ZW50R2VuZXJhdGlvbkludGVncmF0aW9uKTtcclxuXHJcbiAgICAvLyBRJkEgcm91dGVzXHJcbiAgICBjb25zdCBxYVJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3FhJyk7XHJcbiAgICBxYVJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIHFhUHJvY2Vzc2luZ0ludGVncmF0aW9uKTtcclxuICAgIFxyXG4gICAgY29uc3Qgc2Vzc2lvblFBUmVzb3VyY2UgPSBxYVJlc291cmNlLmFkZFJlc291cmNlKCd7c2Vzc2lvbklkfScpO1xyXG4gICAgc2Vzc2lvblFBUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBxYVByb2Nlc3NpbmdJbnRlZ3JhdGlvbik7XHJcblxyXG4gICAgLy8gQW5hbHl0aWNzIHJvdXRlc1xyXG4gICAgY29uc3QgYW5hbHl0aWNzUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnYW5hbHl0aWNzJyk7XHJcbiAgICBhbmFseXRpY3NSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBhbmFseXRpY3NJbnRlZ3JhdGlvbik7XHJcbiAgICBhbmFseXRpY3NSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGFuYWx5dGljc0ludGVncmF0aW9uKTtcclxuXHJcbiAgICAvLyBIZWFsdGggY2hlY2sgZW5kcG9pbnRcclxuICAgIGNvbnN0IGhlYWx0aFJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2hlYWx0aCcpO1xyXG4gICAgaGVhbHRoUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5Nb2NrSW50ZWdyYXRpb24oe1xyXG4gICAgICBpbnRlZ3JhdGlvblJlc3BvbnNlczogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxyXG4gICAgICAgICAgcmVzcG9uc2VUZW1wbGF0ZXM6IHtcclxuICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgICAgICAgc3RhdHVzOiAnaGVhbHRoeScsXHJcbiAgICAgICAgICAgICAgdGltZXN0YW1wOiAnJGNvbnRleHQucmVxdWVzdFRpbWUnLFxyXG4gICAgICAgICAgICAgIHNlcnZpY2U6ICdBdnZhckkgZm9yIEJoYXJhdCBBUEknLFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgXSxcclxuICAgICAgcmVxdWVzdFRlbXBsYXRlczoge1xyXG4gICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ3tcInN0YXR1c0NvZGVcIjogMjAwfScsXHJcbiAgICAgIH0sXHJcbiAgICB9KSwge1xyXG4gICAgICBtZXRob2RSZXNwb25zZXM6IFtcclxuICAgICAgICB7XHJcbiAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcclxuICAgICAgICAgIHJlc3BvbnNlTW9kZWxzOiB7XHJcbiAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogYXBpZ2F0ZXdheS5Nb2RlbC5FTVBUWV9NT0RFTCxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIE91dHB1dHNcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBUElHYXRld2F5VVJMJywge1xyXG4gICAgICB2YWx1ZTogYXBpLnVybCxcclxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBVUkwnLFxyXG4gICAgICBleHBvcnROYW1lOiAnQXZ2YXJJLUFQSS1VUkwnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvbnRlbnRCdWNrZXROYW1lJywge1xyXG4gICAgICB2YWx1ZTogY29udGVudEJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIENvbnRlbnQgQnVja2V0IE5hbWUnLFxyXG4gICAgICBleHBvcnROYW1lOiAnQXZ2YXJJLUNvbnRlbnQtQnVja2V0JyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250RGlzdHJpYnV0aW9uRG9tYWluJywge1xyXG4gICAgICB2YWx1ZTogZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gRG9tYWluJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0F2dmFySS1DbG91ZEZyb250LURvbWFpbicsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSGVyaXRhZ2VTaXRlc1RhYmxlTmFtZScsIHtcclxuICAgICAgdmFsdWU6IGhlcml0YWdlU2l0ZXNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnSGVyaXRhZ2UgU2l0ZXMgRHluYW1vREIgVGFibGUgTmFtZScsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdBdnZhckktSGVyaXRhZ2VTaXRlcy1UYWJsZScsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXJ0aWZhY3RzVGFibGVOYW1lJywge1xyXG4gICAgICB2YWx1ZTogYXJ0aWZhY3RzVGFibGUudGFibGVOYW1lLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FydGlmYWN0cyBEeW5hbW9EQiBUYWJsZSBOYW1lJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0F2dmFySS1BcnRpZmFjdHMtVGFibGUnLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59Il19