/* OntoAir core renderer - expects globals: RAW, FMT, FNAME, THREE */

function localName(u){if(!u)return'';const h=u.lastIndexOf('#'),s=u.lastIndexOf('/');return u.substring(Math.max(h,s)+1);}

function parseXML(xml){
  const p=new DOMParser(),doc=p.parseFromString(xml,'application/xml');
  const R={cls:[],op:[],dp:[],ap:[],ind:[],sub:[],dom:[],rng:[],typ:[],rel:[],dpv:[],eqv:[],labels:{},comments:{}};
  const ns={owl:'http://www.w3.org/2002/07/owl#',rdf:'http://www.w3.org/1999/02/22-rdf-syntax-ns#'};
  function ga(e){return e.getAttributeNS(ns.rdf,'about')||e.getAttributeNS(ns.rdf,'ID')||e.getAttribute('rdf:about')||e.getAttribute('rdf:ID')||'';}
  function gr(e){return e.getAttributeNS(ns.rdf,'resource')||e.getAttribute('rdf:resource')||'';}
  const S=new Set(),allAssert=[];
  doc.querySelectorAll('*').forEach(el=>{
    const t=el.localName,ns2=el.namespaceURI,a=ga(el),n=localName(a);
    if(n){for(const c of el.children){if(c.localName==='label'&&!R.labels[n])R.labels[n]=c.textContent.trim();else if(c.localName==='comment'&&!R.comments[n])R.comments[n]=c.textContent.trim();}}
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
        else if(!['Ontology','Restriction','NamedIndividual','FunctionalProperty','InverseFunctionalProperty','TransitiveProperty','SymmetricProperty','ReflexiveProperty','IrreflexiveProperty','AsymmetricProperty','DeprecatedProperty','DeprecatedClass','Thing','Nothing'].includes(tn)&&!S.has('c:'+n)&&!S.has('op:'+n)&&!S.has('dp:'+n)&&!S.has('ap:'+n)&&!S.has('i:'+n)){S.add('i:'+n);R.ind.push({id:n,uri:a,cls:tn});R.typ.push([n,tn]);}}}
      else if(c.localName==='subClassOf'||c.tagName==='rdfs:subClassOf'){const r=gr(c);if(r)R.sub.push([n,localName(r)]);}
      else if(c.localName==='domain'||c.tagName==='rdfs:domain'){const r=gr(c);if(r)R.dom.push({p:n,c:localName(r)});}
      else if(c.localName==='range'||c.tagName==='rdfs:range'){const r=gr(c);if(r)R.rng.push({p:n,c:localName(r)});}
      else{const pr=c.localName||c.tagName;const rv=gr(c);if(rv)allAssert.push([n,localName(pr),localName(rv)]);}}}}
  });
  const indIds=new Set(R.ind.map(i=>i.id)),opIds=new Set(R.op.map(o=>o.id));
  allAssert.forEach(([s,p,o])=>{if(indIds.has(s)&&opIds.has(p)&&indIds.has(o))R.rel.push({s,p,o});});
  return R;}

function extractEquivAxioms(text,pfx){
  // Pull owl:equivalentClass [ ... intersectionOf ( P [Restriction onProperty X someValuesFrom Y] ... ) ] axioms
  // Hand-rolled scanner because the main parser splits on ';' and can't see into bracketed blank nodes.
  const clean=text.split('\n').map(l=>{let o='',q=null;for(let i=0;i<l.length;i++){const c=l[i];if(q){o+=c;if(c===q&&l[i-1]!=='\\')q=null;continue;}if(c==='"'||c==="'"){q=c;o+=c;continue;}if(c==='#')return o;o+=c;}return o;}).join('\n');
  function expand(c){if(!c)return'';if(c[0]==='<'&&c[c.length-1]==='>')return localName(c.slice(1,-1));const ix=c.indexOf(':');if(ix>=0&&pfx[c.substring(0,ix)]!==undefined)return localName(pfx[c.substring(0,ix)]+c.substring(ix+1));return c;}
  const out=[];let i=0;
  while((i=clean.indexOf('equivalentClass',i))!==-1){
    let depth=0,stmtStart=-1;
    for(let j=i-1;j>=0;j--){const c=clean[j];if(c===']'||c===')')depth++;else if(c==='['||c==='(')depth--;else if(c==='.'&&depth===0){stmtStart=j;break;}}
    let p=stmtStart+1;while(p<i&&/\s/.test(clean[p]))p++;
    const sm=clean.substring(p).match(/^(<[^>]+>|\S+)/);if(!sm){i++;continue;}
    const subj=sm[1];
    let k=i+'equivalentClass'.length;while(k<clean.length&&/\s/.test(clean[k]))k++;
    if(clean[k]!=='['){i=k;continue;}
    let d=1,end=k+1;while(end<clean.length&&d>0){if(clean[end]==='[')d++;else if(clean[end]===']')d--;end++;}
    const block=clean.substring(k+1,end-1);
    const intIdx=block.indexOf('intersectionOf');if(intIdx<0){i=end;continue;}
    let q=intIdx+'intersectionOf'.length;while(q<block.length&&/\s/.test(block[q]))q++;
    if(block[q]!=='('){i=end;continue;}
    let pd=1,pe=q+1;while(pe<block.length&&pd>0){if(block[pe]==='(')pd++;else if(block[pe]===')')pd--;pe++;}
    const list=block.substring(q+1,pe-1);
    const parts=[],restrictions=[];let r=0;
    while(r<list.length){
      while(r<list.length&&/\s/.test(list[r]))r++;if(r>=list.length)break;
      if(list[r]==='['){let bd=1,be=r+1;while(be<list.length&&bd>0){if(list[be]==='[')bd++;else if(list[be]===']')bd--;be++;}
        const rb=list.substring(r+1,be-1);
        const onP=rb.match(/onProperty\s+(<[^>]+>|[^\s;\]]+)/);
        const sV=rb.match(/someValuesFrom\s+(<[^>]+>|[^\s;\]]+)/);
        if(onP&&sV)restrictions.push({prop:expand(onP[1]),some:expand(sV[1])});
        r=be;
      }else{const m=list.substring(r).match(/^(<[^>]+>|\S+)/);if(m){parts.push(expand(m[1]));r+=m[1].length;}else r++;}
    }
    out.push({cls:expand(subj),parts,restrictions});
    i=end;
  }
  return out;
}

