require('../engine.js');
const f = 7.2, lambda = 299.792458 / f, radial = 33 * .3048;
console.log('case,height,eps,sigma,segments,gap_m,gap_lambda,R,X,g8phi0,g8phi180');
function run(kind,h,eps,sigma,n,gap=0) {
  function wire(x1,y1,z1,x2,y2,z2,r,seg) { return {x1,y1,z1,x2,y2,z2,r,seg}; }
  const wires=[wire(0,0,h,0,0,h+33.5*.3048,.0127,n)];
  for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]]) wires.push(wire(0,0,h,x*radial,y*radial,h,.000512,n));
  if(kind!=='control') for(const sign of kind==='pair'?[1,-1]:[1]){
    const x=sign*(radial+gap), length=kind==='short'?2:.48*lambda;
    wires.push(kind==='horizontal'?wire(x,-length/2,h,x,length/2,h,.005,2*n):wire(x,0,h,x,0,h+length,.005,Math.max(3,Math.round(n*length/radial))));
  }
  const m={wires,ground:{type:2,height:0,eps,sigma},sources:[{pos:'w1b',phase:0,mag:1}],loads:[],material:0};
  const res=MM.solve(m,f),p=MM.makePattern(res,m),s=res.sources[0];
  console.log([kind,h,eps,sigma,n,gap,gap/lambda,s.R,s.X,...[0,180].map(a=>10*Math.log10(p.gain(8,a).tot))].join(','));
}
for(const [e,s] of [[13,.005],[30,.02],[5,.001]]) for(const h of [.05,.1524,.3048,1.2192]) for(const n of [8,16,32]) run('control',h,e,s,n);
for(const kind of ['short','vertical','horizontal','pair']) for(const d of [.5,2,5,10,20,40,80]) for(const n of [16,32]) run(kind,1.2192,13,.005,n,d);
for(const h of [.05,.1524,.3048,1.2192]) run('control',h,30,.02,64);
for(const d of [0,20,40,80]) run(d?'vertical':'control',1.2192,13,.005,64,d);
// Zero gap deliberately shares the radial endpoint. This changes the topology.
run('vertical',1.2192,13,.005,32,0);
for(const h of [.1524,.3048,1.2192]) for(const n of [32,64]) run('control',h,30,.015,n);
