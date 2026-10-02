(function(){
'use strict';

if(!window.THREE){
  document.getElementById('diagnostic').style.display='grid';
  document.getElementById('diagnosticText').textContent='Three.js could not load. Connect to the internet and run the game again.';
  return;
}
const THREE=window.THREE;
const audio = new AudioManager();

// ===== AUDIO CONTROLS =====
const hornButton = document.getElementById('hornBtn');

function setHornButton(on) {
  if (!hornButton) return;
  const label = hornButton.querySelector('span');
  if (label) label.textContent = on ? 'ON' : 'OFF';
  hornButton.classList.toggle('active', on);
}

function hornDown() {
  if (audio.hornDown()) setHornButton(true);
}

function hornUp() {
  audio.hornUp();
  setHornButton(false);
}

if (hornButton) {
  hornButton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    hornDown();
    hornButton.setPointerCapture?.(e.pointerId);
  }, { passive: false });
  hornButton.addEventListener('pointerup', (e) => {
    e.preventDefault();
    hornUp();
  }, { passive: false });
  hornButton.addEventListener('pointercancel', hornUp, { passive: true });
  hornButton.addEventListener('lostpointercapture', hornUp, { passive: true });
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyH' && !e.repeat) {
    hornDown();
    e.preventDefault();
  }
}, { passive: false });

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyH') {
    hornUp();
    e.preventDefault();
  }
}, { passive: false });
// ===== END AUDIO CONTROLS =====

// ===== SCENE & RENDERER =====
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x91c9e8);
scene.fog=new THREE.FogExp2(0xa9cda0,.009);

const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,700);
camera.position.set(0,7,-12);
camera.lookAt(0,1,4);

let renderer;
try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
}catch(e){
  document.getElementById('diagnostic').style.display='grid';
  document.getElementById('diagnosticText').textContent='WebGL error: '+(e.stack||e);
  return;
}
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
document.getElementById('game').appendChild(renderer.domElement);

const hemi=new THREE.HemisphereLight(0xe1f4ff,0x314b26,1.45);
scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,2.15);
sun.position.set(50,80,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-125,right:125,top:125,bottom:-125,near:.5,far:280});
scene.add(sun);

const M=(c,r=1,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const world=new THREE.Group();scene.add(world);

// Shared static ground-plane collision proxies. Both the tractor and trailer
// can contact these objects without needing an external physics engine.
const environmentColliders=[];
function addEnvironmentCircle(x,z,r){environmentColliders.push({type:'circle',x,z,r});}
function addEnvironmentBox(x,z,halfWidth,halfLength,yaw=0){environmentColliders.push({type:'box',x,z,halfWidth,halfLength,yaw});}

const add=(geo,mat,x=0,y=0,z=0,p=world)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o};

const ground=add(new THREE.PlaneGeometry(720,720),M(0x4e833f));
ground.rotation.x=-Math.PI/2;

function road(x,z,w,d){
 const r=add(new THREE.PlaneGeometry(w,d),M(0x66533d),x,.01,z);r.rotation.x=-Math.PI/2;
}
road(0,0,12,720);road(0,0,720,12);

// ===== ENVIRONMENT: MEADOW & VEGETATION =====
// Green-area visuals only. The field, roads and gameplay geometry are untouched.
// Inspired by the uploaded meadow reference: many individual grass leaves,
// small natural flower clusters, and varied organic density rather than cone meshes.

function makeMeadowTexture(){
  const c=document.createElement('canvas');c.width=768;c.height=768;
  const ctx=c.getContext('2d');

  const g=ctx.createLinearGradient(0,0,c.width,c.height);
  g.addColorStop(0,'#628f48');
  g.addColorStop(.45,'#6b994d');
  g.addColorStop(1,'#4e7e3b');
  ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);

  // Fine natural ground variation.
  for(let i=0;i<26000;i++){
    const x=Math.random()*c.width,y=Math.random()*c.height;
    const a=.025+Math.random()*.12;
    const dark=Math.random()>.52;
    ctx.fillStyle=dark
      ? `rgba(28,58,23,${a})`
      : `rgba(150,177,93,${a*.8})`;
    const w=.35+Math.random()*2.2,h=.35+Math.random()*2.2;
    ctx.fillRect(x,y,w,h);
  }

  // Fine grass-like marks in the base texture.
  for(let i=0;i<1400;i++){
    const x=Math.random()*c.width,y=Math.random()*c.height;
    ctx.strokeStyle=`rgba(35,77,28,${.06+Math.random()*.10})`;
    ctx.lineWidth=.5+Math.random()*.8;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x+(Math.random()-.5)*3,y-3-Math.random()*9);
    ctx.stroke();
  }

  const tex=new THREE.CanvasTexture(c);
  tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(16.5,16.5);
  tex.anisotropy=8;
  tex.colorSpace=THREE.SRGBColorSpace;
  return tex;
}

const meadowTexture=makeMeadowTexture();
ground.material.map=meadowTexture;
ground.material.roughness=.99;
ground.material.needsUpdate=true;

function isGreenArea(x,z){
  // Keep vegetation away from the two roads and the cultivated field.
  if(Math.abs(x)<7.2 || Math.abs(z)<7.2)return false;
  if(x>-50 && x<50 && z>22 && z<98)return false;
  return true;
}

