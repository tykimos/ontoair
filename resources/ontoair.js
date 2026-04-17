/* OntoAir core renderer - expects globals: RAW, FMT, FNAME, THREE */

function localName(u){if(!u)return'';const h=u.lastIndexOf('#'),s=u.lastIndexOf('/');return u.substring(Math.max(h,s)+1);}

function parseXML(xml){
  const p=new DOMParser(),doc=p.parseFromString(xml,'application/xml');
  const R={cls:[],op:[],dp:[],ap:[],ind:[],sub:[],dom:[],rng:[],typ:[],rel:[],dpv:[]};
  const ns={owl:'http://www.w3.org/2002/07/owl#',rdf:'http://www.w3.org/1999/02/22-rdf-syntax-ns#'};
  function ga(e){return e.getAttributeNS(ns.rdf,'about')||e.getAttributeNS(ns.rdf,'ID')||e.getAttribute('rdf:about')||e.getAttribute('rdf:ID')||'';}
  function gr(e){return e.getAttributeNS(ns.rdf,'resource')||e.getAttribute('rdf:resource')||'';}
  const S=new Set(),allAssert=[];
  doc.querySelectorAll('*').forEach(el=>{
    const t=el.localName,ns2=el.namespaceURI,a=ga(el),n=localName(a);
    if((t==='Class'&&(ns2===ns.owl||!ns2))||el.tagName==='owl:Class'){
      if(a&&!S.has('c:'+n)){S.add('c:'+n);R.cls.push({id:n,uri:a});}
      for(const c of el.children){if(c.localName==='subClassOf'||c.tagName==='rdfs:subClassOf'){const p2=gr(c);if(p2)R.sub.push([n,localName(p2)]);}}}
    if((t==='ObjectProperty'&&(ns2===ns.owl||!ns2))||el.tagName==='owl:ObjectProperty'){
      if(a&&!S.has('op:'+n)){S.add('op:'+n);R.op.push({id:n,uri:a});}
      for(const c of el.children){if(c.localName==='domain'||c.tagName==='rdfs:domain'){const r=gr(c);if(r)R.dom.push({p:n,c:localName(r)});}
        if(c.localName==='range'||c.tagName==='rdfs:range'){const r=gr(c);if(r)R.rng.push({p:n,c:localName(r)});}}}
    if((t==='DatatypeProperty'&&(ns2===ns.owl||!ns2))||el.tagName==='owl:DatatypeProperty'){
      if(a&&!S.has('dp:'+n)){S.add('dp:'+n);R.dp.push({id:n,uri:a});}
      for(const c of el.children){if(c.localName==='domain'||c.tagName==='rdfs:domain'){const r=gr(c);if(r)R.dom.push({p:n,c:localName(r)});}
        if(c.localName==='range'||c.tagName==='rdfs:range'){const r=gr(c);if(r)R.rng.push({p:n,c:localName(r)});}}}
    if((t==='AnnotationProperty'&&(ns2===ns.owl||!ns2))||el.tagName==='owl:AnnotationProperty'){if(a&&!S.has('ap:'+n)){S.add('ap:'+n);R.ap.push({id:n,uri:a});}}
    if((t==='NamedIndividual'&&(ns2===ns.owl||!ns2))||el.tagName==='owl:NamedIndividual'){
      if(a&&!S.has('i:'+n)){S.add('i:'+n);let cl='';
        for(const c of el.children){if(c.localName==='type'||c.tagName==='rdf:type'){const r=gr(c);if(r&&!r.includes('NamedIndividual'))cl=localName(r);}
          else{const pr=c.localName||c.tagName;const rv=gr(c);if(rv)allAssert.push([n,localName(pr),localName(rv)]);}}
        R.ind.push({id:n,uri:a,cls:cl});if(cl)R.typ.push([n,cl]);}}
    if(t==='Description'||el.tagName==='rdf:Description'){if(a){for(const c of el.children){
      if(c.localName==='type'||c.tagName==='rdf:type'){const r=gr(c);if(r){const tn=localName(r);
        if(tn==='Class'&&!S.has('c:'+n)){S.add('c:'+n);R.cls.push({id:n,uri:a});}
        else if(tn==='ObjectProperty'&&!S.has('op:'+n)){S.add('op:'+n);R.op.push({id:n,uri:a});}
        else if(tn==='DatatypeProperty'&&!S.has('dp:'+n)){S.add('dp:'+n);R.dp.push({id:n,uri:a});}
        else if(!['Ontology','Restriction','NamedIndividual'].includes(tn)&&!S.has('i:'+n)){S.add('i:'+n);R.ind.push({id:n,uri:a,cls:tn});R.typ.push([n,tn]);}}}
      else if(c.localName==='subClassOf'||c.tagName==='rdfs:subClassOf'){const r=gr(c);if(r)R.sub.push([n,localName(r)]);}
      else if(c.localName==='domain'||c.tagName==='rdfs:domain'){const r=gr(c);if(r)R.dom.push({p:n,c:localName(r)});}
      else if(c.localName==='range'||c.tagName==='rdfs:range'){const r=gr(c);if(r)R.rng.push({p:n,c:localName(r)});}
      else{const pr=c.localName||c.tagName;const rv=gr(c);if(rv)allAssert.push([n,localName(pr),localName(rv)]);}}}}
  });
  const indIds=new Set(R.ind.map(i=>i.id)),opIds=new Set(R.op.map(o=>o.id));
  allAssert.forEach(([s,p,o])=>{if(indIds.has(s)&&opIds.has(p)&&indIds.has(o))R.rel.push({s,p,o});});
  return R;}

