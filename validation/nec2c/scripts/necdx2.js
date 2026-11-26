require(require('path').join(__dirname,'../../../sommerwire/engine.js')); const MM=globalThis.MM;
const {execFileSync}=require('child_process'), fs=require('fs'), path=require('path');
const NEC=process.env.NEC2C||path.join(__dirname,'../bin/nec2c'), DIR=path.join(__dirname,'../decks');
const m=MM.parseMAA(fs.readFileSync(path.join(__dirname,'../../../models/DX Commander 16 radials.maa'),'utf8'));
const W=m.wires.map(w=>({a:[+w.x1,+w.y1,+w.z1],b:[+w.x2,+w.y2,+w.z2],r:+w.r}));
for (const G of ['free','pec','real']) for (const f of [7.1,14.175]) for (const sl of [0.1]) { const dens=(299.792458/f)/sl;
  const lam=299.792458/f; const ns=W.map(w=>Math.max(1,Math.round(Math.hypot(...w.a.map((v,i)=>v-w.b[i]))/sl)));
  const L=['CM DX','CE',...W.map((w,i)=>`GW ${i+1} ${ns[i]} ${w.a.join(' ')} ${w.b.join(' ')} ${w.r}`),...(G==='free'?['GE 0']:G==='pec'?['GE 1','GN 1']:['GE 1','GN 2 0 0 0 13 0.005']),'EX 0 19 1 0 1 0',`FR 0 1 0 0 ${f} 0`,'RP 0 90 1 1000 0 0 1 0','EN'];
  fs.writeFileSync(path.join(DIR,'dx.nec'),L.join('\n')+'\n'); execFileSync(NEC,['-idx.nec','-odx.out'],{cwd:DIR});
  const txt=fs.readFileSync(path.join(DIR,'dx.out'),'utf8'); const ia=txt.indexOf('ANTENNA INPUT PARAMETERS'); let Z;
  for(const l of txt.slice(ia).split('\n').slice(1,12)){const v=l.trim().split(/\s+/).map(Number); if(v.length>=10&&v[0]===19){Z=[v[6],v[7]];break;}}
  let g=-999; txt.slice(txt.indexOf('RADIATION PATTERNS')).split('\n').forEach(l=>{const v=l.trim().split(/\s+/).map(Number); if(v.length>=8&&Number.isFinite(v[4])&&v[1]===0&&v[0]>=0&&v[0]<=90) g=Math.max(g,v[4]);});
  const wm={...m,wires:W.map((w,i)=>({x1:w.a[0],y1:w.a[1],z1:w.a[2],x2:w.b[0],y2:w.b[1],z2:w.b[2],r:w.r,seg:ns[i]})),ground:G==='free'?{type:0}:G==='pec'?{type:1}:{type:2,height:0,eps:13,sigma:0.005,nf:'sommerfeld'}};
  const res=MM.solve(wm,f), p=MM.makePattern(res,wm); let gw=-999; for(let e=0;e<90;e++) gw=Math.max(gw,10*Math.log10(p.gain(e,0).tot));
  const s=res.sources[0];
  console.log(`${G} ${f} MHz, ${sl} m segments (${ns.reduce((a,b)=>a+b,0)}): nec2c ${Z[0].toFixed(1)} ${Z[1]>=0?'+':'-'} j${Math.abs(Z[1]).toFixed(1)}, ${g.toFixed(2)} dBi | Sommerwire ${s.R.toFixed(1)} ${s.X>=0?'+':'-'} j${Math.abs(s.X).toFixed(1)}, ${gw.toFixed(2)} dBi`);
}
