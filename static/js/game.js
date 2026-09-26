import * as THREE from "three";

const performanceUI = { frames: 0, last: performance.now(), fps: 60, accumulator: 0, sample: 0, adaptiveTimer: 0, lodTimer: 0, interactionTimer: 0, hudTimer: 0, saveTimer: 0, renderTimer: 0 };
let gamePaused = false;
let lastSaveSignature = "";
const SAVE_KEY_V57 = "mundo-real-v57";
const SAVE_KEY_V60 = "mundo-real-v60";
let userQuality = localStorage.getItem("mundo-real-quality") || "auto";
let quality = localStorage.getItem("mundo-real-quality") || "auto";
const QUALITY = {
  low:    { pixel: 0.85, shadows: false, shadowMap: 512, detail: 38, fog: 115 },
  medium: { pixel: 1.05, shadows: true,  shadowMap: 1024, detail: 58, fog: 155 },
  high:   { pixel: Math.min(devicePixelRatio, 1.5), shadows: true, shadowMap: 1536, detail: 82, fog: 190 }
};
let activeQuality = quality === "auto" ? (innerWidth < 700 ? "medium" : "high") : quality;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x86b9ce);
scene.fog = new THREE.Fog(0x86b9ce, 45, QUALITY[activeQuality].fog);

// V5.6 — ciclo dia/noite, clima e áudio ambiente.
const worldClock = { hour: 8.5, speed: 0.075, weather: "clear", weatherTimer: 95, rainTimer: 0, lightningTimer: 0 };
const weatherColors = {
  clear: { sky: 0x86b9ce, fog: 0x86b9ce },
  cloudy: { sky: 0x687987, fog: 0x687987 },
  rain: { sky: 0x4e5d68, fog: 0x53616a }
};
const streetLights = [];
let weatherDrops = null;
let weatherDropPositions = null;
let audioCtx = null, audioMaster = null, ambientGain = null, windOsc = null;
let audioEnabled = localStorage.getItem("mundo-real-audio") !== "off";

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, .1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(QUALITY[activeQuality].pixel);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = QUALITY[activeQuality].shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.getElementById("game").appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdcefff, 0x35563b, 2.0));
const sun = new THREE.DirectionalLight(0xfff1d0, 3.1);
sun.position.set(35, 65, 25); sun.castShadow = QUALITY[activeQuality].shadows; sun.shadow.mapSize.set(QUALITY[activeQuality].shadowMap, QUALITY[activeQuality].shadowMap); sun.shadow.camera.left=-90; sun.shadow.camera.right=90; sun.shadow.camera.top=90; sun.shadow.camera.bottom=-90;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(240, 240),
  new THREE.MeshStandardMaterial({ color: 0x3f7045, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

function box(x, y, z, w, h, d, color, extra = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, ...extra }));
  m.position.set(x, y, z); m.castShadow = QUALITY[activeQuality].shadows; m.receiveShadow = true; scene.add(m); return m;
}
function road(x, z, w, d) { box(x, .025, z, w, .05, d, 0x30343a, {roughness:.92}); }
function sidewalk(x,z,w,d){ box(x,.075,z,w,.12,d,0x9b9fa0,{roughness:.9}); }
function stripe(x,z,w,d){ box(x,.065,z,w,.025,d,0xf2e7bd,{roughness:.8}); }
function lamp(x,z){
  box(x,2.3,z,.12,4.6,.12,0x252b31,{metalness:.65,roughness:.35});
  const arm=box(x+.42,4.45,z,.9,.09,.09,0x252b31,{metalness:.7,roughness:.3});
  const glow=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),new THREE.MeshStandardMaterial({color:0xffe6a3,emissive:0xffb52e,emissiveIntensity:2.2}));
  glow.position.set(x+.83,4.34,z); scene.add(glow);
  const light=new THREE.PointLight(0xffc96b,.75,9,2); light.position.copy(glow.position); scene.add(light); streetLights.push(light);
}
function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

for (let i = -80; i <= 80; i += 40) { road(0, i, 220, 10); road(i, 0, 10, 220); }
// Calçadas, faixas e postes deixam a cidade mais legível e realista.
for(let i=-80;i<=80;i+=40){ sidewalk(-7.2,i,3.8,220); sidewalk(7.2,i,3.8,220); sidewalk(i,-7.2,220,3.8); sidewalk(i,7.2,220,3.8); }
for(let i=-80;i<=80;i+=40){ for(let p=-80;p<80;p+=8){ stripe(-.55,p,1.0,4.2); stripe(.55,p,1.0,4.2); stripe(p,-.55,4.2,1.0); stripe(p,.55,4.2,1.0); } }
for(let x=-90;x<=90;x+=20){ lamp(x, -6.1); lamp(x, 6.1); }
for(let z=-90;z<=90;z+=20){ lamp(-6.1,z); lamp(6.1,z); }
const worldColliders = [];
for (let x = -80; x <= 80; x += 40) for (let z = -80; z <= 80; z += 40) {
  if (Math.abs(x) < 1 || Math.abs(z) < 1) continue;
  const h = 8 + Math.random() * 13;
  const colors = [0x7c8790, 0x9a8774, 0x667887, 0x8c6f62, 0x707c68];
  box(x, h / 2, z, 20, h, 20, colors[Math.floor(Math.random() * colors.length)]);
  worldColliders.push({ x, z, halfX: 9.8, halfZ: 9.8 });
  box(x, h + .8, z, 16, .8, 16, 0x555b60, {roughness:.7,metalness:.12});
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(10.8,10.8,1.15,4), new THREE.MeshStandardMaterial({color:0x3e444a,roughness:.82}));
  roof.position.set(x,h+1.55,z); roof.rotation.y=Math.PI/4; roof.castShadow=true; scene.add(roof);
  for (let wy = 2; wy < h - 1; wy += 3) {
    for (let wx = -6; wx <= 6; wx += 4) {
      const window = box(x + wx, wy, z - 10.08, 1.3, 1.1, .08, 0x9cc5d6, { emissive: 0x183642, emissiveIntensity: .3 });
      window.castShadow = false; window.userData.visualDetail = true;
      const side = box(x + 10.08, wy, z + wx, .08, 1.1, 1.3, 0x9cc5d6, {emissive:0x183642, emissiveIntensity:.3});
      side.castShadow = false; side.userData.visualDetail = true;
    }
  }
}

// Árvores e detalhes urbanos.
for (let i = 0; i < 48; i++) {
  const x = Math.round((Math.random() * 200 - 100) / 10) * 10 + 5;
  const z = Math.round((Math.random() * 200 - 100) / 10) * 10 + 5;
  if (Math.abs(x % 40) < 12 || Math.abs(z % 40) < 12) continue;
  box(x, 1.2, z, 1.5, 2.4, 1.5, 0x70452b);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x1d7437, roughness:.92 });
  for(const part of [[0,4,0,3.2],[1.4,4.4,.2,2.2],[-1.3,4.5,.1,2.3]]){
    const crown = new THREE.Mesh(new THREE.SphereGeometry(part[3],12,10), crownMat);
    crown.position.set(x+part[0],part[1],z+part[2]); crown.castShadow = QUALITY[activeQuality].shadows; crown.userData.vegetation = true; crown.userData.visualDetail = true; scene.add(crown);
  }
}

// Praça central.
const plaza = new THREE.Mesh(new THREE.CircleGeometry(13, 48), new THREE.MeshStandardMaterial({ color: 0x8d9b91, roughness: .9 }));
plaza.rotation.x = -Math.PI / 2; plaza.position.y = .035; scene.add(plaza);
const fountain = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, .55, 32), new THREE.MeshStandardMaterial({ color: 0x77838b }));
fountain.position.y = .3; scene.add(fountain);
const water = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, .08, 32), new THREE.MeshStandardMaterial({ color: 0x36a9d6, metalness: .1, roughness: .2 }));
water.position.y = .61; scene.add(water);

// Céu com sol e nuvens decorativas para dar profundidade ao horizonte.
const skySun = new THREE.Mesh(new THREE.SphereGeometry(5,24,16), new THREE.MeshBasicMaterial({color:0xffe6a1}));
skySun.position.set(-70,75,-100); scene.add(skySun);
for(let i=0;i<12;i++){
  const cloud=new THREE.Group();
  for(let j=0;j<3;j++){ const puff=new THREE.Mesh(new THREE.SphereGeometry(3+Math.random()*1.8,12,8),new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.78,roughness:1})); puff.position.set(j*4,Math.random()*1.2,0); cloud.add(puff); }
  cloud.position.set(-95+Math.random()*190,42+Math.random()*25,-100+Math.random()*120); scene.add(cloud);
}

// V5.6 — partículas simples de chuva, ativadas apenas quando o clima exige.
function createWeatherSystem(){
  const count = activeQuality === "low" ? 220 : activeQuality === "medium" ? 420 : 650;
  weatherDropPositions = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(weatherDropPositions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xb9d9e8, size: activeQuality === "low" ? .08 : .11, transparent: true, opacity: .6, depthWrite: false });
  weatherDrops = new THREE.Points(geo, mat); weatherDrops.visible = false; scene.add(weatherDrops);
  for(let i=0;i<count;i++){ weatherDropPositions[i*3]=(Math.random()-.5)*180; weatherDropPositions[i*3+1]=Math.random()*35+2; weatherDropPositions[i*3+2]=(Math.random()-.5)*180; }
}
createWeatherSystem();

