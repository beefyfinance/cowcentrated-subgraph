#!/usr/bin/env bash

set -e


# Get total number of chains for last element tracking
total_chains=$(ls config | wc -l)
current_chain=0

# Create a JSON array of objects with name and version
chains_json="["
for chain in $(ls config | sed 's/\.json//g'); do
    current_chain=$((current_chain + 1))
    chain_name=$(echo "$chain" | sed 's/-/_/g')

    if [ "$chain_name" = "arbitrum_beta" ]; then
        continue;
    fi

    # define version
    case "$chain_name" in
        *) version="1.4.6" ;;
    esac
    
    is_last="false"
    if [ "$current_chain" -eq "$total_chains" ]; then
        is_last="true"
    fi
    
    chains_json+="{\"name\":\"$chain_name\",\"original_name\":\"$chain\",\"version\":\"$version\",\"last\":$is_last}"
    if [ "$current_chain" -ne "$total_chains" ]; then
        chains_json+=',
'
    fi
done
chains_json+="]"

echo "{ \"chains\": $chains_json }" > .goldsky/generated/chains.json

yarn --silent run mustache .goldsky/generated/chains.json .goldsky/template/moveticks.template.sql > .goldsky/generated/moveticks.sql