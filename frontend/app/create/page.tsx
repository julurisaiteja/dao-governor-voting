"use client";
import { useState } from 'react';
import { ethers } from 'ethers';
import Header from '../../components/Header';
import { connectWallet, getContracts } from '../../utils/ethereum';
import { useRouter } from 'next/navigation';

export default function CreateProposal() {
    const router = useRouter();
    const [description, setDescription] = useState("");
    const [target, setTarget] = useState("");
    const [votingType, setVotingType] = useState(0); // 0: Standard, 1: Quadratic
    const [minTokens, setMinTokens] = useState(0);
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { provider, signer } = await connectWallet();
            const { governor, token } = await getContracts(signer);

            // Default target to token address if empty for testing
            const targetAddress = target || await token.getAddress();
            const value = 0;
            const calldata = token.interface.encodeFunctionData("totalSupply", []); // Dummy calldata

            const tx = await governor.proposeWithConfig(
                [targetAddress],
                [value],
                [calldata],
                description,
                votingType,
                minTokens
            );

            await tx.wait();
            router.push('/');
        } catch (err) {
            console.error(err);
            alert("Error creating proposal: " + (err as any).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen pb-10">
            <Header />
            <main className="container mt-8 max-w-2xl">
                <h2 className="text-3xl font-bold mb-6">Create Proposal</h2>

                <form onSubmit={handleCreate} className="card">
                    <div className="form-group">
                        <label className="label">Description</label>
                        <textarea
                            className="textarea h-32"
                            placeholder="What is this proposal about?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="form-group">
                            <label className="label">Target Address</label>
                            <input
                                className="input"
                                placeholder="0x..."
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">Defaults to Token Contract (Dummy Action)</p>
                        </div>

                        <div className="form-group">
                            <label className="label">Voting System</label>
                            <select
                                className="select"
                                value={votingType}
                                onChange={(e) => setVotingType(Number(e.target.value))}
                            >
                                <option value={0}>Standard (1 Token = 1 Vote)</option>
                                <option value={1}>Quadratic (Sqrt of Balance)</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="label">Min Tokens to Propose</label>
                        <input
                            type="number"
                            className="input"
                            value={minTokens}
                            onChange={(e) => setMinTokens(Number(e.target.value))}
                            min="0"
                        />
                        <p className="text-xs text-gray-500 mt-1">Set to 0 for default.</p>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary w-full"
                        disabled={loading}
                    >
                        {loading ? "Creating..." : "Submit Proposal"}
                    </button>
                </form>
            </main>
        </div>
    );
}
