#!/bin/sh
# Kept for old habits: the build now lives in scripts/build.mjs (npm run build).
cd "$(dirname "$0")" && node scripts/build.mjs
