#!/usr/bin/env bash

# config
valid_chains=($(ls config | sed 's/\.json//g'))
valid_providers=("goldsky" "0xgraph" "sentio")

function exit_help {
    echo "Usage: $0 <version> <provider> <deploy_key>"
    echo "   Example: $0 0.1.4 goldsky ABCDEA123"
    echo "   chains: " ${valid_chains[@]}
    echo "   providers: " ${valid_providers[@]}
    exit 1
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

successful_chains=()
failed_chains=()

for chain in ${valid_chains[@]}; do
    echo ""
    echo "=========================================="
    echo "Releasing $chain..."
    echo "=========================================="
    if $SCRIPT_DIR/release.sh $version $chain $provider $deploy_key; then
        successful_chains+=($chain)
        echo "✓ Successfully released $chain"
    else
        failed_chains+=($chain)
        echo "✗ Failed to release $chain"
    fi
done

echo ""
echo "=========================================="
echo "Release Summary"
echo "=========================================="
echo "Successful: ${#successful_chains[@]}"
for chain in ${successful_chains[@]}; do
    echo "  ✓ $chain"
done
echo ""
echo "Failed: ${#failed_chains[@]}"
for chain in ${failed_chains[@]}; do
    echo "  ✗ $chain"
done
echo ""

if [ ${#failed_chains[@]} -gt 0 ]; then
    exit 1
fi
