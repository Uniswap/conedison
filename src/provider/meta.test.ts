import { ExternalProvider, JsonRpcProvider } from '@ethersproject/providers'
import WalletConnectProvider from '@walletconnect/ethereum-provider'

import { getWalletMeta, getWalletName, WalletMeta, WalletType } from './meta'

class MockJsonRpcProvider extends JsonRpcProvider {
  name = WalletType.UNKNOWN
  arg: string

  constructor(arg?: unknown) {
    super()
    this.arg = JSON.stringify(arg)
  }
}

class MockWalletConnectProvider extends MockJsonRpcProvider {
  name = WalletType.WALLET_CONNECT
  provider: ExternalProvider

  constructor(peerMeta: WalletConnectProvider['connector']['peerMeta']) {
    super(peerMeta)
    this.provider = { isWalletConnect: true, connector: { peerMeta } } as ExternalProvider
  }
}

class MockInjectedProvider extends MockJsonRpcProvider {
  name = WalletType.INJECTED
  provider: ExternalProvider

  constructor(provider: Record<string, boolean | undefined>) {
    super(provider)
    this.provider = {
      isConnected() {
        return true
      },
      ...provider,
    } as ExternalProvider
  }
}

const PEER_META = { name: 'name', description: 'description', url: 'url', icons: [] }

const testCases: [MockJsonRpcProvider, WalletMeta][] = [
  [new MockJsonRpcProvider(), { type: WalletType.UNKNOWN }],
  [new MockWalletConnectProvider(null), { type: WalletType.WALLET_CONNECT }],
  [new MockWalletConnectProvider(PEER_META), { type: WalletType.WALLET_CONNECT, ...PEER_META }],
  [new MockInjectedProvider({}), { type: WalletType.INJECTED, name: '' }],
  [new MockInjectedProvider({ isMetaMask: false }), { type: WalletType.INJECTED, name: '' }],
  [new MockInjectedProvider({ isMetaMask: true }), { type: WalletType.INJECTED, name: 'MetaMask' }],
  [new MockInjectedProvider({ isTest: true, isMetaMask: true }), { type: WalletType.INJECTED, name: 'Test MetaMask' }],
  [
    new MockInjectedProvider({ isCoinbaseWallet: true, qrUrl: undefined }),
    { type: WalletType.INJECTED, name: 'CoinbaseWallet' },
  ],
  [
    new MockInjectedProvider({ isCoinbaseWallet: true, qrUrl: true }),
    { type: WalletType.INJECTED, name: 'CoinbaseWallet qrUrl' },
  ],
  [new MockInjectedProvider({ isA: true, isB: false }), { type: WalletType.INJECTED, name: 'A' }],
  [new MockInjectedProvider({ isA: true, isB: true }), { type: WalletType.INJECTED, name: 'A B' }],
]

describe('meta', () => {
  describe.each(testCases)('getWalletMeta/getWalletName returns the project meta/name', (provider, meta) => {
    it(`${provider.name} ${provider.arg}`, () => {
      expect(getWalletMeta(provider)).toEqual(meta)
      expect(getWalletName(provider)).toBe(meta.name)
    })
  })
})
