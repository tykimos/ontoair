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
  // Geo: scan WGS84/schema literal lat/long children. Mirrors parseTTL's R.geo shape.
  const _gxAcc={};
  doc.querySelectorAll('*').forEach(el=>{const a=ga(el);if(!a)return;const subj=localName(a);
    for(const c of el.children){const pr=(c.localName||'').toLowerCase();
      if(pr==='lat'||pr==='latitude'||pr==='long'||pr==='lng'||pr==='longitude'){
        const txt=(c.textContent||'').trim();const m=txt.match(/^[+-]?\d+(?:\.\d+)?/);if(!m)continue;
        const num=parseFloat(m[0]);if(isNaN(num))continue;
        if(pr==='lat'||pr==='latitude')(_gxAcc[subj]=_gxAcc[subj]||{}).lat=num;
        else (_gxAcc[subj]=_gxAcc[subj]||{}).lon=num;}}});
  const _gxNodes=[];Object.entries(_gxAcc).forEach(([id,v])=>{if(typeof v.lat==='number'&&typeof v.lon==='number'&&v.lat>=-90&&v.lat<=90&&v.lon>=-180&&v.lon<=180)_gxNodes.push({id,lat:v.lat,lon:v.lon});});
  R.geo={nodes:_gxNodes};R.hasGeo=_gxNodes.length>0;
  // Orbit: scan literal tleLine1/2 children. Mirrors parseTTL's R.satellites shape.
  const _oxAcc={};
  doc.querySelectorAll('*').forEach(el=>{const a=ga(el);if(!a)return;const subj=localName(a);
    for(const c of el.children){const pr=(c.localName||'').toLowerCase();const txt=(c.textContent||'').trim();if(!txt)continue;
      if(pr==='tleline1'||pr==='tle1')(_oxAcc[subj]=_oxAcc[subj]||{}).tle1=txt;
      else if(pr==='tleline2'||pr==='tle2')(_oxAcc[subj]=_oxAcc[subj]||{}).tle2=txt;
      else if(pr==='tleepoch'||pr==='epoch')(_oxAcc[subj]=_oxAcc[subj]||{}).epoch=txt;
      else if(pr==='noradid'||pr==='norad')(_oxAcc[subj]=_oxAcc[subj]||{}).norad=txt;}});
  const _oxSats=[];Object.entries(_oxAcc).forEach(([id,v])=>{if(v.tle1&&v.tle2&&v.tle1.length>50&&v.tle2.length>50)_oxSats.push({id,tle1:v.tle1,tle2:v.tle2,epoch:v.epoch||null,norad:v.norad||null});});
  R.satellites=_oxSats;R.hasOrbit=_oxSats.length>0;
  // Grid: scan literal gridX/gridY children. Mirrors parseTTL's R.grid shape.
  const _gxgAcc={};let _gxgDimX=null,_gxgDimY=null;
  doc.querySelectorAll('*').forEach(el=>{const a=ga(el);if(!a)return;const subj=localName(a);
    for(const c of el.children){const pr=(c.localName||'').toLowerCase();const txt=(c.textContent||'').trim();if(!txt)continue;
      const dimNum=parseInt(txt);
      if(!isNaN(dimNum)&&dimNum>0){
        if(pr==='griddimx'||pr==='gridwidth'||pr==='gridcols'){_gxgDimX=Math.max(_gxgDimX||0,dimNum);continue;}
        else if(pr==='griddimy'||pr==='gridheight'||pr==='gridrows'){_gxgDimY=Math.max(_gxgDimY||0,dimNum);continue;}
      }
      let num=parseFloat(txt);if(isNaN(num)){const m=txt.match(/^[a-zA-Z]/);if(m)num=m[0].toLowerCase().charCodeAt(0)-97;}if(isNaN(num))continue;
      if(pr==='gridx'||pr==='col'||pr==='column')(_gxgAcc[subj]=_gxgAcc[subj]||{}).gx=num;
      else if(pr==='gridy'||pr==='row')(_gxgAcc[subj]=_gxgAcc[subj]||{}).gy=num;}});
  const _gxgNodes=[];Object.entries(_gxgAcc).forEach(([id,v])=>{if(typeof v.gx==='number'&&typeof v.gy==='number')_gxgNodes.push({id,gx:v.gx,gy:v.gy});});
  R.grid={nodes:_gxgNodes,dimX:_gxgDimX,dimY:_gxgDimY};R.hasGrid=_gxgNodes.length>0;
  // Body: scan bodyAnchor/bodyX/bodyY literal children. Mirrors parseTTL's R.body shape.
  const _bxAcc={};
  doc.querySelectorAll('*').forEach(el=>{const a=ga(el);if(!a)return;const subj=localName(a);
    for(const c of el.children){const pr=(c.localName||'').toLowerCase();const txt=(c.textContent||'').trim();if(!txt)continue;
      if(pr==='bodyanchor'||pr==='bodyregion'||pr==='anatomy'||pr==='organloc')(_bxAcc[subj]=_bxAcc[subj]||{}).key=txt.toLowerCase();
      else if(pr==='bodyx'){const n=parseFloat(txt);if(!isNaN(n))(_bxAcc[subj]=_bxAcc[subj]||{}).bx=n;}
      else if(pr==='bodyy'){const n=parseFloat(txt);if(!isNaN(n))(_bxAcc[subj]=_bxAcc[subj]||{}).by=n;}}});
  const _bxNodes=[];Object.entries(_bxAcc).forEach(([id,v])=>{if(v.key||(typeof v.bx==='number'&&typeof v.by==='number'))_bxNodes.push({id,key:v.key||null,bx:(typeof v.bx==='number'?v.bx:null),by:(typeof v.by==='number'?v.by:null)});});
  R.body={nodes:_bxNodes};R.hasBody=_bxNodes.length>0;
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
  const _ph=typeof window!=='undefined'&&typeof window.__oaPhase==='function'?window.__oaPhase:null;
  _ph&&_ph('parseTTL start',(ttl.length/1048576).toFixed(2)+' MB');
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
  for(let i=0;i<bd.length;i++){const c=bd[i];if(qc){st+=c;if(c===qc&&bd[i-1]!=='\\')qc=null;continue;}if(c==='"'||c==="'"){qc=c;st+=c;continue;}if(c==='['||c==='('){dp++;st+=c;continue;}if(c===']'||c===')'){dp--;st+=c;continue;}if(c==='.'&&dp===0){const pv=bd[i-1],nx=bd[i+1];if(pv&&nx&&/\d/.test(pv)&&/\d/.test(nx)){st+=c;continue;}if(st.trim())sts.push(st.trim());st='';continue;}st+=c;}
  if(st.trim())sts.push(st.trim());
  _ph&&_ph('Statements tokenized',sts.length+' statements');
  // Quote-aware tokenizer: splits on whitespace but treats "..." / '...' as single tokens (preserves internal whitespace).
  // Critical for TLE strings where column alignment must survive parsing.
  function _tok(s){const out=[];let cur='',q=null;for(let i=0;i<s.length;i++){const c=s[i];if(q){cur+=c;if(c===q&&s[i-1]!=='\\')q=null;continue;}if(c==='"'||c==="'"){if(cur){out.push(cur);cur='';}cur=c;q=c;continue;}if(/\s/.test(c)){if(cur){out.push(cur);cur='';}continue;}cur+=c;}if(cur)out.push(cur);return out;}
  sts.forEach(s=>{const pts=s.split(/\s*;\s*/);if(!pts.length)return;const ft=_tok(pts[0]);if(!ft||ft.length<2)return;const subj=ft[0];
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
    proc(ft.slice(1));for(let i=1;i<pts.length;i++){const t=_tok(pts[i]);if(t)proc(t);}});
  _ph&&_ph('TBox extracted',R.cls.length+' classes · '+R.op.length+' OP · '+R.dp.length+' DP');
  _ph&&_ph('ABox extracted',R.ind.length+' individuals');
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
  _ph&&_ph('Assertions linked',R.rel.length+' object · '+R.dpv.length+' datatype');
  // Geo: lat/long aggregation from R.dpv (literal datatype values). Pairs only.
  const _gtAcc={};
  R.dpv.forEach(({s,p,v})=>{const k=String(p).toLowerCase();const m=String(v).match(/^[+-]?\d+(?:\.\d+)?/);if(!m)return;const num=parseFloat(m[0]);if(isNaN(num))return;
    if(k==='lat'||k==='latitude')(_gtAcc[s]=_gtAcc[s]||{}).lat=num;
    else if(k==='long'||k==='lng'||k==='longitude')(_gtAcc[s]=_gtAcc[s]||{}).lon=num;});
  const _gtNodes=[];Object.entries(_gtAcc).forEach(([id,v])=>{if(typeof v.lat==='number'&&typeof v.lon==='number'&&v.lat>=-90&&v.lat<=90&&v.lon>=-180&&v.lon<=180)_gtNodes.push({id,lat:v.lat,lon:v.lon});});
  R.geo={nodes:_gtNodes};R.hasGeo=_gtNodes.length>0;
  _ph&&_ph('Geo aggregated',R.hasGeo?_gtNodes.length+' geo nodes':'none');
  // Orbit: aggregate TLE pairs from dpv. Satellites have tleLine1 + tleLine2 (each ~69 chars).
  const _otAcc={};
  R.dpv.forEach(({s,p,v})=>{const k=String(p).toLowerCase();
    if(k==='tleline1'||k==='tle1')(_otAcc[s]=_otAcc[s]||{}).tle1=String(v);
    else if(k==='tleline2'||k==='tle2')(_otAcc[s]=_otAcc[s]||{}).tle2=String(v);
    else if(k==='tleepoch'||k==='epoch')(_otAcc[s]=_otAcc[s]||{}).epoch=String(v);
    else if(k==='noradid'||k==='norad')(_otAcc[s]=_otAcc[s]||{}).norad=String(v);});
  const _otSats=[];Object.entries(_otAcc).forEach(([id,v])=>{if(v.tle1&&v.tle2&&v.tle1.length>50&&v.tle2.length>50)_otSats.push({id,tle1:v.tle1,tle2:v.tle2,epoch:v.epoch||null,norad:v.norad||null});});
  R.satellites=_otSats;R.hasOrbit=_otSats.length>0;
  _ph&&_ph('Orbit aggregated',R.hasOrbit?_otSats.length+' satellites with TLE':'none');
  // Grid: aggregate gridX/gridY (alias col/row, column/row) from dpv. Letters 'a'..'z' → 0..25 auto-convert.
  const _grAcc={};
  R.dpv.forEach(({s,p,v})=>{const k=String(p).toLowerCase();let num=parseFloat(String(v));if(isNaN(num)){const m=String(v).trim().match(/^[a-zA-Z]/);if(m)num=m[0].toLowerCase().charCodeAt(0)-97;}if(isNaN(num))return;
    if(k==='gridx'||k==='col'||k==='column')(_grAcc[s]=_grAcc[s]||{}).gx=num;
    else if(k==='gridy'||k==='row')(_grAcc[s]=_grAcc[s]||{}).gy=num;});
  // Board dimensions — gridDimX/Y can be declared on ANY subject (incl. Ontology) so scan allAssert directly.
  let _grDimX=null,_grDimY=null;
  allAssert.forEach(([_s,p,objRaw])=>{const k=String(p).toLowerCase();const m=String(objRaw).match(/^[+-]?\d+/);if(!m)return;const num=parseInt(m[0]);if(isNaN(num)||num<=0)return;
    if(k==='griddimx'||k==='gridwidth'||k==='gridcols')_grDimX=Math.max(_grDimX||0,num);
    else if(k==='griddimy'||k==='gridheight'||k==='gridrows')_grDimY=Math.max(_grDimY||0,num);});
  const _grNodes=[];Object.entries(_grAcc).forEach(([id,v])=>{if(typeof v.gx==='number'&&typeof v.gy==='number')_grNodes.push({id,gx:v.gx,gy:v.gy});});
  R.grid={nodes:_grNodes,dimX:_grDimX,dimY:_grDimY};R.hasGrid=_grNodes.length>0;
  _ph&&_ph('Grid aggregated',R.hasGrid?_grNodes.length+' grid nodes':'none');
  // Body: anatomical anchors. bodyAnchor "heart"/"심장" (looked up in BODY_ANCHORS at layout time) OR explicit bodyX/bodyY (normalized 0..1, top-left origin). Mirrors R.geo/R.grid shape.
  const _bdAcc={};
  R.dpv.forEach(({s,p,v})=>{let k=String(p).toLowerCase();const _ci=k.lastIndexOf(':');if(_ci>=0)k=k.slice(_ci+1);  // strip any prefix (handles non-ASCII prefixes like 인체:bodyAnchor)
    if(k==='bodyanchor'||k==='bodyregion'||k==='anatomy'||k==='organloc')(_bdAcc[s]=_bdAcc[s]||{}).key=String(v).trim().toLowerCase();
    else if(k==='bodyx'){const n=parseFloat(v);if(!isNaN(n))(_bdAcc[s]=_bdAcc[s]||{}).bx=n;}
    else if(k==='bodyy'){const n=parseFloat(v);if(!isNaN(n))(_bdAcc[s]=_bdAcc[s]||{}).by=n;}});
  const _bdNodes=[];Object.entries(_bdAcc).forEach(([id,v])=>{if(v.key||(typeof v.bx==='number'&&typeof v.by==='number'))_bdNodes.push({id,key:v.key||null,bx:(typeof v.bx==='number'?v.bx:null),by:(typeof v.by==='number'?v.by:null)});});
  R.body={nodes:_bdNodes};R.hasBody=_bdNodes.length>0;
  _ph&&_ph('Body aggregated',R.hasBody?_bdNodes.length+' anatomy-anchored nodes':'none');
  return R;}

const O=(typeof window!=='undefined'&&window.__oaPrePO&&Array.isArray(window.__oaPrePO.cls))?window.__oaPrePO:(FMT==='ttl'?parseTTL(RAW):parseXML(RAW));window.O=O;

const canvas=document.createElement('canvas');document.body.appendChild(canvas);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
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
const nodeMeshById=new Map();
function getNodeMesh(id){return nodeMeshById.get(id)||null;}

const NODE_LABEL_LIMIT=2500,IMPORTANT_NODE_LABEL_LIMIT=260,EDGE_LABEL_LIMIT=3000,EDGE_HEAD_LIMIT=12000,DENSE_EDGE_BATCH_LIMIT=12000,SOURCE_RENDER_LINE_LIMIT=5000;
const graphNodeCount=O.cls.length+O.ind.length;
const renderAllNodeLabels=graphNodeCount<=NODE_LABEL_LIMIT;
const importantNodeLabels=new Set(O.cls.map(c=>c.id));
const nodeDegree={};
function bumpNodeDegree(id,n){if(!id)return;nodeDegree[id]=(nodeDegree[id]||0)+(n||1);}
O.sub.forEach(([a,b])=>{bumpNodeDegree(a);bumpNodeDegree(b);});
O.typ.forEach(([a,b])=>{bumpNodeDegree(a);bumpNodeDegree(b);});
O.rel.forEach(r=>{bumpNodeDegree(r.s);bumpNodeDegree(r.o);});
O.dom.forEach(d=>bumpNodeDegree(d.c));O.rng.forEach(r=>bumpNodeDegree(r.c));
if(!renderAllNodeLabels){
  Object.entries(nodeDegree).sort((a,b)=>b[1]-a[1]).slice(0,IMPORTANT_NODE_LABEL_LIMIT).forEach(([id])=>importantNodeLabels.add(id));
}
function shouldRenderNodeLabel(id,type){return renderAllNodeLabels||type==='Class'||importantNodeLabels.has(id);}
let renderEdgeLabels=true;
function shouldRenderEdgeLabel(){return renderEdgeLabels;}
let renderArrowHeads=true;
function shouldRenderArrowHead(){return renderArrowHeads;}
let denseEdgeMode=false,denseEdgeItems=[],denseEdgeBatches=[];
function logicalEdgeCount(){return denseEdgeMode?denseEdgeItems.length:(edgeObjs.length+arrowObjs.length);}
let textScale=1.0;const REF_DIST=55;

