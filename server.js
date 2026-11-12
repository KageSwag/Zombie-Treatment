const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const W=1600,H=1000,ST={x:800,y:500},DT=.05,rooms={};let uid=0;
const FILES={'/':'index.html','/index.html':'index.html','/manifest.json':'manifest.json'};
const MIME={'.html':'text/html; charset=utf-8','.json':'application/json'};
const srv=http.createServer((q,r)=>{const f=FILES[q.url.split('?')[0]];if(!f){r.writeHead(404);return r.end('404')}
 fs.readFile(path.join(__dirname,f),(e,d)=>{r.writeHead(e?500:200,{'Content-Type':MIME[path.extname(f)]});r.end(e?'error':d)})});
const rnd=(a,b)=>a+Math.random()*(b-a),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),cl=(v,a,b)=>Math.min(b,Math.max(a,v));
const spot=()=>({x:rnd(80,W-80),y:rnd(80,H-80)});
const item=(r,k)=>r.items.push({id:r.n++,k,...spot()});
function start(r){r.st='play';r.t0=Date.now();r.win=null;r.items=[];r.z={...spot(),tx:0,ty:0,w:0};
 for(let i=0;i<18;i++)item(r,i%3);
 for(const p of Object.values(r.ps))Object.assign(p,{x:rnd(100,W-100),y:H-80,inv:[0,0,0],drug:0,stun:0,imm:0,craft:0})}
const send=(p,o)=>p.ws.readyState==1&&p.ws.send(JSON.stringify(o));
setInterval(()=>{for(const r of Object.values(rooms)){const ps=Object.values(r.ps);
 if(r.st=='play'){const z=r.z;let t=null,d=380;
  for(const p of ps)if(p.stun<=0){const k=dist(p,z);if(k<d){d=k;t=p}}
  let sp=60;if(t){z.tx=t.x;z.ty=t.y;sp=135}
  else if(Date.now()>z.w||Math.hypot(z.tx-z.x,z.ty-z.y)<20){z.tx=rnd(80,W-80);z.ty=rnd(80,H-80);z.w=Date.now()+4000}
  const a=Math.atan2(z.ty-z.y,z.tx-z.x);z.x+=Math.cos(a)*sp*DT;z.y+=Math.sin(a)*sp*DT;
  for(const p of ps){p.stun-=DT;p.imm-=DT;
   if(p.imm<=0&&dist(p,z)<32){p.stun=3;p.imm=5;p.inv=[0,0,0];p.drug=0;p.craft=0;send(p,{t:'e',k:'bite'});continue}
   if(p.stun>0)continue;
   for(const it of r.items.slice())if(!p.inv[it.k]&&dist(p,it)<32){p.inv[it.k]=1;r.items.splice(r.items.indexOf(it),1);item(r,it.k);send(p,{t:'e',k:'item'})}
   if(!p.drug&&p.inv.every(x=>x)&&dist(p,ST)<70){p.craft+=DT;if(p.craft>=2){p.drug=1;p.inv=[0,0,0];p.craft=0}}else p.craft=0;
   if(p.drug&&dist(p,z)<55){r.st='over';r.win=p.name;r.tm=Math.round((Date.now()-r.t0)/1000);r.over=Date.now()+7000;send(p,{t:'e',k:'cure',tm:r.tm});break}}}
 else if(r.st=='over'&&Date.now()>r.over)start(r);
 const m=JSON.stringify({t:'s',st:r.st,code:r.code,z:[r.z.x|0,r.z.y|0],w:r.win,tm:r.tm,
  i:r.items.map(i=>[i.id,i.k,i.x|0,i.y|0]),
  p:ps.map(p=>({i:p.id,n:p.name,b:p.b,x:p.x|0,y:p.y|0,v:p.inv,d:p.drug,s:p.stun>0?1:0,c:+p.craft.toFixed(1)}))});
 for(const p of ps)p.ws.readyState==1&&p.ws.send(m)}},50);
new WebSocketServer({server:srv}).on('connection',ws=>{let p,r;
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
  if(m.t=='j'&&!p){const code=String(m.c||'').toUpperCase().slice(0,4)||Math.random().toString(36).slice(2,6).toUpperCase();
   r=rooms[code]||(rooms[code]={code,ps:{},items:[],n:1,st:'lobby',z:{x:800,y:200,tx:0,ty:0,w:0}});
   if(Object.keys(r.ps).length>=8)return ws.close();
   p={id:++uid,ws,name:String(m.n||'بازیکن').slice(0,12),b:String(m.b||'').slice(0,14),x:rnd(100,W-100),y:H-80,inv:[0,0,0],drug:0,stun:0,imm:0,craft:0};
   r.ps[p.id]=p;send(p,{t:'j',id:p.id,code})}
  else if(!p)return;
  else if(m.t=='m'&&r.st=='play'&&p.stun<=0){p.x=cl(+m.x||0,0,W);p.y=cl(+m.y||0,0,H)}
  else if(m.t=='s'&&r.st=='lobby')start(r)});
 ws.on('close',()=>{if(!p)return;delete r.ps[p.id];if(!Object.keys(r.ps).length)delete rooms[r.code]})});
srv.listen(process.env.PORT||3000);