function startAmbientAudio(){
  if(!audioEnabled || audioCtx) return;
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioMaster = audioCtx.createGain(); audioMaster.gain.value=.045; audioMaster.connect(audioCtx.destination);
    ambientGain = audioCtx.createGain(); ambientGain.gain.value=.35; ambientGain.connect(audioMaster);
    const buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*2,audioCtx.sampleRate), data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*.22;
    const source=audioCtx.createBufferSource(); source.buffer=buffer; source.loop=true;
    const filter=audioCtx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=900;
    source.connect(filter); filter.connect(ambientGain); source.start();
    windOsc=audioCtx.createOscillator(); const windGain=audioCtx.createGain(); windOsc.type='sine'; windOsc.frequency.value=105; windGain.gain.value=.012; windOsc.connect(windGain); windGain.connect(ambientGain); windOsc.start();
  }catch(_){ audioCtx=null; }
}
addEventListener('pointerdown', startAmbientAudio, {once:true});
addEventListener('keydown', e => { if (e.key.toLowerCase() === 'p') setPaused(!gamePaused); });

// Personagem.
const player = new THREE.Group(); player.position.set(0, 0, 10); scene.add(player);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22 }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = .03; player.add(shadow);
function limb(radius, length, color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 5, 10), new THREE.MeshStandardMaterial({ color, roughness: .8 }));
  m.position.y = -length * .5; m.castShadow = true; g.add(m); return g;
}
const leftLeg = limb(.22, .9, 0x20252d), rightLeg = limb(.22, .9, 0x20252d);
leftLeg.position.set(-.3, 1, 0); rightLeg.position.set(.3, 1, 0); player.add(leftLeg, rightLeg);
const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.55, .8, 6, 12), new THREE.MeshStandardMaterial({ color: 0x1976d2, roughness: .65 }));
torso.position.y = 1.75; torso.castShadow = true; player.add(torso);
const neck = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .25, 12), new THREE.MeshStandardMaterial({ color: 0xc98f72 })); neck.position.y = 2.38; player.add(neck);
const head = new THREE.Mesh(new THREE.SphereGeometry(.52, 20, 16), new THREE.MeshStandardMaterial({ color: 0xc98f72, roughness: .8 })); head.position.y = 2.85; head.castShadow = true; player.add(head);
const hair = new THREE.Mesh(new THREE.SphereGeometry(.54, 20, 12, 0, Math.PI * 2, 0, Math.PI * .55), new THREE.MeshStandardMaterial({ color: 0x17120f, roughness: .9 })); hair.position.set(0, 3.02, -.02); player.add(hair);
function eye(x) { const e = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 8), new THREE.MeshStandardMaterial({ color: 0x111111 })); e.position.set(x, 2.88, .49); player.add(e); }
eye(-.17); eye(.17);
const leftArm = limb(.18, .78, 0x1976d2), rightArm = limb(.18, .78, 0x1976d2);
leftArm.position.set(-.72, 2.12, 0); rightArm.position.set(.72, 2.12, 0); player.add(leftArm, rightArm);
const backpack = new THREE.Mesh(new THREE.BoxGeometry(.62, .8, .22), new THREE.MeshStandardMaterial({ color: 0x263238, roughness: .8 })); backpack.position.set(0, 1.75, -.55); player.add(backpack);

// NPCs com marcador visual.
const npcs = [];
function makeNpc(name, x, z, color, icon = "💬") {
  const npc = new THREE.Group(); npc.position.set(x, 0, z); scene.add(npc);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.48, .72, 5, 10), new THREE.MeshStandardMaterial({ color, roughness: .8 })); body.position.y = 1.35; body.castShadow = true; npc.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.45, 16, 12), new THREE.MeshStandardMaterial({ color: 0xc98f72 })); head.position.y = 2.25; head.castShadow = true; npc.add(head);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.52, .64, 24), new THREE.MeshBasicMaterial({ color: 0xffd43b, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .04; npc.add(ring);
  const label = document.createElement("div");
  label.textContent = icon;
  label.style.cssText = "position:absolute;transform:translate(-50%,-50%);font-size:22px;filter:drop-shadow(0 3px 4px #000);pointer-events:none;display:none";
  document.body.appendChild(label);
  const item = { name, group: npc, label, ring, icon, desc: "Tem algo para você." };
  npcs.push(item); return item;
}
const guide = makeNpc("Marcos — Guia", 7, 3, 0xf59e0b, "💬"); guide.desc = "Ele quer apresentar a cidade.";
const shopkeeper = makeNpc("Ana — Comerciante", -43, -37, 0x22c55e, "🛒"); shopkeeper.desc = "Talvez ela tenha alguma coisa útil.";
const worker = makeNpc("Carlos — Trabalhador", 43, 37, 0x8b5cf6, "💼"); worker.desc = "Está procurando alguém para ajudar.";

// Cidade viva — NPCs circulando e trânsito simples.
const traffic = [];
const npcWalkers = [];
let parkedVehicle = null;
let driving = false;
let vehicleSpeed = 0;
let vehicleHeading = 0;
let vehicleSteer = 0;
let vehicleThrottle = 0;
const vehicleState = { fuel: 100, damage: 0 };

function createTrafficCar(x, z, axis = "x", dir = 1, color = 0xd64b3f) {
  const car = new THREE.Group();
  car.position.set(x, .32, z);
  car.userData.visualDetail = true;
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.1, .7, 1.55), new THREE.MeshStandardMaterial({color, roughness:.55, metalness:.15}));
  body.castShadow = true; car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, .65, 1.35), new THREE.MeshStandardMaterial({color:0x263746, roughness:.25, metalness:.1, transparent:true, opacity:.92}));
  cabin.position.y=.55; cabin.position.x=-.15; cabin.castShadow=true; car.add(cabin);
  for (const wx of [-1.05,1.05]) for (const wz of [-.82,.82]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.18,12), new THREE.MeshStandardMaterial({color:0x15171a,roughness:1}));
    wheel.rotation.z=Math.PI/2; wheel.position.set(wx,0,wz); car.add(wheel);
  }
  const head1 = new THREE.Mesh(new THREE.BoxGeometry(.12,.14,.38), new THREE.MeshBasicMaterial({color:0xfff1b0}));
  const head2=head1.clone(); head1.position.set(1.57,.32,-.48); head2.position.set(1.57,.32,.48); car.add(head1,head2);
  car.rotation.y = axis === "x" ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI/2 : -Math.PI/2);
  scene.add(car);
  traffic.push({group:car,axis,dir,speed:5+Math.random()*2.5,startX:x,startZ:z,range:108});
}

function createPlayerVehicle() {
  const car = new THREE.Group();
  car.position.set(14, .34, 12);
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.5,.72,1.75), new THREE.MeshStandardMaterial({color:0x16a085,roughness:.48,metalness:.2}));
  body.castShadow=true; car.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.15,.22,1.62), new THREE.MeshStandardMaterial({color:0x117864,roughness:.5,metalness:.2}));
  hood.position.set(1.15,.43,0); hood.castShadow=true; car.add(hood);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65,.72,1.48), new THREE.MeshStandardMaterial({color:0x20313c,roughness:.18,metalness:.1,transparent:true,opacity:.95}));
  cabin.position.set(-.35,.62,0); cabin.castShadow=true; car.add(cabin);
  for(const x of [-1.2,1.2]) for(const z of [-.92,.92]) {
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.22,14),new THREE.MeshStandardMaterial({color:0x111418,roughness:1}));
    wheel.rotation.z=Math.PI/2; wheel.position.set(x,.02,z); wheel.castShadow=true; car.add(wheel);
  }
  const lm=new THREE.MeshBasicMaterial({color:0xfff0ad}); const l1=new THREE.Mesh(new THREE.BoxGeometry(.12,.16,.42),lm); const l2=l1.clone();
  l1.position.set(1.77,.34,-.53); l2.position.set(1.77,.34,.53); car.add(l1,l2);
  const bm=new THREE.MeshBasicMaterial({color:0xff3322}); const b1=new THREE.Mesh(new THREE.BoxGeometry(.1,.15,.38),bm); const b2=b1.clone();
  b1.position.set(-1.77,.34,-.53); b2.position.set(-1.77,.34,.53); car.add(b1,b2);
  car.userData.drivable=true; scene.add(car); parkedVehicle=car;
}
createPlayerVehicle();

