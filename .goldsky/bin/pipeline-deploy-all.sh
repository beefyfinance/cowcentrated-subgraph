#!/usr/bin/env bash

set -e

for chain in $(ls config | sed 's/\.json//g'); do
    ./bin/pipeline-deploy.sh "$chain"
done