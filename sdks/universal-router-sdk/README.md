# universal-router-sdk
This SDK facilitates interactions with the contracts in [Universal Router](https://github.com/Uniswap/universal-router)

## Usage
Install latest version of universal-router-sdk. Then import the corresponding Trade class and Data object for each protocol you'd like to interact with.

### Trading on Uniswap
warning: `swapERC20CallParameters()` to be deprecated in favor of `swapCallParameters()`
```typescript
import { TradeType } from '@uniswap/sdk-core'
import { Trade as V2TradeSDK } from '@uniswap/v2-sdk'
import { Trade as V3TradeSDK } from '@uniswap/v3-sdk'
import { MixedRouteTrade, MixedRouteSDK, Trade as RouterTrade } from '@uniswap/router-sdk'

const options = { slippageTolerance, recipient }
const routerTrade = new RouterTrade({ v2Routes, v3Routes, mixedRoutes, tradeType: TradeType.EXACT_INPUT })
// Use the raw calldata and value returned to call into Universal Swap Router contracts
const { calldata, value } = SwapRouter.swapCallParameters(routerTrade, options)
```

## Developing this package

This compatibility package is maintained in `RingProtocol/sdks` and uses the same Ring SDK identities as the other packages. Follow the repository root README: use Node 22.14 or newer and Yarn 3.2.3, then run `yarn install`, `yarn g:build`, and `yarn g:test` from the root.

The migrated package contains TypeScript calldata construction code and the Robinhood network mappings listed in the root README, including the deployed Ring Universal Router at `0x269F10Ab1a7CE6c163B176D951eBd145A944A39D`. A deployment mapping does not establish execution support or active liquidity for this candidate.

The package's `test` command runs `test/robinhood/network-only.test.cjs` from the repository root. It checks network constants, addresses and module loading without a provider, signer or transaction. It does not test generated swap commands, amount guarantees, swap execution or LP execution. The former Hardhat/Foundry project, configuration and tests are not included, so the old `test:hardhat` and `test:forge` commands are unavailable. Earlier broader-candidate execution results do not validate this reduced candidate.