// V6.0 — física, colisões e posto de combustível.
const vehiclePhysics = {
  hitCooldown: 0,
  lastImpact: 0
};
const playerPhysics = { y: 0, velocityY: 0, grounded: true, jumpCooldown: 0 };
function isInsideCollider(pos, margin=1.15) {
  return worldColliders.some(c => Math.abs(pos.x-c.x) < c.halfX+margin && Math.abs(pos.z-c.z) < c.halfZ+margin);
}
function resolveWorldCollision(pos, radius=1.1) {
  let hit=false;
  for(const c of worldColliders){
    const minX=c.x-c.halfX-radius, maxX=c.x+c.halfX+radius;
    const minZ=c.z-c.halfZ-radius, maxZ=c.z+c.halfZ+radius;
    if(pos.x>minX && pos.x<maxX && pos.z>minZ && pos.z<maxZ){
      const dx=Math.min(Math.abs(pos.x-minX),Math.abs(maxX-pos.x));
      const dz=Math.min(Math.abs(pos.z-minZ),Math.abs(maxZ-pos.z));
      if(dx<dz) pos.x = pos.x<c.x ? minX : maxX;
      else pos.z = pos.z<c.z ? minZ : maxZ;
      hit=true;
    }
  }
  return hit;
}
function tryJump(){
  if(driving || interiorState?.inside || !playerPhysics.grounded || playerPhysics.jumpCooldown>0) return;
  playerPhysics.velocityY=7.2; playerPhysics.grounded=false; playerPhysics.jumpCooldown=.25; toast('🦘 Pulo');
}
function updatePlayerPhysics(dt){
  playerPhysics.jumpCooldown=Math.max(0,playerPhysics.jumpCooldown-dt);
  if(!playerPhysics.grounded){
    playerPhysics.velocityY-=18*dt;
    playerPhysics.y+=playerPhysics.velocityY*dt;
    if(playerPhysics.y<=0){ playerPhysics.y=0; playerPhysics.velocityY=0; playerPhysics.grounded=true; }
  }
  player.position.y=playerPhysics.y;
}
function createGasStation(){
  const p={id:'posto',name:'Posto Avenida',type:'posto',x:-64,z:-64,icon:'⛽',desc:'Abasteça o veículo e faça uma revisão rápida.'};
  places.push(p);
  const base=box(p.x,.22,p.z,15,.44,9,0x4a5258,{roughness:.82});
  base.userData.gasStation=true;
  for(const x of [-4,0,4]){
    box(p.x+x,2.0,p.z-2.0,1.8,3.5,1.3,0xd9e2e8,{metalness:.2,roughness:.45});
    box(p.x+x,3.85,p.z-2.0,2.1,.18,1.6,0x25313a,{metalness:.4,roughness:.3});
  }
  box(p.x,1.1,p.z+3.1,6.5,2.2,.35,0xe5b93f,{roughness:.6});
  createInterior(p); addPlaceEntrance(p);
}

// Faixas de trânsito principais da cidade.
for (let i=0;i<3;i++) {
  createTrafficCar(-95-i*28, -5, "x", 1, [0xd64b3f,0x2f80ed,0xf0b429][i]);
  createTrafficCar(95-i*30, 5, "x", -1, [0x22a06b,0x9b59b6,0xe67e22][i]);
  createTrafficCar(5, -95-i*28, "z", 1, [0x34495e,0xe74c3c,0xf1c40f][i]);
  createTrafficCar(-5, 95-i*30, "z", -1, [0x16a085,0x8e44ad,0xc0392b][i]);
}

function setupWalker(npc, radius = 13) {
  npcWalkers.push({
    npc,
    origin: npc.group.position.clone(),
    target: npc.group.position.clone(),
    radius,
    speed: .7 + Math.random()*.65,
    wait: Math.random()*2,
    phase: Math.random()*Math.PI*2
  });
}
setupWalker(guide, 16);
setupWalker(shopkeeper, 12);
setupWalker(worker, 15);

function chooseWalkerTarget(w) {
  const a=Math.random()*Math.PI*2, r=4+Math.random()*w.radius;
  w.target.set(w.origin.x+Math.cos(a)*r,0,w.origin.z+Math.sin(a)*r);
  // Evita colocar NPC exatamente no meio de uma rua principal.
  w.target.x=Math.round(w.target.x/5)*5;
  w.target.z=Math.round(w.target.z/5)*5;
}
for(const w of npcWalkers) chooseWalkerTarget(w);

function updateLivingCity(dt, time) {
  // NPCs caminham, param e mudam de destino.
  for(const w of npcWalkers){
    if(w.wait>0){ w.wait-=dt; continue; }
    const g=w.npc.group, dx=w.target.x-g.position.x, dz=w.target.z-g.position.z;
    const d=Math.hypot(dx,dz);
    if(d<.6){ w.wait=1+Math.random()*2.5; chooseWalkerTarget(w); continue; }
    const step=Math.min(d,w.speed*dt);
    g.position.x += dx/d*step; g.position.z += dz/d*step;
    g.rotation.y=Math.atan2(dx,dz);
    const walk=Math.sin(time*7+w.phase)*.08;
    g.children[0].rotation.x=walk;
  }
  // Veículos percorrem as avenidas e reaparecem do outro lado.
  for(const v of traffic){
    const d=v.speed*dt*v.dir;
    if(v.axis==='x'){
      v.group.position.x += d;
      if(v.group.position.x>112) v.group.position.x=-112;
      if(v.group.position.x<-112) v.group.position.x=112;
    } else {
      v.group.position.z += d;
      if(v.group.position.z>112) v.group.position.z=-112;
      if(v.group.position.z<-112) v.group.position.z=112;
    }
  }
}

// Estado do jogo.
const defaultState = { nome: "Jogador", vida: 100, dinheiro: 500, nivel: 1, xp: 0, xp_proximo: 100, energia: 100, inventario: [], stats: { empregos: 0, vendas: 0, gastos: 0 } };
let state = { ...defaultState };
let activeJob = null;
const jobs = [
  { id: "entrega", title: "Entrega rápida", icon: "📦", start: shopkeeper, target: worker, reward: 140, xp: 45, item: "Pacote" },
  { id: "servico", title: "Serviço urbano", icon: "🔧", start: worker, target: guide, reward: 190, xp: 60, item: "Ferramenta" },
  { id: "transporte", title: "Transporte de passageiro", icon: "🚕", start: guide, target: shopkeeper, reward: 220, xp: 75, item: "Comprovante" }
];
let mission = { id: 1, done: false, npc: guide, title: "Conheça a cidade", desc: "Encontre o NPC com o ícone 💬.", rewardMoney: 100, rewardXp: 50 };
let interacting = null;

const $ = id => document.getElementById(id);

// Controles da V5.4 são criados sem exigir mudança na estrutura do Flask.
const placeEnter=document.createElement('button'); placeEnter.id='place-enter'; placeEnter.className='action-extra hidden'; placeEnter.textContent='🏠 ENTRAR'; document.body.appendChild(placeEnter);
const interiorExit=document.createElement('button'); interiorExit.id='interior-exit'; interiorExit.className='action-extra hidden'; interiorExit.textContent='🚪 SAIR'; document.body.appendChild(interiorExit);
placeEnter.addEventListener('click',()=>enterPlace(nearestPlace()));
interiorExit.addEventListener('click',exitPlace);

