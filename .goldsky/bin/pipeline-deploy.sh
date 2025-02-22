#!/usr/bin/env bash

set -e

# Ensure the config directory exists
mkdir -p .goldsky/config

for chain in $(ls config | sed 's/\.json//g'); do
    chain_name=$(echo "$chain" | sed 's/-/_/g')

    # define version
    case "$chain_name" in
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
    yarn --silent run mustache .goldsky/temp.json .goldsky/template/pipeline.template.yaml > ".goldsky/generated/${chain}.pipeline.yaml"
    
    # Apply the pipeline
    echo "Applying pipeline for $chain..."
    goldsky pipeline apply ".goldsky/generated/${chain}.pipeline.yaml" --status ACTIVE
done