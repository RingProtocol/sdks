// entities/route.ts

import { Route as V2RouteSDK, Pair } from '@ring-protocol/uniswap-v2-sdk'
import { Route as FewV2RouteSDK, Pair as FewPair, getFewTokenFromOriginalToken } from '@ring-protocol/v2-sdk'
import { Route as V3RouteSDK, Pool as V3Pool } from '@ring-protocol/v3-sdk'
import { Route as V4RouteSDK, Pool as V4Pool } from '@ring-protocol/v4-sdk'
import { Protocol } from './protocol'
import { ChainId, Currency, Price, Token } from '@ring-protocol/sdk-core'
import { MixedRouteSDK } from './mixedRoute/route'

const FEWV2_UNSUPPORTED_CHAIN_IDS: ChainId[] = [
  ChainId.POLYGON,
  196 as ChainId, // XLAYER_MAINNET (not yet in published sdk-core)
  ChainId.STORY_MAINNET,
  ChainId.UNICHAIN,
  ChainId.ARBITRUM_ONE,
  ChainId.BASE,
  ChainId.OPTIMISM,
  ChainId.SONEIUM,
  ChainId.MONAD,
  ChainId.WORLDCHAIN,

  // testnets
  ChainId.MONAD_TESTNET,
  ChainId.UNICHAIN_SEPOLIA,
]

// Helper function to get the pathInput and pathOutput for a FEWV2 / V2 / V3 route
// currency could be native so we check against the wrapped version as they don't support native ETH in path
export function getPathToken(currency: Currency, pool: FewPair | Pair | V3Pool): Token {
  const isSupportFewV2 = !FEWV2_UNSUPPORTED_CHAIN_IDS.includes(currency.chainId)

  if (isSupportFewV2) {
    const fewToken = getFewTokenFromOriginalToken(currency.wrapped, currency.chainId)
    if (pool instanceof FewPair || pool instanceof Pair) {
      if (pool.token0.wrapped.equals(fewToken)) {
        return pool.token0
      } else if (pool.token1.wrapped.equals(fewToken)) {
        return pool.token1
      } else if (pool.token0.wrapped.equals(currency.wrapped)) {
        return pool.token0
      } else if (pool.token1.wrapped.equals(currency.wrapped)) {
        return pool.token1
      } else {
        throw new Error(
          `Expected fewToken ${currency.symbol} to be either ${pool.token0.symbol} or ${pool.token1.symbol}`
        )
      }
    } else {
      if (pool.token0.wrapped.equals(currency.wrapped)) {
        return pool.token0
      } else if (pool.token1.wrapped.equals(currency.wrapped)) {
        return pool.token1
      } else if (pool.token0.wrapped.equals(fewToken)) {
        return pool.token0
      } else if (pool.token1.wrapped.equals(fewToken)) {
        return pool.token1
      } else {
        throw new Error(`Expected token ${currency.symbol} to be either ${pool.token0.symbol} or ${pool.token1.symbol}`)
      }
    }
  } else {
    if (pool.token0.wrapped.equals(currency.wrapped)) {
      return pool.token0
    } else if (pool.token1.wrapped.equals(currency.wrapped)) {
      return pool.token1
    } else {
      throw new Error(`Expected token ${currency.symbol} to be either ${pool.token0.symbol} or ${pool.token1.symbol}`)
    }
  }
}

export interface IRoute<
  TInput extends Currency,
  TOutput extends Currency,
  TPool extends FewPair | Pair | V3Pool | V4Pool
> {
  protocol: Protocol
  // array of pools if v3 or pairs if v2
  pools: TPool[]
  path: Currency[]
  midPrice: Price<TInput, TOutput>
  input: TInput
  output: TOutput
  pathInput: Currency
  pathOutput: Currency
}

// V2 route wrapper
export class RouteV2<TInput extends Currency, TOutput extends Currency>
  extends V2RouteSDK<TInput, TOutput>
  implements IRoute<TInput, TOutput, Pair> {
  public readonly protocol: Protocol = Protocol.V2
  public readonly pools: Pair[]
  public pathInput: Currency
  public pathOutput: Currency

  constructor(v2Route: V2RouteSDK<TInput, TOutput>) {
    super(v2Route.pairs, v2Route.input, v2Route.output)
    this.pools = this.pairs
    this.pathInput = getPathToken(v2Route.input, this.pairs[0])
    this.pathOutput = getPathToken(v2Route.output, this.pairs[this.pairs.length - 1])
  }
}

// Few V2 route wrapper
export class FewRouteV2<TInput extends Currency, TOutput extends Currency>
  extends FewV2RouteSDK<TInput, TOutput>
  implements IRoute<TInput, TOutput, FewPair> {
  public readonly protocol: Protocol = Protocol.FEWV2
  public readonly pools: FewPair[]
  public pathInput: Currency
  public pathOutput: Currency

  constructor(fewV2Route: FewV2RouteSDK<TInput, TOutput>) {
    super(fewV2Route.pairs, fewV2Route.input, fewV2Route.output)
    this.pools = this.pairs
    this.pathInput = getPathToken(fewV2Route.input, this.pairs[0])
    this.pathOutput = getPathToken(fewV2Route.output, this.pairs[this.pairs.length - 1])
  }
}

// V3 route wrapper
export class RouteV3<TInput extends Currency, TOutput extends Currency>
  extends V3RouteSDK<TInput, TOutput> {
  public readonly protocol: Protocol = Protocol.V3
  public readonly path: Token[]
  public pathInput: Currency
  public pathOutput: Currency

  constructor(v3Route: V3RouteSDK<TInput, TOutput>) {
    super(v3Route.pools, v3Route.input, v3Route.output)
    this.path = v3Route.tokenPath
    this.pathInput = getPathToken(v3Route.input, this.pools[0])
    this.pathOutput = getPathToken(v3Route.output, this.pools[this.pools.length - 1])
  }
}

// V4 route wrapper
export class RouteV4<TInput extends Currency, TOutput extends Currency>
  extends V4RouteSDK<TInput, TOutput> {
  public readonly protocol: Protocol = Protocol.V4
  public readonly path: Currency[]

  constructor(v4Route: V4RouteSDK<TInput, TOutput>) {
    super(v4Route.pools, v4Route.input, v4Route.output)
    this.path = v4Route.currencyPath
  }
}

// Mixed route wrapper
export class MixedRoute<TInput extends Currency, TOutput extends Currency>
  extends MixedRouteSDK<TInput, TOutput>
  implements IRoute<TInput, TOutput, FewPair | Pair | V3Pool | V4Pool> {
  public readonly protocol: Protocol = Protocol.MIXED

  constructor(mixedRoute: MixedRouteSDK<TInput, TOutput>) {
    super(mixedRoute.pools, mixedRoute.input, mixedRoute.output)
  }
}
