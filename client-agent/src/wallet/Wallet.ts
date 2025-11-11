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
 * Multi-chain Wallet implementation
 * Handles payment signing for both Solana (Devnet) and Ethereum (Base Sepolia)
 */

import { ethers } from 'ethers';
import type { Address } from '@solana/kit';
import { SolanaClient } from '../solana/SolanaClient';
import
{
  PaymentPayload,
  x402PaymentRequiredResponse,
  PaymentRequirements,
} from 'a2a-x402';

// ERC20 ABI for approve, allowance, transfer, and transferFrom functions
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
];

export abstract class Wallet
{
  /**
   * Signs a payment requirement and returns the signed payload.
   */
  abstract signPayment ( requirements: x402PaymentRequiredResponse ): Promise<PaymentPayload>;
}

export class LocalWallet extends Wallet
{
  private ethWallet: ethers.Wallet;
  private ethProvider: ethers.JsonRpcProvider;
  private solanaClient: SolanaClient;
  private solanaAddress?: Address;

  constructor ( privateKey?: string, ethRpcUrl?: string, solanaRpcUrl?: string )
  {
    super();

    // Initialize Ethereum wallet
    const key = privateKey || process.env.WALLET_PRIVATE_KEY;
    if ( !key )
    {
      throw new Error( 'WALLET_PRIVATE_KEY environment variable not set and no privateKey provided' );
    }

    const url = ethRpcUrl ||
      process.env.BASE_SEPOLIA_RPC_URL ||
      'https://base-sepolia.g.alchemy.com/v2/_sTLFEOJwL7dFs2bLmqUo';

    this.ethProvider = new ethers.JsonRpcProvider( url );
    this.ethWallet = new ethers.Wallet( key, this.ethProvider );

    // Initialize Solana client
    this.solanaClient = new SolanaClient( solanaRpcUrl );

    logger.log( `\n💼 Multi-Chain Wallet Initialized:` );
    logger.log( `   📍 Ethereum Address: ${ this.ethWallet.address }` );
    logger.log( `   📍 Base Sepolia RPC: ${ url }` );
    logger.log( `   📍 Solana Devnet RPC: ${ this.solanaClient.getRpcUrl() }` );
  }

  /**
   * Get Solana client
   */
  getSolanaClient (): SolanaClient
  {
    return this.solanaClient;
  }

  /**
   * Get Solana address (if set)
   */
  getSolanaAddress (): Address | undefined
  {
    return this.solanaAddress;
  }

  /**
   * Set Solana address
   */
  setSolanaAddress ( address: Address ): void
  {
    this.solanaAddress = address;
    logger.log( `✅ Solana address set: ${ address }` );
  }

