require(require('path').join(__dirname,'../../../engine.js')); const MM=globalThis.MM;
const {execFileSync}=require('child_process'), fs=require('fs'), path=require('path');
const NEC=process.env.NEC2C||path.join(__dirname,'../bin/nec2c'), DIR=require('./run-directory')(__filename);
const m=MM.parseMAA(fs.readFileSync(path.join(__dirname,'../../../models/DX Commander 16 radials.maa'),'utf8'));
const DX=m.wires.map(w=>({a:[+w.x1,+w.y1,+w.z1],b:[+w.x2,+w.y2,+w.z2],r:+w.r}));
const GP=[{a:[0,0,0.05],b:[0,0,10.25],r:0.001}]; for(let k=0;k<16;k++){const a=2*Math.PI*k/16; GP.push({a:[0,0,0.05],b:[+(5*Math.cos(a)).toFixed(4),+(5*Math.sin(a)).toFixed(4),0.05],r:0.001});}
function both(W,feedWire,f,sl){
  const ns=W.map(w=>Math.max(1,Math.round(Math.hypot(...w.a.map((v,i)=>v-w.b[i]))/sl)));
  const L=['CM b','CE',...W.map((w,i)=>`GW ${i+1} ${ns[i]} ${w.a.join(' ')} ${w.b.join(' ')} ${w.r}`),'GE 1','GN 1','EX 0 '+feedWire+' 1 0 1 0',`FR 0 1 0 0 ${f} 0`,'RP 0 46 73 1000 0 0 2 5','EN'];
  const tag=`${W===GP?'gp':'dx'}-pec-${f}-${sl}`;
  fs.writeFileSync(path.join(DIR,tag+'.nec'),L.join('\n')+'\n'); execFileSync(NEC,['-i'+tag+'.nec','-o'+tag+'.out'],{cwd:DIR});
  const txt=fs.readFileSync(path.join(DIR,tag+'.out'),'utf8'); const ia=txt.indexOf('ANTENNA INPUT PARAMETERS'); let Z;
  for(const l of txt.slice(ia).split('\n').slice(1,12)){const v=l.trim().split(/\s+/).map(Number); if(v.length>=10&&v[0]===feedWire){Z=[v[6],v[7]];break;}}
  // integrate NEC pattern: theta 0..90 step 2, phi 0..360 step 5 (trapezoid in theta)
  let sN=0; txt.slice(txt.indexOf('RADIATION PATTERNS')).split('\n').forEach(l=>{const v=l.trim().split(/\s+/).map(Number); if(v.length>=8&&Number.isFinite(v[4])&&v[0]>=0&&v[0]<=90&&v[1]>=0&&v[1]<360){ const th=v[0]*Math.PI/180; const w=(v[0]===0||v[0]===90)?0.5:1; sN+=w*Math.pow(10,v[4]/10)*Math.sin(th)*(2*Math.PI/180)*(5*Math.PI/180);} });
  const avg=txt.match(/AVERAGE POWER GAIN\s*=\s*([0-9.E+-]+)/);
  const wm={wires:W.map((w,i)=>({x1:w.a[0],y1:w.a[1],z1:w.a[2],x2:w.b[0],y2:w.b[1],z2:w.b[2],r:w.r,seg:ns[i]})),sources:[{pos:'w'+feedWire+'b',phase:0,mag:1}],loads:[],tls:[],seg:{dm1:400,dm2:40,sc:2,ec:1},ground:{type:1},material:0,z0:50};
  const res=MM.solve(wm,f), p=MM.makePattern(res,wm); let sW=0;
  for(let theta=0;theta<=90;theta+=2) {
    const weight=(theta===0||theta===90)?0.5:1;
    for(let az=0;az<360;az+=5) sW+=weight*p.gain(90-theta,az).tot*Math.sin(theta*Math.PI/180)*(2*Math.PI/180)*(5*Math.PI/180);
  }
  return `nec2c Z ${Z[0].toFixed(1)}${Z[1]>=0?'+':''}${Z[1].toFixed(1)}j  ∫G/4π ${(sN/(4*Math.PI)).toFixed(3)}${avg?' (NEC avg gain '+avg[1]+')':''} | Sommerwire Z ${res.sources[0].R.toFixed(1)}${res.sources[0].X>=0?'+':''}${res.sources[0].X.toFixed(1)}j  ∫G/4π ${(sW/(4*Math.PI)).toFixed(3)}`;
}
for (const f of [7.1,14.175]) {
  console.log(`${f} MHz simple ground plane (radials at 5 cm):  ${both(GP,1,f,0.25)}`);
  console.log(`${f} MHz DX Commander (0.1 m segments):        ${both(DX,19,f,0.1)}`);
}
