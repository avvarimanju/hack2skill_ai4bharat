# PowerShell script for Windows development environment setup

Write-Host "🚀 Setting up AvvarI for Bharat development environment..." -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
    
    # Check Node.js version (extract major version)
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -lt 18) {
        Write-Host "❌ Node.js version 18+ is required. Current version: $nodeVersion" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ and try again." -ForegroundColor Red
    exit 1
}

# Check if AWS CLI is installed
try {
    aws --version | Out-Null
    Write-Host "✅ AWS CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI is not installed. Please install AWS CLI and configure it." -ForegroundColor Red
    exit 1
}

# Check AWS configuration
try {
    aws sts get-caller-identity | Out-Null
    Write-Host "✅ AWS CLI is configured" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI is not configured. Please run 'aws configure' first." -ForegroundColor Red
    exit 1
}

# Install npm dependencies
Write-Host "📦 Installing npm dependencies..." -ForegroundColor Yellow
npm install

# Install AWS CDK CLI if not present
try {
    cdk --version | Out-Null
    Write-Host "✅ AWS CDK CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "📦 Installing AWS CDK CLI..." -ForegroundColor Yellow
    npm install -g aws-cdk
}

# Bootstrap CDK (if not already done)
Write-Host "🔧 Bootstrapping AWS CDK..." -ForegroundColor Yellow
try {
    cdk bootstrap
} catch {
    Write-Host "⚠️  CDK bootstrap may have already been done" -ForegroundColor Yellow
}

# Build TypeScript
Write-Host "🔨 Building TypeScript..." -ForegroundColor Yellow
npm run build

# Create dist directory for Lambda functions
New-Item -ItemType Directory -Force -Path "dist/lambdas" | Out-Null

# Bundle Lambda functions
Write-Host "📦 Bundling Lambda functions..." -ForegroundColor Yellow
npm run bundle

# Create common layer dependencies
Write-Host "📦 Installing common layer dependencies..." -ForegroundColor Yellow
Push-Location "src/layers/common/nodejs"
npm install --production
Pop-Location

# Run linting
Write-Host "🔍 Running linting..." -ForegroundColor Yellow
npm run lint

# Run tests
Write-Host "🧪 Running tests..." -ForegroundColor Yellow
npm test

Write-Host ""
Write-Host "🎉 Development environment setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Deploy infrastructure: npm run deploy" -ForegroundColor White
Write-Host "2. Start development: npm run watch" -ForegroundColor White
Write-Host "3. Run local API: npm run local:start" -ForegroundColor White
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "- npm run build      # Build TypeScript" -ForegroundColor White
Write-Host "- npm run test       # Run tests" -ForegroundColor White
Write-Host "- npm run lint       # Run linting" -ForegroundColor White
Write-Host "- npm run deploy     # Deploy to AWS" -ForegroundColor White
Write-Host "- npm run destroy    # Destroy AWS resources" -ForegroundColor White
Write-Host ""