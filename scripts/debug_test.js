const hre = require("hardhat");
const fs = require('fs');

async function main() {
    const logFile = fs.createWriteStream('test_output.log', { flags: 'a' });
    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;

    function hook(chunk, encoding, callback) {
        logFile.write(chunk, encoding);
        try { return originalStdoutWrite.call(process.stdout, chunk, encoding, callback); } catch (e) { }
    }

    process.stdout.write = hook;
    process.stderr.write = hook;

    console.log("Starting tests...");
    try {
        await hre.run("test");
        console.log("Tests successful!");
    } catch (error) {
        console.error("Tests failed.");
        fs.appendFileSync('test_output.log', "\nERROR STACK:\n" + (error.stack || error.toString()));
    }
}

main().catch((error) => {
    fs.appendFileSync('test_output.log', "\nCRITICAL ERROR:\n" + error.toString());
});
