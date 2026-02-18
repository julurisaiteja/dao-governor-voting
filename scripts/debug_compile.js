const hre = require("hardhat");
const fs = require('fs');

async function main() {
    const logFile = fs.createWriteStream('compiler_output.log', { flags: 'a' });
    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;

    function hook(chunk, encoding, callback) {
        logFile.write(chunk, encoding);
        // Also write to original to keep it visible (though truncated) try/catch to avoid issues
        try { return originalStdoutWrite.call(process.stdout, chunk, encoding, callback); } catch (e) { }
    }

    process.stdout.write = hook;
    process.stderr.write = hook;

    console.log("Starting compilation...");
    try {
        await hre.run("compile");
        console.log("Compilation successful!");
    } catch (error) {
        console.error("Compilation failed.");
        fs.appendFileSync('compiler_output.log', "\nERROR STACK:\n" + (error.stack || error.toString()));
    }
}

main().catch((error) => {
    fs.appendFileSync('compiler_output.log', "\nCRITICAL ERROR:\n" + error.toString());
});
