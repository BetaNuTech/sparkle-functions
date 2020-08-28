const { cloudFunctions } = require('./setup');

const functionNames = Object.keys(cloudFunctions);

// Write matched functions to STDOUT
process.stdout.write(functionNames.map(name => `functions:${name}`).join(','));
process.exit(0);
