// 再生・停止トグルボタン
document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('fab-toggle');
  const icon = toggleBtn.querySelector('i');
  let isPlaying = false;

  toggleBtn.addEventListener('click', () => {
    if (!isPlaying) {
      // ▶️ 再生 → 停止に変更
      isPlaying = true;
      toggleBtn.classList.add('stop');
      icon.classList.replace('bi-play-fill', 'bi-stop-fill');
      toggleBtn.title = '停止';

      // JSイベント発火（再生）
      document.dispatchEvent(new CustomEvent('fab:play'));
    } else {
      // ⏹ 停止 → 再生に変更
      isPlaying = false;
      toggleBtn.classList.remove('stop');
      icon.classList.replace('bi-stop-fill', 'bi-play-fill');
      toggleBtn.title = '再生';

      // JSイベント発火（停止）
      document.dispatchEvent(new CustomEvent('fab:stop'));
    }
  });
});