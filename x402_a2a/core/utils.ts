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
 * State management utilities for x402 protocol
 */

import { randomUUID } from "node:crypto";
import type { Message, Task } from "@a2a-js/sdk";
import {
  PaymentStatus,
  x402Metadata,
  x402PaymentRequiredResponse,
  PaymentPayload,
  SettleResponse,
} from "../types/state";
import { logger } from "./logger";

/**
 * Creates correlated payment submission message per spec
 */
export function createPaymentSubmissionMessage(
  taskId: string,
  paymentPayload: PaymentPayload,
  text: string = "Payment authorization provided",
  messageId?: string
): Message {
  return {
    kind: "message",
    messageId: messageId || randomUUID(),
    taskId,
    role: "user",
    parts: [{ kind: "text", text }],
    metadata: {
      [x402Metadata.STATUS_KEY]: PaymentStatus.PAYMENT_SUBMITTED,
      [x402Metadata.PAYLOAD_KEY]: paymentPayload,
    },
  };
}

/**
 * Extracts task ID for correlation from payment message
 */
export function extractTaskId(message: Message): string | undefined {
  return message.taskId;
}

/**
 * Ensures the task has a status message with a metadata object, and returns
 * that metadata object.
 */
function ensureStatusMessageMetadata(
  task: Task,
  defaultText: string
): Record<string, unknown> {
  if (!task.status.message) {
    task.status.message = {
      kind: "message",
      messageId: `${task.id}-status`,
      taskId: task.id,
      contextId: task.contextId,
      role: "agent",
      parts: [{ kind: "text", text: defaultText }],
      metadata: {},
    };
  }

  if (!task.status.message.metadata) {
    task.status.message.metadata = {};
  }

  return task.status.message.metadata;
}

/**
 * Core utilities for x402 protocol state management
 */
export class x402Utils {
  static readonly STATUS_KEY = x402Metadata.STATUS_KEY;
  static readonly REQUIRED_KEY = x402Metadata.REQUIRED_KEY;
  static readonly PAYLOAD_KEY = x402Metadata.PAYLOAD_KEY;
  static readonly RECEIPTS_KEY = x402Metadata.RECEIPTS_KEY;
  static readonly ERROR_KEY = x402Metadata.ERROR_KEY;

  getPaymentStatusFromMessage(message: Message): PaymentStatus | null {
    if (!message?.metadata) {
      return null;
    }

    const statusValue = message.metadata[x402Utils.STATUS_KEY];
    if (
      typeof statusValue === "string" &&
      (Object.values(PaymentStatus) as string[]).includes(statusValue)
    ) {
      return statusValue as PaymentStatus;
    }
    return null;
  }

  getPaymentStatusFromTask(task: Task): PaymentStatus | null {
    if (!task?.status?.message) {
      return null;
    }
    return this.getPaymentStatusFromMessage(task.status.message);
  }

  getPaymentStatus(task: Task): PaymentStatus | null {
    return this.getPaymentStatusFromTask(task);
  }

  getPaymentRequirementsFromMessage(
    message: Message
  ): x402PaymentRequiredResponse | null {
    if (!message?.metadata) {
      return null;
    }

    const reqData = message.metadata[x402Utils.REQUIRED_KEY];
    return reqData ? (reqData as x402PaymentRequiredResponse) : null;
  }

  getPaymentRequirementsFromTask(
    task: Task
  ): x402PaymentRequiredResponse | null {
    if (!task?.status?.message) {
      return null;
    }
    return this.getPaymentRequirementsFromMessage(task.status.message);
  }

  getPaymentRequirements(task: Task): x402PaymentRequiredResponse | null {
    return this.getPaymentRequirementsFromTask(task);
  }

  getPaymentPayloadFromMessage(message: Message): PaymentPayload | null {
    if (!message?.metadata) {
      return null;
    }

    const payloadData = message.metadata[x402Utils.PAYLOAD_KEY];
    if (payloadData) {
      try {
        return payloadData as PaymentPayload;
      } catch (error) {
        logger.error("Failed to parse payment payload:", error);
        return null;
      }
    }
    return null;
  }

