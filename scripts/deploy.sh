#!/bin/bash

# Deployment script for AvvarI for Bharat

set -e

echo "🚀 Deploying AvvarI for Bharat to AWS..."

# Build and bundle
echo "🔨 Building application..."
npm run build
npm run bundle

# Install common layer dependencies
echo "📦 Installing common layer dependencies..."
cd src/layers/common/nodejs
npm install --production
cd ../../../../

# Deploy with CDK
echo "☁️  Deploying infrastructure..."
cdk deploy --all --require-approval never

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "To get the API Gateway URL:"
echo "aws cloudformation describe-stacks --stack-name AvvarIForBharatStack --query 'Stacks[0].Outputs[?OutputKey==\`APIGatewayURL\`].OutputValue' --output text"
echo ""