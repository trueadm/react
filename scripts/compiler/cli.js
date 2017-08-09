const Modules = require('./src/modules');
const getHasteMap = require('./src/haste-map').getHasteMap;
const argv = require("minimist")(process.argv.slice(2));
const path = require("path");
const generate = require('babel-generator').default;
const entryFilePath = argv._[0];

if (!entryFilePath) {
  console.error("No entry file path supplied");
  process.exit(1);
}
const resolveEntryFilePath = path.resolve(entryFilePath);

console.log(`Using entry file path: "${resolveEntryFilePath}"`);
console.log('Scanning for all JavaScript modules. This may take a while.');
getHasteMap(resolveEntryFilePath).then(hasteMap => {
  const entryModuleName = path.basename(resolveEntryFilePath, '.js');
  Modules.analyzeModule(entryModuleName, hasteMap);
  const result = Modules.compileModule(entryModuleName);
  console.log(generate(result).code);
}).catch(e => {
  console.error(e.stack);
  process.exit(1);
});
