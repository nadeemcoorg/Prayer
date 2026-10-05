// Run from the project folder:  node tests/smoke.test.cjs
// Runs the full app against a stub DOM + mocked network, then checks prayer logic.
const fs=require('fs'),vm=require('vm');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const i0=html.indexOf('<script>\n'), i1=html.lastIndexOf('</script>'); const src=html.slice(i0+9,i1); const errors=[];
function stub(name='stub'){const store={};const f=function(){};return new Proxy(f,{
 get(t,k){ if(k===Symbol.toPrimitive) return ()=> ''; if(k==='then') return undefined; if(k in store) return store[k];
   if(k==='dataset'){return store[k]={}} if(k==='style'){return store[k]={setProperty(){}}} if(k==='children'||k==='childNodes') return [];
   if(k==='querySelectorAll') return ()=>[]; if(k==='hidden'||k==='open'||k==='paused') return store[k]??(k==='paused'); if(k==='textContent'||k==='value'||k==='src'||k==='className') return store[k]??'';
   if(k==='length') return 0; return stub(name+'.'+String(k)); },
 set(t,k,v){store[k]=v;return true}, apply(){return stub(name+'()')}, construct(){return stub('new '+name)} });}
const mem={}; const posts=[]; const J=o=>({ok:true,status:200,json:async()=>o});
const ctx={console:{log(){},info(){},warn(){},error:(...a)=>errors.push(a.join(' '))},URLSearchParams,AbortController,setTimeout:(f,ms)=>{if(ms<=20) Promise.resolve().then(f); return 1},clearTimeout(){},setInterval:()=>1,clearInterval(){},
 Intl,Date,Math,JSON,Promise,Object,Array,String,Number,Set,Map,Error,TypeError,isFinite,parseInt,Blob:function(){},URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}},FileReader:function(){},
 localStorage:{getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v)},removeItem:k=>delete mem[k]},
 location:{protocol:'https:'},navigator:{onLine:true,userAgent:'Mozilla/5.0 (iPhone)',platform:'iPhone',maxTouchPoints:5},document:stub('document'),innerWidth:390,innerHeight:844,
 matchMedia:q=>({matches:/coarse/.test(q),addEventListener(){}}),addEventListener(){},Audio:function(){return stub('audio')},Image:function(){return stub('img')},
 fetch:async(u,o)=>{ if(u.includes('open-meteo')) return J({results:[{name:'London',latitude:51.5074,longitude:-0.1278,timezone:'Europe/London',country:'United Kingdom',country_code:'GB',admin1:'England'}]});
   if(u.includes('/v1/timings/')) return J({code:200,data:{timings:{Fajr:'05:11',Sunrise:'07:03',Dhuhr:'12:50',Asr:'15:56',Maghrib:'18:36',Isha:'20:21'},meta:{timezone:'Europe/London'}}});
   if(u.includes('manifest.json')) return J({images:[],sounds:[]}); if(u==='/'){posts.push(o); return {ok:true,status:200}}; throw new Error('unexpected '+u)}};
