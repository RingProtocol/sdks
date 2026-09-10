import { RoutePlanner, CommandType } from '../../utils/routerCommands'
import { Pair as FewPair, getFewTokenFromOriginalToken, isFewToken, Trade as RingV2Trade } from '@ring-protocol/v2-sdk'
import { Trade as V2Trade, Pair } from '@ring-protocol/uniswap-v2-sdk'
import { Trade as V3Trade, Pool as V3Pool, Route as V3Route, encodeRouteToPath } from '@ring-protocol/v3-sdk'
import {
  Route as V4Route,
  Trade as V4Trade,
  Pool as V4Pool,
  V4Planner,
  encodeRouteToPath as encodeV4RouteToPath,
  Actions,
} from '@ring-protocol/v4-sdk'
import {
  Trade as RouterTrade,
  MixedRouteTrade,
  Protocol,
  IRoute,
  FewRouteV2,
  RouteV2,
  RouteV3,
  MixedRouteSDK,
  MixedRoute,
  SwapOptions as RouterSwapOptions,
  getOutputOfPools,
  encodeMixedRouteToPath,
  partitionMixedRouteByProtocol,
} from '@ring-protocol/router-sdk'
import { Permit2Permit } from '../../utils/inputTokens'
import { getPathCurrency } from '../../utils/pathCurrency'
import { Currency, TradeType, Token, CurrencyAmount, Percent } from '@ring-protocol/sdk-core'
import { Command, RouterActionType, TradeConfig } from '../Command'
import { SENDER_AS_RECIPIENT, ROUTER_AS_RECIPIENT, CONTRACT_BALANCE, ETH_ADDRESS } from '../../utils/constants'
import { getCurrencyAddress } from '../../utils/getCurrencyAddress'
import { encodeFeeBips } from '../../utils/numbers'
import { BigNumber, BigNumberish } from 'ethers'
import { TPool } from '@ring-protocol/router-sdk'
import { FEW_WRAPPED_NATIVE_CURRENCY } from '../../utils/token'

export type FlatFeeOptions = {
  amount: BigNumberish
  recipient: string
}

// the existing router permit object doesn't include enough data for permit2
// so we extend swap options with the permit2 permit
// when safe mode is enabled, the SDK will add an extra ETH sweep for security
// when useRouterBalance is enabled the SDK will use the balance in the router for the swap
export type SwapOptions = Omit<RouterSwapOptions, 'inputTokenPermit'> & {
  useRouterBalance?: boolean
  inputTokenPermit?: Permit2Permit
  flatFee?: FlatFeeOptions
  safeMode?: boolean
}

const REFUND_ETH_PRICE_IMPACT_THRESHOLD = new Percent(50, 100)

interface Swap<TInput extends Currency, TOutput extends Currency> {
  route: IRoute<TInput, TOutput, TPool>
  inputAmount: CurrencyAmount<TInput>
  outputAmount: CurrencyAmount<TOutput>
}

// Wrapper for uniswap router-sdk trade entity to encode swaps for Universal Router
// also translates trade objects from previous (v2, v3) SDKs
export class UniswapTrade implements Command {
  readonly tradeType: RouterActionType = RouterActionType.UniswapTrade
  readonly payerIsUser: boolean

  constructor(public trade: RouterTrade<Currency, Currency, TradeType>, public options: SwapOptions) {
    if (!!options.fee && !!options.flatFee) throw new Error('Only one fee option permitted')

    if (this.inputRequiresWrap || this.inputRequiresUnwrap || this.options.useRouterBalance) {
      this.payerIsUser = false
    } else {
      this.payerIsUser = true
    }
  }

  get isAllV4(): boolean {
    let result = true
    for (const swap of this.trade.swaps) {
      result = result && swap.route.protocol == Protocol.V4
    }
    return result
  }

  get hasFewV2(): boolean {
    let result = false
    for (const swap of this.trade.swaps) {
      result = result || swap.route.protocol == Protocol.FEWV2
    }
    return result
  }

  // this.trade.swaps is an array of swaps / trades.
  // we are iterating over one swap (trade) at a time so length is 1
  // route is either v2, v3, v4, or mixed
  // pathInput and pathOutput are the currencies of the input and output of the route
  // this.trade.inputAmount is the input currency of the trade (could be different from pathInput)
  // this.trade.outputAmount is the output currency of the trade (could be different from pathOutput)
  // each route can have multiple pools
  get inputRequiresWrap(): boolean {
    const swap = this.trade.swaps[0]
    const route = swap.route
    const firstPool = route.pools[0]

    if (firstPool instanceof V4Pool) {
      // If first pool is a v4 pool and input currency is native and the path input currency in the route is not native, we need to wrap.
      return (
        this.trade.inputAmount.currency.isNative &&
        !(this.trade.swaps[0].route as unknown as V4Route<Currency, Currency>).pathInput.isNative
      )
    }
    // If first pool is not a v4 pool and input currency is native, we need to wrap
    return this.trade.inputAmount.currency.isNative
  }

