# Beefy CLM Subgraph

This Subgraph sources events from the Beefy CLM contracts in different networks.

# Deployments

## Goldsky.com

### Latest endpoints

- [Arbitrum](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-arbitrum/latest/gn)
- [Base](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-base/latest/gn)
- [Linea](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-linea/latest/gn)
- [Moonbeam](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-moonbeam/latest/gn)
- [Optimism](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-optimism/latest/gn)

### Historical endpoints

- [Arbitrum (beta)](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-clm-arbitrum-beta/latest/gn)

# Contributing

## Prerequisites

- Git: [git-scm.com](https://git-scm.com)
- Node.js: [nodejs.org](https://nodejs.org), see version in [.nvmrc](.nvmrc)
- Yarn: [yarnpkg.com](https://yarnpkg.com)
- Docker: [docker.com](https://www.docker.com)
- Docker Compose: [docker.com](https://docs.docker.com/compose/install/)

## Setup the project

```bash
yarn install
```

## Running a local instance of graph-node locally

```bash
yarn infra:strat
```

## Deploying the subgraph locally

```bash
yarn remove-local # if you have already deployed the subgraph
yarn create-local # create the subgraph locally
yarn prepare:<network> # apply configuration for the network
yarn codegen # generate the typescript types
yarn build # build the subgraph code
yarn deploy-local # deploy the subgraph locally
```

## Run tests

```bash
yarn test # run all tests
yarn test:graph # run only matchstick-as graph tests
yarn test:lint # run prettier linter
```

## HOWTOs

### How to add a new network

1. Add the network configuration [config/<network>.json](config/).
   - `network` must match one of the networks in Goldsky's [supported networks list](https://docs.goldsky.com/chains/supported-networks).
   - `clockTickBlocks` is the number of blocks between each clock tick, aim for a clock tick every 5 minutes.
   - Find the <native>/USD price feed [on chainlink's documentation](https://docs.chain.link/data-feeds/price-feeds/addresses#networks). Verify that it's a ChainLink `AggregatorV3Interface` with the `latestRoundData()` method. Put the address in `chainlinkNativePriceFeedAddress`.
2. Add dev RPCs in graph-node config [docker/graph-node/config.toml](docker/graph-node/config.toml).
3. Add a new `prepare:<network>` script in [package.json](package.json).
4. Add the chain name in the Release script in [.github/workflows/Release.yml](.github/workflows/Release.yml).
5. Release the first version of the subgraph for the new network using the [./bin/release.sh](./bin/release.sh) script.
   - Must be logged in to goldsky with the provided cli.
   - Only used to deploy the first version, see below for updating a subgraph.
6. Tag the new version on Goldsky's UI as "latest" to create a stable endpoint.
7. Add the endpoint link to the [README](README.md) in alphabetical order.

### Release a new version of the subgraph

1. On github, create a [new release](https://github.com/beefyfinance/cowcentrated-subgraph/releases/new) with the new version number.
  - The tag should be the version number, e.g. `1.0.0`.
  - This will trigger the [Release workflow](.github/workflows/Release.yml) to deploy the subgraph to all networks.
2. Wait for the workflow to finish, then check the [Goldsky dashboard](https://app.goldsky.com/project_clu2walwem1qm01w40v3yhw1f/dashboard/subgraphs), the new subgraph version should be indexing on all chains.
3. Run some manual tests on the subgraph endpoints to verify that the new version is working as expected.
4. If everything is working as expected, we need to move the goldsky tags to the new version. This process is manual as of now
5. For each subgraph on Goldsky's UI
   - Go to the old version and delete the tag
   - Go to the new version and add the tag
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

- classicStrategy: Transfer(indexed address,indexed address,uint256)
- classicStrategy.vault()
- classicStrategy: Initialized(uint8)
- classicStrategy: Paused(address)
- classicStrategy: Unpaused(address)
- classicStrategy: StratHarvest(indexed address,uint256,uint256)

```

## Beefy CLM contracts

```text
- clmManagerFactory: ProxyCreated(address)
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
- clmStrategy.output()
- clmStrategy.price()
- clmStrategy.range()
- clmStrategy.balanceOfPool()
- clmStrategy.lpToken1ToNativePrice()
- clmStrategy.lpToken0ToNativePrice()
- clmStrategy.ouptutToNativePrice()
- clmStrategy: Initialized(uint8)
- clmStrategy: Paused(address)
- clmStrategy: Unpaused(address)
- clmStrategy: Harvest(uint256,uint256)
- clmStrategy: HarvestRewards(uint256)
- clmStrategy: ClaimedFees(uint256,uint256,uint256,uint256)
- clmStrategy: ClaimedRewards(uint256)

- rewardPoolFactory: ProxyCreated(address)
- rewardPool.stakedToken()
- rewardPool: Initialized(uint8)
```