function parseTTL(ttl){
  const R={cls:[],op:[],dp:[],ap:[],ind:[],sub:[],dom:[],rng:[],typ:[],rel:[],dpv:[]};
  const pfx={},S=new Set(),allAssert=[];
  const ls=ttl.split('\n').map(l=>{let o='',inURI=false;for(let i=0;i<l.length;i++){if(l[i]==='<')inURI=true;if(l[i]==='>')inURI=false;if(l[i]==='#'&&!inURI)return o.trim();o+=l[i];}return o.trim();}).filter(l=>l);
  const ct=ls.join(' ');let pm,re=/@prefix\s+(\w*):?\s*<([^>]+)>\s*\./g;
  while((pm=re.exec(ct)))pfx[pm[1]]=pm[2];
  const re2=/PREFIX\s+(\w*):?\s*<([^>]+)>/gi;while((pm=re2.exec(ct)))pfx[pm[1]]=pm[2];
  function eu(c){if(!c)return'';if(c[0]==='<'&&c[c.length-1]==='>')return c.slice(1,-1);const i=c.indexOf(':');if(i>=0){const p=c.substring(0,i),l=c.substring(i+1);if(pfx[p]!==undefined)return pfx[p]+l;}return c;}
  function rn(c){return localName(eu(c));}
  let bd=ct.replace(/@prefix\s+\w*:?\s*<[^>]+>\s*\./g,'').replace(/PREFIX\s+\w*:?\s*<[^>]+>/gi,'').replace(/@base\s*<[^>]+>\s*\./g,'').trim();
  const sts=[];let dp=0,qc=null,st='';
  for(let i=0;i<bd.length;i++){const c=bd[i];if(qc){st+=c;if(c===qc&&bd[i-1]!=='\\')qc=null;continue;}if(c==='"'||c==="'"){qc=c;st+=c;continue;}if(c==='['||c==='('){dp++;st+=c;continue;}if(c===']'||c===')'){dp--;st+=c;continue;}if(c==='.'&&dp===0){if(st.trim())sts.push(st.trim());st='';continue;}st+=c;}
  if(st.trim())sts.push(st.trim());
  sts.forEach(s=>{const pts=s.split(/\s*;\s*/);if(!pts.length)return;const ft=pts[0].match(/\S+/g);if(!ft||ft.length<2)return;const subj=ft[0];
    function proc(tk){if(tk.length<2)return;const pred=tk[0];
      tk.slice(1).join(' ').split(/\s*,\s*/).forEach(obj=>{obj=obj.trim();if(!obj)return;
        const s2=rn(subj),p=eu(pred),o=rn(obj),pL=localName(p);
        if(pred==='a'||p.endsWith('#type')){const tn=localName(eu(obj));
          if(tn==='Class'){if(!S.has('c:'+s2)){S.add('c:'+s2);R.cls.push({id:s2,uri:eu(subj)});}}
          else if(tn==='ObjectProperty'){if(!S.has('op:'+s2)){S.add('op:'+s2);R.op.push({id:s2,uri:eu(subj)});}}
          else if(tn==='DatatypeProperty'){if(!S.has('dp:'+s2)){S.add('dp:'+s2);R.dp.push({id:s2,uri:eu(subj)});}}
          else if(tn==='AnnotationProperty'){if(!S.has('ap:'+s2)){S.add('ap:'+s2);R.ap.push({id:s2,uri:eu(subj)});}}
          else if(!['Ontology','Restriction','NamedIndividual'].includes(tn)){if(!S.has('i:'+s2)){S.add('i:'+s2);R.ind.push({id:s2,uri:eu(subj),cls:tn});}R.typ.push([s2,tn]);}}
        else if(pL==='subClassOf'){R.sub.push([s2,o]);}
        else if(pL==='domain'){R.dom.push({p:s2,c:o});}
        else if(pL==='range'){R.rng.push({p:s2,c:o});}
        else{allAssert.push([s2,pL,obj,o]);}});}
    proc(ft.slice(1));for(let i=1;i<pts.length;i++){const t=pts[i].match(/\S+/g);if(t)proc(t);}});
  const indIds=new Set(R.ind.map(i=>i.id)),opIds=new Set(R.op.map(o=>o.id)),dpIds=new Set(R.dp.map(d=>d.id));
  allAssert.forEach(([s,p,objRaw,o])=>{
    const isLit=objRaw.startsWith('"')||objRaw.startsWith("'")||/^[+-]?\d/.test(objRaw);
    if(indIds.has(s)&&opIds.has(p)&&indIds.has(o)&&!isLit)R.rel.push({s,p,o});
    else if(indIds.has(s)&&dpIds.has(p)&&isLit){let v=objRaw;const m=v.match(/^"([^"\\]*(?:\\.[^"\\]*)*)"/);if(m)v=m[1];else if(v.startsWith("'")&&v.endsWith("'"))v=v.slice(1,-1);R.dpv.push({s,p,v});}
  });
  return R;}

const O=FMT==='ttl'?parseTTL(RAW):parseXML(RAW);

const canvas=document.createElement('canvas');document.body.appendChild(canvas);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xffffff);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,0.1,800);camera.position.set(0,20,55);
const ctrl=new THREE.OrbitControls(camera,canvas);ctrl.enableDamping=true;ctrl.dampingFactor=0.05;
scene.add(new THREE.AmbientLight(0xffffff,1));
const dl=new THREE.DirectionalLight(0xffffff,0.3);dl.position.set(10,20,10);scene.add(dl);
const floorGrid=new THREE.GridHelper(100,40,0xd0d0d0,0xe8e8e8);
floorGrid.material.transparent=true;floorGrid.material.opacity=0.55;floorGrid.position.y=-20;scene.add(floorGrid);
function updateFloor(){let min=0;Object.values(nodeMap).forEach(p=>{if(p.y!==undefined&&p.y<min)min=p.y;});floorGrid.position.y=min-4;}

function circGeo(r){return new THREE.CircleGeometry(r,32);}
function circleOutlinePts(r,seg){seg=seg||64;const pts=[];for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,0.001));}return pts;}
function outlineLine(pts,dashed,color){const geo=new THREE.BufferGeometry().setFromPoints(pts);
  const mat=dashed?new THREE.LineDashedMaterial({color,dashSize:0.3,gapSize:0.2,linewidth:2}):new THREE.LineBasicMaterial({color,linewidth:2});
  const line=new THREE.Line(geo,mat);if(dashed)line.computeLineDistances();return line;}

const CLS_R=1.6,IND_R=1.4;
const GEO={Class:circGeo(CLS_R),Individual:circGeo(IND_R)};
const nodeMap={},nodeMeshes=[],edgeObjs=[],arrowObjs=[],allLabels=[];
let textScale=1.0;const REF_DIST=55;

