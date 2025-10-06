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
 * Server-side executor for merchant implementations
 */

import { x402BaseExecutor } from "./base";
import {
  AgentExecutor,
  RequestContext,
  EventQueue,
  PaymentStatus,
  PaymentRequirements,
  SettleResponse,
  Task,
  TaskStatus,
  TaskState,
  x402PaymentRequiredResponse,
  VerifyResponse,
  PaymentPayload,
} from "../types/state";
import { x402ExtensionConfig } from "../types/config";
import {
  x402PaymentRequiredException,
  x402ErrorCode,
} from "../types/errors";
import { logger } from "../core/logger";

export abstract class x402ServerExecutor extends x402BaseExecutor {
  // Class-level store to persist across requests for a single server instance
  private static _paymentRequirementsStore: Map<
    string,
    PaymentRequirements[]
  > = new Map();

  constructor(delegate: AgentExecutor, config?: Partial<x402ExtensionConfig>) {
    super(delegate, config);
  }

  /**
   * Verifies the payment with a facilitator
   */
  abstract verifyPayment(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse>;

  /**
   * Settles the payment with a facilitator
   */
  abstract settlePayment(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse>;

  async execute(context: RequestContext, eventQueue: EventQueue): Promise<void> {
    // Check if this is a payment submission
    const taskStatus = this.utils.getPaymentStatusFromTask(context.currentTask!);
    const messageStatus = this.utils.getPaymentStatusFromMessage(context.message);

    if (
      taskStatus === PaymentStatus.PAYMENT_SUBMITTED ||
      messageStatus === PaymentStatus.PAYMENT_SUBMITTED
    ) {
      return this._processPaidRequest(context, eventQueue);
    }

    // Try to execute delegate - catch payment exceptions
    try {
      return await this._delegate.execute(context, eventQueue);
    } catch (error) {
      if (error instanceof x402PaymentRequiredException) {
        await this._handlePaymentRequiredException(error, context, eventQueue);
        return;
      }
      throw error;
    }
  }

  private async _processPaidRequest(
    context: RequestContext,
    eventQueue: EventQueue
  ): Promise<void> {
    logger.log("Starting payment processing...");
    const task = context.currentTask;
    if (!task) {
      logger.error("Task not found in context during payment processing.");
      throw new Error("Task not found in context");
    }

    logger.log(
      `✅ Received payment payload. Beginning verification for task: ${task.id}`
    );

    const paymentPayload =
      this.utils.getPaymentPayload(task) ||
      this.utils.getPaymentPayloadFromMessage(context.message);

    if (!paymentPayload) {
      logger.warn(
        "Payment payload missing from both task and message metadata."
      );
      return this._failPayment(
        task,
        x402ErrorCode.INVALID_SIGNATURE,
        "Missing payment data",
        eventQueue
      );
    }

    logger.log(`Retrieved payment payload: ${JSON.stringify(paymentPayload, null, 2)}`);

    const paymentRequirements = this._extractPaymentRequirementsFromContext(
      task,
      context
    );

    if (!paymentRequirements) {
      logger.warn("Payment requirements missing from context.");
      return this._failPayment(
        task,
        x402ErrorCode.INVALID_SIGNATURE,
        "Missing payment requirements",
        eventQueue
      );
    }

    logger.log(
      `Retrieved payment requirements: ${JSON.stringify(paymentRequirements, null, 2)}`
    );

    try {
      logger.log("Calling verifyPayment...");
      const verifyResponse = await this.verifyPayment(
        paymentPayload,
        paymentRequirements
      );

      logger.log(`Verification response: ${JSON.stringify(verifyResponse, null, 2)}`);

      if (!verifyResponse.isValid) {
        logger.warn(
          `Payment verification failed: ${verifyResponse.invalidReason}`
        );
        return this._failPayment(
          task,
          x402ErrorCode.INVALID_SIGNATURE,
          verifyResponse.invalidReason || "Invalid payment",
          eventQueue
        );
      }
    } catch (error) {
      logger.error("Exception during payment verification:", error);
      return this._failPayment(
        task,
        x402ErrorCode.INVALID_SIGNATURE,
        `Verification failed: ${error}`,
        eventQueue
      );
    }

    logger.log("Payment verified successfully. Recording and updating task.");
    this.utils.recordPaymentVerified(task);
    await eventQueue.enqueueEvent(task);

    // Add verification status to task metadata
    if (!task.metadata) {
      task.metadata = {};
    }
    task.metadata["x402_payment_verified"] = true;

    try {
      logger.log("Executing delegate agent...");
      await this._delegate.execute(context, eventQueue);
      logger.log("Delegate agent execution finished.");
    } catch (error) {
      logger.error("Exception during delegate execution:", error);
      return this._failPayment(
        task,
        x402ErrorCode.SETTLEMENT_FAILED,
        `Service failed: ${error}`,
        eventQueue
      );
    }

    logger.log("Delegate execution complete. Proceeding to settlement.");

    try {
      logger.log("Calling settlePayment...");
      const settleResponse = await this.settlePayment(
        paymentPayload,
        paymentRequirements
      );

      logger.log(`Settlement response: ${JSON.stringify(settleResponse, null, 2)}`);

      if (settleResponse.success) {
        logger.log("Settlement successful. Recording payment success.");
        this.utils.recordPaymentSuccess(task, settleResponse);
        x402ServerExecutor._paymentRequirementsStore.delete(task.id);
      } else {
        logger.warn(`Settlement failed: ${settleResponse.errorReason}`);
        const errorCode =
          settleResponse.errorReason?.toLowerCase().includes("insufficient")
            ? x402ErrorCode.INSUFFICIENT_FUNDS
            : x402ErrorCode.SETTLEMENT_FAILED;
        this.utils.recordPaymentFailure(task, errorCode, settleResponse);
        x402ServerExecutor._paymentRequirementsStore.delete(task.id);
      }

      await eventQueue.enqueueEvent(task);
      logger.log("Settlement processing finished.");
    } catch (error) {
      logger.error("Exception during settlement:", error);
      await this._failPayment(
        task,
        x402ErrorCode.SETTLEMENT_FAILED,
        `Settlement failed: ${error}`,
        eventQueue
      );
    }
  }

  private _findMatchingPaymentRequirement(
    acceptsArray: PaymentRequirements[],
    paymentPayload: PaymentPayload
  ): PaymentRequirements | null {
    logger.log("Searching for matching payment requirement...");

    for (const requirement of acceptsArray) {
      const schemeMatch = requirement.scheme === paymentPayload.scheme;
      const networkMatch = requirement.network === paymentPayload.network;

      if (schemeMatch && networkMatch) {
        logger.log("  => Found a matching payment requirement.");
        return requirement;
      }
    }

    logger.warn(
      "No matching payment requirement found after checking all options."
    );
    return null;
  }

  private _extractPaymentRequirementsFromContext(
    task: Task,
    context: RequestContext
  ): PaymentRequirements | null {
    const acceptsArray = x402ServerExecutor._paymentRequirementsStore.get(
      task.id
    );

    if (!acceptsArray) {
      logger.warn(
        `No payment requirements found in store for task ID: ${task.id}`
      );
      return null;
    }

    const paymentPayload =
      this.utils.getPaymentPayload(task) ||
      this.utils.getPaymentPayloadFromMessage(context.message);

    if (!paymentPayload) {
      logger.warn("Could not extract payment payload from task or message.");
      return null;
    }

    return this._findMatchingPaymentRequirement(acceptsArray, paymentPayload);
  }

  private async _handlePaymentRequiredException(
    exception: x402PaymentRequiredException,
    context: RequestContext,
    eventQueue: EventQueue
  ): Promise<void> {
    let task = context.currentTask;

    if (!task) {
      if (!context.taskId) {
        throw new Error(
          "Cannot handle payment exception: task_id is missing from the context."
        );
      }

      task = {
        id: context.taskId,
        contextId: context.contextId,
        status: { state: TaskState.INPUT_REQUIRED },
        metadata: {},
      };
    } else {
      task.status.state = TaskState.INPUT_REQUIRED;
    }

    // Extract payment requirements from exception
    const acceptsArray = exception.getAcceptsArray();
    const errorMessage = exception.message;

    // Store payment requirements for later correlation
    x402ServerExecutor._paymentRequirementsStore.set(task.id, acceptsArray);

    const paymentRequired: x402PaymentRequiredResponse = {
      x402Version: 1,
      accepts: acceptsArray,
      error: errorMessage,
    };

    // Update task with payment requirements
    this.utils.createPaymentRequiredTask(task, paymentRequired);

    // Send the payment required response
    await eventQueue.enqueueEvent(task);
  }

  private async _failPayment(
    task: Task,
    errorCode: string,
    errorReason: string,
    eventQueue: EventQueue
  ): Promise<void> {
    const failureResponse: SettleResponse = {
      success: false,
      network: "base",
      errorReason,
    };

    this.utils.recordPaymentFailure(task, errorCode, failureResponse);
    x402ServerExecutor._paymentRequirementsStore.delete(task.id);
    await eventQueue.enqueueEvent(task);
  }
}
