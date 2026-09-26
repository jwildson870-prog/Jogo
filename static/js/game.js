import * as THREE from "three";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 180);

const camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, .1, 500);
camera.position.set(0, 7, 12);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById("game").appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff,0x557755,2));
const sun=new THREE.DirectionalLight(0xffffff,2.5);
sun.position.set(30,50,20); sun.castShadow=true; scene.add(sun);

const ground=new THREE.Mesh(
 new THREE.PlaneGeometry(240,240),
 new THREE.MeshStandardMaterial({color:0x3d7040})
);
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);

function box(x,y,z,w,h,d,color){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color}));
 m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;
}
function road(x,z,w,d){
 box(x,.025,z,w,.05,d,0x30343a);
}
for(let i=-80;i<=80;i+=40){road(0,i,220,10);road(i,0,10,220)}
for(let x=-80;x<=80;x+=40) for(let z=-80;z<=80;z+=40){
 if(Math.abs(x)<1||Math.abs(z)<1) continue;
 const h=8+Math.random()*13;
 box(x, h/2, z, 20,h,20, new THREE.Color().setHSL(Math.random(),.25,.45));
 box(x,h+.8,z,16,.8,16,0x555555);
}
for(let i=0;i<45;i++){
 const x=Math.round((Math.random()*200-100)/10)*10+5;
 const z=Math.round((Math.random()*200-100)/10)*10+5;
 if(Math.abs(x%40)<12 || Math.abs(z%40)<12) continue;
 const trunk=box(x,1.2,z,1.5,2.4,1.5,0x70452b);
 const crown=new THREE.Mesh(new THREE.SphereGeometry(3.2,12,10),new THREE.MeshStandardMaterial({color:0x1e7a38}));
 crown.position.set(x,4,z);crown.castShadow=true;scene.add(crown);
}

// PERSONAGEM 3D
const player = new THREE.Group();
player.position.set(0,0,10);
scene.add(player);

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(1,24),
  new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.22})
);
shadow.rotation.x=-Math.PI/2;
shadow.position.y=.03;
player.add(shadow);

function limb(radius, length, color){
  const g=new THREE.Group();
  const m=new THREE.Mesh(
    new THREE.CapsuleGeometry(radius,length,5,10),
    new THREE.MeshStandardMaterial({color,roughness:.8})
  );
  m.position.y=-length*.5;
  m.castShadow=true;
  g.add(m);
  return g;
}

const leftLeg=limb(.22,.9,0x20252d);
const rightLeg=limb(.22,.9,0x20252d);
leftLeg.position.set(-.3,1,0);
rightLeg.position.set(.3,1,0);
player.add(leftLeg,rightLeg);

const torso=new THREE.Mesh(
  new THREE.CapsuleGeometry(.55,.8,6,12),
  new THREE.MeshStandardMaterial({color:0x1976d2,roughness:.65})
);
torso.position.y=1.75;
torso.castShadow=true;
player.add(torso);

const neck=new THREE.Mesh(
  new THREE.CylinderGeometry(.18,.18,.25,12),
  new THREE.MeshStandardMaterial({color:0xc98f72})
);
neck.position.y=2.38;
player.add(neck);

const head=new THREE.Mesh(
  new THREE.SphereGeometry(.52,20,16),
  new THREE.MeshStandardMaterial({color:0xc98f72,roughness:.8})
);
head.position.y=2.85;
head.castShadow=true;
player.add(head);

const hair=new THREE.Mesh(
  new THREE.SphereGeometry(.54,20,12,0,Math.PI*2,0,Math.PI*.55),
  new THREE.MeshStandardMaterial({color:0x17120f,roughness:.9})
);
hair.position.set(0,3.02,-.02);
player.add(hair);

function eye(x){
  const e=new THREE.Mesh(
    new THREE.SphereGeometry(.055,8,8),
    new THREE.MeshStandardMaterial({color:0x111111})
  );
  e.position.set(x,2.88,.49);
  player.add(e);
}
eye(-.17); eye(.17);

const leftArm=limb(.18,.78,0x1976d2);
const rightArm=limb(.18,.78,0x1976d2);
leftArm.position.set(-.72,2.12,0);
rightArm.position.set(.72,2.12,0);
leftArm.rotation.z=-.08;
rightArm.rotation.z=.08;
player.add(leftArm,rightArm);

const backpack=new THREE.Mesh(
  new THREE.BoxGeometry(.62,.8,.22),
  new THREE.MeshStandardMaterial({color:0x263238,roughness:.8})
);
backpack.position.set(0,1.75,-.55);
player.add(backpack);

