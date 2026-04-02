import invariant from 'tiny-invariant'
import { Currency, Price, Token } from '@ring-protocol/sdk-core'

import { Pair } from './pair'
import { getFewTokenFromOriginalToken, isFewToken } from '@ring-protocol/v2-sdk'

export class Route<TInput extends Currency, TOutput extends Currency> {
  public readonly pairs: Pair[]
  public readonly path: Token[]
  public readonly input: TInput
  public readonly output: TOutput

  public constructor(pairs: Pair[], input: TInput, output: TOutput) {
    invariant(pairs.length > 0, 'PAIRS')
    const chainId: number = pairs[0].chainId
    invariant(
      pairs.every((pair) => pair.chainId === chainId),
      'CHAIN_IDS'
    )

    const wrappedInput = input.wrapped
    // invariant(pairs[0].involvesToken(wrappedInput), 'INPUT')
    // invariant(typeof output === 'undefined' || pairs[pairs.length - 1].involvesToken(output.wrapped), 'OUTPUT')
    const wrappedOutput = output.wrapped

    /**
     * Add an isFewToken check, if it's not, then use getFewTokenFromOriginalToken,
     * this way we can avoid Route construction issues. Other places that are modified
     * also need to perform this check. This change is mainly for compatibility with
     * origin token in Few V2.
     */
    if (
      isFewToken(wrappedInput) ||
      isFewToken(wrappedOutput) ||
      isFewToken(pairs[0].token0) ||
      isFewToken(pairs[0].token1)
    ) {
      const fewWrappedInput = getFewTokenFromOriginalToken(wrappedInput.wrapped, chainId)
      const fewWrappedOutput = getFewTokenFromOriginalToken(wrappedOutput.wrapped, chainId)
      invariant(pairs[0].involvesToken(fewWrappedInput), 'INPUT')
      invariant(typeof output === 'undefined' || pairs[pairs.length - 1].involvesToken(fewWrappedOutput), 'OUTPUT')
      const path: Token[] = [fewWrappedInput]
      for (const [i, pair] of pairs.entries()) {
        const currentInput = path[i]
        invariant(currentInput.equals(pair.token0) || currentInput.equals(pair.token1), 'PATH')
        const output = currentInput.equals(pair.token0) ? pair.token1 : pair.token0
        path.push(output)
      }

      this.pairs = pairs // few token pairs
      this.path = path // few token path
      this.input = input // origin token
      this.output = output // origin token
    } else {
      invariant(pairs[0].involvesToken(wrappedInput), 'INPUT')
      invariant(typeof output === 'undefined' || pairs[pairs.length - 1].involvesToken(output.wrapped), 'OUTPUT')
      const path: Token[] = [wrappedInput]
      for (const [i, pair] of pairs.entries()) {
        const currentInput = path[i]
        invariant(currentInput.equals(pair.token0) || currentInput.equals(pair.token1), 'PATH')
        const output = currentInput.equals(pair.token0) ? pair.token1 : pair.token0
        path.push(output)
      }

      this.pairs = pairs // origin token pairs
      this.path = path // origin token path
      this.input = input // origin token
      this.output = output // origin token
    }
  }

  private _midPrice: Price<TInput, TOutput> | null = null

  public get midPrice(): Price<TInput, TOutput> {
    if (this._midPrice !== null) return this._midPrice
    const prices: Price<Currency, Currency>[] = []
    for (const [i, pair] of this.pairs.entries()) {
      prices.push(
        this.path[i].equals(pair.token0)
          ? new Price(pair.reserve0.currency, pair.reserve1.currency, pair.reserve0.quotient, pair.reserve1.quotient)
          : new Price(pair.reserve1.currency, pair.reserve0.currency, pair.reserve1.quotient, pair.reserve0.quotient)
      )
    }
    const reduced = prices.slice(1).reduce((accumulator, currentValue) => accumulator.multiply(currentValue), prices[0])
    return (this._midPrice = new Price(this.input, this.output, reduced.denominator, reduced.numerator))
  }

  public get chainId(): number {
    return this.pairs[0].chainId
  }
}