  get inputRequiresUnwrap(): boolean {
    const swap = this.trade.swaps[0]
    const route = swap.route
    const firstPool = route.pools[0]

    if (firstPool instanceof V4Pool) {
      // If the first pool is a v4 pool and input currency is not native and the path input currency is native, we need to unwrap
      return (
        !this.trade.inputAmount.currency.isNative &&
        (this.trade.swaps[0].route as unknown as V4Route<Currency, Currency>).pathInput.isNative
      )
    }
    // If the first pool is not a v4 pool, we don't need to unwrap.
    return false
  }

  get outputRequiresWrap(): boolean {
    const swap = this.trade.swaps[0]
    const lastRoute = swap.route
    const lastPool = lastRoute.pools[lastRoute.pools.length - 1]

    // if last pool is v4:
    if (lastPool instanceof V4Pool) {
      // If output currency is not native but path currency output is native, we need to wrap
      return (
        !this.trade.outputAmount.currency.isNative &&
        (lastRoute as unknown as V4Route<Currency, Currency>).pathOutput.isNative
      )
    }
    // if last pool is not v4:
    // we do not need to wrap because v2 and v3 pools already require wrapped tokens
    return false
  }

  get outputRequiresUnwrap(): boolean {
    const swap = this.trade.swaps[0]
    const lastRoute = swap.route
    const lastPool = lastRoute.pools[lastRoute.pools.length - 1]

    // if last pool is v4:
    if (lastPool instanceof V4Pool) {
      // If output currency is native and path currency output is not native, we need to unwrap
      return (
        this.trade.outputAmount.currency.isNative &&
        !(this.trade.swaps[0].route as unknown as V4Route<Currency, Currency>).pathOutput.isNative
      )
    }
    // else: if path output currency is native, we need to unwrap because v2 and v3 pools already require wrapped tokens
    return this.trade.outputAmount.currency.isNative
  }

  get outputRequiresTransition(): boolean {
    return this.outputRequiresWrap || this.outputRequiresUnwrap
  }

