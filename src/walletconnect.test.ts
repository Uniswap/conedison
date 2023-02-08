import { JsonRpcProvider } from '@ethersproject/providers'

import { getPeerMeta } from './walletconnect'

describe('walletconnect', () => {
  describe('getPeerMeta', () => {
    it('returns undefined for a non-WalletConnect-derived JsonRpcProvider', () => {
      const provider = new JsonRpcProvider()
      expect(getPeerMeta(provider)).toBeUndefined()
    })

    it('returns peerMeta for a WalletConnect-derived JsonRpcProvider', () => {
      const provider = new JsonRpcProvider()
      const peerMeta = {}
      provider['provider'] = { isWalletConnect: true, connector: { peerMeta } }
      expect(getPeerMeta(provider)).toBe(peerMeta)
    })
  })
})
