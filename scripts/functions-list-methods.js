require('../functions/test/end-to-end/setup'); // Stub `firebase-admin` module
const cloudFunctions = require('../functions/index');
const TARGET = process.argv[2] || 'staging';
var functionNames = Object.keys(cloudFunctions);

if (TARGET.search(/^prod/i) !== -1) {
  functionNames = functionNames.filter(name => name.search(/staging/i) === -1); // production only
} else {
  functionNames = functionNames.filter(name => name.search(/staging/i) > -1); // staging only
}

// Write matched functions to STDOUT
process.stdout.write(functionNames.map(name => `functions:${name}`).join(','));
process.exit(0);
