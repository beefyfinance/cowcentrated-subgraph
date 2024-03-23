#!/bin/bash

CHAIN=$1

if [ -z "$CHAIN" ]; then
    echo "Usage: $0 <chain>"
    exit 1
fi

set -e

yarn --silent run mustache config/$CHAIN.json subgraph.template.yaml > subgraph.yaml 
yarn --silent run mustache config/$CHAIN.json src/config.template.ts > src/config.ts 