// ---- Individual grass leaves ----
function makeGrassLeafGeometry(){
  const w=.055,h=.46,b=.075;

  // A slightly bent, pointed leaf ribbon.
  const verts=new Float32Array([
    -w*.50,0,0,   w*.50,0,0,
    -w*.30,h*.48,b*.25,  w*.30,h*.48,b*.25,
     0,h,b
  ]);
  const indices=[0,1,2, 1,3,2, 2,3,4];

  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const grassLeafGeo=makeGrassLeafGeometry();

function addGrassLeafClusters(clusterCount,bladesPerCluster,material,hMin,hMax){
  const total=clusterCount*bladesPerCluster;
  const mesh=new THREE.InstancedMesh(
    grassLeafGeo,
    material,
    total
  );
  mesh.frustumCulled=false;
  world.add(mesh);

  const dummy=new THREE.Object3D();
  let n=0,tries=0;

  while(n<total && tries<clusterCount*60){
    tries++;

    const cx=-108+Math.random()*216;
    const cz=-108+Math.random()*216;
    if(!isGreenArea(cx,cz))continue;

    for(let b=0;b<bladesPerCluster && n<total;b++){
      const ang=Math.random()*Math.PI*2;
      const ring=.03+Math.random()*.18;
      const x=cx+Math.cos(ang)*ring;
      const z=cz+Math.sin(ang)*ring;

      if(!isGreenArea(x,z))continue;

      const h=hMin+Math.random()*(hMax-hMin);
      const lean=(Math.random()-.5)*.22;

      dummy.position.set(x,.29,z);
      dummy.scale.set(
        .75+Math.random()*.45,
        h,
        .75+Math.random()*.20
      );
      dummy.rotation.set(
        lean*(Math.random()>.5?1:-1),
        Math.random()*Math.PI*2,
        lean*(Math.random()>.5?1:-1)
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(n++,dummy.matrix);
    }
  }

  mesh.count=n;
  mesh.instanceMatrix.needsUpdate=true;
  return mesh;
}

const grassLeafMat1=new THREE.MeshStandardMaterial({
  color:0x4d8437,
  roughness:.98,
  metalness:0,
  side:THREE.DoubleSide
});
const grassLeafMat2=new THREE.MeshStandardMaterial({
  color:0x609747,
  roughness:.98,
  metalness:0,
  side:THREE.DoubleSide
});
const grassLeafMat3=new THREE.MeshStandardMaterial({
  color:0x39702f,
  roughness:.98,
  metalness:0,
  side:THREE.DoubleSide
});

addGrassLeafClusters(430,4,grassLeafMat1,.42,.82);
addGrassLeafClusters(330,4,grassLeafMat2,.34,.72);
addGrassLeafClusters(250,4,grassLeafMat3,.30,.64);

// Extra fine individual leaves around the outer meadow for natural density.
addGrassLeafClusters(180,3,grassLeafMat2,.24,.52);

// ---- Small flowering meadow plants ----
const flowerStemGeo=new THREE.CylinderGeometry(.014,.021,.26,6);
const flowerPetalGeo=new THREE.SphereGeometry(.055,8,6);
const flowerCenterGeo=new THREE.SphereGeometry(.032,8,6);
const flowerLeafGeo=new THREE.BufferGeometry();

{
  // Pointed leaf: wide near the base, narrow at the tip.
  const verts=new Float32Array([
    0,0,0,
    .055,.01,.11,
    0,.012,.34,
    -.055,.01,.11
  ]);
  flowerLeafGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  flowerLeafGeo.setIndex([0,1,2,0,2,3]);
  flowerLeafGeo.computeVertexNormals();
}

const flowerStemMat=new THREE.MeshStandardMaterial({
  color:0x2f6c30,
  roughness:.97
});
const flowerLeafMat=new THREE.MeshStandardMaterial({
  color:0x3f7f34,
  roughness:.97,
  side:THREE.DoubleSide
});

const flowerPetalColors=[
  0xf4d64a, // yellow
  0xffffff, // white
  0xf28eae, // pink
  0xf39a42  // orange
];

const stemMesh=new THREE.InstancedMesh(
  flowerStemGeo,flowerStemMat,180
);
stemMesh.frustumCulled=false;
world.add(stemMesh);

const leafMesh=new THREE.InstancedMesh(
  flowerLeafGeo,flowerLeafMat,360
);
leafMesh.frustumCulled=false;
world.add(leafMesh);

const petalMeshes=flowerPetalColors.map(c=>{
  const m=new THREE.InstancedMesh(
    flowerPetalGeo,
    new THREE.MeshStandardMaterial({color:c,roughness:.72,metalness:0}),
    900
  );
  m.frustumCulled=false;
  world.add(m);
  return m;
});

const centerMesh=new THREE.InstancedMesh(
  flowerCenterGeo,
  new THREE.MeshStandardMaterial({color:0xd89428,roughness:.70}),
  180
);
centerMesh.frustumCulled=false;
world.add(centerMesh);

const dummyFlower=new THREE.Object3D();
const dummyPetal=new THREE.Object3D();
let stemCount=0,leafCount=0,centerCount=0;
const petalCounts=[0,0,0,0];

let flowerPlaced=0,flowerTries=0;

while(flowerPlaced<180 && flowerTries<9000){
  flowerTries++;

  const x=-106+Math.random()*212;
  const z=-106+Math.random()*212;
  if(!isGreenArea(x,z))continue;

  // Natural clumping: keep many flowers in little groups.
  if(Math.random()<.72){
    const groupX=x+(Math.random()-.5)*1.4;
    const groupZ=z+(Math.random()-.5)*1.4;
    if(isGreenArea(groupX,groupZ)){
      // Use the local clump position.
    }
  }

  const type=Math.floor(Math.random()*flowerPetalColors.length);
  const scale=.72+Math.random()*.58;
  const stemY=.30;
  const headY=stemY+.27*scale;

  dummyFlower.position.set(x,stemY,z);
  dummyFlower.rotation.y=Math.random()*Math.PI*2;
  dummyFlower.scale.setScalar(scale);
  dummyFlower.updateMatrix();
  stemMesh.setMatrixAt(stemCount++,dummyFlower.matrix);

  // Two broad leaves per plant, pointing away from the stem.
  for(let li=0;li<2;li++){
    const side=li===0?1:-1;
    dummyFlower.position.set(
      x+side*(.045+Math.random()*.035),
      stemY+.075*scale,
      z+(.02+Math.random()*.08)
    );
    dummyFlower.rotation.set(
      side*.38,
      Math.random()*Math.PI*2,
      side*.16
    );
    dummyFlower.scale.set(.62*scale,.62*scale,.62*scale);
    dummyFlower.updateMatrix();
    leafMesh.setMatrixAt(leafCount++,dummyFlower.matrix);
  }

  // Five petals around the center.
  for(let p=0;p<5;p++){
    const a=(p/5)*Math.PI*2 + Math.random()*.14;
    const pr=.060*scale;

    dummyPetal.position.set(
      x+Math.cos(a)*pr,
      headY,
      z+Math.sin(a)*pr
    );
    dummyPetal.rotation.set(
      .42,
      -a,
      0
    );
    dummyPetal.scale.set(
      .82*scale,
      .28*scale,
      1.18*scale
    );
    dummyPetal.updateMatrix();

    petalMeshes[type].setMatrixAt(petalCounts[type]++,dummyPetal.matrix);
  }

  dummyPetal.position.set(x,headY+.005,z);
  dummyPetal.rotation.set(0,0,0);
  dummyPetal.scale.setScalar(scale);
  dummyPetal.updateMatrix();
  centerMesh.setMatrixAt(centerCount++,dummyPetal.matrix);

  flowerPlaced++;
}

stemMesh.count=stemCount;
leafMesh.count=leafCount;
centerMesh.count=centerCount;

stemMesh.instanceMatrix.needsUpdate=true;
leafMesh.instanceMatrix.needsUpdate=true;
centerMesh.instanceMatrix.needsUpdate=true;

petalMeshes.forEach((m,i)=>{
  m.count=petalCounts[i];
  m.instanceMatrix.needsUpdate=true;
});

// Low wild-grass clumps around field/road edges, using leaves rather than cones.
const edgeGrassMat=new THREE.MeshStandardMaterial({
  color:0x477d35,
  roughness:.99,
  metalness:0,
  side:THREE.DoubleSide
});
addGrassLeafClusters(150,5,edgeGrassMat,.22,.50);

// ===== END ENVIRONMENT: MEADOW & VEGETATION =====


// ===== ENVIRONMENT: ROADSIDES & BILLBOARDS =====
function makeNNRBillboardTexture(){
 const c=document.createElement('canvas');c.width=1400;c.height=600;
 const ctx=c.getContext('2d');

 // Dark premium screen like a modern game-studio billboard.
 const bg=ctx.createLinearGradient(0,0,c.width,c.height);
 bg.addColorStop(0,'#071126');
 bg.addColorStop(.55,'#101944');
 bg.addColorStop(1,'#15102d');
 ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);

 // Decorative neon-style circuit lines.
 ctx.lineWidth=5;
 for(let i=0;i<12;i++){
   const y=70+i*43;
   ctx.strokeStyle=i%2===0?'rgba(72,193,255,.55)':'rgba(255,157,77,.45)';
   ctx.beginPath();
   ctx.moveTo(35,y);
   ctx.lineTo(170,y);
   ctx.lineTo(205,y-28);
   ctx.lineTo(365,y-28);
   ctx.stroke();
   ctx.beginPath();
   ctx.arc(372,y-28,8,0,Math.PI*2);
   ctx.fillStyle=i%2===0?'#48c1ff':'#ff9d4d';ctx.fill();
 }

 // Small hexagonal accents.
 function hex(x,y,r,stroke){
   ctx.strokeStyle=stroke;ctx.lineWidth=4;ctx.beginPath();
   for(let i=0;i<6;i++){
     const a=Math.PI/3*i+Math.PI/6;
     const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;
     i?ctx.lineTo(px,py):ctx.moveTo(px,py);
   }
   ctx.closePath();ctx.stroke();
 }
 hex(1130,110,48,'rgba(75,196,255,.8)');
 hex(1270,420,38,'rgba(255,161,79,.75)');
 hex(1180,480,22,'rgba(75,196,255,.65)');

 // Main title.
 ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.shadowColor='rgba(80,190,255,.35)';ctx.shadowBlur=20;
 ctx.fillStyle='#ffffff';
 ctx.font='900 116px Arial Black, Arial, sans-serif';
 ctx.fillText('NNR',700,190);
 ctx.shadowBlur=0;
 ctx.fillStyle='#f5f8ff';
 ctx.font='900 84px Arial Black, Arial, sans-serif';
 ctx.fillText('STUDIOS',700,290);

 // Orange/blue underline accents.
 ctx.fillStyle='#ff9d4d';ctx.fillRect(390,330,620,8);
 ctx.fillStyle='#48c1ff';ctx.fillRect(500,345,400,5);

 // Secondary brand name.
 ctx.fillStyle='#FF001F';
 ctx.font='900 66px Arial Black, Arial, sans-serif';
 ctx.fillText('GEC GAMESPACE',700,430);

 // Small footer.
 ctx.fillStyle='#bfc9e6';
 ctx.font='700 25px Arial, sans-serif';
 ctx.fillText('PLAY  •  CREATE  •  FARM',700,515);

 const tex=new THREE.CanvasTexture(c);
 tex.colorSpace=THREE.SRGBColorSpace;
 tex.anisotropy=8;
 return tex;
}

function createNNRBillboard(x,z,rotY=0,scale=1){
 const g=new THREE.Group();world.add(g);
 g.position.set(x,0,z);g.rotation.y=rotY;g.scale.setScalar(scale);

 const frameMat=new THREE.MeshStandardMaterial({color:0x171c22,roughness:.34,metalness:.72});
 const edgeMat=new THREE.MeshStandardMaterial({color:0x8d949b,roughness:.28,metalness:.82});
 const screenMat=new THREE.MeshStandardMaterial({map:makeNNRBillboardTexture(),roughness:.46,metalness:.05,emissive:0x182040,emissiveIntensity:.28});

 // Two heavy steel legs.
 for(const px of[-3.7,3.7]){
   add(new THREE.BoxGeometry(.30,6.8,.30),frameMat,px,3.4,0,g);
   add(new THREE.BoxGeometry(.85,.22,.85),frameMat,px,0.12,0,g);
   add(new THREE.BoxGeometry(1.45,.18,.45),frameMat,px,0.36,0,g);
 }

 // Main framed advertising board.
 add(new THREE.BoxGeometry(8.6,3.8,.28),frameMat,0,6.15,0,g);
 add(new THREE.BoxGeometry(8.28,3.48,.055),screenMat,0,6.15,.17,g);

 // Bright outer trim for a premium roadside-sign look.
 add(new THREE.BoxGeometry(8.82,.12,.36),edgeMat,0,8.03,.04,g);
 add(new THREE.BoxGeometry(8.82,.12,.36),edgeMat,0,4.27,.04,g);
 add(new THREE.BoxGeometry(.12,3.88,.36),edgeMat,-4.35,6.15,.04,g);
 add(new THREE.BoxGeometry(.12,3.88,.36),edgeMat,4.35,6.15,.04,g);

 // Rear support beam.
 add(new THREE.BoxGeometry(8.0,.28,.34),frameMat,0,2.95,-.05,g);

 // Ground anchor / shadow catcher. Decorative base is visual only.
 const base=add(new THREE.BoxGeometry(9.2,.10,1.0),frameMat,0,.06,0,g);
 base.receiveShadow=true;
 // Only the two visible support legs are solid.
 const c=Math.cos(rotY), sn=Math.sin(rotY);
 for(const px of[-3.7,3.7]){
   const wx=x+c*px, wz=z+sn*px;
   addEnvironmentBox(wx,wz,.22,.34,rotY);
 }
}

// Placed along the main roads so the signs are visible during normal driving.
createNNRBillboard(7.8,18,-Math.PI/2,0.92);
createNNRBillboard(-8.0,105,Math.PI/2,0.92);
// ===== END ENVIRONMENT: ROADSIDES & BILLBOARDS =====

// ===== FIELD SYSTEM =====
const FIELD={x1:-50,x2:50,z1:22,z2:98,cols:25,rows:19};
const cw=(FIELD.x2-FIELD.x1)/FIELD.cols,cd=(FIELD.z2-FIELD.z1)/FIELD.rows;

// Soil-bed thickness is kept at the original height so all existing
// tractor/plough/trail coordinates continue to work unchanged.
const fieldBase=add(
 new THREE.BoxGeometry(FIELD.x2-FIELD.x1,.22,FIELD.z2-FIELD.z1),
 M(0x654328,.99),
 0,.175,(FIELD.z1+FIELD.z2)/2
);

// Procedural soil texture: small stones, organic particles and fine grain.
function makeSoilTexture(){
 const c=document.createElement('canvas');c.width=1024;c.height=1024;
 const ctx=c.getContext('2d');
 ctx.fillStyle='#754d2e';ctx.fillRect(0,0,c.width,c.height);

 for(let i=0;i<26000;i++){
   const x=Math.random()*c.width,y=Math.random()*c.height;
   const v=35+Math.random()*55;
   const r=Math.random()*2.3+.35;
   const warm=Math.random()>.5;
   ctx.fillStyle=warm?`rgba(${90+v},${58+v*.55},${32+v*.30},${.08+Math.random()*.18})`
                     :`rgba(25,18,12,${.05+Math.random()*.15})`;
   ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
 }

 // Fine organic streaks.
 for(let i=0;i<380;i++){
   const y=Math.random()*c.height;
   const x=Math.random()*c.width;
   const len=20+Math.random()*150;
   ctx.strokeStyle=`rgba(40,27,17,${.035+Math.random()*.075})`;
   ctx.lineWidth=.6+Math.random()*1.5;
   ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+len,y+(Math.random()-.5)*8);ctx.stroke();
 }
 const tex=new THREE.CanvasTexture(c);
 tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
 tex.repeat.set(3.2,5.2);tex.anisotropy=8;tex.colorSpace=THREE.SRGBColorSpace;
 return tex;
}

function makeSoilBump(){
 const c=document.createElement('canvas');c.width=512;c.height=512;
 const ctx=c.getContext('2d');ctx.fillStyle='#888';ctx.fillRect(0,0,c.width,c.height);
 for(let i=0;i<12000;i++){
   const x=Math.random()*c.width,y=Math.random()*c.height;
   const g=85+Math.random()*100;
   const r=Math.random()*2.2+.3;
   ctx.fillStyle=`rgb(${g},${g},${g})`;
   ctx.fillRect(x,y,r,r);
 }
 const tex=new THREE.CanvasTexture(c);
 tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
 tex.repeat.set(3.2,5.2);tex.anisotropy=4;
 return tex;
}

const soilTexture=makeSoilTexture();
const soilBump=makeSoilBump();
const soilSurfaceMat=new THREE.MeshStandardMaterial({
 map:soilTexture,bumpMap:soilBump,bumpScale:.085,roughness:.985,metalness:0
});
const soilSurface=add(
 new THREE.PlaneGeometry(FIELD.x2-FIELD.x1,FIELD.z2-FIELD.z1,2,2),
 soilSurfaceMat,0,.287,(FIELD.z1+FIELD.z2)/2
);
soilSurface.rotation.x=-Math.PI/2;

// Subtle irregularity in the soil surface without moving the tractor.
const sp=soilSurface.geometry.attributes.position;
for(let i=0;i<sp.count;i++){
 const x=sp.getX(i),z=sp.getY(i);
 sp.setZ(i,Math.sin(x*.21+z*.13)*.018 + Math.cos(z*.31)*.012);
}
sp.needsUpdate=true;
soilSurface.geometry.computeVertexNormals();

const cells=[];
const soilG=new THREE.Group();world.add(soilG);

// Visual layer that becomes visible only after a cell is actually ploughed.
// This makes worked soil clearly distinguishable from untouched soil.
const ploughedTiles=[];
function makePloughedTexture(){
 const c=document.createElement('canvas');c.width=512;c.height=512;
 const ctx=c.getContext('2d');
 ctx.fillStyle='#5b3820';ctx.fillRect(0,0,c.width,c.height);
 for(let i=0;i<9000;i++){
   const x=Math.random()*c.width,y=Math.random()*c.height;
   const v=32+Math.random()*42;
   const rr=.35+Math.random()*1.8;
   ctx.fillStyle=Math.random()>.55
     ? `rgba(${82+v},${52+v*.42},${27+v*.25},${.10+Math.random()*.20})`
     : `rgba(22,13,8,${.07+Math.random()*.16})`;
   ctx.fillRect(x,y,rr,rr);
 }
 // Freshly turned, irregular furrow texture.
 for(let i=0;i<34;i++){
   const y=(i/34)*c.height+(-3+Math.random()*6);
   ctx.strokeStyle=`rgba(38,21,11,${.36+Math.random()*.22})`;
   ctx.lineWidth=2+Math.random()*3;
   ctx.beginPath();
   ctx.moveTo(0,y);
   for(let x=0;x<=c.width;x+=32){
     ctx.lineTo(x,y+Math.sin(x*.035+i)*2.8+Math.sin(x*.009)*2);
   }
   ctx.stroke();
   ctx.strokeStyle=`rgba(126,82,45,${.14+Math.random()*.12})`;
   ctx.lineWidth=.8+Math.random()*1.4;
   ctx.beginPath();
   ctx.moveTo(0,y-3);
   for(let x=0;x<=c.width;x+=32)ctx.lineTo(x,y-3+Math.sin(x*.035+i)*2.8);
   ctx.stroke();
 }
 const tex=new THREE.CanvasTexture(c);
 tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
 tex.repeat.set(1,1);tex.anisotropy=8;tex.colorSpace=THREE.SRGBColorSpace;
 return tex;
}
const ploughedTexture=makePloughedTexture();
const ploughedMaterial=new THREE.MeshStandardMaterial({
 map:ploughedTexture,roughness:1,metalness:0,transparent:true,opacity:.96,
 polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1
});
const ploughedG=new THREE.Group();world.add(ploughedG);

