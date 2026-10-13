-- Waka product schema. Fresh tables: no demo workspace records are migrated.
begin;
create table public.waka_profiles (
 id uuid primary key references auth.users(id), role text not null check(role in ('customer','driver','merchant','admin')),
 name text not null check(length(name) between 2 and 100), phone text not null default '', city text not null default 'Abuja',
 business_name text not null default '', disabled boolean not null default false, created_at timestamptz not null default now()
);
create table public.waka_drivers (
 id uuid primary key references public.waka_profiles(id), status text not null default 'incomplete' check(status in ('incomplete','pending','approved','rejected','suspended')),
 vehicle text not null default '', plate text not null default '', color text not null default '', license_reference text not null default '',
 online boolean not null default false, review_note text not null default '', reviewed_by uuid references public.waka_profiles(id), reviewed_at timestamptz,
 latitude double precision, longitude double precision, location_at timestamptz
);
create table public.waka_bookings (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.waka_profiles(id), driver_id uuid references public.waka_profiles(id),
 service text not null check(service in ('ride','delivery')), city text not null, pickup text not null check(length(pickup) between 3 and 240), destination text not null check(length(destination) between 3 and 240),
 pickup_lat double precision check(pickup_lat between -90 and 90), pickup_lng double precision check(pickup_lng between -180 and 180), destination_lat double precision check(destination_lat between -90 and 90), destination_lng double precision check(destination_lng between -180 and 180),
 recipient text not null default '', recipient_phone text not null default '', parcel text not null default '', instructions text not null default '',
 initial_fare integer not null check(initial_fare between 10000 and 50000000), agreed_fare integer check(agreed_fare between 10000 and 50000000),
 status text not null default 'searching' check(status in ('searching','assigned','arrived','in_progress','completed','cancelled')),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','cash_received')), tip integer not null default 0 check(tip between 0 and 10000000),
 commission_bps integer not null default 1000 check(commission_bps between 0 and 10000), rating integer check(rating between 1 and 5),
 delivery_proof text, cancel_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz,
 expires_at timestamptz not null default now()+interval '30 minutes'
);
create unique index waka_one_active_customer_ride on public.waka_bookings(customer_id) where service='ride' and status in ('searching','assigned','arrived','in_progress');
create unique index waka_one_active_driver on public.waka_bookings(driver_id) where status in ('assigned','arrived','in_progress');
create index waka_booking_customer on public.waka_bookings(customer_id,created_at desc);
create index waka_booking_driver on public.waka_bookings(driver_id,created_at desc);
create index waka_open_jobs on public.waka_bookings(city,expires_at) where status='searching';
create table public.waka_booking_secrets (
 booking_id uuid primary key references public.waka_bookings(id), pickup_pin text not null,
 attempts integer not null default 0, locked_until timestamptz
);
create table public.waka_offers (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.waka_bookings(id), driver_id uuid not null references public.waka_profiles(id),
 amount integer not null check(amount between 10000 and 50000000), eta_minutes integer not null check(eta_minutes between 1 and 120),
 round integer not null default 1 check(round between 1 and 3), turn text not null default 'customer' check(turn in ('customer','driver')),
 status text not null default 'pending' check(status in ('pending','accepted','declined','superseded')), expires_at timestamptz not null default now()+interval '5 minutes',
 created_at timestamptz not null default now(), unique(booking_id,driver_id)
);
create table public.waka_events (id bigint generated always as identity primary key,booking_id uuid not null references public.waka_bookings(id), actor_id uuid not null references public.waka_profiles(id),kind text not null, detail jsonb not null default '{}',created_at timestamptz not null default now());
create table public.waka_support (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.waka_profiles(id),booking_id uuid references public.waka_bookings(id),message text not null check(length(message) between 10 and 3000),status text not null default 'open' check(status in ('open','resolved')),created_at timestamptz not null default now());
create table public.waka_saved_places (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.waka_profiles(id),label text not null,address text not null, unique(user_id,label));
create table public.waka_admin_audit (id bigint generated always as identity primary key,admin_id uuid not null references public.waka_profiles(id),target_id uuid not null,action text not null,note text not null,created_at timestamptz not null default now());

