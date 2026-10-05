# Builds preview_harness.html (app + mocked data + optional fake clock) for visual checks.
# Usage: python tests/preview_harness.py phone 2026-10-04T20:45:00Z   (scenarios: phone, tv, phone_times, laptop)
import base64, json, sys, os
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
name=sys.argv[1]; fake=sys.argv[2] if len(sys.argv)>2 else ''   # fake = ISO instant, e.g. 2026-10-05T20:50:00Z
app=open(os.path.join(ROOT,'index.html'),encoding='utf-8').read()
man=open(os.path.join(ROOT,'manifest.js'),encoding='utf-8').read()
app=app.replace('<script src="manifest.js"></script>','<script>'+man+'</script>')
PRE="""<script>(function(){
var FAKE='__FAKE__'; if(FAKE){var off=new Date(FAKE).getTime()-Date.now();var RD=Date;var D=function(a,b,c,d,e,f,g){if(!arguments.length)return new RD(RD.now()+off);return new (Function.prototype.bind.apply(RD,[null].concat([].slice.call(arguments))))()};D.now=function(){return RD.now()+off};D.UTC=RD.UTC;D.parse=RD.parse;D.prototype=RD.prototype;window.Date=D;}
HTMLDialogElement.prototype.showModal=function(){this.show();this.style.position='fixed';this.style.inset='0';this.style.margin='auto';this.style.zIndex=100;};
var mem=__MEM__;var ls={getItem:function(k){return k in mem?mem[k]:null},setItem:function(k,v){mem[k]=String(v)},removeItem:function(k){delete mem[k]}};
try{Object.defineProperty(window,'localStorage',{value:ls,configurable:true})}catch(e){}
window.fetch=function(u){var J=function(o){return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve(o)}})};
 if(u.indexOf('open-meteo')>=0)return J({results:[{name:'Tokyo',latitude:35.6895,longitude:139.6917,timezone:'Asia/Tokyo',country:'Japan',country_code:'JP',admin1:'Tokyo'}]});
 if(u.indexOf('/timings')>=0)return J({code:200,data:{timings:{},meta:{timezone:'Asia/Tokyo'}}});
 return Promise.reject(new Error('offline'))};
window.addEventListener('load',function(){setTimeout(function(){__AFTER__},700)});})();</script>"""
scen={'phone':(390,844,{"configured":True},''),'tv':(1920,1080,{"configured":True,"display":{"mode":"mosque","title":"Masjid Al-Noor"}},''),
 'phone_times':(390,844,{"configured":True},"openSettings('times')"),'laptop':(1366,800,{"configured":True},'')}
w,h,s,after=scen[name]
doc=app.replace('<head>','<head>'+PRE.replace('__FAKE__',fake).replace('__MEM__',json.dumps({'pr.settings.v2':json.dumps(s)})).replace('__AFTER__',after),1)
b=base64.b64encode(doc.encode()).decode()
page=f"""<!doctype html><html><head><meta charset=utf-8><style>html,body{{margin:0;background:#333;overflow:hidden}}#w{{transform-origin:0 0}}iframe{{border:0;display:block;width:{w}px;height:{h}px}}</style></head><body><div id=w><iframe id=f></iframe></div><script>
document.getElementById('f').srcdoc=new TextDecoder().decode(Uint8Array.from(atob('{b}'),function(c){{return c.charCodeAt(0)}}));
function fit(){{var k=Math.min(innerWidth/{w},innerHeight/{h});document.getElementById('w').style.transform='scale('+k+')'}}fit();addEventListener('resize',fit);</script></body></html>"""
open(os.path.join(ROOT,'tests','preview_harness.html'),'w',encoding='utf-8').write(page); print(name, fake)
