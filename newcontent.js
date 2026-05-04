(async () => {
  try {
    if (!("documentPictureInPicture" in window)) {
      console.warn("documentPictureInPicture not supported");
      return;
    }

    // 既存ウィンドウ再利用
    let pipWin = documentPictureInPicture.window;

    if (!pipWin) {
      pipWin = await documentPictureInPicture.requestWindow({
        width: 480,
        height: 270
      });
    }

    // 再生中のvideo優先
    // const videos = Array.from(document.querySelectorAll("video"));
    // if (videos.length === 0) {
    //   console.warn("No video found");
    //   return;
    // }

    // const video =
    //   videos.find(v => !v.paused && !v.ended) || videos[0];

    // // 元の位置を保持（戻すため）
    // if (!video.__placeholder) {
    //   const placeholder = document.createComment("video-placeholder");
    //   video.parentNode.insertBefore(placeholder, video);
    //   video.__placeholder = placeholder;
    // }

    const divs = Array.from(document.querySelectorAll("div"));
    if (divs.length === 0) {
        console.warn("No div found");
        return;
    }

    const targetDiv = divs.find(d => d.dataset.name === "inner") || divs[0];

    if (!targetDiv.__placeholder) {
        const placeholder = document.createComment("div-placeholder");
        targetDiv.parentNode.insertBefore(placeholder, targetDiv);
        targetDiv.__placeholder = placeholder;
    }

    const doc = pipWin.document;

    // 初期化（1回だけ）
    if (!doc.body.hasChildNodes()) {
      doc.body.innerHTML = `
        <style>
          body {
            margin: 0;
            background: black;
            display: flex;
            flex-direction: column;
            height: 100vh;
          }
          video {
            width: 100%;
            height: 100%;
            background: black;
          }
          #bar {
            height: 32px;
            background: #222;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 8px;
            font-size: 12px;
          }
          button {
            cursor: pointer;
          }
        </style>
        <div id="bar">
          <span>Doc PiP</span>
          <button id="back">戻す</button>
        </div>
      `;

      doc.getElementById("back").onclick = () => {
        restoreVideo(video);
        pipWin.close();
      };
    }

    // videoを移動
    doc.body.appendChild(targetDiv);

    // ウィンドウ閉じたら戻す
    pipWin.addEventListener("pagehide", () => {
      restoreVideo(targetDiv);
    });

  } catch (e) {
    console.error(e);
  }

  function restoreVideo(video) {
    const placeholder = video.__placeholder;
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(video, placeholder);
      placeholder.remove();
      video.__placeholder = null;
    }
  }
})();