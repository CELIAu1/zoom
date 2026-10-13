import test from 'node:test';
import assert from 'node:assert/strict';
import {GET,POST} from '../lib/vercel-workspace.ts';
import {issueSession,verifySession} from '../lib/vercel-session.ts';
const originalEnv={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,secret:process.env.WAKA_SESSION_SECRET};
const originalFetch=globalThis.fetch;
const secret='test-only-secret-with-at-least-32-characters';
const url='https://waka.test/api/workspace';
const command={type:'request',role:'customer',amount:255000,data:{type:'ride',pickup:'Wuse 2',destination:'Jabi Lake Mall'}};
const post=(cmd:any=command,version=0,cookie='',origin='https://waka.test')=>POST(new Request(url,{method:'POST',headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify({command:cmd,version})}));
const rows=new Map<string,any>();
function configure(){process.env.SUPABASE_URL='https://database.example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-role';process.env.WAKA_SESSION_SECRET=secret;
 globalThis.fetch=async (input:any,init:any)=>{
  const u=new URL(String(input));const method=init?.method||'GET';const owner=u.searchParams.get('owner_id')?.slice(3);
  assert.equal(init.headers.apikey,'test-service-role');
  if(method==='GET')return Response.json(owner&&rows.has(owner)?[rows.get(owner)]:[]);
  if(method==='POST'){const body=JSON.parse(init.body);if(!rows.has(body.owner_id))rows.set(body.owner_id,body);return new Response(null,{status:201});}
  if(method==='PATCH'){const row=owner?rows.get(owner):undefined;const version=Number(u.searchParams.get('version')?.slice(3));if(!row||row.version!==version)return Response.json([]);const next={...row,...JSON.parse(init.body)};rows.set(owner!,next);return Response.json([next]);}
  throw Error('Unexpected query');
 };
}
test('Vercel: no configuration shows explicit setup mode and refuses server writes',async()=>{
 delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.WAKA_SESSION_SECRET;
 const res=await GET(new Request(url));const p=await res.json() as any;assert.equal(p.storage,'unconfigured');assert.equal(p.state.bookings.length,0);assert.equal((await post()).status,503);assert.equal((await post(command,0,'','https://other.test')).status,403);
});
test('Vercel session rejects tampering and expiry',()=>{
 const s=issueSession(secret,1000);assert.equal(verifySession(s.token,secret,1001),s.id);assert.equal(verifySession(s.token+'x',secret,1001),null);assert.equal(verifySession(s.token,'different-secret',1001),null);assert.equal(verifySession(s.token,secret,1000+31*24*60*60),null);
});
test('Vercel: cookie-authenticated Supabase workspace persists and rejects unauthenticated writes',async()=>{
 configure();assert.equal((await post()).status,401);
 const response=await GET(new Request(url));const cookie=response.headers.get('set-cookie')!.split(';')[0];assert.match(response.headers.get('set-cookie')!,/HttpOnly/);assert.match(response.headers.get('set-cookie')!,/Secure/);
 const saved=await post(command,0,cookie);assert.equal(saved.status,200);const p=await saved.json() as any;assert.equal(p.version,1);const retrieved=await (await GET(new Request(url,{headers:{cookie}}))).json() as any;assert.equal(retrieved.state.bookings[0].id,p.state.bookings[0].id);assert.equal((await post(command,0,cookie)).status,409);
});
test('Vercel: owner isolation and simultaneous version updates have one winner',async()=>{
 configure();const first=await GET(new Request(url));const c1=first.headers.get('set-cookie')!.split(';')[0];const second=await GET(new Request(url));const c2=second.headers.get('set-cookie')!.split(';')[0];
 const responses=await Promise.all([post(command,0,c1),post(command,0,c1)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 const a=await (await GET(new Request(url,{headers:{cookie:c1}}))).json() as any;const b=await (await GET(new Request(url,{headers:{cookie:c2}}))).json() as any;assert.equal(a.state.bookings.length,1);assert.equal(b.state.bookings.length,0);
 assert.equal((await post({type:'cancel',role:'customer',bookingId:a.state.bookings[0].id},0,c2)).status,400);
});
test.after(()=>{globalThis.fetch=originalFetch;for(const [name,value] of Object.entries({SUPABASE_URL:originalEnv.url,SUPABASE_SERVICE_ROLE_KEY:originalEnv.key,WAKA_SESSION_SECRET:originalEnv.secret})){if(value===undefined)delete process.env[name];else process.env[name]=value;}});