// Shared hierarchy depth: classes via subClassOf chain; individuals inherit their
// deepest typed class's depth so MAP/GLOBE/HIER all tier them consistently.
function _computeHierDepth(){
  const cdepth={};
  function getCD(id,visited){if(cdepth[id]!==undefined)return cdepth[id];if(visited.has(id))return 0;visited.add(id);
    const parents=O.sub.filter(s=>s[0]===id).map(s=>s[1]);let d=0;parents.forEach(p=>{d=Math.max(d,getCD(p,new Set(visited))+1);});cdepth[id]=d;return d;}
  O.cls.forEach(c=>getCD(c.id,new Set()));
  let maxCD=0;Object.values(cdepth).forEach(d=>{if(d>maxCD)maxCD=d;});
  const idepth={};
  O.ind.forEach(i=>{const types=O.typ.filter(t=>t[0]===i.id).map(t=>t[1]);
    let best=-1;types.forEach(t=>{if(cdepth[t]!==undefined&&cdepth[t]>best)best=cdepth[t];});
    idepth[i.id]=best>=0?best:maxCD;});
  return {cdepth,idepth,maxCD};
}
function hierLayout(){
  const {cdepth,idepth,maxCD}=_computeHierDepth();
  const depth=Object.assign({},cdepth);O.ind.forEach(i=>{depth[i.id]=idepth[i.id];});
  const maxD=maxCD;
  const layers={};
  O.cls.forEach(c=>{const d=depth[c.id]||0;(layers[d]=layers[d]||[]).push(c.id);});
  // Individuals tier by their primary typed class's depth (not a single bottom layer).
  O.ind.forEach(i=>{const d=idepth[i.id];(layers[d]=layers[d]||[]).push(i.id);});
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
  // Individuals already placed by the per-depth loop above (sharing the tier of their primary typed class).
  // Push them to the outer ring of their tier so classes (hub-biased) sit closer to center.
  O.ind.forEach(i=>{const id=i.id;const d=idepth[id];const np=nodeMap[id];if(!np)return;
    const a=angPos[id];const baseR=R*(1-d*0.1);const outR=baseR*1.05;
    np.x=Math.cos(a)*outR;np.z=Math.sin(a)*outR;np.y=yTop-d*yStep-yStep*0.18;});}
hierLayout();updateFloor();

const labelTextureCache=new Map();
function makeLabel(text,size,subtitle){size=size||1.6;
  // Canvas height grows with line count so each line keeps the same px-per-world ratio as a single-line label.
  const lines=subtitle?2:1;
  let l=text;if(l.length>24)l=l.substring(0,22)+'...';
  let sub='';if(subtitle){sub=subtitle;if(sub.length>28)sub=sub.substring(0,26)+'...';}
  const key=size+'|'+l+'|'+sub;
  let cached=labelTextureCache.get(key);
  if(!cached){
    const W=1280,H=160*lines;
    const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
    x.textAlign='center';x.textBaseline='middle';
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
    cached={texture:new THREE.CanvasTexture(c),baseScale:size*lines,aspect:W/H};
    labelTextureCache.set(key,cached);
  }
  const m=new THREE.SpriteMaterial({map:cached.texture,transparent:true,depthWrite:false});
  const s=new THREE.Sprite(m);s.userData.baseScale=cached.baseScale;s.userData.aspect=cached.aspect;s.scale.set(cached.baseScale*cached.aspect,cached.baseScale,1);allLabels.push(s);return s;}

function makeNode(id,type,x,y,z,label,uri){const geo=type==='Class'?GEO.Class:GEO.Individual;
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}));
  mesh.position.set(x,y,z);mesh.userData={id,type,label:label||id,uri:uri||'',radius:type==='Class'?CLS_R:IND_R};
  const outPts=circleOutlinePts(type==='Class'?CLS_R:IND_R);
  mesh.add(outlineLine(outPts,type==='Class',0x333333));
  if(shouldRenderNodeLabel(id,type)){
    const baseId=label||id;
    const rdfsLabel=O.labels&&O.labels[id];
    const _norm=s=>String(s||'').replace(/\s+/g,'').toLowerCase();
    const sameAfterStrip=rdfsLabel&&_norm(rdfsLabel)===_norm(baseId);
    const lbl=(rdfsLabel&&!sameAfterStrip)?makeLabel(rdfsLabel,1.4,baseId):makeLabel(rdfsLabel||baseId,1.4);
    lbl.position.set(0,0,0.1);mesh.add(lbl);
  }
  scene.add(mesh);nodeMeshes.push(mesh);nodeMeshById.set(id,mesh);return mesh;}

// Chunked async builder — defers heavy mesh + edge creation so the loading modal can update.
// State exposed via window.__oaBuild = {phase, done, total, complete}; polled by dev.html.
window.__oaBuild={phase:'pending',done:0,total:0,complete:false};
async function _oaChunkedBuild(){
  const nodeItems=[];
  O.cls.forEach(c=>{const p=nodeMap[c.id];if(p)nodeItems.push(['Class',c,p]);});
  O.ind.forEach(c=>{const p=nodeMap[c.id];if(p)nodeItems.push(['Individual',c,p]);});
  window.__oaBuild={phase:'nodes',done:0,total:nodeItems.length,complete:false};
  const CHUNK=400;
  for(let i=0;i<nodeItems.length;){
    const end=Math.min(i+CHUNK,nodeItems.length);
    for(let j=i;j<end;j++){const it=nodeItems[j];makeNode(it[1].id,it[0],it[2].x,it[2].y,it[2].z,it[1].id,it[1].uri);}
    i=end;window.__oaBuild.done=end;
    if(i<nodeItems.length)await new Promise(r=>setTimeout(r,0));
  }
  // Edges next — _pairCount has been populated synchronously by code below.
  const eItems=[];
  O.sub.forEach(([c,p])=>eItems.push(['sub',c,p]));
  O.typ.forEach(([id,c])=>eItems.push(['typ',id,c]));
  O.op.forEach(op=>{const doms=O.dom.filter(d=>d.p===op.id).map(d=>d.c),rngs=O.rng.filter(r=>r.p===op.id).map(r=>r.c);
    doms.forEach(d=>rngs.forEach(r=>eItems.push(['op',d,r,op.id])));});
  O.rel.forEach(rel=>eItems.push(['rel',rel.s,rel.o,rel.p]));
  renderEdgeLabels=eItems.length<=EDGE_LABEL_LIMIT;
  renderArrowHeads=eItems.length<=EDGE_HEAD_LIMIT;
  denseEdgeMode=eItems.length>DENSE_EDGE_BATCH_LIMIT;
  denseEdgeItems=denseEdgeMode?eItems.slice():[];
  const edgeNotes=[];if(denseEdgeMode)edgeNotes.push('edges batched');if(!renderEdgeLabels)edgeNotes.push('edge labels deferred');if(!renderArrowHeads)edgeNotes.push('arrowheads deferred');
  window.__oaBuild={phase:'edges',done:0,total:eItems.length,complete:false,note:edgeNotes.join(' · ')};
  if(denseEdgeMode){
    await buildDenseEdgeBatches(eItems,1200);
    window.__oaBuild={phase:'done',done:eItems.length,total:eItems.length,complete:true,note:edgeNotes.join(' · ')};
    return;
  }
  const EDGE_CHUNK=renderArrowHeads?CHUNK:1200;
  for(let i=0;i<eItems.length;){
    const end=Math.min(i+EDGE_CHUNK,eItems.length);
    for(let j=i;j<end;j++){const e=eItems[j];
      if(e[0]==='sub')makeArrow(e[1],e[2],'subClassOf',0x333333,true,true);
      else if(e[0]==='typ')addLine(e[1],e[2],'a',0xaaaaaa,true);
      else if(e[0]==='op')makeArrow(e[1],e[2],e[3],0x555555,false,true);
      else if(e[0]==='rel')makeArrow(e[1],e[2],e[3],0x222222,false,false);
    }
    i=end;window.__oaBuild.done=end;
    if(i<eItems.length)await new Promise(r=>setTimeout(r,0));
  }
  window.__oaBuild={phase:'done',done:eItems.length,total:eItems.length,complete:true,note:edgeNotes.join(' · ')};
}
// _oaChunkedBuild() is invoked AFTER _pairCount/_pairAssign are populated below,
// otherwise the edge phase hits a TDZ ReferenceError on _pairCount inside makeArrow.

function addLine(srcId,tgtId,label,color,dashed){
  const sm=getNodeMesh(srcId),tm=getNodeMesh(tgtId);if(!sm||!tm)return;
  const geo=new THREE.BufferGeometry().setFromPoints([sm.position.clone(),tm.position.clone()]);
  const mat=dashed?new THREE.LineDashedMaterial({color:color||0xbbbbbb,dashSize:0.4,gapSize:0.3}):new THREE.LineBasicMaterial({color:color||0xbbbbbb});
  const line=new THREE.Line(geo,mat);line.userData={srcId,tgtId,label,dashed:!!dashed,origColor:color||0xbbbbbb};
  if(dashed)line.computeLineDistances();
  scene.add(line);edgeObjs.push(line);
  if(label&&shouldRenderEdgeLabel()){const mid=sm.position.clone().add(tm.position).multiplyScalar(.5);const lbl=makeLabel(label,1.4);lbl.position.copy(mid);scene.add(lbl);line.userData.labelSprite=lbl;}
  return line;}

function denseEdgeLabel(e){return e[0]==='sub'?'subClassOf':e[0]==='typ'?'a':e[3];}
function denseEdgeColor(e){return e[0]==='sub'?0x333333:e[0]==='typ'?0xaaaaaa:e[0]==='op'?0x555555:0x222222;}
function denseEdgeEndpoints(e){return[e[1],e[2]];}
function denseSegment(srcId,tgtId){
  const sm=getNodeMesh(srcId),tm=getNodeMesh(tgtId);if(!sm||!tm)return null;
  const edge=new THREE.Vector3().subVectors(tm.position,sm.position);const len=edge.length();if(len<0.01)return null;
  edge.normalize();
  const sR=sm.userData.radius||1.4,tR=tm.userData.radius||1.4;
  const src=sm.position.clone().addScaledVector(edge,sR);
  const tgt=tm.position.clone().addScaledVector(edge,-tR);
  return[src,tgt];
}
function fillDenseBatch(batch){
  const pos=batch.positions;let off=0;
  batch.items.forEach(e=>{
    const [srcId,tgtId]=denseEdgeEndpoints(e),seg=denseSegment(srcId,tgtId);
    if(seg){const[s,t]=seg;pos[off++]=s.x;pos[off++]=s.y;pos[off++]=s.z;pos[off++]=t.x;pos[off++]=t.y;pos[off++]=t.z;}
    else{for(let k=0;k<6;k++)pos[off++]=0;}
  });
  if(batch.geometry&&batch.geometry.attributes.position)batch.geometry.attributes.position.needsUpdate=true;
}
async function buildDenseEdgeBatches(eItems,chunk){
  denseEdgeBatches.forEach(b=>{scene.remove(b.line);b.geometry.dispose();b.material.dispose();});
  denseEdgeBatches.length=0;
  const groups=new Map();
  for(let i=0;i<eItems.length;){
    const end=Math.min(i+chunk,eItems.length);
    for(let j=i;j<end;j++){
      const e=eItems[j],label=denseEdgeLabel(e),color=denseEdgeColor(e),key=label+'|'+color;
      let g=groups.get(key);if(!g){g={label,color,items:[]};groups.set(key,g);}
      g.items.push(e);
    }
    i=end;window.__oaBuild.done=end;
    if(i<eItems.length)await new Promise(r=>setTimeout(r,0));
  }
  groups.forEach(g=>{
    const positions=new Float32Array(g.items.length*6);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const material=new THREE.LineBasicMaterial({color:g.color,transparent:true,opacity:0.58});
    const line=new THREE.LineSegments(geometry,material);line.userData={label:g.label,dense:true,origColor:g.color};
    const batch={label:g.label,color:g.color,items:g.items,positions,geometry,material,line};
    fillDenseBatch(batch);scene.add(line);denseEdgeBatches.push(batch);
  });
}
function refreshDenseEdgeBatches(){denseEdgeBatches.forEach(fillDenseBatch);}

const HEAD_SIZE=1.1;
function paintArrowHead(ctx,color,hollow,N){
  const cx=N/2,cy=N/2,w=N*0.72,h=N*0.62;
  const tipX=cx+2*w/3,baseX=cx-w/3,upY=cy-h/2,dnY=cy+h/2;
  const hex='#'+color.toString(16).padStart(6,'0');
  ctx.clearRect(0,0,N,N);
  ctx.beginPath();ctx.moveTo(tipX,cy);ctx.lineTo(baseX,upY);ctx.lineTo(baseX,dnY);ctx.closePath();
  if(hollow){ctx.fillStyle='#ffffff';ctx.fill();ctx.strokeStyle=hex;ctx.lineWidth=N*0.08;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}
  else{ctx.fillStyle=hex;ctx.fill();}}
const arrowHeadTextureCache=new Map();
function arrowHeadTexture(color,hollow){
  const N=128,key=(color||0x555555)+'|'+(hollow?1:0);
  let tex=arrowHeadTextureCache.get(key);if(tex)return tex;
  const c=document.createElement('canvas');c.width=N;c.height=N;
  paintArrowHead(c.getContext('2d'),color,hollow,N);
  tex=new THREE.CanvasTexture(c);arrowHeadTextureCache.set(key,tex);return tex;
}
function arrowHeadSprite(color,hollow){
  const N=128,tex=arrowHeadTexture(color,hollow);
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});
  const s=new THREE.Sprite(mat);s.scale.set(HEAD_SIZE,HEAD_SIZE,1);
  s.userData.headSize=HEAD_SIZE;s.userData.tipFrac=(N*0.72*2/3)/N;
  s.userData.hollow=!!hollow;s.userData.color=color;return s;}
function repaintHead(sprite,color){if(!sprite)return;const tex=arrowHeadTexture(color,sprite.userData.hollow);if(sprite.material.map!==tex){sprite.material.map=tex;sprite.material.needsUpdate=true;}sprite.userData.color=color;}

function makeArrow(srcId,tgtId,label,color,hollow,dashed){
  if(srcId===tgtId)return makeLoop(srcId,label,color,hollow,dashed);
  const sm=getNodeMesh(srcId),tm=getNodeMesh(tgtId);if(!sm||!tm)return;
  const col=color||0x555555;
  const offset=_pairOffset(srcId,tgtId);
  const geo=new THREE.BufferGeometry().setFromPoints([sm.position.clone(),tm.position.clone()]);
  const mat=dashed?new THREE.LineDashedMaterial({color:col,dashSize:0.4,gapSize:0.28}):new THREE.LineBasicMaterial({color:col});
  const line=new THREE.Line(geo,mat);if(dashed)line.computeLineDistances();
  scene.add(line);
  const head=shouldRenderArrowHead()?arrowHeadSprite(col,hollow):null;if(head)scene.add(head);
  const obj={line,head,srcId,tgtId,label,type:'arrow2d',visible:true,headSize:head?head.userData.headSize:0,dashed:!!dashed,origColor:col,offset,origOffset:offset};
  arrowObjs.push(obj);
  if(label&&shouldRenderEdgeLabel()){const mid=sm.position.clone().add(tm.position).multiplyScalar(.5);const lbl=makeLabel(label,1.4);lbl.position.copy(mid);scene.add(lbl);obj.labelSprite=lbl;}
  updateArrow(obj);return obj;}