function parseTTL(ttl){
  const R={cls:[],op:[],dp:[],ap:[],ind:[],sub:[],dom:[],rng:[],typ:[],rel:[],dpv:[],eqv:[],labels:{},comments:{}};
  const pfx={},S=new Set(),allAssert=[];
  const ls=ttl.split('\n').map(l=>{let o='',inURI=false;for(let i=0;i<l.length;i++){if(l[i]==='<')inURI=true;if(l[i]==='>')inURI=false;if(l[i]==='#'&&!inURI)return o.trim();o+=l[i];}return o.trim();}).filter(l=>l);
  const ct=ls.join(' ');let pm,re=/@prefix\s+(\w*):?\s*<([^>]+)>\s*\./g;
  while((pm=re.exec(ct)))pfx[pm[1]]=pm[2];
  const re2=/PREFIX\s+(\w*):?\s*<([^>]+)>/gi;while((pm=re2.exec(ct)))pfx[pm[1]]=pm[2];
  R.eqv=extractEquivAxioms(ttl,pfx);
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
          else if(!['Ontology','Restriction','NamedIndividual','FunctionalProperty','InverseFunctionalProperty','TransitiveProperty','SymmetricProperty','ReflexiveProperty','IrreflexiveProperty','AsymmetricProperty','DeprecatedProperty','DeprecatedClass','Thing','Nothing'].includes(tn)){
            if(!S.has('c:'+s2)&&!S.has('op:'+s2)&&!S.has('dp:'+s2)&&!S.has('ap:'+s2)){
              if(!S.has('i:'+s2)){S.add('i:'+s2);R.ind.push({id:s2,uri:eu(subj),cls:tn});}
              R.typ.push([s2,tn]);
            }}}
        else if(pL==='subClassOf'){R.sub.push([s2,o]);}
        else if(pL==='domain'){R.dom.push({p:s2,c:o});}
        else if(pL==='range'){R.rng.push({p:s2,c:o});}
        else if(pL==='label'){const m=obj.match(/^"((?:[^"\\]|\\.)*)"/);if(m)R.labels[s2]=m[1];}
        else if(pL==='comment'){const m=obj.match(/^"((?:[^"\\]|\\.)*)"/);if(m)R.comments[s2]=m[1];}
        else{allAssert.push([s2,pL,obj,o]);}});}
    proc(ft.slice(1));for(let i=1;i<pts.length;i++){const t=pts[i].match(/\S+/g);if(t)proc(t);}});
  const indIds=new Set(R.ind.map(i=>i.id)),opIds=new Set(R.op.map(o=>o.id)),dpIds=new Set(R.dp.map(d=>d.id));
  let implicitProps=0;
  allAssert.forEach(([s,p,objRaw,o])=>{
    const isLit=objRaw.startsWith('"')||objRaw.startsWith("'")||/^[+-]?\d/.test(objRaw);
    if(indIds.has(s)&&indIds.has(o)&&!isLit){
      // Lenient: undeclared predicate between two individuals → implicit ObjectProperty
      if(!opIds.has(p)&&!dpIds.has(p)){R.op.push({id:p,uri:p,implicit:true});opIds.add(p);implicitProps++;}
      R.rel.push({s,p,o});
    }else if(indIds.has(s)&&isLit){
      if(!dpIds.has(p)&&!opIds.has(p)){R.dp.push({id:p,uri:p,implicit:true});dpIds.add(p);implicitProps++;}
      if(dpIds.has(p)){let v=objRaw;const m=v.match(/^"([^"\\]*(?:\\.[^"\\]*)*)"/);if(m)v=m[1];else if(v.startsWith("'")&&v.endsWith("'"))v=v.slice(1,-1);R.dpv.push({s,p,v});}
    }
  });
  R.missingTBox=implicitProps>3&&R.cls.length<2;
  return R;}

const O=FMT==='ttl'?parseTTL(RAW):parseXML(RAW);window.O=O;

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
  // Pull each node toward the angular centroid of its cross-layer neighbors (blended with uniform),
  // then run a relaxation pass that enforces a minimum angular gap so nodes don't overlap.
  for(let k=0;k<12;k++){
    Object.keys(layers).forEach(l=>{const arr=layers[l];if(arr.length<=1)return;
      const scored=arr.map(id=>{const ns=[...(adj[id]||[])].filter(n=>nodeLayer[n]!==+l&&angPos[n]!==undefined);
        if(!ns.length)return{id,score:angPos[id]};
        let ss=0,sc=0;ns.forEach(n=>{ss+=Math.sin(angPos[n]);sc+=Math.cos(angPos[n]);});
        let a=Math.atan2(ss,sc);if(a<0)a+=Math.PI*2;return{id,score:a};});
      scored.sort((a,b)=>a.score-b.score);
      const n=scored.length;const blend=Math.min(0.9,0.35+k*0.06);
      scored.forEach((o,i)=>{const uniform=i/n*Math.PI*2;let diff=o.score-uniform;
        while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;
        let a=uniform+diff*blend;if(a<0)a+=Math.PI*2;if(a>=Math.PI*2)a-=Math.PI*2;
        angPos[o.id]=a;});});}
  // Min-gap relaxation: prevent nodes within a layer from overlapping
  Object.keys(layers).forEach(l=>{
    const arr=layers[l];const n=arr.length;if(n<=1)return;
    const minGap=(Math.PI*2/n)*0.85;
    for(let pass=0;pass<24;pass++){
      const sorted=[...arr].sort((a,b)=>angPos[a]-angPos[b]);
      let moved=false;
      for(let i=0;i<n;i++){
        const cur=sorted[i],prev=sorted[(i-1+n)%n],nxt=sorted[(i+1)%n];
        const curA=angPos[cur];
        let dPrev=curA-angPos[prev];while(dPrev<=0)dPrev+=Math.PI*2;
        let dNxt=angPos[nxt]-curA;while(dNxt<=0)dNxt+=Math.PI*2;
        let push=0;
        if(dPrev<minGap)push+=(minGap-dPrev)*0.5;
        if(dNxt<minGap)push-=(minGap-dNxt)*0.5;
        if(push!==0){let newA=curA+push;while(newA<0)newA+=Math.PI*2;while(newA>=Math.PI*2)newA-=Math.PI*2;
          angPos[cur]=newA;moved=true;}
      }
      if(!moved)break;
    }
  });
  const R=Math.max(18,Math.sqrt(O.cls.length+O.ind.length)*6.5);
  const yStep=7,yTop=12;
  // Class hub-ness: classes with many cross-connections rise above their depth layer
  // and shift toward the center, so subclasses/instances fan out radially below them.
  const clsHub={};let maxClsHub=0;
  O.cls.forEach(c=>{const n=(adj[c.id]||new Set()).size;clsHub[c.id]=n;if(n>maxClsHub)maxClsHub=n;});
  for(let d=0;d<=maxD;d++){const arr=layers[d]||[];const baseY=yTop-d*yStep;const baseR=R*(1-d*0.1);
    arr.forEach(id=>{const a=angPos[id];
      const hubFrac=maxClsHub>0?clsHub[id]/maxClsHub:0;
      const rad=baseR*(1-hubFrac*0.55);
      const y=baseY+hubFrac*yStep*0.7;
      nodeMap[id]={x:Math.cos(a)*rad,y,z:Math.sin(a)*rad};});}
  const arrInd=layers[indL]||[];const indY=Math.min(-6,yTop-(maxD+1)*yStep-3);const indR=R*0.85;
  // Hub-ness: individuals with many same-layer connections sit closer to the center,
  // so chord lengths to their scattered peers stay roughly equal.
  const indHub={};let maxIndHub=0;
  arrInd.forEach(id=>{const c=[...(adj[id]||[])].filter(n=>nodeLayer[n]===indL).length;indHub[id]=c;if(c>maxIndHub)maxIndHub=c;});
  arrInd.forEach(id=>{const a=angPos[id];
    const hubFrac=maxIndHub>0?indHub[id]/maxIndHub:0;
    const rad=indR*(1-hubFrac*0.5);
    nodeMap[id]={x:Math.cos(a)*rad,y:indY,z:Math.sin(a)*rad};});
  // Singleton rule: if a class has exactly one directly-typed individual and that individual
  // isn't a hub, drop the individual straight below the class (same x, z).
  const indByClass={};O.typ.forEach(([i,c])=>{(indByClass[c]=indByClass[c]||[]).push(i);});
  arrInd.forEach(id=>{
    if(indHub[id]>1)return;
    const ts=O.typ.filter(t=>t[0]===id).map(t=>t[1]);
    let primary=null,maxDp=-1;
    ts.forEach(t=>{const d=depth[t];if(d!==undefined&&d>=maxDp){maxDp=d;primary=t;}});
    if(primary&&indByClass[primary]&&indByClass[primary].length===1){
      const cp=nodeMap[primary];if(cp){nodeMap[id].x=cp.x;nodeMap[id].z=cp.z;}
    }
  });}
