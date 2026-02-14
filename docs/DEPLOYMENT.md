# Deployment Guide

## Prerequisites

1. **Node.js 18+** installed
2. **AWS CLI** configured with appropriate permissions
3. **AWS CDK CLI** installed (`npm install -g aws-cdk`)
4. **AWS Account** with the following services enabled:
   - Lambda
   - API Gateway
   - DynamoDB
   - S3
   - CloudFront
   - Amazon Bedrock
   - Amazon Polly
   - Amazon Translate

## Required AWS Permissions

Your AWS user/role needs the following permissions:
- `AWSLambdaFullAccess`
- `AmazonAPIGatewayAdministrator`
- `AmazonDynamoDBFullAccess`
- `AmazonS3FullAccess`
- `CloudFrontFullAccess`
- `AmazonBedrockFullAccess`
- `AmazonPollyFullAccess`
- `AmazonTranslateFullAccess`
- `IAMFullAccess` (for creating Lambda execution roles)
- `CloudFormationFullAccess`

## Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd avvari-for-bharat
   npm install
   ```

2. **Run setup script:**
   ```bash
   chmod +x scripts/setup-dev.sh
   ./scripts/setup-dev.sh
   ```

3. **Configure environment (optional):**
   ```bash
   export ENVIRONMENT=production
   export CDK_DEFAULT_REGION=us-east-1
   ```

## Deployment

### Automated Deployment

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Manual Deployment

1. **Build the application:**
   ```bash
   npm run build
   npm run bundle
   ```

2. **Install Lambda layer dependencies:**
   ```bash
   cd src/layers/common/nodejs
   npm install --production
   cd ../../../../
   ```

3. **Deploy infrastructure:**
   ```bash
   cdk deploy --all
   ```

## Post-Deployment

1. **Get API Gateway URL:**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name AvvarIForBharatStack \
     --query 'Stacks[0].Outputs[?OutputKey==`APIGatewayURL`].OutputValue' \
     --output text
   ```

2. **Test the deployment:**
   ```bash
   curl -X GET <API_GATEWAY_URL>/health
   ```

3. **Enable Amazon Bedrock models:**
   - Go to AWS Console > Amazon Bedrock > Model access
   - Request access to required models:
     - Anthropic Claude 3 Sonnet
     - Amazon Titan Embed Text

## Environment-Specific Deployments

### Development
```bash
export ENVIRONMENT=development
cdk deploy --all
```

### Staging
```bash
export ENVIRONMENT=staging
cdk deploy --all
```

### Production
```bash
export ENVIRONMENT=production
cdk deploy --all
```

## Monitoring and Logs

1. **CloudWatch Logs:**
   - Lambda function logs are automatically created
   - Log retention: 1 week (configurable in CDK)

2. **CloudWatch Metrics:**
   - API Gateway metrics enabled
   - Lambda metrics enabled
   - DynamoDB metrics enabled

3. **X-Ray Tracing:**
   - Currently disabled (can be enabled in CDK)

## Rollback

To rollback a deployment:

```bash
# Rollback to previous version
cdk deploy --all --rollback

# Or destroy and redeploy
cdk destroy --all
cdk deploy --all
```

## Cleanup

To remove all AWS resources:

```bash
cdk destroy --all
```

**Warning:** This will delete all data including DynamoDB tables and S3 buckets.

## Troubleshooting

### Common Issues

1. **CDK Bootstrap Error:**
   ```bash
   cdk bootstrap aws://ACCOUNT-NUMBER/REGION
   ```

2. **Lambda Layer Size Error:**
   - Reduce dependencies in `src/layers/common/nodejs/package.json`
   - Use Lambda runtime provided libraries when possible

3. **Bedrock Access Denied:**
   - Request model access in AWS Console
   - Ensure IAM permissions include Bedrock actions

4. **DynamoDB Throttling:**
   - Tables use on-demand billing by default
   - Monitor CloudWatch metrics for throttling

### Logs and Debugging

1. **View Lambda logs:**
   ```bash
   aws logs tail /aws/lambda/AvvarI-QRProcessing --follow
   ```

2. **Check API Gateway logs:**
   - Enable in API Gateway console
   - View in CloudWatch Logs

3. **Monitor DynamoDB:**
   ```bash
   aws dynamodb describe-table --table-name AvvarI-HeritageSites
   ```

## Security Considerations

1. **API Gateway:**
   - Rate limiting enabled (1000 req/min)
   - CORS configured for web access

2. **Lambda Functions:**
   - Least privilege IAM roles
   - Environment variables for configuration

3. **DynamoDB:**
   - Encryption at rest enabled
   - Point-in-time recovery enabled

4. **S3:**
   - Block public access enabled
   - Versioning enabled
   - Encryption enabled

## Cost Optimization

1. **Lambda:**
   - Right-sized memory allocation
   - Timeout optimization

2. **DynamoDB:**
   - On-demand billing for variable workloads
   - TTL enabled for temporary data

3. **S3:**
   - Lifecycle policies for cost optimization
   - Intelligent tiering for long-term storage

4. **CloudFront:**
   - Price class 100 (US, Canada, Europe)
   - Caching optimized for static content