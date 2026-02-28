import { TOKEN_CONTRACT, DEAD_ADDRESS } from '@/config/wagmi';

const AVALANCHE_RPC = 'https://api.avax.network/ext/bc/C/rpc';
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
// Staking contract events
const DEPOSIT_EVENT_SIGNATURE = '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c'; // Deposit(address indexed user, uint256 amount)
const WITHDRAW_EVENT_SIGNATURE = '0x884edad9ce6fa2440d8a54cc123490eb96d2768479d49ff9c7366125a9424364'; // Withdraw(address indexed user, uint256 amount)

/**
 * Fetches the most recent AVLO burn transaction hash for a given wallet address
 * by querying Avalanche C-Chain RPC for Transfer events to the dead address
 * @param walletAddress - The user's wallet address
 * @param minTimestamp - Only return transactions after this timestamp (in seconds)
 * @param expectedAmount - Optional: The exact burn amount expected (in AVLO tokens, not wei)
 */
export async function getLatestBurnTxHash(
  walletAddress: string,
  minTimestamp?: number,
  expectedAmount?: number
): Promise<string | null> {
  try {
    console.log('[AVALANCHE RPC] Fetching latest burn for:', walletAddress);
    
    // Get latest block number
    const latestBlockResponse = await fetch(AVALANCHE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: []
      })
    });
    
    const latestBlockData = await latestBlockResponse.json();
    const latestBlock = parseInt(latestBlockData.result, 16);
    const fromBlock = Math.max(0, latestBlock - 2000); // Search last ~2000 blocks (~1 hour)
    
    console.log('[AVALANCHE RPC] Searching blocks:', fromBlock, 'to', latestBlock);
    
    // Pad addresses to 32 bytes for topics
    const paddedDeadAddress = '0x000000000000000000000000' + DEAD_ADDRESS.slice(2).toLowerCase();
    const paddedWalletAddress = '0x000000000000000000000000' + walletAddress.slice(2).toLowerCase();
    
    // Query Transfer events: Transfer(from, to, amount)
    // topic0 = event signature
    // topic1 = from (indexed)
    // topic2 = to (indexed)
    const logsResponse = await fetch(AVALANCHE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_getLogs',
        params: [{
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${latestBlock.toString(16)}`,
          address: TOKEN_CONTRACT.toLowerCase(),
          topics: [
            TRANSFER_EVENT_SIGNATURE,
            paddedWalletAddress, // from = user wallet
            paddedDeadAddress    // to = dead address
          ]
        }]
      })
    });
    
    const logsData = await logsResponse.json();
    
    if (logsData.result && logsData.result.length > 0) {
      // Filter transactions by timestamp if provided
      let validTxs = logsData.result;
      
      if (minTimestamp) {
        console.log('[AVALANCHE RPC] Filtering by timestamp:', new Date(minTimestamp * 1000).toISOString());
        
        // Get transaction receipts to check timestamp
        const txsWithTimestamp = await Promise.all(
          logsData.result.map(async (log: any) => {
            try {
              const receiptResponse = await fetch(AVALANCHE_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 3,
                  method: 'eth_getTransactionByHash',
                  params: [log.transactionHash]
                })
              });
              const receiptData = await receiptResponse.json();
              const blockNumber = parseInt(receiptData.result?.blockNumber || '0', 16);
              
              // Get block to check timestamp
              const blockResponse = await fetch(AVALANCHE_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 4,
                  method: 'eth_getBlockByNumber',
                  params: [`0x${blockNumber.toString(16)}`, false]
                })
              });
              const blockData = await blockResponse.json();
              const blockTimestamp = parseInt(blockData.result?.timestamp || '0', 16);
              
              return {
                ...log,
                timestamp: blockTimestamp
              };
            } catch (error) {
              console.error('[AVALANCHE RPC] Error getting tx timestamp:', error);
              return { ...log, timestamp: 0 };
            }
          })
        );
        
        validTxs = txsWithTimestamp.filter((tx: any) => tx.timestamp >= minTimestamp);
        console.log('[AVALANCHE RPC] Found', validTxs.length, 'transactions after timestamp filter');
      }
      
      // If amount is specified, filter by amount
      if (expectedAmount && validTxs.length > 0) {
        const expectedAmountWei = BigInt(expectedAmount) * BigInt(10 ** 18);
        console.log('[AVALANCHE RPC] Filtering by amount:', expectedAmount, 'AVLO');
        
        validTxs = validTxs.filter((log: any) => {
          // Amount is in the 3rd data field (log.data)
          const amount = BigInt(log.data);
          return amount === expectedAmountWei;
        });
        
        console.log('[AVALANCHE RPC] Found', validTxs.length, 'transactions matching amount');
      }
      
      if (validTxs.length > 0) {
        // Get the most recent valid burn transaction
        const latestBurn = validTxs[validTxs.length - 1];
        console.log('[AVALANCHE RPC] Found valid burn tx:', latestBurn.transactionHash);
        return latestBurn.transactionHash;
      }
    }
    
    console.log('[AVALANCHE RPC] No recent burns found');
    return null;
  } catch (error) {
    console.error('[AVALANCHE RPC] Error fetching burn tx:', error);
    return null;
  }
}

/**
 * Generic helper to find the latest ERC20 transfer from -> to for a given token
 * Used for AVLO tips (non-burn transfers)
 */
export async function getLatestTokenTransferTxHash(
  tokenAddress: string,
  fromAddress: string,
  toAddress: string,
  minTimestamp?: number,
  expectedAmount?: number
): Promise<string | null> {
  try {
    console.log('[AVALANCHE RPC] Fetching latest transfer', { tokenAddress, fromAddress, toAddress });

    // Get latest block number
    const latestBlockResponse = await fetch(AVALANCHE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 10,
        method: 'eth_blockNumber',
        params: []
      })
    });

    const latestBlockData = await latestBlockResponse.json();
    const latestBlock = parseInt(latestBlockData.result, 16);
    const fromBlock = Math.max(0, latestBlock - 2000);

    const paddedFrom = '0x000000000000000000000000' + fromAddress.slice(2).toLowerCase();
    const paddedTo = '0x000000000000000000000000' + toAddress.slice(2).toLowerCase();

    const logsResponse = await fetch(AVALANCHE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 11,
        method: 'eth_getLogs',
        params: [{
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${latestBlock.toString(16)}`,
          address: tokenAddress.toLowerCase(),
          topics: [
            TRANSFER_EVENT_SIGNATURE,
            paddedFrom,
            paddedTo,
          ],
        }],
      }),
    });

    const logsData = await logsResponse.json();
    if (!logsData.result || logsData.result.length === 0) {
      console.log('[AVALANCHE RPC] No transfers found for token');
      return null;
    }

    let validTxs = logsData.result;

    // Optional timestamp filter
    if (minTimestamp) {
      const txsWithTimestamp = await Promise.all(
        logsData.result.map(async (log: any) => {
          try {
            const txRes = await fetch(AVALANCHE_RPC, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 12,
                method: 'eth_getTransactionByHash',
                params: [log.transactionHash],
              }),
            });
            const txData = await txRes.json();
            const blockNumber = parseInt(txData.result?.blockNumber || '0', 16);

            const blockRes = await fetch(AVALANCHE_RPC, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 13,
                method: 'eth_getBlockByNumber',
                params: [`0x${blockNumber.toString(16)}`, false],
              }),
            });
            const blockData = await blockRes.json();
            const blockTimestamp = parseInt(blockData.result?.timestamp || '0', 16);

            return { ...log, timestamp: blockTimestamp };
          } catch (e) {
            console.error('[AVALANCHE RPC] Error getting transfer timestamp:', e);
            return { ...log, timestamp: 0 };
          }
        }),
      );

      validTxs = txsWithTimestamp.filter((tx: any) => tx.timestamp >= minTimestamp);
    }

    if (expectedAmount && validTxs.length > 0) {
      const expectedAmountWei = BigInt(expectedAmount) * BigInt(10 ** 18);
      validTxs = validTxs.filter((log: any) => {
        const amount = BigInt(log.data);
        return amount === expectedAmountWei;
      });
    }

    if (validTxs.length === 0) {
      console.log('[AVALANCHE RPC] No matching transfers after filters');
      return null;
    }

    const latestTransfer = validTxs[validTxs.length - 1];
    console.log('[AVALANCHE RPC] Found transfer tx:', latestTransfer.transactionHash);
    return latestTransfer.transactionHash;
  } catch (error) {
    console.error('[AVALANCHE RPC] Error fetching transfer tx:', error);
    return null;
  }
}

