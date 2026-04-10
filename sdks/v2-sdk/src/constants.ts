import { ChainId, Percent } from '@ring-protocol/sdk-core'
import JSBI from 'jsbi'

/**
 * @deprecated use FACTORY_ADDRESS_MAP instead
 */
export const FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'

/**
 * @deprecated use V2_FACTORY_ADDRESSES instead
 */
export const V2_FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
export const V2_FACTORY_ADDRESSES: { [chainId: number]: string } = {
  [ChainId.MAINNET]: '0xeb2A625B704d73e82946D8d026E1F588Eed06416',
  [ChainId.GOERLI]: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // use uniswap v2 factory address
  [ChainId.SEPOLIA]: '0x3D7101fDe92D0961cAc4b39Ee5A638d7B6A88090',
  [ChainId.OPTIMISM]: '0x0c3c1c532F1e39EdF36BE9Fe0bE1410313E074Bf', // use uniswap v2 factory address
  [ChainId.ARBITRUM_ONE]: '0x1246Fa62467a9AC0892a2d2A9F9aafC2F5609442',
  [ChainId.AVALANCHE]: '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C', // use uniswap v2 factory address
  [ChainId.BASE_SEPOLIA]: '0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e', // use uniswap v2 factory address
  [ChainId.BASE]: '0x9BfFC3B30D6659e3D84754cc38865B3D60B4980E',
  [ChainId.BNB]: '0x4De602A30Ad7fEf8223dcf67A9fB704324C4dd9B',
  [ChainId.POLYGON]: '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C', // use uniswap v2 factory address
  [ChainId.CELO]: '0x79a530c8e2fA8748B7B40dd3629C0520c2cCf03f', // use uniswap v2 factory address
  [ChainId.BLAST]: '0x24F5Ac9A706De0cF795A8193F6AB3966B14ECfE6',
  [ChainId.WORLDCHAIN]: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // use uniswap v2 factory address
  [ChainId.UNICHAIN_SEPOLIA]: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // use uniswap v2 factory address
  [ChainId.UNICHAIN]: '0xEeE400Eabfba8F60f4e6B351D8577394BeB972CD',
  [ChainId.MONAD_TESTNET]: '0x733e88f248b742db6c14c0b1713af5ad7fdd59d0', // use uniswap v2 factory address
  [ChainId.SONEIUM]: '0x97febbc2adbd5644ba22736e962564b23f5828ce', // use uniswap v2 factory address
  [ChainId.HYPER_MAINNET]: '0x4AfC2e4cA0844ad153B090dc32e207c1DD74a8E4',
  [ChainId.STORY_MAINNET]: '0xEeE400Eabfba8F60f4e6B351D8577394BeB972CD',
  [ChainId.XLAYER_MAINNET]: '0xdf38f24fe153761634be942f9d859f3dba857e95', // use uniswap v2 factory address
  4326: '0xbf56488c857a881ae7e3bed27cf99c10a7ab7e50', // use uniswap v2 factory address
}

export const FACTORY_ADDRESS_MAP: { [chainId: number]: string } = V2_FACTORY_ADDRESSES

export const INIT_CODE_HASH = '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f'

export const INIT_CODE_HASH_MAP: { [chainId: number]: string } = {
  // Sepolia
  11155111: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // Blast Sepolia
  168587773: '0x4b1dab7451c20e74482652f09a8ac942d2127aa266ba46f8ec97735f05664521',
  // Blast Mainnet
  81457: '0x501ce753061ab6e75837b15f074633bb775f5972f8dc1112fcc829c2e88dc689',
  // Ethereum Mainnet
  1: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // unichain sepolia
  1301: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // unichain
  130: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // arbitrum sepolia
  421614: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // base
  8453: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // arbitrum mainnet
  42161: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // story odysey
  1516: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // story mainnet
  1514: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // bnb chain
  56: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // hyper mainnet
  999: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // rootstock
  30: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // polygon mainnet
  137: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // optimism
  10: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // avalanche
  43114: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // worldchain
  480: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // zksync
  324: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // soneium
  1868: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // zora
  7777777: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // zora sepolia
  999999999: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',
  // celo
  42220: '0xa7ae6a5ec37f0c21bbdac560794258c4089b8ae3ffa6e3909b53c6091764a676',

  // megaeth mainnet
  4326: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
}

export const MINIMUM_LIQUIDITY = JSBI.BigInt(1000)

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const FIVE = JSBI.BigInt(5)
export const _997 = JSBI.BigInt(997)
export const _1000 = JSBI.BigInt(1000)
export const BASIS_POINTS = JSBI.BigInt(10000)

export const ZERO_PERCENT = new Percent(ZERO)
export const ONE_HUNDRED_PERCENT = new Percent(ONE)