for(let r=0;r<FIELD.rows;r++){
 cells[r]=[];
 ploughedTiles[r]=[];
 for(let c=0;c<FIELD.cols;c++){
   const tone=[0x7a4f2f,0x71472a,0x805534,0x74492c][(r*3+c*5)%4];
   // Slightly overlapping tiles remove the old checkerboard gaps.
   const q=add(
     new THREE.PlaneGeometry(cw+.035,cd+.035),
     new THREE.MeshStandardMaterial({color:tone,map:soilTexture,transparent:true,opacity:.17,roughness:1}),
     FIELD.x1+(c+.5)*cw,.291,FIELD.z1+(r+.5)*cd,soilG
   );
   q.rotation.x=-Math.PI/2;
   cells[r][c]=false;q.userData.base=tone;

   const worked=add(
     new THREE.PlaneGeometry(cw+.02,cd+.02),
     ploughedMaterial.clone(),
     FIELD.x1+(c+.5)*cw,.307,FIELD.z1+(r+.5)*cd,ploughedG
   );
   worked.rotation.x=-Math.PI/2;
   worked.visible=false;
   ploughedTiles[r][c]=worked;
 }
}

// Deep, uneven agricultural furrows across the field.
const furrowG=new THREE.Group();world.add(furrowG);
const furrowMat=new THREE.MeshStandardMaterial({color:0x4a2c1b,roughness:1,metalness:0});
function addFurrow(cx){
 const segs=42;
 const across=[-.48,-.23,0,.23,.48];
 const heights=[.008,.055,-.026,.058,.010];
 const verts=[],indices=[];
 for(let iz=0;iz<=segs;iz++){
   const z=FIELD.z1+(iz/segs)*(FIELD.z2-FIELD.z1);
   const wob=Math.sin(z*.37+cx*.21)*.012+Math.sin(z*1.13+cx)*.006;
   for(let ix=0;ix<across.length;ix++){
     const x=cx+across[ix];
     const h=.292+heights[ix]+wob+(Math.random()-.5)*.004;
     verts.push(x,h,z);
   }
 }
 for(let iz=0;iz<segs;iz++)for(let ix=0;ix<4;ix++){
   const a=iz*5+ix,b=a+1,c=a+5,d=c+1;
   indices.push(a,c,b,b,c,d);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 geo.setIndex(indices);geo.computeVertexNormals();
 const m=new THREE.Mesh(geo,furrowMat);m.receiveShadow=true;furrowG.add(m);
}
for(let x=FIELD.x1+.9;x<FIELD.x2-.4;x+=2.35)addFurrow(x);

// Small scattered soil clumps for natural variation.
const clumpMat=M(0x56351f,.99);
for(let i=0;i<95;i++){
 const x=FIELD.x1+2+Math.random()*(FIELD.x2-FIELD.x1-4);
 const z=FIELD.z1+2+Math.random()*(FIELD.z2-FIELD.z1-4);
 const s=.045+Math.random()*.10;
 const cl=add(new THREE.IcosahedronGeometry(s,0),clumpMat,x,.305,z,furrowG);
 cl.scale.y=.45+Math.random()*.55;
}

function fieldCell(){
 const x=tractor.position.x,z=tractor.position.z;
 if(x<FIELD.x1||x>FIELD.x2||z<FIELD.z1||z>FIELD.z2)return null;
 return{c:Math.floor((x-FIELD.x1)/cw),r:Math.floor((z-FIELD.z1)/cd)};
}
function workedPct(){let a=0,n=FIELD.rows*FIELD.cols;for(const row of cells)for(const v of row)if(v)a++;return a/n}
function resetField(){for(let r=0;r<FIELD.rows;r++)for(let c=0;c<FIELD.cols;c++){cells[r][c]=false;soilG.children[r*FIELD.cols+c].material.color.setHex(soilG.children[r*FIELD.cols+c].userData.base);ploughedTiles[r][c].visible=false}}

// Barns and trees intentionally removed from the playable environment.
// Their visual meshes and collision proxies are omitted together so they
// cannot create invisible wall/trunk collisions.

// ===== VEHICLE: TRACTOR =====
// Tractor: front is local +Z. 3D recreation based on the uploaded NAGESHWAR 241 DI reference.
const tractor=new THREE.Group();scene.add(tractor);tractor.position.set(12,0,0);

// Materials
const tractorRed=M(0xc91f16,.62,.05);
const tractorRed2=M(0xe02d20,.58,.04);
const darkMetal=M(0x202321,.48,.35);
const black=M(0x121515,.90,.02);
const rubber=M(0x111313,.98,.01);
const silver=M(0xb9b9b5,.34,.68);
const chrome=M(0xd7d7d2,.23,.82);
const grey=M(0x4b4e4b,.55,.35);
const exhaustMat=M(0x181b1a,.65,.55);

// Main chassis and long bonnet, matching the simple agricultural body shape in the reference.
add(new THREE.BoxGeometry(4.15,.72,5.35),darkMetal,0,1.08,0,tractor);
add(new THREE.BoxGeometry(3.62,1.38,3.65),tractorRed,0,2.12,.88,tractor);
add(new THREE.BoxGeometry(3.32,.24,3.38),tractorRed2,0,2.93,.94,tractor);

// Raised rear deck / operator area.
add(new THREE.BoxGeometry(3.7,.28,1.75),tractorRed,0,2.55,-1.15,tractor);
add(new THREE.BoxGeometry(3.45,.20,1.70),darkMetal,0,2.39,-1.08,tractor);

// Front radiator/grille frame.
add(new THREE.BoxGeometry(3.38,2.08,.22),chrome,0,2.08,2.73,tractor);
add(new THREE.BoxGeometry(3.02,1.72,.13),black,0,2.12,2.86,tractor);
for(let i=-.65;i<=.65;i+=.28){
 add(new THREE.BoxGeometry(2.72,.085,.06),grey,0,2.12+i,2.95,tractor);
}

// Front bumper and center support.
add(new THREE.BoxGeometry(4.30,.38,.62),darkMetal,0,.62,3.03,tractor);
add(new THREE.BoxGeometry(.22,.72,.80),darkMetal,0,1.00,2.95,tractor);

// Headlights.
function headlight(x){
 const h=add(new THREE.CylinderGeometry(.27,.27,.16,24),chrome,x,2.28,3.02,tractor);
 h.rotation.x=Math.PI/2;
 const lens=add(new THREE.CylinderGeometry(.19,.19,.17,24),M(0xf4f2d2,.22,.08),x,2.28,3.11,tractor);
 lens.rotation.x=Math.PI/2;
}
headlight(-1.03);headlight(1.03);

// Front grille emblem panel.
add(new THREE.BoxGeometry(.55,.58,.08),darkMetal,0,1.98,3.04,tractor);

// Engine side covers and exposed lower engine details.
for(const x of[-1.84,1.84]){
 add(new THREE.BoxGeometry(.14,1.35,2.85),tractorRed2,x,2.06,.86,tractor);
 add(new THREE.BoxGeometry(.10,.58,1.95),darkMetal,x*1.002,1.45,.72,tractor);
 add(new THREE.BoxGeometry(.12,.28,1.40),grey,x*1.004,1.87,.02,tractor);
}
// Visible mechanical block / intake / exhaust pieces.
add(new THREE.BoxGeometry(2.05,.85,1.55),darkMetal,0,1.52,-.05,tractor);
add(new THREE.CylinderGeometry(.34,.34,1.55,20),grey,0,1.60,.70,tractor).rotation.z=Math.PI/2;
add(new THREE.CylinderGeometry(.24,.24,1.35,18),darkMetal,.82,1.90,.36,tractor).rotation.z=Math.PI/2;
add(new THREE.CylinderGeometry(.20,.20,.95,18),grey,-.75,1.65,.45,tractor).rotation.z=Math.PI/2;

// Large rear fenders and small front fenders.
for(const x of[-2.02,2.02]){
 add(new THREE.BoxGeometry(.24,.48,3.10),tractorRed,x,2.62,-1.28,tractor);
 add(new THREE.BoxGeometry(.26,.20,3.30),tractorRed2,x,2.91,-1.25,tractor);
}
for(const x of[-1.88,1.88]){
 add(new THREE.BoxGeometry(.20,.24,1.75),tractorRed2,x,1.60,1.63,tractor);
}

// Driver's seat, seat back, steering column and wheel.
add(new THREE.BoxGeometry(1.55,.22,1.25),black,0,2.88,-.78,tractor);
add(new THREE.BoxGeometry(1.34,1.02,.20),black,0,3.36,-1.33,tractor);
add(new THREE.CylinderGeometry(.09,.09,.68,14),darkMetal,0,2.66,.22,tractor);
const steerWheel=add(new THREE.TorusGeometry(.38,.058,12,26),black,0,3.20,.43,tractor);
steerWheel.rotation.x=Math.PI/2;
add(new THREE.BoxGeometry(.10,.62,.10),darkMetal,0,2.92,.20,tractor);

// Open-cab roll-over bar, like the reference tractor.
for(const x of[-1.34,1.34]){
 add(new THREE.CylinderGeometry(.095,.095,3.55,12),darkMetal,x,3.86,-1.18,tractor);
}
add(new THREE.BoxGeometry(2.88,.13,.13),darkMetal,0,5.62,-1.18,tractor);

// Tall exhaust pipe.
add(new THREE.CylinderGeometry(.13,.16,3.05,16),exhaustMat,1.53,3.78,.94,tractor);
add(new THREE.CylinderGeometry(.17,.17,.30,16),black,1.53,5.28,.94,tractor);

// Air cleaner / intake stack.
add(new THREE.CylinderGeometry(.18,.18,.98,16),grey,-1.25,4.12,.82,tractor);
add(new THREE.CylinderGeometry(.33,.33,.25,20),chrome,-1.25,4.65,.82,tractor);
add(new THREE.CylinderGeometry(.25,.25,.11,20),darkMetal,-1.25,4.83,.82,tractor);

// Mirrors and simple lights at the rear corners.
for(const x of[-1.60,1.60]){
 add(new THREE.BoxGeometry(.10,.72,.10),darkMetal,x,4.00,-.70,tractor);
 add(new THREE.CylinderGeometry(.20,.20,.07,20),darkMetal,x,4.42,-.70,tractor).rotation.z=Math.PI/2;
}

// Wheel system: keep the original reference names so all existing driving code continues to work.
const wheelPivots=[];
function wheel(x,z,r,front){
 const g=new THREE.Group();
 g.position.set(x,0,z);
 tractor.add(g);
 const tire=add(new THREE.CylinderGeometry(r,r,.90,32),rubber,0,r,0,g);
 tire.rotation.z=Math.PI/2;
 tire.userData.radius=r;
 // Raised tread blocks around each wheel for a more agricultural look.
// Realistic agricultural tractor tyre tread
const treadCount = 28;
const treadRadius = r-0.16;

for(let i = 0; i < treadCount; i++){

    const a = (i / treadCount) * Math.PI * 2;

    // Position around the tyre circumference
    const y = Math.cos(a) * treadRadius+1.1;
    const z = Math.sin(a) * treadRadius+0.1;

    // Alternating chevron direction
    const chevron = (i % 2 === 0) ? 1 : -1;

    // Left half of the tread
    const leftTread = add(
        new THREE.BoxGeometry(.42, .40, .70),
        black,
        -.23,
        y,
        z,
        g
    );

    leftTread.rotation.x = a;
    leftTread.rotation.z = chevron * 0.32;

    // Right half of the tread
    const rightTread = add(
        new THREE.BoxGeometry(.42, .30, .70),
        black,
        .23,
        y,
        z,
        g
    );

    rightTread.rotation.x = a;
    rightTread.rotation.z = -chevron * 0.32;
}
 const rim=add(new THREE.CylinderGeometry(r*.52,r*.52,.94,28),silver,0,r,0,g);
 rim.rotation.z=Math.PI/2;
 const hub=add(new THREE.CylinderGeometry(r*.20,r*.20,.98,20),grey,0,r,0,g);
 hub.rotation.z=Math.PI/2;
 for(let i=0;i<8;i++){
   const a=(i/8)*Math.PI*2;
   const bolt=add(new THREE.SphereGeometry(r*.045,8,8),chrome,Math.cos(a)*r*.31,r,Math.sin(a)*r*.31,g);
 }
 wheelPivots.push({g,w:tire,front});
 return g;
}
const FL=wheel(-1.96,1.62,.88,true);
const FR=wheel(1.96,1.62,.88,true);
const RL=wheel(-2.12,-1.58,1.28,false);
const RR=wheel(2.12,-1.58,1.28,false);

// Side decals: the main visual identity is NAGESHWAR 241 DI.
function makeSideDecal(){
 const canvas=document.createElement('canvas');
 canvas.width=1024;canvas.height=220;
 const ctx=canvas.getContext('2d');
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle='#e7e7e2';ctx.fillRect(14,32,996,156);
 ctx.strokeStyle='#1b1c1c';ctx.lineWidth=8;ctx.strokeRect(14,32,996,156);
 ctx.fillStyle='#151717';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.font='900 86px Arial Black, Arial, sans-serif';ctx.fillText('NAGESHWAR',500,86);
 ctx.font='700 54px Arial, sans-serif';ctx.fillText('241 DI',790,147);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
 const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide});
 return mat;
}
const sideDecal=makeSideDecal();
for(const x of[-2.012,2.012]){
 const decal=new THREE.Mesh(new THREE.PlaneGeometry(2.65,.57),sideDecal);
 decal.position.set(x,2.34,.94);
 decal.rotation.y=x<0?-Math.PI/2:Math.PI/2;
 tractor.add(decal);
}

