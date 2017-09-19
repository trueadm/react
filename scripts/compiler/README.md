# React Compiler

## Installation

Checkout a fork of Prepack locally:
- git clone git@github.com:trueadm/prepack.git locally
- git checkout `hacks` branch from the repo
- run `yarn` from within the repo

From the React repo:
- run `yarn` from within `scripts/compiler/`
- enter `scripts/compiler/node_modules` and `rm -rf prepack`
- symlink your local Prepack repo into `scripts/compiler/node_modules` (i.e. `ln -s ~/Projects/prepack ~/Projects/react/scripts/compiler/node_modules`)

## Using the compiler

### Tests

From the root of the React repo, run `yarn test:compiler` to run through all compiler fixtures. 

### Command line

The CLI tool for the compiler is located at `node scripts/compiler/cli.js`. Use at least Node 8+ to run the compiler.

The compiler requires you pass it two arguments. The first argument passed to `cli.js` is the entry JavaScript file to compile and the second argument is the output bundle path to compile to.

For example, to compile `scripts/compiler/examples/hacker-news/` the command would be (from the root of the React repo):

`node scripts/compiler/cli.js scripts/compiler/examples/hacker-news/App.js scripts/compiler/examples/hacker-news/compiled-bundle.js`