/**
 * Fetches the most recent deposit transaction to staking contract for a given wallet address
 * @param stakingContractAddress - The staking contract address
 * @param walletAddress - The user's wallet address
 * @param minTimestamp - Only return transactions after this timestamp (in seconds)
 * @param expectedAmount - Optional: The exact deposit amount expected (in tokens, not wei)
 */
export async function getLatestStakingDepositTxHash(
  stakingContractAddress: string,
  walletAddress: string,
  minTimestamp?: number,
  expectedAmount?: number
): Promise<string | null> {
  try {
    console.log('[AVALANCHE RPC] Fetching latest deposit for:', walletAddress);
    
    const latestBlockResponse = await fetch(AVALANCHE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 20,
        method: 'eth_blockNumber',
        params: []
      })
    });
    
    const latestBlockData = await latestBlockResponse.json();
    const latestBlock = parseInt(latestBlockData.result, 16);
    const fromBlock = Math.max(0, latestBlock - 2000);
    
    console.log('[AVALANCHE RPC] Searching deposit blocks:', fromBlock, 'to', latestBlock);
    
    const paddedWalletAddress = '0x000000000000000000000000' + walletAddress.slice(2).toLowerCase();
    
    const logsResponse = await fetch(AVALANCHE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 21,
        method: 'eth_getLogs',
        params: [{
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${latestBlock.toString(16)}`,
          address: stakingContractAddress.toLowerCase(),
          topics: [
            DEPOSIT_EVENT_SIGNATURE,
            paddedWalletAddress, // user address (indexed)
          ]
        }]
      })
    });
    
    const logsData = await logsResponse.json();
    
    if (logsData.result && logsData.result.length > 0) {
      let validTxs = logsData.result;
      
      if (minTimestamp) {
        console.log('[AVALANCHE RPC] Filtering deposits by timestamp:', new Date(minTimestamp * 1000).toISOString());
        
        const txsWithTimestamp = await Promise.all(
          logsData.result.map(async (log: any) => {
            try {
              const txRes = await fetch(AVALANCHE_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 22,
                  method: 'eth_getTransactionByHash',
                  params: [log.transactionHash]
                })
              });
              const txData = await txRes.json();
              const blockNumber = parseInt(txData.result?.blockNumber || '0', 16);
              
              const blockRes = await fetch(AVALANCHE_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 23,
                  method: 'eth_getBlockByNumber',
                  params: [`0x${blockNumber.toString(16)}`, false]
                })
              });
              const blockData = await blockRes.json();
              const blockTimestamp = parseInt(blockData.result?.timestamp || '0', 16);
              
              return {
                ...log,
                timestamp: blockTimestamp
              };
            } catch (error) {
              console.error('[AVALANCHE RPC] Error getting deposit timestamp:', error);
              return { ...log, timestamp: 0 };
            }
          })
        );
        
        validTxs = txsWithTimestamp.filter((tx: any) => tx.timestamp >= minTimestamp);
        console.log('[AVALANCHE RPC] Found', validTxs.length, 'deposits after timestamp filter');
      }
      
      if (expectedAmount && validTxs.length > 0) {
        const expectedAmountWei = BigInt(expectedAmount) * BigInt(10 ** 18);
        console.log('[AVALANCHE RPC] Filtering deposits by amount:', expectedAmount, 'tokens');
        
        validTxs = validTxs.filter((log: any) => {
          const amount = BigInt(log.data);
          return amount === expectedAmountWei;
        });
        
        console.log('[AVALANCHE RPC] Found', validTxs.length, 'deposits matching amount');
      }
      
      if (validTxs.length > 0) {
        const latestDeposit = validTxs[validTxs.length - 1];
        console.log('[AVALANCHE RPC] Found valid deposit tx:', latestDeposit.transactionHash);
        return latestDeposit.transactionHash;
      }
    }
    
    console.log('[AVALANCHE RPC] No recent deposits found');
    return null;
  } catch (error) {
    console.error('[AVALANCHE RPC] Error fetching deposit tx:', error);
    return null;
  }
}

/**
 * Fetches the most recent withdraw transaction from staking contract for a given wallet address
 * @param stakingContractAddress - The staking contract address
 * @param walletAddress - The user's wallet address
 * @param minTimestamp - Only return transactions after this timestamp (in seconds)
 * @param expectedAmount - Optional: The exact withdraw amount expected (in tokens, not wei)
 */
export async function getLatestStakingWithdrawTxHash(
  stakingContractAddress: string,
  walletAddress: string,
  minTimestamp?: number,
  expectedAmount?: number
): Promise<string | null> {
  try {
    console.log('[AVALANCHE RPC] Fetching latest withdraw for:', walletAddress);
    
    const latestBlockResponse = await fetch(AVALANCHE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 30,
        method: 'eth_blockNumber',
        params: []
      })
    });
    
    const latestBlockData = await latestBlockResponse.json();
    const latestBlock = parseInt(latestBlockData.result, 16);
    const fromBlock = Math.max(0, latestBlock - 2000);
    
    console.log('[AVALANCHE RPC] Searching withdraw blocks:', fromBlock, 'to', latestBlock);
    
    const paddedWalletAddress = '0x000000000000000000000000' + walletAddress.slice(2).toLowerCase();
    
    const logsResponse = await fetch(AVALANCHE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 31,
        method: 'eth_getLogs',
        params: [{
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${latestBlock.toString(16)}`,
          address: stakingContractAddress.toLowerCase(),
          topics: [
            WITHDRAW_EVENT_SIGNATURE,
            paddedWalletAddress, // user address (indexed)
          ]
        }]
      })
    });
    
    const logsData = await logsResponse.json();
    
    if (logsData.result && logsData.result.length > 0) {
      let validTxs = logsData.result;
      
      if (minTimestamp) {
        console.log('[AVALANCHE RPC] Filtering withdraws by timestamp:', new Date(minTimestamp * 1000).toISOString());
        
        const txsWithTimestamp = await Promise.all(
          logsData.result.map(async (log: any) => {
            try {
              const txRes = await fetch(AVALANCHE_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 32,
                  method: 'eth_getTransactionByHash',
                  params: [log.transactionHash]
                })
              });
              const txData = await txRes.json();
              const blockNumber = parseInt(txData.result?.blockNumber || '0', 16);
              
              const blockRes = await fetch(AVALANCHE_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 33,
                  method: 'eth_getBlockByNumber',
                  params: [`0x${blockNumber.toString(16)}`, false]
                })
              });
              const blockData = await blockRes.json();
              const blockTimestamp = parseInt(blockData.result?.timestamp || '0', 16);
              
              return {
                ...log,
                timestamp: blockTimestamp
              };
            } catch (error) {
              console.error('[AVALANCHE RPC] Error getting withdraw timestamp:', error);
              return { ...log, timestamp: 0 };
            }
          })
        );
        
        validTxs = txsWithTimestamp.filter((tx: any) => tx.timestamp >= minTimestamp);
        console.log('[AVALANCHE RPC] Found', validTxs.length, 'withdraws after timestamp filter');
      }
      
      if (expectedAmount && validTxs.length > 0) {
        const expectedAmountWei = BigInt(expectedAmount) * BigInt(10 ** 18);
        console.log('[AVALANCHE RPC] Filtering withdraws by amount:', expectedAmount, 'tokens');
        
        validTxs = validTxs.filter((log: any) => {
          const amount = BigInt(log.data);
          return amount === expectedAmountWei;
        });
        
        console.log('[AVALANCHE RPC] Found', validTxs.length, 'withdraws matching amount');
      }
      
      if (validTxs.length > 0) {
        const latestWithdraw = validTxs[validTxs.length - 1];
        console.log('[AVALANCHE RPC] Found valid withdraw tx:', latestWithdraw.transactionHash);
        return latestWithdraw.transactionHash;
      }
    }
    
    console.log('[AVALANCHE RPC] No recent withdraws found');
    return null;
  } catch (error) {
    console.error('[AVALANCHE RPC] Error fetching withdraw tx:', error);
    return null;
  }
}

