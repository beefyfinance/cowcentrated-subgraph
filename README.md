# Beefy CLM Subgraph

This Subgraph sources events from the Beefy CLM contracts in different networks.

# Deployments

## Goldsky.com

### GraphiQL Explorer

- Arbitrum: [https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-arbitrum/gn](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-arbitrum/gn)
- Base: [https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-base/gn](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-base/gn)
- Optimism: [https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-optimism/gn](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-optimism/gn)

### Api Endpoints

- Arbitrum: [https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-arbitrum/gn](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-arbitrum/gn)
- Base: [https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-base/gn](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-base/gn)
- Optimism: [https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-optimism/gn](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-optimism/gn)


# Beta version Deployments

## Goldsky.com

### GraphiQL Explorer

- Arbitrum (new): [https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-beta-arbitrum/gn](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-beta-arbitrum/gn)
- Arbitrum (old): [https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-beta-old-arbitrum/gn](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-beta-old-arbitrum/gn)

### Api Endpoints

- Arbitrum (new): [https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-beta-arbitrum/gn](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-beta-arbitrum/gn)
- Arbitrum (old): [https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-beta-old-arbitrum/gn](https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/clm-beta-old-arbitrum/gn)

## 0xgraph.xyz

### GraphiQL Explorer

- Arbitrum: [https://api.0xgraph.xyz/subgraphs/name/beefyfinance/clm-arbitrum/graphql](https://api.0xgraph.xyz/subgraphs/name/beefyfinance/clm-arbitrum/graphql)
- Base: [https://api.0xgraph.xyz/subgraphs/name/beefyfinance/clm-base/graphql](https://api.0xgraph.xyz/subgraphs/name/beefyfinance/clm-base/graphql)
- Optimism: [https://api.0xgraph.xyz/subgraphs/name/beefyfinance/clm-optimism/graphql](https://api.0xgraph.xyz/subgraphs/name/beefyfinance/clm-optimism/graphql)

### Api Endpoints

- Arbitrum: [https://api.0xgraph.xyz/subgraphs/name/beefyfinance/clm-arbitrum](https://api.0xgraph.xyz/subgraphs/name/beefyfinance/clm-arbitrum)
- Base: [https://api.0xgraph.xyz/subgraphs/name/beefyfinance/clm-base](https://api.0xgraph.xyz/subgraphs/name/beefyfinance/clm-base)
- Optimism: [https://api.0xgraph.xyz/subgraphs/name/beefyfinance/clm-optimism](https://api.0xgraph.xyz/subgraphs/name/beefyfinance/clm-optimism)

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
   - `clockTickBlocks` is the number of blocks between each clock tick, aim for a clock tick every 5 minutes.
   - Find the uniswap v3, QuoterV2 contract address [on uniswap's documentation](https://docs.uniswap.org/contracts/v3/reference/deployments)
   - Find the <native>/USD price feed [on chainlink's documentation](https://docs.chain.link/data-feeds/price-feeds/addresses#networks). Verify that it's a ChainLink `AggregatorV3Interface` with the `latestRoundData()` method.
2. Add dev RPCs in graph-node config [docker/graph-node/config.toml](docker/graph-node/config.toml).
3. Add a new `prepare:<network>` script in [package.json](package.json).
4. Add a new `deploy:<network>:<provider>` script in [package.json](package.json).

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

```text
- vaultFactory: ProxyCreated(address)
- vault.balances()
- vault.totalSupply()
- vault.balanceOf()
- vault.strategy()
- vault.wants()
- vault: Initialized(uint8)
- vault: Transfer(indexed address,indexed address,uint256)

- strategyFactory: GlobalPause(bool)
- strategy.pool()
- strategy.vault()
- strategy.output()
- strategy.price()
- strategy.range()
- strategy.balanceOfPool()
- strategy.lpToken1ToNativePrice()
- strategy.lpToken0ToNativePrice()
- strategy.ouptutToNativePrice()
- strategy: Initialized(uint8)
- strategy: Paused(address)
- strategy: Unpaused(address)
- strategy: Harvest(uint256,uint256)
- strategy: ClaimedFees(uint256,uint256,uint256,uint256)
- strategy: ClaimedOutput(uint256)

- rewardPoolFactory: ProxyCreated(address)
- rewardPool.stakedToken()
- rewardPool: Initialized(uint8)
```
