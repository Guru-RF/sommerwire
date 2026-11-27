require(require('path').join(__dirname,'../../../engine.js')); const MM=globalThis.MM;
const {execFileSync}=require('child_process'), fs=require('fs'), path=require('path');
const NEC=process.env.NEC2C||path.join(__dirname,'../bin/nec2c'), DIR=require('./run-directory')(__filename);
// case: {name, f, wires:[{a:[x,y,z], b:[...], r, n (segments)}], feed:{wire, end:'c'|'b'}, ground:'free'|'pec'|'real', eps, sig}
function runNEC(cs, dens, tag) {
  const L=[`CM ${cs.name}`,'CE'];
  cs.wires.forEach((w,i)=>{ let n=Math.max(1,Math.round(w.n*dens)); if(cs.feed.wire===i&&cs.feed.end==='c'&&n%2===0) n++; w._nn=n;
    L.push(`GW ${i+1} ${n} ${w.a.join(' ')} ${w.b.join(' ')} ${w.r}`); });
  L.push(cs.ground==='free'?'GE 0':'GE 1');
  if(cs.ground==='pec') L.push('GN 1'); if(cs.ground==='real') L.push(`GN 2 0 0 0 ${cs.eps} ${cs.sig}`);
  const fw=cs.wires[cs.feed.wire], seg=cs.feed.end==='c'?(fw._nn+1)/2:1;
  L.push(`EX 0 ${cs.feed.wire+1} ${seg} 0 1 0`, `FR 0 1 0 0 ${cs.f} 0`, 'RP 0 91 1 1000 0 0 1 0', 'EN');
  const inp=path.join(DIR,tag+'.nec'), out=path.join(DIR,tag+'.out'); fs.writeFileSync(inp,L.join('\n')+'\n');
  const t=Date.now(); execFileSync(NEC,['-i'+tag+'.nec','-o'+tag+'.out'],{cwd:DIR}); const ms=Date.now()-t;
  const txt=fs.readFileSync(out,'utf8');
  const ia=txt.indexOf('ANTENNA INPUT PARAMETERS'); const lines=txt.slice(ia).split('\n'); let Z=null;
  for(const l of lines.slice(1,12)){ const v=l.trim().split(/\s+/).map(Number); if(v.length>=10&&Number.isFinite(v[6])&&v[0]===cs.feed.wire+1){ Z=[v[6],v[7]]; break; } }
  const ip=txt.indexOf('RADIATION PATTERNS'); let g=-999, el=null;
  if(ip>=0) txt.slice(ip).split('\n').forEach(l=>{ const v=l.trim().split(/\s+/).map(Number); if(v.length>=8&&Number.isFinite(v[0])&&Number.isFinite(v[4])&&v[0]>=0&&v[0]<=90&&v[1]===0){ if(v[4]>g){g=v[4]; el=90-v[0];} } });
  return {Z,g,el,ms,N:cs.wires.reduce((a,w)=>a+w._nn,0)};
}
function runWM(cs, dens, nf) {
  const wires=cs.wires.map((w,i)=>{ let n=Math.max(1,Math.round(w.n*dens)); if(cs.feed.wire===i&&cs.feed.end==='c'&&n%2) n++; return {x1:w.a[0],y1:w.a[1],z1:w.a[2],x2:w.b[0],y2:w.b[1],z2:w.b[2],r:w.r,seg:n}; });
  const ground=cs.ground==='free'?{type:0}:cs.ground==='pec'?{type:1}:{type:2,height:0,eps:cs.eps,sigma:cs.sig,nf};
  const m={wires,sources:[{pos:'w'+(cs.feed.wire+1)+cs.feed.end,phase:0,mag:1}],loads:[],tls:[],seg:{dm1:400,dm2:40,sc:2,ec:1},ground,material:0,z0:50};
  const t=Date.now(); const res=MM.solve(m,cs.f); const ms=Date.now()-t; const p=MM.makePattern(res,m);
  let g=-999, el=null; for(let e=0;e<=90;e+=1){ const v=10*Math.log10(p.gain(e,0).tot); if(v>g){g=v; el=e;} }
  return {Z:[res.sources[0].R,res.sources[0].X],g,el,ms,N:res.N};
}
const lam=c=>299.792458/c;
const dip=(h,f=14.05,n=40)=>({name:`20 m dipole at ${h} m`,f,wires:[{a:[0,-5.17,h],b:[0,5.17,h],r:0.001,n}],feed:{wire:0,end:'c'}});
const cases=[
  {...dip(10),ground:'free'},
  {...dip(3),ground:'pec'},
  ...[0.3,1,3,10].map(h=>({...dip(h),ground:'real',eps:13,sig:0.005})),
  {...dip(1),name:'20 m dipole at 1 m, poor ground',ground:'real',eps:5,sig:0.001},
  {name:'vertical dipole, bottom at 0.5 m',f:14.05,wires:[{a:[0,0,0.5],b:[0,0,10.84],r:0.001,n:40}],feed:{wire:0,end:'c'},ground:'real',eps:13,sig:0.005},
];
// quarter-wave vertical with 16 radials at height hr
const gp=(hr,f=7.1)=>{ const w=[{a:[0,0,hr],b:[0,0,hr+10.2],r:0.001,n:20}]; for(let k=0;k<16;k++){const a=2*Math.PI*k/16; w.push({a:[0,0,hr],b:[+(5*Math.cos(a)).toFixed(4),+(5*Math.sin(a)).toFixed(4),hr],r:0.001,n:10});}
  return {name:`λ/4 vertical, 16 × 5 m radials at ${hr} m`,f,wires:w,feed:{wire:0,end:'b'},ground:'real',eps:13,sig:0.005}; };
cases.push(gp(0.05),gp(0.3),gp(2));
const fz=z=>z?`${z[0].toFixed(1).padStart(6)} ${z[1]>=0?'+':'-'} j${Math.abs(z[1]).toFixed(1).padEnd(5)}`:'  n/a';
const rows=[];
for (const [i,cs] of cases.entries()) {
  console.log('\n'+cs.name+(cs.ground==='real'?` (εr ${cs.eps}, ${cs.sig*1000} mS/m)`:` (${cs.ground})`)+`, ${cs.f} MHz`);
  for (const dens of [1,2]) {
    const n=runNEC(cs,dens,`c${i}d${dens}`);
    const w=runWM(cs,dens,'sommerfeld'), wc=cs.ground==='real'?runWM(cs,dens,'complex'):null;
    console.log(`  seg x${dens}: nec2c ${fz(n.Z)} ${n.g.toFixed(2)} dBi@${n.el}° (${n.N} seg, ${n.ms} ms) | Sommerwire ${fz(w.Z)} ${w.g.toFixed(2)} dBi@${w.el}° (${w.N} unk, ${w.ms} ms)`+(wc?` | complex img ${fz(wc.Z)} ${wc.g.toFixed(2)} dBi`:''));
    rows.push({name:cs.name,ground:cs.ground,dens,nec:n,wm:w,wc});
  }
}
fs.writeFileSync(path.join(DIR,'results.json'),JSON.stringify(rows,null,1));
