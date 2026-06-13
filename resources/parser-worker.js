/* OntoAir parser Web Worker
 * Runs parseTTL in a background thread so the main thread is free to repaint
 * the loading modal with real progress percentages during statement processing.
 * Kept in sync with ontoair.js parseTTL by hand — if you edit one, edit both.
 */

function localName(u){if(!u)return'';const h=u.lastIndexOf('#'),s=u.lastIndexOf('/');return u.substring(Math.max(h,s)+1);}

function extractEquivAxioms(text,pfx){
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

// Tokenize + statement-extract phase (synchronous). Identical to ontoair.js.
function tokenizeStatements(ttl){
  const ls=ttl.split('\n').map(l=>{let o='',inURI=false;for(let i=0;i<l.length;i++){if(l[i]==='<')inURI=true;if(l[i]==='>')inURI=false;if(l[i]==='#'&&!inURI)return o.trim();o+=l[i];}return o.trim();}).filter(l=>l);
  const ct=ls.join(' ');
  const pfx={};let pm,re=/@prefix\s+(\w*):?\s*<([^>]+)>\s*\./g;
  while((pm=re.exec(ct)))pfx[pm[1]]=pm[2];
  const re2=/PREFIX\s+(\w*):?\s*<([^>]+)>/gi;while((pm=re2.exec(ct)))pfx[pm[1]]=pm[2];
  let bd=ct.replace(/@prefix\s+\w*:?\s*<[^>]+>\s*\./g,'').replace(/PREFIX\s+\w*:?\s*<[^>]+>/gi,'').replace(/@base\s*<[^>]+>\s*\./g,'').trim();
  const sts=[];let dp=0,qc=null,st='';
  for(let i=0;i<bd.length;i++){const c=bd[i];if(qc){st+=c;if(c===qc&&bd[i-1]!=='\\')qc=null;continue;}if(c==='"'||c==="'"){qc=c;st+=c;continue;}if(c==='['||c==='('){dp++;st+=c;continue;}if(c===']'||c===')'){dp--;st+=c;continue;}if(c==='.'&&dp===0){const pv=bd[i-1],nx=bd[i+1];if(pv&&nx&&/\d/.test(pv)&&/\d/.test(nx)){st+=c;continue;}if(st.trim())sts.push(st.trim());st='';continue;}st+=c;}
  if(st.trim())sts.push(st.trim());
  return {sts,pfx};
}

function _tok(s){const out=[];let cur='',q=null;for(let i=0;i<s.length;i++){const c=s[i];if(q){cur+=c;if(c===q&&s[i-1]!=='\\')q=null;continue;}if(c==='"'||c==="'"){if(cur){out.push(cur);cur='';}cur=c;q=c;continue;}if(/\s/.test(c)){if(cur){out.push(cur);cur='';}continue;}cur+=c;}if(cur)out.push(cur);return out;}

// Process statements in chunks, yielding via setTimeout(0) and posting progress.
function processStatementsChunked(sts,pfx,onProgress,onDone){
  const R={cls:[],op:[],dp:[],ap:[],ind:[],sub:[],dom:[],rng:[],typ:[],rel:[],dpv:[],eqv:[],labels:{},comments:{}};
  const S=new Set(),allAssert=[];
  function eu(c){if(!c)return'';if(c[0]==='<'&&c[c.length-1]==='>')return c.slice(1,-1);const i=c.indexOf(':');if(i>=0){const p=c.substring(0,i),l=c.substring(i+1);if(pfx[p]!==undefined)return pfx[p]+l;}return c;}
  function rn(c){return localName(eu(c));}
  const CHUNK=400;
  let idx=0;
  function doChunk(){
    const end=Math.min(idx+CHUNK,sts.length);
    for(let si=idx;si<end;si++){
      const s=sts[si];const pts=s.split(/\s*;\s*/);if(!pts.length)continue;
      const ft=_tok(pts[0]);if(!ft||ft.length<2)continue;const subj=ft[0];
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
      proc(ft.slice(1));for(let i=1;i<pts.length;i++){const t=_tok(pts[i]);if(t)proc(t);}
    }
    idx=end;
    onProgress(idx,sts.length,R.cls.length,R.ind.length);
    if(idx<sts.length){setTimeout(doChunk,0);}
    else{onDone(R,allAssert);}
  }
  doChunk();
}

function finalize(ttl,R,allAssert){
  const indIds=new Set(R.ind.map(i=>i.id)),opIds=new Set(R.op.map(o=>o.id)),dpIds=new Set(R.dp.map(d=>d.id));
  let implicitProps=0;
  allAssert.forEach(([s,p,objRaw,o])=>{
    const isLit=objRaw.startsWith('"')||objRaw.startsWith("'")||/^[+-]?\d/.test(objRaw);
    if(indIds.has(s)&&indIds.has(o)&&!isLit){
      if(!opIds.has(p)&&!dpIds.has(p)){R.op.push({id:p,uri:p,implicit:true});opIds.add(p);implicitProps++;}
      R.rel.push({s,p,o});
    }else if(indIds.has(s)&&isLit){
      if(!dpIds.has(p)&&!opIds.has(p)){R.dp.push({id:p,uri:p,implicit:true});dpIds.add(p);implicitProps++;}
      if(dpIds.has(p)){let v=objRaw;const m=v.match(/^"([^"\\]*(?:\\.[^"\\]*)*)"/);if(m)v=m[1];else if(v.startsWith("'")&&v.endsWith("'"))v=v.slice(1,-1);R.dpv.push({s,p,v});}
    }
  });
  R.missingTBox=implicitProps>3&&R.cls.length<2;
  const _gtAcc={};
  R.dpv.forEach(({s,p,v})=>{const k=String(p).toLowerCase();const m=String(v).match(/^[+-]?\d+(?:\.\d+)?/);if(!m)return;const num=parseFloat(m[0]);if(isNaN(num))return;
    if(k==='lat'||k==='latitude')(_gtAcc[s]=_gtAcc[s]||{}).lat=num;
    else if(k==='long'||k==='lng'||k==='longitude')(_gtAcc[s]=_gtAcc[s]||{}).lon=num;});
  const _gtNodes=[];Object.entries(_gtAcc).forEach(([id,v])=>{if(typeof v.lat==='number'&&typeof v.lon==='number'&&v.lat>=-90&&v.lat<=90&&v.lon>=-180&&v.lon<=180)_gtNodes.push({id,lat:v.lat,lon:v.lon});});
  R.geo={nodes:_gtNodes};R.hasGeo=_gtNodes.length>0;
  const _otAcc={};
  R.dpv.forEach(({s,p,v})=>{const k=String(p).toLowerCase();
    if(k==='tleline1'||k==='tle1')(_otAcc[s]=_otAcc[s]||{}).tle1=String(v);
    else if(k==='tleline2'||k==='tle2')(_otAcc[s]=_otAcc[s]||{}).tle2=String(v);
    else if(k==='tleepoch'||k==='epoch')(_otAcc[s]=_otAcc[s]||{}).epoch=String(v);
    else if(k==='noradid'||k==='norad')(_otAcc[s]=_otAcc[s]||{}).norad=String(v);});
  const _otSats=[];Object.entries(_otAcc).forEach(([id,v])=>{if(v.tle1&&v.tle2&&v.tle1.length>50&&v.tle2.length>50)_otSats.push({id,tle1:v.tle1,tle2:v.tle2,epoch:v.epoch||null,norad:v.norad||null});});
  R.satellites=_otSats;R.hasOrbit=_otSats.length>0;
  const _grAcc={};
  R.dpv.forEach(({s,p,v})=>{const k=String(p).toLowerCase();let num=parseFloat(String(v));if(isNaN(num)){const m=String(v).trim().match(/^[a-zA-Z]/);if(m)num=m[0].toLowerCase().charCodeAt(0)-97;}if(isNaN(num))return;
    if(k==='gridx'||k==='col'||k==='column')(_grAcc[s]=_grAcc[s]||{}).gx=num;
    else if(k==='gridy'||k==='row')(_grAcc[s]=_grAcc[s]||{}).gy=num;});
  let _grDimX=null,_grDimY=null;
  allAssert.forEach(([_s,p,objRaw])=>{const k=String(p).toLowerCase();const m=String(objRaw).match(/^[+-]?\d+/);if(!m)return;const num=parseInt(m[0]);if(isNaN(num)||num<=0)return;
    if(k==='griddimx'||k==='gridwidth'||k==='gridcols')_grDimX=Math.max(_grDimX||0,num);
    else if(k==='griddimy'||k==='gridheight'||k==='gridrows')_grDimY=Math.max(_grDimY||0,num);});
  const _grNodes=[];Object.entries(_grAcc).forEach(([id,v])=>{if(typeof v.gx==='number'&&typeof v.gy==='number')_grNodes.push({id,gx:v.gx,gy:v.gy});});
  R.grid={nodes:_grNodes,dimX:_grDimX,dimY:_grDimY};R.hasGrid=_grNodes.length>0;
  const _bdAcc={};
  R.dpv.forEach(({s,p,v})=>{let k=String(p).toLowerCase();const _ci=k.lastIndexOf(':');if(_ci>=0)k=k.slice(_ci+1);  // strip any prefix (handles non-ASCII prefixes like 인체:bodyAnchor)
    if(k==='bodyanchor'||k==='bodyregion'||k==='anatomy'||k==='organloc')(_bdAcc[s]=_bdAcc[s]||{}).key=String(v).trim().toLowerCase();
    else if(k==='bodyx'){const n=parseFloat(v);if(!isNaN(n))(_bdAcc[s]=_bdAcc[s]||{}).bx=n;}
    else if(k==='bodyy'){const n=parseFloat(v);if(!isNaN(n))(_bdAcc[s]=_bdAcc[s]||{}).by=n;}});
  const _bdNodes=[];Object.entries(_bdAcc).forEach(([id,v])=>{if(v.key||(typeof v.bx==='number'&&typeof v.by==='number'))_bdNodes.push({id,key:v.key||null,bx:(typeof v.bx==='number'?v.bx:null),by:(typeof v.by==='number'?v.by:null)});});
  R.body={nodes:_bdNodes};R.hasBody=_bdNodes.length>0;
  R.eqv=extractEquivAxioms(ttl,{});  // pfx already used during tokenize; eqv extraction is rare and can run without prefix expansion here
  return R;
}

self.onmessage=function(e){
  const{ttl}=e.data;
  try{
    self.postMessage({type:'phase',label:'Tokenizing statements',detail:(ttl.length/1048576).toFixed(2)+' MB'});
    const{sts,pfx}=tokenizeStatements(ttl);
    self.postMessage({type:'phase',label:'Statements split',detail:sts.length+' statements'});
    processStatementsChunked(sts,pfx,
      (done,total,clsCnt,indCnt)=>{
        self.postMessage({type:'progress',done,total,clsCnt,indCnt});
      },
      (R,allAssert)=>{
        self.postMessage({type:'phase',label:'Finalizing',detail:R.cls.length+' cls · '+R.ind.length+' indiv'});
        const final=finalize(ttl,R,allAssert);
        final._pfx=pfx;
        self.postMessage({type:'done',result:final});
      }
    );
  }catch(err){
    self.postMessage({type:'error',error:err.message,stack:err.stack});
  }
};
