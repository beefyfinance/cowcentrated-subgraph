#!/bin/bash

CHAIN=$1

if [ -z "$CHAIN" ]; then
    echo "Usage: $0 <chain>"
    exit 1
fi

SUBGRAPH=beefyfinance/clm-$CHAIN

yarn prepare:$CHAIN
yarn codegen
yarn build

yarn run graph remove $SUBGRAPH --node https://api.0xgraph.xyz/deploy
sleep 5

yarn run graph create $SUBGRAPH --node https://api.0xgraph.xyz/deploy
sleep 5 

yarn run graph deploy $SUBGRAPH --node https://api.0xgraph.xyz/deploy --ipfs https://api.0xgraph.xyz/ipfs --version-label=v0.0.1