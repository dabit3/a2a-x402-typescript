//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Algorand-specific utility functions
 */

import algosdk from "algosdk";
import { SupportedNetworks } from "../types/state";

export interface AlgorandNetworkConfig {
  algodUrl: string;
  algodToken: string;
  indexerUrl: string;
  indexerToken: string;
  genesisId: string;
  genesisHash: string;
}

/**
 * Network configurations for Algorand
 */
export const ALGORAND_NETWORKS: Record<string, AlgorandNetworkConfig> = {
  "algorand-mainnet": {
    algodUrl: "https://mainnet-api.algonode.cloud",
    algodToken: "",
    indexerUrl: "https://mainnet-idx.algonode.cloud",
    indexerToken: "",
    genesisId: "mainnet-v1.0",
    genesisHash: "wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=",
  },
  "algorand-testnet": {
    algodUrl: "https://testnet-api.algonode.cloud",
    algodToken: "",
    indexerUrl: "https://testnet-idx.algonode.cloud",
    indexerToken: "",
    genesisId: "testnet-v1.0",
    genesisHash: "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
  },
  "algorand-betanet": {
    algodUrl: "https://betanet-api.algonode.cloud",
    algodToken: "",
    indexerUrl: "https://betanet-idx.algonode.cloud",
    indexerToken: "",
    genesisId: "betanet-v1.0",
    genesisHash: "mFgazF+2uRS1tMiL9dsj01hJGySEmPN28B/TjjvpVW0=",
  },
};

/**
 * Check if a network is an Algorand network
 */
export function isAlgorandNetwork(network: SupportedNetworks): boolean {
  return network.startsWith("algorand-");
}

/**
 * Get Algod client for a given network
 */
export function getAlgodClient(network: SupportedNetworks): algosdk.Algodv2 {
  if (!isAlgorandNetwork(network)) {
    throw new Error(`Network ${network} is not an Algorand network`);
  }

  const config = ALGORAND_NETWORKS[network];
  if (!config) {
    throw new Error(`No configuration found for network ${network}`);
  }

  return new algosdk.Algodv2(config.algodToken, config.algodUrl, "");
}

/**
 * Get Indexer client for a given network
 */
export function getIndexerClient(network: SupportedNetworks): algosdk.Indexer {
  if (!isAlgorandNetwork(network)) {
    throw new Error(`Network ${network} is not an Algorand network`);
  }

  const config = ALGORAND_NETWORKS[network];
  if (!config) {
    throw new Error(`No configuration found for network ${network}`);
  }

  return new algosdk.Indexer(config.indexerToken, config.indexerUrl, "");
}

/**
 * Validate Algorand address
 */
export function isValidAlgorandAddress(address: string): boolean {
  try {
    return algosdk.isValidAddress(address);
  } catch {
    return false;
  }
}

/**
 * Get suggested transaction parameters
 */
export async function getSuggestedParams(
  network: SupportedNetworks
): Promise<algosdk.SuggestedParams> {
  const client = getAlgodClient(network);
  return await client.getTransactionParams().do();
}

/**
 * Wait for transaction confirmation
 */
export async function waitForConfirmation(
  network: SupportedNetworks,
  txId: string,
  timeout: number = 10
): Promise<any> {
  const client = getAlgodClient(network);
  const status = await client.status().do();
  const startRound = Number(status.lastRound);
  let currentRound = startRound;

  while (currentRound < startRound + timeout) {
    try {
      const pendingInfo = await client
        .pendingTransactionInformation(txId)
        .do();
      if (pendingInfo.confirmedRound !== null && pendingInfo.confirmedRound !== undefined && pendingInfo.confirmedRound > 0) {
        return pendingInfo;
      }
      if (pendingInfo.poolError != null && pendingInfo.poolError.length > 0) {
        throw new Error(`Transaction rejected: ${pendingInfo.poolError}`);
      }
    } catch (e: any) {
      if (e.message?.includes("not found")) {
        // Transaction not found yet, continue waiting
      } else {
        throw e;
      }
    }

    await client.statusAfterBlock(currentRound).do();
    currentRound++;
  }

  throw new Error(`Transaction not confirmed after ${timeout} rounds`);
}
