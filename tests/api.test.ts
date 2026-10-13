import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const esbuild=await import(require.resolve('esbuild',{paths:[require.resolve('vite')]}));
const temp=mkdtempSync(join(tmpdir(),'waka-api-test-'));
await esbuild.build({entryPoints:[new URL('../app/api/workspace/route.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',outfile:join(temp,'route.mjs'),plugins:[{name:'test-bindings',setup(build:any){build.onResolve({filter:/cloudflare:workers|chatgpt-auth|^@waka\/runtime$/},(args:any)=>args.path==='@waka/runtime'?({path:new URL('../lib/sites-workspace.ts',import.meta.url).pathname}):({path:args.path,namespace:'bindings'}));build.onLoad({filter:/.*/,namespace:'bindings'},(args:any)=>({contents:args.path==='cloudflare:workers'?'export const env={get DB(){return globalThis.__wakaDB}}':'export async function getChatGPTUser(){return globalThis.__wakaUser}',loader:'js'}));}}]});
const api=await import(pathToFileURL(join(temp,'route.mjs')).href);
const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_nosy_thunderball.sql',import.meta.url),'utf8'));
const global=globalThis as any;
global.__wakaDB = {
  prepare(sql: string) {
    return {
      bind(...values: any[]) {
        return {
          async first() { return db.prepare(sql).get(...values) || null; },
          async run() {
            const result = db.prepare(sql).run(...values);
            return { meta: { changes: Number(result.changes) } };
          },
        };
      },
    };
  },
};
const identity={userId:'alice',fullName:'Alice',email:'alice@example.test'};
const cmd={type:'request',role:'customer',amount:255000,data:{type:'ride',pickup:'Wuse 2',destination:'Jabi Lake Mall'}};
const post=(command:unknown=cmd,version=0,origin='https://waka.test')=>api.POST(new Request('https://waka.test/api/workspace',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({command,version})}));
test('API: rejects unauthenticated access, cross-origin writes and oversized bodies',async()=>{
 global.__wakaUser=null;assert.equal((await api.GET()).status,401);assert.equal((await post()).status,401);
 global.__wakaUser=identity;assert.equal((await post(cmd,0,'https://other.test')).status,403);
 assert.equal((await api.POST(new Request('https://waka.test/api/workspace',{method:'POST',headers:{origin:'https://waka.test'},body:'a'.repeat(13000)}))).status,413);
});
test('API: persists booking, refuses replay, and isolates another signed-in account',async()=>{
 global.__wakaUser=identity;const saved=await post();assert.equal(saved.status,200);const first=await saved.json();assert.equal(first.version,1);assert.equal(first.state.bookings.length,1);
 assert.equal((await post()).status,409);const reload=await (await api.GET()).json();assert.equal(reload.state.bookings[0].id,first.state.bookings[0].id);
 global.__wakaUser={...identity,userId:'bob'};const other=await (await api.GET()).json();assert.equal(other.state.bookings.length,0);
 assert.equal((await post({type:'cancel',role:'customer',bookingId:first.state.bookings[0].id},0)).status,400);
});
test('API: concurrent writes at one version have exactly one winner',async()=>{
 global.__wakaUser=identity;const res=await (await api.GET()).json();const command={type:'demoOffers',role:'customer',bookingId:res.state.bookings[0].id};
 const results=await Promise.all([post(command,res.version),post(command,res.version)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const stored=await (await api.GET()).json();assert.equal(stored.version,2);assert.equal(stored.state.bookings[0].offers.length,3);
});
test.after(()=>{db.close();delete global.__wakaDB;delete global.__wakaUser;rmSync(temp,{recursive:true,force:true});});