hierLayout();updateFloor();

function makeLabel(text,size,subtitle){size=size||1.6;
  const W=1280,H=subtitle?260:160;
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.textAlign='center';x.textBaseline='middle';
  let l=text;if(l.length>24)l=l.substring(0,22)+'...';
  let sub='';if(subtitle){sub=subtitle;if(sub.length>28)sub=sub.substring(0,26)+'...';}
  x.font='72px system-ui,-apple-system,sans-serif';
  const tw=x.measureText(l).width;
  const stw=sub?x.measureText(sub).width:0;
  const maxTw=Math.max(tw,stw);
  const pX=28,pY=18,bw=Math.min(maxTw+pX*2,W-20),bh=(subtitle?72*2+16:72)+pY*2,bx=(W-bw)/2,by=(H-bh)/2;
  x.fillStyle='rgba(255,255,255,0.97)';x.beginPath();x.roundRect(bx,by,bw,bh,18);x.fill();
  x.fillStyle='#222';
  if(subtitle){
    x.fillText(l,W/2,H/2-44);
    x.fillStyle='#666';x.fillText(sub,W/2,H/2+44);
  }else{
    x.fillText(l,W/2,H/2);
  }
  const t=new THREE.CanvasTexture(c);const m=new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false});
  const s=new THREE.Sprite(m);s.userData.baseScale=size;s.userData.aspect=W/H;s.scale.set(size*W/H,size,1);allLabels.push(s);return s;}

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
  const offset=_pairOffset(srcId,tgtId);
  const geo=new THREE.BufferGeometry().setFromPoints([sm.position.clone(),tm.position.clone()]);
  const mat=dashed?new THREE.LineDashedMaterial({color:col,dashSize:0.4,gapSize:0.28}):new THREE.LineBasicMaterial({color:col});
  const line=new THREE.Line(geo,mat);if(dashed)line.computeLineDistances();
  scene.add(line);
  const head=arrowHeadSprite(col,hollow);scene.add(head);
  const obj={line,head,srcId,tgtId,label,type:'arrow2d',visible:true,headSize:head.userData.headSize,dashed:!!dashed,origColor:col,offset,origOffset:offset};
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
  if(!a.offset){
    const pos=a.line.geometry.attributes.position;
    if(pos.count===2){pos.setXYZ(0,srcPt.x,srcPt.y,srcPt.z);pos.setXYZ(1,headCenter.x,headCenter.y,headCenter.z);pos.needsUpdate=true;}
    else{a.line.geometry.dispose();a.line.geometry=new THREE.BufferGeometry().setFromPoints([srcPt,headCenter]);}
    if(a.dashed)a.line.computeLineDistances();
    a.head.position.copy(headCenter);
    if(a.labelSprite)a.labelSprite.position.copy(sm.position.clone().add(tm.position).multiplyScalar(.5));
    a._tangent=null;
  }else{
    // Canonical perpendicular axis, shared by all arrows in this node-pair.
    const [fA,fB]=a.srcId<a.tgtId?[sm,tm]:[tm,sm];
    const cdx=fB.position.x-fA.position.x,cdy=fB.position.y-fA.position.y;
    const cpl=Math.hypot(cdx,cdy)||1;
    const perpX=-cdy/cpl,perpY=cdx/cpl;
    // Shift endpoints along perp so each arrow enters/exits off-center — prevents X-crossing at endpoints.
    const endShift=a.offset*Math.min(sR,tR)*0.9;
    srcPt.x+=perpX*endShift; srcPt.y+=perpY*endShift;
    headCenter.x+=perpX*endShift; headCenter.y+=perpY*endShift;
    // Gentle bend on top of the endpoint separation.
    const midX=(srcPt.x+headCenter.x)/2,midY=(srcPt.y+headCenter.y)/2,midZ=(srcPt.z+headCenter.z)/2;
    const dx=headCenter.x-srcPt.x,dy=headCenter.y-srcPt.y;
    const pl=Math.hypot(dx,dy)||1;
    const bend=a.offset*pl*0.75;
    const cpX=midX+perpX*bend,cpY=midY+perpY*bend,cpZ=midZ;
    const cp=new THREE.Vector3(cpX,cpY,cpZ);
    const curve=new THREE.QuadraticBezierCurve3(srcPt.clone(),cp,headCenter.clone());
    const pts=curve.getPoints(22);
    a.line.geometry.dispose();
    a.line.geometry=new THREE.BufferGeometry().setFromPoints(pts);
    if(a.dashed)a.line.computeLineDistances();
    a.head.position.copy(headCenter);
    if(a.labelSprite)a.labelSprite.position.copy(curve.getPoint(0.5));
    a._tangent=curve.getTangentAt(1).normalize();
    a._cpWorld=cp;
    a._endPt=headCenter.clone();
  }
  updateArrowRot(a);}

