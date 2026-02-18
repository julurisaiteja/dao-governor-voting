const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy Governance Token
  const GovernanceToken = await hre.ethers.getContractFactory("GovernanceToken");
  const token = await GovernanceToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`GovernanceToken deployed to: ${tokenAddress}`);

  // Delegate votes to deployer to allow immediate proposal creation
  await token.delegate(deployer.address);
  console.log("Delegated votes to deployer");

  // 2. Deploy Timelock
  // Proposers: [], Executors: [], Admin: deployer (temporarily)
  // We will set Governor as proposer later.
  const minDelay = 3600; // 1 hour
  const Timelock = await hre.ethers.getContractFactory("GovernorTimelock");
  const timelock = await Timelock.deploy(minDelay, [], [], deployer.address);
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log(`Timelock deployed to: ${timelockAddress}`);

  // 3. Deploy Governor
  const VotingDelay = 1; // 1 block (for testing)
  const VotingPeriod = 5; // 5 blocks (for testing)
  const QuorumPercent = 4; // 4%
  const MinTokensToPropose = 0; // 0 for testing

  const MyGovernor = await hre.ethers.getContractFactory("MyGovernor");
  const governor = await MyGovernor.deploy(
    tokenAddress,
    timelockAddress,
    VotingDelay,
    VotingPeriod,
    QuorumPercent,
    MinTokensToPropose
  );
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();
  console.log(`MyGovernor deployed to: ${governorAddress}`);

  // 4. Setup Timelock Roles
  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const adminRole = await timelock.DEFAULT_ADMIN_ROLE();

  // Grant Proposer role to Governor
  await timelock.grantRole(proposerRole, governorAddress);
  console.log("Granted Proposer role to Governor");

  // Grant Executor role to address(0) (anyone can execute)
  await timelock.grantRole(executorRole, "0x0000000000000000000000000000000000000000");
  console.log("Granted Executor role to everyone");

  // Renounce Admin role (optional, but good practice)
  // await timelock.renounceRole(adminRole, deployer.address);
  // console.log("Renounced Admin role");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
