require('../engine.js');
const fs=require('node:fs');
const file='models/DX Commander 16 radials.maa';
const original=MM.parseMAA(fs.readFileSync(file,'utf8'));
for(const w of original.wires) for(const key of Object.keys(w)) w[key]=Number(w[key]);
console.log('case,f_MHz,n_radial,eps,sigma,R,X,notes');
for(const f of [7.1,14.175]) for(const n of [8,16,32]) for(const [eps,sigma] of [[13,.005],[30,.02]]) for(const count of [8,16]){
  const wires=original.wires.filter((_,i)=>i<19 || (i-19)%(16/count)===0).map(w=>({...w,seg:Math.max(1,Math.round(n*Math.hypot(w.x2-w.x1,w.y2-w.y1,w.z2-w.z1)/5))}));
  const m={...original,wires,ground:{type:2,height:0,eps,sigma}};
  const r=MM.solve(m,f);
  console.log([count,f,n,eps,sigma,r.sources[0].R,r.sources[0].X,JSON.stringify(r.mesh.warnings)].join(','));
}
