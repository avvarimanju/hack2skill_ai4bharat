# PowerShell deployment script for AvvarI for Bharat

Write-Host "🚀 Deploying AvvarI for Bharat to AWS..." -ForegroundColor Green

# Build and bundle
Write-Host "🔨 Building application..." -ForegroundColor Yellow
npm run build
npm run bundle

# Install common layer dependencies
Write-Host "📦 Installing common layer dependencies..." -ForegroundColor Yellow
Push-Location "src/layers/common/nodejs"
npm install --production
Pop-Location

# Deploy with CDK
Write-Host "☁️  Deploying infrastructure..." -ForegroundColor Yellow
cdk deploy --all --require-approval never

Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To get the API Gateway URL:" -ForegroundColor Cyan
Write-Host "aws cloudformation describe-stacks --stack-name AvvarIForBharatStack --query 'Stacks[0].Outputs[?OutputKey==``APIGatewayURL``].OutputValue' --output text" -ForegroundColor White
Write-Host ""