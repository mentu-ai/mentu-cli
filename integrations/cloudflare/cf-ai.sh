#!/bin/bash
# Cloudflare AI CLI wrapper with credentials
# Usage: ./cf-ai.sh chat "Hello"

export CLOUDFLARE_ACCOUNT_ID="87c0cdbd93616c844386ed9f3d702ba1"
export CLOUDFLARE_API_TOKEN="j8bzzx5gmX_7LQzv5DQFoksSxanVYB3zYIrg5ezl"

cf-ai "$@"
