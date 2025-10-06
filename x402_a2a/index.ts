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
 * x402_a2a - x402 Payment Protocol Extension for A2A (TypeScript)
 */

// ===== Core x402 Protocol Types (from types) =====
export type {
  // State types
  PaymentStatus,
  SupportedNetworks,
  EIP712Domain,
  EIP3009Authorization,
  ExactPaymentPayload,
  PaymentPayload,
  PaymentRequirements,
  x402PaymentRequiredResponse,
  VerifyResponse,
  SettleResponse,
  // Config types
  TokenAmount,
  Price,
  x402ExtensionConfig,
  x402ServerConfig,
  // A2A types
  TextPart,
  Message,
  TaskStatus,
  Task,
  RequestContext,
  EventQueue,
  AgentExecutor,
  FacilitatorConfig,
  FacilitatorClient,
} from "./types";

export { x402Metadata, TaskState } from "./types/state";

// ===== Extension Constants =====
export { X402_EXTENSION_URI, DEFAULT_X402_EXTENSION_CONFIG } from "./types/config";
export { X402_EXTENSION } from "./extension";

// ===== Core Functions =====
export {
  // Merchant functions
  createPaymentRequirements,
  // Wallet functions
  processPayment,
  processPaymentRequired,
  // Protocol functions
  verifyPayment,
  settlePayment,
  // Facilitator
  DefaultFacilitatorClient,
  // State management
  x402Utils,
  createPaymentSubmissionMessage,
  extractTaskId,
  // Helper functions
  requirePayment,
  requirePaymentChoice,
  paidService,
  smartPaidService,
  createTieredPaymentOptions,
  checkPaymentContext,
  // Agent utilities
  getExtensionDeclaration,
  checkExtensionActivation,
  addExtensionActivationHeader,
  createX402AgentCard,
} from "./core";

export type { ExtensionDeclaration } from "./core/agent";

// ===== Error Types =====
export {
  x402Error,
  MessageError,
  ValidationError,
  PaymentError,
  StateError,
  x402PaymentRequiredException,
  x402ErrorCode,
  mapErrorToCode,
} from "./types/errors";

export type { PaymentRequiredExceptionOptions } from "./types/errors";

// ===== Optional Middleware =====
export {
  x402BaseExecutor,
  x402ServerExecutor,
  x402ClientExecutor,
} from "./executors";

// ===== Version =====
export const VERSION = "1.0.0";
