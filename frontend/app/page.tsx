"use client";
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Header from '../components/Header';
import Delegate from '../components/Delegate';
import { getContracts, shortenAddress } from '../utils/ethereum';
import Link from 'next/link';

// Types
interface Proposal {
    id: string;
    proposer: string;
    description: string;
    state: number; // 0:Pending, 1:Active, 2:Canceled, 3:Defeated, 4:Succeeded, 5:Queued, 6:Expired, 7:Executed
    forVotes: string;
    againstVotes: string;
    abstainVotes: string;
    votingType?: number; // 0: Standard, 1: Quadratic (if we can fetch it)
}

const ProposalState = [
    "Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"
];

const StateColors = [
    "badge-neutral", "badge-success", "badge-error", "badge-error", "badge-success", "badge-neutral", "badge-neutral", "badge-success"
];

export default function Home() {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProposals = async () => {
            if (typeof window.ethereum === 'undefined') return;
            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const { governor } = await getContracts(provider);

                // Fetch ProposalCreated events
                // Optimization: Use a smaller block range in production or The Graph
                const filter = governor.filters.ProposalCreated();
                const events = await governor.queryFilter(filter);
                // Note: queryFilter might be slow if querying from genesis. 
                // For local dev it's fine.

                const fetchedProposals = await Promise.all(events.map(async (event: any) => {
                    const { proposalId, proposer, description } = event.args;

                    // Fetch current state
                    const state = await governor.state(proposalId);

                    // Fetch votes
                    const votes = await governor.proposalVotes(proposalId);

                    // Try to fetch config if event exists?
                    // Or read public mapping proposalConfigs(proposalId)
                    let votingType = 0;
                    try {
                        const config = await governor.proposalConfigs(proposalId);
                        votingType = Number(config.votingType);
                    } catch (e) { console.warn("Old proposal or no config", e); }

                    return {
                        id: proposalId.toString(),
                        proposer,
                        description: description,
                        state: Number(state),
                        forVotes: ethers.formatEther(votes[1]), // Assuming 18 decimals
                        againstVotes: ethers.formatEther(votes[0]),
                        abstainVotes: ethers.formatEther(votes[2]),
                        votingType
                    };
                }));

                setProposals(fetchedProposals.reverse()); // Newest first
            } catch (err) {
                console.error("Error fetching proposals:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchProposals();
    }, []);

    return (
        <div className="min-h-screen pb-10">
            <Header />

            <main className="container mt-8">
                <Delegate />
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-3xl font-bold mb-2">Governance Proposals</h2>
                        <p className="text-gray-400">Participate in the DAO decision making process</p>
                    </div>
                    <Link href="/create" className="btn btn-primary">
                        + Create Proposal
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-gray-500">Loading proposals...</div>
                ) : proposals.length === 0 ? (
                    <div className="card text-center py-20">
                        <h3 className="text-xl font-medium mb-2">No Proposals Yet</h3>
                        <p className="text-gray-400 mb-6">Be the first to create a proposal for the DAO.</p>
                        <Link href="/create" className="btn btn-secondary">Create Proposal</Link>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {proposals.map((p) => (
                            <div key={p.id} className="card hover:border-indigo-500/30">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex gap-2 items-center mb-1">
                                            <span className={`badge ${StateColors[p.state]}`}>{ProposalState[p.state]}</span>
                                            {p.votingType === 1 && <span className="badge badge-neutral bg-purple-500/10 text-purple-400">Quadratic</span>}
                                            <span className="text-xs text-gray-500">ID: {p.id.substring(0, 8)}...</span>
                                        </div>
                                        <h3 className="text-xl font-semibold">{p.description}</h3>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-gray-400">Proposer</div>
                                        <div className="font-mono text-sm">{shortenAddress(p.proposer)}</div>
                                    </div>
                                </div>

                                <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-green-400 font-medium">For: {Number(p.forVotes).toFixed(2)}</span>
                                        <span className="text-red-400 font-medium">Against: {Number(p.againstVotes).toFixed(2)}</span>
                                        <span className="text-gray-400">Abstain: {Number(p.abstainVotes).toFixed(2)}</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                        {/* Visual Progress Bar logic */}
                                        <div className="bg-green-500" style={{ width: `${(Number(p.forVotes) / (Number(p.forVotes) + Number(p.againstVotes) + Number(p.abstainVotes) + 0.0001)) * 100}%` }}></div>
                                        <div className="bg-red-500" style={{ width: `${(Number(p.againstVotes) / (Number(p.forVotes) + Number(p.againstVotes) + Number(p.abstainVotes) + 0.0001)) * 100}%` }}></div>
                                        <div className="bg-gray-500" style={{ width: `${(Number(p.abstainVotes) / (Number(p.forVotes) + Number(p.againstVotes) + Number(p.abstainVotes) + 0.0001)) * 100}%` }}></div>
                                    </div>
                                </div>

                                <Link href={`/proposal/${p.id}`} className="btn btn-secondary w-full">
                                    View Details & Vote
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