  /**
   * Ensure the spender has approval to spend at least the specified amount.
   * Automatically approves if current allowance is insufficient.
   */
  private async ensureApproval (
    tokenAddress: string,
    spenderAddress: string,
    amount: bigint
  ): Promise<boolean>
  {
    try
    {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.ethWallet
      );

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(
        this.ethWallet.address,
        spenderAddress
      );

      logger.log( `📋 Current allowance: ${ currentAllowance.toString() }, Required: ${ amount.toString() }` );

      if ( currentAllowance >= amount )
      {
        logger.log( '✅ Sufficient allowance already exists' );
        return true;
      }

      // Need to approve
      logger.log( `🔓 Approving ${ spenderAddress } to spend ${ amount.toString() } tokens...` );

      // Add 10% buffer to avoid multiple approvals for similar amounts
      const approvalAmount = ( amount * BigInt( 110 ) ) / BigInt( 100 );

      const tx = await tokenContract.approve( spenderAddress, approvalAmount, {
        gasLimit: 100000,
      } );

      logger.log( `⏳ Approval transaction sent: ${ tx.hash }` );
      logger.log( '   Waiting for confirmation...' );

      const receipt = await tx.wait();

      if ( receipt && receipt.status === 1 )
      {
        logger.log( `✅ Approval successful! TX: ${ tx.hash }` );
        return true;
      } else
      {
        logger.error( `❌ Approval transaction failed. TX: ${ tx.hash }` );
        return false;
      }

    } catch ( error )
    {
      logger.error( '❌ Error during approval:', error );
      return false;
    }
  }

  /**
   * Signs a payment requirement, automatically handling approval if needed.
   */
  async signPayment ( requirements: x402PaymentRequiredResponse ): Promise<PaymentPayload>
  {
    const paymentOption = requirements.accepts[ 0 ];

    // Extract required information
    const tokenAddress = paymentOption.asset;
    const merchantAddress = paymentOption.payTo;
    const amountRequired = BigInt( paymentOption.maxAmountRequired );

    logger.log( `\n💳 Payment requested: ${ amountRequired.toString() } tokens to ${ merchantAddress }` );

    // Automatically handle approval
    const approved = await this.ensureApproval( tokenAddress, merchantAddress, amountRequired );
    if ( !approved )
    {
      throw new Error( 'Failed to approve token spending. Payment cannot proceed.' );
    }

    logger.log( '✅ Token approval confirmed, proceeding with payment signature...' );

    // Now sign the payment authorization
    const messageToSign = `Chain ID: ${ paymentOption.network }
Contract: ${ paymentOption.asset }
User: ${ this.ethWallet.address }
Receiver: ${ paymentOption.payTo }
Amount: ${ paymentOption.maxAmountRequired }
`;

    const signature = await this.ethWallet.signMessage( messageToSign );

    const authorizationPayload = {
      from: this.ethWallet.address,
      to: paymentOption.payTo,
      value: paymentOption.maxAmountRequired,
      validAfter: Math.floor( Date.now() / 1000 ),
      validBefore: Math.floor( Date.now() / 1000 ) + paymentOption.maxTimeoutSeconds,
      nonce: `0x${ ethers.hexlify( ethers.randomBytes( 32 ) ) }`,
      extra: { message: messageToSign },
    };

    const finalPayload: ExactPaymentPayloadData = {
      authorization: authorizationPayload,
      signature: signature,
    };

    return {
      x402Version: 1,
      scheme: paymentOption.scheme,
      network: paymentOption.network,
      payload: finalPayload,
    };
  }

  /**
   * Execute the actual token transfer after approval and signing.
   * This performs the on-chain USDC transfer from client to merchant.
   */
  async executePayment (
    tokenAddress: string,
    merchantAddress: string,
    amount: bigint
  ): Promise<{ success: boolean; txHash?: string; error?: string }>
  {
    try
    {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.ethWallet
      );

      logger.log( `\n💸 Executing payment transfer...` );
      logger.log( `   Amount: ${ amount.toString() } tokens` );
      logger.log( `   From: ${ this.ethWallet.address }` );
      logger.log( `   To: ${ merchantAddress }` );

      // Check balance before transfer
      const balance = await tokenContract.balanceOf( this.ethWallet.address );
      logger.log( `📊 Current balance: ${ balance.toString() } tokens` );

      if ( balance < amount )
      {
        const error = `Insufficient balance. Have ${ balance.toString() }, need ${ amount.toString() }`;
        logger.error( `❌ ${ error }` );
        return { success: false, error };
      }

      // Execute the transfer
      const tx = await tokenContract.transfer( merchantAddress, amount, {
        gasLimit: 100000,
      } );

      logger.log( `⏳ Transfer transaction sent: ${ tx.hash }` );
      logger.log( '   Waiting for confirmation...' );

      const receipt = await tx.wait();

      if ( receipt && receipt.status === 1 )
      {
        logger.log( `✅ Transfer successful! TX: ${ tx.hash }` );
        logger.log( `🎉 Payment of ${ amount.toString() } tokens completed!` );
        return { success: true, txHash: tx.hash };
      } else
      {
        logger.error( `❌ Transfer transaction failed. TX: ${ tx.hash }` );
        return { success: false, txHash: tx.hash, error: 'Transaction failed' };
      }

    } catch ( error )
    {
      const errorMessage = error instanceof Error ? error.message : String( error );
      logger.error( '❌ Error during transfer:', errorMessage );
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get the Ethereum wallet address
   */
  getAddress (): string
  {
    return this.ethWallet.address;
  }

  /**
   * Get Solana balance for the configured address
   */
  async getSolanaBalance (): Promise<bigint | null>
  {
    if ( !this.solanaAddress )
    {
      logger.warn( '⚠️ Solana address not set' );
      return null;
    }
    try
    {
      return await this.solanaClient.getBalance( this.solanaAddress );
    } catch ( error )
    {
      logger.error( '❌ Failed to get Solana balance:', error );
      return null;
    }
  }

  /**
   * Request Solana airdrop (Devnet only)
   */
  async requestSolanaAirdrop ( lamports: bigint ): Promise<string | null>
  {
    if ( !this.solanaAddress )
    {
      logger.error( '❌ Solana address not set' );
      return null;
    }
    try
    {
      return await this.solanaClient.requestAirdrop( this.solanaAddress, lamports );
    } catch ( error )
    {
      logger.error( '❌ Failed to request Solana airdrop:', error );
      return null;
    }
  }
}

// Type for the exact payment payload data
interface ExactPaymentPayloadData
{
  authorization: {
    from: string;
    to: string;
    value: string;
    validAfter: number;
    validBefore: number;
    nonce: string;
    extra?: any;
  };
  signature: string;
}
