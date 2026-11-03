import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const path='transport/framework-agent-cli.ts';
const files=['claude-framework-runner.ts','framework-state-commands.ts'];
const pins=Object.fromEntries(files.map(name=>[name,createHash('sha256').update(readFileSync('transport/'+name)).digest('hex')]));
const original=readFileSync(path,'utf8');
const pattern=/\/\/ BEGIN FRAMEWORK POLICY PINS\r?\n[\s\S]*?\/\/ END FRAMEWORK POLICY PINS/;
if(!pattern.test(original))throw Error('Policy pin markers missing.');
const updated=original.replace(pattern,'// BEGIN FRAMEWORK POLICY PINS\nconst policyPins:Record<string,string>='+JSON.stringify(pins)+';\n// END FRAMEWORK POLICY PINS');
if(process.argv.includes('--write')){writeFileSync(path,updated);console.log('Pinned two trusted policy modules in the fixed entry point.');}
else if(original!==updated){console.error('Framework policy pins changed. Review changes before running with --write.');process.exitCode=1;}
else console.log('Framework execution policy pins verified.');