function updateArrowRot(a){
  if(a.isLoop)return;
  if(a.offset&&a._cpWorld){
    const endWorld=a._endPt||(()=>{const tm=nodeMeshes.find(m=>m.userData.id===a.tgtId);return tm?tm.position:null;})();
    if(!endWorld)return;
    const t=endWorld.clone().project(camera);const c=a._cpWorld.clone().project(camera);
    a.head.material.rotation=Math.atan2(t.y-c.y,t.x-c.x);return;
  }
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

const _pairCount={},_pairAssign={};
function _pkey(a,b){return a<b?a+'|'+b:b+'|'+a;}
function _countPair(a,b){const k=_pkey(a,b);_pairCount[k]=(_pairCount[k]||0)+1;}
O.sub.forEach(([c,p])=>_countPair(c,p));
O.op.forEach(op=>{const doms=O.dom.filter(d=>d.p===op.id).map(d=>d.c),rngs=O.rng.filter(r=>r.p===op.id).map(r=>r.c);doms.forEach(d=>rngs.forEach(r=>_countPair(d,r)));});
O.rel.forEach(rel=>_countPair(rel.s,rel.o));
function _pairOffset(a,b){const k=_pkey(a,b);const n=_pairCount[k]||1;if(n<=1)return 0;
  const i=(_pairAssign[k]=(_pairAssign[k]||0)+1)-1;
  return (i-(n-1)/2)*0.7;}

O.sub.forEach(([c,p])=>makeArrow(c,p,'subClassOf',0x333333,true,true));
O.typ.forEach(([i,c])=>addLine(i,c,'a',0xaaaaaa,true));
O.op.forEach(op=>{const doms=O.dom.filter(d=>d.p===op.id).map(d=>d.c),rngs=O.rng.filter(r=>r.p===op.id).map(r=>r.c);
  doms.forEach(d=>rngs.forEach(r=>makeArrow(d,r,op.id,0x555555,false,true)));});
O.rel.forEach(rel=>makeArrow(rel.s,rel.o,rel.p,0x222222,false,false));

const calloutObjs=[];
function makeDPStackLabel(texts){
  const W=1280,lineH=108,pad=14;
  const H=Math.max(160,texts.length*lineH+pad*2);
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.textBaseline='middle';
  const rows=texts.map(t=>{let n=t,v='';const i1=t.indexOf(' : '),i2=t.indexOf(' = ');
    const idx=i1>=0?i1:i2;if(idx>=0){n=t.substring(0,idx).trim();v=t.substring(idx+3).trim();}
    if(n.length>22)n=n.substring(0,20)+'...';if(v.length>20)v=v.substring(0,18)+'...';
    return{n,v};});
  x.font='72px system-ui,-apple-system,sans-serif';
  let maxNW=0,maxVW=0;
  rows.forEach(r=>{const nw=x.measureText(r.n).width;if(nw>maxNW)maxNW=nw;if(r.v){const vw=x.measureText(r.v).width;if(vw>maxVW)maxVW=vw;}});
  const colPad=24,nameColW=maxNW+colPad*2,valColW=(maxVW>0?maxVW+colPad*2:0);
  let bw=nameColW+valColW;if(bw<320)bw=320;if(bw>W-20)bw=W-20;
  const bh=H-8,bx=4,by=4;
  x.fillStyle='rgba(255,255,255,0.97)';x.beginPath();x.roundRect(bx,by,bw,bh,14);x.fill();
  x.strokeStyle='rgba(0,0,0,0.10)';x.lineWidth=1;
  for(let i=1;i<rows.length;i++){const sy=by+pad+i*lineH;x.beginPath();x.moveTo(bx+10,sy);x.lineTo(bx+bw-10,sy);x.stroke();}
  if(valColW>0){const sepX=bx+nameColW;x.beginPath();x.moveTo(sepX,by+10);x.lineTo(sepX,by+bh-10);x.stroke();}
  x.textAlign='left';
  rows.forEach((r,i)=>{const ty=by+pad+(i+0.5)*lineH;
    x.fillStyle='#222';x.fillText(r.n,bx+colPad,ty);
    if(r.v){x.fillStyle='#666';x.fillText(r.v,bx+nameColW+colPad,ty);}
  });
  const tex=new THREE.CanvasTexture(c);
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});
  const bs=H*(1.4/160);
  const s=new THREE.Sprite(mat);s.userData.baseScale=bs;s.userData.aspect=W/H;s.scale.set(bs*W/H,bs,1);allLabels.push(s);return s;}
function makeDPStack(nodeId,texts){
  const sm=nodeMeshes.find(m=>m.userData.id===nodeId);if(!sm||!texts.length)return;
  const R_=sm.userData.radius||CLS_R;
  const slopeD=1.8,horizLen=1.0;
  const Ax=R_*Math.SQRT1_2,Ay=R_*Math.SQRT1_2;
  const Bx=Ax+slopeD,By=Ay+slopeD;
  const Cx=Bx+horizLen,Cy=By;
  const pts=[new THREE.Vector3(Ax,Ay,0.002),new THREE.Vector3(Bx,By,0.002),new THREE.Vector3(Cx,Cy,0.002)];
  const leader=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x888888}));
  sm.add(leader);
  const lbl=makeDPStackLabel(texts);
  lbl.center=new THREE.Vector2(0,0.5);
  lbl.position.set(Cx,Cy,0.01);sm.add(lbl);
  calloutObjs.push({leader,label:lbl,nodeId});
}

const dpByClass={};
O.dp.forEach(dp=>{const doms=O.dom.filter(d=>d.p===dp.id).map(d=>d.c),rngs=O.rng.filter(r=>r.p===dp.id).map(r=>r.c);
  const dpr=rngs[0]||'';doms.forEach(d=>{dpByClass[d]=dpByClass[d]||[];dpByClass[d].push({name:dp.id,range:dpr});});});
Object.keys(dpByClass).forEach(cid=>{const texts=dpByClass[cid].map(dp=>dp.range?dp.name+' : '+dp.range:dp.name);makeDPStack(cid,texts);});

const dpByIndiv={};
O.dpv.forEach(dv=>{dpByIndiv[dv.s]=dpByIndiv[dv.s]||[];dpByIndiv[dv.s].push({name:dv.p,value:dv.v});});
Object.keys(dpByIndiv).forEach(iid=>{const texts=dpByIndiv[iid].map(dp=>dp.name+' = "'+dp.value+'"');makeDPStack(iid,texts);});