function hierLayout(){
  const depth={};
  function getDepth(id,visited){if(depth[id]!==undefined)return depth[id];if(visited.has(id))return 0;visited.add(id);
    const parents=O.sub.filter(s=>s[0]===id).map(s=>s[1]);let d=0;parents.forEach(p=>{d=Math.max(d,getDepth(p,new Set(visited))+1);});depth[id]=d;return d;}
  O.cls.forEach(c=>getDepth(c.id,new Set()));
  const maxD=Math.max(0,...Object.values(depth));
  const layers={};
  O.cls.forEach(c=>{const d=depth[c.id]||0;(layers[d]=layers[d]||[]).push(c.id);});
  const indL=maxD+1;O.ind.forEach(i=>{(layers[indL]=layers[indL]||[]).push(i.id);});
  const nodeLayer={};Object.keys(layers).forEach(l=>layers[l].forEach(id=>nodeLayer[id]=+l));
  const adj={};function addAdj(a,b){if(!a||!b||a===b)return;(adj[a]=adj[a]||new Set()).add(b);(adj[b]=adj[b]||new Set()).add(a);}
  O.sub.forEach(([c,p])=>addAdj(c,p));
  O.op.forEach(op=>{const doms=O.dom.filter(d=>d.p===op.id).map(d=>d.c),rngs=O.rng.filter(r=>r.p===op.id).map(r=>r.c);doms.forEach(d=>rngs.forEach(r=>addAdj(d,r)));});
  O.typ.forEach(([i,c])=>addAdj(i,c));
  O.rel.forEach(r=>addAdj(r.s,r.o));
  const angPos={};
  Object.keys(layers).forEach(l=>{const arr=layers[l];arr.forEach((id,i)=>{angPos[id]=arr.length?i/arr.length*Math.PI*2:0;});});
  for(let k=0;k<12;k++){
    Object.keys(layers).forEach(l=>{const arr=layers[l];if(arr.length<=1)return;
      const scored=arr.map(id=>{const ns=[...(adj[id]||[])].filter(n=>nodeLayer[n]!==+l&&angPos[n]!==undefined);
        if(!ns.length)return{id,score:angPos[id]};
        let ss=0,sc=0;ns.forEach(n=>{ss+=Math.sin(angPos[n]);sc+=Math.cos(angPos[n]);});
        let a=Math.atan2(ss,sc);if(a<0)a+=Math.PI*2;return{id,score:a};});
      scored.sort((a,b)=>a.score-b.score);
      const n=scored.length;scored.forEach((o,i)=>{angPos[o.id]=i/n*Math.PI*2;});});}
  const R=Math.max(14,Math.sqrt(O.cls.length+O.ind.length)*5);
  const yStep=7,yTop=12;
  for(let d=0;d<=maxD;d++){const arr=layers[d]||[];const y=yTop-d*yStep;const rad=R*(1-d*0.1);
    arr.forEach(id=>{const a=angPos[id];nodeMap[id]={x:Math.cos(a)*rad,y,z:Math.sin(a)*rad};});}
  const arrInd=layers[indL]||[];const indY=Math.min(-6,yTop-(maxD+1)*yStep-3);const indR=R*0.85;
  arrInd.forEach(id=>{const a=angPos[id];nodeMap[id]={x:Math.cos(a)*indR,y:indY,z:Math.sin(a)*indR};});}
hierLayout();updateFloor();

function makeLabel(text,size){size=size||1.6;const c=document.createElement('canvas');c.width=1280;c.height=160;const x=c.getContext('2d');
  x.font='72px system-ui,-apple-system,sans-serif';x.textAlign='center';x.textBaseline='middle';
  let l=text;if(l.length>24)l=l.substring(0,22)+'...';
  const tw=x.measureText(l).width,pX=28,pY=18,bw=Math.min(tw+pX*2,1260),bh=72+pY*2,bx=(1280-bw)/2,by=(160-bh)/2;
  x.fillStyle='rgba(255,255,255,0.97)';x.beginPath();x.roundRect(bx,by,bw,bh,18);x.fill();
  x.fillStyle='#222';x.fillText(l,640,80);
  const t=new THREE.CanvasTexture(c);const m=new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false});
  const s=new THREE.Sprite(m);s.userData.baseScale=size;s.scale.set(size*8,size,1);allLabels.push(s);return s;}

function makeNode(id,type,x,y,z,label,uri){const geo=type==='Class'?GEO.Class:GEO.Individual;
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}));
  mesh.position.set(x,y,z);mesh.userData={id,type,label:label||id,uri:uri||'',radius:type==='Class'?CLS_R:IND_R};
  const outPts=circleOutlinePts(type==='Class'?CLS_R:IND_R);
  mesh.add(outlineLine(outPts,type==='Class',0x333333));
  const lbl=makeLabel(label||id,1.4);lbl.position.set(0,0,0.1);mesh.add(lbl);
  scene.add(mesh);nodeMeshes.push(mesh);return mesh;}

O.cls.forEach(c=>{const p=nodeMap[c.id];if(p)makeNode(c.id,'Class',p.x,p.y,p.z,c.id,c.uri);});
O.ind.forEach(c=>{const p=nodeMap[c.id];if(p)makeNode(c.id,'Individual',p.x,p.y,p.z,c.id,c.uri);});

function addLine(srcId,tgtId,label,color,dashed){
  const sm=nodeMeshes.find(m=>m.userData.id===srcId),tm=nodeMeshes.find(m=>m.userData.id===tgtId);if(!sm||!tm)return;
  const geo=new THREE.BufferGeometry().setFromPoints([sm.position.clone(),tm.position.clone()]);
  const mat=dashed?new THREE.LineDashedMaterial({color:color||0xbbbbbb,dashSize:0.4,gapSize:0.3}):new THREE.LineBasicMaterial({color:color||0xbbbbbb});
  const line=new THREE.Line(geo,mat);line.userData={srcId,tgtId,label,dashed:!!dashed,origColor:color||0xbbbbbb};
  if(dashed)line.computeLineDistances();
  scene.add(line);edgeObjs.push(line);
  if(label){const mid=sm.position.clone().add(tm.position).multiplyScalar(.5);const lbl=makeLabel(label,1.4);lbl.position.copy(mid);scene.add(lbl);line.userData.labelSprite=lbl;}
  return line;}

