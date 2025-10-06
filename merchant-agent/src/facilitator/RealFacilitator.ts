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
 * Real Facilitator - Interacts with blockchain to verify and settle payments
 */

import {
  FacilitatorClient,
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  ExactPaymentPayload,
} from 'x402-a2a-typescript';
import { ethers } from 'ethers';

// Standard ERC20 ABI for the functions we need
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address recipient, uint256 amount) returns (bool)',
  'function transferFrom(address sender, address recipient, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

export class RealFacilitator implements FacilitatorClient {
  private provider: ethers.JsonRpcProvider;
  private merchantAccount: ethers.Wallet | null;

  constructor() {
    // Get RPC URL from environment or use default Base Sepolia RPC
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ||
                   'https://base-sepolia.g.alchemy.com/v2/_sTLFEOJwL7dFs2bLmqUo';

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Get merchant private key from environment
    const merchantPrivateKey = process.env.MERCHANT_PRIVATE_KEY;
    if (merchantPrivateKey) {
      this.merchantAccount = new ethers.Wallet(merchantPrivateKey, this.provider);
      console.log(`💼 Merchant account loaded: ${this.merchantAccount.address}`);
    } else {
      this.merchantAccount = null;
      console.warn('⚠️  No MERCHANT_PRIVATE_KEY set - settlement will fail');
    }
  }

  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    console.log('--- REAL FACILITATOR: VERIFY ---');
    console.log(`Received payload:\n${JSON.stringify(payload, null, 2)}`);

    try {
      let payer: string | undefined;
      let authorization: any;
      let signature: string | undefined;
      let messageToVerify = '';

      // Extract payer address and signature from payload
      if (payload.payload && typeof payload.payload === 'object' && 'authorization' in payload.payload) {
        const exactPayload = payload.payload as ExactPaymentPayload;
        payer = exactPayload.authorization.from;
        authorization = exactPayload.authorization;
        signature = exactPayload.signature;

        // Get message from extra data if available
        if (authorization.extra && typeof authorization.extra === 'object' && 'message' in authorization.extra) {
          messageToVerify = authorization.extra.message as string;
        }
      }

      if (!payer || !signature) {
        return {
          isValid: false,
          invalidReason: 'Missing payer address or signature',
          payer: payer,
        };
      }

      // Reconstruct message if not provided
      if (!messageToVerify) {
        messageToVerify = `Chain ID: ${payload.network}
Contract: ${requirements.asset}
User: ${payer}
Receiver: ${requirements.payTo}
Amount: ${requirements.maxAmountRequired}
`;
      }

      // Recover address from signature
      const recoveredAddress = ethers.verifyMessage(messageToVerify, signature);

      if (recoveredAddress.toLowerCase() !== payer.toLowerCase()) {
        return {
          isValid: false,
          invalidReason: `Signature verification failed. Expected ${payer}, got ${recoveredAddress}`,
          payer: payer,
        };
      }

      // Check token balance on-chain
      const tokenContract = new ethers.Contract(
        requirements.asset,
        ERC20_ABI,
        this.provider
      );

      const balance = await tokenContract.balanceOf(payer);
      const requiredAmount = BigInt(requirements.maxAmountRequired);

      if (balance < requiredAmount) {
        return {
          isValid: false,
          invalidReason: `Insufficient balance. Has ${balance.toString()}, needs ${requiredAmount.toString()}`,
          payer: payer,
        };
      }

      console.log(`✅ Payment verified successfully. Payer: ${payer}, Balance: ${balance.toString()}`);
      return { isValid: true, payer: payer };

    } catch (error) {
      console.error('❌ Verification error:', error);
      return {
        isValid: false,
        invalidReason: error instanceof Error ? error.message : String(error),
        payer: undefined,
      };
    }
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    console.log('--- REAL FACILITATOR: SETTLE ---');

    if (!this.merchantAccount) {
      return {
        success: false,
        network: requirements.network,
        errorReason: 'Merchant account not configured. Set MERCHANT_PRIVATE_KEY environment variable.',
      };
    }

    try {
      let payer: string | undefined;

      // Extract payer information
      if (payload.payload && typeof payload.payload === 'object' && 'authorization' in payload.payload) {
        const exactPayload = payload.payload as ExactPaymentPayload;
        payer = exactPayload.authorization.from;
      }

      if (!payer) {
        return {
          success: false,
          network: requirements.network,
          errorReason: 'Could not extract payer address from payload',
        };
      }

      // Setup token contract
      const tokenContract = new ethers.Contract(
        requirements.asset,
        ERC20_ABI,
        this.merchantAccount
      );

      const amount = BigInt(requirements.maxAmountRequired);

      console.log(`📤 Executing transferFrom: ${payer} -> ${requirements.payTo}, amount: ${amount.toString()}`);

      // Build the transferFrom transaction
      // Note: This assumes the payer has approved the merchant to spend tokens
      const tx = await tokenContract.transferFrom(
        payer,
        requirements.payTo,
        amount,
        {
          gasLimit: 200000, // Set appropriate gas limit
        }
      );

      console.log(`⏳ Transaction sent: ${tx.hash}`);
      console.log('   Waiting for confirmation...');

      // Wait for transaction receipt
      const receipt = await tx.wait();

      if (receipt && receipt.status === 1) {
        console.log(`✅ Settlement successful. TX: ${tx.hash}`);
        return {
          success: true,
          transaction: tx.hash,
          network: requirements.network,
          payer: payer,
        };
      } else {
        const errorMsg = `Transaction failed. TX: ${tx.hash}`;
        console.error(`❌ ${errorMsg}`);
        return {
          success: false,
          network: requirements.network,
          errorReason: errorMsg,
        };
      }

    } catch (error) {
      console.error('❌ Settlement error:', error);

      // Parse common errors
      let errorReason = error instanceof Error ? error.message : String(error);

      if (errorReason.includes('insufficient allowance') ||
          errorReason.includes('ERC20: transfer amount exceeds allowance')) {
        errorReason = `Insufficient token approval. The client must approve the merchant to spend tokens before payment can be settled. Error: ${errorReason}`;
      }

      return {
        success: false,
        network: requirements.network,
        errorReason: errorReason,
      };
    }
  }
}
