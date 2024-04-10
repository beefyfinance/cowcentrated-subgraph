#!/bin/bash

# config
valid_chains=($(ls config | sed 's/\.json//g'))
valid_providers=("goldsky" "0xgraph")

function exit_help {
    echo "Usage: $0 <version> <chain> <provider>"
    echo "   Example: $0 0.1.4 polygon goldsky"
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
    VERSION=$2
    yarn run graph deploy $SUBGRAPH --node https://api.0xgraph.xyz/deploy --ipfs https://api.0xgraph.xyz/ipfs --version-label="v$VERSION"
}

function publish_goldsky {
    SUBGRAPH=$1
    VERSION=$2
    echo "publishing $SUBGRAPH to goldsky"
    goldsky subgraph deploy $SUBGRAPH/$VERSION --path .
}

function publish {
    CHAIN=$1
    PROVIDER=$2
    VERSION=$3
    SUBGRAPH=beefyfinance/clm-$CHAIN
    case $PROVIDER in
        "0xgraph")
            publish_0xgraph $SUBGRAPH $VERSION
            ;;
        "goldsky")
            publish_goldsky $SUBGRAPH $VERSION
            ;;
    esac
}


version=$1
if [ -z "$version" ]; then
    echo "version is required"
    exit_help
fi
if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "invalid version"
    exit_help
fi


chain=$2
if [ -z "$chain" ]; then
    echo "chain is required"
    exit_help
fi
if [[ ! " ${valid_chains[@]} " =~ " ${chain} " ]]; then
    echo "invalid chain"
    exit_help
fi

provider=$3
if [ -z "$provider" ]; then
    echo "provider is required"
    exit_help
fi
if [[ ! " ${valid_providers[@]} " =~ " ${provider} " ]]; then
    echo "invalid provider $provider"
    exit_help
fi

SUBGRAPH=beefyfinance/clm-$chain
prepare $chain
publish $version $chain $provider 