const HEAD_SIZE=1.1;
function paintArrowHead(ctx,color,hollow,N){
  const cx=N/2,cy=N/2,w=N*0.72,h=N*0.62;
  const tipX=cx+2*w/3,baseX=cx-w/3,upY=cy-h/2,dnY=cy+h/2;
  const hex='#'+color.toString(16).padStart(6,'0');
  ctx.clearRect(0,0,N,N);
  ctx.beginPath();ctx.moveTo(tipX,cy);ctx.lineTo(baseX,upY);ctx.lineTo(baseX,dnY);ctx.closePath();
  if(hollow){ctx.fillStyle='#ffffff';ctx.fill();ctx.strokeStyle=hex;ctx.lineWidth=N*0.08;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}
  else{ctx.fillStyle=hex;ctx.fill();}}
function arrowHeadSprite(color,hollow){
  const N=128;const c=document.createElement('canvas');c.width=N;c.height=N;
  paintArrowHead(c.getContext('2d'),color,hollow,N);
  const tex=new THREE.CanvasTexture(c);
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});
  const s=new THREE.Sprite(mat);s.scale.set(HEAD_SIZE,HEAD_SIZE,1);
  s.userData.headSize=HEAD_SIZE;s.userData.tipFrac=(N*0.72*2/3)/N;
  s.userData.hollow=!!hollow;s.userData.canvas=c;return s;}
function repaintHead(sprite,color){const c=sprite.userData.canvas;paintArrowHead(c.getContext('2d'),color,sprite.userData.hollow,c.width);sprite.material.map.needsUpdate=true;}

function makeArrow(srcId,tgtId,label,color,hollow,dashed){
  if(srcId===tgtId)return makeLoop(srcId,label,color,hollow,dashed);
  const sm=nodeMeshes.find(m=>m.userData.id===srcId),tm=nodeMeshes.find(m=>m.userData.id===tgtId);if(!sm||!tm)return;
  const col=color||0x555555;
  const geo=new THREE.BufferGeometry().setFromPoints([sm.position.clone(),tm.position.clone()]);
  const mat=dashed?new THREE.LineDashedMaterial({color:col,dashSize:0.4,gapSize:0.28}):new THREE.LineBasicMaterial({color:col});
  const line=new THREE.Line(geo,mat);if(dashed)line.computeLineDistances();
  scene.add(line);
  const head=arrowHeadSprite(col,hollow);scene.add(head);
  const obj={line,head,srcId,tgtId,label,type:'arrow2d',visible:true,headSize:head.userData.headSize,dashed:!!dashed,origColor:col};
  arrowObjs.push(obj);
  if(label){const mid=sm.position.clone().add(tm.position).multiplyScalar(.5);const lbl=makeLabel(label,1.4);lbl.position.copy(mid);scene.add(lbl);obj.labelSprite=lbl;}
  updateArrow(obj);return obj;}

function updateArrow(a){
  if(a.isLoop)return;
  const sm=nodeMeshes.find(m=>m.userData.id===a.srcId),tm=nodeMeshes.find(m=>m.userData.id===a.tgtId);if(!sm||!tm)return;
  const edge=new THREE.Vector3().subVectors(tm.position,sm.position);const len=edge.length();if(len<0.01)return;
  edge.normalize();
  const sR=sm.userData.radius||1.4,tR=tm.userData.radius||1.4;
  const srcPt=sm.position.clone().addScaledVector(edge,sR);
  const hs=a.headSize||HEAD_SIZE;const tipOff=a.head.userData.tipFrac||0.48;
  const headCenter=tm.position.clone().addScaledVector(edge,-(tR+hs*tipOff));
  const pos=a.line.geometry.attributes.position;
  pos.setXYZ(0,srcPt.x,srcPt.y,srcPt.z);pos.setXYZ(1,headCenter.x,headCenter.y,headCenter.z);pos.needsUpdate=true;
  if(a.dashed)a.line.computeLineDistances();
  a.head.position.copy(headCenter);
  if(a.labelSprite)a.labelSprite.position.copy(sm.position.clone().add(tm.position).multiplyScalar(.5));
  updateArrowRot(a);}

function updateArrowRot(a){
  if(a.isLoop)return;
  const sm=nodeMeshes.find(m=>m.userData.id===a.srcId),tm=nodeMeshes.find(m=>m.userData.id===a.tgtId);if(!sm||!tm)return;
  const s=sm.position.clone().project(camera),t=tm.position.clone().project(camera);
  a.head.material.rotation=Math.atan2(t.y-s.y,t.x-s.x);}

function makeLoop(nodeId,label,color,hollow,dashed){
  const m=nodeMeshes.find(n=>n.userData.id===nodeId);if(!m)return;
  const R=m.userData.radius||1.4;const col=color||0x555555;
  const sx=R*Math.cos(Math.PI/4),sy=R*Math.sin(Math.PI/4);
  const ex=R*Math.cos(-Math.PI/4),ey=R*Math.sin(-Math.PI/4);
  const curve=new THREE.CubicBezierCurve3(
    new THREE.Vector3(sx,sy,0.003),
    new THREE.Vector3(R*3.6,R*2.2,0.003),
    new THREE.Vector3(R*3.6,-R*2.2,0.003),
    new THREE.Vector3(ex,ey,0.003));
  const pts=curve.getPoints(36);
  const mat=dashed?new THREE.LineDashedMaterial({color:col,dashSize:0.4,gapSize:0.28}):new THREE.LineBasicMaterial({color:col});
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat);
  if(dashed)line.computeLineDistances();
  m.add(line);
  const head=arrowHeadSprite(col,hollow);
  const hs=head.userData.headSize,tipFrac=head.userData.tipFrac||0.48;
  const endPt=pts[pts.length-1];const tangent=curve.getTangent(1.0).normalize();
  head.position.set(endPt.x-tangent.x*hs*tipFrac,endPt.y-tangent.y*hs*tipFrac,endPt.z);
  head.material.rotation=Math.atan2(tangent.y,tangent.x);
  m.add(head);
  const obj={line,head,srcId:nodeId,tgtId:nodeId,label,type:'loop',isLoop:true,visible:true,headSize:hs,origColor:col,dashed:!!dashed};
  if(label){const mid=curve.getPoint(0.5);const lbl=makeLabel(label,1.4);lbl.position.set(mid.x+0.2,mid.y,0.01);m.add(lbl);obj.labelSprite=lbl;}
  arrowObjs.push(obj);return obj;}

