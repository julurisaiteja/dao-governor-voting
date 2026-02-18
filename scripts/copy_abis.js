const fs = require('fs');
const path = require('path');

const contractsDir = path.join(__dirname, '..', 'artifacts', 'contracts');
const frontendAbisDir = path.join(__dirname, '..', 'frontend', 'abis');

// Create destination directory if it doesn't exist
if (!fs.existsSync(frontendAbisDir)) {
    fs.mkdirSync(frontendAbisDir, { recursive: true });
}

const filesToCopy = [
    { src: 'GovernanceToken.sol/GovernanceToken.json', dest: 'GovernanceToken.json' },
    { src: 'MyGovernor.sol/MyGovernor.json', dest: 'MyGovernor.json' },
    { src: 'Timelock.sol/GovernorTimelock.json', dest: 'GovernorTimelock.json' }
];

filesToCopy.forEach(file => {
    const srcPath = path.join(contractsDir, file.src);
    const destPath = path.join(frontendAbisDir, file.dest);

    if (fs.existsSync(srcPath)) {
        const artifact = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
        // We only really need the abi, but keeping the whole artifact is fine for now
        // Or extract just abi and address (if we had deployment address json).
        // For now, let's copy the whole file but maybe just abi for cleaner frontend?
        // Let's copy the abi property only to save space/confusion.

        fs.writeFileSync(destPath, JSON.stringify(artifact.abi, null, 2));
        console.log(`Copied ABI: ${file.src} -> ${destPath}`);
    } else {
        console.warn(`Source file not found: ${srcPath}`);
    }
});
