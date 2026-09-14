/* Site behavior stays independent of the Expo app and deployment configuration. */
(() => {
  document.querySelector("#year").textContent = String(
    new Date().getFullYear(),
  );

  const scenes = {
    home: {
      image: "./assets/01-home.webp",
      alt: "首页实际界面：最近活动、单推提醒和未来演出",
      caption: "首页 · 下一场演出，一眼就找到",
    },
    cheki: {
      image: "./assets/02-cheki.webp",
      alt: "电子切册实际界面：按照片浏览拍立得记录",
      caption: "电子切册 · 每一张，都有自己的故事",
    },
    stats: {
      image: "./assets/06-stats.webp",
      alt: "统计实际界面：活动次数、趋势、常去城市与场地",
      caption: "统计 · 回看属于你的这一年",
    },
  };
  const stage = document.querySelector("#scene-preview");
  const sceneImage = document.querySelector("#scene-image");
  const sceneLink = document.querySelector("#scene-link");
  const sceneCaption = document.querySelector("#scene-caption");
  const choices = document.querySelectorAll("[data-scene]");
  choices.forEach((choice) => {
    choice.addEventListener("click", () => {
      const key = choice.dataset.scene;
      const scene = scenes[key];
      if (!scene) return;
      choices.forEach((item) =>
        item.setAttribute("aria-pressed", String(item === choice)),
      );
      sceneImage.src = scene.image;
      sceneImage.alt = scene.alt;
      sceneLink.href = scene.image;
      sceneLink.setAttribute("aria-label", `在新标签页放大查看${scene.alt}`);
      sceneCaption.textContent = scene.caption;
      stage.dataset.scene = key;
    });
  });

  // Treat download links as data, and keep an explicit unavailable state if absent/invalid.
  const configureDownload = (selector, configured) => {
    if (typeof configured !== "string" || !configured.trim()) return false;
    const url = new URL(configured);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) return false;
    document.querySelectorAll(selector).forEach((link) => {
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.removeAttribute("aria-disabled");
    });
    return true;
  };

  try {
    const githubReady = configureDownload("[data-android-github]", window.OTA_LOG_GITHUB_RELEASES_URL);
    const quarkReady = configureDownload("[data-android-quark]", window.OTA_LOG_QUARK_URL);
    if (githubReady || quarkReady) {
      document.querySelector("#android-status").textContent =
        "安装时，Android 可能会提示允许浏览器安装未知来源应用。";
    }
  } catch {
    // The static fallback remains usable; other website controls are unaffected.
  }
})();
