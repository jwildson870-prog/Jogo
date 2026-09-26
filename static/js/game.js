import * as THREE from "three";

const performanceUI = { frames: 0, last: performance.now(), fps: 60, accumulator: 0, sample: 0, adaptiveTimer: 0, lodTimer: 0, interactionTimer: 0, hudTimer: 0 };
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
  const light=new THREE.PointLight(0xffc96b,.75,9,2); light.position.copy(glow.position); scene.add(light);
}
function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

for (let i = -80; i <= 80; i += 40) { road(0, i, 220, 10); road(i, 0, 10, 220); }
// Calçadas, faixas e postes deixam a cidade mais legível e realista.
for(let i=-80;i<=80;i+=40){ sidewalk(-7.2,i,3.8,220); sidewalk(7.2,i,3.8,220); sidewalk(i,-7.2,220,3.8); sidewalk(i,7.2,220,3.8); }
for(let i=-80;i<=80;i+=40){ for(let p=-80;p<80;p+=8){ stripe(-.55,p,1.0,4.2); stripe(.55,p,1.0,4.2); stripe(p,-.55,4.2,1.0); stripe(p,.55,4.2,1.0); } }
for(let x=-90;x<=90;x+=20){ lamp(x, -6.1); lamp(x, 6.1); }
for(let z=-90;z<=90;z+=20){ lamp(-6.1,z); lamp(6.1,z); }
for (let x = -80; x <= 80; x += 40) for (let z = -80; z <= 80; z += 40) {
  if (Math.abs(x) < 1 || Math.abs(z) < 1) continue;
  const h = 8 + Math.random() * 13;
  const colors = [0x7c8790, 0x9a8774, 0x667887, 0x8c6f62, 0x707c68];
  box(x, h / 2, z, 20, h, 20, colors[Math.floor(Math.random() * colors.length)]);
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
const defaultState = { nome: "Jogador", vida: 100, dinheiro: 500, nivel: 1, xp: 0, xp_proximo: 100, energia: 100, inventario: [] };
let state = { ...defaultState };
let mission = { id: 1, done: false, npc: guide, title: "Conheça a cidade", desc: "Encontre o NPC com o ícone 💬.", rewardMoney: 100, rewardXp: 50 };
let interacting = null;

const $ = id => document.getElementById(id);
function toast(text) { $("toast").textContent = text; $("toast").classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => $("toast").classList.remove("show"), 1800); }
function message(text) { $("message").textContent = text; }
function saveLocal() { localStorage.setItem("mundo-real-v2", JSON.stringify({ ...state, missionDone: mission.done })); }
function loadLocal() {
  try { const saved = JSON.parse(localStorage.getItem("mundo-real-v2")); if (saved) { state = { ...defaultState, ...saved }; mission.done = !!saved.missionDone; } } catch (_) {}
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
function interactWith(target) {
  if (!target) { message("Não há ninguém próximo para interagir."); return; }
  if (target === guide) {
    if (!mission.done) { completeMission(); }
    else { addXp(10); toast("Marcos: Continue explorando! +10 XP"); updateHud(); saveLocal(); }
  } else if (target === shopkeeper) {
    if (state.dinheiro >= 50) { state.dinheiro -= 50; state.inventario.push("Lanche"); state.energia = Math.min(100, state.energia + 25); addXp(20); toast("🛒 Você comprou um lanche por R$ 50. +20 XP"); }
    else toast("💰 Você precisa de R$ 50.");
    updateHud(); saveLocal();
  } else if (target === worker) {
    state.dinheiro += 80; addXp(35); toast("💼 Trabalho concluído! +R$ 80 e +35 XP"); updateHud(); saveLocal();
  }
}

loadLocal(); updateHud(); applyQuality(activeQuality); updateGraphicsHUD();
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
  if(driving){ exitVehicle(); return; }
  if(nearestVehicleDistance()>5){ toast("🚗 Chegue mais perto do veículo."); return; }
  driving=true; vehicleSpeed=0; vehicleHeading=parkedVehicle.rotation.y; player.visible=false;
  const btn=$("vehicle-btn"); if(btn) btn.textContent="🚪";
  toast("🚗 Você entrou no veículo");
}
function exitVehicle(){
  if(!driving) return;
  driving=false; vehicleSpeed=0; player.visible=true;
  player.position.set(parkedVehicle.position.x+2.8,0,parkedVehicle.position.z+1.2);
  const btn=$("vehicle-btn"); if(btn) btn.textContent="🚗";
  toast("🚶 Você saiu do veículo");
}
function updateVehicle(dt){
  if(!parkedVehicle) return;
  const near=nearestVehicleDistance();
  const btn=$("vehicle-btn");
  if(btn && !driving) btn.classList.toggle("hidden",near>5);
  if(!driving){ const hud=$("vehicle-hud"); if(hud) hud.classList.add("hidden"); return; }
  if(vehicleState.fuel<=0){ vehicleThrottle=0; toast("⛽ Combustível vazio"); }
  const accel=vehicleThrottle*14;
  vehicleSpeed += accel*dt;
  vehicleSpeed *= Math.pow(.90,dt*10);
  vehicleSpeed=THREE.MathUtils.clamp(vehicleSpeed,-5,16);
  vehicleSteer=THREE.MathUtils.lerp(vehicleSteer,joystick.x,Math.min(1,dt*8));
  const steerScale=Math.min(1,Math.abs(vehicleSpeed)/3);
  vehicleHeading -= vehicleSteer*1.65*dt*steerScale;
  const forward=new THREE.Vector3(Math.sin(vehicleHeading),0,Math.cos(vehicleHeading));
  parkedVehicle.position.addScaledVector(forward,vehicleSpeed*dt);
  parkedVehicle.position.x=THREE.MathUtils.clamp(parkedVehicle.position.x,-106,106);
  parkedVehicle.position.z=THREE.MathUtils.clamp(parkedVehicle.position.z,-106,106);
  parkedVehicle.rotation.y=vehicleHeading;
  vehicleState.fuel=Math.max(0,vehicleState.fuel-Math.abs(vehicleSpeed)*dt*.018);
  player.position.copy(parkedVehicle.position);
  if(btn) btn.textContent="🚪";
  const hud=$("vehicle-hud"); if(hud) hud.classList.toggle("hidden",!driving);
  const speedEl=$("vehicle-speed"), fuelEl=$("vehicle-fuel");
  if(speedEl) speedEl.textContent=`${Math.round(Math.abs(vehicleSpeed)*7)} km/h`;
  if(fuelEl) fuelEl.textContent=`⛽ ${Math.round(vehicleState.fuel)}%`;
}
function updateVehicleInput(){
  if(!driving){ vehicleThrottle=0; return; }
  const forwardInput=Math.max(0,-joystick.y), reverseInput=Math.max(0,joystick.y);
  vehicleThrottle=forwardInput-reverseInput*.65;
}

