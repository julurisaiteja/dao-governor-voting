// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract MyGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    enum VotingType {
        Standard,
        Quadratic
    }

    struct ProposalConfig {
        VotingType votingType;
        uint256 minTokensToPropose;
    }

    mapping(uint256 => ProposalConfig) public proposalConfigs;
    uint256 public immutable defaultMinTokensToPropose;

    event ProposalCreatedWithType(
        uint256 indexed proposalId,
        VotingType votingType,
        uint256 minTokensToPropose
    );

    constructor(
        IVotes _token,
        TimelockController _timelock,
        uint48 _votingDelay,
        uint32 _votingPeriod,
        uint256 _quorumPercent,
        uint256 _defaultMinTokensToPropose
    )
        Governor("MyGovernor")
        GovernorSettings(_votingDelay, _votingPeriod, 0)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(_quorumPercent)
        GovernorTimelockControl(_timelock)
    {
        defaultMinTokensToPropose = _defaultMinTokensToPropose;
    }

    // --- Proposal creation with voting type and min threshold ---

    function proposeWithConfig(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        VotingType votingType,
        uint256 minTokensToPropose
    ) public returns (uint256) {
        uint256 threshold = minTokensToPropose == 0
            ? defaultMinTokensToPropose
            : minTokensToPropose;

        uint256 currentVotes = getVotes(_msgSender(), clock() - 1);

        require(
            currentVotes >= threshold,
            "MyGovernor: insufficient votes to propose"
        );

        uint256 proposalId = super.propose(targets, values, calldatas, description);

        proposalConfigs[proposalId] = ProposalConfig({
            votingType: votingType,
            minTokensToPropose: threshold
        });

        emit ProposalCreatedWithType(proposalId, votingType, threshold);

        return proposalId;
    }

    // Standard propose disabled to force config usage
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor) returns (uint256) {
        // Technically this override is valid, but we want to prevent its usage
        // calling super.propose would work, but we assume the user WANTS to enforce `proposeWithConfig`.
        // However, overriding `propose` is tricky if you want to call `super.propose` inside `proposeWithConfig`.
        // `proposeWithConfig` calls `super.propose`.
        // If we revert here, standard tooling (like Tally) might fail if they call `propose`.
        // For this task, "Governance contract must enforce...", we'll revert.
        // BUT wait, `super.propose` in `proposeWithConfig` calls `_propose`.
        // This function `propose` is the public entry point.
        // Reverting it is fine.
        revert("Use proposeWithConfig");
    }

    // --- Voting logic ---

    function _countVote(
        uint256 proposalId,
        address account,
        uint8 support,
        uint256 weight,
        bytes memory params
    ) internal override(Governor, GovernorCountingSimple) returns (uint256) {
        ProposalConfig memory cfg = proposalConfigs[proposalId];

        if (cfg.votingType == VotingType.Quadratic) {
            // Quadratic Voting: Vote Weight = Sqrt(Token Balance)
            uint256 votes = uint256(Math.sqrt(weight));
            
            // In a real QV system with token spending:
            // cost = votes^2
            // Since we can't burn via snapshot, we simulate QV power distribution.
            // 81 tokens -> 9 votes.
            
            return super._countVote(proposalId, account, support, votes, params);
        } else {
            return super._countVote(proposalId, account, support, weight, params);
        }
    }

    // --- Required overrides ---

    function quorum(uint256 blockNumber)
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function votingDelay()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return 0;
    }

    function _queueOperations(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(Governor, GovernorTimelockControl)
        returns (uint48)
    {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(Governor, GovernorTimelockControl)
    {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(Governor, GovernorTimelockControl)
        returns (uint256)
    {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }
    
    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }
}
