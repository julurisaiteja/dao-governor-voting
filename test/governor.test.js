const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DAO Governor", function () {
  async function deployGovernorFixture() {
    const [owner, otherAccount, voter1, voter2, voter3] = await ethers.getSigners();

    // 1. Deploy Token
    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
    const token = await GovernanceToken.deploy();

    // Mint tokens to voters
    const amount = ethers.parseEther("10000"); // 10k tokens
    await token.transfer(voter1.address, amount);
    await token.transfer(voter2.address, amount);
    await token.transfer(voter3.address, amount); // voter3 will have more tokens later if needed

    // Delegate to self to activate voting power
    await token.connect(voter1).delegate(voter1.address);
    await token.connect(voter2).delegate(voter2.address);
    // voter3 does not delegate yet

    // 2. Deploy Timelock
    const minDelay = 3600; // 1 hour
    const Timelock = await ethers.getContractFactory("GovernorTimelock");
    const timelock = await Timelock.deploy(minDelay, [owner.address], [owner.address], owner.address);

    // 3. Deploy Governor
    const MyGovernor = await ethers.getContractFactory("MyGovernor");
    const governor = await MyGovernor.deploy(
      token.target,
      timelock.target,
      1, // Voting Delay (1 block)
      50400, // Voting Period (1 week approx, but we use blocks)
      4, // Quorum %
      0 // Min tokens to propose
    );

    // 4. Setup Roles
    const proposerRole = await timelock.PROPOSER_ROLE();
    const executorRole = await timelock.EXECUTOR_ROLE();
    const adminRole = await timelock.DEFAULT_ADMIN_ROLE();

    await timelock.grantRole(proposerRole, governor.target);
    await timelock.grantRole(executorRole, ethers.ZeroAddress);
    // await timelock.renounceRole(adminRole, owner.address); // keep admin for testing if needed

    return { token, timelock, governor, owner, otherAccount, voter1, voter2, voter3 };
  }

  describe("Deployment", function () {
    it("Should set the right voting token", async function () {
      const { governor, token } = await loadFixture(deployGovernorFixture);
      expect(await governor.token()).to.equal(token.target);
    });

    it("Should set the right timelock", async function () {
      const { governor, timelock } = await loadFixture(deployGovernorFixture);
      expect(await governor.timelock()).to.equal(timelock.target);
    });
  });

  describe("Voting Power", function () {
    it("Should show correct voting power after delegation", async function () {
      const { token, voter1 } = await loadFixture(deployGovernorFixture);
      const balance = await token.balanceOf(voter1.address);
      expect(await token.getVotes(voter1.address)).to.equal(balance);
    });

    it("Should show 0 voting power before delegation", async function () {
      const { token, voter3 } = await loadFixture(deployGovernorFixture);
      expect(await token.getVotes(voter3.address)).to.equal(0);
    });
  });

  describe("Standard Voting", function () {
    it("Should allow creating a standard proposal", async function () {
      const { governor, token, voter1 } = await loadFixture(deployGovernorFixture);

      const targets = [token.target];
      const values = [0];
      const calldatas = [token.interface.encodeFunctionData("transfer", [voter1.address, 100])];
      const description = "Proposal #1: Give me money";

      // Create proposal
      const tx = await governor.connect(voter1).proposeWithConfig(
        targets, values, calldatas, description, 0, 0 // 0 = Standard, 0 = default threshold
      );

      const receipt = await tx.wait();
      // Parse logs to find ProposalId (not easy in ethers v6 directly from receipt helper sometimes, but event is emitted)
      // We can also compute it.
      const proposalId = await governor.hashProposal(
        targets, values, calldatas, ethers.keccak256(ethers.toUtf8Bytes(description))
      );

      expect(await governor.state(proposalId)).to.equal(0); // Pending
    });

    it("Should tally votes correctly (1 token = 1 vote)", async function () {
      const { governor, token, voter1, voter2 } = await loadFixture(deployGovernorFixture);

      const targets = [token.target];
      const values = [0];
      const calldatas = [token.interface.encodeFunctionData("totalSupply", [])]; // Dummy call
      const description = "Standard Vote";

      await governor.connect(voter1).proposeWithConfig(
        targets, values, calldatas, description, 0, 0
      );

      const proposalId = await governor.hashProposal(
        targets, values, calldatas, ethers.keccak256(ethers.toUtf8Bytes(description))
      );

      // Wait for voting delay
      await time.increase(time.duration.seconds(100)); // Just increase time, but we need blocks.
      // Mining blocks is better for block-based governor.
      // Ethers v6/Hardhat helper?
      // Just mine a few blocks.
      // hardhat_mine
      await network.provider.send("hardhat_mine", ["0x2"]);

      // Cast Vote
      // Voter1 has 10k tokens.
      await governor.connect(voter1).castVote(proposalId, 1); // 1 = For

      const proposalVotes = await governor.proposalVotes(proposalId);
      // against, for, abstain
      expect(proposalVotes[1]).to.equal(ethers.parseEther("10000"));
    });
  });

  describe("Quadratic Voting", function () {
    it("Should tally votes using Square Root (Quadratic)", async function () {
      const { governor, token, voter1 } = await loadFixture(deployGovernorFixture);

      // Voter1 has 10,000 * 1e18 tokens.
      // Sqrt(10000 * 1e18) = Sqrt(10000) * Sqrt(1e18) = 100 * 1e9
      // Hardhat math might need handling.
      // 10000 * 10^18 = 10^22.
      // Sqrt(10^22) = 10^11.

      const targets = [token.target];
      const values = [0];
      const calldatas = [token.interface.encodeFunctionData("totalSupply", [])];
      const description = "Quadratic Vote";

      await governor.connect(voter1).proposeWithConfig(
        targets, values, calldatas, description, 1, 0 // 1 = Quadratic
      );

      const proposalId = await governor.hashProposal(
        targets, values, calldatas, ethers.keccak256(ethers.toUtf8Bytes(description))
      );

      await network.provider.send("hardhat_mine", ["0x2"]);

      await governor.connect(voter1).castVote(proposalId, 1); // For

      const proposalVotes = await governor.proposalVotes(proposalId);

      // Expected votes: Sqrt(10000 * 1e18) = 100 * 1e9 = 100,000,000,000
      const expectedVotes = BigInt(Math.sqrt(Number(ethers.parseEther("10000"))));
      // JS Math.sqrt on BigInt string might lose precision if converted to Number first.
      // 10000 ETH is 10000 * 10^18. Number.MAX_SAFE_INTEGER is 9 * 10^15.
      // So verify with BigInt logic or hardcoded expectation.
      // 10000e18 is 1e22. Sqrt is 1e11.

      expect(proposalVotes[1]).to.equal(100000000000n); // 100 * 1e9
    });
  });
});
