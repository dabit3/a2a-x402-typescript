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
 * Core protocol operations for x402 payment verification and settlement
 */

import {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
  FacilitatorClient,
} from "../types/state";
import { DefaultFacilitatorClient } from "./facilitator";

/**
 * Verify payment signature and requirements using facilitator
 * If no facilitator is provided, uses the default facilitator at https://x402.org/facilitator
 */
export async function verifyPayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  facilitatorClient?: FacilitatorClient
): Promise<VerifyResponse> {
  // Create default facilitator if none provided (matches Python behavior)
  const facilitator = facilitatorClient || new DefaultFacilitatorClient();
  return facilitator.verify(paymentPayload, paymentRequirements);
}

/**
 * Settle payment on blockchain using facilitator
 * If no facilitator is provided, uses the default facilitator at https://x402.org/facilitator
 */
export async function settlePayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  facilitatorClient?: FacilitatorClient
): Promise<SettleResponse> {
  // Create default facilitator if none provided (matches Python behavior)
  const facilitator = facilitatorClient || new DefaultFacilitatorClient();

  const settleResponse = await facilitator.settle(
    paymentPayload,
    paymentRequirements
  );

  // Convert to A2A-specific response format
  return {
    success: settleResponse.success,
    transaction: settleResponse.transaction,
    network: settleResponse.network || paymentRequirements.network,
    payer: settleResponse.payer,
    errorReason: settleResponse.errorReason,
  };
}
