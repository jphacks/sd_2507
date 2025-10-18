    // ==== 表示切り替え ====
    const videoSection = document.getElementById("videoSection");
    const dataSection = document.getElementById("dataSection");
    const hideBtn = document.getElementById("hideBtn");
    const showBtn = document.getElementById("showBtn");

    hideBtn.addEventListener("click", () => {
      videoSection.classList.add("hidden-section");
      dataSection.classList.add("hidden-section");
    });

    showBtn.addEventListener("click", () => {
      videoSection.classList.remove("hidden-section");
      dataSection.classList.remove("hidden-section");
    });