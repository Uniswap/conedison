import { JsonRpcProvider } from '@ethersproject/providers'

import { signTypedData } from './provider'

describe('provider', () => {
  describe('signTypedData', () => {
    const wallet = '0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826'
    const domain = {
      name: 'Ether Mail',
      version: '1',
      chainId: '1',
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
    }

    let signer

    describe('metamask', () => {
      beforeEach(() => {
        signer = new JsonRpcProvider('metamask').getSigner()
        jest.spyOn(signer, 'getAddress').mockReturnValue(wallet)
      })

      it('signs using eth_signTypedData_v4', async () => {
        const send = jest.spyOn(signer.provider, 'send').mockImplementationOnce((method, params) => {
          if (method === 'eth_signTypedData_v4') return Promise.resolve()
        })

        await signTypedData(signer, domain, types, value)
        expect(send).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith('eth_signTypedData_v4', [wallet, expect.anything()])
        const data = send.mock.lastCall[1]?.[1]
        expect(JSON.parse(data)).toEqual(expect.objectContaining({ domain, message: value }))
      })
    })

    describe('EIP-1193', () => {
      beforeEach(() => {
        signer = new JsonRpcProvider().getSigner()
        jest.spyOn(signer, 'getAddress').mockReturnValue(wallet)
      })

      it('signs using eth_signTypedData', async () => {
        const send = jest.spyOn(signer.provider, 'send').mockImplementationOnce((method, params) => {
          if (method === 'eth_signTypedData') return Promise.resolve()
        })

        await signTypedData(signer, domain, types, value)
        expect(send).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith('eth_signTypedData', [wallet, expect.anything()])
        const data = send.mock.lastCall[1]?.[1]
        expect(JSON.parse(data)).toEqual(expect.objectContaining({ domain, message: value }))
      })

      it('falls back to eth_signTypedData_v4 if the request has an unknown account', async () => {
        const send = jest
          .spyOn(signer.provider, 'send')
          .mockImplementationOnce((method) => {
            if (method === 'eth_signTypedData') return Promise.reject({ message: 'Unknown account: {...}' })
          })
          .mockImplementationOnce((method, params) => {
            if (method === 'eth_signTypedData_v4') return Promise.resolve()
          })
        jest.spyOn(console, 'warn').mockImplementation(() => undefined)

        await signTypedData(signer, domain, types, value)
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('signTypedData: wallet expects historical parameter ordering, falling back to v4')
        )
        expect(send).toHaveBeenCalledTimes(2)
        expect(send).toHaveBeenCalledWith('eth_signTypedData', [wallet, expect.anything()])
        expect(send).toHaveBeenCalledWith('eth_signTypedData_v4', [wallet, expect.anything()])
        const data = send.mock.lastCall[1]?.[1]
        expect(JSON.parse(data)).toEqual(expect.objectContaining({ domain, message: value }))
      })

      it.each(['not found', 'not implemented'])(
        'falls back to eth_sign if eth_signTypedData is %s',
        async (message) => {
          const send = jest
            .spyOn(signer.provider, 'send')
            .mockImplementationOnce((method) => {
              if (method === 'eth_signTypedData') return Promise.reject({ message: `method ${message}` })
            })
            .mockImplementationOnce((method, params) => {
              if (method === 'eth_sign') return Promise.resolve()
            })
          jest.spyOn(console, 'warn').mockImplementation(() => undefined)

          await signTypedData(signer, domain, types, value)
          expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('signTypedData: wallet does not implement EIP-712, falling back to sign')
          )
          expect(send).toHaveBeenCalledTimes(2)
          expect(send).toHaveBeenCalledWith('eth_signTypedData', [wallet, expect.anything()])
          expect(send).toHaveBeenCalledWith('eth_sign', [wallet, expect.anything()])
          const hash = send.mock.lastCall[1]?.[1]
          expect(hash).toBe('0xbe609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2')
        }
      )

      it('fails if rejected', async () => {
        const send = jest.spyOn(signer.provider, 'send').mockImplementationOnce((method) => {
          if (method === 'eth_signTypedData') return Promise.reject(new Error('User rejected'))
        })

        await expect(async () => await signTypedData(signer, domain, types, value)).rejects.toThrow('User rejected')
        expect(send).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith('eth_signTypedData', [wallet, expect.anything()])
        const data = send.mock.lastCall[1]?.[1]
        expect(JSON.parse(data)).toEqual(expect.objectContaining({ domain, message: value }))
      })
    })
  })
})
