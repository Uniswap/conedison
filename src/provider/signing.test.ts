import { BigNumber } from '@ethersproject/bignumber'
import { ExternalProvider, JsonRpcProvider, JsonRpcSigner, Web3Provider } from '@ethersproject/providers'
import { Mutable } from 'types'

import { signTypedData } from '../provider'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toEqualEncodedValue(data: R): void
    }
    interface ExpectExtendMap {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toEqualEncodedValue: (this: jest.MatcherContext, data: any) => jest.CustomMatcherResult
    }
  }
}

describe('signing', () => {
  describe('signTypedData', () => {
    const wallet = '0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826'
    const domain = {
      name: 'Ether Mail',
      version: '1',
      chainId: 1,
      verifyingContract: '0xcccccccccccccccccccccccccccccccccccccccc',
    }

    const types = {
      Person: [
        { name: 'name', type: 'string' },
        { name: 'wallet', type: 'address' },
      ],
      Mail: [
        { name: 'from', type: 'Person' },
        { name: 'to', type: 'Person' },
        { name: 'contents', type: 'string' },
        { name: 'number', type: 'uint256' },
        { name: 'bignum', type: 'uint256' },
      ],
    }

    const value = {
      from: {
        name: 'Cow',
        wallet,
      },
      to: {
        name: 'Bob',
        wallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
      contents: 'Hello, Bob!',
      number: 9876543210,
      bignum: BigNumber.from(Number.MAX_SAFE_INTEGER.toString()).add(1),
    }

    let signer: JsonRpcSigner
    beforeEach(() => {
      signer = new JsonRpcProvider().getSigner()
      jest.spyOn(signer, 'getAddress').mockResolvedValue(wallet)
    })

    expect.extend({
      toEqualEncodedValue(data) {
        expect(JSON.parse(data)).toEqual(
          expect.objectContaining({ domain, message: { ...value, bignum: expect.anything() } })
        )
        // bignum will not be parsed correctly, so it must be checked explicitly:
        expect(data).toContain(`"bignum":${value.bignum.toString()}`)
        return { pass: true, message: () => 'Expected data to match encoded value' }
      },
    })

    function itFallsBackToEthSignIfUnimplemented(signingMethod: string) {
      it.each(['not found', 'not implemented'])(`falls back to eth_sign if ${signingMethod} is %s`, async (message) => {
        const send = jest
          .spyOn(signer.provider, 'send')
          .mockImplementationOnce((method) => {
            if (method === signingMethod) return Promise.reject({ message: `method ${message}` })
            throw new Error('Unimplemented')
          })
          .mockImplementationOnce((method, params) => {
            if (method === 'eth_sign') return Promise.resolve()
            throw new Error('Unimplemented')
          })
        jest.spyOn(console, 'warn').mockImplementation(() => undefined)

        await signTypedData(signer, domain, types, value)
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('signTypedData: wallet does not implement EIP-712, falling back to eth_sign'),
          expect.anything()
        )
        expect(send).toHaveBeenCalledTimes(2)
        expect(send).toHaveBeenCalledWith(signingMethod, [wallet, expect.anything()])
        expect(send).toHaveBeenCalledWith('eth_sign', [wallet, expect.anything()])
        const hash = send.mock.lastCall[1]?.[1]
        expect(hash).toBe('0x997987773a7c24826f4d5bb58a0adb6909636e0a0def99de063639873969ad96')
      })
    }

    function itFailsIfRejected(signingMethod: string) {
      it('fails if rejected', async () => {
        const send = jest.spyOn(signer.provider, 'send').mockImplementationOnce((method) => {
          if (method === signingMethod) return Promise.reject(new Error('User rejected'))
          throw new Error('Unimplemented')
        })

        await expect(async () => await signTypedData(signer, domain, types, value)).rejects.toThrow('User rejected')
        expect(send).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith(signingMethod, [wallet, expect.anything()])
        const data = send.mock.lastCall[1]?.[1]
        expect(data).toEqualEncodedValue()
      })
    }

    it.only('signs using eth_signTypedData_v4', async () => {
      const send = jest.spyOn(signer.provider, 'send').mockImplementationOnce((method, params) => {
        if (method === 'eth_signTypedData_v4') return Promise.resolve()
        throw new Error('Unimplemented')
      })

      await signTypedData(signer, domain, types, value)
      expect(send).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledWith('eth_signTypedData_v4', [wallet, expect.anything()])
      const data = send.mock.lastCall[1]?.[1]
      expect(data).toEqualEncodedValue()
    })

    itFallsBackToEthSignIfUnimplemented('eth_signTypedData_v4')
    itFailsIfRejected('eth_signTypedData_v4')

    describe('wallets which do not support eth_signTypedData_v4', () => {
      describe.each(['SafePal Wallet', 'Ledger Wallet Connect'])('%s', (name) => {
        beforeEach(() => {
          const web3Provider = signer.provider as Mutable<Web3Provider>
          web3Provider.provider = { isWalletConnect: true, connector: { peerMeta: { name } } } as ExternalProvider
        })

        it('signs using eth_signTypedData', async () => {
          const send = jest.spyOn(signer.provider, 'send').mockImplementationOnce((method, params) => {
            if (method === 'eth_signTypedData') return Promise.resolve()
            throw new Error('Unimplemented')
          })

          await signTypedData(signer, domain, types, value)
          expect(send).toHaveBeenCalledTimes(1)
          expect(send).toHaveBeenCalledWith('eth_signTypedData', [wallet, expect.anything()])
          const data = send.mock.lastCall[1]?.[1]
          expect(data).toEqualEncodedValue()
        })

        itFallsBackToEthSignIfUnimplemented('eth_signTypedData')
        itFailsIfRejected('eth_signTypedData')
      })
    })
  })
})
