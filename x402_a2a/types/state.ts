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
 * Payment state definitions, metadata keys, and state management types
 */

// Re-export TokenAmount from config
export { TokenAmount } from "./config";

export enum PaymentStatus {
  PAYMENT_REQUIRED = "payment-required",
  PAYMENT_SUBMITTED = "payment-submitted",
  PAYMENT_VERIFIED = "payment-verified",
  PAYMENT_REJECTED = "payment-rejected",
  PAYMENT_COMPLETED = "payment-completed",
  PAYMENT_FAILED = "payment-failed",
}

export class x402Metadata {
  static readonly STATUS_KEY = "x402.payment.status";
  static readonly REQUIRED_KEY = "x402.payment.required";
  static readonly PAYLOAD_KEY = "x402.payment.payload";
  static readonly RECEIPTS_KEY = "x402.payment.receipts";
  static readonly ERROR_KEY = "x402.payment.error";
}

export type SupportedNetworks = "base" | "base-sepolia" | "ethereum" | "polygon" | "polygon-amoy" | "ink";

// Core x402 Protocol Types (equivalent to x402.types in Python)
export interface EIP712Domain {
  name: string;
  version: string;
  chainId?: string;
  verifyingContract?: string;
}

export interface EIP3009Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
}

export interface ExactPaymentPayload {
  signature: string;
  authorization: EIP3009Authorization;
}

export interface PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: ExactPaymentPayload;
}

export interface PaymentRequirements {
  scheme: string;
  network: SupportedNetworks;
  asset: string;
  payTo: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  maxTimeoutSeconds: number;
  outputSchema?: any;
  extra?: Record<string, any>;
}

export interface x402PaymentRequiredResponse {
  x402Version: number;
  accepts: PaymentRequirements[];
  error?: string;
}

export interface VerifyResponse {
  isValid: boolean;
  payer?: string;
  invalidReason?: string;
}

export interface SettleResponse {
  success: boolean;
  transaction?: string;
  network: string;
  payer?: string;
  errorReason?: string;
}

// A2A Types (from adk-typescript)
export enum TaskState {
  SUBMITTED = "submitted",
  WORKING = "working",
  INPUT_REQUIRED = "input-required",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface TextPart {
  kind: "text";
  text: string;
}

export interface Message {
  messageId: string;
  taskId?: string;
  role: "user" | "agent";
  parts: TextPart[];
  metadata?: Record<string, any>;
}

export interface TaskStatus {
  state: TaskState;
  message?: Message;
}

export interface Task {
  id: string;
  contextId?: string;
  status: TaskStatus;
  metadata?: Record<string, any>;
  artifacts?: any[];
}

export interface RequestContext {
  taskId: string;
  contextId?: string;
  currentTask?: Task;
  message: Message;
}

export interface EventQueue {
  enqueueEvent(event: Task): Promise<void>;
}

export interface AgentExecutor {
  execute(context: RequestContext, eventQueue: EventQueue): Promise<void>;
}

// Facilitator Types
export interface FacilitatorConfig {
  url: string;
  apiKey?: string;
}

export interface FacilitatorClient {
  verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse>;
  settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse>;
}
