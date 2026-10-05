"use client";
import React, { useState, useEffect } from 'react';
import { connectWallet, shortenAddress } from '../utils/ethereum';

export default function Header() {
    const [account, setAccount] = useState<string | null>(null);

    const handleConnect = async () => {
        try {
            const { address } = await connectWallet();
            setAccount(address);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (typeof window !== 'undefined' && window.ethereum) {
            // Check if already connected
            window.ethereum.request({ method: 'eth_accounts' })
                .then((accounts: string[]) => {
                    if (accounts.length > 0) setAccount(accounts[0]);
                });

            window.ethereum.on('accountsChanged', (accounts: string[]) => {
                if (accounts.length > 0) setAccount(accounts[0]);
                else setAccount(null);
            });
        }
    }, []);

    return (
        <header className="governance-header">
            <div className="governance-header-inner">
                <div className="governance-brand">
                    <div className="governance-mark">D</div>
                    <h1>
                        DAO Governor
                    </h1>
                </div>

                <button
                    onClick={handleConnect}
                    className={`btn ${account ? "btn-secondary" : "btn-primary"}`}
                >
                    {account ? shortenAddress(account) : "Connect Wallet"}
                </button>
            </div>
        </header>
    );
}