function toast(text) { $("toast").textContent = text; $("toast").classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => $("toast").classList.remove("show"), 1800); }
function message(text) { $("message").textContent = text; }
function buildSaveData() {
  return {
    version: 60,
    savedAt: Date.now(),
    state: { ...state, inventario: [...state.inventario], stats: { ...state.stats } },
    missionDone: mission.done,
    activeJobId: activeJob?.id || null,
    player: { x: player.position.x, y: player.position.y, z: player.position.z, rotation: player.rotation.y },
    vehicle: { fuel: vehicleState.fuel, damage: vehicleState.damage, x: parkedVehicle?.position.x || 14, z: parkedVehicle?.position.z || 12, rotation: parkedVehicle?.rotation.y || 0 },
    world: { hour: worldClock.hour, weather: worldClock.weather, weatherTimer: worldClock.weatherTimer },
    audio: audioEnabled,
    quality: userQuality,
    v60: { vehicleDamage: vehicleState.damage, vehicleFuel: vehicleState.fuel, playerY: playerPhysics.y }
  };
}
function saveLocal(force = false) {
  try {
    const data = buildSaveData();
    const serialized = JSON.stringify(data);
    if (force || serialized !== lastSaveSignature) {
      localStorage.setItem(SAVE_KEY_V57, serialized);
      localStorage.setItem(SAVE_KEY_V60, serialized);
      // Mantém compatibilidade com versões anteriores.
      localStorage.setItem("mundo-real-v2", JSON.stringify({ ...state, missionDone: mission.done, activeJobId: activeJob?.id || null }));
      lastSaveSignature = serialized;
    }
  } catch (_) {}
}
function loadLocal() {
  try {
    const raw57 = localStorage.getItem(SAVE_KEY_V57);
    const saved57 = raw57 ? JSON.parse(raw57) : null;
    const legacy = JSON.parse(localStorage.getItem("mundo-real-v2") || "null");
    const saved = saved57?.state ? { ...saved57.state, missionDone: saved57.missionDone, activeJobId: saved57.activeJobId } : legacy;
    if (saved) {
      state = { ...defaultState, ...saved, stats: { ...defaultState.stats, ...(saved.stats || {}) }, inventario: Array.isArray(saved.inventario) ? saved.inventario : [] };
      mission.done = !!saved.missionDone;
      activeJob = jobs.find(j => j.id === saved.activeJobId) || null;
    }
    if (saved57?.player) player.position.set(Number(saved57.player.x) || 0, Number(saved57.player.y) || 0, Number(saved57.player.z) || 10), player.rotation.y = Number(saved57.player.rotation) || 0;
    if (saved57?.vehicle && parkedVehicle) { parkedVehicle.position.set(Number(saved57.vehicle.x) || 14, .34, Number(saved57.vehicle.z) || 12); parkedVehicle.rotation.y = Number(saved57.vehicle.rotation) || 0; vehicleState.fuel = THREE.MathUtils.clamp(Number(saved57.vehicle.fuel) || 100, 0, 100); vehicleState.damage = THREE.MathUtils.clamp(Number(saved57.vehicle.damage) || 0, 0, 100); }
    if (saved57?.v60) { vehicleState.damage=THREE.MathUtils.clamp(Number(saved57.v60.vehicleDamage)||vehicleState.damage,0,100); vehicleState.fuel=THREE.MathUtils.clamp(Number(saved57.v60.vehicleFuel)||vehicleState.fuel,0,100); playerPhysics.y=THREE.MathUtils.clamp(Number(saved57.v60.playerY)||0,0,4); }
    if (saved57?.world) { worldClock.hour = Number(saved57.world.hour) || 8.5; worldClock.weatherTimer = Number(saved57.world.weatherTimer) || 80; }
    if (typeof saved57?.audio === "boolean") audioEnabled = saved57.audio;
    if (saved57?.quality) { userQuality = saved57.quality; quality = saved57.quality; activeQuality = quality === "auto" ? (innerWidth < 700 ? "medium" : "high") : quality; }
  } catch (_) {}
}
function updateHud() {
  $("player-name").textContent = state.nome;
  $("vida").textContent = Math.max(0, Math.round(state.vida));
  $("energia").textContent = Math.max(0, Math.round(state.energia));
  $("dinheiro").textContent = Math.max(0, Math.round(state.dinheiro));
  $("nivel").textContent = state.nivel;
  $("xp-bar").style.width = `${Math.min(100, state.xp / state.xp_proximo * 100)}%`;
  $("mission-progress").textContent = mission.done ? "1/1" : "0/1";
  $("mission-name").textContent = mission.done ? "Primeira missão concluída!" : mission.title;
  $("mission-desc").textContent = mission.done ? "Agora explore a cidade e descubra novas pessoas." : mission.desc;
  $("mission-reward").textContent = mission.done ? "Concluída ✓" : `R$ ${mission.rewardMoney} + ${mission.rewardXp} XP`;
  const jobText = document.getElementById("job-status"); if (jobText) jobText.textContent = activeJob ? `${activeJob.icon} ${activeJob.title} → ${activeJob.target.name}` : "Nenhum emprego ativo";
  const invText = document.getElementById("inventory-count"); if (invText) invText.textContent = state.inventario.length;
  const statText = document.getElementById("economy-stats"); if (statText) statText.textContent = `${state.stats.empregos} empregos • ${state.stats.vendas} vendas`;
}
function addXp(amount) {
  state.xp += amount;
  while (state.xp >= state.xp_proximo) {
    state.xp -= state.xp_proximo; state.nivel += 1; state.xp_proximo = Math.round(state.xp_proximo * 1.25); state.vida = 100; state.energia = 100;
    toast(`⭐ Nível ${state.nivel}! Vida e energia restauradas.`);
  }
}
function completeMission() {
  if (mission.done) return;
  mission.done = true; state.dinheiro += mission.rewardMoney; addXp(mission.rewardXp); updateHud(); saveLocal();
  toast(`🎉 Missão concluída! +R$ ${mission.rewardMoney} e +${mission.rewardXp} XP`);
  message("Nova jornada liberada. Explore a cidade!");
}
function startJob(job) {
  if (activeJob) { toast("📋 Você já tem um emprego ativo."); return; }
  activeJob = job; updateHud(); saveLocal();
  closeEconomyPanels();
  toast(`${job.icon} Trabalho iniciado: ${job.title}`);
  message(`Vá até ${job.target.name} para concluir o trabalho.`);
}
function completeJob(job) {
  if (!activeJob || activeJob.id !== job.id) return;
  activeJob = null; state.dinheiro += job.reward; addXp(job.xp); state.inventario.push(job.item); state.stats.empregos += 1;
  updateHud(); saveLocal(); toast(`💼 Trabalho concluído! +R$ ${job.reward} +${job.xp} XP`);
  message("Pagamento recebido. Escolha outro trabalho quando quiser.");
}
function buyItem(item, price, energy = 0) {
  if (state.dinheiro < price) { toast(`💰 Faltam R$ ${price - state.dinheiro}.`); return; }
  state.dinheiro -= price; state.stats.gastos += price; state.inventario.push(item);
  if (energy) state.energia = Math.min(100, state.energia + energy);
  addXp(8); updateHud(); saveLocal(); renderInventory(); toast(`🛒 ${item} comprado por R$ ${price}.`);
}
function sellItem(item, price) {
  const i = state.inventario.indexOf(item);
  if (i < 0) { toast("📦 Você não possui esse item."); return; }
  state.inventario.splice(i, 1); state.dinheiro += price; state.stats.vendas += 1; addXp(5); updateHud(); saveLocal(); renderInventory(); toast(`💰 ${item} vendido por R$ ${price}.`);
}
function renderInventory() {
  const list = document.getElementById("inventory-list"); if (!list) return;
  list.innerHTML = state.inventario.length ? state.inventario.map((item,i) => `<div class="inv-item"><span>📦 ${item}</span><button data-sell="${i}">Vender R$ ${Math.max(15, Math.round((item.length * 7)))} </button></div>`).join("") : '<div class="empty-inv">Inventário vazio</div>';
  list.querySelectorAll("[data-sell]").forEach(btn => btn.addEventListener("click", () => { const item = state.inventario[Number(btn.dataset.sell)]; sellItem(item, Math.max(15, Math.round(item.length * 7))); }));
}
function openEconomyPanel(id) {
  ["jobs-panel","shop-panel","inventory-panel"].forEach(x => document.getElementById(x)?.classList.add("hidden"));
  document.getElementById(id)?.classList.remove("hidden");
  if (id === "inventory-panel") renderInventory();
}
function closeEconomyPanels() { ["jobs-panel","shop-panel","inventory-panel"].forEach(x => document.getElementById(x)?.classList.add("hidden")); }
function setupEconomyUI() {
  document.getElementById("jobs-btn")?.addEventListener("click", () => openEconomyPanel("jobs-panel"));
  document.getElementById("shop-btn")?.addEventListener("click", () => openEconomyPanel("shop-panel"));
  document.getElementById("inventory-btn")?.addEventListener("click", () => openEconomyPanel("inventory-panel"));
  document.querySelectorAll("[data-close-economy]").forEach(b => b.addEventListener("click", closeEconomyPanels));
  document.querySelectorAll("[data-job]").forEach(b => b.addEventListener("click", () => startJob(jobs.find(j => j.id === b.dataset.job))));
  document.getElementById("buy-snack")?.addEventListener("click", () => buyItem("Lanche", 50, 25));
  document.getElementById("buy-water")?.addEventListener("click", () => buyItem("Água", 20, 10));
  renderInventory();
}
function interactWith(target) {
  if (!target) { message("Não há ninguém próximo para interagir."); return; }
  if (activeJob && target === activeJob.target) { completeJob(activeJob); return; }
  if (target === guide) {
    if (!mission.done) completeMission();
    else { addXp(10); toast("Marcos: Continue explorando! +10 XP"); updateHud(); saveLocal(); }
  } else if (target === shopkeeper) {
    openEconomyPanel("shop-panel");
  } else if (target === worker) {
    openEconomyPanel("jobs-panel");
  }
}