  getPaymentPayloadFromTask(task: Task): PaymentPayload | null {
    if (!task?.status?.message) {
      return null;
    }
    return this.getPaymentPayloadFromMessage(task.status.message);
  }

  getPaymentPayload(task: Task): PaymentPayload | null {
    return this.getPaymentPayloadFromTask(task);
  }

  createPaymentRequiredTask(
    task: Task,
    paymentRequired: x402PaymentRequiredResponse
  ): Task {
    // Set task status to input-required as per A2A spec
    task.status.state = "input-required";

    const metadata = ensureStatusMessageMetadata(
      task,
      "Payment is required for this service."
    );

    metadata[x402Utils.STATUS_KEY] = PaymentStatus.PAYMENT_REQUIRED;
    metadata[x402Utils.REQUIRED_KEY] = paymentRequired;

    return task;
  }

  recordPaymentVerified(task: Task): Task {
    const metadata = ensureStatusMessageMetadata(
      task,
      "Payment verification recorded."
    );

    metadata[x402Utils.STATUS_KEY] = PaymentStatus.PAYMENT_VERIFIED;

    return task;
  }

  recordPaymentSuccess(task: Task, settleResponse: SettleResponse): Task {
    const metadata = ensureStatusMessageMetadata(
      task,
      "Payment completed successfully."
    );

    metadata[x402Utils.STATUS_KEY] = PaymentStatus.PAYMENT_COMPLETED;

    // Append to receipts array
    const receipts = (metadata[x402Utils.RECEIPTS_KEY] as SettleResponse[]) || [];
    receipts.push(settleResponse);
    metadata[x402Utils.RECEIPTS_KEY] = receipts;

    // Clean up intermediate data
    delete metadata[x402Utils.PAYLOAD_KEY];
    delete metadata[x402Utils.REQUIRED_KEY];

    return task;
  }

  recordPaymentFailure(
    task: Task,
    errorCode: string,
    settleResponse: SettleResponse
  ): Task {
    // Per AP2/A2A guidance, keep the task in input-required so the client can retry
    task.status.state = "input-required";

    const metadata = ensureStatusMessageMetadata(task, "Payment failed.");

    metadata[x402Utils.STATUS_KEY] = PaymentStatus.PAYMENT_FAILED;
    metadata[x402Utils.ERROR_KEY] = errorCode;

    // Append to receipts array
    const receipts = (metadata[x402Utils.RECEIPTS_KEY] as SettleResponse[]) || [];
    receipts.push(settleResponse);
    metadata[x402Utils.RECEIPTS_KEY] = receipts;

    // Clean up intermediate data
    delete metadata[x402Utils.PAYLOAD_KEY];

    return task;
  }

  getPaymentReceiptsFromMessage(message: Message): SettleResponse[] {
    if (!message?.metadata) {
      return [];
    }

    const receiptsData = message.metadata[x402Utils.RECEIPTS_KEY];
    if (!Array.isArray(receiptsData)) {
      return [];
    }
    return receiptsData as SettleResponse[];
  }

  getPaymentReceiptsFromTask(task: Task): SettleResponse[] {
    if (!task?.status?.message) {
      return [];
    }
    return this.getPaymentReceiptsFromMessage(task.status.message);
  }

  getPaymentReceipts(task: Task): SettleResponse[] {
    return this.getPaymentReceiptsFromTask(task);
  }

  getLatestReceipt(task: Task): SettleResponse | null {
    const receipts = this.getPaymentReceipts(task);
    return receipts.length > 0 ? receipts[receipts.length - 1] : null;
  }

  recordPaymentSubmission(task: Task, paymentPayload: PaymentPayload): Task {
    const metadata = ensureStatusMessageMetadata(
      task,
      "Payment authorization provided"
    );

    metadata[x402Utils.STATUS_KEY] = PaymentStatus.PAYMENT_SUBMITTED;
    metadata[x402Utils.PAYLOAD_KEY] = paymentPayload;

    return task;
  }
}
