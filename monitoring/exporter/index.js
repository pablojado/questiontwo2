import express from "express";
import { ethers } from "ethers";
import client from "prom-client";

const RPC_URL = process.env.RPC_URL || "http://localhost:8545";
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "0x0000000000000000000000000000000000000000";

const VAULT_ABI = [
  "function totalEthLocked() view returns (uint256)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const telGauge = new client.Gauge({
  name: "vault_total_eth_locked",
  help: "Total ETH locked in vault"
});

const txSuccessGauge = new client.Gauge({
  name: "vault_tx_success_rate",
  help: "Recent transaction success ratio in latest block"
});

registry.registerMetric(telGauge);
registry.registerMetric(txSuccessGauge);

async function refreshMetrics() {
  try {
    if (VAULT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      const tel = await vault.totalEthLocked();
      telGauge.set(Number(ethers.formatEther(tel)));
    } else {
      telGauge.set(0);
    }

    const latest = await provider.getBlock("latest", true);
    const txs = latest?.prefetchedTransactions || [];

    if (txs.length === 0) {
      txSuccessGauge.set(1);
      return;
    }

    let success = 0;
    for (const tx of txs) {
      const receipt = await provider.getTransactionReceipt(tx.hash);
      if (receipt && receipt.status === 1) {
        success += 1;
      }
    }

    txSuccessGauge.set(success / txs.length);
  } catch (error) {
    console.error("metric refresh error", error.message);
  }
}

setInterval(refreshMetrics, 5000);
refreshMetrics();

const app = express();
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});

app.listen(9464, "0.0.0.0", () => {
  console.log("Exporter listening on 9464");
});
