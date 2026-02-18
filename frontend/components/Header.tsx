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
        <header className="border-b border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-md sticky top-0 z-50">
            <div className="container flex items-center justify-between py-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg"></div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                        DAO Governor
                    </h1>
                </div>

                <button
                    onClick={handleConnect}
                    className={account ? "btn btn-secondary" : "btn btn-primary"}
                >
                    {account ? shortenAddress(account) : "Connect Wallet"}
                </button>
            </div>
        </header>
    );
}