-- No client table grants. All access is through narrowly checked functions below.
alter table public.waka_profiles enable row level security;
alter table public.waka_drivers enable row level security;
alter table public.waka_bookings enable row level security;
alter table public.waka_booking_secrets enable row level security;
alter table public.waka_offers enable row level security;
alter table public.waka_events enable row level security;
alter table public.waka_support enable row level security;
alter table public.waka_saved_places enable row level security;
alter table public.waka_admin_audit enable row level security;
revoke all on public.waka_profiles,public.waka_drivers,public.waka_bookings,public.waka_booking_secrets,public.waka_offers,public.waka_events,public.waka_support,public.waka_saved_places,public.waka_admin_audit from public,anon,authenticated;
revoke all on sequence public.waka_events_id_seq,public.waka_admin_audit_id_seq from public,anon,authenticated;

create function public.waka_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare r text; n text;
begin
 r:=coalesce(new.raw_user_meta_data->>'role','customer');
 if r not in ('customer','driver','merchant') then r:='customer'; end if;
 n:=left(trim(coalesce(new.raw_user_meta_data->>'name','Waka member')),100);
 if length(n)<2 then n:='Waka member'; end if;
 insert into public.waka_profiles(id,role,name,phone,business_name) values(new.id,r,n,left(coalesce(new.raw_user_meta_data->>'phone',''),30),left(coalesce(new.raw_user_meta_data->>'business_name',''),120));
 if r='driver' then insert into public.waka_drivers(id) values(new.id); end if;
 return new;
end $$;
create trigger waka_auth_user_created after insert on auth.users for each row execute function public.waka_new_user();
revoke all on function public.waka_new_user() from public,anon,authenticated;