function updateInteraction() {
  let nearest = null, nearestDist = 7;
  for (const n of npcs) { const d = distance(player.position, n.group.position); if (d < nearestDist) { nearestDist = d; nearest = n; } }
  interacting = nearest;
  if (nearest) {
    $("interaction").classList.remove("hidden"); $("interaction-title").textContent = nearest.name; $("interaction-desc").textContent = nearest.desc; $("interaction-icon").textContent = nearest.icon;
    message(`Você está perto de ${nearest.name}`);
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

let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, .05); last = now;
  const input = Math.min(1, Math.hypot(joystick.x, joystick.y));
  const isMoving = input > .05;
  updateVehicleInput();
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

    player.position.addScaledVector(moveDirection, speed);

    // O personagem acompanha exatamente a direção escolhida no joystick.
    const desired = Math.atan2(moveDirection.x, moveDirection.z);
    let diff = THREE.MathUtils.euclideanModulo(
      desired - player.rotation.y + Math.PI,
      Math.PI * 2
    ) - Math.PI;
    player.rotation.y += diff * Math.min(1, dt * 12);
  }
  player.position.x = THREE.MathUtils.clamp(player.position.x, -105, 105); player.position.z = THREE.MathUtils.clamp(player.position.z, -105, 105);
  const t = clock.getElapsedTime(), swing = Math.sin(t * (running ? 11 : 8)) * .65 * moveAmount, bob = Math.abs(Math.sin(t * (running ? 11 : 8))) * .045 * moveAmount;
  leftLeg.rotation.x = swing; rightLeg.rotation.x = -swing; leftArm.rotation.x = -swing * .75; rightArm.rotation.x = swing * .75;
  torso.position.y = 1.75 + bob; neck.position.y = 2.38 + bob; head.position.y = 2.85 + bob; hair.position.y = 3.02 + bob;
  updateLivingCity(dt, t);
  for (const n of npcs) n.ring.rotation.z += dt * 1.5;
  water.rotation.z += dt * .12;
  water.material.roughness = .16 + Math.sin(t*1.4)*.03;
  const daylight = .92 + Math.sin(t * .018) * .08; sun.intensity = 3.1 * daylight;
  const focus = driving ? parkedVehicle.position : player.position;
  const target = new THREE.Vector3(focus.x, focus.y + (driving ? 1.7 : 1.65), focus.z);
  const offset = new THREE.Vector3(-Math.sin(cameraYaw) * (driving ? 11 : 9), driving ? 5.8 : 5.2, -Math.cos(cameraYaw) * (driving ? 11 : 9));
  camera.position.lerp(target.clone().add(offset), Math.min(1, dt * 7)); camera.lookAt(target);
  performanceUI.interactionTimer += dt;
  performanceUI.hudTimer += dt;
  if (performanceUI.interactionTimer > .12) { performanceUI.interactionTimer = 0; updateInteraction(); }
  if (performanceUI.hudTimer > .18) { performanceUI.hudTimer = 0; updateHud(); }
  updateAdaptiveQuality(dt);
  performanceUI.lodTimer += dt;
  if (performanceUI.lodTimer > .6) { performanceUI.lodTimer = 0; updateLOD(); }
  renderer.render(scene, camera);
}

camera.position.set(0, 7, 19); animate(performance.now());
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(QUALITY[activeQuality].pixel); });