// Rear three-point hitch + detachable plough
const plough=new THREE.Group();tractor.add(plough);plough.position.set(0,.18,-3.05);
add(new THREE.BoxGeometry(.28,.55,1.6),M(0x3d4542,.46,.35),0,.8,-2.1,tractor);
for(const x of[-.95,.95])add(new THREE.BoxGeometry(.13,.14,1.4),M(0x4b5350,.45,.4),x,.63,-2.62,tractor);
add(new THREE.BoxGeometry(4.0,.26,.36),M(0x5b6267,.46,.45),0,.7,0,plough);
for(let x=-1.5;x<=1.5;x+=.6){const t=add(new THREE.BoxGeometry(.13,.8,.34),M(0x202426,.38,.5),x,.25,-.67,plough);t.rotation.x=-.35}

// ===== VEHICLE: TRAILER & ATTACHMENTS =====
function makeTrailerSideTexture(){
  const c=document.createElement('canvas');c.width=1200;c.height=520;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#087bd2';ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle='#0b5eac';ctx.fillRect(0,0,c.width,38);
  ctx.fillStyle='#ffd31a';ctx.fillRect(0,245,c.width,42);
  ctx.fillStyle='#ffd31a';ctx.fillRect(0,455,c.width,14);
  ctx.strokeStyle='#9fe7ff';ctx.lineWidth=6;ctx.strokeRect(18,18,c.width-36,c.height-36);

  // Decorative painted floral motifs inspired by Indian farm-trailer artwork.
  for(let i=0;i<8;i++){
   const x=75+i*150,y=148+(i%2)*6;
   ctx.fillStyle=i%2?'#ffbf21':'#f25b38';
   for(let p=0;p<8;p++){
    const a=p*Math.PI/4;
    ctx.beginPath();ctx.ellipse(x+Math.cos(a)*22,y+Math.sin(a)*22,12,25,a,0,Math.PI*2);ctx.fill();
   }
   ctx.fillStyle='#f7e54b';ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle='#e9f7ff';ctx.font='900 46px Arial Black,Arial,sans-serif';ctx.textAlign='center';ctx.fillText('NAGESHWAR FARM TRAILER',600,88);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
  return tex;
}

// Articulated hitch: the trailer rotates around this pivot while following the tractor.
const trailerHitch=new THREE.Group();
tractor.add(trailerHitch);
trailerHitch.position.set(0,0,-3.80);

const trailer=new THREE.Group();
trailerHitch.add(trailer);
trailer.position.set(0,0,0);

const trailerBlue=M(0x087bd2,.60,.08);
const trailerBlueDark=M(0x07589e,.62,.10);
const trailerYellow=M(0xffd21a,.58,.05);
const trailerMetal=M(0x1d2327,.48,.58);
const trailerRubber=M(0x101313,.98,.01);

// =====================================================
// TRAILER SIZE CUSTOMIZATION
// Change only these four values to customize the trailer.
// =====================================================
const trailerLength = 6.90;      // Front-to-back cargo body length
const trailerWidth  = 4.25;      // Left-to-right body width
const trailerFloorY = 1.58;      // Floor/basement height above ground
const trailerWallHeight = 1.70;  // Side-wall height

// The wall sits directly on top of the floor.
const trailerWallY = trailerFloorY + trailerWallHeight/2;
const halfTrailerWidth = trailerWidth/2;

// Keep the wheel height independent so you can raise/lower the body
// without accidentally moving the wheels.
const trailerWheelRadius = .86;
const trailerWheelCenterY = .86;

// Derived positions.
const trailerFrontZ = -1.55;
const trailerRearZ = trailerFrontZ-trailerLength;
const trailerBodyCenterZ = (trailerFrontZ+trailerRearZ)/2;

// Derived trim heights.
// The upper rail automatically follows the wall height, so you can
// change trailerFloorY / trailerWallHeight without repositioning it.
const trailerUpperRailY = trailerWallY + .82;
const trailerLowerTrimY = trailerWallY + .45;

// Main cargo floor.
add(
  new THREE.BoxGeometry(trailerWidth,.24,trailerLength),
  trailerMetal,0,trailerFloorY,trailerBodyCenterZ,trailer
);

// Front wall.
add(
  new THREE.BoxGeometry(trailerWidth+.03,trailerWallHeight,.22),
  trailerBlue,0,trailerWallY,trailerFrontZ,trailer
);

// Rear wall.
add(
  new THREE.BoxGeometry(trailerWidth+.03,trailerWallHeight,.22),
  trailerBlue,0,trailerWallY,trailerRearZ,trailer
);

// Left side wall.
add(
  new THREE.BoxGeometry(.22,trailerWallHeight,trailerLength),
  trailerBlue,-halfTrailerWidth,trailerWallY,trailerBodyCenterZ,trailer
);

// Right side wall.
add(
  new THREE.BoxGeometry(.22,trailerWallHeight,trailerLength),
  trailerBlue,halfTrailerWidth,trailerWallY,trailerBodyCenterZ,trailer
);

// Upper rails and yellow trim.
for(const x of[-halfTrailerWidth-.065,halfTrailerWidth+.065]){
  add(
    new THREE.BoxGeometry(.22,.14,trailerLength),
    trailerYellow,x,trailerUpperRailY,trailerBodyCenterZ,trailer
  );
}
const trimWidth = trailerWidth+.36;
add(new THREE.BoxGeometry(trimWidth,.14,.24),trailerYellow,0,trailerUpperRailY,trailerFrontZ,trailer);
add(new THREE.BoxGeometry(trimWidth,.14,.20),trailerYellow,0,trailerUpperRailY,trailerRearZ-.02,trailer);

const lowerTrimWidth = trailerWidth-.03;
add(new THREE.BoxGeometry(lowerTrimWidth,.11,.11),trailerYellow,0,trailerLowerTrimY,trailerFrontZ,trailer);
add(new THREE.BoxGeometry(lowerTrimWidth,.11,.11),trailerYellow,0,trailerLowerTrimY,trailerRearZ,trailer);

// Painted side artwork panels.
const trailerSideMat=new THREE.MeshBasicMaterial({map:makeTrailerSideTexture(),side:THREE.DoubleSide});
const trailerSideX = halfTrailerWidth + .13;
const trailerArtworkLength = Math.max(1.5,trailerLength-1.50);
for(const x of[-trailerSideX,trailerSideX]){
  const d=new THREE.Mesh(
    new THREE.PlaneGeometry(trailerArtworkLength,Math.max(1.0,trailerWallHeight-.67)),
    trailerSideMat
  );
  d.position.set(x,trailerWallY,trailerBodyCenterZ);
  d.rotation.y=x<0?-Math.PI/2:Math.PI/2;
  trailer.add(d);
}

// Long agricultural drawbar / tongue.
// Two heavy arms form a proper A-frame from the trailer front to the hitch.
function addBeamBetween(a,b,thick,mat,parent){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  const len=Math.hypot(dx,dy,dz);
  const beam=add(new THREE.BoxGeometry(thick,thick,len),mat,0,0,0,parent);
  beam.position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(dx,dy,dz).normalize());
  return beam;
}
const drawbarFrontZ=trailerFrontZ;
const drawbarHalfWidth = halfTrailerWidth*.667;
for(const x of[-drawbarHalfWidth,drawbarHalfWidth]){
  addBeamBetween(
    new THREE.Vector3(x,trailerFloorY-.10,drawbarFrontZ),
    new THREE.Vector3(0,trailerFloorY-.02,.15),
    .26,trailerMetal,trailer
  );
}
// Central spine plus front cross member and reinforced coupling end.
addBeamBetween(
  new THREE.Vector3(0,trailerFloorY-.04,drawbarFrontZ),
  new THREE.Vector3(0,trailerFloorY+.02,.12),
  .30,trailerMetal,trailer
);
add(new THREE.BoxGeometry(Math.max(2.2,trailerWidth-.90),.24,.30),trailerMetal,0,trailerFloorY-.10,trailerFrontZ,trailer);
add(new THREE.BoxGeometry(.55,.24,.42),trailerMetal,0,trailerFloorY,.10,trailer);
add(new THREE.SphereGeometry(.18,16,12),trailerMetal,0,trailerFloorY+.02,.12,trailer);

// Chassis spine under the longer trailer body.
add(new THREE.BoxGeometry(Math.min(2.4,Math.max(1.8,trailerWidth-.80)),.28,trailerLength-.55),trailerMetal,0,trailerFloorY-.25,trailerBodyCenterZ,trailer);

// Single agricultural axle: only two wheels, one on each side.
const trailerWheelPivots=[];
function trailerWheel(x,z){
  const g=new THREE.Group();g.position.set(x,trailerWheelCenterY,z);trailer.add(g);
  const tire=add(new THREE.CylinderGeometry(trailerWheelRadius,trailerWheelRadius,.62,32),trailerRubber,0,0,0,g);tire.rotation.z=Math.PI/2;
  for(let i=0;i<20;i++){
    const a=(i/20)*Math.PI*2;
    const lug=add(new THREE.BoxGeometry(.12,.12,.36),trailerRubber,0,Math.cos(a)*(trailerWheelRadius+.04),Math.sin(a)*(trailerWheelRadius+.04),g);
    lug.rotation.x=a;lug.rotation.y=Math.PI/2;
  }
  const rim=add(new THREE.CylinderGeometry(trailerWheelRadius*.547,trailerWheelRadius*.547,.66,28),silver,0,0,0,g);rim.rotation.z=Math.PI/2;
  const hub=add(new THREE.CylinderGeometry(trailerWheelRadius*.209,trailerWheelRadius*.209,.70,20),grey,0,0,0,g);hub.rotation.z=Math.PI/2;
  trailerWheelPivots.push({g,w:tire,r:trailerWheelRadius});
}

// One axle toward the rear half of the trailer body.
const trailerAxleZ=trailerRearZ+2.10;
trailerWheel(-(halfTrailerWidth+.125),trailerAxleZ);
trailerWheel(halfTrailerWidth+.125,trailerAxleZ);

// Wheel guards above the single axle.
// Kept above the tyre so the blue bar no longer intersects the upper tyre.
const trailerMudguardX = halfTrailerWidth + .125;
const trailerMudguardY = trailerWheelCenterY + trailerWheelRadius + .16;
const trailerMudguardLength = trailerWheelRadius*2.05;

add(
  new THREE.BoxGeometry(.24,.18,trailerMudguardLength),
  trailerBlueDark,
  -trailerMudguardX,
  trailerMudguardY,
  trailerAxleZ,
  trailer
);
add(
  new THREE.BoxGeometry(.24,.18,trailerMudguardLength),
  trailerBlueDark,
  trailerMudguardX,
  trailerMudguardY,
  trailerAxleZ,
  trailer
);

// Detachable support/jack stand (visible while parked detached).
const trailerJack=new THREE.Group();
trailer.add(trailerJack);
add(new THREE.CylinderGeometry(.07,.09,1.05,12),trailerMetal,0,.46,.16,trailerJack);
add(new THREE.BoxGeometry(.62,.12,.42),trailerMetal,0,.06,.16,trailerJack);
trailerJack.position.set(0,0,trailerFrontZ+.25);
trailerJack.visible=false;

// Visible hitch/coupling pin.
const trailerCoupler=add(new THREE.CylinderGeometry(.16,.16,.28,18),trailerMetal,0,trailerFloorY+.02,.12,trailer);
trailerCoupler.rotation.z=Math.PI/2;

let ploughAttached=true;
let trailerAttached=true;
let trailerArticulation=0;
let trailerPrevTractorYaw=tractor.rotation.y;

