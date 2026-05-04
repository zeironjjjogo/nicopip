function getCommentCanvas()
{
  const canvases = Array.from(document.querySelectorAll("canvas"));
  if (canvases.length === 0)
  {
    console.warn("Not found canvases.");
    return null;
  }

  const canvas = canvases.find(c => c.parentElement.dataset.name === "comment");
  if (!canvas)
  {
    console.warn("Not found comment canvas.");
    return null;
  }

  if (!canvas.__placeholder)
  {
    const placeholder = document.createComment("comment-canvas-placeholder");
    canvas.parentNode.insertBefore(placeholder, canvas);
    canvas.__placeholder = placeholder;
  }

  return canvas;
}

function resizeWin(video, canvas, container)
{
  const vw = video.videoWidth;
  const vh = Math.max(video.videoHeight, canvas ? canvas.height : 0);
  const cw = container.clientWidth;
  const ch = container.clientHeight;

  const vRatio = vw / vh;
  const cRatio = cw / ch;

  if (cRatio > vRatio)
  {
    video.style.width = "auto";
    video.style.height = "100%"
  }
  else
  {
    video.style.width = "100%";
    video.style.height = "auto";
  }
}

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

    if (Array.from(pipWin.document.body.querySelectorAll("video")).length !== 0)
    {
      console.log("Already launched PiP.");
      return;
    }

    // 再生中のvideo優先
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) {
      console.warn("No video found");
      return;
    }

    const video =
      videos.find(v => v.dataset.name === "video-content") || videos[0];

    // 元の位置を保持（戻すため）
    if (!video.__placeholder) {
      const placeholder = document.createComment("video-placeholder");
      video.parentNode.insertBefore(placeholder, video);
      video.__placeholder = placeholder;
    }

    const canvas = getCommentCanvas();

    const doc = pipWin.document;

    if (!doc.body.hasChildNodes())
    {
      doc.body.innerHTML = `
      <style>
        html, body {
          margin: 0;
          width: 100%;
          height: 100%;
          background: black;
        }
        video {
         position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
          z-index: 1;
        }
        canvas {
         position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
          z-index: 2;
        }
      </style>
      `
    }

    if (canvas) {
      doc.body.appendChild(canvas);
      // frame.appendChild(canvas);
      console.log("moved canvas");
    }

    // videoを移動
    doc.body.appendChild(video);
    // frame.appendChild(video);

    console.log("video:  " + video.videoWidth + "x" + video.videoHeight);
    console.log("canvas: " + canvas.width + "x" + canvas.height);

    // ウィンドウ閉じたら戻す
    pipWin.addEventListener("pagehide", () => {
      restoreVideo(video);
      if (canvas) restoreCanvas(canvas);
    });

    pipWin.addEventListener("resize", () => {
      console.log("resized;");
      // resizeWin(video, canvas, doc.body);
      // resizeWin(video, canvas, frame);
    })

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

  function restoreCanvas(canvas) {
    const placeholder = canvas.__placeholder;
    console.log("canvas restoring: ", canvas);
    if (placeholder && placeholder.parentNode) {
      console.log("placeholder: ", canvas.__placeholder);
      placeholder.parentNode.insertBefore(canvas, placeholder);
      placeholder.remove();
      canvas.__placeholder = null;
    }
  }
})();