// V5.5 — Missões, eventos e consequências.
const v55 = {
  missionIndex: 0,
  missionCompleted: 0,
  activeEvent: null,
  eventTimer: 0,
  eventCooldown: 22,
  eventCount: 0,
  consequenceCount: 0
};
const v55Missions = [
  {id:'m1', title:'Entrega importante', desc:'Leve a encomenda até Carlos — Trabalhador.', targetType:'npc', target:()=>worker, reward:180, xp:55, icon:'📦'},
  {id:'m2', title:'Compras para o bairro', desc:'Visite o Mercado Central.', targetType:'place', target:()=>places.find(p=>p.id==='loja'), reward:120, xp:40, icon:'🛒'},
  {id:'m3', title:'Revisão do veículo', desc:'Vá até a Oficina do Bairro.', targetType:'place', target:()=>places.find(p=>p.id==='oficina'), reward:200, xp:65, icon:'🔧'},
  {id:'m4', title:'Pausa merecida', desc:'Visite o Café da Praça para recuperar energia.', targetType:'place', target:()=>places.find(p=>p.id==='cafe'), reward:150, xp:45, icon:'☕'},
  {id:'m5', title:'Recado do guia', desc:'Encontre Marcos — Guia para receber uma nova tarefa.', targetType:'npc', target:()=>guide, reward:230, xp:80, icon:'💬'}
];
const v55Events = [
  {id:'traffic', title:'🚧 Trânsito intenso', desc:'As avenidas ficaram congestionadas. Complete o evento indo até Carlos.', duration:28, reward:110, xp:30},
  {id:'delivery', title:'🚨 Entrega urgente', desc:'Marcos precisa de ajuda. Chegue até ele antes do tempo acabar.', duration:25, reward:160, xp:45},
  {id:'market', title:'🛍️ Promoção relâmpago', desc:'Ana abriu uma oportunidade especial no Mercado Central.', duration:22, reward:90, xp:25}
];
function v55CurrentMission(){ return v55Missions[v55.missionIndex % v55Missions.length]; }
function v55TargetPosition(targetType, target){
  if(targetType==='npc' && target?.group) return target.group.position;
  if(targetType==='place' && target) return new THREE.Vector3(target.x,0,target.z-10);
  return null;
}
function v55Save(){
  localStorage.setItem('mundo-real-v55', JSON.stringify({missionIndex:v55.missionIndex, missionCompleted:v55.missionCompleted, eventCount:v55.eventCount, consequenceCount:v55.consequenceCount}));
}
function v55Load(){
  try{
    const x=JSON.parse(localStorage.getItem('mundo-real-v55')||'null');
    if(x){ v55.missionIndex=Number(x.missionIndex)||0; v55.missionCompleted=Number(x.missionCompleted)||0; v55.eventCount=Number(x.eventCount)||0; v55.consequenceCount=Number(x.consequenceCount)||0; }
  }catch(_){ }
}
function v55MissionText(){
  const m=v55CurrentMission();
  const target=m.target();
  return {m,target};
}
function v55RenderMission(){
  const {m,target}=v55MissionText();
  const elName=$('mission-name'), elDesc=$('mission-desc'), elReward=$('mission-reward'), elProg=$('mission-progress');
  if(!elName) return;
  elName.textContent=`${m.icon} ${m.title}`;
  elDesc.textContent=m.desc;
  elReward.textContent=`R$ ${m.reward} + ${m.xp} XP`;
  elProg.textContent=`${v55.missionCompleted}/${v55Missions.length}`;
}
function v55CompleteMission(){
  const {m}=v55MissionText();
  state.dinheiro+=m.reward; addXp(m.xp); state.stats.empregos += 1;
  v55.missionCompleted+=1; v55.missionIndex=(v55.missionIndex+1)%v55Missions.length;
  v55Save(); updateHud(); saveLocal();
  toast(`🎯 Missão concluída! +R$ ${m.reward} +${m.xp} XP`);
  message('Nova missão disponível.');
}
function v55EventTarget(ev){
  if(ev.id==='traffic') return {type:'npc', target:worker};
  if(ev.id==='delivery') return {type:'npc', target:guide};
  return {type:'place', target:places.find(p=>p.id==='loja')};
}
function v55StartEvent(){
  if(v55.activeEvent || v55.eventCooldown>0) return;
  const ev=v55Events[Math.floor(Math.random()*v55Events.length)];
  v55.activeEvent={...ev, remaining:ev.duration}; v55.eventCount+=1;
  if(ev.id==='traffic') traffic.forEach(v=>v.speed*=.62);
  const ui=$('event-card'); if(ui) ui.classList.remove('hidden');
  toast(`${ev.title} começou!`); v55Save();
}
function v55EndEvent(success=false){
  const ev=v55.activeEvent; if(!ev) return;
  if(success){ state.dinheiro+=ev.reward; addXp(ev.xp); toast(`🏆 Evento concluído! +R$ ${ev.reward} +${ev.xp} XP`); }
  else { state.energia=Math.max(0,state.energia-8); state.vida=Math.max(0,state.vida-4); v55.consequenceCount+=1; toast(`⏰ Evento perdido. Energia -8 • Vida -4`); }
  if(ev.id==='traffic') traffic.forEach(v=>v.speed/=.62);
  v55.activeEvent=null; v55.eventCooldown=35;
  $('event-card')?.classList.add('hidden');
  updateHud(); saveLocal(); v55Save();
}
function v55CheckTargets(dt){
  const {m,target}=v55MissionText();
  const pos=v55TargetPosition(m.targetType,target);
  if(pos && distance(player.position,pos)<5.5) v55CompleteMission();
  const ev=v55.activeEvent;
  if(ev){
    const t=v55EventTarget(ev), p=v55TargetPosition(t.type,t.target);
    if(p && distance(player.position,p)<5.5) v55EndEvent(true);
  }
  if(v55.activeEvent){
    v55.activeEvent.remaining-=dt;
    const timer=$('event-timer'); if(timer) timer.textContent=`${Math.ceil(v55.activeEvent.remaining)}s`;
    if(v55.activeEvent.remaining<=0) v55EndEvent(false);
  } else if(v55.eventCooldown>0) v55.eventCooldown-=dt;
  else if(Math.random()<dt*.018) v55StartEvent();
}
function v55RenderEvent(){
  const ev=v55.activeEvent; const card=$('event-card');
  if(!card) return;
  if(!ev){card.classList.add('hidden'); return;}
  card.classList.remove('hidden');
  $('event-title').textContent=ev.title;
  $('event-desc').textContent=ev.desc;
  $('event-timer').textContent=`${Math.ceil(ev.remaining)}s`;
}
function v55SetupUI(){
  const card=document.createElement('div'); card.id='event-card'; card.className='glass event-card hidden';
  card.innerHTML='<div class="event-head"><b id="event-title">EVENTO</b><strong id="event-timer">0s</strong></div><small id="event-desc">Evento ativo</small>';
  document.body.appendChild(card);
  const mbtn=document.createElement('button'); mbtn.id='mission-now'; mbtn.className='mission-now'; mbtn.textContent='🎯'; mbtn.title='Mostrar missão'; document.body.appendChild(mbtn);
  mbtn.addEventListener('click',()=>{v55RenderMission(); toast(`${v55CurrentMission().icon} ${v55CurrentMission().title}`);});
  v55Load();
  const oldHud=updateHud;
  updateHud=function(){ oldHud(); v55RenderMission(); v55RenderEvent(); };
  updateHud();
}
v55SetupUI();

loadLocal(); setWeather(localStorage.getItem("mundo-real-weather") || "clear", false); updateHud(); applyQuality(activeQuality); updateGraphicsHUD();
const qualitySelect = document.getElementById("quality-select");
if (qualitySelect) {
  qualitySelect.value = userQuality;
  qualitySelect.addEventListener("change", () => {
    userQuality = qualitySelect.value;
    localStorage.setItem("mundo-real-quality", userQuality);
    if (userQuality === "auto") {
      applyQuality(innerWidth < 700 ? "medium" : "high", true);
    } else applyQuality(userQuality, true);
  });
}
const settingsBtn = document.getElementById("graphics-btn");
const graphicsPanel = document.getElementById("graphics-panel");
const closeGraphics = document.getElementById("close-graphics");
if (settingsBtn && graphicsPanel) settingsBtn.addEventListener("click", () => graphicsPanel.classList.remove("hidden"));
if (closeGraphics && graphicsPanel) closeGraphics.addEventListener("click", () => graphicsPanel.classList.add("hidden"));
setupEconomyUI();

const jumpBtn=document.createElement('button'); jumpBtn.id='jump-btn'; jumpBtn.className='hidden'; jumpBtn.textContent='🦘'; jumpBtn.setAttribute('aria-label','Pular'); document.body.appendChild(jumpBtn);
jumpBtn.addEventListener('pointerdown', e=>{e.preventDefault(); tryJump();});
const refuelBtn=document.createElement('button'); refuelBtn.id='refuel-btn'; refuelBtn.className='action-extra hidden'; refuelBtn.textContent='⛽ ABASTECER R$ 80'; document.body.appendChild(refuelBtn);
refuelBtn.addEventListener('click',()=>{ if(!driving){toast('🚗 Entre no veículo primeiro.');return;} if(state.dinheiro<80){toast('💰 Você precisa de R$ 80.');return;} state.dinheiro-=80; vehicleState.fuel=100; vehicleState.damage=Math.max(0,vehicleState.damage-15); addXp(12); updateHud(); saveLocal(true); toast('⛽ Tanque cheio e revisão rápida feita!'); });