const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let hovered=null;
let dragging=null;const dragPlane=new THREE.Plane(),dragOffset=new THREE.Vector3(),dragPoint=new THREE.Vector3(),camDir=new THREE.Vector3();
let pointerDownPos=null,movedFar=false;
let selectedRoot=null,selectedLine=null,handHoverRoot=null,isolatedRoot=null;const selectedSet=new Set();
function _isolationConnected(rootId){const set=new Set([rootId]);
  edgeObjs.forEach(l=>{if(l.userData.srcId===rootId)set.add(l.userData.tgtId);else if(l.userData.tgtId===rootId)set.add(l.userData.srcId);});
  arrowObjs.forEach(a=>{if(a.srcId===rootId)set.add(a.tgtId);else if(a.tgtId===rootId)set.add(a.srcId);});
  return set;}
function applyIsolation(){
  if(!isolatedRoot){
    nodeMeshes.forEach(m=>m.visible=true);
    edgeObjs.forEach(l=>{l.visible=true;if(l.userData.labelSprite)l.userData.labelSprite.visible=true;});
    arrowObjs.forEach(a=>{if(a.line)a.line.visible=true;if(a.head)a.head.visible=true;if(a.labelSprite)a.labelSprite.visible=true;});
    if(typeof calloutObjs!=='undefined')calloutObjs.forEach(o=>{if(o.leader)o.leader.visible=dpVisible;if(o.label)o.label.visible=dpVisible;});
    return;
  }
  const c=_isolationConnected(isolatedRoot);
  nodeMeshes.forEach(m=>m.visible=c.has(m.userData.id));
  edgeObjs.forEach(l=>{const v=c.has(l.userData.srcId)&&c.has(l.userData.tgtId);l.visible=v;if(l.userData.labelSprite)l.userData.labelSprite.visible=v;});
  arrowObjs.forEach(a=>{const v=c.has(a.srcId)&&c.has(a.tgtId);if(a.line)a.line.visible=v;if(a.head)a.head.visible=v;if(a.labelSprite)a.labelSprite.visible=v;});
  if(typeof calloutObjs!=='undefined')calloutObjs.forEach(o=>{const v=c.has(o.nodeId)&&dpVisible;if(o.leader)o.leader.visible=v;if(o.label)o.label.visible=v;});
}
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
      _suppressScroll=true;
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

let _suppressScroll=false;
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
  if(firstIdx!=null&&!_suppressScroll){const first=body.querySelector(`.src-line[data-line="${firstIdx}"]`);if(first)first.scrollIntoView({block:'center',behavior:'smooth'});}
  _suppressScroll=false;
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
  const isolate=e.metaKey||e.ctrlKey;
  screenToRay(e);
  const nhits=raycaster.intersectObjects(nodeMeshes,true);
  const nhit=nhits.length?nodeFromHit(nhits[0].object):null;
  if(nhit){const id=nhit.userData.id;
    if(isolate){
      isolatedRoot=(isolatedRoot===id)?null:id;
      selectedRoot=isolatedRoot;selectedLine=null;
      updateSelection();applyIsolation();
    }else{
      if(isolatedRoot){isolatedRoot=null;applyIsolation();}
      selectedRoot=(id===selectedRoot)?null:id;selectedLine=null;updateSelection();
    }
    return;}
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
  // Empty click clears both selection and isolation
  if(isolatedRoot){isolatedRoot=null;applyIsolation();}
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
  // In 2D mode, re-evaluate curvature on all arrows — moving a node can both create new obstructions and clear old ones.
  const b2=document.getElementById('b2');if(b2&&b2.classList.contains('active'))bendEdgesToAvoid();
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
    const tlEl=document.getElementById('ttl');if(tlEl)tlEl.textContent=O.labels[d.id]||'';
    document.getElementById('ttu').textContent=d.uri||d.id;
    const tcEl=document.getElementById('ttc');if(tcEl)tcEl.textContent=O.comments[d.id]||'';
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
function updateLabelScales(){const cp=camera.position;allLabels.forEach(l=>{l.getWorldPosition(_tmpV);const d=cp.distanceTo(_tmpV);const bs=l.userData.baseScale*(d/REF_DIST)*textScale;const ar=l.userData.aspect||8;l.scale.set(bs*ar,bs,1);});}
const HI_COL=new THREE.Color(0x3a7bd5),BASE_ECOL=new THREE.Color();
const YEL_COL=new THREE.Color(0xf5b800);
function selectionPulse(){
  const active=!!(selectedRoot||selectedLine);const t=performance.now()/1000,pulse=0.5+0.5*Math.sin(t*2.5),hoverPulse=0.5+0.5*Math.sin(t*4);
  nodeMeshes.forEach(m=>{if(m===hovered)return;
    const id=m.userData.id;
    if(active&&id===selectedRoot){const s=0.15+0.22*pulse;m.material.color.setRGB(1,1-s*0.25,1-s*0.85);}
    else if(active&&selectedSet.has(id)){const s=0.05+0.10*pulse;m.material.color.setRGB(1-s*0.7,1-s*0.3,1);}
    else if(id===handHoverRoot){const s=0.12+0.22*hoverPulse;m.material.color.setRGB(1-s*0.17,1-s*0.61,1-s*0.09);}
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
function animate(){requestAnimationFrame(animate);nodeMeshes.forEach(m=>m.quaternion.copy(camera.quaternion));arrowObjs.forEach(updateArrowRot);selectionPulse();updateLabelScales();animateInferred(performance.now());ctrl.update();renderer.render(scene,camera);}
animate();

let dpVisible=true;
function setDPVisibility(v){dpVisible=v;calloutObjs.forEach(o=>{
  // When isolation is active, only show DPs of visible (connected) nodes
  if(isolatedRoot){const c=_isolationConnected(isolatedRoot);const ok=v&&c.has(o.nodeId);if(o.leader)o.leader.visible=ok;if(o.label)o.label.visible=ok;}
  else{if(o.leader)o.leader.visible=v;if(o.label)o.label.visible=v;}
});}
window.addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey){if(e.key==='='||e.key==='+'){e.preventDefault();textScale=Math.min(textScale*1.2,5);}else if(e.key==='-'||e.key==='_'){e.preventDefault();textScale=Math.max(textScale/1.2,.2);}else if(e.key==='0'){e.preventDefault();textScale=1.0;}return;}
  const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'))return;
  if(e.key==='d'||e.key==='D'){e.preventDefault();setDPVisibility(!dpVisible);}
  else if(e.key==='Escape'&&isolatedRoot){isolatedRoot=null;applyIsolation();selectedRoot=null;selectedLine=null;updateSelection();}
});

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

