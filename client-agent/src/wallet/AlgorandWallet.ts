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

import { logger } from "../logger";

/**
 * Algorand Wallet implementation for client agent
 * Handles ASA transfers and opt-ins
 */

import algosdk from "algosdk";
import {
  PaymentPayload,
  x402PaymentRequiredResponse,
  AlgorandPaymentPayload,
  AlgorandAuthorization,
  SupportedNetworks,
} from "a2a-x402";
import { Wallet } from "./Wallet";

// Import Algorand utilities from x402_a2a
import {
  getAlgodClient,
  getSuggestedParams,
  waitForConfirmation,
  isAlgorandNetwork
} from "../../../x402_a2a/core/algorand-utils";

export class AlgorandLocalWallet extends Wallet {
  private account: algosdk.Account;
  private network: SupportedNetworks;

  constructor(mnemonic?: string, network?: SupportedNetworks) {
    super();

    // Get mnemonic from parameter or environment
    const mnemonicPhrase = mnemonic || process.env.ALGORAND_MNEMONIC;
    if (!mnemonicPhrase) {
      throw new Error(
        "ALGORAND_MNEMONIC environment variable not set and no mnemonic provided"
      );
    }

    this.account = algosdk.mnemonicToSecretKey(mnemonicPhrase);
    this.network = network || ("algorand-testnet" as SupportedNetworks);

    logger.log(`👛 Algorand Wallet initialized: ${this.account.addr}`);
    logger.log(`🌐 Network: ${this.network}`);
  }

  /**
   * Check if the account has opted into an ASA
   */
  private async isOptedIntoASA(assetId: number): Promise<boolean> {
    try {
      if (assetId === 0) {
        // ALGO is always available
        return true;
      }

      const client = getAlgodClient(this.network);
      const accountInfo = await client
        .accountInformation(this.account.addr)
        .do();

      const assets = accountInfo.assets || [];
      const isOptedIn = assets.some(
        (asset: any) => asset["asset-id"] === assetId
      );

      return isOptedIn;
    } catch (error) {
      logger.error("Error checking ASA opt-in status:", error);
      return false;
    }
  }

  /**
   * Opt into an ASA (Algorand Standard Asset)
   * Required before receiving any ASA tokens
   */
  private async optIntoASA(assetId: number): Promise<boolean> {
    try {
      logger.log(`🔑 Opting into ASA ${assetId}...`);

      const client = getAlgodClient(this.network);
      const suggestedParams = await getSuggestedParams(this.network);

      // Create opt-in transaction (amount = 0, assetIndex specified)
      const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: this.account.addr,
        to: this.account.addr,
        amount: BigInt(0),
        assetIndex: assetId,
        suggestedParams,
      });

      // Sign the transaction
      const signedTxn = optInTxn.signTxn(this.account.sk);

      // Submit to network
      const { txId } = await client.sendRawTransaction(signedTxn).do();

      logger.log(`⏳ Opt-in transaction sent: ${txId}`);
      logger.log("   Waiting for confirmation...");

      // Wait for confirmation
      await waitForConfirmation(this.network, txId, 10);

