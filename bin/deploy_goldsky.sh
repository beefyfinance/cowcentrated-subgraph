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

goldsky subgraph delete $SUBGRAPH/0.0.1 
sleep 5

goldsky subgraph deploy $SUBGRAPH/0.0.1 --path .
