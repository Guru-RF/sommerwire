const R=process.argv[2]; require(R+'/engine.js'); const fs=require('fs');
const ft=.3048, f=7.2, lam=299.792458/f, radial=33*ft, h=1.2192;
const W=(x1,y1,z1,x2,y2,z2,r,seg)=>({x1,y1,z1,x2,y2,z2,r,seg});
function run(objs,n=32,ff=f,eps=13,sig=.005){
  const wires=[W(0,0,h,0,0,h+33.5*ft,.0127,n)];
  for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]]) wires.push(W(0,0,h,x*radial,y*radial,h,.000512,n));
  wires.push(...objs);
  const m={wires,ground:{type:2,height:0,eps,sigma:sig},sources:[{pos:'w1b',phase:0,mag:1}],loads:[],material:0};
  const res=MM.solve(m,ff),p=MM.makePattern(res,m),s=res.sources[0];
  const g=(el)=>{const a=[];for(let az=0;az<360;az+=5)a.push(10*Math.log10(p.gain(el,az).tot));return a;};
  return {R:s.R,X:s.X,g8:g(8),g25:g(25)};
}
const sec=process.argv[3];
const vert=(d,L,n=32)=>W(radial+d,0,h,radial+d,0,h+L,.005,Math.max(3,Math.round(n*L/radial)));
const cmp=(c,o)=>{const dz=Math.hypot(o.R-c.R,o.X-c.X); const d8=o.g8.map((v,i)=>v-c.g8[i]); const d25=o.g25.map((v,i)=>v-c.g25[i]);
  return {dz,two:Math.max(Math.abs(d8[0]),Math.abs(d8[36])),all8:Math.max(...d8.map(Math.abs)),all25:Math.max(...d25.map(Math.abs)),fx:d8[0],bx:d8[36]};};
