#!/bin/bash

# Development environment setup script for AvvarI for Bharat

set -e

echo "🚀 Setting up AvvarI for Bharat development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install AWS CLI and configure it."
    exit 1
fi

echo "✅ AWS CLI is installed"

# Check AWS configuration
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS CLI is configured"

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

# Install AWS CDK CLI if not present
if ! command -v cdk &> /dev/null; then
    echo "📦 Installing AWS CDK CLI..."
    npm install -g aws-cdk
fi

echo "✅ AWS CDK CLI is installed"

# Bootstrap CDK (if not already done)
echo "🔧 Bootstrapping AWS CDK..."
cdk bootstrap || echo "⚠️  CDK bootstrap may have already been done"

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Create dist directory for Lambda functions
mkdir -p dist/lambdas

# Bundle Lambda functions
echo "📦 Bundling Lambda functions..."
npm run bundle

# Create common layer dependencies
echo "📦 Installing common layer dependencies..."
cd src/layers/common/nodejs
npm install --production
cd ../../../../

# Run linting
echo "🔍 Running linting..."
npm run lint

# Run tests
echo "🧪 Running tests..."
npm test

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy infrastructure: npm run deploy"
echo "2. Start development: npm run watch"
echo "3. Run local API: npm run local:start"
echo ""
echo "Useful commands:"
echo "- npm run build      # Build TypeScript"
echo "- npm run test       # Run tests"
echo "- npm run lint       # Run linting"
echo "- npm run deploy     # Deploy to AWS"
echo "- npm run destroy    # Destroy AWS resources"
echo ""