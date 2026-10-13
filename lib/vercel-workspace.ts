import {emptyWorkspace,execute,type Command,type Workspace} from './domain.ts';
import {issueSession,readSession,sessionCookie} from './vercel-session.ts';
const response=(body:unknown,status=200,extra:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...extra}});
function config(){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,secret=process.env.WAKA_SESSION_SECRET;
 if(!url&&!key&&!secret)return null;
 if(!url||!key||!secret||secret.length<32)throw Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and a WAKA_SESSION_SECRET of at least 32 characters.');
 const parsed=new URL(url);if(parsed.protocol!=='https:')throw Error('SUPABASE_URL must use HTTPS.');
 return {url:parsed.origin,key,secret};
}
type Config=NonNullable<ReturnType<typeof config>>;
type Row={owner_id:string;payload:Workspace;version:number};
async function database(c:Config,query:string,method='GET',body?:unknown,prefer?:string):Promise<Row[]>{
 const res=await fetch(`${c.url}/rest/v1/waka_demo_workspaces${query}`,{method,cache:'no-store',headers:{apikey:c.key,Authorization:`Bearer ${c.key}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!res.ok)throw Error('The workspace database is unavailable. Check Supabase settings and apply supabase/vercel-demo.sql.');
 const text=await res.text();return text?JSON.parse(text):[];
}
export async function GET(req:Request){
 try{
  const c=config();if(!c)return response({state:emptyWorkspace('Your profile'),version:0,storage:'unconfigured'});
  const existing=readSession(req,c.secret),session=existing?null:issueSession(c.secret),id=existing||session!.id;
  const rows=await database(c,`?owner_id=eq.${encodeURIComponent(id)}&select=owner_id,payload,version`);
  return response({state:rows[0]?.payload||emptyWorkspace('Your profile'),version:rows[0]?.version||0,storage:'supabase'},200,session?{'Set-Cookie':sessionCookie(session.token,new URL(req.url).protocol==='https:')}:{});
 }catch(error){return response({error:error instanceof Error?error.message:'Unable to load workspace.',storage:'supabase'},503);}
}
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return response({error:'Invalid request origin.'},403);
 let c:Config|null;try{c=config();}catch(error){return response({error:(error as Error).message},503);}
 if(!c)return response({error:'Server storage is not configured. Set the three Vercel environment variables, or explicitly choose browser-only demo mode.'},503);
 const id=readSession(req,c.secret);if(!id)return response({error:'Your demo session has expired. Refresh to open a new session.'},401);
 const length=Number(req.headers.get('content-length')||0);if(length>12000)return response({error:'Request too large.'},413);
 let command:Command,version:number;
 try{const raw=await req.text();if(raw.length>12000)return response({error:'Request too large.'},413);({command,version}=JSON.parse(raw));if(!command||!Number.isSafeInteger(version)||version<0)throw Error('Invalid command.');}catch{return response({error:'Invalid command.'},400);}
 try{
  await database(c,'?on_conflict=owner_id','POST',{owner_id:id,payload:emptyWorkspace('Your profile'),version:0},'resolution=ignore-duplicates,return=minimal');
  const rows=await database(c,`?owner_id=eq.${encodeURIComponent(id)}&select=owner_id,payload,version`);const row=rows[0];
  if(!row||row.version!==version)return response({error:'Your workspace changed in another tab. Refreshed; please try again.'},409);
  let next:Workspace;try{next=execute(row.payload,command);}catch(error){return response({error:(error as Error).message},400);}
  const updated=await database(c,`?owner_id=eq.${encodeURIComponent(id)}&version=eq.${version}`,'PATCH',{payload:next,version:version+1},'return=representation');
  if(updated.length!==1)return response({error:'Another action arrived first. Refreshed; please try again.'},409);
  return response({state:next,version:version+1,storage:'supabase'});
 }catch(error){return response({error:(error as Error).message},503);}
}