// Heavy physical trailer state. When detached it becomes a free rigid body;
// when attached it is constrained by the hitch but still collides with the world.
const TRAILER_PHYSICS={
 mass:2200,
 rollingResistance:1.55,
 restitution:.08,
 maxSpeed:8.5,
 boundary:356,
 halfWidth:trailerWidth/2+.18,
 halfLength:trailerLength/2+.38,
 impactDamageScale:1.85
};
const detachedTrailerPhysics={velocity:new THREE.Vector2(0,0),angularVelocity:0};
let lastTrailerImpactAt=-Infinity;
let lastTrailerEnvironmentImpactAt=-Infinity;
// Contact-management state keeps collisions stable instead of repeatedly
// correcting penetration every frame (which can make a follow camera shake).
let trailerContactCooldown=0;
let trailerEnvContactCooldown=0;
trailer.userData.collisionEnabled=true;
trailer.userData.isDetachedCollisionless=false;

// Heavy detached plough state. The implement is treated as a rigid, damped
// object when detached and as a constrained implement when attached.
const PLOUGH_PHYSICS={
 mass:720,
 rollingResistance:2.25,
 maxPushSpeed:.42,
 maxAngularSpeed:.11,
 impactDamageScale:1.55,
 boundary:356,
 halfWidth:2.10,
 bodyHalfLength:.26
};
const detachedPloughPhysics={velocity:new THREE.Vector2(0,0),angularVelocity:0};
let lastPloughImpactAt=-Infinity;
let lastPloughEnvironmentImpactAt=-Infinity;
let ploughContactCooldown=0;
let ploughEnvContactCooldown=0;
plough.userData.collisionEnabled=true;
plough.userData.isDetachedCollisionless=false;
// ===== END VEHICLE: TRAILER & ATTACHMENTS =====

// ===== GAME STATE & FIELD WORK =====
const trail=new THREE.Group();world.add(trail);
let lastRear=null,furrowTick=0;
function clearTrail(){while(trail.children.length)trail.remove(trail.children[0]);lastRear=null;furrowTick=0}
function trailSegment(a,b,w){
 const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.03)return;
 const q=new THREE.Mesh(new THREE.BoxGeometry(w,.026,len),M(0x4d321e,.99));
 q.position.set((a.x+b.x)/2,.30,(a.z+b.z)/2);q.rotation.y=Math.atan2(dx,dz);q.receiveShadow=true;trail.add(q);
 while(trail.children.length>650)trail.remove(trail.children[0]);
}
function updateTrail(dt){
 const fc=fieldCell(),active=controls.plough && fc && Math.abs(speed)>.4 && !state.done;
 if(!active){lastRear=null;furrowTick=0;return}
 const front=new THREE.Vector3(0,0,1).applyQuaternion(tractor.quaternion).normalize();
 const left=new THREE.Vector3(-front.z,0,front.x);
 const rear=tractor.position.clone().addScaledVector(front,-3.2);
 if(lastRear){
  for(const off of[-1.5,-0.75,0,0.75,1.5]){
   trailSegment(lastRear.clone().addScaledVector(left,off),rear.clone().addScaledVector(left,off),.09)
  }
 }
 lastRear=rear;
}

// State / controls
const state={started:false,paused:false,gear:0,cam:0,money:500,fuel:100,damage:0,done:false};
const controls={w:false,a:false,s:false,d:false,up:false,down:false,left:false,right:false,plough:false,hand:false};

// ===== RIGID VEHICLE PHYSICS =====
// The game is fully client-side and uses deterministic custom vehicle motion.
// The tractor and trailer use custom rigid-body style collision handling.
// The trailer remains a physical object whether attached or detached: it can
// contact the environment and the tractor, but collision response is smoothed
// so the follow camera never receives a per-frame teleport/jitter correction.
const RIGID={
  maxForwardSpeed:[0,5.0,7.5,9.8,12.0,14.0],
  reverseSpeed:3.5,
  engineAccel:2.55,
  brakeAccel:6.8,
  rollingResistance:0.68,
  steerResponse:2.8,
  steerAtSpeedResponse:2.2,
  wheelBase:3.3,
  steeringLock:0.52,
  yawGrip:0.90,
  hitchStiffness:24.0,
  hitchDamping:7.0,
  hitchMax:THREE.MathUtils.degToRad(34),
  groundY:0,
  tractorMass:2800,
  tractorHalfWidth:2.18,
  tractorHalfLength:2.85,
  collisionRestitution:.06,
  collisionDamageScale:2.45,
  trailerWorldCollision:true,
  trailerVehicleCollision:true
};
let speed=0,steer=0,rpm=850,weather='clear',last=performance.now();
let trailerArticulationVelocity=0;


function safeNumber(v,f,min,max){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):f}
function showToast(t){const e=document.getElementById('toast');e.textContent=t;e.classList.add('on');clearTimeout(showToast.t);showToast.t=setTimeout(()=>e.classList.remove('on'),1500)}
function setGear(g){
 const next=Math.max(-1,Math.min(5,Math.round(Number(g))));
 if((next<=0)&&Math.abs(speed)>1.0){showToast('Stop to select R / N');return}
 state.gear=next;updateGearUI()
}
function updateGearUI(){
 const name=state.gear<0?'R':state.gear===0?'N':String(state.gear);
 document.getElementById('gear').textContent=name;
 document.querySelectorAll('.gearBtn').forEach(b=>b.classList.toggle('active',Number(b.dataset.gear)===state.gear));
}
function togglePlough(){controls.plough=!controls.plough;document.querySelector('#ploughBtn span').textContent=controls.plough?'DOWN':'UP';document.getElementById('ploughBtn').classList.toggle('active',controls.plough)}
function toggleHand(){controls.hand=!controls.hand;document.querySelector('#handBtn span').textContent=controls.hand?'ON':'OFF';document.getElementById('handBtn').classList.toggle('active',controls.hand)}
function cycleCamera(){state.cam=(state.cam+1)%3;const name=['CHASE','CABIN','ORBIT'][state.cam];document.querySelector('#cameraBtn span').textContent=name;showToast('Camera: '+name)}
function service(){if(state.money<80){showToast('Need $80');return}state.money-=80;state.fuel=100;state.damage=0;showToast('Tractor serviced')}
function pause(){state.paused=!state.paused;document.getElementById('pauseBtn').textContent=state.paused?'▶ Resume':'⏸ Pause';if(state.paused){Object.keys(controls).forEach(k=>controls[k]=false)}}
function clearControls(){Object.keys(controls).forEach(k=>controls[k]=false);toggleVisuals()}
function toggleVisuals(){
 const pl=controls.plough, hb=controls.hand;
 document.querySelector('#ploughBtn span').textContent=pl?'DOWN':'UP';
 document.querySelector('#handBtn span').textContent=hb?'ON':'OFF';
 document.getElementById('ploughBtn').classList.toggle('active',pl);
 document.getElementById('handBtn').classList.toggle('active',hb);
}

// ===== ATTACHMENT CONTROLS =====
function setPloughAttached(attached){
 attached=!!attached;
 if(attached===ploughAttached)return;
 controls.plough=false;
 if(attached){
  tractor.attach(plough);
  plough.position.set(0,.18,-3.05);
  plough.rotation.set(0,0,0);
  detachedPloughPhysics.velocity.set(0,0);
  detachedPloughPhysics.angularVelocity=0;
 }else{
  const worldPosition=plough.getWorldPosition(new THREE.Vector3());
  const worldQuaternion=plough.getWorldQuaternion(new THREE.Quaternion());
  const worldScale=plough.getWorldScale(new THREE.Vector3());
  world.attach(plough);
  plough.position.copy(worldPosition);
  plough.quaternion.copy(worldQuaternion);
  plough.scale.copy(worldScale);
  plough.position.y=0;
  plough.rotation.x=0;
  plough.rotation.z=0;
  detachedPloughPhysics.velocity.set(0,0);
  detachedPloughPhysics.angularVelocity=0;
 }
 plough.userData.collisionEnabled=true;
 plough.userData.isDetachedCollisionless=false;
 ploughAttached=attached;
 updateAttachmentUI();
}

function setTrailerAttached(attached){
 attached=!!attached;
 if(attached===trailerAttached)return;
 if(attached){
  const trailerWorldPos=trailer.getWorldPosition(new THREE.Vector3());
  if(Math.hypot(trailerWorldPos.x-tractor.position.x,trailerWorldPos.z-tractor.position.z)>12){showToast('Move closer to the trailer');return;}
  tractor.add(trailerHitch);
  trailerHitch.add(trailer);
  trailer.position.set(0,0,0);
  trailer.rotation.set(0,0,0);
  trailerArticulation=0;
  trailerArticulationVelocity=0;
  trailerHitch.rotation.set(0,0,0);
  trailerJack.visible=false;
  trailerPrevTractorYaw=tractor.rotation.y;
  detachedTrailerPhysics.velocity.set(0,0);
  detachedTrailerPhysics.angularVelocity=0;
 }else{
  const worldPosition=trailer.getWorldPosition(new THREE.Vector3());
  const worldQuaternion=trailer.getWorldQuaternion(new THREE.Quaternion());
  const worldScale=trailer.getWorldScale(new THREE.Vector3());
  trailerHitch.remove(trailer);
  world.add(trailer);
  trailer.position.copy(worldPosition);
  trailer.quaternion.copy(worldQuaternion);
  trailer.scale.copy(worldScale);
  trailer.position.y=0;
  trailer.rotation.x=0;
  trailer.rotation.z=0;
  trailerArticulationVelocity=0;
  trailerJack.visible=true;
  detachedTrailerPhysics.velocity.set(0,0);
  detachedTrailerPhysics.angularVelocity=0;
 }
 trailer.userData.isDetachedCollisionless=false;
 trailer.userData.collisionEnabled=true;
 trailerAttached=attached;
 updateAttachmentUI();
}

function togglePloughAttachment(){setPloughAttached(!ploughAttached);showToast(ploughAttached?'Plough attached':'Plough detached')}
function toggleTrailerAttachment(){setTrailerAttached(!trailerAttached);showToast(trailerAttached?'Trailer attached':'Trailer detached')}

function updateAttachmentUI(){
 if(ploughAttachButton){
  const s=ploughAttachButton.querySelector('span');if(s)s.textContent=ploughAttached?'ATTACHED':'DETACHED';
  ploughAttachButton.classList.toggle('active',ploughAttached);
 }
 if(trailerAttachButton){
  const s=trailerAttachButton.querySelector('span');if(s)s.textContent=trailerAttached?'ATTACHED':'DETACHED';
  trailerAttachButton.classList.toggle('active',trailerAttached);
 }
}

const ploughAttachButton=document.getElementById('ploughAttachBtn');
const trailerAttachButton=document.getElementById('trailerAttachBtn');

// Wire the visible buttons to the same attachment functions used by Z / V.
// The previous refactor created the buttons in HTML but did not bind their
// click events, so the labels appeared correctly while mouse/touch clicks did nothing.
ploughAttachButton?.addEventListener('click',e=>{
 e.preventDefault();
 togglePloughAttachment();
});

trailerAttachButton?.addEventListener('click',e=>{
 e.preventDefault();
 toggleTrailerAttachment();
});

updateAttachmentUI();

// Do not allow ploughing while the plough is physically detached.
window.addEventListener('keydown',e=>{
 if(e.code==='Space' && !ploughAttached){
  e.preventDefault();e.stopImmediatePropagation();showToast('Attach plough first');
 }
},true);

document.getElementById('ploughBtn')?.addEventListener('click',e=>{
 if(!ploughAttached){e.preventDefault();e.stopImmediatePropagation();showToast('Attach plough first');}
},true);

// Z = plough attach/detach, V = trailer attach/detach.
window.addEventListener('keydown',e=>{
 if(e.repeat)return;
 if(e.code==='KeyZ'){togglePloughAttachment();e.preventDefault();}
 if(e.code==='KeyV'){toggleTrailerAttachment();e.preventDefault();}
},{passive:false});

