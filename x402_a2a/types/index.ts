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
 * Types exports
 */

// Config types
export {
  X402_EXTENSION_URI,
  TokenAmount,
  Price,
  x402ExtensionConfig,
  DEFAULT_X402_EXTENSION_CONFIG,
  x402ServerConfig,
} from "./config";

// State types – A2A protocol types from @a2a-js/sdk
export type {
  Message,
  Task,
  TaskState,
  TaskStatus,
  TextPart,
  Part,
  AgentCard,
  AgentCapabilities,
  AgentSkill,
  AgentExtension,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  FilePart,
  DataPart,
  Artifact,
} from "./state";

// State types – x402-specific
export {
  TaskStateValues,
  PaymentStatus,
  x402Metadata,
} from "./state";

export type {
  SupportedNetworks,
  EIP712Domain,
  EIP3009Authorization,
  ExactPaymentPayload,
  PaymentPayload,
  PaymentRequirements,
  x402PaymentRequiredResponse,
  VerifyResponse,
  SettleResponse,
  // x402 execution types
  x402RequestContext,
  x402EventQueue,
  x402AgentExecutor,
  // Backward-compatible aliases
  RequestContext,
  EventQueue,
  AgentExecutor,
  // Facilitator types
  FacilitatorConfig,
  FacilitatorClient,
} from "./state";

// Error types
export {
  x402Error,
  MessageError,
  ValidationError,
  PaymentError,
  StateError,
  x402PaymentRequiredException,
  x402ErrorCode,
  mapErrorToCode,
} from "./errors";

export type {
  PaymentRequiredExceptionOptions,
} from "./errors";
