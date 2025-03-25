# Beefy CLM Subgraph

This Subgraph sources events from the Beefy CLM contracts in different networks.

# Deployments

## Goldsky.com

### Latest endpoints

- [Arbitrum](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-arbitrum/latest/gn)
- [Avax](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-avax/latest/gn)
- [Base](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-base/latest/gn)
- [Berachain](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-berachain/latest/gn)
- [Bsc](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-bsc/latest/gn)
- [Gnosis](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-gnosis/latest/gn)
- [Linea](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-linea/latest/gn)
- [Lisk](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-lisk/latest/gn)
- [Manta](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-manta/latest/gn)
- [Mantle](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-mantle/latest/gn)
- [Mode](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-mode/latest/gn)
- [Moonbeam](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-moonbeam/latest/gn)
- [Optimism](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-optimism/latest/gn)
- [Polygon](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-polygon/latest/gn)
- [Rootstock](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-rootstock/latest/gn)
- [sei](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-sei/latest/gn)
- [Sonic](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-sonic/latest/gn)
- [Unichain](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-unichain/latest/gn)
- [ZkSync](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-zksync/latest/gn)

### Historical endpoints

- [Arbitrum (beta)](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-arbitrum-beta/latest/gn)

# Contributing

## Prerequisites

- Git: [git-scm.com](https://git-scm.com)
- Node.js: [nodejs.org](https://nodejs.org), see version in [.nvmrc](.nvmrc)
- Yarn: [yarnpkg.com](https://yarnpkg.com)

## Setup the project

```bash
yarn install
```

## Building the subgraph locally

```bash
yarn configure <network> # apply configuration for the network
yarn codegen # generate the typescript types
yarn build # build the subgraph code
```

## Run tests

```bash
yarn test # run all tests
yarn test:lint # run prettier linter
```

## HOWTOs

### How to add a new network

1. Add the network configuration [config/<network>.json](config/).
   - `network` must match one of the networks in Goldsky's [supported networks list](https://docs.goldsky.com/chains/supported-networks).
   - `clockTickBlocks` is the number of blocks between each clock tick, aim for a clock tick every 5 minutes.
   - Price feed:
     - Use chainlink
       - `"priceOracleType" : "chainlink"`
       - Find the `<native>/USD` price feed contract address [on chainlink's documentation](https://docs.chain.link/data-feeds/price-feeds/addresses#networks). Verify that it's a ChainLink `AggregatorV3Interface` with the `latestRoundData()` method. Put the address in `chainlinkNativePriceFeedAddress`.
       - Get the decimals of the price feed using the `decimals` field of the contract. Put the decimals in `chainlinkNativePriceFeedDecimals`.
     - Use pyth
       - `"priceOracleType" : "pyth"`
       - Find the pyth contract address [on pyth's documentation](https://docs.pyth.network/price-feeds/contract-addresses/evm). Put the address in `pythPriceFeedAddress`.
       - Grab the `Crypto.<native>/USD` price feed ID [on pyth's documentation](https://pyth.network/developers/price-feed-ids). Put the ID in `pythPriceFeedId`.
     - Use umbrella
       - `"priceOracleType" : "umbrella"`
       - Find the `umbrellaRegistryAddress` [on umbrella's documentation](https://umbrella-network.readme.io/docs/umb-token-contracts#contract-registry)
     - Use beefy
       - `"priceOracleType" : "beefy"`
       - define `"beefyOracleAddress"` based [on the beefy's addressbook](https://github.com/beefyfinance/beefy-api/blob/master/packages/address-book/src/address-book/sonic/platforms/beefyfinance.ts#L34C17-L34C59)
2. Add the chain name in the Release script in [.github/workflows/Release.yml](.github/workflows/Release.yml).
3. Add the endpoint link to the [README](README.md) in alphabetical order.
4. Release the first version of the subgraph for the new network using the [./bin/release.sh](./bin/release.sh) script.
   - Must be logged in to goldsky with the provided cli.
   - Only used to deploy the first version, see below for updating a subgraph.

When ready: 4. Tag the new version on Goldsky's UI as "latest" to create a stable endpoint.

### Release a new version of the subgraph

1. On github, create a [new release](https://github.com/beefyfinance/cowcentrated-subgraph/releases/new) with the new version number.

- The tag should be the version number, e.g. `1.0.0`.
- This will trigger the [Release workflow](.github/workflows/Release.yml) to deploy the subgraph to all networks.

2. Wait for the workflow to finish, then check the [Goldsky dashboard](https://app.goldsky.com/project_clu2walwem1qm01w40v3yhw1f/dashboard/subgraphs), the new subgraph version should be indexing on all chains.
3. Run some manual tests on the subgraph endpoints using the `next` version tag to verify that the new version is working as expected.
4. If everything is working as expected, we need to move the goldsky tags to the new version. This process is manual as of now
5. For each subgraph on Goldsky's UI
   - Go to the new version and create the "latest" tag, this will in fact move the "latest" tag to the new version.
   - Go back to the old version and delete the subgraph

### How to update the schema

1. Create or update the [schema.graphql](schema.graphql) file.

- See TheGraph docs for [defining entities](https://thegraph.com/docs/en/developing/creating-a-subgraph/#defining-entities)

2. Run `yarn codegen` to generate the typescript types.

- See TheGraph docs for [TypeScript code generation](https://thegraph.com/docs/en/developing/creating-a-subgraph/#code-generation)

3. Update [subgraph.template.yaml](subgraph.template.yaml) with the new entity bindings and/or data sources if needed.

- TheGraph docs for [defining a call handler](https://thegraph.com/docs/en/developing/creating-a-subgraph/#defining-a-call-handler)
- TheGraph docs for [defining a block handler](https://thegraph.com/docs/en/developing/creating-a-subgraph/#block-handlers)
- TheGraph docs for [defining a data source template](https://thegraph.com/docs/en/developing/creating-a-subgraph/#data-source-templates)

4. Update or create the mappings in the [mappings](src/mappings) folder to handle the new entity.

- TheGraph docs for [defining mappings](https://thegraph.com/docs/en/developing/creating-a-subgraph/#mapping-function)
- TheGraph [AssemblyScript API](https://thegraph.com/docs/en/developing/graph-ts/api/)

5. Write tests for the new mappings in the [tests](tests/) folder.

- TheGraph docs for [testing mappings](https://thegraph.com/docs/en/developing/unit-testing-framework/)

### Deploy the subgraph

```bash
./bin/deploy.sh <network> goldsky
./bin/deploy.sh <network> 0xgraph

# or both
./bin/deploy.sh <network> goldsky 0xgraph
```

# Dependecies on the underlying contracts

## Beefy Classic contracts

```text
- classicVaultFactory: ProxyCreated(address)
- classicVault: strategy()
- classicVault: want()
- classicVault: balance()
- classicVault: totalSupply()
- classicVault: Transfer(indexed address,indexed address,uint256)
- classicVault: Initialized(uint8)
- classicVault: UpgradeStrat(address)
- classicVault: Transfer(indexed address,indexed address,uint256)

- classicStrategyFactory: ProxyCreated(address)
- classicStrategy.decimals()
- classicStrategy.name()
- classicStrategy.symbol()
- classicStrategy.vault()
- classicStrategy: Initialized(uint8)
- classicStrategy: Paused(address)
- classicStrategy: Unpaused(address)
- classicStrategy: StratHarvest(indexed address,uint256,uint256)

- classicBoostFactory: ProxyCreated(address)
- classicBoost: Initialized(uint8)
- classicBoost: Staked(indexed address,uint256)
- classicBoost: Withdrawn(indexed address,uint256)
- classicBoost: RewardPaid(indexed address,uint256)
```

## Beefy CLM contracts

```text
- clmManagerFactory: ProxyCreated(address)
- clmManager.decimals()
- clmManager.name()
- clmManager.symbol()
- clmManager.balances()
- clmManager.totalSupply()
- clmManager.balanceOf()
- clmManager.strategy()
- clmManager.wants()
- clmManager: Initialized(uint8)
- clmManager: Transfer(indexed address,indexed address,uint256)

- clmStrategyFactory: GlobalPause(bool)
- clmStrategy.pool()
- clmStrategy.vault()
- clmStrategy.price()
- clmStrategy.range()
- clmStrategy.output() // optional
- clmStrategy.balanceOfPool()
- clmStrategy: Initialized(uint8)
- clmStrategy: Paused(address)
- clmStrategy: Unpaused(address)
- clmStrategy: Harvest(uint256,uint256)
- clmStrategy: HarvestRewards(uint256)
- clmStrategy: ClaimedFees(uint256,uint256,uint256,uint256)
- clmStrategy: ClaimedRewards(uint256)

- rewardPoolFactory: ProxyCreated(address)
- rewardPool.decimals()
- rewardPool.name()
- rewardPool.symbol()
- rewardPool.stakedToken()
- rewardPool.totalSupply()
- rewardPool: Initialized(uint8)
- rewardPool: Transfer(indexed address,indexed address,uint256)
- rewardPool: RewardPaid(indexed address,indexed address,uint256)
- rewardPool: AddReward(address)
- rewardPool: RemoveReward(address,address)
```

## Other contracts

```text
beefySwapper: getAmountOut(address,address,uint256)
beefyOracle: getFreshPrice(address)
```