// Real articulated trailer kinematics.
// The trailer follows the tractor through the hitch and develops a natural
// angle during turns, limited to +/- 35 degrees.
function updateTrailerArticulation(dt){
 if(!trailerAttached){
  trailerPrevTractorYaw=tractor.rotation.y;
  trailerArticulationVelocity=0;
  return;
 }

 // The articulation angle behaves like a stiff mechanical hitch.  It responds
 // to tractor yaw but is heavily damped, so the trailer follows as a real heavy
 // implement instead of swinging like a loose pendulum.
 const yawDelta=Math.atan2(
   Math.sin(tractor.rotation.y-trailerPrevTractorYaw),
   Math.cos(tractor.rotation.y-trailerPrevTractorYaw)
 );
 const yawRate=yawDelta/Math.max(dt,.001);
 trailerPrevTractorYaw=tractor.rotation.y;

 const trailerEffectiveLength=trailerLength+1.70;
 const recovery=(Math.abs(speed)/Math.max(trailerEffectiveLength,.001))*Math.sin(trailerArticulation);
 const targetVelocity=-yawRate-recovery;
 trailerArticulationVelocity=damp(
   trailerArticulationVelocity,
   targetVelocity,
   RIGID.hitchDamping,
   dt
 );
 trailerArticulationVelocity=damp(
   trailerArticulationVelocity,
   targetVelocity,
   RIGID.hitchStiffness,
   dt
 );
 trailerArticulation+=trailerArticulationVelocity*dt;

 // Hard mechanical steering stop.
 if(trailerArticulation>RIGID.hitchMax){
  trailerArticulation=RIGID.hitchMax;
  trailerArticulationVelocity=Math.min(0,trailerArticulationVelocity)*0.18;
 }else if(trailerArticulation<-RIGID.hitchMax){
  trailerArticulation=-RIGID.hitchMax;
  trailerArticulationVelocity=Math.max(0,trailerArticulationVelocity)*0.18;
 }

 // No pitch/roll on a rigid, level trailer chassis.
 trailer.position.set(0,0,0);
 // Kinematic trailer: no physics/collision response from the environment.
 // Keep its chassis rigid and prevent accidental pitch/roll from any external code.
 trailer.rotation.x=0;
 trailer.rotation.z=0;
 trailerHitch.rotation.x=0;
 trailerHitch.rotation.z=0;
 trailerHitch.rotation.y=trailerArticulation;
}

// Keep the two trailer wheels rotating.
function trailerWheelVisualLoop(){
 const travel=trailerAttached?speed:detachedTrailerPhysics.velocity.y;
 if(Math.abs(travel)>.0001){for(const o of trailerWheelPivots)o.w.rotation.x+=travel*.016/(o.r||1);}
 requestAnimationFrame(trailerWheelVisualLoop);
}
trailerWheelVisualLoop();
// ===== END ATTACHMENT CONTROLS =====

// ===== INPUT: KEYBOARD =====
window.addEventListener('keydown',e=>{
 if(!state.started){
  if(e.code==='Enter'){startFarmRush();e.preventDefault()}
  return;
 }
 if(state.paused){if(e.code==='Escape'){pause();e.preventDefault()}return}
 switch(e.code){
  case 'KeyW':controls.w=true;break;case 'KeyA':controls.a=true;break;case 'KeyS':controls.s=true;break;case 'KeyD':controls.d=true;break;
  case 'ArrowUp':controls.up=true;break;case 'ArrowDown':controls.down=true;break;case 'ArrowLeft':controls.left=true;break;case 'ArrowRight':controls.right=true;break;
  case 'Space':controls.plough=true;e.preventDefault();break;
  case 'ShiftLeft':case 'ShiftRight':controls.hand=true;e.preventDefault();break;
  case 'KeyQ':if(!e.repeat)setGear(state.gear-1);break;
  case 'KeyE':if(!e.repeat)setGear(state.gear+1);break;
  case 'KeyR':if(!e.repeat)setGear(-1);break;
  case 'KeyN':if(!e.repeat)setGear(0);break;
  case 'Digit1':if(!e.repeat)setGear(1);break;case 'Digit2':if(!e.repeat)setGear(2);break;case 'Digit3':if(!e.repeat)setGear(3);break;case 'Digit4':if(!e.repeat)setGear(4);break;case 'Digit5':if(!e.repeat)setGear(5);break;
  case 'KeyX':case 'KeyC':if(!e.repeat)cycleCamera();break;
  case 'KeyT':if(!e.repeat)service();break;
  case 'Escape':if(!e.repeat)pause();break;
 }
 toggleVisuals();
},{passive:false});
window.addEventListener('keyup',e=>{
 switch(e.code){
  case 'KeyW':controls.w=false;break;case 'KeyA':controls.a=false;break;case 'KeyS':controls.s=false;break;case 'KeyD':controls.d=false;break;
  case 'ArrowUp':controls.up=false;break;case 'ArrowDown':controls.down=false;break;case 'ArrowLeft':controls.left=false;break;case 'ArrowRight':controls.right=false;break;
  case 'Space':controls.plough=false;break;case 'ShiftLeft':case 'ShiftRight':controls.hand=false;break;
 }
 toggleVisuals();
},{passive:false});

document.querySelectorAll('.gearBtn').forEach(b=>b.onclick=()=>setGear(Number(b.dataset.gear)));
document.getElementById('ploughBtn').onclick=togglePlough;
document.getElementById('handBtn').onclick=toggleHand;
document.getElementById('cameraBtn').onclick=cycleCamera;
document.getElementById('serviceBtn').onclick=service;
document.getElementById('pauseBtn').onclick=pause;

// ===== INPUT: TOUCH =====
function bindTouch(id,key){
 const el=document.getElementById(id);if(!el)return;
 const down=e=>{e.preventDefault();controls[key]=true;el.setPointerCapture?.(e.pointerId);};
 const up=e=>{e.preventDefault();controls[key]=false;};
 el.addEventListener('pointerdown',down,{passive:false});
 el.addEventListener('pointerup',up,{passive:false});
 el.addEventListener('pointercancel',up,{passive:false});
 el.addEventListener('lostpointercapture',up,{passive:false});
}
bindTouch('tl','left');bindTouch('tr','right');bindTouch('tf','up');bindTouch('tb','down');

// Added: start/resume audio only from real user interaction (browser autoplay policy).
document.addEventListener('pointerdown',()=>audio.init(),{passive:true});
window.addEventListener('keydown',()=>audio.init(),{passive:true});

function engineSoundLoop(){
 audio.updateEngine({state,controls,rpm,speed});
 requestAnimationFrame(engineSoundLoop);
}
engineSoundLoop();


// ===== GAME STARTUP =====
if(!FL||!FR||!RL||!RR){
 const box=document.getElementById('diagnostic');box.style.display='grid';
 document.getElementById('diagnosticText').textContent='Vehicle wheel initialization failed.';
 throw new Error('Vehicle wheel references missing');
}

// Safe startup placement. The chosen point is tested against the actual
// environment colliders using the full tractor + attached implement footprints.
const START_SPAWN_POINTS=[
 {x:12,z:0},
 {x:18,z:0},
 {x:12,z:-10},
 {x:18,z:-10},
 {x:8,z:10},
 {x:22,z:0},
 {x:0,z:10}
];
function overlapsEnvironmentAtSpawn(){
 const tractorBox=makeOBB(tractor.position.x,tractor.position.z,tractor.rotation.y,RIGID.tractorHalfWidth,RIGID.tractorHalfLength);
 for(const c of environmentColliders){
  const hit=c.type==='circle'
   ? circleVsOBB(c.x,c.z,c.r,tractorBox)
   : obbOverlap(tractorBox,makeOBB(c.x,c.z,c.yaw,c.halfWidth,c.halfLength));
  if(hit && hit.depth>.12)return true;
 }
 if(trailerAttached){
  const tbox=getTrailerWorldOBB();
  for(const c of environmentColliders){
   const hit=c.type==='circle'
    ? circleVsOBB(c.x,c.z,c.r,tbox)
    : obbOverlap(tbox,makeOBB(c.x,c.z,c.yaw,c.halfWidth,c.halfLength));
   if(hit && hit.depth>.12)return true;
  }
 }
 if(ploughAttached){
  for(const shape of getPloughCollisionShapes()){
   for(const c of environmentColliders){
    const hit=c.type==='circle'
     ? circleVsOBB(c.x,c.z,c.r,shape.obb)
     : obbOverlap(shape.obb,makeOBB(c.x,c.z,c.yaw,c.halfWidth,c.halfLength));
    if(hit && hit.depth>.12)return true;
   }
  }
 }
 return false;
}
function selectSafeSpawn(){
 const original=tractor.position.clone();
 for(const p of START_SPAWN_POINTS){
  tractor.position.set(p.x,RIGID.groundY,p.z);
  tractor.rotation.y=0;
  tractor.updateMatrixWorld(true);
  if(!overlapsEnvironmentAtSpawn())return p;
 }
 tractor.position.copy(original);
 return {x:original.x,z:original.z};
}

function startFarmRush(){
 if(state.started)return;
 document.getElementById('diagnostic').style.display='none';
 const spawn=selectSafeSpawn();
 tractor.position.set(spawn.x,RIGID.groundY,spawn.z);
 tractor.rotation.y=0;
 trailerHitch.rotation.set(0,0,0);
 trailerArticulation=0;
 trailerPrevTractorYaw=0;
 state.started=true;state.paused=false;state.gear=1;speed=0;steer=0;rpm=850;
 cameraFollow.initialized=false;
 document.getElementById('start').style.display='none';
 updateGearUI();toggleVisuals();showToast('W forward • A left • D right');
};

const startButton = document.getElementById('startButton');

startButton.addEventListener('click', () => {
  startFarmRush();
});

// ===== PHYSICAL COLLISION SYSTEM =====
function bodyAxes(yaw){
 const f=new THREE.Vector2(Math.sin(yaw),Math.cos(yaw));
 const r=new THREE.Vector2(Math.cos(yaw),-Math.sin(yaw));
 return {f,r};
}
function makeOBB(x,z,yaw,halfWidth,halfLength){
 const a=bodyAxes(yaw);
 return {center:new THREE.Vector2(x,z),f:a.f,r:a.r,halfWidth,halfLength};
}
function getTrailerYaw(){
 const q=trailer.getWorldQuaternion(new THREE.Quaternion());
 return new THREE.Euler().setFromQuaternion(q,'YXZ').y;
}
function getTrailerCollisionShapes(){
 const p=trailer.getWorldPosition(new THREE.Vector3());
 const yaw=getTrailerYaw();
 const a=bodyAxes(yaw);

 // Compound collision footprint follows the actual trailer geometry instead
 // of using the hitch origin as the trailer body center. This covers the
 // complete cargo body and the front drawbar/hitch area.
 const bodyCenterZ=trailerBodyCenterZ;
 const body=makeOBB(
  p.x+a.f.x*bodyCenterZ,
  p.z+a.f.y*bodyCenterZ,
  yaw,
  trailerWidth/2+.24,
  trailerLength/2+.24
 );

 const drawbarCenterZ=(drawbarFrontZ+.16)/2;
 const drawbarHalfLength=Math.abs(.16-drawbarFrontZ)/2+.18;
 const drawbar=makeOBB(
  p.x+a.f.x*drawbarCenterZ,
  p.z+a.f.y*drawbarCenterZ,
  yaw,
  Math.min(1.05,trailerWidth/2-.12),
  drawbarHalfLength
 );

 const rearCap=makeOBB(
  p.x+a.f.x*(trailerRearZ-.08),
  p.z+a.f.y*(trailerRearZ-.08),
  yaw,
  trailerWidth/2+.30,
  .20
 );

 return [
  {obb:body,kind:'body'},
  {obb:drawbar,kind:'drawbar'},
  {obb:rearCap,kind:'rear'}
 ];
}
function getTrailerWorldOBB(){
 return getTrailerCollisionShapes()[0].obb;
}
function obbOverlap(a,b){
 const axes=[a.f,a.r,b.f,b.r];
 const d=b.center.clone().sub(a.center);
 let minOverlap=Infinity,minAxis=null,minSign=1;
 for(const rawAxis of axes){
  const axis=rawAxis.clone().normalize();
  const ra=a.halfLength*Math.abs(axis.dot(a.f))+a.halfWidth*Math.abs(axis.dot(a.r));
  const rb=b.halfLength*Math.abs(axis.dot(b.f))+b.halfWidth*Math.abs(axis.dot(b.r));
  const distance=d.dot(axis);
  const overlap=ra+rb-Math.abs(distance);
  if(overlap<=0)return null;
  if(overlap<minOverlap){minOverlap=overlap;minAxis=axis;minSign=distance>=0?1:-1;}
 }
 return {normal:minAxis.clone().multiplyScalar(minSign),depth:minOverlap};
}
function circleVsOBB(cx,cz,r,box){
 const rel=new THREE.Vector2(cx-box.center.x,cz-box.center.y);
 const localX=rel.dot(box.r),localZ=rel.dot(box.f);
 const qx=THREE.MathUtils.clamp(localX,-box.halfWidth,box.halfWidth);
 const qz=THREE.MathUtils.clamp(localZ,-box.halfLength,box.halfLength);
 let dx=localX-qx,dz=localZ-qz;
 const distSq=dx*dx+dz*dz;
 if(distSq>r*r)return null;
 let normalLocal,depth;
 if(distSq>.000001){
  const dist=Math.sqrt(distSq);normalLocal=new THREE.Vector2(dx/dist,dz/dist);depth=r-dist;
 }else{
  const faceX=box.halfWidth-Math.abs(localX),faceZ=box.halfLength-Math.abs(localZ);
  if(faceX<faceZ){normalLocal=new THREE.Vector2(localX>=0?1:-1,0);depth=r+faceX;}
  else{normalLocal=new THREE.Vector2(0,localZ>=0?1:-1);depth=r+faceZ;}
 }
 const n=box.r.clone().multiplyScalar(normalLocal.x).add(box.f.clone().multiplyScalar(normalLocal.y));
 return {normal:n.normalize(),depth};
}
function applyTractorImpact(damage){state.damage=Math.min(100,state.damage+damage);}

