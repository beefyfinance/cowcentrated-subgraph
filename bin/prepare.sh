#!/usr/bin/env bash

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

echo "Generating subgraph.yaml $CHAIN"
yarn --silent run mustache config/$CHAIN.json subgraph.template.yaml > subgraph.yaml 

echo "Generating src/config.ts $CHAIN"
yarn --silent run mustache config/$CHAIN.json src/config.template.ts > src/config.ts 

RNG=$((1 + $RANDOM % 100000))
echo '{"random": '$RNG'}' > random.json
yarn --silent run mustache random.json src/random.template.ts > src/random.ts 