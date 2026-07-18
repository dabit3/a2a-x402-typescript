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
 * Configuration types for x402_a2a
 */

export const X402_EXTENSION_URI = "https://github.com/google-a2a/a2a-x402/v0.1";

/**
 * Controls how strictly the executor treats verifyPayment's result before
 * running delegate (paid) work versus settling. See dabit3/a2a-x402-typescript#15
 * and the equivalent fix landed for the Python executor in
 * google-agentic-commerce/a2a-x402#145.
 *
 * - FORMAT_ONLY: verifyPayment only checks the payment payload's signature/
 *   structure and does NOT guarantee funds will actually settle. In this mode
 *   the executor settles the payment BEFORE running delegate.execute(), so
 *   delegate (potentially irreversible, paid) work never runs against a
 *   payment that could still fail to settle.
 * - SETTLEMENT_CHECK (default): preserves the executor's existing behavior —
 *   verify, then run delegate.execute(), then settle. Safe when delegate work
 *   is cheap/reversible, or when verifyPayment's implementation already
 *   confirms the payment is on-chain before returning isValid: true.
 */
export enum PaymentVerificationMode {
  FORMAT_ONLY = "format_only",
  SETTLEMENT_CHECK = "settlement_check",
}

export interface TokenAmount {
  value: string;
  asset: string;
  network: string;
}

export type Price = string | number | TokenAmount;

export interface x402ExtensionConfig {
  extensionUri?: string;
  version?: string;
  x402Version?: number;
  required?: boolean;
  paymentVerificationMode?: PaymentVerificationMode;
}

export const DEFAULT_X402_EXTENSION_CONFIG: x402ExtensionConfig = {
  extensionUri: X402_EXTENSION_URI,
  version: "0.1",
  x402Version: 1,
  required: true,
  paymentVerificationMode: PaymentVerificationMode.SETTLEMENT_CHECK,
};

export interface x402ServerConfig {
  price: Price;
  payToAddress: string;
  network?: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  resource?: string;
  assetAddress?: string;
}