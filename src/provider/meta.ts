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
  UNKNOWN = 'Unknown',
}

export interface WalletMeta extends Partial<NonNullable<WalletConnectProvider['connector']['peerMeta']>> {
  type: WalletType
}

function getWalletConnectMeta(provider: WalletConnectProvider): WalletMeta {
  return {
    type: WalletType.WALLET_CONNECT,
    ...provider.connector.peerMeta,
  }
}

function getInjectedMeta(provider: ExternalProvider & Record<string, unknown>): WalletMeta {
  const properties = Object.getOwnPropertyNames(provider)
  const names =
    properties
      .filter((name) => name.match(/^is.*$/) && (provider as Record<string, unknown>)[name])
      .map((name) => name.slice(2)) ?? []

  // Add qrUrl to identify QR-initiated connections (eg for Coinbase Wallet via mobile QR).
  if (properties.includes('qrUrl') && provider['qrUrl']) {
    names.push('qrUrl')
  }

  // Sort MetaMask last, so that wallets spoofing MetaMask list themselves first.
  names.sort((a, b) => (a === 'MetaMask' ? 1 : b === 'MetaMask' ? -1 : 0))

  return {
    type: WalletType.INJECTED,
    name: names.join(' '),
    // TODO(WEB-2914): Populate description, url, and icons for known wallets.
  }
}

export function getWalletMeta(provider: JsonRpcProvider): WalletMeta {
  if (!isWeb3Provider(provider)) return { type: WalletType.UNKNOWN }

  if (isWalletConnectProvider(provider.provider)) {
    return getWalletConnectMeta(provider.provider)
  } else {
    return getInjectedMeta(provider.provider)
  }
}

export function getWalletName(provider: JsonRpcProvider): string | undefined {
  return getWalletMeta(provider).name
}