// 2D layered layout (mermaid-style): Sugiyama layering with dummy-node insertion so long edges
// reserve X-slots in intermediate layers and real nodes are nudged aside out of those channels.
function layout2D(){
  const nodes=[...O.cls.map(c=>c.id),...O.ind.map(i=>i.id)];
  const nodeSet=new Set(nodes);
  const downRaw=[];
  O.sub.forEach(([c,p])=>downRaw.push([p,c]));
  O.op.forEach(op=>{const ds=O.dom.filter(d=>d.p===op.id).map(d=>d.c),rs=O.rng.filter(r=>r.p===op.id).map(r=>r.c);
    ds.forEach(d=>rs.forEach(r=>downRaw.push([d,r])));});
  O.typ.forEach(([i,c])=>downRaw.push([c,i]));
  O.rel.forEach(r=>downRaw.push([r.s,r.o]));
  const outAdj={};nodes.forEach(n=>outAdj[n]=[]);
  const edgeKey=new Set();
  downRaw.forEach(([s,t])=>{if(!nodeSet.has(s)||!nodeSet.has(t)||s===t)return;
    const k=s+'|'+t;if(edgeKey.has(k))return;edgeKey.add(k);outAdj[s].push(t);});
  const color={};nodes.forEach(n=>color[n]=0);
  const keptEdges=[];
  function dfs(n){color[n]=1;outAdj[n].forEach(t=>{if(color[t]===0){keptEdges.push([n,t]);dfs(t);}
    else if(color[t]===2){keptEdges.push([n,t]);}});color[n]=2;}
  nodes.forEach(n=>{if(color[n]===0)dfs(n);});
  const dag={},inDeg={};nodes.forEach(n=>{dag[n]=[];inDeg[n]=0;});
  keptEdges.forEach(([s,t])=>{dag[s].push(t);inDeg[t]++;});
  const layer={};nodes.forEach(n=>layer[n]=0);
  const q=nodes.filter(n=>inDeg[n]===0);const inCopy={...inDeg};
  while(q.length){const n=q.shift();dag[n].forEach(t=>{layer[t]=Math.max(layer[t],layer[n]+1);inCopy[t]--;if(inCopy[t]===0)q.push(t);});}
  nodes.forEach(n=>{if(inCopy[n]>0){let m=0;Object.keys(dag).forEach(s=>{if(dag[s].includes(n))m=Math.max(m,(layer[s]||0)+1);});layer[n]=m;}});
  // Insert dummy nodes for edges spanning more than one layer; re-route adjacency chain through them.
  const dummies=new Set();const adj={};nodes.forEach(n=>adj[n]=new Set());
  keptEdges.forEach(([s,t])=>{
    const ls=layer[s],lt=layer[t];
    if(Math.abs(lt-ls)<=1){adj[s].add(t);adj[t].add(s);return;}
    const step=lt>ls?1:-1;let prev=s;
    for(let l=ls+step;l!==lt;l+=step){
      const d='__d_'+s+'_'+t+'_l'+l;dummies.add(d);layer[d]=l;adj[d]=new Set();
      adj[prev].add(d);adj[d].add(prev);prev=d;
    }
    adj[prev].add(t);adj[t].add(prev);
  });
  const allIds=[...nodes,...dummies];
  const maxL=Math.max(0,...Object.values(layer));
  const layers={};for(let l=0;l<=maxL;l++)layers[l]=[];
  allIds.forEach(n=>layers[layer[n]].push(n));
  const layerIdxs=Object.keys(layers).map(Number).sort((a,b)=>a-b);
  function indexIn(arr){const m={};arr.forEach((id,i)=>m[id]=i);return m;}
  for(let pass=0;pass<50;pass++){
    const dir=pass%2===0?1:-1;
    const start=dir===1?1:layerIdxs.length-2;
    const end=dir===1?layerIdxs.length:-1;
    for(let li=start;li!==end;li+=dir){
      const l=layerIdxs[li],lAdj=layerIdxs[li-dir];
      const arr=layers[l],adjArr=layers[lAdj];if(!arr||!adjArr||!arr.length)continue;
      const adjIdx=indexIn(adjArr);
      const scored=arr.map((id,i)=>{const ns=[...adj[id]].filter(n=>layer[n]===lAdj);
        if(!ns.length)return{id,b:i};
        let s=0;ns.forEach(n=>s+=adjIdx[n]);return{id,b:s/ns.length};});
      scored.sort((a,b)=>a.b-b.b);
      layers[l]=scored.map(o=>o.id);
    }
  }
  const X_SPACING=12,Y_SPACING=11;
  const totalH=(layerIdxs.length-1)*Y_SPACING;
  layerIdxs.forEach(l=>{
    const arr=layers[l],n=arr.length;
    const width=(n-1)*X_SPACING;
    const y=totalH/2-l*Y_SPACING;
    arr.forEach((id,i)=>{if(dummies.has(id))return;const nm=nodeMap[id];if(!nm)return;
      nm.x=i*X_SPACING-width/2;nm.y=y;nm.z=0;});
  });
  applyPositions();
}
// Curved 2D: same layered placement, but detect arrows whose straight path grazes a
// non-endpoint node and bend them (set per-arrow offset) to route around it.
function resetBends(){
  arrowObjs.forEach(a=>{if(a.isLoop)return;if(a.offset!==a.origOffset){a.offset=a.origOffset||0;updateArrow(a);}});
}
function bendEdgesToAvoid(){
  arrowObjs.forEach(a=>{
    if(a.isLoop)return;
    const sm=nodeMeshes.find(m=>m.userData.id===a.srcId);
    const tm=nodeMeshes.find(m=>m.userData.id===a.tgtId);
    if(!sm||!tm)return;
    const [fA,fB]=a.srcId<a.tgtId?[sm,tm]:[tm,sm];
    const dx=fB.position.x-fA.position.x,dy=fB.position.y-fA.position.y;
    const len=Math.hypot(dx,dy);if(len<0.01)return;
    const nx=-dy/len,ny=dx/len;
    let maxPen=0,chosenSide=0;
    nodeMeshes.forEach(m=>{
      if(m===sm||m===tm)return;
      const vx=m.position.x-fA.position.x,vy=m.position.y-fA.position.y;
      const along=(vx*dx+vy*dy)/(len*len);
      if(along<0.12||along>0.88)return;
      const perp=vx*nx+vy*ny;const absPerp=Math.abs(perp);
      const r=(m.userData.radius||1.5)+2.2;
      if(absPerp<r){const pen=r-absPerp;if(pen>maxPen){maxPen=pen;chosenSide=perp>=0?-1:1;}}
    });
    const newOffset=chosenSide!==0?chosenSide*0.5:(a.origOffset||0);
    if(newOffset!==a.offset){a.offset=newOffset;updateArrow(a);}
  });
}
function layout2DCurved(){layout2D();bendEdgesToAvoid();}
function setView2D(on){
  const R=Math.max(30,Math.sqrt(O.cls.length+O.ind.length)*8);
  if(on){
    // Save current 3D pose, switch to front-orthographic-like view, disable rotation.
    if(!camera.userData.saved3D)camera.userData.saved3D={pos:camera.position.clone(),tgt:ctrl.target.clone()};
    camera.position.set(0,0,R*2.2);ctrl.target.set(0,0,0);
    ctrl.enableRotate=false;
  }else{
    const saved=camera.userData.saved3D;
    if(saved){camera.position.copy(saved.pos);ctrl.target.copy(saved.tgt);camera.userData.saved3D=null;}
    ctrl.enableRotate=true;
  }
}

