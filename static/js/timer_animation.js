// ==== 時計風タイマー ====
const elapsedEl = document.getElementById("elapsedTime");
const circleEl = document.getElementById("timerCircle");

if (elapsedEl && circleEl) {
  let lastText = "";

  setInterval(() => {
    const currentText = elapsedEl.textContent.trim();
    if (currentText !== lastText) {
      lastText = currentText;

      // 分:秒 を秒数に変換
      const [m, s] = currentText.split(":").map(Number);
      const totalSeconds = (m || 0) * 60 + (s || 0);

      // 1分で1周（超えたらループ）
      const progress = (totalSeconds % 60) * (100 / 60);
      circleEl.style.setProperty("--progress", `${progress}%`);
    }
  }, 100);
}