O.sub.forEach(([c,p])=>makeArrow(c,p,'subClassOf',0x333333,true,true));
O.typ.forEach(([i,c])=>addLine(i,c,'a',0xaaaaaa,true));
O.op.forEach(op=>{const doms=O.dom.filter(d=>d.p===op.id).map(d=>d.c),rngs=O.rng.filter(r=>r.p===op.id).map(r=>r.c);
  doms.forEach(d=>rngs.forEach(r=>makeArrow(d,r,op.id,0x555555,false,true)));});
O.rel.forEach(rel=>makeArrow(rel.s,rel.o,rel.p,0x222222,false,false));

const calloutObjs=[];
function makeDPCallout(nodeId,dpName,dpInfo,idx,total){
  const sm=nodeMeshes.find(m=>m.userData.id===nodeId);if(!sm)return;
  const R_=sm.userData.radius||CLS_R;
  const row=idx-(total-1)/2,vGap=2.4,horizLen=2.8;
  const labelY=row*vGap;
  const Ax=R_,Ay=0;
  const slopeV=labelY,slopeH=Math.abs(slopeV);
  const Bx=Ax+slopeH,By=labelY;
  const Cx=Bx+horizLen,Cy=labelY;
  const pts=Math.abs(slopeH)<0.05
    ?[new THREE.Vector3(Ax,Ay,0.002),new THREE.Vector3(Cx,Ay,0.002)]
    :[new THREE.Vector3(Ax,Ay,0.002),new THREE.Vector3(Bx,By,0.002),new THREE.Vector3(Cx,Cy,0.002)];
  const leader=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x888888}));
  sm.add(leader);
  const txt=dpInfo?dpName+' : '+dpInfo:dpName;
  const lbl=makeLabel(txt,1.4);lbl.position.set(Cx+0.2,Cy,0.01);sm.add(lbl);
  calloutObjs.push({leader,label:lbl,nodeId});}

const dpByClass={};
O.dp.forEach(dp=>{const doms=O.dom.filter(d=>d.p===dp.id).map(d=>d.c),rngs=O.rng.filter(r=>r.p===dp.id).map(r=>r.c);
  const dpr=rngs[0]||'';doms.forEach(d=>{dpByClass[d]=dpByClass[d]||[];dpByClass[d].push({name:dp.id,range:dpr});});});
Object.keys(dpByClass).forEach(cid=>{const dps=dpByClass[cid];dps.forEach((dp,i)=>makeDPCallout(cid,dp.name,dp.range,i,dps.length));});

const dpByIndiv={};
O.dpv.forEach(dv=>{dpByIndiv[dv.s]=dpByIndiv[dv.s]||[];dpByIndiv[dv.s].push({name:dv.p,value:dv.v});});
Object.keys(dpByIndiv).forEach(iid=>{const dps=dpByIndiv[iid];dps.forEach((dp,i)=>makeDPCallout(iid,dp.name,'"'+dp.value+'"',i,dps.length));});

const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let hovered=null;
let dragging=null;const dragPlane=new THREE.Plane(),dragOffset=new THREE.Vector3(),dragPoint=new THREE.Vector3(),camDir=new THREE.Vector3();
let pointerDownPos=null,movedFar=false;
let selectedRoot=null,selectedLine=null;const selectedSet=new Set();
function nodeFromHit(o){while(o){if(o.userData&&o.userData.id&&o.userData.type)return o;o=o.parent;}return null;}
function screenToRay(e){mouse.x=(e.clientX/innerWidth)*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;raycaster.setFromCamera(mouse,camera);}

function edgeEndpoints(e){if(!e)return[null,null];if(e.userData)return[e.userData.srcId,e.userData.tgtId];return[e.srcId,e.tgtId];}
function findEdgeBetween(a,b){
  const arr=arrowObjs.find(x=>(x.srcId===a&&x.tgtId===b)||(x.srcId===b&&x.tgtId===a));if(arr)return arr;
  return edgeObjs.find(x=>(x.userData.srcId===a&&x.userData.tgtId===b)||(x.userData.srcId===b&&x.userData.tgtId===a));}
function refreshArrowHeads(){arrowObjs.forEach(a=>{let tgt;
  if(a===selectedLine)tgt=0xf5b800;
  else if(selectedRoot&&(a.srcId===selectedRoot||a.tgtId===selectedRoot))tgt=0x3a7bd5;
  else if(selectedLine){const[s,t]=edgeEndpoints(selectedLine);if((a.srcId===s&&a.tgtId===t)||(a.srcId===t&&a.tgtId===s))tgt=0xf5b800;else tgt=a.origColor;}
  else tgt=a.origColor;
  if(a._headCol!==tgt){repaintHead(a.head,tgt);a._headCol=tgt;}});}
function updateSelection(){
  selectedSet.clear();
  if(selectedRoot){
    selectedSet.add(selectedRoot);
    edgeObjs.forEach(l=>{if(l.userData.srcId===selectedRoot)selectedSet.add(l.userData.tgtId);else if(l.userData.tgtId===selectedRoot)selectedSet.add(l.userData.srcId);});
    arrowObjs.forEach(a=>{if(a.srcId===selectedRoot)selectedSet.add(a.tgtId);else if(a.tgtId===selectedRoot)selectedSet.add(a.srcId);});
  }else if(selectedLine){
    const[s,t]=edgeEndpoints(selectedLine);selectedSet.add(s);selectedSet.add(t);
  }
  refreshArrowHeads();highlightSource();
}

