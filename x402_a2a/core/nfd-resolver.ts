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
 * NFDomains (NFD) resolution for Algorand
 * Resolves .algo names to Algorand addresses
 */

import { SupportedNetworks } from "../types/state";
import { isValidAlgorandAddress } from "./algorand-utils";

/**
 * NFD API endpoints
 */
const NFD_API_ENDPOINTS = {
  "algorand-mainnet": "https://api.nf.domains",
  "algorand-testnet": "https://api.testnet.nf.domains",
  "algorand-betanet": "https://api.testnet.nf.domains", // TestNet used for BetaNet
};

/**
 * NFD API response structure
 */
interface NFDResponse {
  name: string;
  owner: string;
  depositAccount: string;
  state: string;
  caAlgo?: string[];
  unverifiedCaAlgo?: string[];
}

/**
 * Check if a string looks like an NFD name
 */
export function isNFDName(name: string): boolean {
  // NFD names end with .algo and can include segments separated by dots
  return name.endsWith('.algo') || name.includes('.algo.');
}

/**
 * Resolve an NFD name to an Algorand address
 *
 * @param nfdName - The NFD name to resolve (e.g., "alice.algo" or "wallet.alice.algo")
 * @param network - The Algorand network to use
 * @returns The resolved Algorand address
 * @throws Error if the NFD cannot be resolved or is invalid
 */
export async function resolveNFD(
  nfdName: string,
  network: SupportedNetworks = "algorand-mainnet"
): Promise<string> {
  // Validate input
  if (!isNFDName(nfdName)) {
    throw new Error(`Invalid NFD name: ${nfdName}. NFD names must end with .algo`);
  }

  // Get the appropriate API endpoint
  const apiEndpoint = NFD_API_ENDPOINTS[network as keyof typeof NFD_API_ENDPOINTS];
  if (!apiEndpoint) {
    throw new Error(`No NFD API endpoint configured for network: ${network}`);
  }

  // Construct the API URL
  const url = `${apiEndpoint}/nfd/${encodeURIComponent(nfdName)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`NFD not found: ${nfdName}`);
      }
      throw new Error(`NFD API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as NFDResponse;

    // Validate the NFD state
    if (data.state !== 'owned') {
      throw new Error(
        `NFD "${nfdName}" is not owned (state: ${data.state}). Cannot resolve address.`
      );
    }

    // Get the deposit account (recommended for receiving assets)
    const address = data.depositAccount;
    if (!address) {
      throw new Error(
        `NFD "${nfdName}" has no deposit account configured. Use owner address: ${data.owner}`
      );
    }

    // Validate the resolved address
    if (!isValidAlgorandAddress(address)) {
      throw new Error(`Resolved address is invalid: ${address}`);
    }

    return address;
  } catch (error: any) {
    // Re-throw with more context
    if (error.message.includes('NFD')) {
      throw error;
    }
    throw new Error(`Failed to resolve NFD "${nfdName}": ${error.message}`);
  }
}

/**
 * Resolve an address or NFD name to an Algorand address
 * If the input is already a valid address, returns it unchanged.
 * If it's an NFD name, resolves it to an address.
 *
 * @param addressOrNFD - Either an Algorand address or NFD name
 * @param network - The Algorand network to use for NFD resolution
 * @returns The Algorand address
 */
export async function resolveAlgorandAddress(
  addressOrNFD: string,
  network: SupportedNetworks = "algorand-mainnet"
): Promise<string> {
  // If it's already a valid Algorand address, return it
  if (isValidAlgorandAddress(addressOrNFD)) {
    return addressOrNFD;
  }

  // If it looks like an NFD name, try to resolve it
  if (isNFDName(addressOrNFD)) {
    return await resolveNFD(addressOrNFD, network);
  }

  // Neither valid address nor NFD name
  throw new Error(
    `Invalid Algorand address or NFD name: ${addressOrNFD}. ` +
    `Expected either a 58-character Algorand address or an NFD name ending with .algo`
  );
}

/**
 * Get detailed NFD information
 * Useful for showing additional context to users
 *
 * @param nfdName - The NFD name to lookup
 * @param network - The Algorand network to use
 * @returns Full NFD response with owner, verified accounts, etc.
 */
export async function getNFDInfo(
  nfdName: string,
  network: SupportedNetworks = "algorand-mainnet"
): Promise<NFDResponse> {
  if (!isNFDName(nfdName)) {
    throw new Error(`Invalid NFD name: ${nfdName}`);
  }

  const apiEndpoint = NFD_API_ENDPOINTS[network as keyof typeof NFD_API_ENDPOINTS];
  if (!apiEndpoint) {
    throw new Error(`No NFD API endpoint configured for network: ${network}`);
  }

  const url = `${apiEndpoint}/nfd/${encodeURIComponent(nfdName)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`NFD not found: ${nfdName}`);
      }
      throw new Error(`NFD API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as NFDResponse;
  } catch (error: any) {
    if (error.message.includes('NFD')) {
      throw error;
    }
    throw new Error(`Failed to get NFD info for "${nfdName}": ${error.message}`);
  }
}

/**
 * Reverse lookup: Get the NFD name for an Algorand address
 *
 * @param address - The Algorand address to look up
 * @param network - The Algorand network to use
 * @returns The NFD name associated with the address, or null if none found
 */
export async function reverseResolveNFD(
  address: string,
  network: SupportedNetworks = "algorand-mainnet"
): Promise<string | null> {
  if (!isValidAlgorandAddress(address)) {
    throw new Error(`Invalid Algorand address: ${address}`);
  }

  const apiEndpoint = NFD_API_ENDPOINTS[network as keyof typeof NFD_API_ENDPOINTS];
  if (!apiEndpoint) {
    throw new Error(`No NFD API endpoint configured for network: ${network}`);
  }

  const url = `${apiEndpoint}/nfd/lookup?address=${encodeURIComponent(address)}&view=tiny`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // No NFD found for this address
      }
      throw new Error(`NFD API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;

    // The lookup endpoint returns an object with address as key
    const nfdData = data[address] as { name?: string };
    if (!nfdData || !nfdData.name) {
      return null;
    }

    return nfdData.name;
  } catch (error: any) {
    if (error.message.includes('NFD')) {
      throw error;
    }
    // Return null for lookup failures (treat as "not found")
    return null;
  }
}