// Joystick e corrida.
let joystick = { x: 0, y: 0 }, running = false, cameraYaw = 0, moveAmount = 0;
const clock = new THREE.Clock(), stick = $("stick"), joy = $("joystick"); let joyId = null;
function moveJoy(e) { const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy, max = 42; const len = Math.hypot(dx, dy); if (len > max) { dx = dx / len * max; dy = dy / len * max; } stick.style.transform = `translate(${dx}px,${dy}px)`; joystick.x = dx / max; joystick.y = dy / max; }
joy.addEventListener("pointerdown", e => { joyId = e.pointerId; joy.setPointerCapture(joyId); moveJoy(e); });
joy.addEventListener("pointermove", e => { if (e.pointerId === joyId) moveJoy(e); });
function releaseJoy() { joyId = null; joystick.x = 0; joystick.y = 0; stick.style.transform = ""; }
joy.addEventListener("pointerup", releaseJoy); joy.addEventListener("pointercancel", releaseJoy);
$("run").addEventListener("pointerdown", () => running = true); $("run").addEventListener("pointerup", () => running = false); $("run").addEventListener("pointercancel", () => running = false);
$("interact").addEventListener("click", () => driving ? exitVehicle() : interactWith(interacting));
$("interaction-btn").addEventListener("click", () => interactWith(interacting));
const vehicleBtn=$("vehicle-btn"); if(vehicleBtn) vehicleBtn.addEventListener("click", enterVehicle);

// Arrastar no lado direito gira a câmera.
let lookId = null, lastX = 0;
renderer.domElement.addEventListener("pointerdown", e => { if (e.clientX > innerWidth * .42 && e.clientY > 100) { lookId = e.pointerId; lastX = e.clientX; } });
renderer.domElement.addEventListener("pointermove", e => { if (e.pointerId === lookId) { cameraYaw -= (e.clientX - lastX) * .008; lastX = e.clientX; } });
renderer.domElement.addEventListener("pointerup", () => lookId = null); renderer.domElement.addEventListener("pointercancel", () => lookId = null);

function nearestVehicleDistance(){ return parkedVehicle ? distance(player.position,parkedVehicle.position) : 999; }
function enterVehicle(){
  if(interiorState.inside){ toast("🚪 Saia do interior primeiro."); return; }
  if(driving){ exitVehicle(); return; }
  if(nearestVehicleDistance()>5){ toast("🚗 Chegue mais perto do veículo."); return; }
  driving=true; vehicleSpeed=0; vehicleHeading=parkedVehicle.rotation.y; player.visible=false;
  const btn=$("vehicle-btn"); if(btn) btn.textContent="🚪";
  toast("🚗 Você entrou no veículo");
}
function exitVehicle(){
  if(!driving) return;
  driving=false; vehicleSpeed=0; player.visible=true;
  const exitPos=new THREE.Vector3(parkedVehicle.position.x+2.8,0,parkedVehicle.position.z+1.2);
  if(isInsideCollider(exitPos,.7)) exitPos.set(parkedVehicle.position.x-2.8,0,parkedVehicle.position.z-1.2);
  player.position.copy(exitPos);
  const btn=$("vehicle-btn"); if(btn) btn.textContent="🚗";
  toast("🚶 Você saiu do veículo");
}
function updateVehicle(dt){
  if(!parkedVehicle) return;
  const near=nearestVehicleDistance();
  const btn=$("vehicle-btn");
  if(btn && !driving) btn.classList.toggle("hidden",near>5);
  const jump=document.getElementById('jump-btn'); if(jump) jump.classList.toggle('hidden', driving || !playerPhysics.grounded);
  const refuel=document.getElementById('refuel-btn');
  const atGas=places?.some(p=>p.id==='posto' && distance(parkedVehicle.position,new THREE.Vector3(p.x,0,p.z-10))<6);
  if(refuel) refuel.classList.toggle('hidden', !driving || !atGas);
  if(!driving){ const hud=$("vehicle-hud"); if(hud) hud.classList.add("hidden"); return; }
  if(vehicleState.fuel<=0){ vehicleThrottle=0; toast("⛽ Combustível vazio"); }
  const accel=vehicleThrottle*14;
  vehicleSpeed += accel*dt;
  vehicleSpeed *= Math.pow(.90,dt*10);
  const damageLimit=THREE.MathUtils.lerp(16,5,vehicleState.damage/100);
  vehicleSpeed=THREE.MathUtils.clamp(vehicleSpeed,-5,damageLimit);
  vehiclePhysics.hitCooldown=Math.max(0,vehiclePhysics.hitCooldown-dt);
  vehicleSteer=THREE.MathUtils.lerp(vehicleSteer,joystick.x,Math.min(1,dt*8));
  const steerScale=Math.min(1,Math.abs(vehicleSpeed)/3);
  vehicleHeading -= vehicleSteer*1.65*dt*steerScale;
  const forward=new THREE.Vector3(Math.sin(vehicleHeading),0,Math.cos(vehicleHeading));
  const previousVehiclePos=parkedVehicle.position.clone();
  parkedVehicle.position.addScaledVector(forward,vehicleSpeed*dt);
  if(resolveWorldCollision(parkedVehicle.position,2.0)){
    parkedVehicle.position.copy(previousVehiclePos);
    vehicleSpeed *= -.32;
    vehicleState.damage=Math.min(100,vehicleState.damage + Math.max(2,Math.abs(vehicleSpeed)*2.2));
    if(vehiclePhysics.hitCooldown<=0){ toast(`💥 Colisão! Danos: ${Math.round(vehicleState.damage)}%`); vehiclePhysics.hitCooldown=.7; }
  }
  // Colisão simples com o trânsito.
  for(const v of traffic){
    const d=distance(parkedVehicle.position,v.group.position);
    if(d<3.15 && vehiclePhysics.hitCooldown<=0){
      const away=new THREE.Vector3(parkedVehicle.position.x-v.group.position.x,0,parkedVehicle.position.z-v.group.position.z).normalize();
      parkedVehicle.position.addScaledVector(away,.9); vehicleSpeed*=-.45; v.speed=Math.max(2,v.speed*.82);
      vehicleState.damage=Math.min(100,vehicleState.damage+7); vehiclePhysics.hitCooldown=.9; toast(`🚗💥 Batida! Danos: ${Math.round(vehicleState.damage)}%`);
    }
  }
  parkedVehicle.position.x=THREE.MathUtils.clamp(parkedVehicle.position.x,-106,106);
  parkedVehicle.position.z=THREE.MathUtils.clamp(parkedVehicle.position.z,-106,106);
  parkedVehicle.rotation.y=vehicleHeading;
  vehicleState.fuel=Math.max(0,vehicleState.fuel-Math.abs(vehicleSpeed)*dt*.018);
  player.position.copy(parkedVehicle.position);
  if(btn) btn.textContent="🚪";
  const hud=$("vehicle-hud"); if(hud) hud.classList.toggle("hidden",!driving);
  const speedEl=$("vehicle-speed"), fuelEl=$("vehicle-fuel");
  if(speedEl) speedEl.textContent=`${Math.round(Math.abs(vehicleSpeed)*7)} km/h`;
  if(fuelEl) fuelEl.textContent=`⛽ ${Math.round(vehicleState.fuel)}% • 🔧 ${Math.round(vehicleState.damage)}%`;
}
function updateVehicleInput(){
  if(!driving){ vehicleThrottle=0; return; }
  const forwardInput=Math.max(0,-joystick.y), reverseInput=Math.max(0,joystick.y);
  vehicleThrottle=forwardInput-reverseInput*.65;
}



// V5.4 — Casas, lojas e interiores exploráveis.
const interiorState = { inside: false, place: null, previousPosition: new THREE.Vector3(), previousRotation: 0 };
const interiors = [];
let interiorPrompt = null;

function makeInteriorFurniture(group, type) {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(18, .18, 14), new THREE.MeshStandardMaterial({color:0x6d6257, roughness:.9}));
  floor.position.y=.02; floor.receiveShadow=true; group.add(floor);
  const walls=[
    [0,3.1,-7,18,.35,6.2],[0,3.1,7,18,.35,6.2],[-9,3.1,0,.35,14,6.2],[9,3.1,0,.35,14,6.2]
  ];
  for(const [x,y,z,w,d,h] of walls){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,d,h),new THREE.MeshStandardMaterial({color:0xd9c8aa,roughness:.9})); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; group.add(m); }
  const ceiling=new THREE.Mesh(new THREE.BoxGeometry(18,.25,14),new THREE.MeshStandardMaterial({color:0xb8aa98,roughness:1})); ceiling.position.y=6.25; group.add(ceiling);
  const light=new THREE.PointLight(0xffd79a,1.8,22); light.position.set(0,5.2,0); group.add(light);
  const rug=new THREE.Mesh(new THREE.BoxGeometry(6,.06,4),new THREE.MeshStandardMaterial({color:type==='loja'?0x315c72:type==='oficina'?0x6d4d2c:0x7b4f45,roughness:1})); rug.position.set(0,.15,1.2); group.add(rug);
  if(type==='casa'){
    const bed=new THREE.Mesh(new THREE.BoxGeometry(4.4,1,2.2),new THREE.MeshStandardMaterial({color:0x536d8b,roughness:.8})); bed.position.set(-4,.7,-2.2); group.add(bed);
    const pillow=new THREE.Mesh(new THREE.BoxGeometry(1.3,.35,1.7),new THREE.MeshStandardMaterial({color:0xf0e5d2,roughness:.8})); pillow.position.set(-5.1,1.35,-2.2); group.add(pillow);
    const table=boxInterior(group,3,.9,1.5,2.4,1.8,0x7a5236); table.position.set(4,.9,-2); 
  } else if(type==='loja'){
    for(let i=-1;i<=1;i++){
      const shelf=boxInterior(group,4,.9,1.0,3.8,1.8,0x8b6a42); shelf.position.set(i*4,.9,-2.5);
      const sign=boxInterior(group,1.4,.12,.7,3.7,.35,0xf0b429); sign.position.set(i*4,2.05,-2.5);
    }
    const counter=boxInterior(group,4.2,1.1,1.1,3.8,2.2,0x3d5a6c); counter.position.set(3,.6,3.3);
  } else if(type==='oficina'){
    const bench=boxInterior(group,5,.9,1.3,3.5,2.2,0x704b2f); bench.position.set(0,.75,-2.5);
    const toolbox=boxInterior(group,1.5,1.2,1.5,0.9,1.8,0xd35436); toolbox.position.set(4,.8,-1);
    const tire=new THREE.Mesh(new THREE.TorusGeometry(1,.22,10,24),new THREE.MeshStandardMaterial({color:0x15171a,roughness:1})); tire.position.set(-4,1.2,-1); tire.rotation.y=Math.PI/2; group.add(tire);
  } else {
    for(let i=0;i<2;i++){
      const table=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,.18,20),new THREE.MeshStandardMaterial({color:0x7b4d32,roughness:.9})); table.position.set(i?3:-3,.95,1.5); group.add(table);
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.9,10),new THREE.MeshStandardMaterial({color:0x34373b})); leg.position.set(i?3:-3,.5,1.5); group.add(leg);
    }
  }
}
function boxInterior(group,w,h,d,x,y,z,color){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.8})); m.position.set(x,y,z); m.castShadow=true; group.add(m); return m; }