if(sec==='E'){ const c=run([]);
  console.log('E1 fine gap sweep, long vertical 0.48 lam, n=32: gap, |dZ|, d(+x), d(-x), max2bearing, max all az @8deg, max all az @25deg, PASS(study criterion)');
  for(let d=10;d<=130;d+=4){const r=cmp(c,run([vert(d,.48*lam)])); console.log(d,r.dz.toFixed(2),r.fx.toFixed(2),r.bx.toFixed(2),r.two.toFixed(2),r.all8.toFixed(2),r.all25.toFixed(2),(r.dz<=2&&r.two<=.5)?'pass':'FAIL');}
  console.log('E2 object length sweep at gap 40 m (the only "pass"): L/lam, |dZ|, max2, maxAll8');
  for(const k of [.40,.44,.46,.47,.48,.49,.50,.52,.56]){const r=cmp(c,run([vert(40,k*lam)])); console.log(k,r.dz.toFixed(2),r.two.toFixed(2),r.all8.toFixed(2));}
  console.log('E3 frequency sweep at gap 40 m, L fixed 19.99 m: f, |dZ|, max2, maxAll8');
  for(const ff of [7.0,7.1,7.2,7.3]){const cc=run([],32,ff); const r=cmp(cc,run([vert(40,.48*lam)],32,ff)); console.log(ff,r.dz.toFixed(2),r.two.toFixed(2),r.all8.toFixed(2));}
  console.log('E4 short rod & horizontal: all-azimuth check, gaps .5,2,5: kind gap |dZ| max2 maxAll8');
  for(const d of [.5,2,5]){ let r=cmp(c,run([vert(d,2)])); console.log('short',d,r.dz.toFixed(2),r.two.toFixed(2),r.all8.toFixed(2));
    const L=.48*lam,x=radial+d; r=cmp(c,run([W(x,-L/2,h,x,L/2,h,.005,64)])); console.log('horiz',d,r.dz.toFixed(2),r.two.toFixed(2),r.all8.toFixed(2));
    r=cmp(c,run([W(x,-L/2,h+8,x,L/2,h+8,.005,64)])); console.log('horiz at +8 m height',d,r.dz.toFixed(2),r.two.toFixed(2),r.all8.toFixed(2));
    r=cmp(c,run([W(d,d,h+.0,radial+d,d,h+.0,.005,32)])); console.log('parallel-to-radial wire offset',d,r.dz.toFixed(2),r.two.toFixed(2),r.all8.toFixed(2)); }
  console.log('E5 grounded-ish quarter-wave vertical (0.24 lam, base 1 cm above soil; cannot bond to soil in solver): gap |dZ| max2 maxAll8');
  for(const d of [5,20,40,80]){const r=cmp(c,run([W(radial+d,0,.01,radial+d,0,.01+.24*lam,.005,32)])); console.log(d,r.dz.toFixed(2),r.two.toFixed(2),r.all8.toFixed(2));}
}
if(sec==='F'){ const file=R+'/models/DX Commander 16 radials.maa'; const o=MM.parseMAA(fs.readFileSync(file,'utf8'));
  console.log('parsed keys',Object.keys(o).join(','),'ground',JSON.stringify(o.ground),'seg',JSON.stringify(o.seg),'material',o.material,'src',JSON.stringify(o.sources));
  for(const w of o.wires) for(const k of Object.keys(w)) w[k]=Number(w[k]);
  console.log('F1 as shipped (auto segmentation -1), soil as in file / 13,0.005');
  for(const ff of [7.1,7.15,14.175]){ for(const g of [o.ground,{type:2,height:0,eps:13,sigma:.005}]){ try{const r=MM.solve({...o,ground:g},ff); console.log(ff,JSON.stringify(g),r.sources[0].R.toFixed(2),r.sources[0].X.toFixed(2),'unk',r.N,r.mesh.warnings.join('|').slice(0,80));}catch(e){console.log('ERR',e.message.slice(0,100));} } }
  console.log('F2 uniform segs as dx.js, 16 radials, 13/0.005: f n R X unk');
  for(const ff of [7.1,14.175]) for(const n of [8,16,32,64,128]){ const wires=o.wires.map(w=>({...w,seg:Math.max(1,Math.round(n*Math.hypot(w.x2-w.x1,w.y2-w.y1,w.z2-w.z1)/5))}));
    try{const r=MM.solve({...o,wires,ground:{type:2,height:0,eps:13,sigma:.005}},ff); console.log(ff,n,r.sources[0].R.toFixed(2),r.sources[0].X.toFixed(2),r.N);}catch(e){console.log(ff,n,'ERR',e.message.slice(0,80));} }
  console.log('F3 frequency scan n=32 & 64 around 20 m: f R X');
  for(const n of [32,64]) for(const ff of [13.8,14.0,14.175,14.35,14.6]){ const wires=o.wires.map(w=>({...w,seg:Math.max(1,Math.round(n*Math.hypot(w.x2-w.x1,w.y2-w.y1,w.z2-w.z1)/5))}));
    const r=MM.solve({...o,wires,ground:{type:2,height:0,eps:13,sigma:.005}},ff); console.log(n,ff,r.sources[0].R.toFixed(2),r.sources[0].X.toFixed(2)); }
}
if(sec==='G'){ // touching radials -> PEC fallback behaviour; and h sweep for NEC4 case
  require(R+'/engine.js');
  function gp(hh,N,eps,sig,H,Lr,rv,rr,n){const wires=[W(0,0,hh,0,0,hh+H,rv,n)];for(let k=0;k<N;k++){const a=2*Math.PI*k/N;wires.push(W(0,0,hh,Lr*Math.cos(a),Lr*Math.sin(a),hh,rr,n));}
    const m={wires,ground:{type:2,height:0,eps,sigma:sig},sources:[{pos:'w1b',phase:0,mag:1}],loads:[],material:0};const res=MM.solve(m,f),p=MM.makePattern(res,m),s=res.sources[0];let pk=-99;for(let e=1;e<90;e++)pk=Math.max(pk,10*Math.log10(p.gain(e,0).tot));return `${s.R.toFixed(2)} ${s.X.toFixed(2)} pk ${pk.toFixed(2)} g8 ${(10*Math.log10(p.gain(8,0).tot)).toFixed(2)} ${res.mesh.warnings.length?'WARN':''}`;}
  console.log('G1 radials at z=0 (touching): N, result (soil 30/0.015)'); for(const N of [0,4,16]) for(const rr of [.000512,.001]) { try{console.log(N,rr,gp(0,N,30,.015,33.5*ft,33*ft,.0127,rr,32));}catch(e){console.log(N,rr,"ERR",e.message);} }
  console.log('G2 NEC4 Table 10 row1 (83.15+j0.03, -4.41 dBi) height sweep in Sommerwire'); for(const hh of [.001,.002,.003,.005,.007,.01,.02]) console.log(hh,gp(hh,4,14,.01,9.056-.005,10,.0010265,.0010265,64));
  console.log('G3 same, row 7 (49.91-j0.02, -0.70)'); for(const hh of [.002,.005,.01,.02]) console.log(hh,gp(hh,4,14,.01,10.306-.005,6.4,.0010265,.0010265,64));
}
