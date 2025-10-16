const fabMain = document.getElementById("fab-main");
const fabStop = document.getElementById("fab-stop");

let state = "idle"; // idle | playing | paused

function emitEvent(name) {
  console.log("Event:", name);
  document.dispatchEvent(new CustomEvent(name));
}

fabMain.addEventListener("click", () => {
  if (state === "idle") {
    // ▶ 再生開始 → ボタンは ⏸（pause）に切り替わる
    fabMain.classList.remove("fab-primary");
    fabMain.classList.add("fab-secondary"); // ⏸時は primary
    fabMain.innerHTML = '<i class="bi bi-pause-fill"></i>';
    emitEvent("fab:play");
    state = "playing";
  } else if (state === "playing") {
    // ⏸ 一時停止 → ボタンは ▶ に戻る
    fabMain.classList.remove("fab-secondary");
    fabMain.classList.add("fab-primary"); // ▶時は secondary
    fabMain.innerHTML = '<i class="bi bi-play-fill"></i>';
    fabStop.classList.add("show");
    emitEvent("fab:stop");
    state = "paused";
  } else if (state === "paused") {
    // ▶ 再開 → ボタンは ⏸ に戻る
    fabMain.classList.remove("fab-primary");
    fabMain.classList.add("fab-secondary"); // ⏸時は primary
    fabMain.innerHTML = '<i class="bi bi-pause-fill"></i>';
    fabStop.classList.remove("show");
    emitEvent("fab:resume");
    state = "playing";
  }
});

fabStop.addEventListener("click", () => {
  // ■ 停止
  fabMain.classList.remove("fab-secondary");
  fabMain.classList.add("fab-primary"); // 初期状態は ▶ primary
  fabMain.innerHTML = '<i class="bi bi-play-fill"></i>';
  fabStop.classList.remove("show");
  emitEvent("fab:record");
  state = "idle";
});