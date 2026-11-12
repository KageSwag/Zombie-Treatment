const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const MAP=["################################","#.........#..........#.........#","#.........#..........#.........#","#..............................#","#.........#..........#.........#","#.........#..........#.........#","#.........#..........#.........#","#.........#..........#.........#","####..####...#######...####..###","#..............................#","#..............................#","###...####..######..####...#####","#.........#..........#.........#","#.........#..........#.........#","#.........#..........#.........#","#..............................#","#.........#..........#.........#","#.........#..........#.........#","#.........#..........#.........#","################################"];
const T=50,DT=.05,LAB={x:800,y:500},rooms={};let uid=0;
const FILES={'/':'index.html','/index.html':'index.html','/manifest.json':'manifest.json'},MIME={'.html':'text/html; charset=utf-8','.json':'application/json'};
const srv=http.createServer((q,r)=>{const f=FILES[q.url.split('?')[0]];if(!f){r.writeHead(404);return r.end('404')}
 fs.readFile(path.join(__dirname,f),(e,d)=>{r.writeHead(e?500:200,{'Content-Type':MIME[path.extname(f)]});r.end(e?'error':d)})});
const rnd=(a,b)=>a+Math.random()*(b-a),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),cl=(v,a,b)=>Math.min(b,Math.max(a,v));
const wall=(x,y)=>(MAP[y/T|0]||'#')[x/T|0]!='.';
const room=()=>{let x,y;do{x=1+Math.random()*30|0;y=1+Math.random()*18|0}while(MAP[y][x]!='.'||[8,9,10,11].includes(y));return{x:x*T+25,y:y*T+25}};
const item=(r,k)=>r.items.push({id:r.n++,k,...room()});
function bfs(gx,gy){const d=new Int16Array(640).fill(-1),q=[gy*32+gx];d[q[0]]=0;
 for(let i=0;i<q.length;i++){const c=q[i],x=c%32,y=c/32|0;for(const[a,b]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+a,ny=y+b;if(nx>=0&&ny>=0&&nx<32&&ny<20&&MAP[ny][nx]=='.'&&d[ny*32+nx]<0){d[ny*32+nx]=d[c]+1;q.push(ny*32+nx)}}}return d}
function step(z,tx,ty,s){const zx=z.x/T|0,zy=z.y/T|0,gx=tx/T|0,gy=ty/T|0;let px=tx,py=ty;
 if(zx!=gx||zy!=gy){const d=bfs(gx,gy);let b=d[zy*32+zx];for(const[a,c]of[[1,0],[-1,0],[0,1],[0,-1]]){const v=d[(zy+c)*32+zx+a];if(v>=0&&v<b){b=v;px=(zx+a)*T+25;py=(zy+c)*T+25}}}
 const a=Math.atan2(py-z.y,px-z.x);z.x+=Math.cos(a)*s;z.y+=Math.sin(a)*s}
const reset=p=>Object.assign(p,{x:rnd(60,160),y:rnd(460,540),inv:[],drug:0,smp:0,smpT:0,kn:-1,stun:0,imm:0,lt:0,run:0,mv:0});
function start(r){const now=Date.now();r.st='play';r.t0=now;r.win=null;r.w=Math.random()*3|0;r.mut=now+rnd(60,90)*1000;r.rage=0;r.items=[];
 const q=room();r.z={x:q.x,y:q.y,wx:q.x,wy:q.y,wt:0};for(let i=0;i<18;i++)item(r,i%3);for(const p of Object.values(r.ps))reset(p)}
