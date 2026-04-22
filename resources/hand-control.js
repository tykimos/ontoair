/* OntoAir Hand Control — one-hand gesture engine (right-hand priority) via MediaPipe Hands.
   Requires: Hands (from mediapipe/hands.js), window.OA from ontoair.js.
*/
(function(){
if(!window.OA){console.warn('hand-control: OA not ready');return;}
const OA=window.OA,THREE=OA.THREE;

const PREVIEW_W=200,PREVIEW_H=150;

const container=document.createElement('div');
container.id='hc-panel';
container.innerHTML=`
  <div id="hc-video-wrap">
    <video id="hc-video" autoplay playsinline muted style="display:none"></video>
    <canvas id="hc-overlay" width="${PREVIEW_W}" height="${PREVIEW_H}"></canvas>
    <div id="hc-mode">Idle</div>
  </div>
  <div id="hc-help">
    <div style="font-size:10px;color:#999;margin-bottom:4px">R 기본 컨트롤</div>
    <div><span class="hc-dot" style="background:#ffb84d"></span>R V (엄지 접음) → <b>Orbit</b></div>
    <div><span class="hc-dot" style="background:#5da8f0"></span>R V (엄지 펴짐) → <b>Pan</b></div>
    <div><span class="hc-dot" style="background:#ffb84d"></span>R + L V → <b>Zoom</b> (양손 간격)</div>
    <div class="hc-g" data-g="pinch"><span class="hc-dot" style="background:#d463e8"></span>R 핀치 <b>→ Pick / Drag</b></div>
  </div>`;
document.body.appendChild(container);

const cursor=document.createElement('div');cursor.id='hc-cursor';
cursor.innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1"/><circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="1.2"/><circle cx="12" cy="12" r="1.5" fill="#222"/></svg>';
document.body.appendChild(cursor);

const handOverlay=document.createElement('canvas');handOverlay.id='hc-hand';document.body.appendChild(handOverlay);
const hctx=handOverlay.getContext('2d');


const style=document.createElement('style');
style.textContent=`
  #hc-toggle{position:fixed;top:62px;right:16px;z-index:31;background:#fff;border:1px solid #ddd;border-radius:8px;padding:7px 14px;font-size:11px;color:#555;cursor:pointer;font-family:system-ui;box-shadow:0 2px 6px rgba(0,0,0,.04)}
  #hc-toggle.on{background:#3a7bd5;color:#fff;border-color:#3a7bd5}
  #hc-toggle:hover{background:#f5f5f5}
  #hc-toggle.on:hover{background:#2f6abd}
  #hc-panel{position:fixed;top:102px;right:16px;z-index:30;display:none;flex-direction:column;gap:6px;align-items:flex-end}
  #hc-panel.on{display:flex}
  #hc-video-wrap{position:relative;width:${PREVIEW_W}px;height:${PREVIEW_H}px;border:1px solid #d8d8d8;border-radius:8px;overflow:hidden;background:#f4f4f6;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  #hc-video{display:none}
  #hc-overlay{display:block;width:${PREVIEW_W}px;height:${PREVIEW_H}px}
  #hc-mode{position:absolute;top:4px;left:4px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;font-family:system-ui;letter-spacing:.3px}
  #hc-help{font-family:system-ui;font-size:10px;color:#555;background:rgba(255,255,255,.94);border:1px solid #e0e0e0;border-radius:6px;padding:8px 10px;width:${PREVIEW_W}px;text-align:left;line-height:1.7}
  .hc-g{display:flex;align-items:center;gap:6px;opacity:0.55;transition:opacity .15s}
  .hc-g.active{opacity:1;color:#3a7bd5;font-weight:600}
  .hc-dot{width:7px;height:7px;border-radius:50%;background:#ccc;flex-shrink:0;transition:background .15s}
  .hc-g.active .hc-dot{background:#3a7bd5}
  .hc-todo{color:#bbb;font-size:9px}
  #hc-cursor{position:fixed;left:0;top:0;width:24px;height:24px;pointer-events:none;display:none;z-index:40;transform:translate(-12px,-12px);filter:drop-shadow(0 1px 2px rgba(0,0,0,.25))}
  #hc-hand{position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:24}
`;
document.head.appendChild(style);

const toggleBtn=document.createElement('button');
toggleBtn.id='hc-toggle';toggleBtn.textContent='Hands';
document.body.appendChild(toggleBtn);


const video=document.getElementById('hc-video');
const overlay=document.getElementById('hc-overlay');
const modeEl=document.getElementById('hc-mode');
const octx=overlay.getContext('2d');

// ---- Gesture classifier ----
function fingersExt(lm){
  const w=lm[0];
  const d2=(a,b)=>{const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy;};
  return {
    thumb:d2(lm[4],lm[5])>d2(lm[2],lm[5])*1.0,
    index:d2(lm[8],w)>d2(lm[6],w)*1.08,
    middle:d2(lm[12],w)>d2(lm[10],w)*1.08,
    ring:d2(lm[16],w)>d2(lm[14],w)*1.05,
    pinky:d2(lm[20],w)>d2(lm[18],w)*1.05
  };
}
function angleAt(A,B,C){
  const ax=A.x-B.x,ay=A.y-B.y,cx=C.x-B.x,cy=C.y-B.y;
  const d=ax*cx+ay*cy,l=Math.hypot(ax,ay)*Math.hypot(cx,cy)||1e-9;
  return Math.acos(Math.max(-1,Math.min(1,d/l)));
}
function pinchRatio(lm){
  const dx=lm[4].x-lm[8].x,dy=lm[4].y-lm[8].y,dz=(lm[4].z||0)-(lm[8].z||0);
  const d=Math.sqrt(dx*dx+dy*dy+dz*dz);
  const hx=lm[9].x-lm[0].x,hy=lm[9].y-lm[0].y,hz=(lm[9].z||0)-(lm[0].z||0);
  const h=Math.sqrt(hx*hx+hy*hy+hz*hz)||0.1;
  return d/h;
}
function classify(lm){
  if(!lm||lm.length<21)return 'none';
  for(let i=0;i<21;i++)if(!lm[i]||lm[i].x===undefined)return 'none';
  const e=fingersExt(lm);
  const cnt=+e.index+ +e.middle+ +e.ring+ +e.pinky;
  const idxBend=angleAt(lm[5],lm[6],lm[7]);
  const pr=pinchRatio(lm);
  if(pr<0.3&&e.middle&&e.ring&&e.pinky) return 'pinch';
  if(cnt===0) return 'fist';
  if(e.index&&e.middle&&!e.ring&&!e.pinky){
    return e.thumb?'pan_v':'orbit_v';
  }
  if(cnt>=3&&!e.thumb) return 'open_palm';
  if(e.index&&!e.middle&&!e.ring&&!e.pinky) return 'point';
  return 'idle';
}
function centroid(lm){let x=0,y=0;lm.forEach(p=>{x+=p.x;y+=p.y;});return{x:x/lm.length,y:y/lm.length};}

// ---- State ----
const state={
  handsRaw:{L:null,R:null},
  active:null,
  centerL:null,centerR:null,prevL:null,prevR:null,
  gL:'none',gR:'none',gestureL:'none',gestureR:'none',stL:0,stR:0,
  prev:{gestureR:'none'},
  dragging:false,prevSize:null,
  mode:'Idle',frames:0
};

// ---- Actions ----
const ORBIT_SENS=3.0,PAN_SENS=140,ZOOM_SENS=3.5;
const tmp=new THREE.Vector3();
function orbit(dx,dy){
  const off=tmp.copy(OA.camera.position).sub(OA.ctrl.target);
  const sph=new THREE.Spherical().setFromVector3(off);
  sph.theta-=dx*ORBIT_SENS;
  sph.phi-=dy*ORBIT_SENS;
  sph.phi=Math.max(0.05,Math.min(Math.PI-0.05,sph.phi));
  off.setFromSpherical(sph);
  OA.camera.position.copy(OA.ctrl.target).add(off);
  OA.camera.lookAt(OA.ctrl.target);
}
function pan(dx,dy){
  const d=OA.camera.position.distanceTo(OA.ctrl.target);
  const s=d*PAN_SENS/100;
  const right=new THREE.Vector3().setFromMatrixColumn(OA.camera.matrix,0);
  const up=new THREE.Vector3().setFromMatrixColumn(OA.camera.matrix,1);
  const m=right.multiplyScalar(-dx*s).add(up.multiplyScalar(dy*s));
  OA.camera.position.add(m);OA.ctrl.target.add(m);
}
function zoom(delta){
  const off=tmp.copy(OA.camera.position).sub(OA.ctrl.target);
  off.multiplyScalar(1-delta*ZOOM_SENS);
  const len=off.length();if(len<2||len>500)return;
  OA.camera.position.copy(OA.ctrl.target).add(off);
}
function pickAt(lmPt){OA.selectAtNDC(lmPt.x*2-1,-(lmPt.y*2-1));}
function hoverAt(lmPt){OA.hoverAtNDC(lmPt.x*2-1,-(lmPt.y*2-1));}

// ---- Router ----
function route(now){
  const gR=state.gestureR,gL=state.gestureL;
  state.mode='Idle';

  // Pinch on right hand → Pick/Drag
  if(gR==='pinch'&&state.handsRaw.R){
    const p=state.handsRaw.R[8],ndcX=p.x*2-1,ndcY=-(p.y*2-1);
    if(state.prev.gestureR!=='pinch'){
      const picked=OA.pickAndDragAtNDC(ndcX,ndcY);
      state.dragging=picked!==null;
      state.mode=picked?'Pick+Drag':'Empty';
    }else if(state.dragging){
      OA.updateNodeDrag(ndcX,ndcY);state.mode='Drag';
    }else state.mode='Pinch';
    state.prev.gestureR=gR;return;
  }
  if(state.dragging){OA.endNodeDrag();state.dragging=false;}

  // Right hand V with thumb → Pan
  if(gR==='pan_v'&&state.centerR&&state.prevR){
    const dx=state.centerR.x-state.prevR.x;
    const dy=state.centerR.y-state.prevR.y;
    pan(dx,dy);state.mode='Pan';
    state.prev.gestureR=gR;return;
  }

  // Right hand V (no thumb) → Orbit or Zoom (if left also V)
  if(gR==='orbit_v'&&state.centerR&&state.prevR){
    const leftZoom=(gL==='orbit_v'||gL==='pan_v');
    const dx=state.centerR.x-state.prevR.x;
    const dy=state.centerR.y-state.prevR.y;
    if(leftZoom){
      if(state.centerL&&state.prevL){
        const dNow=Math.hypot(state.centerR.x-state.centerL.x,state.centerR.y-state.centerL.y);
        const dPrev=Math.hypot(state.prevR.x-state.prevL.x,state.prevR.y-state.prevL.y);
        const dd=dNow-dPrev;
        zoom(dd);
        state.mode=dd>0.002?'Zoom in':dd<-0.002?'Zoom out':'Zoom';
      }else state.mode='Zoom ready';
    }else{
      orbit(dx,dy);state.mode='Orbit';
    }
  }else{
    state.mode='Idle';
  }

  state.prev.gestureR=gR;
}

// ---- Render ----
const CONN=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
function drawHand(lm,color){
  octx.strokeStyle=color;octx.lineWidth=1.5;octx.beginPath();
  CONN.forEach(([a,b])=>{octx.moveTo(lm[a].x*PREVIEW_W,lm[a].y*PREVIEW_H);octx.lineTo(lm[b].x*PREVIEW_W,lm[b].y*PREVIEW_H);});
  octx.stroke();
  octx.fillStyle=color;
  lm.forEach(p=>{octx.beginPath();octx.arc(p.x*PREVIEW_W,p.y*PREVIEW_H,2.2,0,Math.PI*2);octx.fill();});
}
let renderLoop=false;
const CURSOR_RING_CIRC=2*Math.PI*19;
function drawMiniGrid(){
  octx.fillStyle='#f4f4f6';octx.fillRect(0,0,PREVIEW_W,PREVIEW_H);
  octx.strokeStyle='rgba(0,0,0,0.06)';octx.lineWidth=1;
  for(let i=1;i<5;i++){const x=PREVIEW_W*i/5;octx.beginPath();octx.moveTo(x,0);octx.lineTo(x,PREVIEW_H);octx.stroke();}
  for(let i=1;i<4;i++){const y=PREVIEW_H*i/4;octx.beginPath();octx.moveTo(0,y);octx.lineTo(PREVIEW_W,y);octx.stroke();}
}
function drawMiniHand(lm,color){
  octx.strokeStyle=color;octx.lineWidth=1.3;octx.beginPath();
  CONN.forEach(([a,b])=>{octx.moveTo(lm[a].x*PREVIEW_W,lm[a].y*PREVIEW_H);octx.lineTo(lm[b].x*PREVIEW_W,lm[b].y*PREVIEW_H);});
  octx.stroke();
  octx.fillStyle=color;
  [0,4,8,12,16,20].forEach(i=>{octx.beginPath();octx.arc(lm[i].x*PREVIEW_W,lm[i].y*PREVIEW_H,2.3,0,Math.PI*2);octx.fill();});
}
function drawPreview(){
  drawMiniGrid();
  if(state.handsRaw.L)drawMiniHand(state.handsRaw.L,'#5da8f0');
  if(state.handsRaw.R)drawMiniHand(state.handsRaw.R,'#e8b520');
}
function updateCursor(){
  const lm=state.handsRaw.R||state.handsRaw.L;
  if(!lm){cursor.style.display='none';if(OA.setHandHover)OA.setHandHover(null);}
  else{
    const p=lm[8];
    cursor.style.display='block';
    cursor.style.transform=`translate(${p.x*innerWidth-12}px, ${p.y*innerHeight-12}px)`;
    if(OA.hoverAtNDC&&OA.setHandHover&&!state.dragging){
      const ndcX=p.x*2-1,ndcY=-(p.y*2-1);
      const hit=OA.hoverAtNDC(ndcX,ndcY);
      OA.setHandHover(hit?hit.userData.id:null);
    }
  }
  const active=[state.gestureL,state.gestureR];
  document.querySelectorAll('.hc-g').forEach(el=>{
    el.classList.toggle('active',active.includes(el.dataset.g));
  });
}

const FINGERS=[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]];
const PALM_PX=50;
const smoothScale={L:null,R:null};
function colorsForGesture(g){
  if(g==='orbit_v')return{tip:'#ffb84d',line:'rgba(255,220,150,0.9)',palm:'rgba(255,210,130,0.22)',active:true};
  if(g==='pan_v')return{tip:'#5da8f0',line:'rgba(140,195,240,0.9)',palm:'rgba(93,168,240,0.18)',active:true};
  if(g==='pinch')return{tip:'#d463e8',line:'rgba(220,140,240,0.9)',palm:'rgba(212,99,232,0.18)',active:true};
  return{tip:'#a8a8a8',line:'rgba(170,170,170,0.85)',palm:'rgba(140,140,140,0.16)',active:false};
}
function drawOneHand(lm,side,gesture){
  const ax=lm[8].x,ay=lm[8].y;
  const span=Math.hypot(lm[9].x-lm[0].x,lm[9].y-lm[0].y)||0.15;
  const target=PALM_PX/span;
  smoothScale[side]=smoothScale[side]==null?target:smoothScale[side]*0.82+target*0.18;
  const s=smoothScale[side];
  const pts=lm.map(p=>({x:ax*innerWidth+(p.x-ax)*s,y:ay*innerHeight+(p.y-ay)*s}));
  const depths=[0,1,2,3,4, 1,2,3,4, 1,2,3,4, 1,2,3,4, 1,2,3,4];
  let fcx=0,fcy=0;[0,5,9,13,17].forEach(i=>{fcx+=pts[i].x;fcy+=pts[i].y;});fcx/=5;fcy/=5;
  pts.forEach((p,i)=>{const d=depths[i]||0;if(d>=2){const f=1-(d-1)*0.12;p.x=fcx+(p.x-fcx)*f;p.y=fcy+(p.y-fcy)*f;}});
  const c=colorsForGesture(gesture);
  const palmIdx=[0,1,2,5,9,13,17];
  const palmPts=palmIdx.map(i=>({x:pts[i].x,y:pts[i].y}));
  hctx.fillStyle=c.palm;hctx.beginPath();
  palmPts.forEach((p,k)=>{k===0?hctx.moveTo(p.x,p.y):hctx.lineTo(p.x,p.y);});
  hctx.closePath();hctx.fill();
  hctx.strokeStyle=c.line;hctx.lineWidth=2.0;hctx.lineCap='round';hctx.lineJoin='round';
  hctx.shadowColor=c.line;hctx.shadowBlur=4;
  hctx.beginPath();hctx.moveTo(palmPts[2].x,palmPts[2].y);hctx.lineTo(palmPts[3].x,palmPts[3].y);hctx.stroke();
  hctx.shadowBlur=0;
  hctx.shadowColor=c.line;hctx.shadowBlur=5;hctx.strokeStyle=c.line;hctx.lineWidth=3.2;
  FINGERS.forEach(f=>{hctx.beginPath();hctx.moveTo(pts[f[0]].x,pts[f[0]].y);for(let i=1;i<f.length;i++)hctx.lineTo(pts[f[i]].x,pts[f[i]].y);hctx.stroke();});
  hctx.shadowBlur=0;
  hctx.fillStyle='rgba(255,255,255,0.9)';
  [1,2,3,5,6,7,9,10,11,13,14,15,17,18,19].forEach(i=>{hctx.beginPath();hctx.arc(pts[i].x,pts[i].y,2,0,Math.PI*2);hctx.fill();});
  [4,8,12,16,20].forEach(i=>{if(c.active){hctx.shadowColor=c.tip;hctx.shadowBlur=7;}hctx.fillStyle=c.tip;hctx.beginPath();hctx.arc(pts[i].x,pts[i].y,3.4,0,Math.PI*2);hctx.fill();hctx.shadowBlur=0;});
  hctx.fillStyle='rgba(255,255,255,0.94)';hctx.strokeStyle=c.tip;hctx.lineWidth=1.4;
  hctx.beginPath();hctx.arc(pts[0].x,pts[0].y,4,0,Math.PI*2);hctx.fill();hctx.stroke();
}
function drawHandOverlay(){
  if(handOverlay.width!==innerWidth||handOverlay.height!==innerHeight){handOverlay.width=innerWidth;handOverlay.height=innerHeight;}
  hctx.clearRect(0,0,innerWidth,innerHeight);
  if(!state.handsRaw.L)smoothScale.L=null;
  if(!state.handsRaw.R)smoothScale.R=null;
  if(state.handsRaw.L)drawOneHand(state.handsRaw.L,'L',state.gestureL);
  if(state.handsRaw.R)drawOneHand(state.handsRaw.R,'R',state.gestureR);
}
function applyInertia(){}
function startRenderLoop(){if(renderLoop)return;renderLoop=true;(function t(){if(!renderLoop)return;drawPreview();updateCursor();drawHandOverlay();applyInertia();requestAnimationFrame(t);})();}
function stopRenderLoop(){renderLoop=false;cursor.style.display='none';hctx.clearRect(0,0,handOverlay.width,handOverlay.height);}

// ---- MediaPipe ----
let hands=null,loopRunning=false,stream=null;
const SMOOTH_ALPHA=0.28;
const smoothed={L:null,R:null};
function smoothLM(side,lm){
  if(!lm){smoothed[side]=null;return null;}
  const prev=smoothed[side];
  if(!prev||prev.length!==lm.length){smoothed[side]=lm.map(p=>({x:p.x,y:p.y,z:p.z||0}));return smoothed[side];}
  smoothed[side]=prev.map((p,i)=>({
    x:p.x*(1-SMOOTH_ALPHA)+lm[i].x*SMOOTH_ALPHA,
    y:p.y*(1-SMOOTH_ALPHA)+lm[i].y*SMOOTH_ALPHA,
    z:p.z*(1-SMOOTH_ALPHA)+(lm[i].z||0)*SMOOTH_ALPHA
  }));
  return smoothed[side];
}
function onResults(r){
  state.handsRaw={L:null,R:null};
  const raw={L:null,R:null};
  if(r.multiHandLandmarks&&r.multiHandedness){
    r.multiHandLandmarks.forEach((lm,i)=>{
      const side=r.multiHandedness[i].label[0]==='R'?'R':'L';
      raw[side]=lm;
    });
  }
  state.handsRaw.L=smoothLM('L',raw.L);
  state.handsRaw.R=smoothLM('R',raw.R);
  state.prevL=state.centerL;state.prevR=state.centerR;
  state.centerL=state.handsRaw.L?centroid(state.handsRaw.L):null;
  state.centerR=state.handsRaw.R?centroid(state.handsRaw.R):null;
  state.active=state.handsRaw.R||state.handsRaw.L;
  // Right-hand priority; fall back to left
  state.active=state.handsRaw.R||state.handsRaw.L||null;
  const rawL=classify(state.handsRaw.L),rawR=classify(state.handsRaw.R);
  if(state.gL===rawL)state.stL++;else state.stL=0;state.gL=rawL;if(state.stL>=2)state.gestureL=rawL;
  if(state.gR===rawR)state.stR++;else state.stR=0;state.gR=rawR;if(state.stR>=2)state.gestureR=rawR;
  route(performance.now());
  state.frames++;
  modeEl.textContent=state.mode+' · L:'+state.gestureL+' R:'+state.gestureR+' · f'+state.frames;
}

async function enable(){
  if(typeof window.Hands!=='function'){alert('MediaPipe Hands 미로딩. mediapipe/hands.js 경로 확인 필요.');return;}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){alert('getUserMedia 불가.');return;}
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{width:480,height:360,frameRate:{ideal:24}},audio:false});
    video.srcObject=stream;
    await new Promise(res=>{video.onloadedmetadata=()=>{video.play().then(res).catch(res);};});
    if(!hands){
      hands=new Hands({locateFile:(f)=>'mediapipe/'+f});
      hands.setOptions({selfieMode:true,maxNumHands:2,modelComplexity:0,minDetectionConfidence:0.5,minTrackingConfidence:0.5});
      hands.onResults(onResults);
    }
    loopRunning=true;state.frames=0;
    (async function tick(){if(!loopRunning)return;try{await hands.send({image:video});}catch(e){console.error('hands.send',e);}if(loopRunning)requestAnimationFrame(tick);})();
    startRenderLoop();
    container.classList.add('on');toggleBtn.classList.add('on');document.body.classList.add('hc-on');
  }catch(e){alert('카메라 접근 실패: '+e.message+' ('+e.name+')');console.error(e);}
}
function disable(){
  loopRunning=false;stopRenderLoop();
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
  video.srcObject=null;
  container.classList.remove('on');toggleBtn.classList.remove('on');document.body.classList.remove('hc-on');
  if(OA.setHandHover)OA.setHandHover(null);
}

toggleBtn.addEventListener('click',()=>{if(toggleBtn.classList.contains('on'))disable();else enable();});

})();
