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
    const [hasWallet, setHasWallet] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [stateFilter, setStateFilter] = useState('All');

    useEffect(() => {
        const fetchProposals = async () => {
            if (typeof window.ethereum === 'undefined') {
                setHasWallet(false);
                setLoading(false);
                return;
            }
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
                setError('Could not read proposals from the configured Governor contract.');
            } finally {
                setLoading(false);
            }
        };

        fetchProposals();
    }, []);

    const visibleProposals = proposals.filter((proposal) => {
        const state = ProposalState[proposal.state] || 'Unknown';
        const matchesState = stateFilter === 'All' || state === stateFilter;
        const matchesQuery = `${proposal.description} ${proposal.proposer} ${proposal.id}`
            .toLowerCase()
            .includes(query.trim().toLowerCase());
        return matchesState && matchesQuery;
    });
    const activeCount = proposals.filter((proposal) => proposal.state === 1).length;
    const totalVotes = proposals.reduce(
        (sum, proposal) => sum + Number(proposal.forVotes) + Number(proposal.againstVotes) + Number(proposal.abstainVotes),
        0
    );

    return (
        <div className="governance-page min-h-screen pb-10">
            <Header />

            <main className="governance-main">
                <Delegate />
                <section className="governance-heading">
                    <div>
                        <p className="governance-kicker">On-chain governance / Proposal register</p>
                        <h2 className="text-3xl font-bold mb-2">Governance proposals</h2>
                        <p>Review the docket, compare vote direction, and open a proposal to cast a wallet-backed vote.</p>
                    </div>
                    <Link href="/create" className="btn btn-primary">
                        Create proposal <span aria-hidden="true">+</span>
                    </Link>
                </section>

                <section className="governance-stats" aria-label="Governance summary">
                    <div><span>Total proposals</span><strong>{proposals.length}</strong></div>
                    <div><span>Active votes</span><strong>{activeCount}</strong></div>
                    <div><span>Total votes cast</span><strong>{totalVotes.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong></div>
                    <div><span>Data source</span><strong className="governance-source">Governor contract</strong></div>
                </section>

                <section className="proposal-tools" aria-label="Filter proposals">
                    <label className="proposal-search">
                        <span>Search the docket</span>
                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, proposer, or proposal ID" />
                    </label>
                    <label className="proposal-state-filter">
                        <span>Status</span>
                        <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
                            <option>All</option>
                            {ProposalState.map((state) => <option key={state}>{state}</option>)}
                        </select>
                    </label>
                    <span className="proposal-result-count">{visibleProposals.length} shown</span>
                </section>

                {loading ? (
                    <div className="governance-message" role="status">Reading proposal events from the Governor contract...</div>
                ) : !hasWallet ? (
                    <div className="governance-message" role="status">
                        <h3>Connect a wallet to read on-chain proposals</h3>
                        <p>Install or enable an Ethereum wallet, then connect above. This page does not display fabricated votes.</p>
                    </div>
                ) : error ? (
                    <div className="governance-message governance-error" role="alert">
                        <h3>Governor data is unavailable</h3>
                        <p>{error} Check the selected network and contract address.</p>
                    </div>
                ) : proposals.length === 0 ? (
                    <div className="governance-message">
                        <h3>No proposals have been created</h3>
                        <p className="text-gray-400 mb-6">Be the first to create a proposal for the DAO.</p>
                        <Link href="/create" className="btn btn-secondary">Create Proposal</Link>
                    </div>
                ) : visibleProposals.length === 0 ? (
                    <div className="governance-message"><h3>No matching proposals</h3><p>Change the search or status filter to broaden the docket.</p></div>
                ) : (
                    <div className="grid gap-4">
                        {visibleProposals.map((p) => (
                            <div key={p.id} className="card proposal-card">
                                <div className="proposal-card-header">
                                    <div>
                                        <div className="proposal-badges">
                                            <span className={`badge ${StateColors[p.state] || 'badge-neutral'}`}>{ProposalState[p.state] || 'Unknown'}</span>
                                            {p.votingType === 1 && <span className="badge badge-neutral">Quadratic</span>}
                                            <span className="text-xs text-gray-500">ID: {p.id.substring(0, 8)}...</span>
                                        </div>
                                        <h3 className="text-xl font-semibold">{p.description}</h3>
                                    </div>
                                    <div className="proposal-proposer">
                                        <div>Proposer</div>
                                        <span>{shortenAddress(p.proposer)}</span>
                                    </div>
                                </div>

                                <div className="proposal-vote-panel">
                                    <div className="proposal-vote-labels">
                                        <span className="vote-for-label">For: {Number(p.forVotes).toFixed(2)}</span>
                                        <span className="vote-against-label">Against: {Number(p.againstVotes).toFixed(2)}</span>
                                        <span className="vote-abstain-label">Abstain: {Number(p.abstainVotes).toFixed(2)}</span>
                                    </div>
                                    <div className="proposal-vote-bar">
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