create function public.waka_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); p public.waka_profiles; result jsonb;
begin
 select * into p from public.waka_profiles where id=u;
 if u is null or p.id is null or p.disabled then raise exception 'Account unavailable'; end if;
 select jsonb_build_object(
 'profile',to_jsonb(p),
 'driver',(select to_jsonb(d) from public.waka_drivers d where d.id=u),
 'bookings',coalesce((select jsonb_agg(j order by j->>'created_at' desc) from (
  select to_jsonb(b)||jsonb_build_object(
   'pickup_pin',case when b.customer_id=u and b.status in ('assigned','arrived') then (select s.pickup_pin from public.waka_booking_secrets s where s.booking_id=b.id) else null end,
   'customer_name',(select name from public.waka_profiles where id=b.customer_id),
   'customer_phone',case when b.driver_id=u then (select phone from public.waka_profiles where id=b.customer_id) else null end,
   'driver_name',(select name from public.waka_profiles where id=b.driver_id),
   'driver_phone',case when b.customer_id=u then (select phone from public.waka_profiles where id=b.driver_id) else null end,
   'driver_vehicle',(select vehicle from public.waka_drivers where id=b.driver_id),
   'driver_plate',(select plate from public.waka_drivers where id=b.driver_id),
   'driver_location',(select jsonb_build_object('lat',latitude,'lng',longitude,'at',location_at) from public.waka_drivers where id=b.driver_id and b.status in ('assigned','arrived','in_progress') and location_at>now()-interval '2 minutes'),
   'offers',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('driver_name',dp.name,'vehicle',d.vehicle,'plate',d.plate,'color',d.color,'rating',(select round(avg(rating),2) from public.waka_bookings where driver_id=o.driver_id),'trips',(select count(*) from public.waka_bookings where driver_id=o.driver_id and status='completed'))) from public.waka_offers o join public.waka_profiles dp on dp.id=o.driver_id join public.waka_drivers d on d.id=o.driver_id where o.booking_id=b.id and (b.customer_id=u or o.driver_id=u)),'[]'::jsonb),
   'events',coalesce((select jsonb_agg(jsonb_build_object('kind',e.kind,'detail',e.detail,'at',e.created_at) order by e.id) from public.waka_events e where e.booking_id=b.id),'[]'::jsonb)
  ) j from public.waka_bookings b where b.customer_id=u or b.driver_id=u or exists(select 1 from public.waka_offers o where o.booking_id=b.id and o.driver_id=u)
  order by b.created_at desc limit 100
 ) records),'[]'::jsonb),
 'jobs',case when p.role='driver' and exists(select 1 from public.waka_drivers where id=u and status='approved' and online) then coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'service',b.service,'city',b.city,'pickup',b.pickup,'destination',b.destination,'initial_fare',b.initial_fare,'created_at',b.created_at,'expires_at',b.expires_at)) from (select * from public.waka_bookings where status='searching' and expires_at>now() and city=p.city and customer_id<>u order by created_at desc limit 50) b),'[]'::jsonb) else '[]'::jsonb end,
 'saved_places',coalesce((select jsonb_agg(to_jsonb(s)-'user_id') from public.waka_saved_places s where user_id=u),'[]'::jsonb),
 'tickets',coalesce((select jsonb_agg(to_jsonb(s)) from public.waka_support s where s.user_id=u),'[]'::jsonb),
 'applications',case when p.role='admin' then coalesce((select jsonb_agg(to_jsonb(d)||jsonb_build_object('name',a.name,'phone',a.phone,'city',a.city)) from public.waka_drivers d join public.waka_profiles a on a.id=d.id),'[]'::jsonb) else '[]'::jsonb end,
 'support_queue',case when p.role='admin' then coalesce((select jsonb_agg(to_jsonb(s)) from public.waka_support s where status='open'),'[]'::jsonb) else '[]'::jsonb end,
 'server_time',now()
 ) into result;
 -- Unassigned bidding drivers receive no recipient/contact information, PIN or private events.
 if p.role='driver' then
 result:=jsonb_set(result,'{bookings}',coalesce((select jsonb_agg(case when x->>'driver_id'=u::text then x else x-'recipient'-'recipient_phone'-'instructions'-'parcel'-'pickup_pin'-'events'-'customer_name'-'customer_phone'-'driver_phone'-'delivery_proof'-'driver_location' end) from jsonb_array_elements(result->'bookings') x),'[]'::jsonb));
 end if;
 return result;
end $$;
revoke all on function public.waka_snapshot() from public,anon;
grant execute on function public.waka_snapshot() to authenticated;

create function public.waka_command(action text, data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); p public.waka_profiles; b public.waka_bookings; o public.waka_offers; d public.waka_drivers;
 bid uuid; amount integer; et integer; txt text; s public.waka_booking_secrets;
