import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { emptyWorkspace, execute, type Command } from './domain';
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const user=await getChatGPTUser();if(!user)return response({error:'Sign in with ChatGPT to open your private demo workspace.'},401);if(!env.DB)return response({error:'Database unavailable. Please try again later.'},503);const row=await env.DB.prepare('SELECT payload, version FROM workspaces WHERE user_id = ?').bind(user.userId).first<{payload:string;version:number}>();return response({state:row?JSON.parse(row.payload):emptyWorkspace(user.fullName||'Kosi'),version:row?.version??0});}
export async function POST(req:Request){
 const user=await getChatGPTUser();if(!user)return response({error:'Sign in required.'},401);
 if(!env.DB)return response({error:'Database unavailable. Please try again later.'},503);
 try{
  if(req.headers.get('origin')!==new URL(req.url).origin)return response({error:'Invalid request origin.'},403);
  const length=Number(req.headers.get('content-length')||0);if(length>12000)return response({error:'Request too large.'},413);
  const raw=await req.text();if(raw.length>12000)return response({error:'Request too large.'},413);
  const {command,version}=JSON.parse(raw) as {command:Command;version:number};if(!Number.isSafeInteger(version)||version<0||!command)return response({error:'Invalid command.'},400);
  await env.DB.prepare('INSERT OR IGNORE INTO workspaces (user_id, payload, version) VALUES (?, ?, 0)').bind(user.userId,JSON.stringify(emptyWorkspace(user.fullName||'Kosi'))).run();
  const row=await env.DB.prepare('SELECT payload, version FROM workspaces WHERE user_id = ?').bind(user.userId).first<{payload:string;version:number}>();if(!row||row.version!==version)return response({error:'Your workspace changed in another tab. Refreshed; please try again.'},409);
  const next=execute(JSON.parse(row.payload),command);
  const updated=await env.DB.prepare('UPDATE workspaces SET payload = ?, version = version + 1 WHERE user_id = ? AND version = ?').bind(JSON.stringify(next),user.userId,version).run();
  if(!updated.meta.changes)return response({error:'Another action arrived first. Refreshed; please try again.'},409);
  return response({state:next,version:version+1});
 }catch(error){return response({error:error instanceof Error?error.message:'Unable to update your workspace.'},400);}
}
