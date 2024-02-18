#!/bin/sh

echo "Running arbitrum healthcheck"

HEALTHCHECK_FILE=/healtcheck-arbitrum-ok

if test -f $HEALTHCHECK_FILE; then
    echo "Healthcheck file exists"
else
    echo "Healthcheck file does not exist"
    curl http://rpc-proxy-cache-arbitrum:3000 -X POST -H "Content-Type: application/json" --data '{"method":"eth_chainId","params":[],"id":1,"jsonrpc":"2.0"}' > /dev/null 2>&1 || exit 1
    touch $HEALTHCHECK_FILE
fi