begin
 select * into p from public.waka_profiles where id=u for update;
 if u is null or p.id is null or p.disabled then raise exception 'Account unavailable'; end if;
 if jsonb_typeof(data)<>'object' or octet_length(data::text)>12000 then raise exception 'Invalid request'; end if;
 if action='profile' then
  if length(trim(data->>'name')) not between 2 and 100 or coalesce(data->>'phone','') !~ '^\+?[0-9 ()-]{7,30}$' then raise exception 'Enter your name and a valid phone number'; end if;
  if data->>'city' not in ('Abuja','Lagos') then raise exception 'Choose a supported city'; end if;
  update public.waka_profiles set name=trim(data->>'name'),phone=data->>'phone',city=data->>'city',business_name=left(coalesce(data->>'business_name',''),120) where id=u;
 elsif action='application' then
  if p.role<>'driver' then raise exception 'Driver account required'; end if;
  if length(trim(coalesce(data->>'vehicle','')))<3 or length(trim(coalesce(data->>'plate','')))<4 or length(trim(coalesce(data->>'license_reference','')))<4 then raise exception 'Complete your vehicle and licence details'; end if;
  if exists(select 1 from public.waka_bookings where driver_id=u and status in ('assigned','arrived','in_progress')) then raise exception 'Finish your active trip first'; end if;
  if exists(select 1 from public.waka_drivers where id=u and status='suspended') then raise exception 'Contact support about your suspended account'; end if;
  update public.waka_drivers set vehicle=left(trim(data->>'vehicle'),100),plate=upper(left(trim(data->>'plate'),30)),color=left(coalesce(data->>'color',''),30),license_reference=left(data->>'license_reference',100),status='pending',online=false,reviewed_by=null,reviewed_at=null,review_note='' where id=u;
 elsif action='review_driver' then
  if p.role<>'admin' then raise exception 'Admin access required'; end if;
  if data->>'status' not in ('approved','rejected','suspended') or length(trim(coalesce(data->>'note','')))<10 then raise exception 'Add a review decision and verification notes'; end if;
  select * into d from public.waka_drivers where id=(data->>'driver_id')::uuid for update;
  if d.id is null or (d.status='incomplete' and data->>'status'='approved') then raise exception 'A completed application is required'; end if;
  update public.waka_drivers set status=data->>'status',online=false,review_note=left(data->>'note',1000),reviewed_by=u,reviewed_at=now() where id=d.id;
  insert into public.waka_admin_audit(admin_id,target_id,action,note) values(u,d.id,data->>'status',left(data->>'note',1000));
 elsif action='availability' then
  if p.role<>'driver' then raise exception 'Driver account required'; end if;
  update public.waka_drivers set online=(data->>'online')::boolean where id=u and status='approved';
  if not found then raise exception 'Your application must be approved first'; end if;
 elsif action='location' then
  if p.role<>'driver' or not exists(select 1 from public.waka_bookings where driver_id=u and status in ('assigned','arrived','in_progress')) then raise exception 'An assigned trip is required to share location'; end if;
  if (data->>'lat')::double precision not between -90 and 90 or (data->>'lng')::double precision not between -180 and 180 or data->>'lat' is null or data->>'lng' is null then raise exception 'Invalid location'; end if;
  update public.waka_drivers set latitude=(data->>'lat')::double precision,longitude=(data->>'lng')::double precision,location_at=now() where id=u;
 elsif action='save_place' then
  if length(trim(coalesce(data->>'label','')))<1 or length(trim(coalesce(data->>'address','')))<3 then raise exception 'Enter a label and address'; end if;
  if (select count(*) from public.waka_saved_places where user_id=u)>=20 then raise exception 'You can save up to 20 places'; end if;
  insert into public.waka_saved_places(user_id,label,address) values(u,left(trim(data->>'label'),40),left(trim(data->>'address'),240)) on conflict(user_id,label) do update set address=excluded.address;
 elsif action='delete_place' then
  delete from public.waka_saved_places where id=(data->>'id')::uuid and user_id=u;
 elsif action='support' then
  bid:=nullif(data->>'booking_id','')::uuid;
  if bid is not null and not exists(select 1 from public.waka_bookings where id=bid and (customer_id=u or driver_id=u)) then raise exception 'Booking not found'; end if;
  if (select count(*) from public.waka_support where user_id=u and created_at>now()-interval '1 hour')>=5 then raise exception 'Support request limit reached. Please wait before sending another'; end if;
  insert into public.waka_support(user_id,booking_id,message) values(u,bid,trim(data->>'message'));
 elsif action='resolve_ticket' then
  if p.role<>'admin' then raise exception 'Admin access required'; end if;
  update public.waka_support set status='resolved' where id=(data->>'id')::uuid;
  insert into public.waka_admin_audit(admin_id,target_id,action,note) values(u,(data->>'id')::uuid,'resolve_ticket','Resolved through operations dashboard');
 elsif action='create_booking' then
  if p.role not in ('customer','merchant') then raise exception 'Customer or business account required'; end if;
  if p.role='merchant' and data->>'service'<>'delivery' then raise exception 'Business accounts book deliveries'; end if;
  if length(p.phone)<7 then raise exception 'Add your contact phone in Profile before booking'; end if;
  if (select count(*) from public.waka_bookings where customer_id=u and status in ('searching','assigned','arrived','in_progress'))>=10 then raise exception 'You already have 10 active requests'; end if;
  if (select count(*) from public.waka_bookings where customer_id=u and created_at>now()-interval '1 hour')>=20 then raise exception 'Request limit reached. Please try again later'; end if;
  if data->>'service'='delivery' and (length(trim(coalesce(data->>'recipient','')))<2 or coalesce(data->>'recipient_phone','') !~ '^\+?[0-9 ()-]{7,30}$' or length(trim(coalesce(data->>'parcel','')))<3) then raise exception 'Add recipient, contact number and parcel details'; end if;
  if coalesce(data->>'pickup','')=coalesce(data->>'destination','') then raise exception 'Pickup and destination must differ'; end if;
  insert into public.waka_bookings(customer_id,service,city,pickup,destination,initial_fare,recipient,recipient_phone,parcel,instructions,pickup_lat,pickup_lng,destination_lat,destination_lng)
  values(u,data->>'service',p.city,trim(data->>'pickup'),trim(data->>'destination'),(data->>'fare')::integer,left(coalesce(data->>'recipient',''),100),left(coalesce(data->>'recipient_phone',''),30),left(coalesce(data->>'parcel',''),500),left(coalesce(data->>'instructions',''),1000),nullif(data->>'pickup_lat','')::double precision,nullif(data->>'pickup_lng','')::double precision,nullif(data->>'destination_lat','')::double precision,nullif(data->>'destination_lng','')::double precision) returning id into bid;
  insert into public.waka_booking_secrets(booking_id,pickup_pin) values(bid,lpad((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint % 10000)::text,4,'0'));
  insert into public.waka_events(booking_id,actor_id,kind) values(bid,u,'requested');
 else
  bid:=(data->>'booking_id')::uuid;
  select * into b from public.waka_bookings where id=bid for update;
  if b.id is null then raise exception 'Booking not found'; end if;
  if action='offer' then
   select * into d from public.waka_drivers where id=u;
   if p.role<>'driver' or d.status is distinct from 'approved' or not d.online or p.city<>b.city or b.customer_id=u then raise exception 'An approved, online driver in this city is required'; end if;
   if b.status<>'searching' or b.expires_at<=now() then raise exception 'This request is no longer open'; end if;
   if exists(select 1 from public.waka_bookings where driver_id=u and status in ('assigned','arrived','in_progress')) then raise exception 'Finish your active trip first'; end if;
   insert into public.waka_offers(booking_id,driver_id,amount,eta_minutes) values(bid,u,(data->>'amount')::integer,(data->>'eta')::integer);
  elsif action in ('counter','accept','decline') then
   select * into o from public.waka_offers where id=(data->>'offer_id')::uuid and booking_id=bid for update;
   if o.id is null or (u<>b.customer_id and u<>o.driver_id) then raise exception 'Offer not found'; end if;
   if b.status<>'searching' or b.expires_at<=now() or o.status<>'pending' or o.expires_at<=now() then raise exception 'This offer has expired or closed'; end if;
   if (o.turn='customer' and u<>b.customer_id) or (o.turn='driver' and u<>o.driver_id) then raise exception 'Wait for the other person to respond'; end if;
   if action='counter' then
    if o.round>=3 then raise exception 'Final negotiation round: accept or decline'; end if;
    update public.waka_offers set amount=(data->>'amount')::integer,round=round+1,turn=case when u=b.customer_id then 'driver' else 'customer' end,expires_at=now()+interval '5 minutes' where id=o.id;
   elsif action='decline' then update public.waka_offers set status='declined' where id=o.id;
   else
    select * into d from public.waka_drivers where id=o.driver_id for update;
    if d.status is distinct from 'approved' or not d.online or exists(select 1 from public.waka_profiles where id=o.driver_id and disabled) then raise exception 'Driver is no longer available'; end if;
    if exists(select 1 from public.waka_bookings where driver_id=o.driver_id and status in ('assigned','arrived','in_progress')) then raise exception 'Driver has accepted another trip'; end if;
    update public.waka_bookings set driver_id=o.driver_id,agreed_fare=o.amount,status='assigned',updated_at=now() where id=bid;
    update public.waka_offers set status=case when id=o.id then 'accepted' else 'superseded' end where booking_id=bid;
   end if;
  elsif action='cancel' then
   if u<>b.customer_id and u is distinct from b.driver_id then raise exception 'Booking not found'; end if;
   if b.status not in ('searching','assigned','arrived') then raise exception 'This trip can no longer be cancelled'; end if;
   if length(trim(coalesce(data->>'reason','')))<3 then raise exception 'Add a cancellation reason'; end if;
   update public.waka_bookings set status='cancelled',cancel_reason=left(data->>'reason',500),updated_at=now() where id=bid;
   update public.waka_offers set status='superseded' where booking_id=bid and status='pending';
  elsif action in ('arrive','start','complete','cash_received') then
   if u is distinct from b.driver_id then raise exception 'Only the assigned driver can perform this action'; end if;
   if action='arrive' then
    if b.status<>'assigned' then raise exception 'Trip is not awaiting arrival'; end if;
    update public.waka_bookings set status='arrived',updated_at=now() where id=bid;
   elsif action='start' then
    if b.status<>'arrived' then raise exception 'Confirm arrival first'; end if;
    select * into s from public.waka_booking_secrets where booking_id=bid for update;
    if s.locked_until>now() then return jsonb_build_object('error','Too many PIN attempts. Wait 15 minutes or contact support.'); end if;
    if coalesce(data->>'pin','')<>s.pickup_pin then
     update public.waka_booking_secrets set attempts=case when attempts>=4 then 0 else attempts+1 end,locked_until=case when attempts>=4 then now()+interval '15 minutes' else null end where booking_id=bid;
     return jsonb_build_object('error','Incorrect pickup PIN. Ask the customer when you meet.');
    end if;
    update public.waka_bookings set status='in_progress',updated_at=now() where id=bid;
   elsif action='complete' then
    if b.status<>'in_progress' then raise exception 'Trip is not in progress'; end if;
    if b.service='delivery' and length(trim(coalesce(data->>'proof','')))<10 then raise exception 'Record recipient name and delivery confirmation details'; end if;
    update public.waka_bookings set status='completed',completed_at=now(),updated_at=now(),delivery_proof=left(data->>'proof',1000) where id=bid;
   else
    if b.status<>'completed' or b.payment_status<>'unpaid' then raise exception 'Cash can only be confirmed once for a completed trip'; end if;
    update public.waka_bookings set payment_status='cash_received',updated_at=now() where id=bid;
   end if;
  elsif action='rate' then
   if u<>b.customer_id or b.status<>'completed' or b.rating is not null then raise exception 'Only the customer can rate a completed trip once'; end if;
   update public.waka_bookings set rating=(data->>'rating')::integer,updated_at=now() where id=bid;
  else raise exception 'Unknown action';
  end if;
  insert into public.waka_events(booking_id,actor_id,kind,detail) values(bid,u,action,case when action in ('offer','counter','accept') then jsonb_build_object('offer_id',data->>'offer_id','amount',coalesce(data->>'amount',o.amount::text)) else '{}'::jsonb end);
 end if;
 return public.waka_snapshot();
end $$;
revoke all on function public.waka_command(text,jsonb) from public,anon;
grant execute on function public.waka_command(text,jsonb) to authenticated;
commit;
