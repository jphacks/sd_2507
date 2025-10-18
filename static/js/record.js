document.addEventListener("fab:record", async () => {
  // let stats = { chewCount: 10, elapsedTime: 5, pace: 2 }
  console.log("記録ボタンが押されました。/result に遷移します:", stats);
  // 一時保存
  try {
    console.log("stats:", stats);
    localStorage.setItem("latestStats", JSON.stringify(stats));
  } catch (e) {
    console.error("failed to save stats", e);
  }
  // 結果画面へ
  window.location.href = "/result";
});