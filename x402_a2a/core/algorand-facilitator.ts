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
 * Algorand-specific facilitator functions for local verification and settlement
 */

import algosdk from "algosdk";
import {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  AlgorandPaymentPayload,
  SupportedNetworks,
} from "../types/state";
import {
  getAlgodClient,
  getIndexerClient,
  waitForConfirmation,
  isAlgorandNetwork,
} from "./algorand-utils";
import { verifyAlgorandSignature } from "./algorand-wallet";

/**
 * Verify an Algorand payment locally without using the facilitator
 */
export async function verifyAlgorandPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): Promise<VerifyResponse> {
  if (!isAlgorandNetwork(requirements.network as SupportedNetworks)) {
    return {
      isValid: false,
      invalidReason: `Network ${requirements.network} is not an Algorand network`,
    };
  }

  try {
    const algorandPayload = payload.payload as AlgorandPaymentPayload;

    // Verify signature structure
    if (!algorandPayload.signature || !algorandPayload.authorization) {
      return {
        isValid: false,
        invalidReason: "Missing signature or authorization",
      };
    }

    // Decode the signed transaction
    const signedTxnBytes = Buffer.from(algorandPayload.signature, "base64");
    const decodedSignedTxn = algosdk.decodeSignedTransaction(signedTxnBytes);

    // Access transaction fields using type assertion
    const txn = decodedSignedTxn.txn as any;

    // Get the sender address
    const payer = algosdk.encodeAddress(txn.from?.publicKey || txn.sender);

    // Verify signature is valid
    if (!verifyAlgorandSignature(algorandPayload, payer)) {
      return {
        isValid: false,
        payer,
        invalidReason: "Invalid signature",
      };
    }

    // Verify transaction details match requirements
    const toAddr = txn.to ? algosdk.encodeAddress(txn.to.publicKey || txn.to) :
                   (txn.receiver ? algosdk.encodeAddress(txn.receiver) : "");
    if (toAddr !== requirements.payTo) {
      return {
        isValid: false,
        payer,
        invalidReason: `Recipient mismatch: expected ${requirements.payTo}, got ${toAddr}`,
      };
    }

    // Verify amount
    const txnAmount = (txn.assetAmount || txn.amount || txn.aamt || 0).toString();
    if (txnAmount !== requirements.maxAmountRequired) {
      return {
        isValid: false,
        payer,
        invalidReason: `Amount mismatch: expected ${requirements.maxAmountRequired}, got ${txnAmount}`,
      };
    }

    // Verify asset ID
    const expectedAssetId = parseInt(requirements.asset);
    const txnAssetId = txn.assetIndex || txn.xaid || 0;
    if (txnAssetId !== expectedAssetId) {
      return {
        isValid: false,
        payer,
        invalidReason: `Asset ID mismatch: expected ${expectedAssetId}, got ${txnAssetId}`,
      };
    }

    // Get current round to verify transaction validity
    const client = getAlgodClient(requirements.network as SupportedNetworks);
    const status = await client.status().do();
    const currentRound = Number(status.lastRound);

    // Verify transaction is not expired
    const lastValidRound = Number(txn.lastRound || txn.lastValid || txn.lv);
    if (lastValidRound < currentRound) {
      return {
        isValid: false,
        payer,
        invalidReason: `Transaction expired: last valid round ${lastValidRound}, current round ${currentRound}`,
      };
    }

    // Check if transaction has sufficient balance (optional, requires indexer)
    // This is a best-effort check and may not always be accurate

    return {
      isValid: true,
      payer,
    };
  } catch (error: any) {
    return {
      isValid: false,
      invalidReason: `Verification error: ${error.message}`,
    };
  }
}

/**
 * Settle an Algorand payment by submitting it to the network
 */
export async function settleAlgorandPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): Promise<SettleResponse> {
  if (!isAlgorandNetwork(requirements.network as SupportedNetworks)) {
    return {
      success: false,
      network: requirements.network,
      errorReason: `Network ${requirements.network} is not an Algorand network`,
    };
  }

  try {
    const algorandPayload = payload.payload as AlgorandPaymentPayload;

    // First verify the payment
    const verifyResult = await verifyAlgorandPayment(payload, requirements);
    if (!verifyResult.isValid) {
      return {
        success: false,
        network: requirements.network,
        payer: verifyResult.payer,
        errorReason: `Verification failed: ${verifyResult.invalidReason}`,
      };
    }

    // Submit the transaction
    const client = getAlgodClient(requirements.network as SupportedNetworks);
    const signedTxnBytes = Buffer.from(algorandPayload.signature, "base64");

    let txId: string;
    try {
      const result = await client.sendRawTransaction(signedTxnBytes).do();
      txId = result.txid;
    } catch (error: any) {
      // Check if transaction was already submitted
      if (error.message?.includes("already in ledger")) {
        txId = algorandPayload.txnId || "";
      } else {
        throw error;
      }
    }

    // Wait for confirmation
    try {
      await waitForConfirmation(
        requirements.network as SupportedNetworks,
        txId,
        Math.ceil(requirements.maxTimeoutSeconds / 4.5) // Convert seconds to rounds
      );
    } catch (error: any) {
      return {
        success: false,
        network: requirements.network,
        payer: verifyResult.payer,
        errorReason: `Transaction submission succeeded but confirmation failed: ${error.message}`,
      };
    }

    return {
      success: true,
      transaction: txId,
      network: requirements.network,
      payer: verifyResult.payer,
    };
  } catch (error: any) {
    return {
      success: false,
      network: requirements.network,
      errorReason: `Settlement error: ${error.message}`,
    };
  }
}

/**
 * Check if an Algorand account has opted into an ASA
 */
export async function isOptedIntoASA(
  network: SupportedNetworks,
  address: string,
  assetId: number
): Promise<boolean> {
  try {
    const client = getAlgodClient(network);
    const accountInfo = await client.accountInformation(address).do();

    if (assetId === 0) {
      // ALGO is always opted in
      return true;
    }

    const assets = accountInfo.assets || [];
    return assets.some((asset: any) => asset["asset-id"] === assetId);
  } catch (error) {
    return false;
  }
}

/**
 * Get minimum balance requirement for an account based on ASA holdings
 */
export async function getMinimumBalance(
  network: SupportedNetworks,
  address: string
): Promise<bigint> {
  try {
    const client = getAlgodClient(network);
    const accountInfo = await client.accountInformation(address).do();
    return BigInt(accountInfo.minBalance || 0);
  } catch (error) {
    // Default minimum balance (0.1 ALGO)
    return BigInt(100000);
  }
}
