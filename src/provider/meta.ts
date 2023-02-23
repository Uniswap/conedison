import type { ExternalProvider, JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import WalletConnectProvider from '@walletconnect/ethereum-provider'

function isWeb3Provider(provider: JsonRpcProvider): provider is Web3Provider {
  return 'provider' in provider
}

function isWalletConnectProvider(provider: ExternalProvider): provider is WalletConnectProvider {
  return (provider as WalletConnectProvider).isWalletConnect
}

export enum WalletType {
  WALLET_CONNECT = 'WalletConnect',
  INJECTED = 'Injected',
}

/**
 * WalletMeta for WalletConnect or Injected wallets.
 * For WalletConnect wallets, name, description, url, and icons are taken from WalletConnect's peerMeta
 * (as passed by the wallet or scraped from the dApp - @see https://docs.walletconnect.com/1.0/specs#session-request).
 * For Injected wallets, the name is derived from `is*` properties on the provider (eg `isMetaMask`).
 */
export interface WalletMeta {
  type: WalletType
  /** A string denoting the wallet's provenance, including all `is*` properties and the type. */
  agent: string
  /**
   * The name of the wallet.
   * Some injected wallets can be used multiple ways (eg with/without spoofing MetaMask).
   * In these cases, the agent should be used to differentiate different usages of the same wallet.
   */
  name?: string
  description?: string
  url?: string
  icons?: string[]
}

function getWalletConnectMeta(provider: WalletConnectProvider): WalletMeta {
  const { peerMeta } = provider.connector
  return {
    type: WalletType.WALLET_CONNECT,
    agent: peerMeta ? `${peerMeta.name} (WalletConnect)` : '(WalletConnect)',
    ...provider.connector.peerMeta,
  }
}

function getInjectedMeta(provider: ExternalProvider & Record<string, unknown>): WalletMeta {
  const properties = Object.getOwnPropertyNames(provider)
  const names =
    properties
      .filter((name) => name.match(/^is.*$/) && (provider as Record<string, unknown>)[name] === true)
      .map((name) => name.slice(2)) ?? []

  // Many wallets spoof MetaMask by setting `isMetaMask` along with their own identifier,
  // so we sort MetaMask last so that these wallets' names come first.
  names.sort((a, b) => (a === 'MetaMask' ? 1 : b === 'MetaMask' ? -1 : 0))

  // Coinbase Wallet can be connected through an extension or a QR code, with `qrUrl` as the only differentiator,
  // so we capture `qrUrl` in the agent string.
  if (properties.includes('qrUrl') && provider['qrUrl']) {
    names.push('qrUrl')
  }

  return {
    type: WalletType.INJECTED,
    agent: [...names, '(Injected)'].join(' '),
    name: names[0],
    // TODO(WEB-2914): Populate description, url, and icons for known wallets.
  }
}

export function getWalletMeta(provider: JsonRpcProvider): WalletMeta | undefined {
  if (!isWeb3Provider(provider)) return undefined

  if (isWalletConnectProvider(provider.provider)) {
    return getWalletConnectMeta(provider.provider)
  } else {
    return getInjectedMeta(provider.provider)
  }
}
