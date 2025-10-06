// Copyright 2025 Google LLC
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
 * Payment signing and processing functions
 */

import { Wallet, TypedDataDomain, TypedDataField } from "ethers";
import {
  PaymentRequirements,
  x402PaymentRequiredResponse,
  PaymentPayload,
  ExactPaymentPayload,
  EIP3009Authorization,
} from "../types/state";

/**
 * Select payment requirement from accepts array (simple implementation)
 */
function selectPaymentRequirement(
  accepts: PaymentRequirements[],
  maxValue?: number
): PaymentRequirements {
  // Simple selection: return first requirement
  // In a real implementation, this would check maxValue and other criteria
  if (accepts.length === 0) {
    throw new Error("No payment requirements available");
  }

  if (maxValue !== undefined) {
    // Filter by max value
    const affordable = accepts.filter(
      (req) => parseInt(req.maxAmountRequired) <= maxValue
    );
    if (affordable.length === 0) {
      throw new Error("No affordable payment requirements found");
    }
    return affordable[0];
  }

  return accepts[0];
}

/**
 * Generate a random nonce (32 bytes as hex string)
 */
function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Process full payment required response using wallet signing logic
 */
export async function processPaymentRequired(
  paymentRequired: x402PaymentRequiredResponse,
  wallet: Wallet,
  maxValue?: number
): Promise<PaymentPayload> {
  const selectedRequirement = selectPaymentRequirement(
    paymentRequired.accepts,
    maxValue
  );
  return processPayment(selectedRequirement, wallet, maxValue);
}

/**
 * Create PaymentPayload using EIP-712 signing
 */
export async function processPayment(
  requirements: PaymentRequirements,
  wallet: Wallet,
  maxValue?: number
): Promise<PaymentPayload> {
  // Validate max value if provided
  if (maxValue !== undefined) {
    const requiredAmount = parseInt(requirements.maxAmountRequired);
    if (requiredAmount > maxValue) {
      throw new Error(
        `Payment amount ${requiredAmount} exceeds max value ${maxValue}`
      );
    }
  }

  // Generate timestamps (similar to Python implementation)
  const now = Math.floor(Date.now() / 1000);
  const validAfter = 0; // Allow immediate use
  const validBefore = now + requirements.maxTimeoutSeconds;

  // Generate nonce
  const nonce = generateNonce();

  // Create authorization object
  const authorization: EIP3009Authorization = {
    from: wallet.address,
    to: requirements.payTo,
    value: requirements.maxAmountRequired,
    validAfter,
    validBefore,
    nonce,
  };

  // EIP-712 domain
  const domain: TypedDataDomain = {
    name: requirements.extra?.name || "USDC",
    version: requirements.extra?.version || "2",
    chainId: getChainId(requirements.network),
    verifyingContract: requirements.asset,
  };

  // EIP-712 types for EIP-3009
  const types: Record<string, TypedDataField[]> = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  // Sign the authorization
  const signature = await wallet.signTypedData(domain, types, {
    from: authorization.from,
    to: authorization.to,
    value: authorization.value,
    validAfter: authorization.validAfter,
    validBefore: authorization.validBefore,
    nonce: authorization.nonce,
  });

  // Create exact payment payload
  const exactPayload: ExactPaymentPayload = {
    signature,
    authorization,
  };

  // Return complete payment payload
  return {
    x402Version: 1,
    scheme: requirements.scheme,
    network: requirements.network,
    payload: exactPayload,
  };
}

/**
 * Get chain ID for network
 */
function getChainId(network: string): number {
  const chainIds: Record<string, number> = {
    "base": 8453,
    "base-sepolia": 84532,
    "ethereum": 1,
    "polygon": 137,
  };
  return chainIds[network] || 84532;
}
