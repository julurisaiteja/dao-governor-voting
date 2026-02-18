# 1. Run Smart Contract Tests
Write-Host "Running Smart Contract Tests..." -ForegroundColor Cyan
npx hardhat test
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests Failed!" -ForegroundColor Red
    exit 1
}

# 2. Deploy to Local Network (Docker/Local Node)
Write-Host "Deploying Contracts to Localhost..." -ForegroundColor Cyan
npx hardhat run scripts/deploy.js --network localhost
if ($LASTEXITCODE -ne 0) {
    Write-Host "Deployment Failed! Ensure Docker or Hardhat Node is running." -ForegroundColor Red
    exit 1
}

# 3. Validation Complete
Write-Host "---------------------------------------------------" -ForegroundColor Green
Write-Host "Backend Verification Complete!" -ForegroundColor Green
Write-Host "To verify the Frontend:" -ForegroundColor Yellow
Write-Host "1. Ensure Docker container logic is running (docker-compose up)"
Write-Host "2. Open http://localhost:3000 in your browser"
Write-Host "---------------------------------------------------" -ForegroundColor Green