function updateArrow(a){
  if(a.isLoop)return;
  const sm=getNodeMesh(a.srcId),tm=getNodeMesh(a.tgtId);if(!sm||!tm)return;
  const edge=new THREE.Vector3().subVectors(tm.position,sm.position);const len=edge.length();if(len<0.01)return;
  edge.normalize();
  const sR=sm.userData.radius||1.4,tR=tm.userData.radius||1.4;
  const srcPt=sm.position.clone().addScaledVector(edge,sR);
  const hs=a.headSize||0;const tipOff=a.head?(a.head.userData.tipFrac||0.48):0;
  const headCenter=tm.position.clone().addScaledVector(edge,-(tR+hs*tipOff));
  if(!a.offset){
    const pos=a.line.geometry.attributes.position;
    if(pos.count===2){pos.setXYZ(0,srcPt.x,srcPt.y,srcPt.z);pos.setXYZ(1,headCenter.x,headCenter.y,headCenter.z);pos.needsUpdate=true;}
    else{a.line.geometry.dispose();a.line.geometry=new THREE.BufferGeometry().setFromPoints([srcPt,headCenter]);}
    if(a.dashed)a.line.computeLineDistances();
    if(a.head)a.head.position.copy(headCenter);
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
    if(a.head)a.head.position.copy(headCenter);
    if(a.labelSprite)a.labelSprite.position.copy(curve.getPoint(0.5));
    a._tangent=curve.getTangentAt(1).normalize();
    a._cpWorld=cp;
    a._endPt=headCenter.clone();
  }
  updateArrowRot(a);}

function updateArrowRot(a){
  if(a.isLoop)return;
  if(!a.head)return;
  if(a.offset&&a._cpWorld){
    const endWorld=a._endPt||(()=>{const tm=getNodeMesh(a.tgtId);return tm?tm.position:null;})();
    if(!endWorld)return;
    const t=endWorld.clone().project(camera);const c=a._cpWorld.clone().project(camera);
    a.head.material.rotation=Math.atan2(t.y-c.y,t.x-c.x);return;
  }
  const sm=getNodeMesh(a.srcId),tm=getNodeMesh(a.tgtId);if(!sm||!tm)return;
  const s=sm.position.clone().project(camera),t=tm.position.clone().project(camera);
  a.head.material.rotation=Math.atan2(t.y-s.y,t.x-s.x);}

function makeLoop(nodeId,label,color,hollow,dashed){
  const m=getNodeMesh(nodeId);if(!m)return;
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
  const head=shouldRenderArrowHead()?arrowHeadSprite(col,hollow):null;
  const hs=head?head.userData.headSize:0,tipFrac=head?(head.userData.tipFrac||0.48):0;
  const endPt=pts[pts.length-1];const tangent=curve.getTangent(1.0).normalize();
  if(head){head.position.set(endPt.x-tangent.x*hs*tipFrac,endPt.y-tangent.y*hs*tipFrac,endPt.z);
  head.material.rotation=Math.atan2(tangent.y,tangent.x);
  m.add(head);}
  const obj={line,head,srcId:nodeId,tgtId:nodeId,label,type:'loop',isLoop:true,visible:true,headSize:hs,origColor:col,dashed:!!dashed};
  if(label&&shouldRenderEdgeLabel()){const mid=curve.getPoint(0.5);const lbl=makeLabel(label,1.4);lbl.position.set(mid.x+0.2,mid.y,0.01);m.add(lbl);obj.labelSprite=lbl;}
  arrowObjs.push(obj);return obj;}

const _pairCount={},_pairAssign={};
function _pkey(a,b){return a<b?a+'|'+b:b+'|'+a;}
function _countPair(a,b){const k=_pkey(a,b);_pairCount[k]=(_pairCount[k]||0)+1;}
O.sub.forEach(([c,p])=>_countPair(c,p));
O.op.forEach(op=>{const doms=O.dom.filter(d=>d.p===op.id).map(d=>d.c),rngs=O.rng.filter(r=>r.p===op.id).map(r=>r.c);doms.forEach(d=>rngs.forEach(r=>_countPair(d,r)));});
O.rel.forEach(rel=>_countPair(rel.s,rel.o));
// _pairCount is now fully populated; safe to start the chunked builder.
_oaChunkedBuild().catch(err=>{
  const prev=window.__oaBuild||{};
  window.__oaBuild={phase:'error',done:prev.done||0,total:prev.total||0,complete:false,error:(err&&err.message)||String(err)};
  console.error(err);
});
function _pairOffset(a,b){const k=_pkey(a,b);const n=_pairCount[k]||1;if(n<=1)return 0;
  const i=(_pairAssign[k]=(_pairAssign[k]||0)+1)-1;
  return (i-(n-1)/2)*0.7;}

// Edge creation moved into _oaChunkedBuild() above for chunked progress reporting.

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
  const sm=getNodeMesh(nodeId);if(!sm||!texts.length)return;
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
let selectedRoot=null,selectedLine=null,handHoverRoot=null,isolatedRoot=null,isolationDepth=1;const selectedSet=new Set();
function _isolationConnected(rootId,depth){
  depth=(depth==null)?isolationDepth:Math.max(0,depth|0);
  const set=new Set([rootId]);if(depth===0)return set;
  let frontier=new Set([rootId]);
  for(let d=0;d<depth;d++){
    const next=new Set();
    edgeObjs.forEach(l=>{const s=l.userData.srcId,t=l.userData.tgtId;
      if(frontier.has(s)&&!set.has(t)){next.add(t);set.add(t);}
      else if(frontier.has(t)&&!set.has(s)){next.add(s);set.add(s);}});
    arrowObjs.forEach(a=>{
      if(frontier.has(a.srcId)&&!set.has(a.tgtId)){next.add(a.tgtId);set.add(a.tgtId);}
      else if(frontier.has(a.tgtId)&&!set.has(a.srcId)){next.add(a.srcId);set.add(a.srcId);}});
    if(next.size===0)break;
    frontier=next;
  }
  return set;}
// Toggle the dashed leader, surface pin, and orbital trail that tether a node to the map/grid
// floor. Called whenever node visibility changes (isolation, search) so the leftover stub
// lines don't dangle when the node itself is hidden.
function _setNodeAttachVisibility(id,v){
  if(mapView&&mapView.leaders){const ld=mapView.leaders[id];if(ld)ld.visible=v;}
  if(mapView&&mapView.pins){const p=mapView.pins[id];if(p&&p.mesh)p.mesh.visible=v;}
  if(typeof orbitState!=='undefined'&&orbitState.trails){const t=orbitState.trails[id];if(t&&t.line)t.line.visible=v;}
}
function applyIsolation(){
  if(!isolatedRoot){
    nodeMeshes.forEach(m=>{m.visible=true;_setNodeAttachVisibility(m.userData.id,true);});
    edgeObjs.forEach(l=>{l.visible=true;if(l.userData.labelSprite)l.userData.labelSprite.visible=true;});
    arrowObjs.forEach(a=>{if(a.line)a.line.visible=true;if(a.head)a.head.visible=true;if(a.labelSprite)a.labelSprite.visible=true;});
    if(typeof calloutObjs!=='undefined')calloutObjs.forEach(o=>{if(o.leader)o.leader.visible=dpVisible;if(o.label)o.label.visible=dpVisible;});
    _updateDepthDial();return;
  }
  const c=_isolationConnected(isolatedRoot,isolationDepth);
  nodeMeshes.forEach(m=>{const v=c.has(m.userData.id);m.visible=v;_setNodeAttachVisibility(m.userData.id,v);});
  edgeObjs.forEach(l=>{const v=c.has(l.userData.srcId)&&c.has(l.userData.tgtId);l.visible=v;if(l.userData.labelSprite)l.userData.labelSprite.visible=v;});
  arrowObjs.forEach(a=>{const v=c.has(a.srcId)&&c.has(a.tgtId);if(a.line)a.line.visible=v;if(a.head)a.head.visible=v;if(a.labelSprite)a.labelSprite.visible=v;});
  if(typeof calloutObjs!=='undefined')calloutObjs.forEach(o=>{const v=c.has(o.nodeId)&&dpVisible;if(o.leader)o.leader.visible=v;if(o.label)o.label.visible=v;});
  _updateDepthDial();
}
const MAX_NEIGHBORHOOD_DEPTH=5;
// Dial is a 5-stop arc, with depth 1 at +30° (1 o'clock) and depth 5 at -30° (11 o'clock),
// stepping 15° per level so the needle sweeps left as the BFS depth grows.
function _depthAngleDeg(d){return 30-(Math.max(1,Math.min(MAX_NEIGHBORHOOD_DEPTH,d))-1)*15;}
(function _renderDepthTicks(){
  const g=document.getElementById('depth-ticks');if(!g)return;
  const r=33;let html='';
  for(let d=1;d<=MAX_NEIGHBORHOOD_DEPTH;d++){
    const a=_depthAngleDeg(d)*Math.PI/180;
    const x=r*Math.sin(a),y=-r*Math.cos(a);
    html+=`<text x='${x.toFixed(2)}' y='${y.toFixed(2)}'>${d}</text>`;
  }
  g.innerHTML=html;
})();
function _updateDepthDial(){
  const dial=document.getElementById('depth-dial');if(!dial)return;
  if(!isolatedRoot){dial.classList.remove('active');return;}
  dial.classList.add('active');
  const visD=Math.min(Math.max(isolationDepth,1),MAX_NEIGHBORHOOD_DEPTH);
  const num=document.getElementById('depth-num');
  if(num)num.textContent=String(visD);
  const needle=document.getElementById('depth-needle');
  if(needle)needle.setAttribute('transform','rotate('+_depthAngleDeg(visD).toFixed(2)+')');
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
  if(a.head&&a._headCol!==tgt){repaintHead(a.head,tgt);a._headCol=tgt;}});}
function updateSelection(){
  selectedSet.clear();
  if(selectedRoot){
    selectedSet.add(selectedRoot);
    if(denseEdgeMode){
      O.sub.forEach(([s,t])=>{if(s===selectedRoot)selectedSet.add(t);else if(t===selectedRoot)selectedSet.add(s);});
      O.typ.forEach(([s,t])=>{if(s===selectedRoot)selectedSet.add(t);else if(t===selectedRoot)selectedSet.add(s);});
      O.rel.forEach(r=>{if(r.s===selectedRoot)selectedSet.add(r.o);else if(r.o===selectedRoot)selectedSet.add(r.s);});
    }else{
      edgeObjs.forEach(l=>{if(l.userData.srcId===selectedRoot)selectedSet.add(l.userData.tgtId);else if(l.userData.tgtId===selectedRoot)selectedSet.add(l.userData.srcId);});
      arrowObjs.forEach(a=>{if(a.srcId===selectedRoot)selectedSet.add(a.tgtId);else if(a.tgtId===selectedRoot)selectedSet.add(a.srcId);});
    }
  }else if(selectedLine){
    const[s,t]=edgeEndpoints(selectedLine);selectedSet.add(s);selectedSet.add(t);
  }
  refreshArrowHeads();highlightSource();
  selectionDirty=true;
}

const nodeToLines={};
function populateSource(){
  const body=document.getElementById('src-body');if(!body)return;
  body.innerHTML='';
  const lines=RAW.split('\n');
  const nodeIdSet=new Set([...O.cls.map(n=>n.id),...O.ind.map(n=>n.id)]);
  const opIdSet=new Set(O.op.map(n=>n.id));
  const dpIdSet=new Set(O.dp.map(n=>n.id));
  const maxLines=Math.min(lines.length,SOURCE_RENDER_LINE_LIMIT);
  if(lines.length>maxLines){
    const note=document.createElement('div');note.className='src-line';
    const code=document.createElement('span');code.className='src-code';code.textContent=`Source preview limited to ${maxLines.toLocaleString()} / ${lines.length.toLocaleString()} lines for large-file performance.`;
    note.appendChild(code);body.appendChild(note);
  }
  const frag=document.createDocumentFragment();
  for(let idx=0;idx<maxLines;idx++){
    const line=lines[idx];
    const mentioned=[],seen=new Set();
    String(line).replace(/[A-Za-z_][A-Za-z0-9_-]*/g,tok=>{
      if(seen.has(tok))return tok;seen.add(tok);
      const kind=nodeIdSet.has(tok)?'node':opIdSet.has(tok)?'op':dpIdSet.has(tok)?'dp':'';
      if(kind){mentioned.push({id:tok,kind});if(kind==='node')(nodeToLines[tok]=nodeToLines[tok]||[]).push(idx);}
      return tok;
    });
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
    frag.appendChild(div);
  }
  body.appendChild(frag);
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
  if(mapView.active)_updateMapLeader(id);
  if(denseEdgeMode){refreshDenseEdgeBatches();return;}
  edgeObjs.forEach(l=>{if(l.userData.srcId===id||l.userData.tgtId===id){
    const s=getNodeMesh(l.userData.srcId),t=getNodeMesh(l.userData.tgtId);
    if(s&&t){const pos=l.geometry.attributes.position;pos.setXYZ(0,s.position.x,s.position.y,s.position.z);pos.setXYZ(1,t.position.x,t.position.y,t.position.z);pos.needsUpdate=true;
      if(l.userData.dashed)l.computeLineDistances();
      if(l.userData.labelSprite)l.userData.labelSprite.position.copy(s.position.clone().add(t.position).multiplyScalar(.5));}}});
  arrowObjs.forEach(a=>{if(a.srcId===id||a.tgtId===id)updateArrow(a);});
  // In 2D mode, re-evaluate curvature on all arrows — moving a node can both create new obstructions and clear old ones.
  const b2=document.getElementById('b2');if(b2&&b2.classList.contains('active'))bendEdgesToAvoid();
}

function logicalConnectionsFor(id){
  if(!denseEdgeMode){
    const cE=edgeObjs.filter(e2=>e2.userData.srcId===id||e2.userData.tgtId===id).map(e2=>({s:e2.userData.srcId,t:e2.userData.tgtId,l:e2.userData.label}));
    const cA=arrowObjs.filter(a=>a.srcId===id||a.tgtId===id).map(a=>({s:a.srcId,t:a.tgtId,l:a.label}));
    return[...cE,...cA];
  }
  const out=[];
  O.sub.forEach(([s,t])=>{if(s===id||t===id)out.push({s,t,l:'subClassOf'});});
  O.typ.forEach(([s,t])=>{if(s===id||t===id)out.push({s,t,l:'a'});});
  O.rel.forEach(r=>{if(r.s===id||r.o===id)out.push({s:r.s,t:r.o,l:r.p});});
  return out;
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
    const tcEl=document.getElementById('ttc');if(tcEl)tcEl.textContent=O.comments[d.id]||'';
    const conns=logicalConnectionsFor(d.id);
    const _esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const connRows=conns.map(c=>{const o=c.s===d.id?c.t:c.s;return _esc((c.l||'?')+' \u2192 '+o);});
    const dpC=(dpByClass[d.id]||[]).map(dp=>_esc(dp.name+(dp.range?' : '+dp.range:'')));
    // imageUrl은 별도 thumbnail로 보여주고, DP row에는 표시하지 않음 (중복 회피)
    const allDpI=dpByIndiv[d.id]||[];
    const imgUrls=allDpI.filter(dp=>/^imageurl$/i.test(dp.name)||/^image$/i.test(dp.name)||/^thumbnail$/i.test(dp.name)).map(dp=>dp.value);
    const dpI=allDpI.filter(dp=>!/^(imageurl|image|thumbnail)$/i.test(dp.name)).map(dp=>_esc(dp.name+' = "'+dp.value+'"'));
    const lbl=O.labels[d.id]||'';
    const lblBar=lbl?`<div class='dp-titlebar'>rdfs:label = "${_esc(lbl)}"</div>`:'';
    const dpRowsHTML=[...dpC,...dpI].map(r=>`<div class='dp-row'>${r}</div>`).join('');
    const dpBlock=(lblBar||dpRowsHTML)?`<div class='dp-table'>${lblBar}${dpRowsHTML}</div>`:'';
    // Scene thumbnail (위성 촬영 영상 등): ex:imageUrl을 보유한 인디비주얼은 tooltip에 thumbnail 표시
    const imgHTML=imgUrls.length?`<div style='margin-top:8px;text-align:center'><img src='${_esc(imgUrls[0])}' style='max-width:300px;max-height:220px;border-radius:6px;border:1px solid #ddd;box-shadow:0 2px 6px rgba(0,0,0,.08)' loading='lazy' onerror="this.style.display='none'"><div style='font-size:10px;color:#999;margin-top:4px'>📷 ${_esc(imgUrls[0].split('/').pop())}</div></div>`:'';
    const connHTML=connRows.join('<br>');
    document.getElementById('ttp').innerHTML=(connHTML+dpBlock+imgHTML)||'No connections';
    if(hovered&&hovered!==hits[0].object)hovered.material.color.setHex(0xffffff);
    hovered=hits[0].object;hovered.material.color.setHex(0xf0f0f0);
  }else{if(hovered)hovered.material.color.setHex(0xffffff);hovered=null;tt.style.display='none';}});