  encode(planner: RoutePlanner, _config: TradeConfig): void {
    // If the input currency is the native currency, we need to wrap it with the router as the recipient
    if (this.inputRequiresWrap) {
      // TODO: optimize if only one v2 pool we can directly send this to the pool
      planner.addCommand(CommandType.WRAP_ETH, [
        ROUTER_AS_RECIPIENT,
        this.trade.maximumAmountIn(this.options.slippageTolerance).quotient.toString(),
      ])
    } else if (this.inputRequiresUnwrap) {
      // send wrapped token to router to unwrap
      planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
        (this.trade.inputAmount.currency as Token).address,
        ROUTER_AS_RECIPIENT,
        this.trade.maximumAmountIn(this.options.slippageTolerance).quotient.toString(),
      ])
      planner.addCommand(CommandType.UNWRAP_WETH, [ROUTER_AS_RECIPIENT, 0])
    }
    // The overall recipient at the end of the trade, SENDER_AS_RECIPIENT uses the msg.sender
    this.options.recipient = this.options.recipient ?? SENDER_AS_RECIPIENT

    // flag for whether we want to perform slippage check on aggregate output of multiple routes
    //   1. when there are >2 exact input trades. this is only a heuristic,
    //      as it's still more gas-expensive even in this case, but has benefits
    //      in that the reversion probability is lower
    const performAggregatedSlippageCheck =
      this.trade.tradeType === TradeType.EXACT_INPUT && this.trade.routes.length > 2
    const routerMustCustody =
      performAggregatedSlippageCheck || this.outputRequiresTransition || hasFeeOption(this.options)

    for (const swap of this.trade.swaps) {
      switch (swap.route.protocol) {
        case Protocol.FEWV2:
          addRingV2Swap(planner, swap, this.trade.tradeType, this.options, this.payerIsUser, routerMustCustody)
          break
        case Protocol.V2:
          addV2Swap(planner, swap, this.trade.tradeType, this.options, this.payerIsUser, routerMustCustody)
          break
        case Protocol.V3:
          addV3Swap(planner, swap, this.trade.tradeType, this.options, this.payerIsUser, routerMustCustody)
          break
        case Protocol.V4:
          addV4Swap(this.trade.swaps, planner, swap, this.trade.tradeType, this.options, this.payerIsUser, routerMustCustody)
          break
        case Protocol.MIXED:
          addMixedSwap(this.trade.swaps, planner, swap, this.trade.tradeType, this.options, this.payerIsUser, routerMustCustody)
          break
        default:
          throw new Error('UNSUPPORTED_TRADE_PROTOCOL')
      }
    }

    let minimumAmountOut: BigNumber = BigNumber.from(
      this.trade.minimumAmountOut(this.options.slippageTolerance).quotient.toString()
    )
    // The router custodies for 3 reasons: to unwrap, to take a fee, and/or to do a slippage check
    if (routerMustCustody) {
      const pools = this.trade.swaps[0].route.pools
      const pathOutputCurrencyAddress = getCurrencyAddress(
        getPathCurrency(this.trade.outputAmount.currency, pools[pools.length - 1])
      )

      // If there is a fee, that percentage is sent to the fee recipient
      // In the case where ETH is the output currency, the fee is taken in WETH (for gas reasons)
      if (!!this.options.fee) {
        const feeBips = encodeFeeBips(this.options.fee.fee)
        planner.addCommand(CommandType.PAY_PORTION, [pathOutputCurrencyAddress, this.options.fee.recipient, feeBips])

        // If the trade is exact output, and a fee was taken, we must adjust the amount out to be the amount after the fee
        // Otherwise we continue as expected with the trade's normal expected output
        if (this.trade.tradeType === TradeType.EXACT_OUTPUT) {
          minimumAmountOut = minimumAmountOut.sub(minimumAmountOut.mul(feeBips).div(10000))
        }
      }

      // If there is a flat fee, that absolute amount is sent to the fee recipient
      // In the case where ETH is the output currency, the fee is taken in WETH (for gas reasons)
      if (!!this.options.flatFee) {
        const feeAmount = this.options.flatFee.amount
        if (minimumAmountOut.lt(feeAmount)) throw new Error('Flat fee amount greater than minimumAmountOut')

        planner.addCommand(CommandType.TRANSFER, [pathOutputCurrencyAddress, this.options.flatFee.recipient, feeAmount])

        // If the trade is exact output, and a fee was taken, we must adjust the amount out to be the amount after the fee
        // Otherwise we continue as expected with the trade's normal expected output
        if (this.trade.tradeType === TradeType.EXACT_OUTPUT) {
          minimumAmountOut = minimumAmountOut.sub(feeAmount)
        }
      }

      // The remaining tokens that need to be sent to the user after the fee is taken will be caught
      // by this if-else clause.
      if (this.outputRequiresUnwrap) {
        planner.addCommand(CommandType.UNWRAP_WETH, [this.options.recipient, '0'])
        planner.addCommand(CommandType.SWEEP, [
          getCurrencyAddress(this.trade.outputAmount.currency),
          SENDER_AS_RECIPIENT,
          '0',
        ])
      } else if (this.outputRequiresWrap) {
        planner.addCommand(CommandType.WRAP_ETH, [this.options.recipient, CONTRACT_BALANCE])
      } else {
        if (this.hasFewV2) {
          planner.addCommand(CommandType.SWEEP, [
            getCurrencyAddress(this.trade.outputAmount.currency),
            this.options.recipient,
            '0',
          ])
        } else {
          planner.addCommand(CommandType.SWEEP, [
            getCurrencyAddress(this.trade.outputAmount.currency),
            this.options.recipient,
            minimumAmountOut,
          ])
        }
      }
    }

    const fwWETH = FEW_WRAPPED_NATIVE_CURRENCY[this.trade.inputAmount.currency.wrapped.chainId]

    // for exactOutput swaps with native input or that perform an inputToken transition (wrap or unwrap)
    // we need to send back the change to the user
    // Chains without few wrapped native (e.g. X Layer 196, MegaETH 4326) use WETH-only path; only use fwWETH when defined
    if (this.trade.tradeType === TradeType.EXACT_OUTPUT || riskOfPartialFill(this.trade)) {
      if (this.inputRequiresWrap) {
        if (fwWETH) {
          planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [fwWETH.address, ROUTER_AS_RECIPIENT, '0'])
        }
        planner.addCommand(CommandType.UNWRAP_WETH, [this.options.recipient, 0])
        planner.addCommand(CommandType.SWEEP, [ETH_ADDRESS, this.options.recipient, 0])
      } else if (this.inputRequiresUnwrap) {
        planner.addCommand(CommandType.WRAP_ETH, [this.options.recipient, CONTRACT_BALANCE])
      } else if (this.trade.inputAmount.currency.isNative) {
        if (fwWETH) {
          planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [fwWETH.address, ROUTER_AS_RECIPIENT, '0'])
        }
        planner.addCommand(CommandType.UNWRAP_WETH, [SENDER_AS_RECIPIENT, 0])
        // must refund extra native currency sent along for native v4 trades (no input transition)
        planner.addCommand(CommandType.SWEEP, [ETH_ADDRESS, this.options.recipient, 0])
      }

      planner.addCommand(CommandType.SWEEP, [this.trade.inputAmount.currency.wrapped.address, SENDER_AS_RECIPIENT, '0'])
      planner.addCommand(CommandType.SWEEP, [
        this.trade.outputAmount.currency.wrapped.address,
        SENDER_AS_RECIPIENT,
        '0',
      ])
    }

    if (this.options.safeMode) planner.addCommand(CommandType.SWEEP, [ETH_ADDRESS, this.options.recipient, 0])
  }
}

