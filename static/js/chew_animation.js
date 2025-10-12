// HTML要素の取得
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startResetBtn = document.getElementById('startResetBtn');

// 計測データ表示要素
const totalChewsEl = document.getElementById('totalChews');
const elapsedTimeEl = document.getElementById('elapsedTime');
const paceEl = document.getElementById('pace');

// 天気表示要素
const weatherDisplay = document.getElementById('weatherDisplay');
const weatherIcon = document.getElementById('weatherIcon');
const weatherLabel = document.getElementById('weatherLabel');
const weatherMessage = document.getElementById('weatherMessage');

// アプリケーションの状態を管理する変数
let stats = {
  chewCount: 0,
  elapsedTime: 0,
  pace: 0,
};
let isTracking = false;
let startTime = 0;
let mouthOpen = false;
let baselineRatio = null;
let latestRatio = 0;
let updateInterval = null;

// FaceMeshの初期化
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// 顔ランドマークの処理
faceMesh.onResults((results) => {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];
    const chin = landmarks[152];
    const nose = landmarks[4];
    const glabella = landmarks[9];

    const nose_chin_Distance = Math.hypot((nose.x - chin.x), (nose.y - chin.y));
    const glabella_nose_Distance = Math.hypot((glabella.x - nose.x), (glabella.y - nose.y));

    if (glabella_nose_Distance > 0) {
      latestRatio = nose_chin_Distance / glabella_nose_Distance;
    }

    if (isTracking && baselineRatio !== null) {
      const ratio = latestRatio / baselineRatio;
      const thresholdRatio = 1.05;

      if (ratio > thresholdRatio && !mouthOpen) {
        mouthOpen = true;
      } else if (ratio <= thresholdRatio && mouthOpen) {
        mouthOpen = false;
        stats.chewCount++;
      }
    }
  }
  ctx.restore();
});

// ===== ✨ ここから追加・変更した関数 =====

/**
 * 計測データを1秒ごとに更新し、画面に反映する関数
 */
function updateStats() {
  if (!isTracking) return;

  // 経過時間を計算
  const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
  stats.elapsedTime = elapsedSeconds;

  // ペース（1分あたりの咀嚼回数）を計算
  stats.pace = elapsedSeconds > 0 ? Math.round((stats.chewCount / elapsedSeconds) * 60) : 0;

  // 画面表示を更新
  totalChewsEl.textContent = stats.chewCount;
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  elapsedTimeEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
  paceEl.textContent = `${stats.pace} 回/分`;
  
  // 天気を更新
  updateWeather(stats.pace);
}

/**
 * 咀嚼ペースに応じて天気表示を変更する関数
 * @param {number} pace - 1分あたりの咀嚼回数
 */
function updateWeather(pace) {
  let weather;
  if (!isTracking) {
    weather = { type: 'waiting', icon: '☁️', label: '待機中', message: '「計測開始」を押してください' };
  } else if (pace > 70) {
    weather = { type: 'storm', icon: '⛈️', label: '嵐', message: '速すぎです！もっとゆっくり！' };
  } else if (pace >= 50) {
    weather = { type: 'rain', icon: '🌧️', label: '雨', message: '少し速いペースです' };
  } else if (pace > 0) {
    weather = { type: 'sunny', icon: '☀️', label: '晴れ', message: 'とても良いペースです！' };
  } else {
     weather = { type: 'sunny', icon: '☀️', label: '晴れ', message: '食事を始めましょう！' };
  }
  
  weatherDisplay.className = 'weather-display ' + weather.type;
  weatherIcon.textContent = weather.icon;
  weatherLabel.textContent = weather.label;
  weatherMessage.textContent = weather.message;
}

// 計測開始・リセットボタンの処理
startResetBtn.addEventListener("click", () => {
  if (!isTracking) {
    // --- 計測開始処理 ---
    if (latestRatio > 0) {
      isTracking = true;
      baselineRatio = latestRatio; // 現在の口の状態を基準にする
      stats = { chewCount: 0, elapsedTime: 0, pace: 0 }; // 統計をリセット
      startTime = Date.now();
      
      updateInterval = setInterval(updateStats, 1000); // 1秒ごとに統計を更新
      
      startResetBtn.textContent = "リセット";
      startResetBtn.style.backgroundColor = "#dc3545";
    } else {
      alert("顔が検出されていません。カメラに顔を映してください。");
    }
  } else {
    // --- リセット処理 ---
    isTracking = false;
    clearInterval(updateInterval); // タイマーを停止
    
    // 全ての値を初期状態に戻す
    stats = { chewCount: 0, elapsedTime: 0, pace: 0 };
    baselineRatio = null;
    updateStats(); // 表示をリセット
    updateWeather(0); // 天気もリセット
    
    startResetBtn.textContent = "計測開始";
    startResetBtn.style.backgroundColor = "#007bff";
  }
});

// カメラの起動
const camera = new Camera(video, {
  onFrame: async () => {
    await faceMesh.send({ image: video });
  },
  width: 640,
  height: 480
});
camera.start();