document.getElementById('search').addEventListener('input',e=>{const q=e.target.value.toLowerCase();
  nodeMeshes.forEach(m=>{const v=!q||m.userData.label.toLowerCase().includes(q)||m.userData.id.toLowerCase().includes(q);m.visible=v;_setNodeAttachVisibility(m.userData.id,v);});
  edgeObjs.forEach(l=>{const sv=getNodeMesh(l.userData.srcId)?.visible;
    const tv=getNodeMesh(l.userData.tgtId)?.visible;l.visible=!q||(sv&&tv);
    if(l.userData.labelSprite)l.userData.labelSprite.visible=l.visible;});
  arrowObjs.forEach(a=>{const sv=getNodeMesh(a.srcId)?.visible;
    const tv=getNodeMesh(a.tgtId)?.visible;const vis=!q||(sv&&tv);
    a.visible=vis;a.line.visible=vis;if(a.head)a.head.visible=vis;if(a.labelSprite)a.labelSprite.visible=vis;});});

const _tmpV=new THREE.Vector3();
function updateLabelScales(){const cp=camera.position;allLabels.forEach(l=>{l.getWorldPosition(_tmpV);const d=cp.distanceTo(_tmpV);const bs=l.userData.baseScale*(d/REF_DIST)*textScale;const ar=l.userData.aspect||8;l.scale.set(bs*ar,bs,1);});}
const HI_COL=new THREE.Color(0x3a7bd5),BASE_ECOL=new THREE.Color();
const YEL_COL=new THREE.Color(0xf5b800);
let selectionDirty=false;
function selectionPulse(){
  const active=!!(selectedRoot||selectedLine);const t=performance.now()/1000,pulse=0.5+0.5*Math.sin(t*2.5),hoverPulse=0.5+0.5*Math.sin(t*4);
  const needNodePass=active||handHoverRoot||selectionDirty;
  if(needNodePass)nodeMeshes.forEach(m=>{if(m===hovered)return;
      const id=m.userData.id;
      if(active&&id===selectedRoot){const s=0.15+0.22*pulse;m.material.color.setRGB(1,1-s*0.25,1-s*0.85);}
      else if(active&&selectedSet.has(id)){const s=0.05+0.10*pulse;m.material.color.setRGB(1-s*0.7,1-s*0.3,1);}
      else if(id===handHoverRoot){const s=0.12+0.22*hoverPulse;m.material.color.setRGB(1-s*0.17,1-s*0.61,1-s*0.09);}
      else m.material.color.setHex(0xffffff);});
  if(!active){selectionDirty=false;return;}
  const blend=0.35+0.35*pulse;
  edgeObjs.forEach(l=>{const orig=l.userData.origColor||0xbbbbbb;BASE_ECOL.setHex(orig);
    if(l===selectedLine)l.material.color.copy(BASE_ECOL).lerp(YEL_COL,blend);
    else if(selectedRoot&&(l.userData.srcId===selectedRoot||l.userData.tgtId===selectedRoot))l.material.color.copy(BASE_ECOL).lerp(HI_COL,blend);
    else l.material.color.setHex(orig);});
  arrowObjs.forEach(a=>{const orig=a.origColor||0x555555;BASE_ECOL.setHex(orig);
    if(a===selectedLine)a.line.material.color.copy(BASE_ECOL).lerp(YEL_COL,blend);
    else if(selectedRoot&&(a.srcId===selectedRoot||a.tgtId===selectedRoot))a.line.material.color.copy(BASE_ECOL).lerp(HI_COL,blend);
    else a.line.material.color.setHex(orig);});
  selectionDirty=false;}
// Hoisted state for map/orbit modules so the animate loop (which calls _orbitTick) doesn't hit TDZ on first frame.
let mapView={active:false,group:null,ctx:null,leaders:{},pins:{}};
let orbitState={satrecs:{},trails:{},lastTick:0,tickInterval:1000};
const TRAIL_MAX=60;
// Populate sidebar edge filter checkboxes (one per distinct predicate label). Generic — works for any ontology.
function populateEdgeFilter(){
  const panel=document.getElementById('edge-filter-panel');if(!panel)return;
  const labels=new Set();
  edgeObjs.forEach(e=>{if(e.userData&&e.userData.label)labels.add(e.userData.label);});
  arrowObjs.forEach(a=>{if(a.label)labels.add(a.label);});
  denseEdgeBatches.forEach(b=>{if(b.label)labels.add(b.label);});
  if(O.sub&&O.sub.length)labels.add('subClassOf');
  if(O.typ&&O.typ.length)labels.add('a');
  const arr=[...labels].filter(l=>l).sort();
  if(!arr.length){panel.innerHTML='<div class="sub">No edges</div>';return;}
  panel.innerHTML='';
  arr.forEach(lbl=>{
    const row=document.createElement('label');row.style.cssText='display:flex;align-items:center;gap:6px;padding:2px 4px;cursor:pointer;font-size:10px;color:#555;user-select:none';
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=true;
    const txt=document.createElement('span');txt.textContent=lbl;txt.style.flex='1';
    row.appendChild(cb);row.appendChild(txt);panel.appendChild(row);
    cb.addEventListener('change',e=>{const v=e.target.checked;
      edgeObjs.forEach(eo=>{if(eo.userData&&eo.userData.label===lbl){eo.visible=v;if(eo.userData.labelSprite)eo.userData.labelSprite.visible=v;}});
      arrowObjs.forEach(a=>{if(a.label===lbl){if(a.line)a.line.visible=v;if(a.head)a.head.visible=v;if(a.labelSprite)a.labelSprite.visible=v;}});
      denseEdgeBatches.forEach(b=>{if(b.label===lbl)b.line.visible=v;});
    });
  });
}
function animate(){requestAnimationFrame(animate);nodeMeshes.forEach(m=>m.quaternion.copy(camera.quaternion));if(renderArrowHeads)arrowObjs.forEach(updateArrowRot);selectionPulse();updateLabelScales();animateInferred(performance.now());_orbitTick(performance.now());_maybeUpdateGlobeLOD(performance.now());_maybeUpdateMapLOD(performance.now());ctrl.update();renderer.render(scene,camera);}
animate();
populateEdgeFilter();

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
  else if(e.key===']'){
    // Bracket expand: promote selected node to isolation root if needed, then grow BFS depth.
    const root=isolatedRoot||selectedRoot;if(!root)return;
    e.preventDefault();
    if(!isolatedRoot){isolatedRoot=root;isolationDepth=1;}
    else{isolationDepth=Math.min(MAX_NEIGHBORHOOD_DEPTH,isolationDepth+1);}
    selectedRoot=isolatedRoot;selectedLine=null;updateSelection();applyIsolation();
  }
  else if(e.key==='['&&isolatedRoot){e.preventDefault();isolationDepth=Math.max(1,isolationDepth-1);applyIsolation();}
  else if(/^[1-5]$/.test(e.key)){
    // Direct depth keys: 1..5 set BFS depth on the picked node, activating isolation if it wasn't already.
    const root=isolatedRoot||selectedRoot;if(!root)return;
    e.preventDefault();
    const d=parseInt(e.key,10);
    isolatedRoot=root;isolationDepth=Math.min(MAX_NEIGHBORHOOD_DEPTH,Math.max(1,d));
    selectedRoot=isolatedRoot;selectedLine=null;updateSelection();applyIsolation();
  }
});

