import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";

const video = document.getElementById("cam");
const canvas = document.getElementById("gl");
const bubble = document.getElementById("bubble");
const input = document.getElementById("q");
const sendBtn = document.getElementById("send");

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== Three.js =====
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 50);
camera.position.set(0, 0, 1.5);

// light
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.25));
const dir = new THREE.DirectionalLight(0xffffff, 0.85);
dir.position.set(1.2, 1.8, 1.0);
scene.add(dir);

let cat = null;
let catAnchor = new THREE.Vector3(0, -0.35, -1.2); // 初期位置（カメラ前方）
let t0 = performance.now();

// 猫ロード
const loader = new GLTFLoader();
loader.load("./models/cat2.glb", (gltf) => {
  cat = gltf.scene;
  cat.position.copy(catAnchor);
  cat.scale.setScalar(0.6);
  scene.add(cat);

  // ちょい材質調整（真っ黒回避）
  cat.traverse((o) => {
    if (o.isMesh && o.material) {
      o.material.metalness = Math.min(0.2, o.material.metalness ?? 0.2);
      o.material.roughness = Math.max(0.6, o.material.roughness ?? 0.6);
    }
  });
}, undefined, (err) => {
  console.error(err);
  alert("cat2.glb の読み込みに失敗。パスとファイル名を確認してね。");
});

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// 3D→2D投影して吹き出し追従
function updateBubblePosition() {
  if (!cat || bubble.classList.contains("hidden")) return;

  const p = cat.position.clone();
  p.y += 0.45; // 猫の頭上
  p.project(camera);

  // 画面外なら隠す
  if (p.z < -1 || p.z > 1) { bubble.classList.add("hidden"); return; }

  const x = (p.x * 0.5 + 0.5) * innerWidth;
  const y = (-p.y * 0.5 + 0.5) * innerHeight;

  bubble.style.left = `${x}px`;
  bubble.style.top = `${y}px`;
}

function setBubble(text) {
  bubble.textContent = text;
  bubble.classList.remove("hidden");
  updateBubblePosition();
}

// タップで猫を左右にちょい移動（ARっぽい“置ける感”）
window.addEventListener("pointerdown", (e) => {
  if (!cat) return;
  const nx = (e.clientX / innerWidth) * 2 - 1;
  catAnchor.x = THREE.MathUtils.clamp(nx * 0.35, -0.35, 0.35);
});

// 猫の疑似アニメ（Blender不要）
function animateCat(time) {
  if (!cat) return;
  const t = (time - t0) / 1000;

  // idle: ふわふわ + わずかに揺れる
  cat.position.x = catAnchor.x;
  cat.position.y = catAnchor.y + Math.sin(t * 2.2) * 0.02;
  cat.position.z = catAnchor.z;

  cat.rotation.y = Math.sin(t * 0.7) * 0.18;
  cat.rotation.x = Math.sin(t * 1.1) * 0.04;
}

// 返答中のうなずき演出
async function nodOnce() {
  if (!cat) return;
  const base = cat.rotation.x;
  const dur = 260;
  const start = performance.now();
  while (performance.now() - start < dur) {
    const u = (performance.now() - start) / dur;
    cat.rotation.x = base + Math.sin(u * Math.PI) * 0.22;
    await sleep(16);
  }
  cat.rotation.x = base;
}

// ====== Chat（Phase1: ダミー） ======
function dummyAnswer(q) {
  const s = q.toLowerCase();

  if (s.includes("colab") || s.includes("gpu") || s.includes("t4")) {
    return "ColabはGPUが使えて便利だけど、VRAM制約と実行時間制限が先に来がち。まずは小さく動く最小構成→計測→削る、が安定だよ。";
  }
  if (s.includes("kaggle")) {
    return "Kaggleは『再現性のある環境＋公開ノート』が強み。まずはE2Eで1回提出できる形にして、あとから特徴量を足すのが勝ち筋。";
  }
  if (s.includes("ar") || s.includes("blender")) {
    return "ARは“置けた感”が出ると一気に楽しい。BlenderはIdle1本だけ付けるのが最短。まず疑似ARで体験を作って、後で本物ARに寄せよう。";
  }
  return "なるほど。要点を1つに絞ると『まず動く形を作ってから賢くする』のが一番速いよ。もう一段具体化する？";
}

async function onSend() {
  const q = input.value.trim();
  if (!q) return;

  input.value = "";
  setBubble("…考え中");
  await nodOnce();
  await sleep(350);

  // Phase1: ダミー応答
  const a = dummyAnswer(q);
  setBubble(a);
  await nodOnce();
}

sendBtn.addEventListener("click", onSend);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onSend();
});

// render loop
function loop(time) {
  requestAnimationFrame(loop);
  animateCat(time);
  updateBubblePosition();
  renderer.render(scene, camera);
}

(async function boot() {
  await startCamera();
  loop(performance.now());
  setBubble("やあ。質問してみて（例：ARで吹き出しってどうする？）");
})();
