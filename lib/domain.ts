export type Role = 'customer' | 'partner';
export type Status = 'requested' | 'negotiating' | 'fare_agreed' | 'confirmed' | 'partner_arrived' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
export type Driver = {id:string;name:string;rating:number;trips:number;car:string;plate:string;eta:number;verified:boolean};
export const drivers:Driver[] = [
 {id:'aisha',name:'Aisha Bello',rating:4.97,trips:1318,car:'Black Honda Accord',plate:'GWA 117 TR',eta:4,verified:true},
 {id:'emeka',name:'Emeka Okafor',rating:4.92,trips:2140,car:'Silver Toyota Corolla',plate:'ABJ 482 KY',eta:8,verified:true},
 {id:'tunde',name:'Tunde Adeyemi',rating:4.71,trips:640,car:'Blue Toyota Camry',plate:'KUJ 905 AB',eta:6,verified:true},
];
export const locations = ['Wuse 2, Abuja','Jabi Lake Mall, Abuja','Maitama, Abuja','Gwarinpa, Abuja','Central Business District, Abuja','Garki, Abuja','Asokoro, Abuja'];
export type Offer = {id:string;driverId:string;amount:number;sender:Role;status:'pending'|'accepted'|'rejected'|'expired'|'superseded';expiresAt:number;round:number;createdAt:number};
export type Booking = {id:string;type:'ride'|'delivery';pickup:string;destination:string;initialFare:number;fare:number|null;status:Status;driverId:string|null;offers:Offer[];createdAt:number;pin:string;recipient?:string;phone?:string;parcel?:string;instructions?:string;size?:string;tip:number;rating:number;payment:'pending'|'demo_recorded';events:{at:number;actor:Role;message:string}[]};
export type Workspace = {bookings:Booking[];profile:{name:string;phone:string;email:string;addresses:string[]};partner:{online:boolean;verification:'not_started'|'submitted'|'approved';name:string;phone:string;vehicle:string;plate:string;type:'ride'|'delivery'|'both'};transactions:{bookingId:string;driverId:string;gross:number;commission:number;net:number;at:number}[]};
export type Command = {type:string;role:Role;bookingId?:string;offerId?:string;driverId?:string;amount?:number;data?:Record<string,unknown>};
export const COMMISSION_BPS = 1000;
export const money = (minor:number) => new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(minor/100);
export const amount = (input:unknown):number => {const n=Number(input);if(!Number.isSafeInteger(n)||n<10000||n>50000000) throw Error('Enter a fare between ₦100 and ₦500,000, in whole kobo.');return n;};
const str = (v:unknown,min=2,max=200) => {if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)throw Error(`Please enter between ${min} and ${max} characters.`);return v.trim();};
const phone = (v:unknown) => {const s=str(v,10,20);if(!/^\+?[0-9 ()-]{10,20}$/.test(s)||s.replace(/\D/g,'').length<10)throw Error('Enter a valid phone number.');return s;};
export const emptyWorkspace = (name='Your profile'):Workspace => ({bookings:[],profile:{name,phone:'',email:'',addresses:[]},partner:{online:false,verification:'not_started',name:'',phone:'',vehicle:'',plate:'',type:'both'},transactions:[]});
const openStates:Status[]=['requested','negotiating','fare_agreed','confirmed','partner_arrived','in_progress'];
export function execute(source:Workspace,c:Command,now=Date.now()):Workspace {
 const s:Workspace=structuredClone(source); const d=c.data||{};
 const partnerId=c.driverId||'aisha';if(!drivers.some(p=>p.id===partnerId))throw Error('Unknown demo partner.');
 if(!['customer','partner'].includes(c.role))throw Error('Invalid role.');
 const requireRole=(r:Role)=>{if(c.role!==r)throw Error('This action is not available to your role.');};
 const partnerReady=()=>{requireRole('partner');if(s.partner.verification!=='approved'||!s.partner.online)throw Error('Complete demo approval and go online first.');};
 if(c.type==='profile'){s.profile.name=str(d.name,2,80);s.profile.phone=phone(d.phone);return s;}
 if(c.type==='address'){requireRole('customer');const address=str(d.address);if(!s.profile.addresses.includes(address))s.profile.addresses.push(address);return s;}
 if(c.type==='onboard'){requireRole('partner');s.partner={...s.partner,name:str(d.name,2,80),phone:phone(d.phone),vehicle:str(d.vehicle,2,80),plate:str(d.plate,2,20),type:d.partnerType==='ride'?'ride':d.partnerType==='delivery'?'delivery':'both',verification:'submitted',online:false};return s;}
 if(c.type==='demoApprove'){requireRole('partner');if(s.partner.verification!=='submitted')throw Error('Submit your application first.');s.partner.verification='approved';return s;}
 if(c.type==='availability'){requireRole('partner');if(s.partner.verification!=='approved')throw Error('Approval is required before going online.');s.partner.online=!s.partner.online;return s;}
 if(c.type==='request'){
  requireRole('customer');if(s.bookings.some(b=>openStates.includes(b.status)))throw Error('Finish or cancel your current booking first.');
  const pickup=str(d.pickup),destination=str(d.destination);if(pickup===destination)throw Error('Choose a different destination.');
  const type=d.type==='delivery'?'delivery':'ride';const b:Booking={id:crypto.randomUUID(),type,pickup,destination,initialFare:amount(c.amount),fare:null,status:'requested',driverId:null,offers:[],createdAt:now,pin:String(Math.floor(Math.random()*9000)+1000),tip:0,rating:0,payment:'pending',events:[{at:now,actor:'customer',message:'Request submitted'}]};
  if(type==='delivery'){b.recipient=str(d.recipient,2,80);b.phone=phone(d.phone);b.parcel=str(d.parcel,2,200);b.instructions=typeof d.instructions==='string'?d.instructions.slice(0,500):'';b.size=str(d.size,2,40);}
  s.bookings.unshift(b);return s;
 }
 const b=s.bookings.find(b=>b.id===c.bookingId);if(!b)throw Error('Booking not found.');
 const event=(message:string)=>b.events.push({at:now,actor:c.role,message});
 for(const o of b.offers)if(o.status==='pending'&&o.expiresAt<=now)o.status='expired';
 const negotiable=()=>{if(!['requested','negotiating'].includes(b.status))throw Error('This booking is no longer open to negotiation.');};
 const addOffer=(driverId:string,value:number,sender:Role,round:number)=>{const o:Offer={id:crypto.randomUUID(),driverId,amount:amount(value),sender,status:'pending',round,createdAt:now,expiresAt:now+300000};b.offers.push(o);b.status='negotiating';return o;};
 if(c.type==='demoOffers'){requireRole('customer');negotiable();if(b.offers.length)throw Error('Responses have already been generated.');drivers.forEach((driver,i)=>addOffer(driver.id,Math.min(50000000,b.initialFare+[20000,5000,40000][i]),'partner',1));event('Simulated partner responses received');return s;}
 if(c.type==='partnerAccept'){
  partnerReady();negotiable();if(s.partner.type!=='both'&&s.partner.type!==b.type)throw Error('This request does not match your partner type.');
  const latest=b.offers.filter(o=>o.driverId===partnerId).at(-1);if(latest?.status==='pending')throw Error('Respond to the current offer instead.');
  if(latest)throw Error('Use a counteroffer after the first negotiation round.');
  const accepted=addOffer(partnerId,b.initialFare,'customer',1);accepted.status='accepted';for(const o of b.offers)if(o.status==='pending')o.status='rejected';
  b.fare=b.initialFare;b.driverId=partnerId;b.status='fare_agreed';event('Partner accepted the initial fare; awaiting customer confirmation');return s;
 }
 if(c.type==='partnerOffer'){partnerReady();negotiable();if(s.partner.type!=='both'&&s.partner.type!==b.type)throw Error('This request does not match your partner type.');const latest=b.offers.filter(o=>o.driverId===partnerId).at(-1);if(latest?.status==='pending')throw Error('Respond to the current offer before submitting another.');if(latest&&latest.round>=3)throw Error('Three negotiation rounds have been reached.');addOffer(partnerId,amount(c.amount),'partner',(latest?.round||0)+1);event('Partner submitted a counteroffer');return s;}
 if(['counter','accept','reject'].includes(c.type)){
  negotiable();if(c.role==='partner')partnerReady();const o=b.offers.find(o=>o.id===c.offerId);if(!o||o.status!=='pending')throw Error('This offer is stale, expired, or already answered.');if(o.sender===c.role)throw Error('Wait for the other party to respond.');if(c.role==='partner'&&o.driverId!==partnerId)throw Error('This offer belongs to another partner.');
  if(c.type==='reject'){o.status='rejected';event('Offer declined');return s;}
  if(c.type==='counter'){if(o.round>=3)throw Error('Three rounds reached. Accept or decline this offer.');o.status='superseded';addOffer(o.driverId,amount(c.amount),c.role,o.round+1);event(`${c.role==='customer'?'Customer':'Partner'} countered with ${money(amount(c.amount))}`);return s;}
  o.status='accepted';for(const other of b.offers)if(other.status==='pending')other.status='rejected';b.fare=o.amount;b.driverId=o.driverId;b.status='fare_agreed';event('Fare agreed; awaiting customer confirmation');return s;
 }
 if(c.type==='confirm'){requireRole('customer');if(b.status!=='fare_agreed'||!b.fare||!b.driverId)throw Error('Agree a fare before confirming.');b.status='confirmed';event('Booking confirmed and partner assigned');return s;}
 if(c.type==='cancel'){if(!['requested','negotiating','fare_agreed','confirmed','partner_arrived'].includes(b.status))throw Error('This booking cannot be cancelled at this stage.');if(c.role==='partner'){partnerReady();if(!b.driverId||b.driverId!==partnerId)throw Error('Only the assigned partner can cancel this job.');}b.status='cancelled';b.offers.forEach(o=>{if(o.status==='pending')o.status='rejected';});event('Booking cancelled');return s;}
 if(['arrive','start','complete'].includes(c.type)){
  partnerReady();if(b.driverId!==partnerId)throw Error('Only the assigned partner can update this job.');
  if(c.type==='arrive'){if(b.status!=='confirmed')throw Error('The booking must be confirmed first.');b.status='partner_arrived';event('Partner arrived at pickup');}
  if(c.type==='start'){if(b.status!=='partner_arrived')throw Error('Arrive at pickup first.');if(String(d.pin)!==b.pin)throw Error('The pickup PIN does not match.');b.status='in_progress';event(b.type==='ride'?'Passenger pickup verified; ride started':'Parcel pickup verified; delivery in transit');}
  if(c.type==='complete'){if(b.status!=='in_progress'||!b.fare)throw Error('Start the job before completing it.');if(b.type==='delivery')str(d.proof,3,300);b.status='completed';const commission=Math.round(b.fare*COMMISSION_BPS/10000);s.transactions.push({bookingId:b.id,driverId:partnerId,gross:b.fare,commission,net:b.fare-commission,at:now});event(b.type==='delivery'?`Demo proof of delivery: ${str(d.proof,3,300)}`:'Ride completed');}
  return s;
 }
 if(c.type==='receipt'){requireRole('customer');if(b.status!=='completed'||b.payment==='demo_recorded')throw Error('Receipt unavailable or already recorded.');const tip=Number(d.tip);const rating=Number(d.rating);if(![0,20000,50000,100000].includes(tip)||!Number.isInteger(rating)||rating<1||rating>5)throw Error('Select a tip and a rating from one to five.');if(!['cash','card','transfer'].includes(String(d.method)))throw Error('Select a payment method.');b.tip=tip;b.rating=rating;b.payment='demo_recorded';event(`Demo ${String(d.method)} payment recorded; no money collected`);const t=s.transactions.find(t=>t.bookingId===b.id);if(t){t.gross+=tip;t.net+=tip;}return s;}
 throw Error('Unsupported action.');
}
