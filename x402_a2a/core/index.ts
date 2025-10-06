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
 * Core exports
 */

export { createPaymentRequirements } from "./merchant";
export { processPayment, processPaymentRequired } from "./wallet";
export { verifyPayment, settlePayment } from "./protocol";
export { DefaultFacilitatorClient } from "./facilitator";
export {
  x402Utils,
  createPaymentSubmissionMessage,
  extractTaskId,
} from "./utils";
export {
  requirePayment,
  requirePaymentChoice,
  paidService,
  smartPaidService,
  createTieredPaymentOptions,
  checkPaymentContext,
} from "./helpers";
export {
  getExtensionDeclaration,
  checkExtensionActivation,
  addExtensionActivationHeader,
  createX402AgentCard,
  ExtensionDeclaration,
} from "./agent";
