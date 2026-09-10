import { ChainId, Token } from '@ring-protocol/sdk-core'

export const FEW_WRAPPED_NATIVE_CURRENCY: { [chainId: number]: Token } = {
  [ChainId.ROBINHOOD]: new Token(
    ChainId.ROBINHOOD,
    '0xDD4eaAccA3b077c01e8eF45207fc48Fd1B54C735',
    18,
    'fwWETH',
    'Few Wrapped Wrapped Ether'
  ),
    [ChainId.HYPER_MAINNET]: new Token(
        999,
        '0x9e1148bC3665a9f7C35F313d89c0432c34928AEf',
        18,
        'fwWHYPE',
        'Few Wrapped Wrapped Hyper'
    ),
    [ChainId.MAINNET]: new Token(
        1,
        '0xa250CC729Bb3323e7933022a67B52200fE354767',
        18,
        'fwWETH',
        'Few Wrapped Wrapped Ether'
    ),
    [ChainId.BASE]: new Token(
        8453,
        '0xd38e4149df30AfFFEE13d771f3Ec9277c72333E4',
        18,
        'fwWETH',
        'Few Wrapped Wrapped Ether'
    ),
    [ChainId.ARBITRUM_ONE]: new Token(
        42161,
        '0x76CDff74222533Efa4BAa713BC3d14df81A460F7',
        18,
        'fwWETH',
        'Few Wrapped Wrapped Ether'
    ),
    [ChainId.ARBITRUM_SEPOLIA]: new Token(
        421614,
        '0x1fc632A9A9c99ae7C406f8565cd709b52BA0ed47',
        18,
        'fwWETH',
        'Few Wrapped Wrapped Ether'
    ),
    [ChainId.UNICHAIN]: new Token(
        130,
        '0x05e6c1B4Da05c41c86c35Ce42a8a222C1a450167',
        18,
        'fwWETH',
        'Few Wrapped Wrapped Ether'
    ),
    [ChainId.UNICHAIN_SEPOLIA]: new Token(
        1301,
        '0x1fc632A9A9c99ae7C406f8565cd709b52BA0ed47', //TODO: replace to mainnet
        18,
        'fwWETH',
        'Few Wrapped Wrapped Ether'
    ),
    [ChainId.GOERLI]: new Token(
        5,
        '0x6b7e07C37a157d01D71012c36644907Ab5a7694e',
        18,
        'fwWETH',
        'Few Wrapped Wrapped Ether'
    ),
    [ChainId.BLAST]: new Token(
        81457,
        '0x66714DB8F3397c767d0A602458B5b4E3C0FE7dd1',
        18,
        'fwWETH',
        'Few Wrapped Wrapped Ether'
    ),
    [ChainId.SEPOLIA]: new Token(
        11155111,
        '0x98b902eF4f9fEB2F6982ceEB4E98761294854D61',
        18,
        'fwWETH',
        'Few Wrapped Wrapped Ether'
    ),

    // networks exclusive to ring swap
    [ChainId.BLAST_SEPOLIA]: new Token(
        ChainId.BLAST_SEPOLIA,
        '0x798dE0520497E28E8eBfF0DF1d791c2E942eA881',
        18,
        'fwWETH',
        'Few Wrapped Wrapped Ether'
    ),
    [ChainId.STORY_ODYSSEY]: new Token(
        ChainId.STORY_ODYSSEY,
        '0xA67013F71AF4f21563BAf8C1d156F1Dc7ab681C6',
        18,
        'fwWIP',
        'Few Wrapped Wrapped IP'
    ),
    [ChainId.STORY_MAINNET]: new Token(
        ChainId.STORY_MAINNET,
        '0x088dE218b725975E6285995C25Ce3706BAe0f4Ec',
        18,
        'fwWIP',
        'Few Wrapped Wrapped IP'
    ),
    [ChainId.BNB]: new Token(56, '0x7f0172b75d3823D8aF04feE3A3f6a14aBD68EFE1', 18, 'fwWBNB', 'Few Wrapped Wrapped BNB'),
    [4326 as ChainId]: new Token(
        4326,
        '0x65c46c31E340D6C546309733CF50Ef4d150094C4',
        18,
        'fwWETH',
        'Few Wrapped Wrapped Ether'
    ),
}
