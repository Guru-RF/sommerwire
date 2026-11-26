const R=process.argv[2]; require(R+'/engine.js'); const fs=require('fs');
const ft=.3048, f=7.2, lam=299.792458/f;
const W=(x1,y1,z1,x2,y2,z2,r,seg)=>({x1,y1,z1,x2,y2,z2,r,seg});
function gp({h,N=4,Lr=33*ft,H=33.5*ft,rv=.0127,rr=.000512,n=32,nr=n,eps=30,sig=.015,extra=[],mat=0,nf}){
  const wires=[W(0,0,h,0,0,h+H,rv,n)];
  for(let k=0;k<N;k++){const a=2*Math.PI*k/N; wires.push(W(0,0,h,Lr*Math.cos(a),Lr*Math.sin(a),h,rr,nr));}
  wires.push(...extra);
  const g={type:2,height:0,eps,sigma:sig}; if(nf) g.nf=nf;
  const m={wires,ground:g,sources:[{pos:'w1b',phase:0,mag:1}],loads:[],material:mat};
  const t=Date.now(),res=MM.solve(m,f),p=MM.makePattern(res,m),s=res.sources[0];
  let pk=-99,pe=0; for(let e=1;e<90;e++){const v=10*Math.log10(p.gain(e,0).tot); if(v>pk){pk=v;pe=e;}}
  return {R:s.R,X:s.X,g8:10*Math.log10(p.gain(8,0).tot),g8b:10*Math.log10(p.gain(8,180).tot),pk,pe,N:res.N,ms:Date.now()-t,warn:res.mesh.warnings,p};
}
const z=o=>`${o.R.toFixed(2)} ${o.X>=0?'+':'-'} j${Math.abs(o.X).toFixed(2)}`;
const sec=process.argv[3];
if(sec==='A'){ console.log('A: Part3 elevated, mesh convergence (soil 30/0.015)');
  for(const hin of [6,12,48]) for(const n of [16,32,64,128,256]){ try{const o=gp({h:hin*.0254,n}); console.log(hin+' in',n,z(o),'g8',o.g8.toFixed(2),'unk',o.N,o.ms+'ms');}catch(e){console.log(hin,n,'ERR',e.message.slice(0,80));} }
  console.log('A2: radiator segs fixed 32, radial segs vary / and vice versa (48 in)');
  for(const [n,nr] of [[32,128],[128,32],[64,16],[16,64]]){const o=gp({h:48*.0254,n,nr}); console.log('n_vert',n,'n_rad',nr,z(o));}
  console.log('A3: radiator radius sensitivity 48 in n=64'); for(const rv of [.0127,.006,.001,.019]){const o=gp({h:48*.0254,n:64,rv}); console.log('rv',rv,z(o));}
  console.log('A4: radiator length sensitivity 48 in n=64'); for(const H of [33.5,33.0,34.0,34.5]){const o=gp({h:48*.0254,n:64,H:H*ft}); console.log('H ft',H,z(o));}
  console.log('A5: soil sensitivity 48in n=64'); for(const [e,s] of [[30,.015],[30,.02],[13,.005],[20,.01]]){const o=gp({h:48*.0254,n:64,eps:e,sig:s}); console.log(e,s,z(o),'g8',o.g8.toFixed(2));}
}
if(sec==='B'){ console.log('B: Part3 Table1 surface count series vs model at small heights (soil 30/0.015, 33.5ft vert, 33ft #18)');
  const meas={64:'39.7-j1.2 (+5.8dB)',32:'42.9+j2.1',16:'56.1+j6.2',8:'85.5+j8.0',4:'137+j14.9 (0dB)'};
  for(const h of [.005,.01,.02,.05,.1524]){ let ref=null; for(const N of [4,8,16,32,64]){ const n=N>=32?16:32; try{const o=gp({h,N,n:32,nr:n}); if(N===4) ref=o.g8; console.log('h',h,'N',N,z(o),'g8',o.g8.toFixed(2),'rel4',(o.g8-ref).toFixed(2),'pk',o.pk.toFixed(2),'| meas',meas[N],o.warn.length?('WARN '+o.warn[0].slice(0,60)):'');}catch(e){console.log(h,N,'ERR',e.message.slice(0,90));} } }
}
if(sec==='C'){ console.log('C: Severns Part2 Table9/10 NEC-4 model: #12, radials 5 mm above 0.01/14, 7.2 MHz');
  const T=[[9.056,10,83.15,.03,-4.41],[9.275,9.45,65.72,.01,-3.22],[9.535,8.84,54.59,0,-2.12],[9.757,8.23,49.83,-.01,-1.45],[9.955,7.62,48.23,-.02,-1.04],[10.136,7.01,48.48,.01,-.81],[10.306,6.4,49.91,-.02,-.70]];
  for(const h of [.005,.05]) for(const [L,M,Rn,Xn,Gn] of T){ for(const d of [.2,.1]){ const o=gp({h,H:L-.005+ (h-.005)*0,Lr:M,rv:.0010265,rr:.0010265,n:Math.round(L/d),nr:Math.round(M/d),eps:14,sig:.01}); console.log('h',h,'L',L,'M',M,'seg',d,'SW',z(o),'pk',o.pk.toFixed(2),'@'+o.pe,'| NEC4',Rn,Xn,Gn);} }
}
if(sec==='D'){ console.log('D: ground-contact switch. 4 radials at 48 in, soil 13/0.005, n=32');
  const base=gp({h:1.2192,eps:13,sig:.005}); console.log('isolated',z(base),'g8',base.g8.toFixed(2),'pk',base.pk.toFixed(2));
  for(const d of [50,200,1000]){ const o=gp({h:1.2192,eps:13,sig:.005,extra:[W(d,0,0,d,0,2,.005,8)]}); console.log('detached 2 m rod touching z=0 at',d,'m:',z(o),'g8',o.g8.toFixed(2),'pk',o.pk.toFixed(2),'|',o.warn.map(w=>w.slice(0,70)).join(' / ')); }
  for(const d of [50,200,1000]){ const o=gp({h:1.2192,eps:13,sig:.005,extra:[W(d,0,0.01,d,0,2.01,.005,8)]}); console.log('same rod 1 cm above ground at',d,'m:',z(o),'g8',o.g8.toFixed(2)); }
  const pm=gp({h:1.2192,eps:13,sig:.005,nf:'pec'}); console.log('nf=pec explicit:',z(pm),'g8',pm.g8.toFixed(2));
  const bur=gp({h:1.2192,eps:13,sig:.005,extra:[W(50,0,-0.3,52,0,-0.3,.005,8)]}); console.log('buried detached wire:',z(bur),bur.warn.map(w=>w.slice(0,50)).join(' / '));
  const bur2=gp({h:-0.1,eps:13,sig:.005}); console.log('whole radial fan at -0.1 m:',z(bur2),'g8',bur2.g8.toFixed(2),bur2.warn.map(w=>w.slice(0,40)).join(' / '));
}
