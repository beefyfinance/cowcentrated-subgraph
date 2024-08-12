#!/bin/bash

set -e

# config
valid_chains=($(ls config | sed 's/\.json//g'))
valid_providers=("goldsky" "0xgraph")

function exit_help {
    echo "Usage: $0 <version> <chain> <provider> <deploy_key>"
    echo "   Example: $0 0.1.4 polygon goldsky ABCDEA123"
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
    DEPLOY_KEY=$3
    echo "publishing $SUBGRAPH to 0xgraph"
    yarn run graph deploy $SUBGRAPH --node https://api.0xgraph.xyz/deploy --ipfs https://api.0xgraph.xyz/ipfs --version-label="v$VERSION" --deploy-key=$DEPLOY_KEY
}

function publish_goldsky {
    SUBGRAPH=$1
    VERSION=$2
    DEPLOY_KEY=$3
    echo "publishing $SUBGRAPH to goldsky"
    goldsky subgraph deploy $SUBGRAPH/$VERSION --path . --token $DEPLOY_KEY
    sleep 5 # wait for the subgraph to propagate
    goldsky subgraph tag create $SUBGRAPH/$VERSION --token $DEPLOY_KEY --tag next
}

function publish {
    VERSION=$1
    CHAIN=$2
    PROVIDER=$3
    DEPLOY_KEY=$4
    SUBGRAPH=
    case $PROVIDER in
        "0xgraph")
            publish_0xgraph beefyfinance/clm-$CHAIN $VERSION $DEPLOY_KEY
            ;;
        "goldsky")
            publish_goldsky beefy-clm-$CHAIN $VERSION $DEPLOY_KEY
            ;;
    esac
}


version=$1
if [ -z "$version" ]; then
    echo "version is required"
    exit_help
fi
# allow only x.y.z and x.y.z-n versions
if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9]+)?$ ]]; then
    echo "invalid version ""$version"""
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

deploy_key=$4
if [ -z "$deploy_key" ]; then
    echo "deploy key is required"
    exit_help
fi

prepare $chain
publish $version $chain $provider $deploy_key
