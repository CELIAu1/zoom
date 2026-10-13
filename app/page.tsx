'use client';
import {useEffect,useState,type FormEvent,type ReactNode} from 'react';
import {ArrowUpRight,ArrowRight,ArrowLeft,Check,ChevronRight,Car,Package,House,Clock,UserRound,MapPin,Navigation,ShieldCheck,Star,X,Phone,Share2,TriangleAlert,Plus,Briefcase,Wallet,LogOut,RefreshCw,LoaderCircle,CheckCheck,Route,Receipt,Settings2} from 'lucide-react';
import {drivers,locations,money,COMMISSION_BPS,type Workspace,type Booking,type Role,type Command,type Offer} from '../lib/domain';
import {useWaka} from '../components/waka/use-waka';
import {Badge,Demo,initials} from '../components/waka/shared';
import {CustomerScreen} from '../components/waka/customer';
import {PartnerScreen} from '../components/waka/partner';
import {HistoryScreen} from '../components/waka/history';
import {ProfileScreen} from '../components/waka/profile';
import {WakaDialogs} from '../components/waka/dialogs';
export default function App(){
 const controller=useWaka();
 const {state,role,setRole,tab,setTab,error,setError,notice,setDialog,setPartnerPersona,size,reload,booking,current,button}=controller;
 if(!state)return <div className="load-screen"><div className="wordmark"><span className="brand-mark">w</span> waka<span className="wordmark-dot">.</span></div>{error?<><h2>Your workspace couldn’t load</h2><p>{error}</p><a className="button primary" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in with ChatGPT</a><button className="button secondary" onClick={()=>void reload()}>Try again</button></>:<><LoaderCircle className="spin"/><p>Opening your private workspace…</p></>}</div>;
 const model={...controller,state};
 return <div className="app-shell">
 <header className="header"><a className="wordmark" href="#" onClick={e=>{e.preventDefault();setTab('home')}}><span className="brand-mark">w</span>waka<span className="wordmark-dot">.</span></a><div className="role-switch"><button className={role==='customer'?'selected':''} onClick={()=>{setRole('customer');setTab('home');setDialog(null)}}><UserRound size={15}/>Customer</button><button className={role==='partner'?'selected':''} onClick={()=>{setRole('partner');if(booking?.driverId)setPartnerPersona(booking.driverId);setTab('home');setDialog(null)}}><Car size={16}/>Partner</button></div><div className="header-right"><Demo/><button className="profile-avatar" aria-label="Open profile" onClick={()=>setTab('profile')}>{initials(state.profile.name)}</button></div></header>
 <div className="demo-banner"><ShieldCheck size={14}/><span>A private product demo. Bookings are saved; drivers, maps and payments are simulated.</span><button onClick={()=>setDialog({type:'about'})}>How it works <ArrowUpRight size={13}/></button></div>
 {error&&<div className="feedback error" role="alert"><TriangleAlert size={17}/>{error}<button aria-label="Dismiss error" onClick={()=>setError('')}><X size={16}/></button></div>}{notice&&<div className="toast" role="status"><CheckCheck size={18}/>{notice}</div>}
 <main>
 {tab==='home'&&role==='customer'&&<CustomerScreen model={model}/> }
 {tab==='home'&&role==='partner'&&<PartnerScreen model={model}/> }
 {tab==='history'&&<HistoryScreen model={model}/> }
 {tab==='profile'&&<ProfileScreen model={model}/> }
 </main><nav className="bottom-nav" aria-label={`${role} main navigation`}>{[{id:'home',icon:role==='customer'?House:Briefcase,label:role==='customer'?'Home':'My Work'},{id:'history',icon:Clock,label:'History'},{id:'profile',icon:UserRound,label:'Profile'}].map(n=><button key={n.id} className={tab===n.id?'selected':''} aria-current={tab===n.id?'page':undefined} onClick={()=>setTab(n.id)}><n.icon size={21}/><span>{n.label}</span>{tab===n.id&&<i/>}</button>)}</nav>
 <WakaDialogs model={model}/>
 </div>
}
