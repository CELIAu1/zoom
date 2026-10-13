import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
const LIFETIME=30*24*60*60;
const sign=(value:string,secret:string)=>createHmac('sha256',secret).update(value).digest('base64url');
export function issueSession(secret:string,now=Math.floor(Date.now()/1000)){
 const id=randomUUID(),body=`${id}.${now+LIFETIME}`;
 return {id,token:`${body}.${sign(body,secret)}`};
}
export function verifySession(token:string|undefined,secret:string,now=Math.floor(Date.now()/1000)):string|null{
 if(!token)return null;const parts=token.split('.');if(parts.length!==3||!/^[-a-f0-9]{36}$/.test(parts[0]))return null;
 const expires=Number(parts[1]);if(!Number.isSafeInteger(expires)||expires<=now||expires>now+LIFETIME)return null;
 const expected=Buffer.from(sign(`${parts[0]}.${parts[1]}`,secret));const actual=Buffer.from(parts[2]);if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;
 return parts[0];
}
export function readSession(req:Request,secret:string){const value=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('waka_demo_session='))?.slice('waka_demo_session='.length);return verifySession(value,secret);}
export function sessionCookie(token:string,secure:boolean){return `waka_demo_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${LIFETIME}${secure?'; Secure':''}`;}
