# AvvarI for Bharat - AI-Powered Heritage Site Digitization Platform

## Overview

AvvarI for Bharat is a cloud-native, AI-powered heritage site digitization platform built on AWS services. The system transforms heritage site visits into immersive, multilingual experiences by combining QR code scanning, AI content generation, and real-time multimedia delivery.

## Architecture

The platform leverages:
- **Amazon Bedrock** for AI content generation and RAG-based Q&A
- **Amazon Polly** for multilingual text-to-speech
- **AWS Lambda** for serverless compute
- **Amazon DynamoDB** for data storage and caching
- **Amazon S3** for content repository
- **Amazon CloudFront** for global content delivery
- **Amazon API Gateway** for REST API endpoints

## Project Structure

```
avvari-for-bharat/
├── infrastructure/          # AWS CDK infrastructure code
├── src/                    # Application source code
│   ├── lambdas/           # Lambda function implementations
│   ├── models/            # Data models and interfaces
│   ├── services/          # Business logic services
│   └── utils/             # Utility functions
├── tests/                 # Test files
├── docs/                  # Documentation
└── scripts/               # Build and deployment scripts
```

## Getting Started

1. Install dependencies: `npm install`
2. Configure AWS CLI: `aws configure`
3. Deploy infrastructure: `npm run deploy`
4. Run tests: `npm test`

## Development

- **Language**: TypeScript
- **Infrastructure**: AWS CDK
- **Testing**: Jest with Hypothesis for property-based testing
- **Build**: esbuild for Lambda bundling

## Requirements

- Node.js 18+
- AWS CLI configured
- AWS CDK CLI installed