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
  network?: string;
  description?: string;
  mimeType?: string;
  scheme?: string;
  maxTimeoutSeconds?: number;
  outputSchema?: any;
  extra?: Record<string, any>;
}

/**
 * Process price to atomic amount (similar to Python's process_price_to_atomic_amount)
 */
function processPriceToAtomicAmount(
  price: Price,
  network: string
): { maxAmountRequired: string; assetAddress: string; eip712Domain?: any } {
  // Default USDC addresses by network
  const USDC_ADDRESSES: Record<string, string> = {
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    polygon: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  };

  if (typeof price === "string") {
    // Money format (e.g., "$1.00" or "1.00")
    const priceStr = price.startsWith("$") ? price.slice(1) : price;
    const priceFloat = parseFloat(priceStr);
    // Convert to atomic units (USDC has 6 decimals)
    const atomicAmount = Math.floor(priceFloat * 1_000_000).toString();
    const assetAddress =
      USDC_ADDRESSES[network] || USDC_ADDRESSES["base-sepolia"];

    return {
      maxAmountRequired: atomicAmount,
      assetAddress,
      eip712Domain: {
        name: "USDC",
        version: "2",
      },
    };
  } else if (typeof price === "number") {
    // Numeric value (treat as USD)
    const atomicAmount = Math.floor(price * 1_000_000).toString();
    const assetAddress =
      USDC_ADDRESSES[network] || USDC_ADDRESSES["base-sepolia"];

    return {
      maxAmountRequired: atomicAmount,
      assetAddress,
      eip712Domain: {
        name: "USDC",
        version: "2",
      },
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

  const { maxAmountRequired, assetAddress, eip712Domain } =
    processPriceToAtomicAmount(price, network);

  return {
    scheme,
    network: network as SupportedNetworks,
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
