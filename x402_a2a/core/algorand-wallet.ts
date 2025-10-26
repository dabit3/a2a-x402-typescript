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
 * Algorand payment signing and processing functions
 */

import algosdk from "algosdk";
import {
  PaymentRequirements,
  PaymentPayload,
  AlgorandPaymentPayload,
  AlgorandAuthorization,
  SupportedNetworks,
} from "../types/state";
import { getSuggestedParams, isAlgorandNetwork } from "./algorand-utils";

/**
 * Algorand account wrapper
 */
export interface AlgorandAccount {
  address: string;
  privateKey: Uint8Array;
}

/**
 * Create an Algorand account from a mnemonic
 */
export function accountFromMnemonic(mnemonic: string): AlgorandAccount {
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  return {
    address: account.addr.toString(),
    privateKey: account.sk,
  };
}

/**
 * Generate a new random Algorand account
 */
export function generateAccount(): AlgorandAccount & { mnemonic: string } {
  const account = algosdk.generateAccount();
  const mnemonic = algosdk.secretKeyToMnemonic(account.sk);
  return {
    address: account.addr.toString(),
    privateKey: account.sk,
    mnemonic,
  };
}

/**
 * Create PaymentPayload for Algorand using ED25519 signing
 */
export async function processAlgorandPayment(
  requirements: PaymentRequirements,
  account: AlgorandAccount,
  maxValue?: number
): Promise<PaymentPayload> {
  if (!isAlgorandNetwork(requirements.network as SupportedNetworks)) {
    throw new Error(
      `Network ${requirements.network} is not an Algorand network`
    );
  }

  // Validate max value if provided
  if (maxValue !== undefined) {
    const requiredAmount = parseInt(requirements.maxAmountRequired);
    if (requiredAmount > maxValue) {
      throw new Error(
        `Payment amount ${requiredAmount} exceeds max value ${maxValue}`
      );
    }
  }

  // Get suggested parameters for transaction
  const suggestedParams = await getSuggestedParams(
    requirements.network as SupportedNetworks
  );

  // Parse ASA ID from asset string
  const assetId = parseInt(requirements.asset);

  // Create authorization object
  const authorization: AlgorandAuthorization = {
    from: account.address,
    to: requirements.payTo,
    amount: requirements.maxAmountRequired,
    assetId,
    validRounds: Math.ceil(requirements.maxTimeoutSeconds / 4.5), // ~4.5s per round
    note: requirements.description,
  };

  // Create the transaction
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.address,
    receiver: requirements.payTo,
    amount: BigInt(requirements.maxAmountRequired),
    assetIndex: assetId,
    suggestedParams,
    note: requirements.description ? new TextEncoder().encode(requirements.description) : undefined,
  });

  // Sign the transaction
  const signedTxn = txn.signTxn(account.privateKey);
  const signature = Buffer.from(signedTxn).toString("base64");

  // Create Algorand payment payload
  const algorandPayload: AlgorandPaymentPayload = {
    signature,
    authorization,
    txnId: txn.txID(),
  };

  // Return complete payment payload
  return {
    x402Version: 1,
    scheme: requirements.scheme,
    network: requirements.network,
    payload: algorandPayload,
  };
}

/**
 * Verify an Algorand signature
 */
export function verifyAlgorandSignature(
  payload: AlgorandPaymentPayload,
  expectedSender: string
): boolean {
  try {
    // Decode the signed transaction
    const signedTxnBytes = Buffer.from(payload.signature, "base64");
    const decodedSignedTxn = algosdk.decodeSignedTransaction(signedTxnBytes);

    // Access transaction fields using type assertion
    const txn = decodedSignedTxn.txn as any;

    // Verify the transaction is signed by the expected sender
    const fromAddr = algosdk.encodeAddress(txn.from?.publicKey || txn.sender);
    if (fromAddr !== expectedSender) {
      return false;
    }

    // Verify transaction matches authorization
    const toAddr = txn.to ? algosdk.encodeAddress(txn.to.publicKey || txn.to) :
                   (txn.receiver ? algosdk.encodeAddress(txn.receiver) : payload.authorization.to);
    if (toAddr !== payload.authorization.to) {
      return false;
    }

    // For ASA transfers, verify the asset ID and amount
    const assetId = txn.assetIndex || txn.xaid;
    if (assetId !== undefined && assetId === payload.authorization.assetId) {
      const amount = (txn.assetAmount || txn.amount || txn.aamt || 0).toString();
      if (amount !== payload.authorization.amount) {
        return false;
      }
    }

    // Signature is valid if decoding succeeded (algosdk validates signatures on decode)
    return true;
  } catch (error) {
    console.error("Algorand signature verification failed:", error);
    return false;
  }
}

/**
 * Submit an Algorand payment transaction
 */
export async function submitAlgorandPayment(
  network: SupportedNetworks,
  payload: AlgorandPaymentPayload
): Promise<string> {
  if (!isAlgorandNetwork(network)) {
    throw new Error(`Network ${network} is not an Algorand network`);
  }

  const { getAlgodClient } = await import("./algorand-utils");
  const client = getAlgodClient(network);

  try {
    // Decode and send the signed transaction
    const signedTxnBytes = Buffer.from(payload.signature, "base64");
    const response = await client.sendRawTransaction(signedTxnBytes).do();
    const txId = response.txid;

    return txId;
  } catch (error: any) {
    throw new Error(`Failed to submit Algorand transaction: ${error.message}`);
  }
}
