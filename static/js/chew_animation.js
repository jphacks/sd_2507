// ======== HTML要素取得 ========
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startResetBtn = document.getElementById('startResetBtn');

// 統計表示
const totalChewsEl = document.getElementById('totalChews');
const elapsedTimeEl = document.getElementById('elapsedTime');
const paceEl = document.getElementById('pace');

// 天気表示
const weatherDisplay = document.getElementById('weatherDisplay');
const weatherIcon = document.getElementById('weatherIcon');
const weatherLabel = document.getElementById('weatherLabel');
const weatherMessage = document.getElementById('weatherMessage');

// ======== 状態変数 ========
let isTracking = false;
let startTime = 0;
let updateInterval = null;

let stats = { chewCount: 0, elapsedTime: 0, pace: 0 };

// 咀嚼検出用
let baseline = null;
let lastState = "closed";
let ratioHistory = [];
let lastChewTime = 0;
const SMOOTH_WINDOW = 5;
const OPEN_THRESHOLD = 1.09;
const CLOSE_THRESHOLD = 1.04;
const chewCooldown = 200; // ms

// ======== FaceMesh初期化 ========
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});
faceMesh.setOptions({
  maxNumFaces: 1,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6,
});

let lastLandmarks = null;

// ======== FaceMesh処理（統合版） ========
faceMesh.onResults((results) => {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];
    lastLandmarks = landmarks;
    const ratio = computeNormalizedRatio(landmarks);

    if (baseline !== null) {
      const diff = ratio / baseline;
      ratioHistory.push(diff);
      if (ratioHistory.length > SMOOTH_WINDOW) ratioHistory.shift();

      // 移動平均でスムージング
      const smoothRatio = ratioHistory.reduce((a, b) => a + b, 0) / ratioHistory.length;

      const now = Date.now();
      if (smoothRatio > OPEN_THRESHOLD && lastState === "closed") {
        lastState = "open";
      }
      else if (smoothRatio < CLOSE_THRESHOLD && lastState === "open") {
        if (now - lastChewTime > chewCooldown) {
          stats.chewCount++;
          lastChewTime = now;
        }
        lastState = "closed";
      }
    }

  } 

  ctx.restore();
});


// ======== 統計更新 ========
function updateStats() {
  if (!isTracking) return;

  const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
  stats.elapsedTime = elapsedSeconds;
  stats.pace = elapsedSeconds > 0 ? Math.round((stats.chewCount / elapsedSeconds) * 60) : 0;

  totalChewsEl.textContent = stats.chewCount;
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  elapsedTimeEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
  paceEl.textContent = `${stats.pace} 回/分`;

  updateWeather(stats.pace);
}

// ======== 天気更新 ========
function updateWeather(pace) {
  let weather;
  if (!isTracking) {
    weather = { icon: '☁️', label: '待機中', message: '「計測開始」を押してください', type: 'waiting' };
  } else if (pace > 70) {
    weather = { icon: '⛈️', label: '嵐', message: '速すぎです！もっとゆっくり！', type: 'storm' };
  } else if (pace >= 50) {
    weather = { icon: '🌧️', label: '雨', message: '少し速いペースです', type: 'rain' };
  } else if (pace > 0) {
    weather = { icon: '☀️', label: '晴れ', message: 'とても良いペースです！', type: 'sunny' };
  } else {
    weather = { icon: '☀️', label: '晴れ', message: '食事を始めましょう！', type: 'sunny' };
  }

  weatherDisplay.className = 'weather-display ' + weather.type;
  weatherIcon.textContent = weather.icon;
  weatherLabel.textContent = weather.label;
  weatherMessage.textContent = weather.message;
}

// ======== 計測開始・リセット ========
startResetBtn.addEventListener("click", () => {
  if (!isTracking) {
    // --- 計測開始 ---
    if (lastLandmarks) {
      baseline = computeNormalizedRatio(lastLandmarks);
      ratioHistory = [];
      stats = { chewCount: 0, elapsedTime: 0, pace: 0 };
      startTime = Date.now();
      isTracking = true;
      updateInterval = setInterval(updateStats, 1000);

      startResetBtn.textContent = "リセット";
      startResetBtn.style.backgroundColor = "#dc3545";
    } else {
      alert("顔が検出されていません。カメラに顔を映してください。");
    }
  } else {
    // --- リセット ---
    isTracking = false;
    clearInterval(updateInterval);
    baseline = null;
    stats = { chewCount: 0, elapsedTime: 0, pace: 0 };
    updateStats();
    updateWeather(0);

    startResetBtn.textContent = "計測開始";
    startResetBtn.style.backgroundColor = "#007bff";
  }
});

// ======== カメラ起動 ========
const camera = new Camera(video, {
  onFrame: async () => await faceMesh.send({ image: video }),
  width: 640,
  height: 480,
});
camera.start();

// ======== 距離・比率関数 ========
function computeNormalizedRatio(landmarks) {
  const topLip = landmarks[13];
  const bottomLip = landmarks[14];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const chin = landmarks[152];
  const nose = landmarks[1];

  const mouthOpen = distance(topLip, bottomLip);
  const faceWidth = distance(leftCheek, rightCheek);
  const faceHeight = distance(nose, chin);

  return mouthOpen / ((faceWidth + faceHeight) / 2);
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
