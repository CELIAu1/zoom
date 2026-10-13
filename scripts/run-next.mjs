import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [command,...args]=process.argv.slice(2);
if(!['build','dev','start'].includes(command))throw Error('Expected build, dev or start.');
const result=spawnSync(process.execPath,[fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)),command,...(command==='start'?[]:['--webpack']),...args],{stdio:'inherit',env:{...process.env,WAKA_BUILD_TARGET:'vercel',NEXT_TELEMETRY_DISABLED:'1'}});
if(result.error)throw result.error;
process.exit(result.status??1);
