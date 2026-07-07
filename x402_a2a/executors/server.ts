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

import type { Task } from "@a2a-js/sdk";
import type {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
} from "@a2a-js/sdk/server";
import { x402BaseExecutor } from "./base";
import {
  PaymentStatus,
  PaymentRequirements,
  SettleResponse,
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

  async execute(
    context: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    // Check if this is a payment submission
    const taskStatus = context.task
      ? this.utils.getPaymentStatusFromTask(context.task)
      : null;
    const messageStatus = this.utils.getPaymentStatusFromMessage(
      context.userMessage
    );

    if (
      taskStatus === PaymentStatus.PAYMENT_SUBMITTED ||
      messageStatus === PaymentStatus.PAYMENT_SUBMITTED
    ) {
      return this._processPaidRequest(context, eventBus);
    }

    // Try to execute delegate - catch payment exceptions
    try {
      return await this._delegate.execute(context, eventBus);
    } catch (error) {
      if (error instanceof x402PaymentRequiredException) {
        this._handlePaymentRequiredException(error, context, eventBus);
        return;
      }
      throw error;
    }
  }

  private async _processPaidRequest(
    context: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    logger.log("Starting payment processing...");
    const task = context.task;
    if (!task) {
      logger.error("Task not found in context during payment processing.");
      throw new Error("Task not found in context");
    }

    logger.log(
      `✅ Received payment payload. Beginning verification for task: ${task.id}`
    );

    const paymentPayload =
      this.utils.getPaymentPayload(task) ||
      this.utils.getPaymentPayloadFromMessage(context.userMessage);

    if (!paymentPayload) {
      logger.warn(
        "Payment payload missing from both task and message metadata."
      );
      return this._failPayment(
        task,
        x402ErrorCode.INVALID_SIGNATURE,
        "Missing payment data",
        eventBus
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
        eventBus
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
          eventBus
        );
      }
    } catch (error) {
      logger.error("Exception during payment verification:", error);
      return this._failPayment(
        task,
        x402ErrorCode.INVALID_SIGNATURE,
        `Verification failed: ${error}`,
        eventBus
      );
    }

    logger.log("Payment verified successfully. Recording and updating task.");
    this.utils.recordPaymentVerified(task);
    eventBus.publish(task);

    // Add verification status to task metadata
    if (!task.metadata) {
      task.metadata = {};
    }
    task.metadata["x402_payment_verified"] = true;

    try {
      logger.log("Executing delegate agent...");
      await this._delegate.execute(context, eventBus);
      logger.log("Delegate agent execution finished.");
    } catch (error) {
      logger.error("Exception during delegate execution:", error);
      return this._failPayment(
        task,
        x402ErrorCode.SETTLEMENT_FAILED,
        `Service failed: ${error}`,
        eventBus
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

      eventBus.publish(task);
      logger.log("Settlement processing finished.");
    } catch (error) {
      logger.error("Exception during settlement:", error);
      this._failPayment(
        task,
        x402ErrorCode.SETTLEMENT_FAILED,
        `Settlement failed: ${error}`,
        eventBus
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
      this.utils.getPaymentPayloadFromMessage(context.userMessage);

    if (!paymentPayload) {
      logger.warn("Could not extract payment payload from task or message.");
      return null;
    }

    return this._findMatchingPaymentRequirement(acceptsArray, paymentPayload);
  }

  private _handlePaymentRequiredException(
    exception: x402PaymentRequiredException,
    context: RequestContext,
    eventBus: ExecutionEventBus
  ): void {
    let task = context.task;

    if (!task) {
      if (!context.taskId) {
        throw new Error(
          "Cannot handle payment exception: task_id is missing from the context."
        );
      }

      task = {
        kind: "task",
        id: context.taskId,
        contextId: context.contextId,
        status: { state: "input-required" },
        metadata: {},
      };
    } else {
      task.status.state = "input-required";
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
    eventBus.publish(task);
  }

  private _failPayment(
    task: Task,
    errorCode: string,
    errorReason: string,
    eventBus: ExecutionEventBus
  ): void {
    const lastRequirements =
      x402ServerExecutor._paymentRequirementsStore.get(task.id)?.[0];
    const failureResponse: SettleResponse = {
      success: false,
      network: lastRequirements?.network || "unknown",
      errorReason,
    };

    this.utils.recordPaymentFailure(task, errorCode, failureResponse);
    x402ServerExecutor._paymentRequirementsStore.delete(task.id);
    eventBus.publish(task);
  }
}
