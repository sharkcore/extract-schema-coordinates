#!/usr/bin/env bash
set -euo pipefail

# prevent our postinstall hook from infecting applications 
jq 'del(.scripts.postinstall)' package.json > package.json.tmp
mv package.json.tmp package.json
rm package.json.tmp