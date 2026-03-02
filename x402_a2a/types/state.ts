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
 * Payment state definitions, metadata keys, and state management types.
 *
 * A2A protocol types (Message, Task, TaskState, TaskStatus, TextPart, Part,
 * AgentCard) are now sourced from the official @a2a-js/sdk package (v0.3.x,
 * implementing A2A Protocol Specification v0.3.0).
 */

// Re-export TokenAmount from config
export { TokenAmount } from "./config";

// ===== Official A2A Protocol Types from @a2a-js/sdk =====
import type {
  Message as A2AMessage,
  Task as A2ATask,
  TaskState as A2ATaskState,
  TaskStatus as A2ATaskStatus,
  TextPart as A2ATextPart,
  Part as A2APart,
  AgentCard as A2AAgentCard,
  AgentCapabilities as A2AAgentCapabilities,
  AgentSkill as A2AAgentSkill,
  AgentExtension as A2AAgentExtension,
  TaskStatusUpdateEvent as A2ATaskStatusUpdateEvent,
  TaskArtifactUpdateEvent as A2ATaskArtifactUpdateEvent,
  FilePart as A2AFilePart,
  DataPart as A2ADataPart,
  Artifact as A2AArtifact,
} from "@a2a-js/sdk";

export type Message = A2AMessage;
export type Task = A2ATask;
export type TaskState = A2ATaskState;
export type TaskStatus = A2ATaskStatus;
export type TextPart = A2ATextPart;
export type Part = A2APart;
export type AgentCard = A2AAgentCard;
export type AgentCapabilities = A2AAgentCapabilities;
export type AgentSkill = A2AAgentSkill;
export type AgentExtension = A2AAgentExtension;
export type TaskStatusUpdateEvent = A2ATaskStatusUpdateEvent;
export type TaskArtifactUpdateEvent = A2ATaskArtifactUpdateEvent;
export type FilePart = A2AFilePart;
export type DataPart = A2ADataPart;
export type Artifact = A2AArtifact;

// ===== Backward-compatible TaskState constants =====
// The official SDK defines TaskState as a string literal union type.
// This object provides named constants for backward compatibility with
// code that used the old enum pattern (e.g. TaskStateValues.SUBMITTED).
export const TaskStateValues = {
  SUBMITTED: "submitted" as const,
  WORKING: "working" as const,
  INPUT_REQUIRED: "input-required" as const,
  COMPLETED: "completed" as const,
  CANCELED: "canceled" as const,
  FAILED: "failed" as const,
  REJECTED: "rejected" as const,
  AUTH_REQUIRED: "auth-required" as const,
  UNKNOWN: "unknown" as const,
};

// ===== x402 Payment-Specific Types =====

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

export type SupportedNetworks = "base" | "base-sepolia" | "ethereum" | "polygon" | "polygon-amoy";

// Core x402 Protocol Types (equivalent to x402.types in Python)
export interface EIP712Domain {
  name: string;
  version: string;
  chainId?: number;
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

// ===== x402 Execution Types =====
// These are x402-specific execution interfaces used by the x402 executor
// layer. They are intentionally separate from the @a2a-js/sdk server types
// (AgentExecutor, RequestContext, ExecutionEventBus) to maintain the x402
// payment middleware pattern.

export interface x402RequestContext {
  taskId: string;
  contextId?: string;
  currentTask?: Task;
  message: Message;
}

export interface x402EventQueue {
  enqueueEvent(event: Task): Promise<void>;
}

export interface x402AgentExecutor {
  execute(context: x402RequestContext, eventQueue: x402EventQueue): Promise<void>;
}

// Backward-compatible aliases
/** @deprecated Use x402RequestContext instead */
export type RequestContext = x402RequestContext;
/** @deprecated Use x402EventQueue instead */
export type EventQueue = x402EventQueue;
/** @deprecated Use x402AgentExecutor instead */
export type AgentExecutor = x402AgentExecutor;

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
