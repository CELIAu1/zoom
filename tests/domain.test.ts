import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {execute,emptyWorkspace,COMMISSION_BPS,type Workspace,type Command} from '../lib/domain.ts';
const NOW=1000000;
const req=(type='ride'):Command=>({type:'request',role:'customer',amount:255000,data:{type,pickup:'Wuse 2, Abuja',destination:'Jabi Lake Mall, Abuja',recipient:'Feyi',phone:'08012345678',parcel:'Books',size:'Small parcel'}});
function ready(s:Workspace){s=execute(s,{type:'onboard',role:'partner',data:{name:'Sample partner',phone:'08012345678',vehicle:'Honda Accord',plate:'GWA 117 TR',partnerType:'both'}},NOW);s=execute(s,{type:'demoApprove',role:'partner'},NOW);return execute(s,{type:'availability',role:'partner'},NOW);}
function step(s:Workspace,c:Partial<Command>){return execute(s,{role:'customer',bookingId:s.bookings[0].id,...c} as Command,NOW+100);}
function agreed(type='ride',id='aisha'){let s=ready(execute(emptyWorkspace(),req(type),NOW));s=step(s,{type:'demoOffers'});return step(s,{type:'accept',offerId:s.bookings[0].offers.find(o=>o.driverId===id)!.id});}
test('ride: agreement, explicit confirmation, PIN, completion, receipt and exact earnings',()=>{
 let s=agreed();assert.equal(s.bookings[0].status,'fare_agreed');assert.equal(s.transactions.length,0);
 assert.throws(()=>step(s,{type:'start',role:'partner',data:{pin:s.bookings[0].pin}}),/Arrive/);
 s=step(s,{type:'confirm'});s=step(s,{type:'arrive',role:'partner'});
 assert.throws(()=>step(s,{type:'start',role:'partner',data:{pin:'wrong'}}),/PIN/);
 s=step(s,{type:'start',role:'partner',data:{pin:s.bookings[0].pin}});s=step(s,{type:'complete',role:'partner'});
 assert.equal(s.bookings[0].status,'completed');assert.deepEqual(s.transactions.map(t=>[t.gross,t.commission,t.net]),[[275000,27500,247500]]);
 assert.throws(()=>step(s,{type:'complete',role:'partner'}),/Start/);
 s=step(s,{type:'receipt',data:{tip:20000,rating:5,method:'cash'}});assert.equal(s.transactions[0].net,267500);assert.equal(s.transactions[0].commission,27500);
 assert.throws(()=>step(s,{type:'receipt',data:{tip:20000,rating:5,method:'cash'}}),/already/);
 assert.equal(COMMISSION_BPS,1000);
});
test('delivery requires recipient details and completion proof',()=>{
 assert.throws(()=>execute(emptyWorkspace(),{...req('delivery'),data:{...req('delivery').data,phone:'bad'}},NOW),/characters|phone/);
 let s=agreed('delivery','emeka');s=step(s,{type:'confirm'});s=step(s,{type:'arrive',role:'partner',driverId:'emeka'});s=step(s,{type:'start',role:'partner',driverId:'emeka',data:{pin:s.bookings[0].pin}});
 assert.throws(()=>step(s,{type:'complete',role:'partner',driverId:'emeka'}),/characters/);
 s=step(s,{type:'complete',role:'partner',driverId:'emeka',data:{proof:'Handed parcel to Feyi'}});assert.equal(s.transactions[0].driverId,'emeka');assert.match(s.bookings[0].events.at(-1)!.message,/Feyi/);
});
test('two-way negotiation keeps offer history and obeys turns and three rounds',()=>{
 let s=ready(execute(emptyWorkspace(),req(),NOW));s=step(s,{type:'demoOffers'});const first=s.bookings[0].offers[0];
 assert.throws(()=>step(s,{type:'accept',role:'partner',offerId:first.id}),/other party/);
 s=step(s,{type:'counter',offerId:first.id,amount:260000});assert.equal(s.bookings[0].offers[0].status,'superseded');
 const second=s.bookings[0].offers.at(-1)!;assert.equal(second.sender,'customer');
 assert.throws(()=>step(s,{type:'accept',offerId:first.id}),/stale/);
 s=step(s,{type:'counter',role:'partner',offerId:second.id,amount:270000});const third=s.bookings[0].offers.at(-1)!;
 assert.throws(()=>step(s,{type:'counter',offerId:third.id,amount:265000}),/Three/);
 s=step(s,{type:'accept',offerId:third.id});assert.equal(s.bookings[0].fare,270000);
 assert.throws(()=>step(s,{type:'accept',offerId:s.bookings[0].offers[1].id}),/no longer/);
});
test('expired and duplicate offers cannot be accepted; cancelled trips cannot start',()=>{
 let s=ready(execute(emptyWorkspace(),req(),NOW));s=step(s,{type:'demoOffers'});const offer=s.bookings[0].offers[0];
 assert.throws(()=>execute(s,{type:'accept',role:'customer',bookingId:s.bookings[0].id,offerId:offer.id},NOW+301000),/expired/);
 s=step(s,{type:'cancel'});assert.throws(()=>step(s,{type:'confirm'}),/Agree/);assert.throws(()=>step(s,{type:'start',role:'partner'}),/assigned/);
});
test('server rejects role violations, unapproved partners, wrong assignments and invalid fares',()=>{
 for(const amount of [0,-1,9999,50000001,NaN,Infinity,255000.5])assert.throws(()=>execute(emptyWorkspace(),{...req(),amount},NOW),/fare/);
 let s=execute(emptyWorkspace(),req(),NOW);assert.throws(()=>step(s,{type:'partnerOffer',role:'partner',amount:255000}),/approval/);
 assert.throws(()=>step(s,{type:'demoOffers',role:'partner'}),/role/);
 s=agreed();s=step(s,{type:'confirm'});assert.throws(()=>step(s,{type:'arrive',role:'partner',driverId:'emeka'}),/assigned/);
 assert.throws(()=>step(s,{type:'arrive',role:'customer'}),/role/);
 assert.throws(()=>execute(s,req(),NOW),/current booking/);
});
test('D1 schema: isolated owners, persisted payload and compare-and-swap rejects second claimant',()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_nosy_thunderball.sql',import.meta.url),'utf8'));
 const original=execute(emptyWorkspace(),req(),NOW);const insert=db.prepare('INSERT INTO workspaces (user_id,payload,version) VALUES (?,?,0)');insert.run('owner-1',JSON.stringify(original));insert.run('owner-2',JSON.stringify(emptyWorkspace()));
 const update=db.prepare('UPDATE workspaces SET payload=?,version=version+1 WHERE user_id=? AND version=?');assert.equal(update.run(JSON.stringify(ready(original)),'owner-1',0).changes,1);assert.equal(update.run('{}','owner-1',0).changes,0);
 const rows=db.prepare('SELECT payload,version FROM workspaces WHERE user_id=?');assert.equal((rows.get('owner-1') as {version:number}).version,1);assert.equal(JSON.parse((rows.get('owner-2') as {payload:string}).payload).bookings.length,0);db.close();
});
test('partner can accept initial fare without turning agreement into a started trip',()=>{
 let s=ready(execute(emptyWorkspace(),req(),NOW));s=step(s,{type:'partnerAccept',role:'partner',driverId:'tunde'});assert.equal(s.bookings[0].status,'fare_agreed');assert.equal(s.bookings[0].fare,255000);assert.equal(s.bookings[0].driverId,'tunde');assert.equal(s.bookings[0].offers[0].status,'accepted');
 assert.throws(()=>step(s,{type:'confirm',role:'partner',driverId:'tunde'}),/role/);s=step(s,{type:'confirm'});assert.equal(s.bookings[0].status,'confirmed');assert.equal(s.transactions.length,0);
});
