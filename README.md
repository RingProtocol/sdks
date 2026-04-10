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

## Package Roles

- `@ring-protocol/sdk-core`: shared currency, token, chain, and math primitives
- `@ring-protocol/v2-sdk`: the FEW-aware Ring Swap SDK layer
- `@ring-protocol/uniswap-v2-sdk`: lower-level Uniswap V2-style primitives used for compatibility

## Development

```bash
# install
yarn

# build all packages
yarn g:build

# run tests
yarn g:test

# run a package script
yarn sdk @ring-protocol/sdk-core test
```
