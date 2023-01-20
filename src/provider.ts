import type { TypedDataDomain, TypedDataField } from '@ethersproject/abstract-signer'
import { _TypedDataEncoder } from '@ethersproject/hash'
import type { JsonRpcSigner } from '@ethersproject/providers'

// See https://github.com/MetaMask/eth-rpc-errors/blob/b19c8724168eec4ce3f8b1f87642f231f0dd27b2/src/error-constants.ts#L12
export const INVALID_PARAMS_CODE = -32602

/**
 * Calls into the eth_signTypedData methods to add support for wallets with spotty EIP-712 support (eg Safepal) or without any (eg Zerion),
 * by first trying eth_signTypedData, and then falling back to either eth_signTyepdData_v4 or eth_sign.
 * The implementation is copied from ethers (and linted).
 * @see https://github.com/ethers-io/ethers.js/blob/c80fcddf50a9023486e9f9acb1848aba4c19f7b6/packages/providers/src.ts/json-rpc-provider.ts#L334
 * TODO(https://github.com/ethers-io/ethers.js/pull/3667): Remove if upstreamed.
 */
export async function signTypedData(
  signer: JsonRpcSigner,
  domain: TypedDataDomain,
  types: Record<string, TypedDataField[]>,
  value: Record<string, unknown>
) {
  // Populate any ENS names (in-place)
  const populated = await _TypedDataEncoder.resolveNames(domain, types, value, (name: string) => {
    return signer.provider.resolveName(name) as Promise<string>
  })

  const address = await signer.getAddress()

  try {
    try {
      // We must try the unversioned eth_signTypedData first, because some wallets (eg SafePal) will hang on _v4.
      return await signer.provider.send('eth_signTypedData', [
        address.toLowerCase(),
        JSON.stringify(_TypedDataEncoder.getPayload(populated.domain, types, populated.value)),
      ])
    } catch (error) {
      // MetaMask complains that the unversioned eth_signTypedData is formatted incorrectly (32602) - it prefers _v4.
      if (error.code === INVALID_PARAMS_CODE) {
        console.warn('eth_signTypedData failed, falling back to eth_signTypedData_v4:', error)
        return await signer.provider.send('eth_signTypedData_v4', [
          address.toLowerCase(),
          JSON.stringify(_TypedDataEncoder.getPayload(populated.domain, types, populated.value)),
        ])
      }
      throw error
    }
  } catch (error) {
    // If neither other method is available (eg Zerion), fallback to eth_sign.
    if (typeof error.message === 'string' && error.message.match(/not found/i)) {
      console.warn('eth_signTypedData_* failed, falling back to eth_sign:', error)
      const hash = _TypedDataEncoder.hash(populated.domain, types, populated.value)
      return await signer.provider.send('eth_sign', [address, hash])
    }
    throw error
  }
}
