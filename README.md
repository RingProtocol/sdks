# Ring SDKs

This repository contains the public TypeScript SDK packages that Ring supports for external developers.

## Canonical Links

- Docs: https://docs.ring.exchange/sdk/v2/overview
- Core SDK docs: https://docs.ring.exchange/sdk/core/overview
- GitHub: https://github.com/RingProtocol/sdks
- Issues: https://github.com/RingProtocol/sdks/issues

## Public Packages

- `@ring-protocol/sdk-core`
- `@ring-protocol/v2-sdk`
- `@ring-protocol/uniswap-v2-sdk`
- `@ring-protocol/v3-sdk`
- `@ring-protocol/v4-sdk`
- `@ring-protocol/router-sdk`
- `@ring-protocol/universal-router-sdk`

## Package Roles

- `@ring-protocol/sdk-core`: shared currency, token, chain, and math primitives
- `@ring-protocol/v2-sdk`: the FEW-aware Ring Swap SDK layer
- `@ring-protocol/uniswap-v2-sdk`: lower-level Uniswap V2-style primitives used for compatibility
- `@ring-protocol/v3-sdk` and `@ring-protocol/v4-sdk`: historical protocol compatibility packages using the same Ring core and FEW-aware v2 types
- `@ring-protocol/router-sdk`: route and trade composition across those protocol packages
- `@ring-protocol/universal-router-sdk`: Universal Router calldata construction and existing per-chain deployment mappings

The legacy `few-v2-sdk` role is now `v2-sdk`; the ordinary V2 role is `uniswap-v2-sdk`. Preserve those identities when importing or updating dependencies.

## Robinhood Chain Mainnet

Robinhood uses the same chain enum, wrapped-native map, FewFactory configuration, and pair-address maps as the existing networks.

| Existing SDK entry | Robinhood value |
| --- | --- |
| `sdk-core`: `ChainId.ROBINHOOD` | `4663`, native ETH |
| `sdk-core`: `WETH9[4663]` | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| `v2-sdk`: `FEW_WRAPPED_TOKEN_FACTORY_ADDRESS(4663)` | `0x0b255357b5681bb59ed67502206a9ec5d03a4b11` |
| `v2-sdk`: `FACTORY_ADDRESS_MAP[4663]` | `0x29e47f8e17341d3ab23839bc7d56d286b4a35a19` |
| `v2-sdk`: `INIT_CODE_HASH_MAP[4663]` | Robinhood FewV2 pair creation code hash |
| `sdk-core`: `V2_FACTORY_ADDRESSES[4663]` | `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f` |
| `sdk-core`: `V2_ROUTER_ADDRESSES[4663]` | `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba` |
| `sdk-core`: `CHAIN_TO_ADDRESSES_MAP[4663]` | Official Uniswap V3/V4 factories, managers, quoters, and interface multicall |
| `sdk-core`: `CHAIN_TO_ADDRESSES_MAP[4663].mixedRouteQuoterV2Address` | Ring `0xc01f02abBBd53D72f0A00dc66D8AA9eF0183BF91` |
| `universal-router-sdk`: `FEW_WRAPPED_NATIVE_CURRENCY[4663]` | `0xDD4eaAccA3b077c01e8eF45207fc48Fd1B54C735` |
| `universal-router-sdk`: `UNIVERSAL_ROUTER_ADDRESS(version, 4663)` | `0x269F10Ab1a7CE6c163B176D951eBd145A944A39D`, creation block `58676625` |

Addresses follow the team's [Robinhood Chain Mainnet Contract Address document](https://docs.google.com/document/d/14QXSOVDk3udrZr9TgYiABe0QWgfzds_uLy3df8ZD36M), reviewed on 2026-09-09. `getFewTokenFromOriginalToken(WETH9[4663], 4663)` derives the documented fwWETH through the existing FewToken helper. Pair addresses use the existing `Pair.getAddress` API and Robinhood's creation code hash.

The [official Uniswap deployment feed](https://developers.uniswap.org/deployments.json), checked on 2026-09-09, documents separate Uniswap V2, V3, and V4 deployments on Robinhood. The existing `SUPPORTED_CHAINS` and `CHAIN_TO_ADDRESSES_MAP` include those dependencies. `uniswap-v2-sdk` uses the official V2 factory and standard pair hash; the FEW-aware `v2-sdk` continues to use Ring's separate factory and pair hash. V3 pool address helpers accept the chain's `V3_CORE_FACTORY_ADDRESSES` entry through the existing factory override, as on other networks.

`MULTICALL_ADDRESSES[4663]` is the verified UniswapInterfaceMulticall deployment, with its existing `multicall((address,uint256,bytes)[])` ABI. Its returned Solidity `block.number` is the parent-chain height on Robinhood; consumers must use the RPC block height for L2 snapshot and freshness checks. Multicall2 and Multicall3 are different interfaces.

Both router version enums resolve to the four-protocol Ring Universal Router deployed at block 58676625. Its creation input, constructor dependencies, and complete runtime were checked against the build artifact on 2026-09-10 (Asia/Shanghai). Ring MixedRouteQuoterV2 was deployed at block 58680342; its creation input, constructor dependencies, and complete runtime were independently checked, and its address is recorded in the existing map.

These checks identify the deployed contracts. They do not establish active liquidity or validate swap and LP execution with this reduced SDK candidate. The Ring factory had no pairs at the 2026-09-09 check.

## Development

Use Node 22.14 or newer and the repository's Yarn 3.2.3. Run commands from the repository root.

```bash
yarn install
yarn install --immutable
yarn g:build
yarn g:test
yarn test:robinhood-network
```

This candidate adds Robinhood network IDs, addresses and per-chain configuration. Existing route selection, wrapping, settlement, refund and slippage algorithms remain at their original Ring business-source versions. The compatibility packages retain their existing implementation; their SDK imports use the corresponding public package roles: old `few-v2-sdk` becomes `v2-sdk`, and old ordinary `v2-sdk` becomes `uniswap-v2-sdk`.

Package migration, build setup, dependency identities and candidate versions are separate engineering changes from the network configuration.

The base packages are local version candidates `2.0.0`; the four compatibility packages are `1.0.0`. They are not published. Generated `dist/` stays untracked. Workspace packing resolves `workspace:*` to exact package versions; local tarball validation does not replace registry installation and consumer lockfile verification.

## Release review

Do not run `g:release` for installation or testing: it can publish to npm. Before an authorized release, verify semantic-release's calculated versions against the reviewed dependency matrix and publish dependencies before consumers. Publishing this review branch does not publish the npm packages.

Network configuration checks do not certify every swap or LP path. Earlier broader-fix test results apply only to the archived candidate, not this reduced candidate.
