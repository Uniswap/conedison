import { ExternalProvider, JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import { Mutable } from 'types'

import { getPeerMeta } from './meta'

describe('walletconnect', () => {
  describe('getPeerMeta', () => {
    it('returns undefined for a non-WalletConnect-derived JsonRpcProvider', () => {
      const provider = new JsonRpcProvider()
      expect(getPeerMeta(provider)).toBeUndefined()
    })

    it('returns peerMeta for a WalletConnect-derived JsonRpcProvider', () => {
      const provider = new JsonRpcProvider()
      const peerMeta = {}
      const web3Provider = provider as Mutable<Web3Provider>
      web3Provider.provider = { isWalletConnect: true, connector: { peerMeta } } as ExternalProvider
      expect(getPeerMeta(provider)).toBe(peerMeta)
    })
  })
})
