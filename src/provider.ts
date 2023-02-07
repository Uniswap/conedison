import type { TypedDataDomain, TypedDataField } from '@ethersproject/abstract-signer'
import { _TypedDataEncoder } from '@ethersproject/hash'
import type { JsonRpcSigner } from '@ethersproject/providers'

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
  // Use Record<string, any> for the value to match the JsonRpcSigner._signTypedData signature.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: Record<string, any>
) {
  // Populate any ENS names (in-place)
  const populated = await _TypedDataEncoder.resolveNames(domain, types, value, (name: string) => {
    return signer.provider.resolveName(name) as Promise<string>
  })

  const address = await signer.getAddress()

  /*
   * Some wallets require special-casing as they will hang if sent invalid parameters or unimplemented methods:
   *
   * - MetaMask and Frame (and likely others) implement signTypedData historically, following the original
   *   signTypedData blog post [1] which flips the parameter ordering. We must pass the modern ordering and then catch
   *   the error, because...
   * - SafePal Mobile hangs (without rejecting) if passed the old parameter ordering, as well as hanging on v4.
   *
   * For a good overview of signing data (and before modifying this code :pray:), see MetaMask's documentation [2].
   *
   * [1]: Blog post introducing signTypedData: https://medium.com/metamask/scaling-web3-with-signtypeddata-91d6efc8b290
   * [2]: MetaMask's reference on "Signing Data": https://docs.metamask.io/guide/signing-data.html#signing-data
   */
  try {
    // MetaMask is known to implement v4. Other wallets should first attempt signTypedData because SafePal hangs on v4.
    if (!signer.provider.connection.url.match(/metamask/)) {
      try {
        return await signer.provider.send('eth_signTypedData', [
          // We must use the modern ordering, because SafePal hangs if passed the historical parameter ordering:
          address.toLowerCase(),
          JSON.stringify(_TypedDataEncoder.getPayload(populated.domain, types, populated.value)),
        ])
      } catch (error) {
        // Frame uses the historical ordering but implements v4, so it is special-cased to fall back to v4:
        if (typeof error.message === 'string' && error.message.match(/unknown account/i)) {
          console.warn('signTypedData: wallet expects historical parameter ordering, falling back to v4')
        } else {
          throw error
        }
      }
    }

    return await signer.provider.send('eth_signTypedData_v4', [
      address.toLowerCase(),
      JSON.stringify(_TypedDataEncoder.getPayload(populated.domain, types, populated.value)),
    ])
  } catch (error) {
    // Fallback to eth_sign:
    if (typeof error.message === 'string' && error.message.match(/not (found|implemented)/i)) {
      console.warn('signTypedData: wallet does not implement EIP-712, falling back to sign')
      const hash = _TypedDataEncoder.hash(populated.domain, types, populated.value)
      return await signer.provider.send('eth_sign', [address, hash])
    }
    throw error
  }
}
