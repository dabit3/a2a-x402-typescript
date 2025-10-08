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

import { randomUUID } from "crypto";
import {
  Task,
  Message,
  PaymentStatus,
  x402Metadata,
  x402PaymentRequiredResponse,
  PaymentPayload,
  SettleResponse,
  TaskState,
  TaskStatus,
  TextPart,
} from "../types/state";
import { logger } from "./logger";

/**
 * Parse payment payload from metadata
 */
function parsePaymentPayload(payloadData: any): PaymentPayload {
  return payloadData as PaymentPayload;
}

/**
 * Creates correlated payment submission message per spec
 */
export function createPaymentSubmissionMessage(
  taskId: string,
  paymentPayload: PaymentPayload,
  text: string = "Payment authorization provided",
  messageId?: string
): Message {
  const msgId = messageId || randomUUID();
  return {
    messageId: msgId,
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
    if (statusValue && Object.values(PaymentStatus).includes(statusValue)) {
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
    if (reqData) {
      try {
        return reqData as x402PaymentRequiredResponse;
      } catch {
        return null;
      }
    }
    return null;
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
        return parsePaymentPayload(payloadData);
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
    if (task.status) {
      task.status.state = TaskState.INPUT_REQUIRED;
    } else {
      task.status = { state: TaskState.INPUT_REQUIRED };
    }

    // Ensure task has a status message for metadata
    if (!task.status.message) {
      task.status.message = {
        messageId: `${task.id}-status`,
        role: "agent",
        parts: [{ kind: "text", text: "Payment is required for this service." }],
        metadata: {},
      };
    }

    // Ensure message has metadata
    if (!task.status.message.metadata) {
      task.status.message.metadata = {};
    }

    task.status.message.metadata[x402Utils.STATUS_KEY] =
      PaymentStatus.PAYMENT_REQUIRED;
    task.status.message.metadata[x402Utils.REQUIRED_KEY] = paymentRequired;

    return task;
  }

  recordPaymentVerified(task: Task): Task {
    // Ensure task has a status message for metadata
    if (!task.status.message) {
      task.status.message = {
        messageId: `${task.id}-status`,
        role: "agent",
        parts: [{ kind: "text", text: "Payment verification recorded." }],
        metadata: {},
      };
    }

    // Ensure message has metadata
    if (!task.status.message.metadata) {
      task.status.message.metadata = {};
    }

    task.status.message.metadata[x402Utils.STATUS_KEY] =
      PaymentStatus.PAYMENT_VERIFIED;

    return task;
  }

  recordPaymentSuccess(task: Task, settleResponse: SettleResponse): Task {
    // Ensure task has a status message for metadata
    if (!task.status.message) {
      task.status.message = {
        messageId: `${task.id}-status`,
        role: "agent",
        parts: [{ kind: "text", text: "Payment completed successfully." }],
        metadata: {},
      };
    }

    // Ensure message has metadata
    if (!task.status.message.metadata) {
      task.status.message.metadata = {};
    }

    task.status.message.metadata[x402Utils.STATUS_KEY] =
      PaymentStatus.PAYMENT_COMPLETED;

    // Append to receipts array
    if (!task.status.message.metadata[x402Utils.RECEIPTS_KEY]) {
      task.status.message.metadata[x402Utils.RECEIPTS_KEY] = [];
    }
    task.status.message.metadata[x402Utils.RECEIPTS_KEY].push(settleResponse);

    // Clean up intermediate data
    delete task.status.message.metadata[x402Utils.PAYLOAD_KEY];
    delete task.status.message.metadata[x402Utils.REQUIRED_KEY];

    return task;
  }

  recordPaymentFailure(
    task: Task,
    errorCode: string,
    settleResponse: SettleResponse
  ): Task {
    // Ensure task has a status message for metadata
    if (!task.status.message) {
      task.status.message = {
        messageId: `${task.id}-status`,
        role: "agent",
        parts: [{ kind: "text", text: "Payment failed." }],
        metadata: {},
      };
    }

    // Ensure message has metadata
    if (!task.status.message.metadata) {
      task.status.message.metadata = {};
    }

    task.status.message.metadata[x402Utils.STATUS_KEY] =
      PaymentStatus.PAYMENT_FAILED;
    task.status.message.metadata[x402Utils.ERROR_KEY] = errorCode;

    // Append to receipts array
    if (!task.status.message.metadata[x402Utils.RECEIPTS_KEY]) {
      task.status.message.metadata[x402Utils.RECEIPTS_KEY] = [];
    }
    task.status.message.metadata[x402Utils.RECEIPTS_KEY].push(settleResponse);

    // Clean up intermediate data
    delete task.status.message.metadata[x402Utils.PAYLOAD_KEY];

    return task;
  }

  getPaymentReceiptsFromMessage(message: Message): SettleResponse[] {
    if (!message?.metadata) {
      return [];
    }

    const receiptsData = message.metadata[x402Utils.RECEIPTS_KEY] || [];
    const receipts: SettleResponse[] = [];

    for (const receiptData of receiptsData) {
      try {
        receipts.push(receiptData as SettleResponse);
      } catch {
        continue;
      }
    }
    return receipts;
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
    // Ensure task has a status message for metadata
    if (!task.status.message) {
      task.status.message = {
        messageId: `${task.id}-status`,
        role: "agent",
        parts: [{ kind: "text", text: "Payment authorization provided" }],
        metadata: {},
      };
    }

    // Ensure message has metadata
    if (!task.status.message.metadata) {
      task.status.message.metadata = {};
    }

    task.status.message.metadata[x402Utils.STATUS_KEY] =
      PaymentStatus.PAYMENT_SUBMITTED;
    task.status.message.metadata[x402Utils.PAYLOAD_KEY] = paymentPayload;

    return task;
  }
}