function applyPositions(){Object.keys(nodeMap).forEach(id=>{const m=getNodeMesh(id);if(m)m.position.set(nodeMap[id].x,nodeMap[id].y,nodeMap[id].z);});
  if(denseEdgeMode)refreshDenseEdgeBatches();
  edgeObjs.forEach(l=>{const s=getNodeMesh(l.userData.srcId),t=getNodeMesh(l.userData.tgtId);
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
    const sm=getNodeMesh(a.srcId);
    const tm=getNodeMesh(a.tgtId);
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

// ---- Map view: pin geo nodes via Web Mercator + force-direct non-geo nodes above the tile plane ----
function _propagateOrbit(rec,date){
  let r;try{r=satellite.propagate(rec,date);}catch(e){return null;}
  if(!r||!r.position||isNaN(r.position.x))return null;
  const gmst=satellite.gstime(date);
  const geo=satellite.eciToGeodetic(r.position,gmst);
  const lat=geo.latitude*180/Math.PI,lon=geo.longitude*180/Math.PI;
  if(!isFinite(lat)||!isFinite(lon))return null;
  return{lat,lon,alt:geo.height};
}
function _orbitTick(now){
  if(!mapView.active)return;
  if(now-orbitState.lastTick<orbitState.tickInterval)return;
  orbitState.lastTick=now;
  const date=new Date(),ctx=mapView.ctx;if(!ctx)return;
  const isGlobe=mapView.mode==='globe';
  Object.entries(orbitState.satrecs).forEach(([id,rec])=>{
    const pos=_propagateOrbit(rec,date);if(!pos)return;
    let nx,ny,nz,surfPt,trailPt;
    if(isGlobe){
      const R=ctx.R;
      const altScale=Math.min(15,Math.max(1,pos.alt/200));
      surfPt=_latLonToSphere(pos.lat,pos.lon,R+0.05);
      const nodePt=_latLonToSphere(pos.lat,pos.lon,R+altScale);
      nx=nodePt.x;ny=nodePt.y;nz=nodePt.z;
      trailPt=_latLonToSphere(pos.lat,pos.lon,R+0.08);
    }else{
      if(pos.lat<-85||pos.lat>85)return; // skip Mercator singularity
      const p=_projectGeo(pos.lat,pos.lon,ctx);
      nx=p.x;ny=5+Math.max(-2,Math.min(10,(pos.alt-300)/80));nz=p.z;
      trailPt=new THREE.Vector3(p.x,-8.81,p.z);
    }
    const pin=mapView.pins[id];
    if(pin){
      if(isGlobe&&surfPt){pin.surfPt=surfPt;if(pin.mesh)pin.mesh.position.copy(surfPt);}
      else{pin.x=nx;pin.z=nz;if(pin.mesh)pin.mesh.position.set(nx,-8.85,nz);}
    }
    const nodeMesh=getNodeMesh(id);
    if(nodeMesh)nodeMesh.position.set(nx,ny,nz);
    if(nodeMap[id]){nodeMap[id].x=nx;nodeMap[id].y=ny;nodeMap[id].z=nz;}
    _updateMapLeader(id);
    const tl=orbitState.trails[id];
    if(tl){
      tl.points.push(trailPt);
      if(tl.points.length>TRAIL_MAX)tl.points.shift();
      tl.geometry.dispose();
      tl.line.geometry=new THREE.BufferGeometry().setFromPoints(tl.points);
      tl.geometry=tl.line.geometry;
    }
    updateEdgesFor(id);
  });
}
function _lonToTileX(lon,z){return ((lon+180)/360)*Math.pow(2,z);}
function _latToTileY(lat,z){return ((1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2)*Math.pow(2,z);}
function _pickZoom(minLat,maxLat,minLon,maxLon){
  // Higher z = street-level detail. Tile budget 8×8 keeps initial fetch ≤ 64 tiles.
  for(let z=17;z>=2;z--){
    const xs=_lonToTileX(maxLon,z)-_lonToTileX(minLon,z);
    const ys=_latToTileY(minLat,z)-_latToTileY(maxLat,z);
    if(xs<=8&&ys<=8)return z;
  }
  return 2;
}
// === Map plane chunked LOD ===
// Base tiles loaded eagerly (covers the bbox). _updateMapLOD adds finer-z overlay
// tiles as camera approaches, and culls them when camera retreats.
const _activeMapChunks=new Map();const _MAP_MAX_Z=18;
let _lastMapLODUpdate=0;const _lastMapCamPos=new THREE.Vector3(99999,0,0);
function _addMapChunk(group,z,x,y,ctx){
  const key=z+'/'+x+'/'+y;
  if(_activeMapChunks.has(key))return;
  const factor=Math.pow(2,z-ctx.z);
  const x0t=x/factor,x1t=(x+1)/factor,y0t=y/factor,y1t=(y+1)/factor;
  // Clip to plane bbox (ctx.x0..ctx.x1, ctx.y0..ctx.y1).
  if(x1t<=ctx.x0||x0t>=ctx.x1||y1t<=ctx.y0||y0t>=ctx.y1)return;
  const cx0=Math.max(x0t,ctx.x0),cx1=Math.min(x1t,ctx.x1);
  const cy0=Math.max(y0t,ctx.y0),cy1=Math.min(y1t,ctx.y1);
  const u0=(cx0-ctx.x0)/(ctx.x1-ctx.x0),u1=(cx1-ctx.x0)/(ctx.x1-ctx.x0);
  const v0=(cy0-ctx.y0)/(ctx.y1-ctx.y0),v1=(cy1-ctx.y0)/(ctx.y1-ctx.y0);
  const wx=((u0+u1)/2-0.5)*ctx.planeW,wz=((v0+v1)/2-0.5)*ctx.planeH;
  const tw=(u1-u0)*ctx.planeW,th=(v1-v0)*ctx.planeH;
  if(tw<=0.001||th<=0.001)return;
  const mat=new THREE.MeshBasicMaterial({color:0xe0e0e0,side:THREE.DoubleSide,transparent:true,opacity:0.95,depthWrite:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(tw,th),mat);
  mesh.rotation.x=-Math.PI/2;
  // Higher z renders above lower z so finer tiles overlay coarser when both present.
  mesh.position.set(wx,-9+(z-ctx.z)*0.003,wz);
  mesh.renderOrder=-100+z;
  mesh.userData={chunkKey:key,z,x,y};
  group.add(mesh);_activeMapChunks.set(key,mesh);
  // _fetchTile returns textures with flipY=false (shared with the globe LOD, which uses custom UVs
  // on the sphere). PlaneGeometry's default UVs assume flipY=true, so we MUST rewrite every chunk's
  // UVs here — otherwise the tile renders upside-down AND adjacent tiles fail to line up across
  // boundaries (each tile's vertical flip is local, so neighboring tile content goes the wrong way).
  // After rotation.x=-π/2 (plane laid flat), PlaneGeometry vertex order maps to world as:
  //   v0(top-left)  → north-west,  v1(top-right) → north-east
  //   v2(bot-left)  → south-west,  v3(bot-right) → south-east
  // For Mercator tile images (top=north, origin top-left) read with flipY=false:
  //   v0=(uFrac0,vFrac0)  v1=(uFrac1,vFrac0)
  //   v2=(uFrac0,vFrac1)  v3=(uFrac1,vFrac1)
  // For whole tiles uFrac0=vFrac0=0, uFrac1=vFrac1=1.
  const uFrac0=(cx0-x0t)/(x1t-x0t),uFrac1=(cx1-x0t)/(x1t-x0t);
  const vFrac0=(cy0-y0t)/(y1t-y0t),vFrac1=(cy1-y0t)/(y1t-y0t);
  const uv=mesh.geometry.attributes.uv;
  uv.setXY(0,uFrac0,vFrac0);uv.setXY(1,uFrac1,vFrac0);
  uv.setXY(2,uFrac0,vFrac1);uv.setXY(3,uFrac1,vFrac1);
  uv.needsUpdate=true;
  _fetchTile(z,x,y).then(tex=>{
    if(tex&&_activeMapChunks.get(key)===mesh&&mesh.parent){
      mat.map=tex;mat.color.setHex(0xffffff);mat.needsUpdate=true;
    }
  });
}
function _buildMapPlane(ctx){
  const group=new THREE.Group();
  // Eagerly seed base-z tiles covering the bbox; LOD layer adds finer tiles on demand.
  const nTiles=Math.pow(2,ctx.z);
  for(let xt=ctx.xt0;xt<=ctx.xt1;xt++){
    if(xt<0||xt>=nTiles)continue;
    for(let yt=ctx.yt0;yt<=ctx.yt1;yt++){
      if(yt<0||yt>=nTiles)continue;
      _addMapChunk(group,ctx.z,xt,yt,ctx);
    }
  }
  const grid=new THREE.GridHelper(Math.max(ctx.planeW,ctx.planeH)*1.05,12,0x99aacc,0xccd6e8);
  grid.material.transparent=true;grid.material.opacity=0.35;grid.position.y=-8.9;group.add(grid);
  return group;
}
function _updateMapLOD(){
  if(!mapView.active||mapView.mode!=='map'||!mapView.ctx||!mapView.group)return;
  const ctx=mapView.ctx;
  const fovRad=camera.fov*Math.PI/180;
  const desired=[];
  function recurse(z,x,y){
    const factor=Math.pow(2,z-ctx.z);
    const x0t=x/factor,x1t=(x+1)/factor,y0t=y/factor,y1t=(y+1)/factor;
    if(x1t<=ctx.x0||x0t>=ctx.x1||y1t<=ctx.y0||y0t>=ctx.y1)return;
    const cx0=Math.max(x0t,ctx.x0),cx1=Math.min(x1t,ctx.x1);
    const cy0=Math.max(y0t,ctx.y0),cy1=Math.min(y1t,ctx.y1);
    const uMid=((cx0+cx1)/2-ctx.x0)/(ctx.x1-ctx.x0);
    const vMid=((cy0+cy1)/2-ctx.y0)/(ctx.y1-ctx.y0);
    const wx=(uMid-0.5)*ctx.planeW,wz=(vMid-0.5)*ctx.planeH;
    const tileW=(cx1-cx0)/(ctx.x1-ctx.x0)*ctx.planeW;
    const center=new THREE.Vector3(wx,-9,wz);
    const distance=Math.max(0.1,camera.position.distanceTo(center));
    const screenSize=(tileW/distance)/fovRad*window.innerHeight;
    if(screenSize>220&&z<_MAP_MAX_Z){
      for(let i=0;i<2;i++)for(let j=0;j<2;j++)recurse(z+1,x*2+i,y*2+j);
    }else{
      desired.push({z,x,y});
    }
  }
  for(let bx=ctx.xt0;bx<=ctx.xt1;bx++)
    for(let by=ctx.yt0;by<=ctx.yt1;by++)
      recurse(ctx.z,bx,by);
  const desiredKeys=new Set(desired.map(t=>t.z+'/'+t.x+'/'+t.y));
  // Cull chunks no longer needed (always keep base z so the map never goes blank).
  for(const [key,mesh] of [..._activeMapChunks]){
    const z=mesh.userData.z;
    if(z===ctx.z)continue;
    if(!desiredKeys.has(key)){
      mapView.group.remove(mesh);
      mesh.geometry.dispose();
      if(mesh.material){mesh.material.map=null;mesh.material.dispose();}
      _activeMapChunks.delete(key);
    }
  }
  // Add new chunks
  desired.forEach(t=>_addMapChunk(mapView.group,t.z,t.x,t.y,ctx));
}
function _maybeUpdateMapLOD(now){
  if(!mapView.active||mapView.mode!=='map')return;
  if(now-_lastMapLODUpdate<200)return;
  const moved=camera.position.distanceTo(_lastMapCamPos);
  if(moved<0.8&&_activeMapChunks.size>0)return;
  _lastMapLODUpdate=now;_lastMapCamPos.copy(camera.position);
  _updateMapLOD();
}
function _projectGeo(lat,lon,ctx){
  const tx=_lonToTileX(lon,ctx.z),ty=_latToTileY(lat,ctx.z);
  const u=(tx-ctx.x0)/(ctx.x1-ctx.x0),v=(ty-ctx.y0)/(ctx.y1-ctx.y0);
  return{x:(u-0.5)*ctx.planeW,z:(v-0.5)*ctx.planeH};
}
function mapLayout(){
  const geoNodes=(O.geo&&O.geo.nodes)||[];
  const sats=O.satellites||[];
  // Pre-propagate satellite initial positions so bbox encloses them too
  const _initSatLatLons=[];
  if(window.satellite){
    const _now=new Date();
    sats.forEach(s=>{let rec;try{rec=satellite.twoline2satrec(s.tle1,s.tle2);}catch(e){return;}if(rec.error!==0)return;const pos=_propagateOrbit(rec,_now);if(pos)_initSatLatLons.push(pos);});
  }
  if(!geoNodes.length&&!_initSatLatLons.length)return false;
  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  geoNodes.forEach(n=>{minLat=Math.min(minLat,n.lat);maxLat=Math.max(maxLat,n.lat);minLon=Math.min(minLon,n.lon);maxLon=Math.max(maxLon,n.lon);});
  _initSatLatLons.forEach(p=>{minLat=Math.min(minLat,p.lat);maxLat=Math.max(maxLat,p.lat);minLon=Math.min(minLon,p.lon);maxLon=Math.max(maxLon,p.lon);});
  // For orbit-heavy ontologies, widen the bbox to give satellites room to traverse
  if(_initSatLatLons.length){minLat=Math.max(-70,minLat-20);maxLat=Math.min(70,maxLat+20);minLon=Math.max(-180,minLon-40);maxLon=Math.min(180,maxLon+40);}
  const padLat=Math.max(0.5,(maxLat-minLat)*0.2),padLon=Math.max(0.5,(maxLon-minLon)*0.2);
  // Clamp to Web Mercator safe range (±85°lat / ±180°lon) — lat near ±90° breaks log(tan()) → NaN propagation.
  minLat=Math.max(-85,minLat-padLat);maxLat=Math.min(85,maxLat+padLat);
  minLon=Math.max(-180,minLon-padLon);maxLon=Math.min(180,maxLon+padLon);
  const z=_pickZoom(minLat,maxLat,minLon,maxLon);
  const x0=_lonToTileX(minLon,z),x1=_lonToTileX(maxLon,z),y0=_latToTileY(maxLat,z),y1=_latToTileY(minLat,z);
  // Spread the plane proportionally to picked z so tight-bbox layouts (e.g., neighborhood-level) still give nodes enough room not to overlap.
  const planeW=Math.min(220,50+Math.max(0,z-6)*16),planeH=planeW*((y1-y0)/(x1-x0));
  const ctx={z,x0,x1,y0,y1,xt0:Math.floor(x0),xt1:Math.floor(x1),yt0:Math.floor(y0),yt1:Math.floor(y1),planeW,planeH};
  _disposeMapGroup();
  mapView.group=_buildMapPlane(ctx);scene.add(mapView.group);
  mapView.ctx=ctx;mapView.active=true;mapView.mode='map';floorGrid.visible=false;
  const geoIds=new Set();
  const NODE_Y=5,PIN_Y=-8.85;
  geoNodes.forEach(n=>{
    geoIds.add(n.id);
    const p=_projectGeo(n.lat,n.lon,ctx);
    nodeMap[n.id]={x:p.x,y:NODE_Y,z:p.z};
    // Location pin: small filled disk flush with the map plane
    const pinMat=new THREE.MeshBasicMaterial({color:0x1c4f99,side:THREE.DoubleSide});
    const pin=new THREE.Mesh(new THREE.CircleGeometry(0.32,24),pinMat);
    pin.rotation.x=-Math.PI/2;pin.position.set(p.x,PIN_Y,p.z);mapView.group.add(pin);
    // Dashed leader: pin → node (registered so node drag can refresh it)
    const ldGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p.x,PIN_Y+0.02,p.z),new THREE.Vector3(p.x,NODE_Y-0.6,p.z)]);
    const ldMat=new THREE.LineDashedMaterial({color:0x6a8cb6,dashSize:0.32,gapSize:0.22,linewidth:1});
    const lead=new THREE.Line(ldGeo,ldMat);lead.computeLineDistances();mapView.group.add(lead);
    mapView.leaders[n.id]=lead;mapView.pins[n.id]={x:p.x,z:p.z,mesh:pin};
  });
  // Satellites: register pin/leader/trail like geo but red-toned and animated. Re-uses `sats` from bbox prepass.
  const _now=new Date();
  orbitState.satrecs={};orbitState.trails={};
  sats.forEach(s=>{
    if(!window.satellite)return;
    let rec;try{rec=satellite.twoline2satrec(s.tle1,s.tle2);}catch(e){return;}
    if(rec.error!==0)return;
    const pos=_propagateOrbit(rec,_now);if(!pos)return;
    orbitState.satrecs[s.id]=rec;
    geoIds.add(s.id);
    const p=_projectGeo(pos.lat,pos.lon,ctx);
    const ny=5+Math.max(-2,Math.min(10,(pos.alt-300)/80));
    nodeMap[s.id]={x:p.x,y:ny,z:p.z};
    const pinMat=new THREE.MeshBasicMaterial({color:0xc62828,side:THREE.DoubleSide});
    const pinMesh=new THREE.Mesh(new THREE.CircleGeometry(0.32,24),pinMat);
    pinMesh.rotation.x=-Math.PI/2;pinMesh.position.set(p.x,PIN_Y,p.z);mapView.group.add(pinMesh);
    const ldGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p.x,PIN_Y+0.02,p.z),new THREE.Vector3(p.x,ny-0.6,p.z)]);
    const ldMat=new THREE.LineDashedMaterial({color:0xd68080,dashSize:0.32,gapSize:0.22,linewidth:1});
    const lead=new THREE.Line(ldGeo,ldMat);lead.computeLineDistances();mapView.group.add(lead);
    mapView.leaders[s.id]=lead;mapView.pins[s.id]={x:p.x,z:p.z,mesh:pinMesh,isSat:true};
    // Trail: thin line that grows over time, capped at TRAIL_MAX points
    const tlGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p.x,PIN_Y+0.04,p.z)]);
    const tlMat=new THREE.LineBasicMaterial({color:0xc62828,transparent:true,opacity:0.55});
    const tl=new THREE.Line(tlGeo,tlMat);tl.frustumCulled=false;mapView.group.add(tl);
    orbitState.trails[s.id]={points:[new THREE.Vector3(p.x,PIN_Y+0.04,p.z)],line:tl,geometry:tlGeo};
  });
  const allIds=[...O.cls.map(c=>c.id),...O.ind.map(i=>i.id)].filter(id=>nodeMap[id]||true);
  const movable=allIds.filter(id=>!geoIds.has(id));
  // Tier movable nodes above the map by hierarchy depth (root = highest, leaves closer to map).
  const _hd=_computeHierDepth();const _depthOf=id=>{if(_hd.cdepth[id]!==undefined)return _hd.cdepth[id];if(_hd.idepth[id]!==undefined)return _hd.idepth[id];return _hd.maxCD;};
  const _tierStep=4.5;const _tierBase=NODE_Y;
  const _tiers={};movable.forEach(id=>{const d=_depthOf(id);(_tiers[d]=_tiers[d]||[]).push(id);});
  Object.keys(_tiers).forEach(d=>{const arr=_tiers[d];const y=_tierBase+(_hd.maxCD-+d)*_tierStep;
    arr.forEach((id,i)=>{const a=i/Math.max(1,arr.length)*Math.PI*2;const r=Math.max(planeW,planeH)*(0.55+(+d)*0.04);nodeMap[id]={x:Math.cos(a)*r,y,z:Math.sin(a)*r};});});
  const edges=[];O.sub.forEach(([a,b])=>edges.push([a,b]));O.typ.forEach(([a,b])=>edges.push([a,b]));O.rel.forEach(r=>edges.push([r.s,r.o]));
  for(let it=0;it<150;it++){
    const fx={},fz={};movable.forEach(id=>{fx[id]=0;fz[id]=0;});
    for(let i=0;i<allIds.length;i++){const a=allIds[i],pa=nodeMap[a];if(!pa)continue;
      for(let j=0;j<allIds.length;j++){if(i===j)continue;const b=allIds[j];if(geoIds.has(b))continue;const pb=nodeMap[b];if(!pb)continue;
        const dx=pb.x-pa.x,dz=pb.z-pa.z;const d2=dx*dx+dz*dz+0.1;const d=Math.sqrt(d2);const f=90/d2;
        fx[b]+=dx/d*f;fz[b]+=dz/d*f;}}
    edges.forEach(([a,b])=>{const pa=nodeMap[a],pb=nodeMap[b];if(!pa||!pb)return;
      const dx=pb.x-pa.x,dz=pb.z-pa.z;const d=Math.sqrt(dx*dx+dz*dz)||0.01;const f=(d-5)*0.04;
      if(!geoIds.has(a)){fx[a]+=dx/d*f;fz[a]+=dz/d*f;}
      if(!geoIds.has(b)){fx[b]-=dx/d*f;fz[b]-=dz/d*f;}});
    const damp=Math.max(0.3,1-it/150);
    movable.forEach(id=>{nodeMap[id].x+=fx[id]*0.1*damp;nodeMap[id].z+=fz[id]*0.1*damp;});
  }
  applyPositions();
  const fitR=Math.max(planeW,planeH)*0.95;camera.position.set(0,fitR*0.85,fitR);ctrl.target.set(0,0,0);
  const _ma=document.getElementById('map-attrib');if(_ma)_ma.style.display='block';
  return true;
}
function _disposeMapGroup(){
  if(!mapView.group)return;
  scene.remove(mapView.group);
  mapView.group.traverse(o=>{
    if(o.geometry)o.geometry.dispose();
    if(o.material){
      // Preserve textures owned by _tileCache (LOD chunks have userData.chunkKey).
      if(o.userData&&o.userData.chunkKey){o.material.map=null;o.material.dispose();}
      else{if(o.material.map)o.material.map.dispose();o.material.dispose();}
    }
  });
  mapView.group=null;mapView.leaders={};mapView.pins={};
  orbitState.satrecs={};orbitState.trails={};
  _activeChunks.clear();_activeMapChunks.clear();
  _lastMapCamPos.set(99999,0,0);
}
// "east-on-right" convention: lon=0 at -x, lon=+90 at +z. Visible from +z camera with Asia on screen-right when looking at the +x,+z octant.
function _latLonToSphere(lat,lon,R){const latR=lat*Math.PI/180,lonR=lon*Math.PI/180;return new THREE.Vector3(-R*Math.cos(latR)*Math.cos(lonR),R*Math.sin(latR),R*Math.cos(latR)*Math.sin(lonR));}
// Mercator UV: rewrite a SphereGeometry's UV so v=latitude-as-mercator, u matches east-on-right sphere convention (uses atan2(z,-x)).
function _applyMercatorUV(geo,R){
  const uvAttr=geo.attributes.uv,posAttr=geo.attributes.position;
  const maxLatR=85*Math.PI/180;
  for(let i=0;i<posAttr.count;i++){
    const x=posAttr.getX(i),y=posAttr.getY(i),z=posAttr.getZ(i);
    const lat=Math.asin(Math.max(-1,Math.min(1,y/R)));
    const lon=Math.atan2(z,-x);
    const u=(lon/Math.PI+1)/2;
    const latC=Math.max(-maxLatR,Math.min(maxLatR,lat));
    const v=(1-Math.log(Math.tan(Math.PI/4+latC/2))/Math.PI)/2;
    uvAttr.setXY(i,u,v);
  }
  uvAttr.needsUpdate=true;
}
// Fetch Carto Positron z=2 tile composite (4x4 = 16 tiles → 1024x1024 Mercator world) as a THREE texture.
function _buildMercatorTexture(){
  return new Promise(resolve=>{
    const z=2,n=4,ts=256;
    const cv=document.createElement('canvas');cv.width=cv.height=n*ts;
    const cx=cv.getContext('2d');cx.fillStyle='#f0f0f0';cx.fillRect(0,0,cv.width,cv.height);
    let pending=n*n,done=false;
    const finish=()=>{if(done)return;done=true;const tex=new THREE.CanvasTexture(cv);tex.flipY=false;tex.wrapS=THREE.RepeatWrapping;tex.needsUpdate=true;resolve(tex);};
    for(let tx=0;tx<n;tx++)for(let ty=0;ty<n;ty++){
      const img=new Image();img.crossOrigin='anonymous';
      img.onload=()=>{try{cx.drawImage(img,tx*ts,ty*ts);}catch(e){}pending--;if(pending===0)finish();};
      img.onerror=()=>{pending--;if(pending===0)finish();};
      const sub='abcd'[(tx+ty)%4];
      img.src='https://'+sub+'.basemaps.cartocdn.com/light_all/'+z+'/'+tx+'/'+ty+'.png';
    }
    setTimeout(finish,8000);
  });
}
// === Chunked LOD globe (visible-region tile pyramid, Carto Positron z=2..6) ===
const _tileCache=new Map();const _activeChunks=new Map();const _MAX_Z=6;
let _lastLODUpdate=0;const _lastCamPos=new THREE.Vector3(99999,0,0);
function _tileBounds(z,x,y){
  const n=Math.pow(2,z);
  const lon0=x/n*360-180,lon1=(x+1)/n*360-180;
  const lat1=Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI;
  const lat0=Math.atan(Math.sinh(Math.PI*(1-2*(y+1)/n)))*180/Math.PI;
  return{lon0,lon1,lat0,lat1};
}
function _buildTileChunkGeo(z,x,y,R){
  const sub=8,n=Math.pow(2,z);
  const positions=[],uvs=[],indices=[];
  for(let i=0;i<=sub;i++)for(let j=0;j<=sub;j++){
    const uu=j/sub,vv=i/sub;
    const xM=x+uu,yM=y+vv;
    const lon=xM/n*360-180;
    const lat=Math.atan(Math.sinh(Math.PI*(1-2*yM/n)))*180/Math.PI;
    const p=_latLonToSphere(lat,lon,R);
    positions.push(p.x,p.y,p.z);uvs.push(uu,vv);
  }
  for(let i=0;i<sub;i++)for(let j=0;j<sub;j++){
    const a=i*(sub+1)+j,b=a+1,c=a+sub+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(indices);
  return geo;
}
function _fetchTile(z,x,y){
  const key=z+'/'+x+'/'+y;
  if(_tileCache.has(key)){const t=_tileCache.get(key);_tileCache.delete(key);_tileCache.set(key,t);return Promise.resolve(t);}
  return new Promise(resolve=>{
    const img=new Image();img.crossOrigin='anonymous';let done=false;
    img.onload=()=>{if(done)return;done=true;
      const tex=new THREE.Texture(img);tex.flipY=false;tex.needsUpdate=true;
      if(_tileCache.size>=300){const oldKey=_tileCache.keys().next().value;const oldTex=_tileCache.get(oldKey);if(oldTex&&oldTex.image)oldTex.dispose();_tileCache.delete(oldKey);}
      _tileCache.set(key,tex);resolve(tex);
    };
    img.onerror=()=>{if(!done){done=true;resolve(null);}};
    const sub='abcd'[(x+y)%4];
    img.src='https://'+sub+'.basemaps.cartocdn.com/light_all/'+z+'/'+x+'/'+y+'.png';
  });
}
function _chooseTilesForView(R){
  const visible=[];
  const camPos=camera.position.clone();
  const fovRad=camera.fov*Math.PI/180;
  function recurse(z,x,y){
    const b=_tileBounds(z,x,y);
    const lonC=(b.lon0+b.lon1)/2,latC=(b.lat0+b.lat1)/2;
    const center=_latLonToSphere(latC,lonC,R);
    const toCam=camPos.clone().sub(center).normalize();
    const tileNormal=center.clone().normalize();
    // Cull threshold scales with tile half-angle so a coarse tile (z=2, 90° wide) isn't dropped when only its center is back-facing — children at finer z handle precise culling.
    const tileHalfAngle=Math.PI/Math.pow(2,z+1);
    const cullThresh=-Math.min(0.7,tileHalfAngle*1.5);
    if(toCam.dot(tileNormal)<cullThresh)return;
    const distance=Math.max(0.001,camPos.distanceTo(center));
    const tileEdge=R*Math.PI/Math.pow(2,z);
    const screenSize=(tileEdge/distance)/fovRad*window.innerHeight;
    if(screenSize>220&&z<_MAX_Z){for(let i=0;i<2;i++)for(let j=0;j<2;j++)recurse(z+1,x*2+i,y*2+j);}
    else visible.push({z,x,y});
  }
  for(let x=0;x<4;x++)for(let y=0;y<4;y++)recurse(2,x,y);
  return visible;
}
function _updateGlobeLOD(){
  if(!mapView.active||mapView.mode!=='globe')return;
  const R=mapView.ctx.R;
  const desired=_chooseTilesForView(R);
  const desiredKeys=new Set(desired.map(t=>t.z+'/'+t.x+'/'+t.y));
  for(const [key,mesh] of [..._activeChunks]){
    if(!desiredKeys.has(key)){
      mapView.group.remove(mesh);
      mesh.geometry.dispose();
      if(mesh.material){mesh.material.map=null;mesh.material.dispose();}
      _activeChunks.delete(key);
    }
  }
  desired.forEach(({z,x,y})=>{
    const key=z+'/'+x+'/'+y;
    if(_activeChunks.has(key))return;
    const geo=_buildTileChunkGeo(z,x,y,R);
    const mat=new THREE.MeshBasicMaterial({color:0xf0f0f0,transparent:true,opacity:0.7,side:THREE.FrontSide,depthWrite:false});
    const mesh=new THREE.Mesh(geo,mat);
    mesh.userData.chunkKey=key;mesh.renderOrder=-1;
    mapView.group.add(mesh);_activeChunks.set(key,mesh);
    _fetchTile(z,x,y).then(tex=>{
      if(tex&&_activeChunks.get(key)===mesh&&mesh.parent){
        mat.map=tex;mat.color.setHex(0xffffff);mat.needsUpdate=true;
      }
    });
  });
}
function _maybeUpdateGlobeLOD(now){
  if(!mapView.active||mapView.mode!=='globe')return;
  if(now-_lastLODUpdate<250)return;
  const moved=camera.position.distanceTo(_lastCamPos);
  if(moved<1.5&&_activeChunks.size>0)return;
  _lastLODUpdate=now;_lastCamPos.copy(camera.position);
  _updateGlobeLOD();
}
function _updateMapLeader(id){
  if(!mapView.active)return;
  const lead=mapView.leaders[id],pin=mapView.pins[id],node=nodeMap[id];if(!lead||!pin||!node)return;
  const pos=lead.geometry.attributes.position;
  if(mapView.mode==='globe'&&pin.surfPt){
    pos.setXYZ(0,pin.surfPt.x,pin.surfPt.y,pin.surfPt.z);
    pos.setXYZ(1,node.x,node.y,node.z);
  }else{
    pos.setXYZ(0,pin.x,-8.83,pin.z);
    pos.setXYZ(1,node.x,node.y-0.6,node.z);
  }
  pos.needsUpdate=true;lead.computeLineDistances();
}
function exitMapView(){if(!mapView.active)return;_disposeMapGroup();mapView.active=false;mapView.ctx=null;mapView.mode=null;floorGrid.visible=true;['bgeomap','bgeoglobe','bgrid','bbody'].forEach(id=>{const b=document.getElementById(id);if(b)b.classList.remove('active-map');});const a=document.getElementById('map-attrib');if(a)a.style.display='none';ctrl.minDistance=0;ctrl.maxDistance=Infinity;ctrl.minPolarAngle=0;ctrl.maxPolarAngle=Math.PI;ctrl.minAzimuthAngle=-Infinity;ctrl.maxAzimuthAngle=Infinity;ctrl.rotateSpeed=1;ctrl.dampingFactor=0.05;}

function _setLayoutActive(id){['bh','bf','b2'].forEach(x=>{const el=document.getElementById(x);if(el)el.classList.toggle('active',x===id);});}
document.getElementById('bf').addEventListener('click',()=>{exitMapView();setView2D(false);resetBends();forceLayout(400);_setLayoutActive('bf');});
document.getElementById('bh').addEventListener('click',()=>{exitMapView();setView2D(false);resetBends();hierLayout();applyPositions();_setLayoutActive('bh');});
const _b2=document.getElementById('b2');if(_b2)_b2.addEventListener('click',()=>{exitMapView();layout2DCurved();setView2D(true);_setLayoutActive('b2');});
document.getElementById('br').addEventListener('click',()=>{exitMapView();setView2D(false);resetBends();camera.position.set(0,20,55);ctrl.target.set(0,0,0);document.getElementById('bh').click();});
function globeLayout(){
  const geoNodes=(O.geo&&O.geo.nodes)||[];
  const sats=O.satellites||[];
  if(!geoNodes.length&&!sats.length)return false;
  _disposeMapGroup();
  mapView.group=new THREE.Group();scene.add(mapView.group);
  mapView.active=true;mapView.mode='globe';floorGrid.visible=false;
  const R=18;mapView.ctx={R};
  // Inner faint base (visible if texture fails or while loading)
  const baseMat=new THREE.MeshBasicMaterial({color:0xeaf2ff,transparent:true,opacity:0.22,side:THREE.DoubleSide});
  const base=new THREE.Mesh(new THREE.SphereGeometry(R-0.05,48,48),baseMat);mapView.group.add(base);
  // Chunked tile pyramid — visible-region LOD (Carto Positron, z=2..6). Initial population, then animate() loop refines.
  _lastCamPos.set(99999,0,0);_lastLODUpdate=0;
  _updateGlobeLOD();
  // Prevent zooming inside the sphere (which would cull all tiles via backface)
  ctrl.minDistance=R*1.08;
  // Show OSM/Carto attribution while in globe mode
  const _maG=document.getElementById('map-attrib');if(_maG)_maG.style.display='block';
  // Graticule
  const gratMat=new THREE.LineBasicMaterial({color:0xb8c8dc,transparent:true,opacity:0.55});
  for(let lat=-75;lat<=75;lat+=15){const pts=[];for(let lon=-180;lon<=180;lon+=4)pts.push(_latLonToSphere(lat,lon,R+0.02));mapView.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),gratMat));}
  for(let lon=-180;lon<180;lon+=30){const pts=[];for(let lat=-85;lat<=85;lat+=4)pts.push(_latLonToSphere(lat,lon,R+0.02));mapView.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),gratMat));}
  // Equator + prime meridian (slightly bolder)
  const boldMat=new THREE.LineBasicMaterial({color:0x8aa5c8,transparent:true,opacity:0.85});
  {const pts=[];for(let lon=-180;lon<=180;lon+=2)pts.push(_latLonToSphere(0,lon,R+0.04));mapView.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),boldMat));}
  {const pts=[];for(let lat=-88;lat<=88;lat+=2)pts.push(_latLonToSphere(lat,0,R+0.04));mapView.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),boldMat));}
  // Pin static geo nodes on the sphere with radial leaders
  const geoIds=new Set();const PIN_H=4;
  geoNodes.forEach(n=>{
    geoIds.add(n.id);
    const surfPt=_latLonToSphere(n.lat,n.lon,R+0.05);
    const nodePt=_latLonToSphere(n.lat,n.lon,R+PIN_H);
    nodeMap[n.id]={x:nodePt.x,y:nodePt.y,z:nodePt.z};
    const pin=new THREE.Mesh(new THREE.SphereGeometry(0.25,12,12),new THREE.MeshBasicMaterial({color:0x1c4f99}));
    pin.position.copy(surfPt);mapView.group.add(pin);
    const lead=new THREE.Line(new THREE.BufferGeometry().setFromPoints([surfPt.clone(),nodePt.clone()]),new THREE.LineDashedMaterial({color:0x6a8cb6,dashSize:0.32,gapSize:0.22}));
    lead.computeLineDistances();mapView.group.add(lead);
    mapView.leaders[n.id]=lead;mapView.pins[n.id]={surfPt:surfPt.clone(),mesh:pin};
  });
  // Satellites
  orbitState.satrecs={};orbitState.trails={};
  const _now=new Date();
  sats.forEach(s=>{
    if(!window.satellite)return;
    let rec;try{rec=satellite.twoline2satrec(s.tle1,s.tle2);}catch(e){return;}
    if(rec.error!==0)return;
    const pos=_propagateOrbit(rec,_now);if(!pos)return;
    orbitState.satrecs[s.id]=rec;geoIds.add(s.id);
    const altScale=Math.min(15,Math.max(1,pos.alt/200));
    const surfPt=_latLonToSphere(pos.lat,pos.lon,R+0.05);
    const nodePt=_latLonToSphere(pos.lat,pos.lon,R+altScale);
    nodeMap[s.id]={x:nodePt.x,y:nodePt.y,z:nodePt.z};
    const pin=new THREE.Mesh(new THREE.SphereGeometry(0.25,12,12),new THREE.MeshBasicMaterial({color:0xc62828}));
    pin.position.copy(surfPt);mapView.group.add(pin);
    const lead=new THREE.Line(new THREE.BufferGeometry().setFromPoints([surfPt.clone(),nodePt.clone()]),new THREE.LineDashedMaterial({color:0xd68080,dashSize:0.32,gapSize:0.22}));
    lead.computeLineDistances();mapView.group.add(lead);
    mapView.leaders[s.id]=lead;mapView.pins[s.id]={surfPt:surfPt.clone(),mesh:pin,isSat:true};
    const trailPt=_latLonToSphere(pos.lat,pos.lon,R+0.08);
    const tlGeo=new THREE.BufferGeometry().setFromPoints([trailPt]);
    const tlMat=new THREE.LineBasicMaterial({color:0xc62828,transparent:true,opacity:0.55});
    const tl=new THREE.Line(tlGeo,tlMat);tl.frustumCulled=false;mapView.group.add(tl);
    orbitState.trails[s.id]={points:[trailPt],line:tl,geometry:tlGeo};
  });
  // Place non-geo non-sat nodes in tiered rings around the globe, stacked by hierarchy depth.
  const allIds=[...O.cls.map(c=>c.id),...O.ind.map(i=>i.id)].filter(id=>nodeMap[id]||true);
  const movable=allIds.filter(id=>!geoIds.has(id));
  const _hd=_computeHierDepth();const _depthOf=id=>{if(_hd.cdepth[id]!==undefined)return _hd.cdepth[id];if(_hd.idepth[id]!==undefined)return _hd.idepth[id];return _hd.maxCD;};
  const _tiers={};movable.forEach(id=>{const d=_depthOf(id);(_tiers[d]=_tiers[d]||[]).push(id);});
  const _tierStep=R*0.42;
  Object.keys(_tiers).forEach(d=>{const arr=_tiers[d];const y=(_hd.maxCD-+d)*_tierStep-_tierStep*(_hd.maxCD/2);
    arr.forEach((id,i)=>{const a=i/Math.max(1,arr.length)*Math.PI*2;const r=R*(1.65+(+d)*0.08);nodeMap[id]={x:Math.cos(a)*r,y,z:Math.sin(a)*r};});});
  applyPositions();
  camera.position.set(0,R*1.4,R*3.0);ctrl.target.set(0,0,0);
  return true;
}
// === Grid layout: generic N×M board for nodes with gridX/gridY ===
function gridLayout(){
  const gridNodes=(O.grid&&O.grid.nodes)||[];
  if(!gridNodes.length)return false;
  _disposeMapGroup();
  mapView.group=new THREE.Group();scene.add(mapView.group);
  mapView.active=true;mapView.mode='grid';floorGrid.visible=false;
  // Bbox: prefer explicit ontology-declared gridDimX/gridDimY (e.g., chess 8x8), else compute from data.
  let minX,maxX,minY,maxY,cols,rows;
  const _dimX=(O.grid&&O.grid.dimX)||null,_dimY=(O.grid&&O.grid.dimY)||null;
  if(_dimX&&_dimY){
    minX=0;maxX=_dimX-1;minY=0;maxY=_dimY-1;cols=_dimX;rows=_dimY;
  }else{
    let mnX=Infinity,mxX=-Infinity,mnY=Infinity,mxY=-Infinity;
    gridNodes.forEach(n=>{mnX=Math.min(mnX,n.gx);mxX=Math.max(mxX,n.gx);mnY=Math.min(mnY,n.gy);mxY=Math.max(mxY,n.gy);});
    minX=Math.floor(mnX);maxX=Math.ceil(mxX);minY=Math.floor(mnY);maxY=Math.ceil(mxY);
    cols=maxX-minX+1;rows=maxY-minY+1;
  }
  const CELL=6,planeW=cols*CELL,planeH=rows*CELL;
  mapView.ctx={minX,maxX,minY,maxY,cols,rows,CELL,planeW,planeH};
  // Checkered board (light/dark alternating, chess-friendly but generic enough)
  for(let cy=0;cy<rows;cy++){
    for(let cx=0;cx<cols;cx++){
      const isLight=(cx+cy)%2===0;
      const mat=new THREE.MeshBasicMaterial({color:isLight?0xf0e8d0:0xb88860,side:THREE.DoubleSide,transparent:true,opacity:0.88});
      const cell=new THREE.Mesh(new THREE.PlaneGeometry(CELL,CELL),mat);
      cell.rotation.x=-Math.PI/2;
      cell.position.set((cx-(cols-1)/2)*CELL,-9,-(cy-(rows-1)/2)*CELL);
      mapView.group.add(cell);
    }
  }
  // Grid frame border
  const border=new THREE.GridHelper(Math.max(planeW,planeH)*1.04,1,0x666666,0x666666);
  border.material.transparent=true;border.material.opacity=0.4;border.position.y=-8.9;mapView.group.add(border);
  // Tier the grid-positioned nodes: Squares sit ON the board (y=0.5, no pin); other Pieces float above (y=NODE_Y) with pin+leader.
  // This way locatedAt arrows (Piece → Square) render as a visible vertical drop, not a zero-length stub.
  const gridIds=new Set();const NODE_Y=4,PIN_Y=-8.85,SQUARE_Y=0.5;
  const _indCls={};O.ind.forEach(i=>{_indCls[i.id]=i.cls;});
  // Detect Square class (and any subclass of Square)
  const _squareSubclasses=new Set(['Square']);
  let changed=true;while(changed){changed=false;O.sub.forEach(([sub,sup])=>{if(_squareSubclasses.has(sup)&&!_squareSubclasses.has(sub)){_squareSubclasses.add(sub);changed=true;}});}
  gridNodes.forEach(n=>{
    gridIds.add(n.id);
    const wx=(n.gx-minX-(cols-1)/2)*CELL;
    const wz=-(n.gy-minY-(rows-1)/2)*CELL;
    const isSquare=_squareSubclasses.has(_indCls[n.id]);
    if(isSquare){
      // Square sits flat on the board cell — no pin/leader needed (the cell IS the visual).
      nodeMap[n.id]={x:wx,y:SQUARE_Y,z:wz};
    } else {
      // Piece: pin on cell + leader rising to floating node mesh
      nodeMap[n.id]={x:wx,y:NODE_Y,z:wz};
      const pinMat=new THREE.MeshBasicMaterial({color:0x1c4f99,side:THREE.DoubleSide});
      const pin=new THREE.Mesh(new THREE.CircleGeometry(0.4,16),pinMat);
      pin.rotation.x=-Math.PI/2;pin.position.set(wx,PIN_Y,wz);mapView.group.add(pin);
      const ldGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(wx,PIN_Y+0.02,wz),new THREE.Vector3(wx,NODE_Y-0.6,wz)]);
      const ldMat=new THREE.LineDashedMaterial({color:0x6a8cb6,dashSize:0.32,gapSize:0.22});
      const lead=new THREE.Line(ldGeo,ldMat);lead.computeLineDistances();mapView.group.add(lead);
      mapView.leaders[n.id]=lead;mapView.pins[n.id]={x:wx,z:wz,mesh:pin};
      // Big board-level sprite: standing piece visual using the node's rdfs:label as a camera-facing billboard.
      // Generic — works for any grid ontology with labeled cell-positioned items (chess pieces, seat names, periodic-table symbols, etc.).
      const _lbl=O.labels&&O.labels[n.id];
      if(_lbl){
        const _cv=document.createElement('canvas');_cv.width=_cv.height=256;
        const _cx=_cv.getContext('2d');
        _cx.font='bold 200px "DejaVu Sans","Apple Symbols","Segoe UI Symbol",serif';
        _cx.textAlign='center';_cx.textBaseline='middle';
        _cx.lineWidth=16;_cx.strokeStyle='rgba(255,255,255,0.95)';_cx.strokeText(_lbl,128,128);
        _cx.fillStyle='#1a1a1a';_cx.fillText(_lbl,128,128);
        const _tex=new THREE.CanvasTexture(_cv);_tex.needsUpdate=true;
        const _sprMat=new THREE.SpriteMaterial({map:_tex,transparent:true,depthWrite:false});
        const _spr=new THREE.Sprite(_sprMat);
        const _SPR=CELL*0.82;
        _spr.scale.set(_SPR,_SPR,1);
        _spr.position.set(wx,-9+_SPR/2,wz);
        _spr.renderOrder=2;
        mapView.group.add(_spr);
      }
    }
  });
  // Non-grid nodes — separate Classes (top tier, y=18) from other Individuals (mid tier, y=10) so the TBox/ABox hierarchy is visually obvious.
  const allIds=[...O.cls.map(c=>c.id),...O.ind.map(i=>i.id)].filter(id=>nodeMap[id]||true);
  const movable=allIds.filter(id=>!gridIds.has(id));
  const classSet=new Set(O.cls.map(c=>c.id));
  const classNodes=movable.filter(id=>classSet.has(id));
  const otherInds=movable.filter(id=>!classSet.has(id));
  // Classes: multi-tier outer ring — depth in subClassOf tree maps to y. Roots at top, leaves below.
  // subClassOf arrows then naturally point UP (child → parent), making the TBox hierarchy obvious.
  const _classDepth={};
  function _classRootDist(id,visited){
    if(_classDepth[id]!==undefined)return _classDepth[id];
    if(visited.has(id))return 0;
    visited.add(id);
    const parents=O.sub.filter(s=>s[0]===id).map(s=>s[1]).filter(p=>classSet.has(p));
    if(!parents.length){_classDepth[id]=0;return 0;}
    let mx=0;parents.forEach(p=>{const d=_classRootDist(p,new Set(visited))+1;if(d>mx)mx=d;});
    _classDepth[id]=mx;return mx;
  }
  classNodes.forEach(id=>_classRootDist(id,new Set()));
  const _maxClassDepth=Math.max(0,...classNodes.map(id=>_classDepth[id]||0));
  const CLASS_BASE_Y=18,CLASS_TIER_GAP=4;
  // Group classes by depth and lay each tier on its own ring (slightly wider for deeper).
  const _byDepth={};
  classNodes.forEach(id=>{const d=_classDepth[id]||0;(_byDepth[d]=_byDepth[d]||[]).push(id);});
  Object.keys(_byDepth).map(Number).sort((a,b)=>a-b).forEach(depth=>{
    const ids=_byDepth[depth];
    const y=CLASS_BASE_Y+(_maxClassDepth-depth)*CLASS_TIER_GAP;
    const r=Math.max(planeW,planeH)*(0.85+depth*0.06);
    // Angular offset per depth so tiers don't all align (cleaner visual separation)
    const aOff=depth*0.18;
    ids.sort().forEach((id,i)=>{const a=aOff+i/Math.max(1,ids.length)*Math.PI*2;nodeMap[id]={x:Math.cos(a)*r,y,z:Math.sin(a)*r};});
  });
  // Other individuals (TacticalPattern, Move, etc.): mid tier ring, slightly inside the class ring
  otherInds.forEach((id,i)=>{const a=(i+0.5)/Math.max(1,otherInds.length)*Math.PI*2;const r=Math.max(planeW,planeH)*0.68;nodeMap[id]={x:Math.cos(a)*r,y:10,z:Math.sin(a)*r};});
  applyPositions();
  const fit=Math.max(planeW,planeH)*0.95;camera.position.set(0,fit*0.9,fit*1.1);ctrl.target.set(0,0,0);
  return true;
}
// ============================================================
// BODY view — anchor nodes to anatomical positions on a front-facing human figure.
// Same plug-in shape as the MAP/GLOBE/GRID scenes: a node opts in via bodyAnchor "<region>"
// (English OR Korean key, resolved through BODY_ANCHORS) or explicit bodyX/bodyY (normalized 0..1).
// ============================================================
// Normalized front-view coords: x 0=viewer-left → 1=viewer-right, y 0=top of head → 1=feet.
const BODY_ANCHORS={
  // head & face
  head:[0.50,0.055],skull:[0.50,0.05],cranium:[0.50,0.045],brain:[0.50,0.052],
  '머리':[0.50,0.055],'두개골':[0.50,0.05],'뇌':[0.50,0.052],
  face:[0.50,0.08],'얼굴':[0.50,0.08],
  eye:[0.50,0.072],eye_left:[0.455,0.073],eye_right:[0.545,0.073],'눈':[0.50,0.072],'좌안':[0.455,0.073],'우안':[0.545,0.073],
  ear:[0.42,0.085],'귀':[0.42,0.085],nose:[0.50,0.088],'코':[0.50,0.088],
  mouth:[0.50,0.108],jaw:[0.50,0.115],'입':[0.50,0.108],'턱':[0.50,0.115],'치아':[0.50,0.108],
  // neck
  neck:[0.50,0.135],throat:[0.50,0.135],'목':[0.50,0.135],'인후':[0.50,0.135],
  thyroid:[0.50,0.152],'갑상선':[0.50,0.152],
  cervical_spine:[0.50,0.14],
  // shoulders / chest
  shoulder:[0.355,0.185],shoulder_left:[0.355,0.185],shoulder_right:[0.645,0.185],'어깨':[0.355,0.185],'좌견':[0.355,0.185],'우견':[0.645,0.185],
  clavicle:[0.50,0.175],'쇄골':[0.50,0.175],
  chest:[0.50,0.235],thorax:[0.50,0.235],sternum:[0.50,0.235],'가슴':[0.50,0.235],'흉부':[0.50,0.235],'흉골':[0.50,0.235],
  heart:[0.465,0.255],cardiac:[0.465,0.255],'심장':[0.465,0.255],
  lung:[0.40,0.235],lung_left:[0.40,0.235],lung_right:[0.60,0.235],'폐':[0.40,0.235],'허파':[0.40,0.235],'좌폐':[0.40,0.235],'우폐':[0.60,0.235],
  breast:[0.43,0.25],'유방':[0.43,0.25],
  blood:[0.50,0.255],vascular:[0.50,0.255],'혈액':[0.50,0.255],'혈관':[0.50,0.255],
  skin:[0.50,0.225],'피부':[0.50,0.225],
  // arms
  arm:[0.31,0.27],upper_arm:[0.31,0.27],arm_left:[0.31,0.27],arm_right:[0.69,0.27],'팔':[0.31,0.27],'상완':[0.31,0.27],
  elbow:[0.285,0.345],'팔꿈치':[0.285,0.345],forearm:[0.265,0.40],'전완':[0.265,0.40],
  wrist:[0.25,0.455],'손목':[0.25,0.455],hand:[0.235,0.49],hand_left:[0.235,0.49],hand_right:[0.765,0.49],'손':[0.235,0.49],
  // abdomen / viscera
  diaphragm:[0.50,0.295],'횡격막':[0.50,0.295],
  liver:[0.585,0.315],'간':[0.585,0.315],
  gallbladder:[0.565,0.335],'담낭':[0.565,0.335],'쓸개':[0.565,0.335],
  stomach:[0.535,0.32],gastric:[0.535,0.32],'위':[0.535,0.32],
  spleen:[0.42,0.325],'비장':[0.42,0.325],
  pancreas:[0.50,0.338],'췌장':[0.50,0.338],
  adrenal:[0.43,0.34],'부신':[0.43,0.34],
  kidney:[0.42,0.355],kidney_left:[0.42,0.355],kidney_right:[0.58,0.355],'신장':[0.42,0.355],'콩팥':[0.42,0.355],'좌신':[0.42,0.355],'우신':[0.58,0.355],
  abdomen:[0.50,0.36],'복부':[0.50,0.36],'배':[0.50,0.36],
  navel:[0.50,0.40],umbilicus:[0.50,0.40],'배꼽':[0.50,0.40],
  intestine:[0.50,0.42],bowel:[0.50,0.42],'장':[0.50,0.42],'창자':[0.50,0.42],
  small_intestine:[0.50,0.425],'소장':[0.50,0.425],
  large_intestine:[0.50,0.41],colon:[0.50,0.41],'대장':[0.50,0.41],'결장':[0.50,0.41],
  appendix:[0.585,0.43],'충수':[0.585,0.43],'맹장':[0.585,0.43],
  bladder:[0.50,0.455],'방광':[0.50,0.455],
  pelvis:[0.50,0.475],hip:[0.50,0.475],'골반':[0.50,0.475],'엉덩이':[0.50,0.475],
  groin:[0.50,0.49],genital:[0.50,0.49],'사타구니':[0.50,0.49],'생식기':[0.50,0.49],
  spine:[0.50,0.30],back:[0.50,0.30],'척추':[0.50,0.30],'등':[0.50,0.30],
  // legs
  thigh:[0.44,0.58],thigh_left:[0.44,0.58],thigh_right:[0.56,0.58],'허벅지':[0.44,0.58],'대퇴':[0.44,0.58],
  knee:[0.44,0.70],knee_left:[0.44,0.70],knee_right:[0.56,0.70],'무릎':[0.44,0.70],
  leg:[0.44,0.82],lower_leg:[0.44,0.82],shin:[0.44,0.82],calf:[0.43,0.80],leg_left:[0.44,0.82],leg_right:[0.56,0.82],'다리':[0.44,0.82],'정강이':[0.44,0.82],'종아리':[0.43,0.80],
  ankle:[0.44,0.93],'발목':[0.44,0.93],
  foot:[0.44,0.97],foot_left:[0.44,0.97],foot_right:[0.56,0.97],'발':[0.44,0.97]
};
// Draw a recognizable front-facing human silhouette onto a 512×1024 canvas (1:2). Colors solid; the
// plane material carries the transparency so overlapping limb strokes don't double-blend.
function _drawBodySilhouette(cv){
  const w=cv.width,h=cv.height,ctx=cv.getContext('2d');
  ctx.clearRect(0,0,w,h);
  const X=n=>n*w,Y=n=>n*h;
  const FILL='#d8e2f4',STROKE='#6c7aa3';
  ctx.lineJoin='round';ctx.lineCap='round';
  // Limbs first (light strokes, no outline) so torso overlaps the joints cleanly.
  ctx.strokeStyle=FILL;
  function limb(pts,wid){ctx.lineWidth=X(wid);ctx.beginPath();ctx.moveTo(X(pts[0][0]),Y(pts[0][1]));for(let i=1;i<pts.length;i++)ctx.lineTo(X(pts[i][0]),Y(pts[i][1]));ctx.stroke();}
  limb([[0.40,0.20],[0.34,0.27],[0.285,0.345],[0.255,0.43],[0.235,0.49]],0.052); // left arm
  limb([[0.60,0.20],[0.66,0.27],[0.715,0.345],[0.745,0.43],[0.765,0.49]],0.052); // right arm
  limb([[0.455,0.47],[0.45,0.58],[0.44,0.70],[0.44,0.82],[0.443,0.93],[0.445,0.965]],0.088); // left leg
  limb([[0.545,0.47],[0.55,0.58],[0.56,0.70],[0.56,0.82],[0.557,0.93],[0.555,0.965]],0.088); // right leg
  // feet
  ctx.lineWidth=X(0.03);
  limb([[0.445,0.965],[0.40,0.985]],0.03);limb([[0.555,0.965],[0.60,0.985]],0.03);
  // Torso (filled + outlined)
  ctx.fillStyle=FILL;ctx.strokeStyle=STROKE;ctx.lineWidth=X(0.006);
  ctx.beginPath();
  ctx.moveTo(X(0.40),Y(0.185));
  ctx.quadraticCurveTo(X(0.352),Y(0.205),X(0.40),Y(0.30));
  ctx.quadraticCurveTo(X(0.415),Y(0.40),X(0.43),Y(0.45));
  ctx.quadraticCurveTo(X(0.405),Y(0.50),X(0.46),Y(0.505));
  ctx.lineTo(X(0.54),Y(0.505));
  ctx.quadraticCurveTo(X(0.595),Y(0.50),X(0.57),Y(0.45));
  ctx.quadraticCurveTo(X(0.585),Y(0.40),X(0.60),Y(0.30));
  ctx.quadraticCurveTo(X(0.648),Y(0.205),X(0.60),Y(0.185));
  ctx.closePath();ctx.fill();ctx.stroke();
  // Neck
  ctx.beginPath();ctx.rect(X(0.468),Y(0.112),X(0.064),Y(0.05));ctx.fill();ctx.stroke();
  // Head
  ctx.beginPath();ctx.ellipse(X(0.5),Y(0.072),X(0.054),Y(0.064),0,0,Math.PI*2);ctx.fill();ctx.stroke();
  // Faint vertical centerline for symmetry reference
  ctx.strokeStyle='rgba(108,122,163,0.28)';ctx.lineWidth=X(0.004);
  ctx.beginPath();ctx.moveTo(X(0.5),Y(0.14));ctx.lineTo(X(0.5),Y(0.50));ctx.stroke();
}
function bodyLayout(){
  const raw=(O.body&&O.body.nodes)||[];
  if(!raw.length)return false;
  // Resolve each anchored node to a normalized (bx,by) — explicit coords win, else region-key lookup.
  const resolved=[];
  raw.forEach(n=>{
    let bx=n.bx,by=n.by;
    if((bx==null||by==null)&&n.key){const a=BODY_ANCHORS[n.key];if(a){bx=a[0];by=a[1];}}
    if(typeof bx!=='number'||typeof by!=='number')return;
    resolved.push({id:n.id,bx:Math.max(0,Math.min(1,bx)),by:Math.max(0,Math.min(1,by))});
  });
  if(!resolved.length)return false;
  _disposeMapGroup();
  mapView.group=new THREE.Group();scene.add(mapView.group);
  mapView.active=true;mapView.mode='body';floorGrid.visible=false;
  const PW=26,PH=52;mapView.ctx={PW,PH};
  // Silhouette plane (vertical, facing +Z / the camera)
  const cv=document.createElement('canvas');cv.width=512;cv.height=1024;
  _drawBodySilhouette(cv);
  const tex=new THREE.CanvasTexture(cv);tex.needsUpdate=true;tex.minFilter=THREE.LinearFilter;
  const planeMat=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0.92,side:THREE.DoubleSide,depthWrite:false});
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(PW,PH),planeMat);
  plane.position.set(0,0,0);mapView.group.add(plane);
  // Frame
  const frame=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(PW,PH)),new THREE.LineBasicMaterial({color:0xb9c2d8,transparent:true,opacity:0.5}));
  mapView.group.add(frame);
  const toWorld=(bx,by)=>({x:(bx-0.5)*PW,y:(0.5-by)*PH});
  // Cluster nodes sharing the same anchor so they fan out instead of overlapping.
  const groups={};
  resolved.forEach(n=>{const key=n.bx.toFixed(3)+','+n.by.toFixed(3);(groups[key]=groups[key]||[]).push(n);});
  // Small depth lift only (keep nodes close to the silhouette plane so azimuth orbit doesn't fling them around — the
  // big z-offset was what made the board "swing"). Readability comes from in-plane spread instead, see below.
  const bodyIds=new Set();const NODE_Z=4.5,PIN_Z=0.18;
  Object.values(groups).forEach(arr=>{
    const base=toWorld(arr[0].bx,arr[0].by);
    // One pin per anchor point on the silhouette
    const pin=new THREE.Mesh(new THREE.CircleGeometry(0.5,18),new THREE.MeshBasicMaterial({color:0xc0392b,side:THREE.DoubleSide}));
    pin.position.set(base.x,base.y,PIN_Z);mapView.group.add(pin);
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.5,0.72,20),new THREE.MeshBasicMaterial({color:0xc0392b,transparent:true,opacity:0.45,side:THREE.DoubleSide}));
    ring.position.set(base.x,base.y,PIN_Z);mapView.group.add(ring);
    // Float labels out into the SIDE MARGIN (in-plane, not toward the camera) so the figure stays clear and
    // azimuth orbit keeps pin↔node aligned. Left-of-centerline anchors go to the left margin, right to the right.
    const side=base.x>=0?1:-1;
    const outX=side*(Math.abs(base.x)+7.5);
    arr.forEach((n,i)=>{
      bodyIds.add(n.id);
      const wx=outX, wy=base.y+(i-(arr.length-1)/2)*3.2; // stack a shared anchor's nodes vertically in the margin
      nodeMap[n.id]={x:wx,y:wy,z:NODE_Z};
      const ldGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(base.x,base.y,PIN_Z+0.02),new THREE.Vector3(wx,wy,NODE_Z-0.6)]);
      const lead=new THREE.Line(ldGeo,new THREE.LineDashedMaterial({color:0xcf6f86,dashSize:0.34,gapSize:0.22}));
      lead.computeLineDistances();mapView.group.add(lead);
      mapView.leaders[n.id]=lead;mapView.pins[n.id]={x:wx,z:wy,mesh:pin};
    });
  });
  // Non-anchored nodes: Classes on an outer ring, other Individuals on an inner ring, around the figure (XY plane, slightly toward camera).
  const classSet=new Set(O.cls.map(c=>c.id));
  const allIds=[...O.cls.map(c=>c.id),...O.ind.map(i=>i.id)];
  const movable=allIds.filter(id=>!bodyIds.has(id));
  const classNodes=movable.filter(id=>classSet.has(id));
  const otherInds=movable.filter(id=>!classSet.has(id));
  const Rc=PH*0.74,Ri=PH*0.60;
  classNodes.forEach((id,i)=>{const a=-Math.PI/2+ (i+0.5)/Math.max(1,classNodes.length)*Math.PI*2;nodeMap[id]={x:Math.cos(a)*Rc,y:Math.sin(a)*Rc,z:1};});
  otherInds.forEach((id,i)=>{const a=-Math.PI/2+ (i+0.5)/Math.max(1,otherInds.length)*Math.PI*2;nodeMap[id]={x:Math.cos(a)*Ri,y:Math.sin(a)*Ri,z:1};});
  applyPositions();
  // Camera + orbit — free-orbit like the GRID/chess board. The previous tight
  // front-cone clamp (±50° azimuth, 36° polar band) made up/down rotation feel
  // stuck; here we open it up so BODY pans like the board. The only guard is a
  // few degrees off each exact pole, where this *vertical* plane would otherwise
  // collapse edge-on to a line. Azimuth + distance are left fully free (reset to
  // defaults by exitMapView(), so rotateSpeed/damping match the other views too).
  const dist=PH*1.04;camera.position.set(0,3,dist);ctrl.target.set(0,0,0);
  ctrl.minPolarAngle=Math.PI*0.06;   // ~11°  — look from well above
  ctrl.maxPolarAngle=Math.PI*0.94;   // ~169° — and from well below
  // minAzimuthAngle/maxAzimuthAngle/minDistance/maxDistance: left unrestricted.
  return true;
}
const _bgeomap=document.getElementById('bgeomap');
if(_bgeomap)_bgeomap.addEventListener('click',()=>{
  if(mapView.active&&mapView.mode==='map'){exitMapView();document.getElementById('bh').click();}
  else{exitMapView();setView2D(false);resetBends();_setLayoutActive('');if(mapLayout())_bgeomap.classList.add('active-map');}
});
const _bgeoglobe=document.getElementById('bgeoglobe');
if(_bgeoglobe)_bgeoglobe.addEventListener('click',()=>{
  if(mapView.active&&mapView.mode==='globe'){exitMapView();document.getElementById('bh').click();}
  else{exitMapView();setView2D(false);resetBends();_setLayoutActive('');if(globeLayout())_bgeoglobe.classList.add('active-map');}
});
const _bgrid=document.getElementById('bgrid');
if(_bgrid)_bgrid.addEventListener('click',()=>{
  if(mapView.active&&mapView.mode==='grid'){exitMapView();document.getElementById('bh').click();}
  else{exitMapView();setView2D(false);resetBends();_setLayoutActive('');if(gridLayout())_bgrid.classList.add('active-map');}
});
const _bbody=document.getElementById('bbody');
if(_bbody)_bbody.addEventListener('click',()=>{
  if(mapView.active&&mapView.mode==='body'){exitMapView();document.getElementById('bh').click();}
  else{exitMapView();setView2D(false);resetBends();_setLayoutActive('');if(bodyLayout())_bbody.classList.add('active-map');}
});
const _bre=document.getElementById('bre');
if(_bre)_bre.addEventListener('click',()=>{
  if(_bre.classList.contains('active')){clearReasoning();_bre.classList.remove('active');}
  else{applyReasoning();_bre.classList.add('active');}
});