ctx.window=ctx; vm.createContext(ctx);
process.on('unhandledRejection',e=>errors.push('UNHANDLED '+(e&&e.stack||e)));
mem['pr.settings.v2']=JSON.stringify({configured:true,location:{mode:'city',city:'London',country:'United Kingdom'},display:{mode:'home'}});
try{ vm.runInContext(src+`;this.__T={tick,openSettings,saveSettings,showOverlay,hideOverlay,schedule,wallNow,currentTz,prayerState,makruhAt,hijriOf,checkAlerts,installState,diagnostics,logError,flushOutbox,postFeedback,get firedKeys(){return fired.keys},resetFired(){fired={day:'',keys:[]}},get settings(){return settings},applyVisual,onAdhan,onIqama,onReminder,refreshManifest,compareWithAladhan,sourceInfo};`,ctx);}catch(e){errors.push('SYNC '+e.stack)}
(async()=>{
 for(let i=0;i<5;i++) await new Promise(r=>setImmediate(r));
 const T=ctx.__T; let ok=0,bad=0; const eq=(a,b,m)=>{const p=JSON.stringify(a)===JSON.stringify(b);p?ok++:bad++;console.log((p?'PASS ':'FAIL ')+m+(p?'':`  got ${JSON.stringify(a)} exp ${JSON.stringify(b)}`))};
 eq(T.sourceInfo().kind,'local','London resolved on-device');
 for(const [n,f] of [['tick',()=>T.tick()],['openSettings',()=>T.openSettings('times')],['save',()=>T.saveSettings()],['overlay',()=>{const e=T.schedule('2026-10-02',T.settings).today.events[2];T.showOverlay('iqama',e,1000);T.tick();T.hideOverlay()}],
  ['alerts',async()=>{const e=T.schedule('2026-10-02',T.settings).today.events[2];await T.onAdhan(e,true);T.onIqama(e);T.onReminder(e)}],['refreshManifest',()=>T.refreshManifest()],['compare',()=>T.compareWithAladhan()]]){
   try{await f(); ok++}catch(e){bad++;console.log('FAIL run '+n+': '+e.stack.split('\n').slice(0,2).join(' | '))}}
 const sc=k=>T.schedule(k,T.settings); const at=(k,hhmm)=>{const [h,m]=hhmm.split(':').map(Number);const [y,mo,d]=k.split('-').map(Number);return Date.UTC(y,mo-1,d)+(h*60+m)*60000};
 const st=(k,t)=>{const s=T.prayerState(at(k,t),sc(k));return [s.current?s.current.key:null, s.next.key+(s.tomorrow?'(tmrw)':'')]};
 const mk=(k,t)=>{const m=T.makruhAt(at(k,t),sc(k));return m?m.card:null};
 // London 2026-10-02: Fajr 05:11, Sunrise 07:03, Dhuhr 12:50, Maghrib 18:36, Islamic midnight 00:49
 eq(st('2026-10-02','06:00'),['Fajr','Ishraq'],'06:00 → Fajr now, next = Ishraq');
 eq(st('2026-10-02','07:10'),[null,'Ishraq'],'07:10 after sunrise → nothing now, next = Ishraq');
 eq(mk('2026-10-02','07:10'),'Sunrise','07:10 → Makruh (Sunrise card)');
 eq(mk('2026-10-02','07:24'),null,'07:24 (Ishraq 07:23) → Makruh over');
 eq(st('2026-10-02','07:30'),[null,'Dhuhr'],'07:30 → next = Dhuhr');
 eq(st('2026-10-02','13:00'),['Dhuhr','Asr'],'13:00 → Dhuhr now');
 // Zawal (Hanafi default: on, 10 min, Fridays included). 2026-10-02 is a Friday; 2026-10-05 a Monday
 const zw=k=>{const z=sc(k).today.zawal;return z?new Date(z).toISOString().slice(11,16):null};
 const zmk=(k,off,s=T.settings)=>{const m=T.makruhAt(sc(k).today.zawal+off*60000,sc(k),s);return m?m.card:null};
 eq(zmk('2026-10-05',-5),'Dhuhr','Zawal−5 min → Makruh (Dhuhr card), weekday · zawal '+zw('2026-10-05'));
 eq([zmk('2026-10-05',-11),zmk('2026-10-05',0)],[null,null],'Zawal−11 min and at solar noon → no Makruh');
 eq(zmk('2026-10-02',-5),'Dhuhr',"Friday Zawal → Makruh (Hanafi: Friday included)");
 const shafii=JSON.parse(JSON.stringify(T.settings)); shafii.display.zawalSkipFriday=true;
 eq([zmk('2026-10-02',-5,shafii),zmk('2026-10-05',-5,shafii)],[null,'Dhuhr'],"'No Zawal on Fridays' option skips Friday only");
 const off=JSON.parse(JSON.stringify(T.settings)); off.display.zawal=false; eq(zmk('2026-10-05',-5,off),null,'Zawal warning can be turned off');
 eq(mk('2026-10-02','18:20'),'Asr','18:20 (Maghrib−16) → Makruh (Asr card)');
 eq(mk('2026-10-02','18:10'),null,'18:10 (Maghrib−26) → no Makruh');
 eq(mk('2026-10-02','18:36'),null,'18:36 Maghrib → Makruh over');
 eq(st('2026-10-03','00:30'),['Isha','Fajr'],'00:30 → Isha until Islamic midnight');
 eq(st('2026-10-03','01:00'),[null,'Fajr'],'01:00 → nothing now');
 const hj=T.hijriOf('2026-10-05'); eq([hj.d,hj.mn,hj.y],[24,4,1448],'Hijri 5 Oct 2026 = 24 Rabi al-Thani 1448');
 eq(T.installState(),'ios','iPhone on https → shows Add-to-Home-Screen help');
 T.resetFired(); const asr=sc('2026-10-02').today.events.find(e=>e.key==='Asr').adhan;
 for(let t=asr-60000;t<asr+5*60000;t+=1000) T.checkAlerts({ms:t,key:'2026-10-02'});
 eq(T.firedKeys.filter(k=>k==='Asr|adhan').length,1,'adhan fires once per prayer');
 // feedback
 T.logError('audio','NotAllowedError: play() failed'); T.logError('audio','NotAllowedError: play() failed');
 const dg=T.diagnostics(); eq(/App 2\.4\.0/.test(dg) && /London/.test(dg) && /\[audio\].*\(x2\)/.test(dg) && !/51\.5074/.test(dg),true,'diagnostics: version, city, de-duplicated errors, no exact GPS');
 mem['pr.outbox']=JSON.stringify([{type:'Problem',message:'Adhan did not play',email:''}]);
 await T.flushOutbox(); eq(posts.length,1,'saved (offline) feedback is sent when online');
 const b=new URLSearchParams(posts[0].body); eq([b.get('form-name'),b.get('type'),posts[0].headers['Content-Type']],['feedback','Problem','application/x-www-form-urlencoded'],'posted as Netlify form "feedback" (url-encoded)');
 eq(JSON.parse(mem['pr.outbox']).length,0,'outbox emptied');
 console.log(`\n${ok} passed, ${bad} failed`); console.log('errors:',errors.length?errors:'none');
})();
