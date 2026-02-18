"use client";
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { connectWallet, getContracts } from '../utils/ethereum';

export default function Delegate() {
    const [loading, setLoading] = useState(false);
    const [hasDelegated, setHasDelegated] = useState(true); // Assume true to hide by default
    const [balance, setBalance] = useState("0");

    useEffect(() => {
        checkDelegation();
    }, []);

    const checkDelegation = async () => {
        if (typeof window.ethereum === 'undefined') return;
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            const { token } = await getContracts(signer);

            const votes = await token.getVotes(address);
            const bal = await token.balanceOf(address);
            setBalance(ethers.formatEther(bal));

            // If balance > 0 and votes == 0, likely need delegation.
            // Unless they delegated to someone else?
            // getDelegates(address) -> if 0x0, then not delegated.
            const delegatee = await token.delegates(address);

            if (bal > BigInt(0) && delegatee === ethers.ZeroAddress) {
                setHasDelegated(false);
            } else {
                setHasDelegated(true);
            }
        } catch (e) { console.error(e); }
    };

    const handleDelegate = async () => {
        setLoading(true);
        try {
            const { signer } = await connectWallet();
            const address = await signer.getAddress();
            const { token } = await getContracts(signer);

            const tx = await token.delegate(address);
            await tx.wait();
            setHasDelegated(true);
            alert("Delegation successful!");
        } catch (err) {
            console.error(err);
            alert("Delegation failed");
        } finally {
            setLoading(false);
        }
    };

    if (hasDelegated) return null;

    return (
        <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 p-4 rounded-lg mb-8 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-blue-100">Action Required</h3>
                <p className="text-sm text-blue-200">
                    You have {Number(balance).toFixed(2)} tokens but no voting power. You must delegate to yourself to vote.
                </p>
            </div>
            <button
                onClick={handleDelegate}
                disabled={loading}
                className="btn btn-primary bg-blue-600 hover:bg-blue-500 border-none"
            >
                {loading ? "Delegating..." : "Delegate to Self"}
            </button>
        </div>
    );
}