// encode a ring v2 swap
function addRingV2Swap<TInput extends Currency, TOutput extends Currency>(
  planner: RoutePlanner,
  { route, inputAmount, outputAmount }: Swap<TInput, TOutput>,
  tradeType: TradeType,
  options: SwapOptions,
  payerIsUser: boolean,
  routerMustCustody: boolean
): void {
  const trade = new RingV2Trade(
    route as FewRouteV2<TInput, TOutput>,
    tradeType == TradeType.EXACT_INPUT ? inputAmount : outputAmount,
    tradeType
  )
  const pathInput = route.path[0]
  const pathOutput = route.path[route.path.length - 1]

  if (!trade.inputAmount.currency.isNative) {
    // send wrapped token to router to unwrap
    planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
      (trade.inputAmount.currency as Token).address,
      ROUTER_AS_RECIPIENT,
      trade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
    ])
  }

  planner.addCommand(CommandType.WRAP_FEW_TOKEN, [
    trade.inputAmount.currency.wrapped.address,
    ROUTER_AS_RECIPIENT,
    trade.inputAmount.quotient.toString(),
  ])

  payerIsUser = false
  routerMustCustody = true // TOTO, check again

  if (tradeType == TradeType.EXACT_INPUT) {
    planner.addCommand(CommandType.FEW_V2_SWAP_EXACT_IN, [
      // if native, we have to unwrap so keep in the router for now
      routerMustCustody ? ROUTER_AS_RECIPIENT : options.recipient,
      trade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
      // if router will custody funds, we do aggregated slippage check from router
      routerMustCustody ? 0 : trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
      route.path.map((token) => token.wrapped.address),
      payerIsUser,
    ])
  } else if (tradeType == TradeType.EXACT_OUTPUT) {
    planner.addCommand(CommandType.FEW_V2_SWAP_EXACT_OUT, [
      routerMustCustody ? ROUTER_AS_RECIPIENT : options.recipient,
      trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
      trade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
      route.path.map((token) => token.wrapped.address),
      payerIsUser,
    ])
  }

  const fewOutputToken = getFewTokenFromOriginalToken(
    trade.outputAmount.currency.wrapped,
    trade.outputAmount.currency.chainId
  )

  const fwWETH = FEW_WRAPPED_NATIVE_CURRENCY[trade.inputAmount.currency.wrapped.chainId]

  if (outputAmount.currency.isNative) {
    // Chains without few wrapped native (e.g. X Layer 196, MegaETH 4326): unwrap WETH to native instead of fwWETH
    if (fwWETH) {
      planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [
        fwWETH.address,
        ROUTER_AS_RECIPIENT,
        trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
      ])
    } else {
      planner.addCommand(CommandType.UNWRAP_WETH, [
        options.recipient,
        trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
      ])
    }
  } else {
    if (isFewToken(route.pathInput.wrapped) && isFewToken(route.pathOutput.wrapped)) {
      planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [
        fewOutputToken.address,
        SENDER_AS_RECIPIENT,
        trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
      ])
      planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [pathInput.wrapped.address, SENDER_AS_RECIPIENT, '0'])
      planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [pathOutput.wrapped.address, SENDER_AS_RECIPIENT, '0'])
    }
  }
}

// encode a uniswap v2 swap
function addV2Swap<TInput extends Currency, TOutput extends Currency>(
  planner: RoutePlanner,
  { route, inputAmount, outputAmount }: Swap<TInput, TOutput>,
  tradeType: TradeType,
  options: SwapOptions,
  payerIsUser: boolean,
  routerMustCustody: boolean
): void {
  const trade = new V2Trade(
    route as RouteV2<TInput, TOutput>,
    tradeType == TradeType.EXACT_INPUT ? inputAmount : outputAmount,
    tradeType
  )

  const pathInput = route.path[0]
  const pathOutput = route.path[route.path.length - 1]

  if (isFewToken(route.pathInput.wrapped) && isFewToken(route.pathOutput.wrapped)) {
    if (!trade.inputAmount.currency.isNative) {
      // send wrapped token to router to unwrap
      planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
        (trade.inputAmount.currency as Token).address,
        ROUTER_AS_RECIPIENT,
        trade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
      ])
    }

    planner.addCommand(CommandType.WRAP_FEW_TOKEN, [
      trade.inputAmount.currency.wrapped.address,
      ROUTER_AS_RECIPIENT,
      trade.inputAmount.currency.isNative ? CONTRACT_BALANCE : trade.inputAmount.quotient.toString(),
    ])

    payerIsUser = false
    routerMustCustody = true // TOTO, check again

    if (tradeType == TradeType.EXACT_INPUT) {
      planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
        // if native, we have to unwrap so keep in the router for now
        routerMustCustody ? ROUTER_AS_RECIPIENT : options.recipient,
        trade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
        // if router will custody funds, we do aggregated slippage check from router
        routerMustCustody ? 0 : trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
        route.path.map((token) => token.wrapped.address),
        payerIsUser,
      ])
    } else if (tradeType == TradeType.EXACT_OUTPUT) {
      planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
        routerMustCustody ? ROUTER_AS_RECIPIENT : options.recipient,
        trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
        trade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
        route.path.map((token) => token.wrapped.address),
        payerIsUser,
      ])
    }

    const fewOutputToken = getFewTokenFromOriginalToken(
      trade.outputAmount.currency.wrapped,
      trade.outputAmount.currency.chainId
    )

    if (isFewToken(pathInput.wrapped) && isFewToken(pathOutput.wrapped)) {
      if (outputAmount.currency.isNative) {
        planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [
          fewOutputToken.address,
          ROUTER_AS_RECIPIENT,
          trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
        ])
      } else {
        planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [
          fewOutputToken.address,
          SENDER_AS_RECIPIENT,
          trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
        ])
      }
      planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [pathInput.wrapped.address, SENDER_AS_RECIPIENT, '0'])
      planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [pathOutput.wrapped.address, SENDER_AS_RECIPIENT, '0'])
    }
  } else {
    if (tradeType == TradeType.EXACT_INPUT) {
      planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
        // if native, we have to unwrap so keep in the router for now
        routerMustCustody ? ROUTER_AS_RECIPIENT : options.recipient,
        trade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
        // if router will custody funds, we do aggregated slippage check from router
        routerMustCustody ? 0 : trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
        route.path.map((token) => token.wrapped.address),
        payerIsUser,
      ])
    } else if (tradeType == TradeType.EXACT_OUTPUT) {
      planner.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
        routerMustCustody ? ROUTER_AS_RECIPIENT : options.recipient,
        trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
        trade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
        route.path.map((token) => token.wrapped.address),
        payerIsUser,
      ])
    }
  }
}

