const { test } = require('node:test')
const assert = require('node:assert/strict')
const core = require('@ring-protocol/sdk-core')
const few = require('@ring-protocol/v2-sdk')
const v2 = require('@ring-protocol/uniswap-v2-sdk')
const ur = require('@ring-protocol/universal-router-sdk')
const equalAddress = (actual, expected) => assert.equal(actual.toLowerCase(), expected.toLowerCase())

test('Robinhood uses chain ID 4663 in the existing supported-chain list', () => {
  assert.equal(core.ChainId.ROBINHOOD, 4663)
  assert.equal(core.SUPPORTED_CHAINS.filter(id => id === 4663).length, 1)
})
for (const id of [56, 999]) test(`existing chain ${id} remains registered`, () => {
  assert.ok(core.SUPPORTED_CHAINS.includes(id))
  assert.equal(core.WETH9[id].chainId, id)
})
test('Robinhood WETH uses the deployed chain-specific contract', () => {
  equalAddress(core.WETH9[4663].address, '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73')
  equalAddress(ur.WETH_ADDRESS(4663), core.WETH9[4663].address)
})
test('FewV2 factory and init hash are independent from official V2', () => {
  equalAddress(few.FACTORY_ADDRESS_MAP[4663], '0x29e47f8e17341d3ab23839bc7d56d286b4a35a19')
  assert.equal(few.INIT_CODE_HASH_MAP[4663], '0xb7963b5cfdf9e42bd2e41aaa19203f3bf84b51b6b7b24b64f7ab2313101bd54c')
  assert.notEqual(few.Pair, v2.Pair)
  equalAddress(core.V2_FACTORY_ADDRESSES[4663], '0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f')
  equalAddress(core.V2_ROUTER_ADDRESSES[4663], '0x89e5DB8B5aA49aA85AC63f691524311AEB649eba')
})
test('FewToken factory config derives the configured wrapped native token', () => {
  const wrapper = few.getFewTokenFromOriginalToken(core.WETH9[4663], 4663)
  equalAddress(wrapper.address, ur.FEW_WRAPPED_NATIVE_CURRENCY[4663].address)
})
for (const version of [ur.UniversalRouterVersion.V1_2, ur.UniversalRouterVersion.V2_0]) test(`Router alias ${version} uses the verified deployment`, () => {
  equalAddress(ur.UNIVERSAL_ROUTER_ADDRESS(version, 4663), '0x269F10Ab1a7CE6c163B176D951eBd145A944A39D')
  assert.equal(ur.UNIVERSAL_ROUTER_CREATION_BLOCK(version, 4663), 58676625)
})
const expected = {
  v3CoreFactoryAddress: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
  multicallAddress: '0x282A3C4D320Cc7f0d5eaf56B8029e4B88338f0a3',
  quoterAddress: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',
  nonfungiblePositionManagerAddress: '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3',
  tickLensAddress: '0x7DfD4F31be6814D2906BDE155c3e1B146EAc1468',
  swapRouter02Address: '0xCaf681a66D020601342297493863E78C959E5cb2',
  v4PoolManagerAddress: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
  v4PositionManagerAddress: '0x58daec3116aae6D93017bAAea7749052E8a04fA7',
  v4StateView: '0xF3334192D15450CdD385c8B70e03f9A6bD9E673b',
  v4QuoterAddress: '0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94',
  mixedRouteQuoterV2Address: '0xc01f02abBBd53D72f0A00dc66D8AA9eF0183BF91',
}
for (const [key, address] of Object.entries(expected)) test(`Robinhood existing address-map entry: ${key}`, () => {
  equalAddress(core.CHAIN_TO_ADDRESSES_MAP[4663][key], address)
})
test('the seven public SDK modules load with the shared core graph', () => {
  for (const name of ['sdk-core', 'v2-sdk', 'uniswap-v2-sdk', 'v3-sdk', 'v4-sdk', 'router-sdk', 'universal-router-sdk']) {
    assert.ok(Object.keys(require('@ring-protocol/' + name)).length > 0)
  }
  assert.ok(core.WETH9[4663] instanceof core.Token)
})