function resolveTractorVsDetachedTrailer(dt){
 if(trailerAttached)return;
 const tractorBox=makeOBB(
  tractor.position.x,tractor.position.z,tractor.rotation.y,
  RIGID.tractorHalfWidth,RIGID.tractorHalfLength
 );
 const trailerShapes=getTrailerCollisionShapes();
 let hit=null;
 for(const shape of trailerShapes){
  const candidate=obbOverlap(tractorBox,shape.obb);
  if(candidate && (!hit || candidate.depth>hit.depth)){
   hit={...candidate,kind:shape.kind};
  }
 }
 if(!hit){
  trailerContactCooldown=Math.max(0,trailerContactCooldown-dt);
  return;
 }

 const tractorForward=new THREE.Vector2(Math.sin(tractor.rotation.y),Math.cos(tractor.rotation.y));
 const tractorVelocity=tractorForward.clone().multiplyScalar(speed);
 const trailerVelocity=detachedTrailerPhysics.velocity.clone();
 const relativeVelocity=tractorVelocity.clone().sub(trailerVelocity);
 const closingSpeed=Math.max(0,relativeVelocity.dot(hit.normal));

 // Never teleport the tractor. Bleed off only the motion driving into the
 // detached trailer so the vehicle/camera remains stable.
 if(closingSpeed>.02){
  const into=Math.max(0,tractorVelocity.dot(hit.normal));
  speed*=THREE.MathUtils.clamp(1-into*.22,0,.82);
 }

 // Very small bounded depenetration. The trailer itself moves away from the
 // tractor; repeated contact frames continue smoothly until separated.
 const separation=THREE.MathUtils.clamp(hit.depth*.34,0,.075);
 if(separation>.002){
  trailer.position.x+=hit.normal.x*separation;
  trailer.position.z+=hit.normal.y*separation;
 }

 // Heavy trailer: small, damped movement away from the impact, never a launch.
 const pushSpeed=THREE.MathUtils.clamp(.10+closingSpeed*.022,.10,.34);
 const targetPush=hit.normal.clone().multiplyScalar(pushSpeed);
 detachedTrailerPhysics.velocity.lerp(targetPush,1-Math.exp(-5.2*dt));
 detachedTrailerPhysics.velocity.clampLength(0,.40);

 const lateralNormal=new THREE.Vector2(-hit.normal.y,hit.normal.x);
 const lateralImpact=Math.abs(relativeVelocity.dot(lateralNormal));
 const yawKick=THREE.MathUtils.clamp(lateralImpact*.010,-.075,.075);
 detachedTrailerPhysics.angularVelocity=THREE.MathUtils.lerp(
  detachedTrailerPhysics.angularVelocity,
  yawKick,
  1-Math.exp(-4.5*dt)
 );
 detachedTrailerPhysics.angularVelocity=THREE.MathUtils.clamp(
  detachedTrailerPhysics.angularVelocity,-.12,.12
 );

 const now=performance.now()/1000;
 if(closingSpeed>.8 && now-lastTrailerImpactAt>.60){
  applyTractorImpact(Math.min(38,closingSpeed*TRAILER_PHYSICS.impactDamageScale));
  lastTrailerImpactAt=now;
  trailerContactCooldown=.60;
  showToast(`Trailer impact • ${Math.round(closingSpeed*3.25)} km/h`);
 }
}

function resolveTrailerEnvironment(dt){
 if(!TRAILER_PHYSICS||!trailer.userData.collisionEnabled)return;
 const trailerShapes=getTrailerCollisionShapes();
 const now=performance.now()/1000;
 let bestHit=null;
 for(const shape of trailerShapes){
  for(const c of environmentColliders){
   const hit=c.type==='circle'
    ? circleVsOBB(c.x,c.z,c.r,shape.obb)
    : obbOverlap(shape.obb,makeOBB(c.x,c.z,c.yaw,c.halfWidth,c.halfLength));
   if(hit && (!bestHit || hit.depth>bestHit.depth))bestHit={...hit,kind:shape.kind};
  }
 }

 if(bestHit){
  if(trailerAttached){
   // Attached trailer is constrained by the hitch: transfer only a smooth
   // load into the tractor. Do not move trailer.position in world space while
   // it is parented to trailerHitch.
   const forward=new THREE.Vector2(Math.sin(tractor.rotation.y),Math.cos(tractor.rotation.y));
   const into=Math.max(0,forward.dot(bestHit.normal)*speed);
   if(into>.02)speed*=Math.max(.08,1-.76*THREE.MathUtils.clamp(into/4,0,1));
   trailerEnvContactCooldown=.18;

   if(into>.8 && now-lastTrailerEnvironmentImpactAt>.60){
    applyTractorImpact(Math.min(24,into*1.10));
    lastTrailerEnvironmentImpactAt=now;
    showToast('Trailer hit obstacle');
   }
  }else{
   // Detached trailer is in world space, so a tiny depenetration is safe.
   const separation=THREE.MathUtils.clamp(bestHit.depth*.40,0,.075);
   trailer.position.x-=bestHit.normal.x*separation;
   trailer.position.z-=bestHit.normal.y*separation;

   const into=detachedTrailerPhysics.velocity.dot(bestHit.normal);
   if(into>0)detachedTrailerPhysics.velocity.sub(bestHit.normal.clone().multiplyScalar(into*.92));
   detachedTrailerPhysics.velocity.multiplyScalar(Math.exp(-4.0*dt));
   detachedTrailerPhysics.angularVelocity*=Math.exp(-6.2*dt);
  }
 }else{
  trailerEnvContactCooldown=Math.max(0,trailerEnvContactCooldown-dt);
 }

 const max=TRAILER_PHYSICS.boundary,p=trailer.position;
 if(!trailerAttached){
  if(p.x<-max){p.x=-max;detachedTrailerPhysics.velocity.x=Math.abs(detachedTrailerPhysics.velocity.x)*.08;}
  if(p.x> max){p.x=max;detachedTrailerPhysics.velocity.x=-Math.abs(detachedTrailerPhysics.velocity.x)*.08;}
  if(p.z<-max){p.z=-max;detachedTrailerPhysics.velocity.y=Math.abs(detachedTrailerPhysics.velocity.y)*.08;}
  if(p.z> max){p.z=max;detachedTrailerPhysics.velocity.y=-Math.abs(detachedTrailerPhysics.velocity.y)*.08;}
 }
}

function getPloughYaw(){
 const q=plough.getWorldQuaternion(new THREE.Quaternion());
 return new THREE.Euler().setFromQuaternion(q,'YXZ').y;
}
function getPloughCollisionShapes(){
 const p=plough.getWorldPosition(new THREE.Vector3());
 const yaw=getPloughYaw();
 const a=bodyAxes(yaw);
 // Compound footprint covering the complete visible plough: rear tool bar
 // plus the full row of lower tines. This supports front/rear/side/corner
 // contacts without relying on a single oversized invisible box.
 const bar=makeOBB(
  p.x,p.z,yaw,
  2.10,.24
 );
 const tineCenterZ=-.67;
 const tines=makeOBB(
  p.x+a.f.x*tineCenterZ,
  p.z+a.f.y*tineCenterZ,
  yaw,1.68,.24
 );
 return [
  {obb:bar,kind:'bar'},
  {obb:tines,kind:'tines'}
 ];
}
function resolveTractorVsDetachedPlough(dt){
 if(ploughAttached)return;
 const tractorBox=makeOBB(
  tractor.position.x,tractor.position.z,tractor.rotation.y,
  RIGID.tractorHalfWidth,RIGID.tractorHalfLength
 );
 let hit=null;
 for(const shape of getPloughCollisionShapes()){
  const candidate=obbOverlap(tractorBox,shape.obb);
  if(candidate && (!hit || candidate.depth>hit.depth))hit={...candidate,kind:shape.kind};
 }
 if(!hit){
  ploughContactCooldown=Math.max(0,ploughContactCooldown-dt);
  return;
 }

 const tractorForward=new THREE.Vector2(Math.sin(tractor.rotation.y),Math.cos(tractor.rotation.y));
 const tractorVelocity=tractorForward.clone().multiplyScalar(speed);
 const relativeVelocity=tractorVelocity.clone().sub(detachedPloughPhysics.velocity);
 const closingSpeed=Math.max(0,relativeVelocity.dot(hit.normal));
 if(closingSpeed>.02){
  const into=Math.max(0,tractorVelocity.dot(hit.normal));
  speed*=THREE.MathUtils.clamp(1-into*.22,.08,1);
 }

 // Tiny, bounded separation keeps the complete plough from visually
 // interpenetrating the tractor without producing a camera shake.
 const separation=THREE.MathUtils.clamp(hit.depth*.34,0,.060);
 if(separation>.002){
  plough.position.x+=hit.normal.x*separation;
  plough.position.z+=hit.normal.y*separation;
 }

 const pushSpeed=THREE.MathUtils.clamp(.07+closingSpeed*.020,.07,.28);
 detachedPloughPhysics.velocity.lerp(
  hit.normal.clone().multiplyScalar(pushSpeed),
  1-Math.exp(-6.0*dt)
 );
 detachedPloughPhysics.velocity.clampLength(0,PLOUGH_PHYSICS.maxPushSpeed);
 const lateralNormal=new THREE.Vector2(-hit.normal.y,hit.normal.x);
 const lateralImpact=Math.abs(relativeVelocity.dot(lateralNormal));
 const yawKick=THREE.MathUtils.clamp(lateralImpact*.009,-.06,.06);
 detachedPloughPhysics.angularVelocity=THREE.MathUtils.lerp(
  detachedPloughPhysics.angularVelocity,yawKick,1-Math.exp(-5*dt)
 );
 detachedPloughPhysics.angularVelocity=THREE.MathUtils.clamp(
  detachedPloughPhysics.angularVelocity,-PLOUGH_PHYSICS.maxAngularSpeed,PLOUGH_PHYSICS.maxAngularSpeed
 );

 const now=performance.now()/1000;
 if(closingSpeed>.8 && now-lastPloughImpactAt>.60){
  applyTractorImpact(Math.min(30,closingSpeed*PLOUGH_PHYSICS.impactDamageScale));
  lastPloughImpactAt=now;
  ploughContactCooldown=.60;
  showToast(`Plough impact • ${Math.round(closingSpeed*3.25)} km/h`);
 }
}
function resolvePloughEnvironment(dt){
 if(!plough.userData.collisionEnabled)return;
 let bestHit=null;
 for(const shape of getPloughCollisionShapes()){
  for(const c of environmentColliders){
   const hit=c.type==='circle'
    ? circleVsOBB(c.x,c.z,c.r,shape.obb)
    : obbOverlap(shape.obb,makeOBB(c.x,c.z,c.yaw,c.halfWidth,c.halfLength));
   if(hit && (!bestHit || hit.depth>bestHit.depth))bestHit={...hit,kind:shape.kind};
  }
 }
 if(bestHit){
  const now=performance.now()/1000;
  if(ploughAttached){
   // Attached plough is constrained by the three-point hitch. Transfer load
   // through the tractor instead of shifting the child in world space.
   const forward=new THREE.Vector2(Math.sin(tractor.rotation.y),Math.cos(tractor.rotation.y));
   const into=Math.max(0,forward.dot(bestHit.normal)*speed);
   if(into>.02)speed*=Math.max(.10,1-.78*THREE.MathUtils.clamp(into/3.5,0,1));
   if(into>.75 && ploughEnvContactCooldown<=0){
    applyTractorImpact(Math.min(22,into*PLOUGH_PHYSICS.impactDamageScale));
    lastPloughEnvironmentImpactAt=now;
    ploughEnvContactCooldown=.18;
    showToast('Plough hit obstacle');
   }
  }else{
   const separation=THREE.MathUtils.clamp(bestHit.depth*.40,0,.065);
   plough.position.x-=bestHit.normal.x*separation;
   plough.position.z-=bestHit.normal.y*separation;
   const into=detachedPloughPhysics.velocity.dot(bestHit.normal);
   if(into>0)detachedPloughPhysics.velocity.sub(bestHit.normal.clone().multiplyScalar(into*.92));
   detachedPloughPhysics.velocity.multiplyScalar(Math.exp(-4.8*dt));
   detachedPloughPhysics.angularVelocity*=Math.exp(-7.0*dt);
   if(Math.abs(into)>.55 && now-lastPloughEnvironmentImpactAt>.75){
    lastPloughEnvironmentImpactAt=now;
    ploughEnvContactCooldown=.30;
    showToast('Plough hit obstacle');
   }
  }
 }else{
  ploughEnvContactCooldown=Math.max(0,ploughEnvContactCooldown-dt);
 }
 const max=PLOUGH_PHYSICS.boundary,p=plough.position;
 if(!ploughAttached){
  if(p.x<-max){p.x=-max;detachedPloughPhysics.velocity.x=Math.abs(detachedPloughPhysics.velocity.x)*.06;}
  if(p.x> max){p.x=max;detachedPloughPhysics.velocity.x=-Math.abs(detachedPloughPhysics.velocity.x)*.06;}
  if(p.z<-max){p.z=-max;detachedPloughPhysics.velocity.y=Math.abs(detachedPloughPhysics.velocity.y)*.06;}
  if(p.z> max){p.z=max;detachedPloughPhysics.velocity.y=-Math.abs(detachedPloughPhysics.velocity.y)*.06;}
 }
}
function updateDetachedPloughPhysics(dt){
 if(ploughAttached)return;
 const v=detachedPloughPhysics.velocity;
 plough.position.x+=v.x*dt;
 plough.position.z+=v.y*dt;
 plough.position.y=0;
 plough.rotation.x=0;
 plough.rotation.z=0;
 plough.rotation.y+=detachedPloughPhysics.angularVelocity*dt;
 v.multiplyScalar(Math.exp(-PLOUGH_PHYSICS.rollingResistance*dt));
 detachedPloughPhysics.angularVelocity*=Math.exp(-3.4*dt);
 if(v.lengthSq()<.00025)v.set(0,0);
 if(Math.abs(detachedPloughPhysics.angularVelocity)<.002)detachedPloughPhysics.angularVelocity=0;
 resolvePloughEnvironment(dt);
 resolveTractorVsDetachedPlough(dt);
}

