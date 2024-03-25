#!/bin/bash

CHAIN=$1
valid_chains=($(ls config | sed 's/\.json//g'))

if [ -z "$CHAIN" ]; then
    echo "Usage: $0 <chain>"
    exit 1
fi

if [[ ! " ${valid_chains[@]} " =~ " ${CHAIN} " ]]; then
    echo "invalid chain"
    exit 1
fi

set -e

yarn --silent run mustache config/$CHAIN.json subgraph.template.yaml > subgraph.yaml 
yarn --silent run mustache config/$CHAIN.json src/config.template.ts > src/config.ts 