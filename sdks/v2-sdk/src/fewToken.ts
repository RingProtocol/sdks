import { Token } from '@ring-protocol/sdk-core'
import { utils } from 'ethers/lib'
import BlastIFewWrappedTokenJSON from './abis/BlastSepoliaFewWrappedToken.json'
import BlastIMainnetFewWrappedTokenJSON from './abis/FewWrappedToken.json'
import EVMIFewWrappedTokenJSON from './abis/EVMFewWrappedToken.json'
import ETHMainnetFewWrappedTokenJSON from './abis/ETHFewWrappedToken.json'

type ChainConfig = {
  fewWrapFactory: string
  bytecode: string
}

const FEW_WRAPPED_FACTORY_CONFIGS: { [key: number]: ChainConfig } = {
  [168587773]: {
    fewWrapFactory: '0xf11788d14EbE6abF4EA02e162C75AD938F1730C1',
    bytecode: BlastIFewWrappedTokenJSON.bytecode,
  },
  [11155111]: {
    fewWrapFactory: '0x226e65279E177A779522864Ce1dE40c85E2C08A5',
    bytecode: EVMIFewWrappedTokenJSON.bytecode,
  },
  [81457]: {
    fewWrapFactory: '0x455b20131D59f01d082df1225154fDA813E8CeE9',
    bytecode: BlastIMainnetFewWrappedTokenJSON.bytecode,
  },
  [1]: {
    fewWrapFactory: '0x7D86394139bf1122E82FDF45Bb4e3b038A4464DD',
    bytecode: ETHMainnetFewWrappedTokenJSON.bytecode,
  },
  // unichain sepolia
  [1301]: {
    fewWrapFactory: '0x7D86394139bf1122E82FDF45Bb4e3b038A4464DD',
    bytecode: ETHMainnetFewWrappedTokenJSON.bytecode,
  },
  // unichain
  [130]: {
    fewWrapFactory: '0x974Cc3F3468cd9C12731108148C4DABFB5eE556F',
    bytecode: ETHMainnetFewWrappedTokenJSON.bytecode,
  },
  // arbitrum sepolia
  [421614]: {
    fewWrapFactory: '0xCc7eb1f253c0A988a4754445CA8c9Ab82C704E53',
    bytecode: ETHMainnetFewWrappedTokenJSON.bytecode,
  },
  // arbitrum mainnet
  [42161]: {
    fewWrapFactory: '0x974Cc3F3468cd9C12731108148C4DABFB5eE556F',
    bytecode: ETHMainnetFewWrappedTokenJSON.bytecode,
  },
  // base
  [8453]: {
    fewWrapFactory: '0xb3Ad7754f363af676dC1C5be40423FE538a47920',
    bytecode: ETHMainnetFewWrappedTokenJSON.bytecode,
  },
  // story odysey
  [1516]: {
    fewWrapFactory: '0xCc7eb1f253c0A988a4754445CA8c9Ab82C704E53',
    bytecode: ETHMainnetFewWrappedTokenJSON.bytecode,
  },
  // story mainnet
  [1514]: {
    fewWrapFactory: '0x974Cc3F3468cd9C12731108148C4DABFB5eE556F',
    bytecode: ETHMainnetFewWrappedTokenJSON.bytecode,
  },
  // hyper mainnet
  [999]: {
    fewWrapFactory: '0x6B65ed7315274eB9EF06A48132EB04D808700b86',
    bytecode: ETHMainnetFewWrappedTokenJSON.bytecode,
  },
  // bnb chain
  [56]: {
    fewWrapFactory: '0xEeE400Eabfba8F60f4e6B351D8577394BeB972CD',
    bytecode: ETHMainnetFewWrappedTokenJSON.bytecode,
  },
}

const isFewWrappedTokenSupported = (chainId: number): boolean => {
  return chainId in FEW_WRAPPED_FACTORY_CONFIGS
}

export const FEW_WRAPPED_TOKEN_FACTORY_ADDRESS = (chainId: number): string => {
  if (!(chainId in FEW_WRAPPED_FACTORY_CONFIGS))
    throw new Error(`Few wrapped token address not deployed on chain ${chainId}`)
  return FEW_WRAPPED_FACTORY_CONFIGS[chainId].fewWrapFactory
}

export const FEW_WRAPPED_TOKEN_BYTECODE = (chainId: number): string => {
  if (!(chainId in FEW_WRAPPED_FACTORY_CONFIGS))
    throw new Error(`Few wrapped token bytecode not deployed on chain ${chainId}`)
  return FEW_WRAPPED_FACTORY_CONFIGS[chainId].bytecode
}

class FewTokenCreator {
  private token: Token
  private chainId: number

  constructor(token: Token, chainId: number) {
    this.token = token
    this.chainId = chainId
  }

  private hasFewPrefix(): boolean {
    const isFewWrappedName = this.token.name?.startsWith('Few Wrapped ') ?? false
    const isFwSymbol = this.token.symbol?.startsWith('fw') ?? false
    return isFewWrappedName || isFwSymbol
  }

  private getFewTokenAddress(): string {
    if (this.hasFewPrefix()) {
      return this.token.address
    } else {
      return getFewTokenAddress(this.token.address, this.chainId)
    }
  }

  private getFewSymbol(): string | undefined {
    if (this.hasFewPrefix()) {
      return this.token.symbol
    } else {
      return `fw${this.token.symbol}`
    }
  }

  private getFewTokenName(): string | undefined {
    if (this.hasFewPrefix()) {
      return this.token.name
    } else {
      return `Few Wrapped ${this.token.name}`
    }
  }

  getFewToken(): Token {
    const fewTokenAddress = this.getFewTokenAddress()
    return new Token(
      this.token.chainId,
      fewTokenAddress,
      this.token.decimals,
      this.getFewSymbol(),
      this.getFewTokenName()
    )
  }
}

export function getFewTokenAddress(token: string, chainId: number): string {
  if (!isFewWrappedTokenSupported(chainId)) {
    // On networks that do not support Few tokens, just return the original token address.
    return utils.getAddress(token)
  }
  const constructorArgumentsEncoded = utils.defaultAbiCoder.encode(['address'], [token])
  const create2Inputs = [
    '0xff',
    FEW_WRAPPED_TOKEN_FACTORY_ADDRESS(chainId),
    // salt
    utils.keccak256(constructorArgumentsEncoded),
    // init code. bytecode + constructor arguments
    utils.keccak256(FEW_WRAPPED_TOKEN_BYTECODE(chainId)),
  ]
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`
  return utils.getAddress(`0x${utils.keccak256(sanitizedInputs).slice(-40)}`)
}

export function getFewTokenFromOriginalToken(token: Token, chainId: number): Token {
  if (!isFewWrappedTokenSupported(chainId)) {
    // On networks that do not support Few tokens, just return the original token.
    return token
  }
  const fewTokenCreator = new FewTokenCreator(token, chainId)
  return fewTokenCreator.getFewToken()
}

export function isFewToken(token: Token): boolean {
  const isFewWrappedName = token.name?.startsWith('Few Wrapped ') ?? false
  const isFwSymbol = token.symbol?.startsWith('fw') ?? false
  return isFewWrappedName || isFwSymbol
}
