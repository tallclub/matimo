#!/usr/bin/env node
// `matimo` command for the umbrella package: runs the CLI from @matimo/cli, which this
// package depends on, so the CLI code is not shipped twice.
import '@matimo/cli/dist/bin.js';