const nodeToLines={};
function populateSource(){
  const body=document.getElementById('src-body');if(!body)return;
  body.innerHTML='';
  const lines=RAW.split('\n');
  const nodeIdSet=new Set([...O.cls.map(n=>n.id),...O.ind.map(n=>n.id)]);
  const opIdSet=new Set(O.op.map(n=>n.id));
  const dpIdSet=new Set(O.dp.map(n=>n.id));
  const allIds=[...nodeIdSet,...opIdSet,...dpIdSet];
  const reMap=new Map();allIds.forEach(id=>reMap.set(id,new RegExp('(^|[^A-Za-z0-9_])'+id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^A-Za-z0-9_])')));
  lines.forEach((line,idx)=>{
    const mentioned=[];
    allIds.forEach(id=>{if(reMap.get(id).test(line)){
      const kind=nodeIdSet.has(id)?'node':opIdSet.has(id)?'op':'dp';
      mentioned.push({id,kind});if(kind==='node')(nodeToLines[id]=nodeToLines[id]||[]).push(idx);}});
    const div=document.createElement('div');div.className='src-line';div.dataset.line=idx;
    const ln=document.createElement('span');ln.className='src-ln';ln.textContent=(idx+1).toString();
    const code=document.createElement('span');code.className='src-code';code.textContent=line||' ';
    div.appendChild(ln);div.appendChild(code);
    if(mentioned.length)div.addEventListener('click',()=>{
      const nM=mentioned.filter(m=>m.kind==='node').map(m=>m.id);
      const oM=mentioned.filter(m=>m.kind==='op').map(m=>m.id);
      const dM=mentioned.filter(m=>m.kind==='dp').map(m=>m.id);
      if(nM.length>=2)for(let i=0;i<nM.length;i++)for(let j=i+1;j<nM.length;j++){
        const e=findEdgeBetween(nM[i],nM[j]);
        if(e){selectedLine=(selectedLine===e)?null:e;selectedRoot=null;updateSelection();return;}}
      if(oM.length){const opId=oM[0];
        const arr=arrowObjs.find(a=>a.label===opId&&nM.includes(a.srcId)&&nM.includes(a.tgtId))
          ||arrowObjs.find(a=>a.label===opId);
        if(arr){selectedLine=(selectedLine===arr)?null:arr;selectedRoot=null;updateSelection();return;}}
      if(nM.length){selectedRoot=(nM[0]===selectedRoot)?null:nM[0];selectedLine=null;updateSelection();return;}
      if(dM.length){const dom=O.dom.find(d=>d.p===dM[0])?.c;
        if(dom){selectedRoot=(dom===selectedRoot)?null:dom;selectedLine=null;updateSelection();}}
    });
    body.appendChild(div);});
}

function highlightSource(){
  const body=document.getElementById('src-body');if(!body)return;
  body.querySelectorAll('.src-line.active,.src-line.neighbor').forEach(l=>{l.classList.remove('active');l.classList.remove('neighbor');});
  let activeLines=[],neighborLines=[];
  if(selectedRoot){
    activeLines=nodeToLines[selectedRoot]||[];
    const activeSet=new Set(activeLines);const neighSet=new Set();
    [...selectedSet].filter(id=>id!==selectedRoot).forEach(id=>(nodeToLines[id]||[]).forEach(i=>{if(!activeSet.has(i))neighSet.add(i);}));
    neighborLines=[...neighSet];
  }else if(selectedLine){
    const[s,t]=edgeEndpoints(selectedLine);
    const sL=new Set(nodeToLines[s]||[]),tL=new Set(nodeToLines[t]||[]);
    activeLines=[...sL].filter(i=>tL.has(i));
    const aSet=new Set(activeLines);
    neighborLines=[...new Set([...sL,...tL])].filter(i=>!aSet.has(i));
  }
  activeLines.forEach(i=>{const el=body.querySelector(`.src-line[data-line="${i}"]`);if(el)el.classList.add('active');});
  neighborLines.forEach(i=>{const el=body.querySelector(`.src-line[data-line="${i}"]`);if(el)el.classList.add('neighbor');});
  const firstIdx=activeLines.length?activeLines[0]:(neighborLines.length?neighborLines[0]:null);
  if(firstIdx!=null){const first=body.querySelector(`.src-line[data-line="${firstIdx}"]`);if(first)first.scrollIntoView({block:'center',behavior:'smooth'});}
}

populateSource();

(function(){const btn=document.getElementById('src-toggle');if(!btn)return;
  btn.addEventListener('click',()=>{const col=document.body.classList.toggle('src-collapsed');btn.textContent=col?'›':'‹';});})();

(function(){const rsz=document.getElementById('src-resize');if(!rsz)return;
  try{const saved=localStorage.getItem('ontoair.srcW');if(saved)document.documentElement.style.setProperty('--src-w',saved);}catch(_){}
  let active=false;
  rsz.addEventListener('pointerdown',e=>{active=true;document.body.style.userSelect='none';rsz.setPointerCapture(e.pointerId);rsz.style.transition='none';e.preventDefault();});
  window.addEventListener('pointermove',e=>{if(!active)return;const w=Math.max(200,Math.min(720,e.clientX));document.documentElement.style.setProperty('--src-w',w+'px');});
  window.addEventListener('pointerup',e=>{if(!active)return;active=false;document.body.style.userSelect='';rsz.style.transition='';
    try{const w=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--src-w'));if(w)localStorage.setItem('ontoair.srcW',w+'px');}catch(_){}});})();

canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  pointerDownPos={x:e.clientX,y:e.clientY};movedFar=false;
  screenToRay(e);const hits=raycaster.intersectObjects(nodeMeshes);
  if(hits.length){dragging=hits[0].object;ctrl.enabled=false;
    camera.getWorldDirection(camDir);dragPlane.setFromNormalAndCoplanarPoint(camDir.clone().negate(),dragging.position);
    raycaster.ray.intersectPlane(dragPlane,dragPoint);dragOffset.copy(dragging.position).sub(dragPoint);
    canvas.style.cursor='grabbing';canvas.setPointerCapture(e.pointerId);e.stopPropagation();}
},true);

canvas.addEventListener('click',e=>{
  if(movedFar)return;
  screenToRay(e);
  const nhits=raycaster.intersectObjects(nodeMeshes,true);
  const nhit=nhits.length?nodeFromHit(nhits[0].object):null;
  if(nhit){const id=nhit.userData.id;selectedRoot=(id===selectedRoot)?null:id;selectedLine=null;updateSelection();return;}
  const labelMap=[];
  edgeObjs.forEach(l=>{if(l.userData.labelSprite)labelMap.push([l.userData.labelSprite,l]);});
  arrowObjs.forEach(a=>{if(a.labelSprite)labelMap.push([a.labelSprite,a]);});
  const lhits=raycaster.intersectObjects(labelMap.map(x=>x[0]));
  if(lhits.length){const owner=labelMap.find(x=>x[0]===lhits[0].object)?.[1];
    if(owner){selectedLine=(selectedLine===owner)?null:owner;selectedRoot=null;updateSelection();return;}}
  raycaster.params.Line={threshold:0.45};
  const lineList=[...edgeObjs,...arrowObjs.map(a=>a.line)];
  const lineHits=raycaster.intersectObjects(lineList);
  if(lineHits.length){const hitLine=lineHits[0].object;
    const owner=edgeObjs.find(l=>l===hitLine)||arrowObjs.find(a=>a.line===hitLine);
    if(owner){selectedLine=(selectedLine===owner)?null:owner;selectedRoot=null;updateSelection();return;}}
  selectedRoot=null;selectedLine=null;updateSelection();
});
canvas.addEventListener('pointermove',e=>{
  if(pointerDownPos){const dx=e.clientX-pointerDownPos.x,dy=e.clientY-pointerDownPos.y;if(dx*dx+dy*dy>16)movedFar=true;}
  if(!dragging)return;
  screenToRay(e);if(!raycaster.ray.intersectPlane(dragPlane,dragPoint))return;
  dragging.position.copy(dragPoint).add(dragOffset);
  const id=dragging.userData.id;if(nodeMap[id]){nodeMap[id].x=dragging.position.x;nodeMap[id].y=dragging.position.y;nodeMap[id].z=dragging.position.z;}
  updateEdgesFor(id);
});
function endDrag(e){if(dragging){dragging=null;ctrl.enabled=true;canvas.style.cursor='';try{canvas.releasePointerCapture(e.pointerId);}catch(_){}}pointerDownPos=null;}
canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);

function updateEdgesFor(id){
  edgeObjs.forEach(l=>{if(l.userData.srcId===id||l.userData.tgtId===id){
    const s=nodeMeshes.find(m=>m.userData.id===l.userData.srcId),t=nodeMeshes.find(m=>m.userData.id===l.userData.tgtId);
    if(s&&t){const pos=l.geometry.attributes.position;pos.setXYZ(0,s.position.x,s.position.y,s.position.z);pos.setXYZ(1,t.position.x,t.position.y,t.position.z);pos.needsUpdate=true;
      if(l.userData.dashed)l.computeLineDistances();
      if(l.userData.labelSprite)l.userData.labelSprite.position.copy(s.position.clone().add(t.position).multiplyScalar(.5));}}});
  arrowObjs.forEach(a=>{if(a.srcId===id||a.tgtId===id)updateArrow(a);});
}

canvas.addEventListener('mousemove',e=>{
  if(dragging){document.getElementById('tooltip').style.display='none';return;}
  mouse.x=(e.clientX/innerWidth)*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera);const hits=raycaster.intersectObjects(nodeMeshes);
  const tt=document.getElementById('tooltip');
  canvas.style.cursor=hits.length?'grab':'';
  if(hits.length&&hits[0].object.userData.id){const d=hits[0].object.userData;
    tt.style.display='block';tt.style.left=(e.clientX+14)+'px';tt.style.top=(e.clientY+14)+'px';
    document.getElementById('ttn').textContent=d.label;document.getElementById('ttt').textContent=d.type;
    document.getElementById('ttu').textContent=d.uri||d.id;
    const cE=edgeObjs.filter(e2=>e2.userData.srcId===d.id||e2.userData.tgtId===d.id).map(e2=>({s:e2.userData.srcId,t:e2.userData.tgtId,l:e2.userData.label}));
    const cA=arrowObjs.filter(a=>a.srcId===d.id||a.tgtId===d.id).map(a=>({s:a.srcId,t:a.tgtId,l:a.label}));
    const conns=[...cE,...cA];
    const connRows=conns.map(c=>{const o=c.s===d.id?c.t:c.s;return(c.l||'?')+' \u2192 '+o;});
    const dpC=(dpByClass[d.id]||[]).map(dp=>dp.name+(dp.range?' : '+dp.range:''));
    const dpI=(dpByIndiv[d.id]||[]).map(dp=>dp.name+' = "'+dp.value+'"');
    document.getElementById('ttp').innerHTML=[...connRows,...dpC,...dpI].join('<br>')||'No connections';
    if(hovered&&hovered!==hits[0].object)hovered.material.color.setHex(0xffffff);
    hovered=hits[0].object;hovered.material.color.setHex(0xf0f0f0);
  }else{if(hovered)hovered.material.color.setHex(0xffffff);hovered=null;tt.style.display='none';}});

document.getElementById('search').addEventListener('input',e=>{const q=e.target.value.toLowerCase();
  nodeMeshes.forEach(m=>{m.visible=!q||m.userData.label.toLowerCase().includes(q)||m.userData.id.toLowerCase().includes(q);});
  edgeObjs.forEach(l=>{const sv=nodeMeshes.find(m=>m.userData.id===l.userData.srcId)?.visible;
    const tv=nodeMeshes.find(m=>m.userData.id===l.userData.tgtId)?.visible;l.visible=!q||(sv&&tv);
    if(l.userData.labelSprite)l.userData.labelSprite.visible=l.visible;});
  arrowObjs.forEach(a=>{const sv=nodeMeshes.find(m=>m.userData.id===a.srcId)?.visible;
    const tv=nodeMeshes.find(m=>m.userData.id===a.tgtId)?.visible;const vis=!q||(sv&&tv);
    a.visible=vis;a.line.visible=vis;a.head.visible=vis;if(a.labelSprite)a.labelSprite.visible=vis;});});

const _tmpV=new THREE.Vector3();
function updateLabelScales(){const cp=camera.position;allLabels.forEach(l=>{l.getWorldPosition(_tmpV);const d=cp.distanceTo(_tmpV);const bs=l.userData.baseScale*(d/REF_DIST)*textScale;l.scale.set(bs*8,bs,1);});}
const HI_COL=new THREE.Color(0x3a7bd5),BASE_ECOL=new THREE.Color();
const YEL_COL=new THREE.Color(0xf5b800);
function selectionPulse(){
  const active=!!(selectedRoot||selectedLine);const t=performance.now()/1000,pulse=0.5+0.5*Math.sin(t*2.5);
  nodeMeshes.forEach(m=>{if(m===hovered)return;
    if(!active){m.material.color.setHex(0xffffff);return;}
    const id=m.userData.id;
    if(id===selectedRoot){const s=0.15+0.22*pulse;m.material.color.setRGB(1,1-s*0.25,1-s*0.85);}
    else if(selectedSet.has(id)){const s=0.05+0.10*pulse;m.material.color.setRGB(1-s*0.7,1-s*0.3,1);}
    else m.material.color.setHex(0xffffff);});
  const blend=0.35+0.35*pulse;
  edgeObjs.forEach(l=>{const orig=l.userData.origColor||0xbbbbbb;BASE_ECOL.setHex(orig);
    if(l===selectedLine)l.material.color.copy(BASE_ECOL).lerp(YEL_COL,blend);
    else if(selectedRoot&&(l.userData.srcId===selectedRoot||l.userData.tgtId===selectedRoot))l.material.color.copy(BASE_ECOL).lerp(HI_COL,blend);
    else l.material.color.setHex(orig);});
  arrowObjs.forEach(a=>{const orig=a.origColor||0x555555;BASE_ECOL.setHex(orig);
    if(a===selectedLine)a.line.material.color.copy(BASE_ECOL).lerp(YEL_COL,blend);
    else if(selectedRoot&&(a.srcId===selectedRoot||a.tgtId===selectedRoot))a.line.material.color.copy(BASE_ECOL).lerp(HI_COL,blend);
    else a.line.material.color.setHex(orig);});}
function animate(){requestAnimationFrame(animate);nodeMeshes.forEach(m=>m.quaternion.copy(camera.quaternion));arrowObjs.forEach(updateArrowRot);selectionPulse();updateLabelScales();ctrl.update();renderer.render(scene,camera);}
animate();

window.addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey){if(e.key==='='||e.key==='+'){e.preventDefault();textScale=Math.min(textScale*1.2,5);}else if(e.key==='-'||e.key==='_'){e.preventDefault();textScale=Math.max(textScale/1.2,.2);}else if(e.key==='0'){e.preventDefault();textScale=1.0;}}});

