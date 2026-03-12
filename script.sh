#!/usr/bin/env bash

set -euo pipefail
set -x

# Node 25 currently trips Yarn PnP's ESM loader path (EBADF in `tsc`);
# force node-modules linker so CI/local builds stay stable across Node versions.
export YARN_NODE_LINKER=node-modules

cmd="${1:-}"

case "$cmd" in
  build)
    yarn install --immutable
    yarn run tsc --noEmit
    yarn run eslint .
    yarn run prettier --check .
    yarn run tsdown
    yarn pack --out artifacts/pretty-error-tree.tgz
    ;;
  test)
    yarn install
    yarn run tsc --noEmit
    yarn run eslint .
    yarn run tsx test/test.ts
    yarn run prettier --check .
    yarn run tsdown
    yarn pack --out artifacts/pretty-error-tree.tgz
    bash -c "cd test-project && yarn cache clean && yarn && yarn run test"
    ;;
  testlite)
    yarn install
    yarn run tsc --noEmit
    yarn run eslint .
    yarn run tsx test/test.ts
    ;;
  *)
    echo "Usage: $0 <build|test|testlite>"
    exit 1
    ;;
esac
