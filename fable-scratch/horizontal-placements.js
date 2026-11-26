const R=process.argv[2]; require(R+'/engine.js');
const ft=.3048, f=7.2, lam=299.792458/f, radial=33*ft, h=1.2192;
const W=(x1,y1,z1,x2,y2,z2,r,seg)=>({x1,y1,z1,x2,y2,z2,r,seg});
function run(objs,n=32){ const wires=[W(0,0,h,0,0,h+33.5*ft,.0127,n)];
  for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]]) wires.push(W(0,0,h,x*radial,y*radial,h,.000512,n)); wires.push(...objs);
  const m={wires,ground:{type:2,height:0,eps:13,sigma:.005},sources:[{pos:'w1b',phase:0,mag:1}],loads:[],material:0};
  const res=MM.solve(m,f),p=MM.makePattern(res,m),s=res.sources[0]; const g=[];for(let az=0;az<360;az+=5)g.push(10*Math.log10(p.gain(8,az).tot)); return {R:s.R,X:s.X,g};}
const c=run([]); const L=.48*lam;
const rep=(name,o)=>{const d=o.g.map((v,i)=>v-c.g[i]); console.log(name,'|dZ|',Math.hypot(o.R-c.R,o.X-c.X).toFixed(2),'max2',Math.max(Math.abs(d[0]),Math.abs(d[36])).toFixed(2),'maxAllAz8',Math.max(...d.map(Math.abs)).toFixed(2));};
for(const d of [.5,2,5,10,20]){ const x=radial+d;
  rep(`gap ${d} horiz along y CENTRED (study case)`,run([W(x,-L/2,h,x,L/2,h,.005,64)]));
  rep(`gap ${d} horiz along y, one end opposite tip`,run([W(x,0,h,x,L,h,.005,64)]));
  rep(`gap ${d} horiz along x, collinear beyond tip`,run([W(x,0,h,x+L,0,h,.005,64)]));
  rep(`gap ${d} horiz along x, parallel beside radial (y offset)`,run([W(0.5,d,h,0.5+L,d,h,.005,64)]));
  rep(`gap ${d} sloping 45deg in xz from tip side`,run([W(x,0,h,x+L*Math.SQRT1_2,0,h+L*Math.SQRT1_2,.005,64)]));
}
