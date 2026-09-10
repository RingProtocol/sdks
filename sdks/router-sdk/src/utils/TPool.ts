import { Pool as V4Pool } from '@ring-protocol/v4-sdk'
import { Pair } from '@ring-protocol/uniswap-v2-sdk'
import { Pool as V3Pool } from '@ring-protocol/v3-sdk'
import { Pair as FewPair } from '@ring-protocol/v2-sdk'

export type TPool = FewPair | Pair | V3Pool | V4Pool
