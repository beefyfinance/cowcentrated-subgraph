#!/usr/bin/env bash

set -e

# Ensure the config directory exists
mkdir -p .goldsky/config

# get the chain from the first argument
chain=$1
if [ -z "$chain" ]; then
    echo "Usage: $0 <chain>"
    exit 1
fi

valid_chains=($(ls config | sed 's/\.json//g'))
if [[ ! " ${valid_chains[@]} " =~ " ${chain} " ]]; then
    echo "Invalid chain: $chain"
    echo "Valid chains: ${valid_chains[@]}"
    exit 1
fi

# define version
case "$chain" in
    "gnosis") version="1.4.5" ;;
    *) version="1.4.5" ;;
esac

chain_name=$(echo "$chain" | sed 's/-/_/g')

# define version
case "$chain_name" in
    "gnosis") version="1.4.5-1" ;;
    "sonic") version="1.4.6" ;;
    "saga") version="1.4.6" ;;
    *) version="1.4.5" ;;
esac

# define target schema
case "$chain" in
    "arbitrum-beta") target_schema="arbitrum";;
    *) target_schema="$chain" ;;
esac

    
# Create a temporary JSON file for this chain
echo "{
    \"name\":\"$chain_name\",
    \"original_name\":\"$chain\",
    \"version\":\"$version\",
    \"target_schema\":\"$target_schema\"
}" > .goldsky/generated/temp.json

# Generate the pipeline file for this chain
yarn --silent run mustache .goldsky/generated/temp.json .goldsky/template/pipeline.template.yaml > ".goldsky/generated/${chain}.pipeline.yaml"

# Apply the pipeline
echo "Applying pipeline for $chain..."
goldsky pipeline apply ".goldsky/generated/${chain}.pipeline.yaml" --status ACTIVE