      logger.log(`✅ Opt-in successful! TX: ${txId}`);
      return true;
    } catch (error) {
      logger.error("❌ Error during ASA opt-in:", error);
      return false;
    }
  }

  /**
   * Ensure the account is opted into the ASA, opt in if not
   */
  private async ensureOptIn(assetId: number): Promise<boolean> {
    try {
      const isOptedIn = await this.isOptedIntoASA(assetId);

      if (isOptedIn) {
        logger.log(`✅ Already opted into ASA ${assetId}`);
        return true;
      }

      // Need to opt in
      return await this.optIntoASA(assetId);
    } catch (error) {
      logger.error("❌ Error ensuring ASA opt-in:", error);
      return false;
    }
  }

  /**
   * Signs a payment requirement for Algorand
   */
  async signPayment(
    requirements: x402PaymentRequiredResponse
  ): Promise<PaymentPayload> {
    const paymentOption = requirements.accepts[0];

    // Ensure this is an Algorand network
    if (!isAlgorandNetwork(paymentOption.network as SupportedNetworks)) {
      throw new Error(
        `Network ${paymentOption.network} is not an Algorand network`
      );
    }

    // Extract required information
    const assetId = parseInt(paymentOption.asset);
    const merchantAddress = paymentOption.payTo;
    const amountRequired = BigInt(paymentOption.maxAmountRequired);

    logger.log(
      `\n💳 Payment requested: ${amountRequired.toString()} of ASA ${assetId} to ${merchantAddress}`
    );

    // Ensure we're opted into the ASA
    const optedIn = await this.ensureOptIn(assetId);
    if (!optedIn) {
      throw new Error(
        `Failed to opt into ASA ${assetId}. Payment cannot proceed.`
      );
    }

    logger.log("✅ ASA opt-in confirmed, proceeding with payment signature...");

    // Get suggested params for the transaction
    const suggestedParams = await getSuggestedParams(
      paymentOption.network as SupportedNetworks
    );

    // Calculate valid rounds
    const validRounds = Math.ceil(paymentOption.maxTimeoutSeconds / 4.5); // ~4.5s per round

    // Create the authorization
    const authorization: AlgorandAuthorization = {
      from: this.account.addr,
      to: merchantAddress,
      amount: amountRequired.toString(),
      assetId,
      validRounds,
      note: paymentOption.description,
    };

    // Create the actual transaction
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: this.account.addr,
      to: merchantAddress,
      amount: amountRequired,
      assetIndex: assetId,
      suggestedParams: {
        ...suggestedParams,
        lastRound: suggestedParams.firstRound + validRounds,
      },
      note: paymentOption.description
        ? new TextEncoder().encode(paymentOption.description)
        : undefined,
    });

    // Sign the transaction
    const signedTxn = txn.signTxn(this.account.sk);
    const signature = Buffer.from(signedTxn).toString("base64");
    const txnId = txn.txID();

    // Create Algorand payment payload
    const algorandPayload: AlgorandPaymentPayload = {
      signature,
      authorization,
      txnId,
    };

    return {
      x402Version: 1,
      scheme: paymentOption.scheme,
      network: paymentOption.network,
      payload: algorandPayload,
    };
  }

  /**
   * Execute the actual ASA transfer after signing
   */
  async executePayment(
    assetId: number,
    merchantAddress: string,
    amount: bigint
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const client = getAlgodClient(this.network);

      logger.log(`\n💸 Executing ASA transfer...`);
      logger.log(`   ASA ID: ${assetId}`);
      logger.log(`   Amount: ${amount.toString()}`);
      logger.log(`   From: ${this.account.addr}`);
      logger.log(`   To: ${merchantAddress}`);

      // Check balance before transfer
      const accountInfo = await client
        .accountInformation(this.account.addr)
        .do();

      let balance = BigInt(0);
      if (assetId === 0) {
        // ALGO balance
        balance = BigInt(accountInfo.amount);
      } else {
        // ASA balance
        const assets = accountInfo.assets || [];
        const assetHolding = assets.find(
          (asset: any) => asset["asset-id"] === assetId
        );
        if (assetHolding) {
          balance = BigInt(assetHolding.amount);
        }
      }

      logger.log(`📊 Current balance: ${balance.toString()}`);

      if (balance < amount) {
        const error = `Insufficient balance. Have ${balance.toString()}, need ${amount.toString()}`;
        logger.error(`❌ ${error}`);
        return { success: false, error };
      }

      // Get suggested params
      const suggestedParams = await getSuggestedParams(this.network);

      // Create transfer transaction
      const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: this.account.addr,
        to: merchantAddress,
        amount,
        assetIndex: assetId,
        suggestedParams,
      });

      // Sign and send
      const signedTxn = txn.signTxn(this.account.sk);
      const { txId } = await client.sendRawTransaction(signedTxn).do();

      logger.log(`⏳ Transfer transaction sent: ${txId}`);
      logger.log("   Waiting for confirmation...");

      // Wait for confirmation
      await waitForConfirmation(this.network, txId, 10);

      logger.log(`✅ Transfer successful! TX: ${txId}`);
      logger.log(`🎉 Payment of ${amount.toString()} completed!`);
      return { success: true, txHash: txId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("❌ Error during transfer:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get the wallet address
   */
  getAddress(): string {
    return this.account.addr;
  }

  /**
   * Get the current network
   */
  getNetwork(): SupportedNetworks {
    return this.network;
  }
}
