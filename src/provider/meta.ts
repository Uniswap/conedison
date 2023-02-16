import type { ExternalProvider, JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import WalletConnectProvider from '@walletconnect/ethereum-provider'

function isWeb3Provider(provider: JsonRpcProvider): provider is Web3Provider {
  return 'provider' in provider
}

function isWalletConnectProvider(provider: ExternalProvider): provider is WalletConnectProvider {
  return (provider as WalletConnectProvider).isWalletConnect
}

export type PeerMeta = NonNullable<WalletConnectProvider['connector']['peerMeta']>

export function getPeerMeta(provider: JsonRpcProvider): PeerMeta | undefined {
  if (isWeb3Provider(provider) && isWalletConnectProvider(provider.provider)) {
    return provider.provider.connector.peerMeta ?? undefined
  } else {
    return
  }
}