// encode a uniswap v3 swap
function addV3Swap<TInput extends Currency, TOutput extends Currency>(
  planner: RoutePlanner,
  { route, inputAmount, outputAmount }: Swap<TInput, TOutput>,
  tradeType: TradeType,
  options: SwapOptions,
  payerIsUser: boolean,
  routerMustCustody: boolean
): void {
  const trade = V3Trade.createUncheckedTrade({
    route: route as RouteV3<TInput, TOutput>,
    inputAmount,
    outputAmount,
    tradeType,
  })

  const pathInput = route.path[0]
  const pathOutput = route.path[route.path.length - 1]

  // const fwWETH = FEW_WRAPPED_NATIVE_CURRENCY[trade.inputAmount.currency.wrapped.chainId]

  if (isFewToken(route.pathInput.wrapped) && isFewToken(route.pathOutput.wrapped)) {
    if (!trade.inputAmount.currency.isNative) {
      // send wrapped token to router to unwrap
      planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
        (trade.inputAmount.currency as Token).address,
        ROUTER_AS_RECIPIENT,
        trade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
      ])
    }

    planner.addCommand(CommandType.WRAP_FEW_TOKEN, [
      trade.inputAmount.currency.wrapped.address,
      ROUTER_AS_RECIPIENT,
      trade.inputAmount.currency.isNative ? CONTRACT_BALANCE : trade.inputAmount.quotient.toString(),
    ])

    payerIsUser = false
    routerMustCustody = true // TOTO, check again

    const fewCurrencyIn = getFewTokenFromOriginalToken(route.input.wrapped, route.input.chainId)
    const fewCurrencyOut = getFewTokenFromOriginalToken(route.output.wrapped, route.output.chainId)

    const v3Route = route as RouteV3<TInput, TOutput>
    const newV3Route = new V3Route(v3Route.pools, fewCurrencyIn, fewCurrencyOut)

    const path = encodeRouteToPath(newV3Route as RouteV3<TInput, TOutput>, trade.tradeType === TradeType.EXACT_OUTPUT)
    if (tradeType == TradeType.EXACT_INPUT) {
      planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
        routerMustCustody ? ROUTER_AS_RECIPIENT : options.recipient,
        trade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
        routerMustCustody ? 0 : trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
        path,
        payerIsUser,
      ])
    } else if (tradeType == TradeType.EXACT_OUTPUT) {
      planner.addCommand(CommandType.V3_SWAP_EXACT_OUT, [
        routerMustCustody ? ROUTER_AS_RECIPIENT : options.recipient,
        trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
        trade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
        path,
        payerIsUser,
      ])
    }

    const fewInputToken = getFewTokenFromOriginalToken(
      trade.inputAmount.currency.wrapped,
      trade.inputAmount.currency.chainId
    )

    const fewOutputToken = getFewTokenFromOriginalToken(
      trade.outputAmount.currency.wrapped,
      trade.outputAmount.currency.chainId
    )

    if (isFewToken(pathInput.wrapped) && isFewToken(pathOutput.wrapped)) {
      if (outputAmount.currency.isNative) {
        planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [fewOutputToken.address, ROUTER_AS_RECIPIENT, '0'])
      } else if (trade.inputAmount.currency.isNative) {
        planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [fewInputToken.address, ROUTER_AS_RECIPIENT, '0'])
        planner.addCommand(CommandType.UNWRAP_WETH, [SENDER_AS_RECIPIENT, '0'])
      } else {
        planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [fewOutputToken.address, SENDER_AS_RECIPIENT, '0'])
      }
      planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [pathInput.wrapped.address, SENDER_AS_RECIPIENT, '0'])
      planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [pathOutput.wrapped.address, SENDER_AS_RECIPIENT, '0'])
    }
  } else {
    const path = encodeRouteToPath(route as RouteV3<TInput, TOutput>, trade.tradeType === TradeType.EXACT_OUTPUT)
    if (tradeType == TradeType.EXACT_INPUT) {
      planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
        routerMustCustody ? ROUTER_AS_RECIPIENT : options.recipient,
        trade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
        routerMustCustody ? 0 : trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
        path,
        payerIsUser,
      ])
    } else if (tradeType == TradeType.EXACT_OUTPUT) {
      planner.addCommand(CommandType.V3_SWAP_EXACT_OUT, [
        routerMustCustody ? ROUTER_AS_RECIPIENT : options.recipient,
        trade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
        trade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
        path,
        payerIsUser,
      ])
    }
  }
}

