const { ethers } = require("ethers");

/**
 * Create a reusable Base provider.
 * @param {string} rpcUrl - Base RPC endpoint.
 * @returns {ethers.JsonRpcProvider}
 */
function createProvider(rpcUrl) {
  if (!rpcUrl) {
    throw new Error("RPC URL is required.");
  }

  return new ethers.JsonRpcProvider(rpcUrl);
}

module.exports = {
  createProvider,
};