// ---- Lightweight OWL reasoner (RDFS subClassOf transitivity, type propagation, equivalentClass intersectionOf+someValuesFrom) ----
function runReasoner(){
  const inf={typ:[],sub:[]};
  const subBy={};O.sub.forEach(([c,p])=>(subBy[c]=subBy[c]||new Set()).add(p));
  const ancestors={};O.cls.forEach(c=>ancestors[c.id]=null);
  function anc(id,seen){if(ancestors[id])return ancestors[id];if(seen.has(id))return new Set();seen.add(id);
    const a=new Set();(subBy[id]||[]).forEach(p=>{a.add(p);anc(p,seen).forEach(x=>a.add(x));});ancestors[id]=a;return a;}
  O.cls.forEach(c=>anc(c.id,new Set()));
  const directSub=new Set(O.sub.map(s=>s[0]+'|'+s[1]));
  Object.entries(ancestors).forEach(([c,as])=>as&&as.forEach(a=>{const k=c+'|'+a;if(!directSub.has(k)&&c!==a)inf.sub.push([c,a]);}));
  const allTypes={};O.ind.forEach(ind=>allTypes[ind.id]=new Set());
  O.typ.forEach(([i,c])=>allTypes[i]&&allTypes[i].add(c));
  Object.keys(allTypes).forEach(i=>{const ts=[...allTypes[i]];ts.forEach(t=>(ancestors[t]||new Set()).forEach(a=>allTypes[i].add(a)));});
  const directTyp=new Set(O.typ.map(t=>t[0]+'|'+t[1]));
  Object.entries(allTypes).forEach(([i,ts])=>ts.forEach(c=>{const k=i+'|'+c;if(!directTyp.has(k))inf.typ.push([i,c]);}));
  const hasType=(i,c)=>{const ts=allTypes[i]||new Set();if(ts.has(c))return true;for(const t of ts)if((ancestors[t]||new Set()).has(c))return true;return false;};
  // someValuesFrom usually takes a class, but TTL examples often point at a named individual
  // (hasValue semantics). Accept either: object equals target, OR object's type is target.
  const matchTarget=(objId,target)=>objId===target||hasType(objId,target);
  (O.eqv||[]).forEach(e=>{O.ind.forEach(ind=>{
    if(!e.parts.every(p=>hasType(ind.id,p)))return;
    if(!(e.restrictions||[]).every(r=>O.rel.some(rel=>rel.s===ind.id&&rel.p===r.prop&&matchTarget(rel.o,r.some))))return;
    if(!allTypes[ind.id].has(e.cls)){
      const k=ind.id+'|'+e.cls;if(!directTyp.has(k))inf.typ.push([ind.id,e.cls]);
      allTypes[ind.id].add(e.cls);
      (ancestors[e.cls]||new Set()).forEach(a=>{if(!allTypes[ind.id].has(a)){const k2=ind.id+'|'+a;if(!directTyp.has(k2))inf.typ.push([ind.id,a]);allTypes[ind.id].add(a);}});
    }
  });});
  const dedup=arr=>[...new Set(arr.map(x=>x.join('|')))].map(k=>k.split('|'));
  return{typ:dedup(inf.typ),sub:dedup(inf.sub)};
}

var _inferred={arrows:[],lines:[]};
function applyReasoning(){
  if(_inferred.arrows.length||_inferred.lines.length)return;
  const inf=runReasoner();const COL=0xff8a00;
  inf.sub.forEach(([c,p])=>{const a=makeArrow(c,p,'subClassOf*',COL,true,true);if(a){a.inferred=true;
    if(a.line&&a.line.material){a.line.material.transparent=true;a.line.material.opacity=1;}
    if(a.head&&a.head.material)a.head.material.transparent=true;
    _inferred.arrows.push(a);}});
  inf.typ.forEach(([i,c])=>{const l=addLine(i,c,'a*',COL,true);if(l){l.userData.inferred=true;
    if(l.material){l.material.transparent=true;l.material.opacity=1;}
    _inferred.lines.push(l);}});
}
// Marching-ants light beam: shift the dash pattern along the line each frame
// by mutating per-vertex lineDistance with a time offset. Recomputed from current
// vertex positions so it stays correct after layout changes.
const _DASH_CYCLE=0.4+0.28;
function _marchLine(line,offset){
  if(!line||!line.geometry)return;
  const pos=line.geometry.attributes.position;if(!pos||pos.count<2)return;
  let ld=line.geometry.attributes.lineDistance;
  if(!ld||ld.count!==pos.count){ld=new THREE.BufferAttribute(new Float32Array(pos.count),1);line.geometry.setAttribute('lineDistance',ld);}
  ld.setX(0,offset);let cum=0;
  for(let i=1;i<pos.count;i++){
    const dx=pos.getX(i)-pos.getX(i-1),dy=pos.getY(i)-pos.getY(i-1),dz=pos.getZ(i)-pos.getZ(i-1);
    cum+=Math.sqrt(dx*dx+dy*dy+dz*dz);ld.setX(i,cum+offset);
  }
  ld.needsUpdate=true;
}
function animateInferred(t){
  if(!_inferred||(!_inferred.arrows.length&&!_inferred.lines.length))return;
  const phase=(Math.sin(t*0.004)+1)*0.5;
  const op=0.55+phase*0.45;
  // Negative offset → dashes scroll forward (src → tgt), evoking "flow" of inference
  const dashOffset=-((t*0.0018)%_DASH_CYCLE);
  _inferred.arrows.forEach(a=>{
    if(a.line){_marchLine(a.line,dashOffset);if(a.line.material)a.line.material.opacity=op;}
    if(a.head&&a.head.material)a.head.material.opacity=op;
    if(a.labelSprite&&a.labelSprite.material)a.labelSprite.material.opacity=op;
  });
  _inferred.lines.forEach(l=>{
    _marchLine(l,dashOffset);
    if(l.material)l.material.opacity=op;
    if(l.userData.labelSprite&&l.userData.labelSprite.material)l.userData.labelSprite.material.opacity=op;
  });
}
function clearReasoning(){
  _inferred.arrows.forEach(a=>{
    if(a.line){scene.remove(a.line);a.line.geometry.dispose();a.line.material.dispose();}
    if(a.head){scene.remove(a.head);a.head.material.dispose();}
    if(a.labelSprite)scene.remove(a.labelSprite);
    const i=arrowObjs.indexOf(a);if(i>=0)arrowObjs.splice(i,1);
  });
  _inferred.lines.forEach(l=>{
    scene.remove(l);l.geometry.dispose();l.material.dispose();
    if(l.userData.labelSprite)scene.remove(l.userData.labelSprite);
    const i=edgeObjs.indexOf(l);if(i>=0)edgeObjs.splice(i,1);
  });
  _inferred.arrows=[];_inferred.lines=[];
}