/**
 * Fetches the most recent claim rewards transaction for a given wallet address
 * by looking for AVLO token transfers FROM staking contract TO user wallet
 * @param avloTokenAddress - The AVLO token contract address
 * @param stakingContractAddress - The staking contract address (sender)
 * @param walletAddress - The user's wallet address (receiver)
 * @param minTimestamp - Only return transactions after this timestamp (in seconds)
 */
export async function getLatestStakingClaimTxHash(
  avloTokenAddress: string,
  stakingContractAddress: string,
  walletAddress: string,
  minTimestamp?: number
): Promise<string | null> {
  try {
    console.log('[AVALANCHE RPC] Fetching latest claim for:', walletAddress);
    
    const latestBlockResponse = await fetch(AVALANCHE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 40,
        method: 'eth_blockNumber',
        params: []
      })
    });
    
    const latestBlockData = await latestBlockResponse.json();
    const latestBlock = parseInt(latestBlockData.result, 16);
    const fromBlock = Math.max(0, latestBlock - 2000);
    
    console.log('[AVALANCHE RPC] Searching claim blocks:', fromBlock, 'to', latestBlock);
    
    const paddedStakingAddress = '0x000000000000000000000000' + stakingContractAddress.slice(2).toLowerCase();
    const paddedWalletAddress = '0x000000000000000000000000' + walletAddress.slice(2).toLowerCase();
    
    // Look for AVLO Transfer events from staking contract to user
    const logsResponse = await fetch(AVALANCHE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 41,
        method: 'eth_getLogs',
        params: [{
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${latestBlock.toString(16)}`,
          address: avloTokenAddress.toLowerCase(),
          topics: [
            TRANSFER_EVENT_SIGNATURE,
            paddedStakingAddress, // from = staking contract
            paddedWalletAddress   // to = user wallet
          ]
        }]
      })
    });
    
    const logsData = await logsResponse.json();
    
    if (logsData.result && logsData.result.length > 0) {
      let validTxs = logsData.result;
      
      if (minTimestamp) {
        console.log('[AVALANCHE RPC] Filtering claims by timestamp:', new Date(minTimestamp * 1000).toISOString());
        
        const txsWithTimestamp = await Promise.all(
          logsData.result.map(async (log: any) => {
            try {
              const txRes = await fetch(AVALANCHE_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 42,
                  method: 'eth_getTransactionByHash',
                  params: [log.transactionHash]
                })
              });
              const txData = await txRes.json();
              const blockNumber = parseInt(txData.result?.blockNumber || '0', 16);
              
              const blockRes = await fetch(AVALANCHE_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 43,
                  method: 'eth_getBlockByNumber',
                  params: [`0x${blockNumber.toString(16)}`, false]
                })
              });
              const blockData = await blockRes.json();
              const blockTimestamp = parseInt(blockData.result?.timestamp || '0', 16);
              
              return {
                ...log,
                timestamp: blockTimestamp
              };
            } catch (error) {
              console.error('[AVALANCHE RPC] Error getting claim timestamp:', error);
              return { ...log, timestamp: 0 };
            }
          })
        );
        
        validTxs = txsWithTimestamp.filter((tx: any) => tx.timestamp >= minTimestamp);
        console.log('[AVALANCHE RPC] Found', validTxs.length, 'claims after timestamp filter');
      }
      
      if (validTxs.length > 0) {
        const latestClaim = validTxs[validTxs.length - 1];
        console.log('[AVALANCHE RPC] Found valid claim tx:', latestClaim.transactionHash);
        return latestClaim.transactionHash;
      }
    }
    
    console.log('[AVALANCHE RPC] No recent claims found');
    return null;
  } catch (error) {
    console.error('[AVALANCHE RPC] Error fetching claim tx:', error);
    return null;
  }
}
