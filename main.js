// Tiny launcher: register tsx so we can require TS sources directly.
// All real main-process logic lives in src/main/index.ts.
require('tsx/cjs');
require('./src/main/index.ts');
