#!/bin/bash

set -e

# config
valid_chains=($(ls config | sed 's/\.json//g'))
valid_providers=("goldsky")

function exit_help {
    echo "Usage: $0 <version> tag <provider> <deploy_key>"
    echo "   Example: $0 0.1.4 latest goldsky ABCDEA123"
    echo "   chains: " ${valid_chains[@]}
    echo "   providers: " ${valid_providers[@]}
    exit 1
}


function tag_one_goldsky {
    SUBGRAPH=$1
    VERSION=$2
    TAG=$4
    DEPLOY_KEY=$3
    echo "Tagging $SUBGRAPH/$VERSION to $TAG"
    goldsky subgraph tag create $SUBGRAPH/$VERSION --token $DEPLOY_KEY --tag $TAG
}

function tag_one {
    VERSION=$1
    TAG=$2
    PROVIDER=$3
    DEPLOY_KEY=$4
    case $PROVIDER in
        "goldsky")
            tag_one_goldsky beefy-clm-$CHAIN $VERSION $DEPLOY_KEY
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


tag=$2
if [ -z "$tag" ]; then
    echo "tag is required"
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

for chain in ${valid_chains[@]}; do
    tag_one $version $tag $provider $deploy_key
done