function applyPositions(){Object.keys(nodeMap).forEach(id=>{const m=nodeMeshes.find(m=>m.userData.id===id);if(m)m.position.set(nodeMap[id].x,nodeMap[id].y,nodeMap[id].z);});
  edgeObjs.forEach(l=>{const s=nodeMeshes.find(m=>m.userData.id===l.userData.srcId),t=nodeMeshes.find(m=>m.userData.id===l.userData.tgtId);
    if(s&&t){const pos=l.geometry.attributes.position;pos.setXYZ(0,s.position.x,s.position.y,s.position.z);pos.setXYZ(1,t.position.x,t.position.y,t.position.z);pos.needsUpdate=true;
      if(l.userData.dashed)l.computeLineDistances();
      if(l.userData.labelSprite)l.userData.labelSprite.position.copy(s.position.clone().add(t.position).multiplyScalar(.5));}});
  arrowObjs.forEach(a=>updateArrow(a));updateFloor();}

function forceLayout(iter){iter=iter||300;const allIds=Object.keys(nodeMap),allEdges=[];
  O.sub.forEach(([c,p])=>allEdges.push([c,p]));
  O.op.forEach(op=>{const doms=O.dom.filter(d=>d.p===op.id).map(d=>d.c),rngs=O.rng.filter(r=>r.p===op.id).map(r=>r.c);doms.forEach(d=>rngs.forEach(r=>allEdges.push([d,r])));});
  O.typ.forEach(([i,c])=>allEdges.push([i,c]));
  O.rel.forEach(rel=>allEdges.push([rel.s,rel.o]));
  allIds.forEach(id=>{nodeMap[id].vx=0;nodeMap[id].vy=0;nodeMap[id].vz=0;});const k=15;
  for(let t=0;t<iter;t++){for(let i=0;i<allIds.length;i++){for(let j=i+1;j<allIds.length;j++){
    const a=nodeMap[allIds[i]],b=nodeMap[allIds[j]];const dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z,d=Math.sqrt(dx*dx+dy*dy+dz*dz)+.1,f=k*k/d*.008;
    a.vx+=dx/d*f;a.vy+=dy/d*f;a.vz+=dz/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f;b.vz-=dz/d*f;}}
    allEdges.forEach(([s,tgt])=>{const a=nodeMap[s],b=nodeMap[tgt];if(!a||!b)return;
      const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.sqrt(dx*dx+dy*dy+dz*dz)+.1,f=(d-k*2)*.003;
      a.vx+=dx/d*f;a.vy+=dy/d*f;a.vz+=dz/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f;b.vz-=dz/d*f;});
    allIds.forEach(id=>{const n=nodeMap[id];n.x+=n.vx*.5;n.y+=n.vy*.5;n.z+=n.vz*.5;n.vx*=.85;n.vy*=.85;n.vz*=.85;});}
  applyPositions();}

document.getElementById('bf').addEventListener('click',()=>{forceLayout(400);document.getElementById('bh').classList.remove('active');document.getElementById('bf').classList.add('active');});
document.getElementById('bh').addEventListener('click',()=>{hierLayout();applyPositions();document.getElementById('bh').classList.add('active');document.getElementById('bf').classList.remove('active');});
document.getElementById('br').addEventListener('click',()=>{camera.position.set(0,20,55);ctrl.target.set(0,0,0);document.getElementById('bh').click();});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

document.getElementById('fn').textContent=FNAME;
document.getElementById('info').innerHTML=O.cls.length+' owl:Class<br>'+O.ind.length+' Individual<br>'+O.op.length+' ObjectProperty<br>'+O.dp.length+' DatatypeProperty<br>'+(edgeObjs.length+arrowObjs.length)+' edges';
if(nodeMeshes.length>50)camera.position.set(0,30,80);
if(nodeMeshes.length>100)camera.position.set(0,40,120);
