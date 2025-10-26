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
 * Payment requirements creation functions
 */

import {
  PaymentRequirements,
  SupportedNetworks,
} from "../types/state";
import { Price, TokenAmount } from "../types/config";

interface CreatePaymentRequirementsOptions {
  price: Price;
  payToAddress: string;
  resource: string;
  network?: SupportedNetworks;
  description?: string;
  mimeType?: string;
  scheme?: string;
  maxTimeoutSeconds?: number;
  outputSchema?: any;
  extra?: Record<string, any>;
}

const SUPPORTED_NETWORKS: readonly SupportedNetworks[] = [
  "base",
  "base-sepolia",
  "ethereum",
  "polygon",
  "polygon-amoy",
  "algorand-mainnet",
  "algorand-testnet",
  "algorand-betanet",
];

function assertSupportedNetwork(
  network: string
): asserts network is SupportedNetworks {
  if (!SUPPORTED_NETWORKS.includes(network as SupportedNetworks)) {
    throw new Error(
      `Unsupported network "${network}". Supported networks: ${SUPPORTED_NETWORKS.join(", ")}`
    );
  }
}

/**
 * Process price to atomic amount (similar to Python's process_price_to_atomic_amount)
 */
function processPriceToAtomicAmount(
  price: Price,
  network: SupportedNetworks
): { maxAmountRequired: string; assetAddress: string; eip712Domain?: any } {
  // Default USDC addresses/ASA IDs by network
  // For EVM chains: contract addresses
  // For Algorand: ASA IDs as strings
  const USDC_ADDRESSES: Record<SupportedNetworks, string> = {
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    "polygon-amoy": "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    "algorand-mainnet": "31566704", // USDC ASA ID on Algorand MainNet
    "algorand-testnet": "10458941", // USDC ASA ID on Algorand TestNet
    "algorand-betanet": "10458941", // USDC ASA ID on Algorand BetaNet (placeholder)
  };

  const isAlgorand = network.startsWith("algorand-");

  if (typeof price === "string") {
    // Money format (e.g., "$1.00" or "1.00")
    const priceStr = price.startsWith("$") ? price.slice(1) : price;
    const priceFloat = parseFloat(priceStr);
    // Convert to atomic units (USDC has 6 decimals)
    const atomicAmount = Math.floor(priceFloat * 1_000_000).toString();
    const assetAddress = USDC_ADDRESSES[network];

    return {
      maxAmountRequired: atomicAmount,
      assetAddress,
      // Only include EIP712Domain for EVM chains
      ...(isAlgorand ? {} : {
        eip712Domain: {
          name: "USDC",
          version: "2",
        },
      }),
    };
  } else if (typeof price === "number") {
    // Numeric value (treat as USD)
    const atomicAmount = Math.floor(price * 1_000_000).toString();
    const assetAddress = USDC_ADDRESSES[network];

    return {
      maxAmountRequired: atomicAmount,
      assetAddress,
      // Only include EIP712Domain for EVM chains
      ...(isAlgorand ? {} : {
        eip712Domain: {
          name: "USDC",
          version: "2",
        },
      }),
    };
  } else {
    // TokenAmount object
    return {
      maxAmountRequired: price.value,
      assetAddress: price.asset,
    };
  }
}

/**
 * Creates PaymentRequirements for A2A payment requests
 */
export async function createPaymentRequirements(
  options: CreatePaymentRequirementsOptions
): Promise<PaymentRequirements> {
  const {
    price,
    payToAddress,
    resource,
    network = "base",
    description = "",
    mimeType = "application/json",
    scheme = "exact",
    maxTimeoutSeconds = 600,
    outputSchema,
    extra,
  } = options;

  assertSupportedNetwork(network);

  const { maxAmountRequired, assetAddress, eip712Domain } =
    processPriceToAtomicAmount(price, network);

  return {
    scheme,
    network,
    asset: assetAddress,
    payTo: payToAddress,
    maxAmountRequired,
    resource,
    description,
    mimeType,
    maxTimeoutSeconds,
    outputSchema,
    extra: extra || eip712Domain,
  };
}