function createInterior(place){
  const group=new THREE.Group();
  group.position.set(300 + interiors.length*25, 0, 300);
  group.visible=false;
  makeInteriorFurniture(group, place.type);
  const door=new THREE.Mesh(new THREE.BoxGeometry(2.1,3.4,.25),new THREE.MeshStandardMaterial({color:0x49352a,roughness:.8})); door.position.set(0,1.7,6.85); group.add(door);
  const exitSign=new THREE.Mesh(new THREE.BoxGeometry(2.8,.55,.08),new THREE.MeshBasicMaterial({color:0x63d471})); exitSign.position.set(0,4.25,6.65); group.add(exitSign);
  scene.add(group); place.interior=group;
}

const places=[
  {id:'casa',name:'Casa do bairro',type:'casa',x:24,z:24,icon:'🏠',desc:'Uma casa simples onde você pode descansar.'},
  {id:'loja',name:'Mercado Central',type:'loja',x:-24,z:24,icon:'🛒',desc:'Uma loja para comprar suprimentos.'},
  {id:'oficina',name:'Oficina do Bairro',type:'oficina',x:24,z:-24,icon:'🔧',desc:'Oficina para manutenção e serviços.'},
  {id:'cafe',name:'Café da Praça',type:'cafe',x:-24,z:-24,icon:'☕',desc:'Um lugar para descansar e recuperar energia.'}
];
places.forEach(createInterior);

function addPlaceEntrance(place){
  const sign=box(place.x,2.7,place.z-10.25,5.8,1.5,.18,0x17212b,{roughness:.65,metalness:.1});
  sign.userData.place=place;
  const text=document.createElement('div'); text.textContent=`${place.icon} ${place.name}`;
  text.style.cssText='position:absolute;transform:translate(-50%,-50%);font:700 13px system-ui;color:white;background:rgba(8,16,24,.82);padding:5px 9px;border-radius:10px;pointer-events:none;display:none;white-space:nowrap;z-index:20';
  document.body.appendChild(text); place.label=text; place.sign=sign;
}
places.forEach(addPlaceEntrance);
createGasStation();

function nearestPlace(){
  if(interiorState.inside) return null;
  let best=null, bestD=4.8;
  for(const p of places){ const d=Math.hypot(player.position.x-p.x,player.position.z-(p.z-10)); if(d<bestD){best=p;bestD=d;} }
  return best;
}
function enterPlace(place){
  if(!place || interiorState.inside) return;
  interiorState.inside=true; interiorState.place=place; interiorState.previousPosition.copy(player.position); interiorState.previousRotation=player.rotation.y;
  place.interior.visible=true;
  player.position.set(place.interior.position.x,0,place.interior.position.z+4.2); player.rotation.y=Math.PI;
  message(`${place.icon} Você entrou em ${place.name}.`); toast(`${place.icon} Entrou em ${place.name}`);
  const exit=$('interior-exit'); if(exit) exit.classList.remove('hidden');
}
function exitPlace(){
  if(!interiorState.inside) return;
  const place=interiorState.place; if(place?.interior) place.interior.visible=false;
  player.position.copy(interiorState.previousPosition); player.rotation.y=interiorState.previousRotation;
  interiorState.inside=false; interiorState.place=null;
  const exit=$('interior-exit'); if(exit) exit.classList.add('hidden');
  message('Você voltou para a cidade.'); toast('🚪 Saiu do interior');
}
function updatePlaceUI(){
  const near=nearestPlace();
  const enter=$('place-enter');
  if(enter){ enter.classList.toggle('hidden',!near || driving); if(near) enter.textContent=`${near.icon} ENTRAR`; }
  for(const p of places){
    if(!p.label) continue;
    const pos=new THREE.Vector3(p.x,p.z?3.7:3.7,p.z-10); pos.project(camera);
    const d=Math.hypot(player.position.x-p.x,player.position.z-p.z);
    const visible=!interiorState.inside && pos.z<1 && d<55;
    p.label.style.display=visible?'block':'none';
    p.label.style.left=`${(pos.x*.5+.5)*innerWidth}px`; p.label.style.top=`${(-pos.y*.5+.5)*innerHeight}px`;
  }
}

const originalUpdateInteraction=updateInteraction;
function updateInteraction() {
  if (interiorState.inside) { interacting = null; $("interaction").classList.add("hidden"); return; }
  let nearest = null, nearestDist = 7;
  for (const n of npcs) { const d = distance(player.position, n.group.position); if (d < nearestDist) { nearestDist = d; nearest = n; } }
  interacting = nearest;
  if (nearest) {
    $("interaction").classList.remove("hidden"); $("interaction-title").textContent = nearest.name; $("interaction-desc").textContent = activeJob && nearest === activeJob.target ? `Concluir: ${activeJob.title} • +R$ ${activeJob.reward}` : nearest.desc; $("interaction-icon").textContent = activeJob && nearest === activeJob.target ? "📦" : nearest.icon;
    message(activeJob && nearest === activeJob.target ? `📦 Destino do trabalho: ${nearest.name}` : `Você está perto de ${nearest.name}`);
  } else { $("interaction").classList.add("hidden"); }
  // Posicionamento aproximado dos marcadores usando projeção 3D.
  for (const n of npcs) {
    const p = n.group.position.clone(); p.y = 3.15; p.project(camera);
    const visible = p.z < 1 && distance(player.position, n.group.position) < 42;
    n.label.style.display = visible ? "block" : "none";
    n.label.style.left = `${(p.x * .5 + .5) * innerWidth}px`; n.label.style.top = `${(-p.y * .5 + .5) * innerHeight}px`;
  }
}


function applyQuality(level, announce = false) {
  if (!QUALITY[level]) return;
  activeQuality = level;
  const q = QUALITY[level];
  renderer.setPixelRatio(q.pixel);
  renderer.shadowMap.enabled = q.shadows;
  sun.castShadow = q.shadows;
  sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
  scene.fog.far = q.fog;
  scene.fog.near = Math.max(35, q.fog * .28);
  scene.traverse(obj => {
    if (obj.isMesh && obj.userData.vegetation) obj.castShadow = q.shadows;
  });
  const el = document.getElementById("quality-value");
  if (el) el.textContent = userQuality === "auto" ? `AUTO • ${level.toUpperCase()}` : level.toUpperCase();
  if (announce) toast(`🎨 Qualidade ${level.toUpperCase()}`);
}
function updateAdaptiveQuality(dt) {
  performanceUI.frames++;
  performanceUI.accumulator += dt;
  performanceUI.adaptiveTimer += dt;
  if (performanceUI.accumulator >= .5) {
    performanceUI.fps = Math.round(performanceUI.frames / performanceUI.accumulator);
    performanceUI.frames = 0; performanceUI.accumulator = 0;
    const fpsEl = document.getElementById("fps-value");
    if (fpsEl) fpsEl.textContent = performanceUI.fps;
    const bar = document.getElementById("fps-bar");
    if (bar) bar.style.width = `${Math.min(100, performanceUI.fps / 60 * 100)}%`;
  }
  if (userQuality !== "auto" || performanceUI.adaptiveTimer < 2.5) return;
  performanceUI.adaptiveTimer = 0;
  const target = performanceUI.fps < 27 ? "low" : performanceUI.fps < 42 ? "medium" : "high";
  if (target !== activeQuality) applyQuality(target);
}
function updateLOD() {
  const maxDetail = QUALITY[activeQuality].detail;
  scene.traverse(obj => {
    if (!obj.userData.visualDetail) return;
    const p = obj.getWorldPosition(new THREE.Vector3());
    const d = distance(player.position, p);
    obj.visible = d < maxDetail;
  });
}
function updateGraphicsHUD() {
  const el = document.getElementById("quality-value");
  if (el) el.textContent = userQuality === "auto" ? `AUTO • ${activeQuality.toUpperCase()}` : userQuality.toUpperCase();
}