const send=(p,o)=>p.ws.readyState==1&&p.ws.send(JSON.stringify(o));
setInterval(()=>{const now=Date.now();for(const r of Object.values(rooms)){const ps=Object.values(r.ps);
 if(r.st=='play'){const z=r.z;let t=null,bd=1e9;
  for(const p of ps)if(p.stun<=0){const d=dist(p,z),rad=p.run?520:p.mv?130:100;if(d<rad&&d<bd){bd=d;t=p}}
  let tx,ty,sp=60;
  if(t){tx=t.x;ty=t.y;sp=now<r.rage?175:135}
  else{if(now>z.wt||dist(z,{x:z.wx,y:z.wy})<30){const q=room();z.wx=q.x;z.wy=q.y;z.wt=now+9000}tx=z.wx;ty=z.wy}
  step(z,tx,ty,sp*DT);
  if(now>r.mut){let n;do n=Math.random()*3|0;while(n==r.w);r.w=n;r.mut=now+rnd(60,90)*1000;for(const p of ps){p.kn=-1;p.smp=0;p.lt=0;send(p,{t:'e',k:'mut'})}}
  for(const p of ps){p.stun-=DT;p.imm-=DT;
   if(p.imm<=0&&dist(p,z)<32){p.stun=3;p.imm=5;p.inv=[];p.lt=0;if(p.drug)r.items.push({id:r.n++,k:9,x:p.x,y:p.y,w:p.drug});p.drug=0;send(p,{t:'e',k:'bite'});continue}
   if(p.stun>0)continue;
   for(const it of r.items.slice()){if(dist(p,it)>=30)continue;
    if(it.k==9){if(!p.drug){p.drug=it.w;r.items.splice(r.items.indexOf(it),1)}}
    else if(p.inv.length<3){p.inv.push(it.k);r.items.splice(r.items.indexOf(it),1);item(r,it.k);send(p,{t:'e',k:'item'})}}
   if(!p.smp&&dist(p,z)<110){p.smpT+=DT;if(p.smpT>=1){p.smp=1;p.smpT=0;send(p,{t:'e',k:'smp'})}}else p.smpT=0;
   const nl=dist(p,LAB)<70;
   if(nl&&p.smp&&p.kn<0){p.lt+=DT;if(p.lt>=2.5){p.kn=r.w;p.smp=0;p.lt=0;send(p,{t:'e',k:'ana'})}}
   else if(nl&&!p.drug&&p.kn>=0&&p.inv.filter(x=>x==p.kn).length>=2){p.lt+=DT;if(p.lt>=2.5){for(let c=0;c<2;c++)p.inv.splice(p.inv.indexOf(p.kn),1);p.drug=p.kn+1;p.lt=0;send(p,{t:'e',k:'brew'})}}
   else p.lt=0;
   if(p.drug&&dist(p,z)<55){
    if(p.drug-1==r.w){r.st='over';r.win=p.name;r.tm=Math.round((now-r.t0)/1000);r.over=now+7000;send(p,{t:'e',k:'cure',tm:r.tm});break}
    p.drug=0;r.rage=now+8000;send(p,{t:'e',k:'fail'})}}}
 else if(r.st=='over'&&now>r.over)start(r);
 const m=JSON.stringify({t:'s',st:r.st,code:r.code,z:[r.z.x|0,r.z.y|0],w:r.win,tm:r.tm,i:r.items.map(i=>[i.id,i.k,i.x|0,i.y|0]),
  p:ps.map(p=>({i:p.id,n:p.name,b:p.b,x:p.x|0,y:p.y|0,s:p.stun>0?1:0,l:+p.lt.toFixed(1),v:p.inv,d:p.drug,m:p.smp,k:p.kn}))});
 for(const p of ps)p.ws.readyState==1&&p.ws.send(m)}},50);
new WebSocketServer({server:srv}).on('connection',ws=>{let p,r;
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
  if(m.t=='j'&&!p){const code=String(m.c||'').toUpperCase().slice(0,4)||Math.random().toString(36).slice(2,6).toUpperCase();
   r=rooms[code]||(rooms[code]={code,ps:{},items:[],n:1,st:'lobby',z:{x:800,y:200,wx:800,wy:200,wt:0}});
   if(Object.keys(r.ps).length>=8)return ws.close();
   p=reset({id:++uid,ws,name:String(m.n||'بازیکن').slice(0,12),b:String(m.b||'').slice(0,14)});
   r.ps[p.id]=p;send(p,{t:'j',id:p.id,code,map:MAP})}
  else if(!p)return;
  else if(m.t=='m'&&r.st=='play'&&p.stun<=0){const x=cl(+m.x||0,0,1600),y=cl(+m.y||0,0,1000);
   if(!wall(x,y)){p.mv=dist(p,{x,y})>1?1:0;p.run=p.mv&&m.r?1:0;p.x=x;p.y=y}}
  else if(m.t=='s'&&r.st=='lobby')start(r)});
 ws.on('close',()=>{if(!p)return;delete r.ps[p.id];if(!Object.keys(r.ps).length)delete rooms[r.code]})});
srv.listen(process.env.PORT||3000);
