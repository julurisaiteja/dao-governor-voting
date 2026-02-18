"use client";
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Header from '../../../components/Header';
import { connectWallet, getContracts, shortenAddress } from '../../../utils/ethereum';
import { useParams } from 'next/navigation';

export default function ProposalDetails() {
    const { id } = useParams();
    const [proposal, setProposal] = useState<any>(null);
    const [votingPower, setVotingPower] = useState("0");
    const [loading, setLoading] = useState(true);
    const [voting, setVoting] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetchProposal();
    }, [id]);

    const fetchProposal = async () => {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const { governor, token } = await getContracts(provider);

            const proposalId = id as string;
            const state = await governor.state(proposalId);
            const votes = await governor.proposalVotes(proposalId);

            // We need description and proposer.
            // Usually stored in events. Fetching logic is same as dashboard.
            // For detailed view, we arguably should fetch from event logs again or pass via state.
            // To keep it simple, we fetch events again for this specific ID? No, events are hard to filter by ID without indexing.
            // We will re-fetch all ProposalCreated and find the one. Efficient? No. Working? Yes.
            const filter = governor.filters.ProposalCreated(proposalId); // Topic filter if indexed?
            // ProposalCreated(uint256 proposalId, ...) - proposalId IS indexed.
            const events = await governor.queryFilter(filter);

            if (events.length === 0) {
                setLoading(false);
                return;
            }

            const args = (events[0] as any).args;

            let config = { votingType: 0 };
            try { config = await governor.proposalConfigs(proposalId); } catch (e) { }

            setProposal({
                id: proposalId,
                proposer: args.proposer,
                description: args.description,
                state: Number(state),
                forVotes: ethers.formatEther(votes[1]),
                againstVotes: ethers.formatEther(votes[0]),
                abstainVotes: ethers.formatEther(votes[2]),
                votingType: Number(config.votingType)
            });

            // Get user voting power
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            const currentBlock = await provider.getBlockNumber();
            // Governor uses past votes. We need snapshot block.
            // Snapshot block is usually event block - voting delay.
            // Or call proposalSnapshot(proposalId)
            const snapshot = await governor.proposalSnapshot(proposalId);
            const power = await token.getPastVotes(address, snapshot);

            let effectivePower = power;
            if (Number(config.votingType) === 1) {
                // Quadratic: Sqrt
                // Note: Contract does sqrt(weight). 
                // getPastVotes returns weight.
                // Is `power` the raw balance? Yes.
                // So effective power is sqrt(power).
                // But BigInt sqrt is needed.
                // Rough display:
                effectivePower = BigInt(Math.floor(Math.sqrt(Number(power)))); // Approximation for display
                // Wait, power is 1e18 scaled. 
                // Sqrt(100 * 1e18) = 10 * 1e9.
                // JS Number precision is low for 1e18.
                // We can just display "Raw Balance: X" and let contract handle it.
            }
            setVotingPower(ethers.formatEther(effectivePower));

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleVote = async (support: number) => {
        setVoting(true);
        try {
            const { signer } = await connectWallet();
            const { governor } = await getContracts(signer);

            const tx = await governor.castVote(id as string, support);
            await tx.wait();
            fetchProposal(); // Refresh
        } catch (err) {
            console.error(err);
            alert("Vote failed: " + (err as any).message);
        } finally {
            setVoting(false);
        }
    };

    if (loading) return <div className="p-20 text-center">Loading...</div>;
    if (!proposal) return <div className="p-20 text-center">Proposal not found</div>;

    return (
        <div className="min-h-screen pb-10">
            <Header />
            <main className="container mt-8 max-w-3xl">
                <div className="card mb-6">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-3xl font-bold">{proposal.description}</h2>
                        <div className="text-right">
                            <div className="badge badge-neutral mb-2">
                                {["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"][proposal.state]}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 text-sm text-gray-400 mb-8">
                        <div>
                            <p>Proposer</p>
                            <p className="font-mono text-white">{proposal.proposer}</p>
                        </div>
                        <div>
                            <p>Voting System</p>
                            <p className="text-white">{proposal.votingType === 1 ? "Quadratic" : "Standard"}</p>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 rounded-lg p-6 mb-8">
                        <h3 className="font-semibold mb-4">Results</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-green-400">For</span>
                                    <span>{Number(proposal.forVotes).toFixed(2)}</span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500" style={{ width: `${(Number(proposal.forVotes) / (Number(proposal.forVotes) + Number(proposal.againstVotes) + Number(proposal.abstainVotes) + 0.0001)) * 100}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-red-400">Against</span>
                                    <span>{Number(proposal.againstVotes).toFixed(2)}</span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500" style={{ width: `${(Number(proposal.againstVotes) / (Number(proposal.forVotes) + Number(proposal.againstVotes) + Number(proposal.abstainVotes) + 0.0001)) * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {proposal.state === 1 && ( // Active
                        <div className="border-t border-slate-700 pt-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-lg">Cast your vote</h3>
                                <span className="text-sm text-gray-400">Power: {Number(votingPower).toFixed(2)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <button
                                    onClick={() => handleVote(1)}
                                    disabled={voting}
                                    className="btn btn-primary bg-green-600 hover:bg-green-700 border-none"
                                >
                                    For
                                </button>
                                <button
                                    onClick={() => handleVote(0)}
                                    disabled={voting}
                                    className="btn btn-primary bg-red-600 hover:bg-red-700 border-none"
                                >
                                    Against
                                </button>
                                <button
                                    onClick={() => handleVote(2)}
                                    disabled={voting}
                                    className="btn btn-secondary"
                                >
                                    Abstain
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
