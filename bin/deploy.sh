#!/bin/bash

# config
valid_chains=($(ls config | sed 's/\.json//g'))
valid_providers=("goldsky" "0xgraph")

function exit_help {
    echo "Usage: $0 <chain> <provider1> [<provider2>] ... [<providerN>]"
    echo "   Example: $0 polygon goldsky"
    echo "   chains: " ${valid_chains[@]}
    echo "   providers: " ${valid_providers[@]}
    exit 1
}

function prepare {
    CHAIN=$1
    echo "preparing $CHAIN"
    yarn prepare:$CHAIN
    yarn codegen
    yarn build
}

function publish_0xgraph {
    SUBGRAPH=$1
    echo "publishing $SUBGRAPH to 0xgraph"
    yarn run graph remove $SUBGRAPH --node https://api.0xgraph.xyz/deploy
    sleep 5
    yarn run graph create $SUBGRAPH --node https://api.0xgraph.xyz/deploy
    sleep 5 
    yarn run graph deploy $SUBGRAPH --node https://api.0xgraph.xyz/deploy --ipfs https://api.0xgraph.xyz/ipfs --version-label=v0.0.1
}

function publish_goldsky {
    SUBGRAPH=$1
    echo "publishing $SUBGRAPH to goldsky"
    goldsky subgraph delete $SUBGRAPH/0.0.1 
    sleep 10
    goldsky subgraph deploy $SUBGRAPH/0.0.1 --path .
}

function publish {
    CHAIN=$1
    PROVIDER=$2
    SUBGRAPH=beefyfinance/clm-$CHAIN
    case $PROVIDER in
        "0xgraph")
            publish_0xgraph $SUBGRAPH
            ;;
        "goldsky")
            publish_goldsky $SUBGRAPH
            ;;
    esac
}


chain=$1
if [ -z "$chain" ]; then
    echo "chain is required"
    exit_help
fi
if [[ ! " ${valid_chains[@]} " =~ " ${chain} " ]]; then
    echo "invalid chain"
    exit_help
fi

shift
providers=$@
if [ -z "$providers" ]; then
    echo "providers are required"
    exit_help
fi
for provider in $providers; do
    if [[ ! " ${valid_providers[@]} " =~ " ${provider} " ]]; then
        echo "invalid provider $provider"
        exit_help
    fi
done


prepare $chain
for provider in $providers; do
    publish $chain $provider
done