// ---- Recording (MP4 via MediaRecorder + GIF via gif.js) ----
(function(){
  const _brec=document.getElementById('brec');if(!_brec)return;
  const status=document.getElementById('rec-status');
  let mediaRecorder=null,recChunks=[],recMime='',gif=null,gifTimer=null,recStartedAt=0,gifTotalFrames=0,recTimer=null,pendingMP4=null,pendingGIF=null,baseName='';
  function setStatus(msg){if(!status)return;if(!msg){status.style.display='none';return;}status.textContent=msg;status.style.display='block';}
  function pickMime(){
    const cands=['video/mp4;codecs=h264','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
    for(const m of cands){if(window.MediaRecorder&&MediaRecorder.isTypeSupported(m))return m;}
    return '';
  }
  function nowStamp(){const d=new Date(),pad=n=>String(n).padStart(2,'0');return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds());}
  function bridge(){return window.webkit&&webkit.messageHandlers&&webkit.messageHandlers.ontoair;}
  function saveBlob(blob,name){
    if(bridge()){
      const r=new FileReader();r.onload=()=>{const b64=String(r.result).split(',')[1]||'';
        webkit.messageHandlers.ontoair.postMessage({action:'saveFile',name,b64,mime:blob.type});};
      r.readAsDataURL(blob);
    }else{
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.style.display='none';
      document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);
    }
  }
  function maybeFinish(){
    if(pendingMP4&&pendingGIF){
      saveBlob(pendingMP4.blob,baseName+'.'+pendingMP4.ext);
      saveBlob(pendingGIF,baseName+'.gif');
      pendingMP4=null;pendingGIF=null;baseName='';
      setStatus('● 저장 완료');setTimeout(()=>setStatus(''),2500);
    }
  }
  // 2D compositor merges the THREE canvas (3D scene) with the hc-hand overlay (hand outlines).
  // Used as the source for both MediaRecorder and gif.js so both pipelines see the same picture.
  let compCanvas=null,compCtx=null,compRAF=0;
  function ensureCompositor(){
    if(!compCanvas){compCanvas=document.createElement('canvas');compCtx=compCanvas.getContext('2d');}
    if(compCanvas.width!==canvas.width)compCanvas.width=canvas.width;
    if(compCanvas.height!==canvas.height)compCanvas.height=canvas.height;
  }
  function drawComposite(){
    if(!compCtx)return;
    if(compCanvas.width!==canvas.width||compCanvas.height!==canvas.height){
      compCanvas.width=canvas.width;compCanvas.height=canvas.height;
    }
    compCtx.fillStyle='#fff';compCtx.fillRect(0,0,compCanvas.width,compCanvas.height);
    compCtx.drawImage(canvas,0,0,compCanvas.width,compCanvas.height);
    const hcHand=document.getElementById('hc-hand');
    if(hcHand&&hcHand.width&&hcHand.height){
      compCtx.drawImage(hcHand,0,0,compCanvas.width,compCanvas.height);
    }
  }
  function startCompLoop(){if(compRAF)return;const tick=()=>{drawComposite();compRAF=requestAnimationFrame(tick);};compRAF=requestAnimationFrame(tick);}
  function stopCompLoop(){if(compRAF){cancelAnimationFrame(compRAF);compRAF=0;}}
  function startRec(){
    if(!window.MediaRecorder||typeof canvas.captureStream!=='function'){alert('이 환경은 녹화를 지원하지 않습니다.');return;}
    recMime=pickMime();
    if(!recMime){alert('지원되는 비디오 코덱이 없습니다.');return;}
    ensureCompositor();drawComposite();startCompLoop();
    const stream=compCanvas.captureStream(30);
    recChunks=[];gifTotalFrames=0;
    try{mediaRecorder=new MediaRecorder(stream,{mimeType:recMime,videoBitsPerSecond:5_000_000});}
    catch(e){stopCompLoop();alert('MediaRecorder 시작 실패: '+e.message);return;}
    mediaRecorder.ondataavailable=e=>{if(e.data&&e.data.size>0)recChunks.push(e.data);};
    mediaRecorder.onstop=()=>{
      const ext=recMime.includes('mp4')?'mp4':'webm';
      pendingMP4={blob:new Blob(recChunks,{type:recMime}),ext};recChunks=[];maybeFinish();
    };
    mediaRecorder.start();
    if(typeof GIF==='function'){
      try{
        gif=new GIF({workers:2,quality:12,workerScript:'gif.worker.js',width:compCanvas.width,height:compCanvas.height,background:'#fff'});
        gif.on('finished',blob=>{pendingGIF=blob;gif=null;maybeFinish();});
        gifTimer=setInterval(()=>{try{drawComposite();gif.addFrame(compCanvas,{copy:true,delay:100});gifTotalFrames++;}catch(_){}},100);
      }catch(e){gif=null;}
    }
    recStartedAt=performance.now();baseName='ontoair-'+nowStamp();
    _brec.classList.add('recording');_brec.textContent='Stop';
    recTimer=setInterval(()=>{const s=Math.floor((performance.now()-recStartedAt)/1000);setStatus('REC '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')+'  ('+gifTotalFrames+'f gif)');},250);
  }
  function stopRec(){
    if(recTimer){clearInterval(recTimer);recTimer=null;}
    if(gifTimer){clearInterval(gifTimer);gifTimer=null;}
    stopCompLoop();
    _brec.classList.remove('recording');_brec.textContent='Rec';
    if(mediaRecorder&&mediaRecorder.state!=='inactive')mediaRecorder.stop();
    mediaRecorder=null;
    if(gif){setStatus('GIF 인코딩 중...');try{gif.render();}catch(_){pendingGIF=new Blob([],{type:'image/gif'});maybeFinish();}}
    else{pendingGIF=new Blob([],{type:'image/gif'});maybeFinish();}
  }
  _brec.addEventListener('click',()=>{if(_brec.classList.contains('recording'))stopRec();else startRec();});
})();
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

document.getElementById('fn').textContent=FNAME;
document.getElementById('info').innerHTML=O.cls.length+' owl:Class<br>'+O.ind.length+' Individual<br>'+O.op.length+' ObjectProperty<br>'+O.dp.length+' DatatypeProperty<br>'+logicalEdgeCount()+' edges';
if(nodeMeshes.length>50)camera.position.set(0,30,80);
if(nodeMeshes.length>100)camera.position.set(0,40,120);

let handDragId=null;
window.OA={THREE,camera,ctrl,renderer,canvas,scene,raycaster,nodeMeshes,edgeObjs,arrowObjs,denseEdgeBatches,logicalEdgeCount,nodeFromHit,findEdgeBetween,edgeEndpoints,
  get mapView(){return mapView;},get activeMapChunks(){return _activeMapChunks;},get activeGlobeChunks(){return _activeChunks;},
  getSelectedRoot:()=>selectedRoot,
  beginNodeDrag:(id,ndcX,ndcY)=>{const m=getNodeMesh(id);if(!m)return false;
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
  updateNodeDrag:(ndcX,ndcY)=>{if(!handDragId)return;const m=getNodeMesh(handDragId);if(!m)return;
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
  setNeighborhood:(rootId,depth)=>{isolatedRoot=rootId||null;isolationDepth=Math.min(MAX_NEIGHBORHOOD_DEPTH,Math.max(1,(depth==null?1:depth)|0));applyIsolation();},
  setNeighborhoodDepth:(d)=>{const nd=Math.min(MAX_NEIGHBORHOOD_DEPTH,Math.max(1,(d==null?1:d)|0));if(nd===isolationDepth)return;isolationDepth=nd;if(isolatedRoot)applyIsolation();},
  clearNeighborhood:()=>{isolatedRoot=null;isolationDepth=1;applyIsolation();},
  getIsolationRoot:()=>isolatedRoot,
  getIsolationDepth:()=>isolationDepth,
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
  getNodeScreenAt:(id)=>{const m=getNodeMesh(id);if(!m)return null;return m.position.clone().project(camera);}
};