let joystick={x:0,y:0}, running=false, cameraYaw=0, moveAmount=0;
const clock=new THREE.Clock();
const stick=document.getElementById("stick"), joy=document.getElementById("joystick");
let joyId=null;
function moveJoy(e){
 const r=joy.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
 let dx=e.clientX-cx,dy=e.clientY-cy, max=42;
 const len=Math.hypot(dx,dy); if(len>max){dx=dx/len*max;dy=dy/len*max}
 stick.style.transform=`translate(${dx}px,${dy}px)`;
 joystick.x=dx/max; joystick.y=dy/max;
}
joy.addEventListener("pointerdown",e=>{joyId=e.pointerId;joy.setPointerCapture(joyId);moveJoy(e)});
joy.addEventListener("pointermove",e=>{if(e.pointerId===joyId)moveJoy(e)});
joy.addEventListener("pointerup",()=>{joyId=null;joystick.x=0;joystick.y=0;stick.style.transform=""});

document.getElementById("run").addEventListener("pointerdown",()=>running=true);
document.getElementById("run").addEventListener("pointerup",()=>running=false);
document.getElementById("interact").addEventListener("click",()=>{
 document.getElementById("message").textContent="Você interagiu com o mundo!";
 setTimeout(()=>document.getElementById("message").textContent="Explore o mundo!",1500);
});

let lookId=null,lastX=0;
renderer.domElement.addEventListener("pointerdown",e=>{if(e.clientX>150){lookId=e.pointerId;lastX=e.clientX}});
renderer.domElement.addEventListener("pointermove",e=>{
 if(e.pointerId===lookId){cameraYaw-=(e.clientX-lastX)*.008;lastX=e.clientX}
});
renderer.domElement.addEventListener("pointerup",()=>lookId=null);

let last=performance.now();

function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min((now-last)/1000,.05);
  last=now;

  const input=Math.min(1,Math.hypot(joystick.x,joystick.y));
  const speed=(running?10:5)*dt;
  moveAmount=THREE.MathUtils.lerp(moveAmount,input,Math.min(1,dt*12));

  const forward=new THREE.Vector3(Math.sin(cameraYaw),0,Math.cos(cameraYaw));
  const right=new THREE.Vector3(Math.cos(cameraYaw),0,-Math.sin(cameraYaw));

  if(input>.05){
    player.position.addScaledVector(right,joystick.x*speed);
    player.position.addScaledVector(forward,joystick.y*speed);

    const desired=Math.atan2(
      joystick.x*Math.cos(cameraYaw)+joystick.y*Math.sin(cameraYaw),
      joystick.x*-Math.sin(cameraYaw)+joystick.y*Math.cos(cameraYaw)
    )+Math.PI;
    let diff=THREE.MathUtils.euclideanModulo(
      desired-player.rotation.y+Math.PI,Math.PI*2
    )-Math.PI;
    player.rotation.y+=diff*Math.min(1,dt*10);
  }

  player.position.x=THREE.MathUtils.clamp(player.position.x,-105,105);
  player.position.z=THREE.MathUtils.clamp(player.position.z,-105,105);

  const t=clock.getElapsedTime();
  const swing=Math.sin(t*(running?11:8))*.65*moveAmount;
  const bob=Math.abs(Math.sin(t*(running?11:8)))*.045*moveAmount;

  leftLeg.rotation.x=swing;
  rightLeg.rotation.x=-swing;
  leftArm.rotation.x=-swing*.75;
  rightArm.rotation.x=swing*.75;

  torso.position.y=1.75+bob;
  neck.position.y=2.38+bob;
  head.position.y=2.85+bob;
  hair.position.y=3.02+bob;

  const target=new THREE.Vector3(
    player.position.x,player.position.y+1.65,player.position.z
  );
  const offset=new THREE.Vector3(
    -Math.sin(cameraYaw)*9,5.2,-Math.cos(cameraYaw)*9
  );
  camera.position.lerp(
    target.clone().add(offset),
    Math.min(1,dt*7)
  );
  camera.lookAt(target);

  renderer.render(scene,camera);
}
animate(performance.now());

addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

fetch("/api/player").then(r=>r.json()).then(p=>{
 document.getElementById("vida").textContent=p.vida;
 document.getElementById("dinheiro").textContent=p.dinheiro;
 document.getElementById("nivel").textContent=p.nivel;
});
