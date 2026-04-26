import React from "react";
import ReactDOM from "react-dom/client";
import {
  WagmiConfig,
  configureChains,
  createConfig,
  useAccount,
  useConnect,
  useDisconnect,
  useContractRead,
  useContractWrite,
  useWaitForTransaction,
  useBalance,
  useNetwork
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { jsonRpcProvider } from "wagmi/providers/jsonRpc";
import { InjectedConnector } from "wagmi/connectors/injected";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatEther, parseEther } from "viem";
import { vaultAbi } from "./abi/vaultAbi";
import "./styles.css";

const vaultAddress = (import.meta.env.VITE_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
const chainId = 11155111; // Sepolia chain ID
const rpcUrl = "https://ethereum-sepolia-rpc.publicnode.com";
const selectedChain = sepolia;

const { chains, publicClient, webSocketPublicClient } = configureChains([selectedChain], [
  jsonRpcProvider({
    rpc: () => ({
      http: rpcUrl
    })
  })
]);

const wagmiConfig = createConfig({
  autoConnect: false,
  connectors: [new InjectedConnector({ chains })],
  publicClient,
  webSocketPublicClient
});

const queryClient = new QueryClient();

function Dashboard() {
      // Withdraw and claim contract writes
      const withdrawWrite = useContractWrite({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: "withdraw"
      });

      const claimWrite = useContractWrite({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: "claimRewards"
      });
    // Diagnostics for debugging
    const [showDiagnostics, setShowDiagnostics] = React.useState(false);
  const [amount, setAmount] = React.useState("0.005");
  const [isOnline, setIsOnline] = React.useState<boolean>(navigator.onLine);
  const [hasInjectedWallet, setHasInjectedWallet] = React.useState<boolean>(false);
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const { connectAsync, connectors, isLoading: isConnecting, pendingConnector, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();

  React.useEffect(() => {
    setHasInjectedWallet(typeof (window as any).ethereum !== "undefined");

    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const hasVaultAddress = vaultAddress !== "0x0000000000000000000000000000000000000000";
  const canQueryChain = isOnline && hasVaultAddress;
  const isCorrectNetwork = !isConnected || chain?.id === selectedChain.id;

  const walletBalance = useBalance({
    address,
    watch: false,
    enabled: Boolean(address) && canQueryChain
  });

  const principalRead = useContractRead({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "principalOf",
    args: address ? [address] : undefined,
    enabled: Boolean(address) && canQueryChain,
    watch: false
  });

  const rewardRead = useContractRead({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "accruedRewardOf",
    args: address ? [address] : undefined,
    enabled: Boolean(address) && canQueryChain,
    watch: false
  });

  const depositWrite = useContractWrite({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "deposit",
    value: amount ? parseEther(amount) : undefined
  });

  const txReceipt = useWaitForTransaction({
    hash: depositWrite.data?.hash,
    // Increase polling interval to 2 seconds (default is 500ms)
    pollInterval: 2000,
    // Retry up to 10 times with exponential backoff if transaction is not found
    retry: (failureCount, error) => {
      // Only retry TransactionNotFoundError
      return (
        error?.name === "TransactionNotFoundError" &&
        failureCount < 10
      );
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000), // exponential backoff, max 10s
  });

  const isPending = depositWrite.isLoading || txReceipt.isLoading;
  const success = txReceipt.isSuccess;
  const hasError = depositWrite.isError || txReceipt.isError;

  const principalRaw = principalRead.data ? BigInt(principalRead.data as bigint) : 0n;
  const rewardsRaw = rewardRead.data ? BigInt(rewardRead.data as bigint) : 0n;
  const principal = Number(formatEther(principalRaw)).toFixed(6);
  const rewards = Number(formatEther(rewardsRaw)).toFixed(6);

  const amountValue = Number(amount);
  let depositDisabledReason = "";
  if (!isOnline) {
    depositDisabledReason = "You are offline.";
  } else if (!hasVaultAddress) {
    depositDisabledReason = "Vault address is not configured.";
  } else if (!isCorrectNetwork) {
    depositDisabledReason = `Switch wallet to ${selectedChain.name}.`;
  } else if (!Number.isFinite(amountValue) || amountValue <= 0) {
    depositDisabledReason = "Enter an amount greater than 0.";
  } else if (isPending) {
    depositDisabledReason = "Transaction is pending.";
  }
  const isDepositDisabled = depositDisabledReason.length > 0;

  return (
    <div className="page">
      <div className="glow" />
      <div className="card">
        <h1>ETH Deposit Vault</h1>
        <p className="subtitle">UUPS upgradeable vault dashboard with live on-chain reads.</p>

        <button className="secondary" style={{ float: 'right', marginBottom: 8 }} onClick={() => setShowDiagnostics(v => !v)}>
          {showDiagnostics ? 'Hide Diagnostics' : 'Show Diagnostics'}
        </button>

        {showDiagnostics && (
          <div style={{ background: '#222', color: '#fff', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
            <div><strong>Diagnostics (Sepolia Only)</strong></div>
            <div>Network: Sepolia (ID: 11155111)</div>
            <div>Vault Address: {vaultAddress}</div>
            <div>RPC URL: https://ethereum-sepolia-rpc.publicnode.com</div>
            <div>Deposit Tx Hash: {depositWrite.data?.hash || '-'}</div>
            <div>Tx Receipt Status: {txReceipt.status}</div>
            <div>Tx Receipt Error: {txReceipt.error?.name || '-'}</div>
            <div>Tx Receipt Error Message: {txReceipt.error?.message || '-'}</div>
          </div>
        )}

        {!isOnline && <p className="err">You are offline. Reconnect internet to query Sepolia RPC.</p>}
        {!hasVaultAddress && <p className="err">Set VITE_VAULT_ADDRESS in your frontend .env file.</p>}

        {!isConnected && !hasInjectedWallet && (
          <p className="err">MetaMask (or another injected wallet) is not detected in this browser.</p>
        )}

        {!isConnected && hasInjectedWallet && (
          <div className="stack">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={async () => {
                  try {
                    await connectAsync({ connector });
                  } catch {
                    // Connection errors are surfaced through wagmi state below.
                  }
                }}
                disabled={!connector.ready || isConnecting}
              >
                {isConnecting && pendingConnector?.id === connector.id ? "Connecting..." : `Connect ${connector.name}`}
              </button>
            ))}
          </div>
        )}

        {!isConnected && connectError && <p className="err">Wallet connect failed. Install/enable MetaMask and try again.</p>}
        {isConnected && !isCorrectNetwork && <p className="err">Switch wallet network to {selectedChain.name}.</p>}

        {isConnected && (
          <>
            <div className="metrics">
              <div>
                <span>Wallet</span>
                <strong>{walletBalance.data ? `${Number(walletBalance.data.formatted).toFixed(4)} ETH` : "-"}</strong>
              </div>
              <div>
                <span>Vault Balance</span>
                <strong>{principal} ETH</strong>
              </div>
              <div>
                <span>Potential Rewards</span>
                <strong>{rewards} ETH</strong>
              </div>
            </div>

            <label htmlFor="amount">Deposit Amount (ETH)</label>
            <input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.10" />


            <div className="stack">
              <button
                onClick={() => depositWrite.write?.()}
                disabled={isDepositDisabled}
              >
                {isPending ? "Pending..." : "Deposit"}
              </button>
              {principalRaw > 0n && (
                <button
                  onClick={() => {
                    const amt = prompt("Withdraw how much ETH?", principal);
                    if (!amt) return;
                    try {
                      const amtWei = parseEther(amt);
                      withdrawWrite.write?.({ args: [amtWei] });
                    } catch {
                      alert("Invalid amount");
                    }
                  }}
                  disabled={withdrawWrite.isLoading}
                >
                  {withdrawWrite.isLoading ? "Withdrawing..." : "Withdraw"}
                </button>
              )}
              {rewardsRaw > 0n && (
                <button
                  onClick={() => claimWrite.write?.()}
                  disabled={claimWrite.isLoading}
                >
                  {claimWrite.isLoading ? "Claiming..." : "Claim Rewards"}
                </button>
              )}
              <button className="secondary" onClick={() => disconnect()}>
                Disconnect
              </button>
            </div>

            {isDepositDisabled && <p className="err">Deposit disabled: {depositDisabledReason}</p>}

            {success && <p className="ok">Deposit confirmed on-chain.</p>}
            {hasError && (
              <p className="err">
                Transaction failed. Check wallet/network and retry.<br />
                {txReceipt.error?.name === 'TransactionNotFoundError' && (
                  <>
                    <span style={{ color: '#ffb347' }}>Transaction not found. Ensure you are on the correct network and RPC. See diagnostics above.</span>
                  </>
                )}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    </WagmiConfig>
  </React.StrictMode>
);
