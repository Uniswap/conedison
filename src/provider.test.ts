import { JsonRpcProvider } from '@ethersproject/providers'

import { INVALID_PARAMS_CODE, signTypedData } from './provider'

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
    beforeEach(() => {
      signer = new JsonRpcProvider().getSigner()
      jest.spyOn(signer, 'getAddress').mockReturnValue(wallet)
    })

    it('signs using eth_signTypedData', async () => {
      const send = jest.spyOn(signer.provider, 'send').mockImplementationOnce((method, params) => {
        if (method === 'eth_signTypedData') return Promise.resolve()
      })

      await signTypedData(signer, domain, types, value)
      expect(send).toHaveBeenCalledWith('eth_signTypedData', [wallet, expect.anything()])
      const data = send.mock.lastCall[1]?.[1]
      expect(JSON.parse(data)).toEqual(expect.objectContaining({ domain, message: value }))
    })

    it('falls back to eth_signTypedData_v4 if the request has invalid params', async () => {
      const send = jest
        .spyOn(signer.provider, 'send')
        .mockImplementationOnce((method) => {
          if (method === 'eth_signTypedData') return Promise.reject({ code: INVALID_PARAMS_CODE })
        })
        .mockImplementationOnce((method, params) => {
          if (method === 'eth_signTypedData_v4') return Promise.resolve(params)
        })
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)

      await signTypedData(signer, domain, types, value)
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('eth_signTypedData failed'), expect.anything())
      expect(send).toHaveBeenCalledWith('eth_signTypedData', [wallet, expect.anything()])
      const data = send.mock.lastCall[1]?.[1]
      expect(JSON.parse(data)).toEqual(expect.objectContaining({ domain, message: value }))
    })

    it('falls back to eth_sign if eth_signTypedData is unimplemented', async () => {
      const send = jest
        .spyOn(signer.provider, 'send')
        .mockImplementationOnce((method) => {
          if (method === 'eth_signTypedData') return Promise.reject({ message: 'method not found' })
        })
        .mockImplementationOnce((method, params) => {
          if (method === 'eth_sign') return Promise.resolve(params)
        })
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)

      await signTypedData(signer, domain, types, value)
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('eth_signTypedData_* failed'),
        expect.anything()
      )
      expect(send).toHaveBeenCalledWith('eth_sign', [wallet, expect.anything()])
      const hash = send.mock.lastCall[1]?.[1]
      expect(hash).toBe('0xbe609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2')
    })
  })
})