function setWeather(type, announce=true){
  worldClock.weather=type;
  const c=weatherColors[type] || weatherColors.clear;
  scene.background.setHex(c.sky); scene.fog.color.setHex(c.fog);
  if(weatherDrops) weatherDrops.visible = type === "rain";
  if(announce && typeof toast === "function") toast(type === "rain" ? "🌧️ Começou a chover" : type === "cloudy" ? "☁️ O céu ficou nublado" : "☀️ O tempo abriu");
  localStorage.setItem('mundo-real-weather', type);
}
function updateWeather(dt){
  worldClock.weatherTimer -= dt;
  if(worldClock.weatherTimer <= 0){
    const roll=Math.random(); setWeather(roll<.45?'clear':roll<.75?'cloudy':'rain');
    worldClock.weatherTimer=70+Math.random()*110;
  }
  if(weatherDrops && worldClock.weather === 'rain'){
    const pos=weatherDropPositions;
    for(let i=0;i<pos.length;i+=3){ pos[i+1]-=dt*22; pos[i]+=dt*1.4; if(pos[i+1]<1){pos[i+1]=35+Math.random()*4; pos[i]=(Math.random()-.5)*180; pos[i+2]=(Math.random()-.5)*180;} }
    weatherDrops.geometry.attributes.position.needsUpdate=true;
  }
}
function updateDayNight(dt, time){
  worldClock.hour=(worldClock.hour + dt*worldClock.speed) % 24;
  const angle=(worldClock.hour/24)*Math.PI*2 - Math.PI/2;
  const sunY=Math.sin(angle);
  const daylight=THREE.MathUtils.clamp((sunY+.12)/1.08,0,1);
  const warmth=THREE.MathUtils.lerp(.55,1,daylight);
  sun.position.set(Math.cos(angle)*75, Math.max(8,sunY*80+18), Math.sin(angle)*75);
  sun.intensity=THREE.MathUtils.lerp(.18,3.15,daylight);
  sun.color.setRGB(1, .72+.28*daylight, .52+.48*daylight);
  scene.children.forEach(o=>{
    if(o.isHemisphereLight) { o.intensity=THREE.MathUtils.lerp(.55,2.05,daylight); }
  });
  const base=weatherColors[worldClock.weather] || weatherColors.clear;
  const night=1-daylight;
  const baseColor=new THREE.Color(base.sky);
  const nightColor=new THREE.Color(0x07111f);
  scene.background.copy(baseColor).lerp(nightColor, night*.78);
  scene.fog.color.copy(baseColor).lerp(nightColor, night*.7);
  streetLights.forEach(l=>l.intensity=THREE.MathUtils.lerp(2.2,.05,daylight));
  const nightSkySun=scene.getObjectByProperty('uuid', skySun?.uuid);
  if(nightSkySun) { nightSkySun.material.color.setHex(daylight>.08?0xffe6a1:0xc8d8ff); nightSkySun.visible=daylight>.03; }
  if(audioCtx && ambientGain){ ambientGain.gain.setTargetAtTime(.22 + night*.16 + (worldClock.weather==='rain'?.16:0), audioCtx.currentTime, .4); }
  const timeEl=document.getElementById('world-time'); if(timeEl) timeEl.textContent=`${String(Math.floor(worldClock.hour)).padStart(2,'0')}:${String(Math.floor((worldClock.hour%1)*60)).padStart(2,'0')}`;
  const weatherEl=document.getElementById('world-weather'); if(weatherEl) weatherEl.textContent=worldClock.weather==='rain'?'🌧️ Chuva':worldClock.weather==='cloudy'?'☁️ Nublado':daylight<.08?'🌙 Noite':'☀️ Ensolarado';
}

function resetCheckpoint() {
  localStorage.removeItem(SAVE_KEY_V57);
  localStorage.removeItem(SAVE_KEY_V60);
  localStorage.removeItem("mundo-real-v2");
  localStorage.removeItem("mundo-real-v55");
  location.reload();
}
function setPaused(paused) {
  gamePaused = paused;
  document.body.classList.toggle("game-paused", paused);
  const el = document.getElementById("pause-indicator");
  if (el) el.classList.toggle("hidden", !paused);
  if (paused) saveLocal(true);
}
addEventListener("visibilitychange", () => {
  if (document.hidden) saveLocal(true);
});
addEventListener("beforeunload", () => saveLocal(true));

let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, .05); last = now;
  if (gamePaused) { renderer.render(scene, camera); return; }
  const input = Math.min(1, Math.hypot(joystick.x, joystick.y));
  const isMoving = input > .05;
  updateVehicleInput();
  updatePlayerPhysics(dt);
  updateVehicle(dt);
  const speed = (running && state.energia > 0 ? 9 : 5) * dt;
  if (running && isMoving && state.energia > 0) state.energia = Math.max(0, state.energia - dt * 5);
  else if (!isMoving) state.energia = Math.min(100, state.energia + dt * 2.5);
  moveAmount = THREE.MathUtils.lerp(moveAmount, input, Math.min(1, dt * 12));
  // Movimento 360° relativo à câmera:
  // joystick para cima = frente, baixo = trás, esquerda/direita = lateral.
  const cameraForward = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
  const cameraRight = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
  const moveDirection = new THREE.Vector3();

  if (isMoving && !driving) {
    // No touchscreen, Y negativo significa "cima".
    // Por isso invertimos o eixo Y para transformar cima em avanço.
    moveDirection
      .addScaledVector(cameraRight, joystick.x)
      .addScaledVector(cameraForward, -joystick.y)
      .normalize();

    const beforeX=player.position.x, beforeZ=player.position.z;
    player.position.addScaledVector(moveDirection, speed);
    if(resolveWorldCollision(player.position, .75)){ player.position.x=beforeX; player.position.z=beforeZ; toast('🧱 Não dá para atravessar o prédio.'); }

    // O personagem acompanha exatamente a direção escolhida no joystick.
    const desired = Math.atan2(moveDirection.x, moveDirection.z);
    let diff = THREE.MathUtils.euclideanModulo(
      desired - player.rotation.y + Math.PI,
      Math.PI * 2
    ) - Math.PI;
    player.rotation.y += diff * Math.min(1, dt * 12);
  }
  if (!interiorState.inside) { player.position.x = THREE.MathUtils.clamp(player.position.x, -105, 105); player.position.z = THREE.MathUtils.clamp(player.position.z, -105, 105); }
  const t = clock.getElapsedTime(), swing = Math.sin(t * (running ? 11 : 8)) * .65 * moveAmount, bob = Math.abs(Math.sin(t * (running ? 11 : 8))) * .045 * moveAmount;
  leftLeg.rotation.x = swing; rightLeg.rotation.x = -swing; leftArm.rotation.x = -swing * .75; rightArm.rotation.x = swing * .75;
  torso.position.y = 1.75 + bob; neck.position.y = 2.38 + bob; head.position.y = 2.85 + bob; hair.position.y = 3.02 + bob;
  if (interiorState.inside) { state.energia = Math.min(100, state.energia + dt * 7); state.vida = Math.min(100, state.vida + dt * 1.5); }
  updateLivingCity(dt, t);
  updateDayNight(dt, t);
  updateWeather(dt);
  for (const n of npcs) n.ring.rotation.z += dt * 1.5;
  water.rotation.z += dt * .12;
  water.material.roughness = .16 + Math.sin(t*1.4)*.03;
  const focus = driving ? parkedVehicle.position : player.position;
  const target = new THREE.Vector3(focus.x, focus.y + (driving ? 1.7 : 1.65), focus.z);
  const offset = new THREE.Vector3(-Math.sin(cameraYaw) * (driving ? 11 : 9), driving ? 5.8 : 5.2, -Math.cos(cameraYaw) * (driving ? 11 : 9));
  camera.position.lerp(target.clone().add(offset), Math.min(1, dt * 7)); camera.lookAt(target);
  performanceUI.interactionTimer += dt;
  performanceUI.hudTimer += dt;
  if (performanceUI.interactionTimer > .12) { performanceUI.interactionTimer = 0; updateInteraction(); updatePlaceUI(); }
  if (performanceUI.hudTimer > .18) { performanceUI.hudTimer = 0; updateHud(); }
  v55CheckTargets(dt);
  updateAdaptiveQuality(dt);
  performanceUI.lodTimer += dt;
  if (performanceUI.lodTimer > .6) { performanceUI.lodTimer = 0; updateLOD(); }
  performanceUI.saveTimer += dt;
  if (performanceUI.saveTimer >= 8) { performanceUI.saveTimer = 0; saveLocal(); }
  renderer.render(scene, camera);
}

camera.position.set(0, 7, 19); animate(performance.now());
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(QUALITY[activeQuality].pixel); });