function addV4Swap<TInput extends Currency, TOutput extends Currency>(
  swaps: Swap<TInput, TOutput>[],
  planner: RoutePlanner,
  { inputAmount, outputAmount, route }: Swap<TInput, TOutput>,
  tradeType: TradeType,
  options: SwapOptions,
  payerIsUser: boolean,
  routerMustCustody: boolean
): void {
  // create a deep copy of pools since v4Planner encoding tampers with array

  const firstSwap = swaps[0]
  const lastSwap = swaps[swaps.length - 1]

  const pathInput = route.path[0]
  const pathOutput = route.path[route.path.length - 1]

  const pools = route.pools.map((p) => p) as V4Pool[]
  const v4Route = new V4Route(pools, inputAmount.currency, outputAmount.currency)

  if (isFewToken(route.pools[0].token0.wrapped) && isFewToken(route.pools[0].token1.wrapped)) {
    const fewCurrencyIn = getFewTokenFromOriginalToken(inputAmount.currency.wrapped, inputAmount.currency.chainId)
    const fewCurrencyOut = getFewTokenFromOriginalToken(outputAmount.currency.wrapped, outputAmount.currency.chainId)
    const fewV4Route = new V4Route(pools, fewCurrencyIn, fewCurrencyOut)
    const fewTrade = V4Trade.createUncheckedTrade({
      route: fewV4Route,
      inputAmount: inputAmount as CurrencyAmount<Token>,
      outputAmount: outputAmount as CurrencyAmount<Token>,
      tradeType,
    })
    if (!fewTrade.inputAmount.currency.isNative) {
      // send wrapped token to router to unwrap
      planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
        (fewTrade.inputAmount.currency as Token).address,
        ROUTER_AS_RECIPIENT,
        fewTrade.maximumAmountIn(options.slippageTolerance).quotient.toString(),
      ])
    }

    if (fewTrade.inputAmount.currency.isNative) {
      planner.addCommand(CommandType.WRAP_ETH, [ROUTER_AS_RECIPIENT, fewTrade.inputAmount.quotient.toString()])
    }

    planner.addCommand(CommandType.WRAP_FEW_TOKEN, [
      fewTrade.inputAmount.currency.wrapped.address,
      ROUTER_AS_RECIPIENT,
      fewTrade.inputAmount.currency.isNative ? CONTRACT_BALANCE : fewTrade.inputAmount.quotient.toString(),
    ])

    payerIsUser = false
    routerMustCustody = true // TOTO, check again

    const slippageToleranceOnSwap =
      routerMustCustody && tradeType == TradeType.EXACT_INPUT ? undefined : options.slippageTolerance

    const v4Planner = new V4Planner()
    v4Planner.addTrade(fewTrade, slippageToleranceOnSwap)
    v4Planner.addSettle(fewTrade.route.pathInput, payerIsUser)
    v4Planner.addTake(
      fewTrade.route.pathOutput,
      routerMustCustody ? ROUTER_AS_RECIPIENT : options.recipient ?? SENDER_AS_RECIPIENT
    )
    planner.addCommand(CommandType.V4_SWAP, [v4Planner.finalize()])

    const fewOutputToken = getFewTokenFromOriginalToken(
      fewTrade.outputAmount.currency.wrapped,
      fewTrade.outputAmount.currency.chainId
    )

    if (isFewToken(pathInput.wrapped) && isFewToken(pathOutput.wrapped)) {
      if (outputAmount.currency.isNative) {
        planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [
          fewOutputToken.address,
          ROUTER_AS_RECIPIENT,
          fewTrade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
        ])
        planner.addCommand(CommandType.UNWRAP_WETH, [SENDER_AS_RECIPIENT, 0])
      } else {
        planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [
          fewOutputToken.address,
          SENDER_AS_RECIPIENT,
          fewTrade.minimumAmountOut(options.slippageTolerance).quotient.toString(),
        ])
      }
      planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [pathInput.wrapped.address, SENDER_AS_RECIPIENT, '0'])
      planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [pathOutput.wrapped.address, SENDER_AS_RECIPIENT, '0'])
    }
  } else {
    const trade = V4Trade.createUncheckedTrade({
      route: v4Route,
      inputAmount,
      outputAmount,
      tradeType,
    })

    const slippageToleranceOnSwap =
      routerMustCustody && tradeType == TradeType.EXACT_INPUT ? undefined : options.slippageTolerance

    const v4Planner = new V4Planner()
    v4Planner.addTrade(trade, slippageToleranceOnSwap)
    v4Planner.addSettle(trade.route.pathInput, payerIsUser)
    v4Planner.addTake(
      trade.route.pathOutput,
      routerMustCustody ? ROUTER_AS_RECIPIENT : options.recipient ?? SENDER_AS_RECIPIENT
    )
    if (
      firstSwap.route.protocol !== Protocol.V4 &&
      lastSwap.route.protocol === Protocol.V4 &&
      trade.route.pathInput.isNative
    ) {
      planner.addCommand(CommandType.UNWRAP_WETH, [ROUTER_AS_RECIPIENT, 0])
    }
    planner.addCommand(CommandType.V4_SWAP, [v4Planner.finalize()])
  }
}

