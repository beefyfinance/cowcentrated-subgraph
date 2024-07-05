#!/bin/bash

set -e

# config
valid_chains=($(ls config | sed 's/\.json//g'))
valid_providers=("goldsky" "0xgraph")

function exit_help {
    echo "Usage: $0 <version> <provider> <deploy_key>"
    echo "   Example: $0 0.1.4 goldsky ABCDEA123"
    echo "   chains: " ${valid_chains[@]}
    echo "   providers: " ${valid_providers[@]}
    exit 1
}


function delete_goldsky {
    SUBGRAPH=$1
    VERSION=$2
    DEPLOY_KEY=$3
    echo "deleting $SUBGRAPH to goldsky"
    goldsky subgraph delete $SUBGRAPH/$VERSION --token $DEPLOY_KEY
}

function delete_subgraph {
    VERSION=$1
    CHAIN=$2
    PROVIDER=$3
    DEPLOY_KEY=$4
    case $PROVIDER in
        "goldsky")
            delete_goldsky beefy-clm-$CHAIN $VERSION $DEPLOY_KEY
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


provider=$2
if [ -z "$provider" ]; then
    echo "provider is required"
    exit_help
fi
if [[ ! " ${valid_providers[@]} " =~ " ${provider} " ]]; then
    echo "invalid provider $provider"
    exit_help
fi

deploy_key=$3
if [ -z "$deploy_key" ]; then
    echo "deploy key is required"
    exit_help
fi

for chain in ${valid_chains[@]}; do
    delete_subgraph $version $chain $provider $deploy_key
done
