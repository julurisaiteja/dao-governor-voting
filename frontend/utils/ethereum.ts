import { ethers } from 'ethers';
import GovernorABI from '../abis/MyGovernor.json';
import TokenABI from '../abis/GovernanceToken.json';
// import TimelockABI from '../abis/GovernorTimelock.json';

// You would ideally fetch these from a config or env
// For local hardhat defaults:
const GOVERNOR_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
const TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
// Addresses need to be dynamic or updated after deployment!
// For now we placeholder them. We should make a script to write addresses too.

export const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            return { provider, signer, address: await signer.getAddress() };
        } catch (error) {
            console.error("User rejected connection", error);
            throw error;
        }
    } else {
        alert("Please install MetaMask!");
        throw new Error("No crypto wallet found");
    }
};

export const getContracts = async (signer: ethers.ContractRunner) => {
    const governor = new ethers.Contract(GOVERNOR_ADDRESS, GovernorABI, signer);
    const token = new ethers.Contract(TOKEN_ADDRESS, TokenABI, signer);

    return { governor, token };
};

export const shortenAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};
