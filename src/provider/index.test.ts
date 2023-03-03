import { BigNumber } from '@ethersproject/bignumber'
import { JsonRpcProvider, JsonRpcSigner, TransactionRequest, TransactionResponse } from '@ethersproject/providers'

import { sendTransaction } from '.'
import * as Meta from './meta'

jest.mock('./meta')

describe('sendTransaction', () => {
  const sendUncheckedTransaction = jest.fn()
  const request = { calldata: 'test' } as TransactionRequest
  const response = {} as TransactionResponse
  const signer = { sendUncheckedTransaction } as unknown as JsonRpcSigner
  const provider = {
    estimateGas: jest.fn().mockResolvedValue(BigNumber.from(10)),
    getSigner: jest.fn().mockReturnValue(signer),
    getTransaction: jest.fn().mockReturnValue(response),
  } as unknown as JsonRpcProvider

  beforeEach(() => {
    sendUncheckedTransaction.mockReset()
  })

  it('sends a transaction with default gas margin', async () => {
    await expect(sendTransaction(provider, request)).resolves.toBe(response)
    expect(signer.sendUncheckedTransaction).toHaveBeenCalledWith({ ...request, gasLimit: BigNumber.from(12) })
  })

  it('sends a transaction with configured gas margin', async () => {
    await expect(sendTransaction(provider, request, 0.1)).resolves.toBe(response)
    expect(signer.sendUncheckedTransaction).toHaveBeenCalledWith({ ...request, gasLimit: BigNumber.from(11) })
  })

  it('sends a transaction with no gas margin', async () => {
    await expect(sendTransaction(provider, request, false)).resolves.toBe(response)
    expect(signer.sendUncheckedTransaction).toHaveBeenCalledWith({ ...request })
  })

  describe('with Uniswap Wallet', () => {
    beforeEach(() => {
      const getWalletMeta = Meta.getWalletMeta as jest.Mock
      getWalletMeta.mockReturnValueOnce({ name: 'Uniswap Wallet' })
    })

    it('sends a transaction with no gas limit', async () => {
      await expect(sendTransaction(provider, request)).resolves.toBe(response)
      expect(signer.sendUncheckedTransaction).toHaveBeenCalledWith({ ...request })
    })
  })
})