/**
 * 判断池是否为「桥接池」—— 用 V4Pool(tickSpacing=0) 实现的 token 空间转换占位符。
 *
 * 【两阶段设计说明】
 * 报价阶段：桥接池编码为 MixedRouteQuoterV2 的 "version 0"，quoter 合约 1:1 透传金额。
 * 执行阶段（本文件）：桥接池不能作为 V4_SWAP 执行，而是转换为对应的 wrap/unwrap 命令：
 *   - ETH  ↔ WETH    → WRAP_ETH / UNWRAP_WETH
 *   - USDC ↔ fwUSDC  → WRAP_FEW_TOKEN / UNWRAP_FEW_TOKEN
 *
 * 见 compute-all-routes.ts 中的架构注释了解完整设计。
 */
function isTokenWrapBridge(pool: TPool): boolean {
  return pool instanceof V4Pool && pool.tickSpacing === 0
}

// encode a mixed route swap, i.e. including both v2 and v3 pools
function addMixedSwap<TInput extends Currency, TOutput extends Currency>(
  swaps: Swap<TInput, TOutput>[],
  planner: RoutePlanner,
  swap: Swap<TInput, TOutput>,
  tradeType: TradeType,
  options: SwapOptions,
  payerIsUser: boolean,
  routerMustCustody: boolean
): void {
  const route = swap.route as MixedRoute<TInput, TOutput>
  const inputAmount = swap.inputAmount
  const outputAmount = swap.outputAmount
  const tradeRecipient = routerMustCustody ? ROUTER_AS_RECIPIENT : options.recipient ?? SENDER_AS_RECIPIENT

  // single hop, so it can be reduced to plain swap logic for one protocol version
  if (route.pools.length === 1) {
    if (route.pools[0] instanceof V4Pool) {
      return addV4Swap(swaps, planner, swap, tradeType, options, payerIsUser, routerMustCustody)
    } else if (route.pools[0] instanceof V3Pool) {
      return addV3Swap(planner, swap, tradeType, options, payerIsUser, routerMustCustody)
    } else if (route.pools[0] instanceof Pair) {
      return addV2Swap(planner, swap, tradeType, options, payerIsUser, routerMustCustody)
    } else if (route.pools[0] instanceof FewPair) {
      return addRingV2Swap(planner, swap, tradeType, options, payerIsUser, routerMustCustody)
    } else {
      throw new Error('Invalid route type')
    }
  }

  const trade = MixedRouteTrade.createUncheckedTrade({
    route: route as MixedRoute<TInput, TOutput>,
    inputAmount,
    outputAmount,
    tradeType,
  })

  const amountIn = trade.maximumAmountIn(options.slippageTolerance, inputAmount).quotient.toString()
  const amountOut = routerMustCustody
    ? 0
    : trade.minimumAmountOut(options.slippageTolerance, outputAmount).quotient.toString()

  // logic from
  // https://github.com/Uniswap/router-sdk/blob/d8eed164e6c79519983844ca8b6a3fc24ebcb8f8/src/swapRouter.ts#L276
  const sections = partitionMixedRouteByProtocol(route as MixedRoute<TInput, TOutput>)
  const isLastSectionInRoute = (i: number) => {
    return i === sections.length - 1
  }

  let inputToken = route.pathInput

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const routePool = section[0]
    const outputToken = getOutputOfPools(section, inputToken)

    let nextInputToken
    let swapRecipient

    if (isLastSectionInRoute(i)) {
      nextInputToken = outputToken
      swapRecipient = tradeRecipient
    } else {
      const nextPool = sections[i + 1][0]
      nextInputToken = getPathCurrency(outputToken, nextPool)

      const v2PoolIsSwapRecipient = (nextPool instanceof Pair || nextPool instanceof FewPair) && outputToken.equals(nextInputToken)
      swapRecipient = v2PoolIsSwapRecipient
        ? (nextPool instanceof FewPair ? (nextPool as FewPair).liquidityToken.address : (nextPool as Pair).liquidityToken.address)
        : ROUTER_AS_RECIPIENT
    }

    // ---- 桥接池段：不是真正的 swap，而是 token 空间转换 ----
    // 根据两端 token 的类型决定使用哪个 wrap/unwrap 命令
    if (isTokenWrapBridge(routePool)) {
      const bridgePool = routePool as V4Pool
      const bridgeIn = inputToken
      const bridgeOut = bridgeIn.equals(bridgePool.token0) ? bridgePool.token1 : bridgePool.token0

      if (bridgeIn.isNative && !bridgeOut.isNative) {
        // ETH → WETH
        planner.addCommand(CommandType.WRAP_ETH, [ROUTER_AS_RECIPIENT, i === 0 ? amountIn : CONTRACT_BALANCE])
      } else if (!bridgeIn.isNative && bridgeOut.isNative) {
        // WETH → ETH
        planner.addCommand(CommandType.UNWRAP_WETH, [ROUTER_AS_RECIPIENT, 0])
      } else if (!isFewToken(bridgeIn.wrapped as Token) && isFewToken(bridgeOut.wrapped as Token)) {
        // original → fewToken (WRAP)
        if (payerIsUser && i === 0) {
          // First section: transfer original token from user to router, then wrap
          planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
            bridgeIn.wrapped.address,
            ROUTER_AS_RECIPIENT,
            i === 0 ? amountIn : CONTRACT_BALANCE,
          ])
        }
        planner.addCommand(CommandType.WRAP_FEW_TOKEN, [
          bridgeIn.wrapped.address,
          ROUTER_AS_RECIPIENT,
          i === 0 ? amountIn : CONTRACT_BALANCE,
        ])
        // After wrapping, the router has the fewToken, so payer is no longer user
        payerIsUser = false
      } else if (isFewToken(bridgeIn.wrapped as Token) && !isFewToken(bridgeOut.wrapped as Token)) {
        // fewToken → original (UNWRAP)
        planner.addCommand(CommandType.UNWRAP_FEW_TOKEN, [
          bridgeIn.wrapped.address,
          isLastSectionInRoute(i) ? tradeRecipient : ROUTER_AS_RECIPIENT,
          isLastSectionInRoute(i) ? amountOut : 0,
        ])
      }
    } else if (routePool instanceof V4Pool) {
      const subRoute = new MixedRoute(new MixedRouteSDK([...section], inputToken, outputToken))
      const v4Planner = new V4Planner()
      const v4SubRoute = new V4Route(section as V4Pool[], subRoute.input, subRoute.output)

      v4Planner.addSettle(inputToken, payerIsUser && i === 0, (i == 0 ? amountIn : CONTRACT_BALANCE) as BigNumber)
      v4Planner.addAction(Actions.SWAP_EXACT_IN, [
        {
          currencyIn: inputToken.isNative ? ETH_ADDRESS : inputToken.address,
          path: encodeV4RouteToPath(v4SubRoute),
          amountIn: 0, // denotes open delta, amount set in v4Planner.addSettle()
          amountOutMinimum: !isLastSectionInRoute(i) ? 0 : amountOut,
        },
      ])
      v4Planner.addTake(outputToken, swapRecipient)

      planner.addCommand(CommandType.V4_SWAP, [v4Planner.finalize()])
    } else if (routePool instanceof V3Pool) {
      const subRoute = new MixedRoute(new MixedRouteSDK([...section], inputToken, outputToken))
      planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
        swapRecipient, // recipient
        i == 0 ? amountIn : CONTRACT_BALANCE, // amountIn
        !isLastSectionInRoute(i) ? 0 : amountOut, // amountOut
        encodeMixedRouteToPath(subRoute), // path
        payerIsUser && i === 0, // payerIsUser
      ])
    } else if (routePool instanceof FewPair) {
      // FewV2 swap section — pools use fewTokens natively
      // Build the token path through the FewV2 section
      const fewPath: string[] = [inputToken.wrapped.address]
      let currentToken: Currency = inputToken
      for (const pool of section) {
        const nextToken = pool.token0.equals(currentToken) || pool.token0.equals(currentToken.wrapped)
          ? pool.token1
          : pool.token0
        fewPath.push(nextToken.wrapped.address)
        currentToken = nextToken
      }
      planner.addCommand(CommandType.FEW_V2_SWAP_EXACT_IN, [
        swapRecipient, // recipient
        i === 0 ? amountIn : CONTRACT_BALANCE, // amountIn
        !isLastSectionInRoute(i) ? 0 : amountOut, // amountOutMin
        fewPath,
        payerIsUser && i === 0,
      ])
    } else if (routePool instanceof Pair) {
      const subRoute = new MixedRoute(new MixedRouteSDK([...section], inputToken, outputToken))
      planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
        swapRecipient, // recipient
        i === 0 ? amountIn : CONTRACT_BALANCE, // amountIn
        !isLastSectionInRoute(i) ? 0 : amountOut, // amountOutMin
        subRoute.path.map((token) => token.wrapped.address), // path
        payerIsUser && i === 0,
      ])
    } else {
      throw new Error('Unexpected Pool Type')
    }

    // 段间 token 转换（ETH↔WETH）—— 跳过桥接池段，因为上面已经处理了
    if (!isLastSectionInRoute(i) && !isTokenWrapBridge(routePool)) {
      if (outputToken.isNative && !nextInputToken.isNative) {
        planner.addCommand(CommandType.WRAP_ETH, [ROUTER_AS_RECIPIENT, CONTRACT_BALANCE])
      } else if (!outputToken.isNative && nextInputToken.isNative) {
        planner.addCommand(CommandType.UNWRAP_WETH, [ROUTER_AS_RECIPIENT, 0])
      }
    }

    inputToken = nextInputToken
  }
}

// if price impact is very high, there's a chance of hitting max/min prices resulting in a partial fill of the swap
function riskOfPartialFill(trade: RouterTrade<Currency, Currency, TradeType>): boolean {
  return trade.priceImpact.greaterThan(REFUND_ETH_PRICE_IMPACT_THRESHOLD)
}

function hasFeeOption(swapOptions: SwapOptions): boolean {
  return !!swapOptions.fee || !!swapOptions.flatFee
}
