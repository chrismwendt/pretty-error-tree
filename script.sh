#!/usr/bin/env bash

set -euo pipefail

set -x

if [[ "$1" == "build" ]]; then
  yarn install
  yarn run tsc --noEmit
  yarn run eslint .
  yarn run prettier --check .
  yarn run tsdown
  yarn pack --out artifacts/pretty-error-tree.tgz
elif [[ "$1" == "test" ]]; then
  yarn install
  yarn run tsc --noEmit
  yarn run eslint .
  yarn run tsx test/test.ts
  yarn run prettier --check .
  yarn run tsdown
  yarn pack --out artifacts/pretty-error-tree.tgz
  bash -c "cd test-project && yarn cache clean && yarn && yarn run test"
elif [[ "$1" == "testlite" ]]; then
  yarn install
  yarn run tsc --noEmit
  yarn run eslint .
  yarn run tsx test/test.ts
else
  echo "Usage: $0 <build|test|testlite>"
  exit 1
fi