function updateDetachedTrailerPhysics(dt){
 if(trailerAttached)return;
 const v=detachedTrailerPhysics.velocity;
 trailer.position.x+=v.x*dt;trailer.position.z+=v.y*dt;
 trailer.position.y=0;trailer.rotation.x=0;trailer.rotation.z=0;
 trailer.rotation.y+=detachedTrailerPhysics.angularVelocity*dt;
 const drag=Math.exp(-TRAILER_PHYSICS.rollingResistance*dt);v.multiplyScalar(drag);
 detachedTrailerPhysics.angularVelocity*=Math.exp(-2.8*dt);
 if(v.lengthSq()<.0004)v.set(0,0);
 if(Math.abs(detachedTrailerPhysics.angularVelocity)<.002)detachedTrailerPhysics.angularVelocity=0;
 resolveTrailerEnvironment(dt);
 resolveTractorVsDetachedTrailer(dt);
}

// ===== GAME SIMULATION =====
function drive(dt){
 const f=controls.w||controls.up,b=controls.s||controls.down,left=controls.a||controls.left,right=controls.d||controls.right;
 const gear=state.gear;
 const gearIndex=Math.max(1,Math.min(5,gear));
 const maxForward=RIGID.maxForwardSpeed[gearIndex]||0;
 const targetSpeed=gear<0?-RIGID.reverseSpeed:gear===0?0:maxForward;

 // Heavy agricultural driveline: throttle builds speed progressively and
 // braking decelerates hard, but never flips the sign in a single frame.
 const throttle=f&&gear!==0&&!controls.hand;
 if(throttle){
  speed += (targetSpeed-speed)*RIGID.engineAccel*dt;
 }else if(b||controls.hand){
  const brake=RIGID.brakeAccel*(controls.hand?1.35:1);
  const mag=Math.max(0,Math.abs(speed)-brake*dt);
  speed=Math.sign(speed)*mag;
 }else{
  const drag=Math.max(0,Math.abs(speed)-RIGID.rollingResistance*dt);
  speed=Math.sign(speed)*drag;
 }

 if(gear===0) speed=damp(speed,0,8,dt);
 speed=THREE.MathUtils.clamp(speed,-RIGID.reverseSpeed,maxForward);

 const traction=Math.max(.55,Math.min(1,weather==='rain'?.72:1));
 const steerTarget=left?1:right?-1:0;
 const speedRatio=Math.min(1,Math.abs(speed)/Math.max(maxForward,1));
 const steerResponse=THREE.MathUtils.lerp(RIGID.steerResponse,RIGID.steerAtSpeedResponse,speedRatio);
 steer=damp(steer,steerTarget,steerResponse,dt);
 const steerAngle=steer*RIGID.steeringLock*(1-.18*speedRatio);

 // Ackermann-like yaw approximation for a heavy front-steer tractor.
 const yawRate=Math.abs(speed)>.03
   ?(speed/RIGID.wheelBase)*Math.tan(steerAngle)*RIGID.yawGrip*traction
   :0;
 tractor.rotation.y+=yawRate*dt;

 const front=new THREE.Vector3(0,0,1).applyQuaternion(tractor.quaternion).normalize();
 tractor.position.addScaledVector(front,speed*dt);

 // Hard rigid chassis constraints: fixed ride height, no artificial body roll,
 // and a bounded play area so the vehicle cannot fall through the world.
 tractor.position.y=RIGID.groundY;
 tractor.position.x=THREE.MathUtils.clamp(tractor.position.x,-348,348);
 tractor.position.z=THREE.MathUtils.clamp(tractor.position.z,-348,348);
 tractor.rotation.x=0;
 tractor.rotation.z=0;

 FL.rotation.y=steerAngle;
 FR.rotation.y=steerAngle;
 steerWheel.rotation.z=damp(steerWheel.rotation.z,-steerAngle,7,dt);
 for(const o of wheelPivots)o.w.rotation.x+=speed*dt/(o.w.userData.radius||1);

 const load=controls.plough?1.2:1;
 const targetRpm=gear===0?850:850+Math.abs(speed)*74*load+(throttle?1150*load:0);
 rpm=damp(rpm,Math.max(750,Math.min(2600,targetRpm)),5.2,dt);

 state.fuel=Math.max(0,state.fuel-(.0011+Math.abs(speed)*.00065+(throttle?.0018:0)+(controls.plough?.003:0))*dt*60);

 // Tractor-vs-rock collision with impact-speed damage.
 for(const o of hazards){
  const rr=(o.userData?.rad||1.5)+1.75;
  const dx=tractor.position.x-o.position.x,dz=tractor.position.z-o.position.z;
  const distSq=dx*dx+dz*dz;
  if(distSq<rr*rr){
   const dist=Math.max(Math.sqrt(distSq),.001);
   const normal=new THREE.Vector2(dx/dist,dz/dist);
   const forward=new THREE.Vector2(Math.sin(tractor.rotation.y),Math.cos(tractor.rotation.y));
   const approaching=Math.max(0,forward.dot(normal)*speed);
   tractor.position.x=o.position.x+normal.x*rr;
   tractor.position.z=o.position.z+normal.y*rr;
   speed*=approaching>0.6?.16:.55;
   if(approaching>.8){
    const now=performance.now()/1000;
    if(now-lastTrailerEnvironmentImpactAt>.38){
     applyTractorImpact(Math.min(18,approaching*RIGID.collisionDamageScale));
     lastTrailerEnvironmentImpactAt=now;
    }
   }
  }
 }
}


// ===== WORLD HAZARDS & CAMERA ===== =====
const hazards=[];
function hazard(x,z,rad=1.4){
 const q=add(new THREE.DodecahedronGeometry(rad*.8,1),M(0x73716a),x,rad*.7,z);q.userData.rad=rad;hazards.push(q);
 addEnvironmentCircle(x,z,rad);
}
hazard(27,56,1.2);hazard(-34,82,1.3);hazard(40,71,1.0);

// Natural follow camera. Position and look target are smoothed independently;
// the camera uses Three.js lookAt with world-up, so roll stays level and cannot
// flip like a free quaternion during tractor turns.
const cameraFollow={
 pos:new THREE.Vector3(),
 look:new THREE.Vector3(),
 initialized:false
};
const cameraDesiredPos=new THREE.Vector3();
const cameraDesiredLook=new THREE.Vector3();
function updateCamera(dt){
 let localPos,localLook;
 if(state.cam===0){
   localPos=new THREE.Vector3(0,7.2,-14.5);
   localLook=new THREE.Vector3(0,1.55,3.0);
 }else if(state.cam===1){
   // Slightly higher driver's-eye view.
   localPos=new THREE.Vector3(0,3.65,.05);
   localLook=new THREE.Vector3(0,3.10,18.0);
 }else{
   localPos=new THREE.Vector3(-11,10.5,-15.5);
   localLook=new THREE.Vector3(0,1.0,1.0);
 }
 cameraDesiredPos.copy(tractor.localToWorld(localPos));
 cameraDesiredLook.copy(tractor.localToWorld(localLook));
 const followAlpha=1-Math.exp(-7.5*dt);
 const lookAlpha=1-Math.exp(-8.5*dt);
 if(!cameraFollow.initialized){
   cameraFollow.pos.copy(cameraDesiredPos);
   cameraFollow.look.copy(cameraDesiredLook);
   cameraFollow.initialized=true;
 }else{
   cameraFollow.pos.lerp(cameraDesiredPos,followAlpha);
   cameraFollow.look.lerp(cameraDesiredLook,lookAlpha);
 }
 camera.position.copy(cameraFollow.pos);
 camera.lookAt(cameraFollow.look);
}

// ===== HUD =====
function hud(){
 const p=workedPct()*100;
 document.getElementById('speed').textContent=Math.round(Math.abs(speed)*3.25)+' km/h';
 document.getElementById('rpm').textContent=Math.round(rpm);
 document.getElementById('fuel').textContent=Math.round(state.fuel)+'%';
 document.getElementById('damage').textContent=Math.round(state.damage)+'%';
 document.getElementById('worked').textContent=Math.round(p)+'%';
 document.getElementById('progress').style.width=p+'%';
 document.getElementById('pos').textContent=Math.round(tractor.position.x)+','+Math.round(tractor.position.z);
 document.getElementById('steering').textContent=Math.abs(steer)<.05?'CENTER':steer<0?'LEFT':'RIGHT';
 document.getElementById('ploughState').textContent=controls.plough?'DOWN':'UP';
 document.getElementById('traction').textContent=(weather==='rain'?'72':'100')+'%';
 document.getElementById('driveState').textContent=controls.hand?'HANDBRAKE':controls.plough?'PLOUGH':Math.abs(speed)<.2?'IDLE':speed<0?'REVERSE':'DRIVE';
 const load=Math.min(100,Math.max(0,((rpm-750)/1850)*100));document.getElementById('load').style.width=load+'%';document.getElementById('loadText').textContent=Math.round(load)+'%';
 document.getElementById('camera').textContent=['CHASE','CABIN','ORBIT'][state.cam];
 updateGearUI();
}

// ===== MAIN LOOP =====
// Deterministic loop.
function loop(now){
 requestAnimationFrame(loop);
 const dt=Math.min(.033,Math.max(.001,(now-last)/1000));last=now;
 try{
  if(state.started&&!state.paused){
   drive(dt);
   updateTrailerArticulation(dt);
   if(trailerAttached)resolveTrailerEnvironment(dt);
   else updateDetachedTrailerPhysics(dt);
   if(ploughAttached)resolvePloughEnvironment(dt);
   else updateDetachedPloughPhysics(dt);
   ploughNow();
   updateTrail(dt);
   updateCamera(dt);
  }
  hud();
  renderer.render(scene,camera);
 }catch(err){
  state.paused=true;
  const box=document.getElementById('diagnostic');box.style.display='grid';
  document.getElementById('diagnosticText').textContent=err.stack||String(err);
  console.error(err);
 }
}
loop(performance.now());

function ploughNow(){
 if(!controls.plough||state.paused)return;
 const fc=fieldCell();if(!fc||Math.abs(speed)<.4)return;
 const rad=0;
 for(let r=Math.max(0,fc.r-rad);r<=Math.min(FIELD.rows-1,fc.r+rad);r++)
  for(let c=Math.max(0,fc.c-rad);c<=Math.min(FIELD.cols-1,fc.c+rad);c++)
   if(!cells[r][c]){
    cells[r][c]=true;
    soilG.children[r*FIELD.cols+c].material.color.setHex(0x56381f);
    ploughedTiles[r][c].visible=true;
   }
}

function damp(a,b,l,dt){return THREE.MathUtils.lerp(a,b,1-Math.exp(-l*dt))}
// Release held controls when the tab/window loses focus so the tractor cannot
// continue driving after an interrupted keyboard/touch interaction.
window.addEventListener('blur', clearControls);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearControls();
    if (state.started && !state.paused) pause();
  }
});

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
})();