function _setLayoutActive(id){['bh','bf','b2'].forEach(x=>{const el=document.getElementById(x);if(el)el.classList.toggle('active',x===id);});}
document.getElementById('bf').addEventListener('click',()=>{setView2D(false);resetBends();forceLayout(400);_setLayoutActive('bf');});
document.getElementById('bh').addEventListener('click',()=>{setView2D(false);resetBends();hierLayout();applyPositions();_setLayoutActive('bh');});
const _b2=document.getElementById('b2');if(_b2)_b2.addEventListener('click',()=>{layout2DCurved();setView2D(true);_setLayoutActive('b2');});
document.getElementById('br').addEventListener('click',()=>{setView2D(false);resetBends();camera.position.set(0,20,55);ctrl.target.set(0,0,0);document.getElementById('bh').click();});
const _bre=document.getElementById('bre');
if(_bre)_bre.addEventListener('click',()=>{
  if(_bre.classList.contains('active')){clearReasoning();_bre.classList.remove('active');}
  else{applyReasoning();_bre.classList.add('active');}
});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

document.getElementById('fn').textContent=FNAME;
document.getElementById('info').innerHTML=O.cls.length+' owl:Class<br>'+O.ind.length+' Individual<br>'+O.op.length+' ObjectProperty<br>'+O.dp.length+' DatatypeProperty<br>'+(edgeObjs.length+arrowObjs.length)+' edges';
if(nodeMeshes.length>50)camera.position.set(0,30,80);
if(nodeMeshes.length>100)camera.position.set(0,40,120);

let handDragId=null;
window.OA={THREE,camera,ctrl,renderer,canvas,raycaster,nodeMeshes,edgeObjs,arrowObjs,nodeFromHit,findEdgeBetween,edgeEndpoints,
  getSelectedRoot:()=>selectedRoot,
  beginNodeDrag:(id,ndcX,ndcY)=>{const m=nodeMeshes.find(n=>n.userData.id===id);if(!m)return false;
    mouse.x=ndcX;mouse.y=ndcY;raycaster.setFromCamera(mouse,camera);
    camera.getWorldDirection(camDir);dragPlane.setFromNormalAndCoplanarPoint(camDir.clone().negate(),m.position);
    if(!raycaster.ray.intersectPlane(dragPlane,dragPoint))return false;
    dragOffset.copy(m.position).sub(dragPoint);handDragId=id;return true;},
  pickAndDragAtNDC:(ndcX,ndcY)=>{mouse.x=ndcX;mouse.y=ndcY;raycaster.setFromCamera(mouse,camera);
    const nh=raycaster.intersectObjects(nodeMeshes,true);const nhit=nh.length?nodeFromHit(nh[0].object):null;
    if(nhit){const id=nhit.userData.id;selectedRoot=id;selectedLine=null;updateSelection();
      camera.getWorldDirection(camDir);dragPlane.setFromNormalAndCoplanarPoint(camDir.clone().negate(),nhit.position);
      if(raycaster.ray.intersectPlane(dragPlane,dragPoint)){dragOffset.copy(nhit.position).sub(dragPoint);handDragId=id;}
      return id;}
    return null;},
  updateNodeDrag:(ndcX,ndcY)=>{if(!handDragId)return;const m=nodeMeshes.find(n=>n.userData.id===handDragId);if(!m)return;
    mouse.x=ndcX;mouse.y=ndcY;raycaster.setFromCamera(mouse,camera);
    if(!raycaster.ray.intersectPlane(dragPlane,dragPoint))return;
    m.position.copy(dragPoint).add(dragOffset);
    if(nodeMap[handDragId]){nodeMap[handDragId].x=m.position.x;nodeMap[handDragId].y=m.position.y;nodeMap[handDragId].z=m.position.z;}
    updateEdgesFor(handDragId);},
  endNodeDrag:()=>{handDragId=null;},
  setHandHover:(id)=>{handHoverRoot=id;},
  getHandHover:()=>handHoverRoot,
  hierLayout:()=>{hierLayout();applyPositions();},
  forceLayout:()=>forceLayout(400),
  resetView:()=>{camera.position.set(0,20,55);ctrl.target.set(0,0,0);},
  setSelectedRoot:(id)=>{selectedRoot=id;selectedLine=null;updateSelection();},
  setSelectedLine:(l)=>{selectedLine=l;selectedRoot=null;updateSelection();},
  clearSelection:()=>{selectedRoot=null;selectedLine=null;updateSelection();},
  selectAtNDC:(x,y)=>{
    mouse.x=x;mouse.y=y;raycaster.setFromCamera(mouse,camera);
    const nh=raycaster.intersectObjects(nodeMeshes,true);
    const nhit=nh.length?nodeFromHit(nh[0].object):null;
    if(nhit){selectedRoot=(nhit.userData.id===selectedRoot)?null:nhit.userData.id;selectedLine=null;updateSelection();return{type:'node',id:nhit.userData.id};}
    raycaster.params.Line={threshold:0.45};
    const lineList=[...edgeObjs,...arrowObjs.map(a=>a.line)];
    const lh=raycaster.intersectObjects(lineList);
    if(lh.length){const hitLine=lh[0].object;
      const owner=edgeObjs.find(l=>l===hitLine)||arrowObjs.find(a=>a.line===hitLine);
      if(owner){selectedLine=(selectedLine===owner)?null:owner;selectedRoot=null;updateSelection();return{type:'edge'};}}
    selectedRoot=null;selectedLine=null;updateSelection();return null;
  },
  hoverAtNDC:(x,y)=>{mouse.x=x;mouse.y=y;raycaster.setFromCamera(mouse,camera);
    const nh=raycaster.intersectObjects(nodeMeshes,true);return nh.length?nodeFromHit(nh[0].object):null;},
  setTextScale:(s)=>{textScale=Math.max(0.2,Math.min(5,s));},
  getTextScale:()=>textScale,
  toggleSource:()=>{const btn=document.getElementById('src-toggle');if(btn)btn.click();},
  getNodeScreenAt:(id)=>{const m=nodeMeshes.find(n=>n.userData.id===id);if(!m)return null;return m.position.clone().project(camera);}
};
