// ============================================================
// PulseGate — Member Registration
// ============================================================
// Change this single URL to point at your deployed API Gateway.
const API_BASE = "https://kyta607as7.execute-api.ap-south-1.amazonaws.com/prod";

document.addEventListener("DOMContentLoaded", () => {
  const form         = document.getElementById("register-form");
  const nameInput    = document.getElementById("member-name");
  const expiryInput  = document.getElementById("membership-expiry");
  const submitBtn    = document.getElementById("register-btn");
  const resultEl     = document.getElementById("result");

  // -- Camera elements -----------------------------------------
  const cameraPlaceholder   = document.getElementById("camera-placeholder");
  const openCameraBtn       = document.getElementById("open-camera-btn");
  const cameraErrorNote     = document.getElementById("camera-error-note");
  const fallbackUploadBtn   = document.getElementById("fallback-upload-btn");
  const cameraPreviewWrap   = document.getElementById("camera-preview-wrap");
  const cameraVideo         = document.getElementById("camera-video");
  const captureBtn          = document.getElementById("capture-btn");
  const capturedPreviewWrap = document.getElementById("captured-preview-wrap");
  const capturedImage       = document.getElementById("captured-image");
  const retakeBtn           = document.getElementById("retake-btn");
  const cameraCanvas        = document.getElementById("camera-canvas");

  // -- Fallback (existing) file-upload elements -----------------
  const fileUploadFallback = document.getElementById("file-upload-fallback");
  const imageInput         = document.getElementById("member-image");
  const previewImg         = document.getElementById("image-preview");
  const fileNameEl         = document.getElementById("file-name");
  const useCameraBtn       = document.getElementById("use-camera-btn");

  // Holds the active getUserMedia stream so it can be stopped later.
  let mediaStream = null;

  // Holds the raw Base64 (no data-URI prefix) of the photo that will
  // actually be submitted — set either by capturePhoto() or by the
  // fallback file-upload "change" handler below.
  let capturedBase64 = null;

  // ============================================================
  // Camera: open / preview / capture / retake
  // ============================================================

  /**
   * Request camera access and start the live preview.
   * Only called after the user explicitly clicks "Open Camera".
   */
  async function startCamera() {
    cameraErrorNote.hidden = true;

    // Guard for browsers/contexts without camera support (e.g. non-HTTPS).
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraUnavailable("Camera not supported in this browser.");
      return;
    }

    try {
      // facingMode: "user" selects the front/selfie camera on mobile.
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }
      });

      cameraVideo.srcObject = mediaStream;

      // Swap the placeholder for the live preview.
      cameraPlaceholder.hidden = true;
      cameraPreviewWrap.hidden = false;
      capturedPreviewWrap.hidden = true;
    } catch (err) {
      // Permission denied, no camera present, camera in use elsewhere, etc.
      showCameraUnavailable("Camera permission denied or unavailable.");
    }
  }

  /** Stop all tracks on the active stream and detach it from the video element. */
  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    cameraVideo.srcObject = null;
  }

  /**
   * Grab the current video frame onto the hidden canvas, convert it
   * to Base64, and show it in the "captured" review state.
   */
  function capturePhoto() {
    const width  = cameraVideo.videoWidth;
    const height = cameraVideo.videoHeight;

    cameraCanvas.width  = width;
    cameraCanvas.height = height;

    const ctx = cameraCanvas.getContext("2d");
    // Draw the true (unmirrored) frame — the CSS mirror on <video> is
    // a preview-only effect and does not touch the underlying pixels.
    ctx.drawImage(cameraVideo, 0, 0, width, height);

    // Stop the camera immediately after capture, as required.
    stopCamera();

    capturedBase64 = canvasToBase64(cameraCanvas);
    capturedImage.src = `data:image/jpeg;base64,${capturedBase64}`;

    cameraPreviewWrap.hidden = true;
    capturedPreviewWrap.hidden = false;
  }

  /** Convert the canvas contents to a raw Base64 string (no data-URI prefix). */
  function canvasToBase64(canvas) {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    return dataUrl.split(",")[1];
  }

  /** Discard the captured photo and go back to a fresh live preview. */
  function retakePhoto() {
    capturedBase64 = null;
    capturedImage.src = "";
    capturedPreviewWrap.hidden = true;
    startCamera();
  }

  /** Show the "camera unavailable" note and drop into the upload flow. */
  function showCameraUnavailable(message) {
    cameraErrorNote.textContent = message;
    cameraErrorNote.hidden = false;
    useFallbackUpload();
  }

  /** Switch to the manual file-upload flow. */
  function useFallbackUpload() {
    stopCamera();
    cameraPlaceholder.hidden = true;
    cameraPreviewWrap.hidden = true;
    capturedPreviewWrap.hidden = true;
    fileUploadFallback.hidden = false;
  }

  /** Switch back from manual upload to the live camera flow. */
  function useCameraInstead() {
    fileUploadFallback.hidden = true;
    cameraErrorNote.hidden = true;
    startCamera();
  }

  openCameraBtn.addEventListener("click", startCamera);
  captureBtn.addEventListener("click", capturePhoto);
  retakeBtn.addEventListener("click", retakePhoto);
  fallbackUploadBtn.addEventListener("click", useFallbackUpload);
  useCameraBtn.addEventListener("click", useCameraInstead);

  // Make sure the camera is released if the user navigates away.
  window.addEventListener("beforeunload", stopCamera);

  // ============================================================
  // Fallback file-upload flow (unchanged behaviour, kept as-is)
  // ============================================================

  // -- Show a thumbnail + filename when the user picks an image --
  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;

    fileNameEl.textContent = file.name;
    fileNameEl.hidden = false;

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewImg.hidden = false;
    };
    reader.readAsDataURL(file);

    // The fallback file becomes the source of truth for submission.
    fileToBase64(file).then((base64) => {
      capturedBase64 = base64;
    });
  });

  // -- Handle form submission --
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name   = nameInput.value.trim();
    const expiry = expiryInput.value;

    // Basic client-side validation
    if (!name || !expiry || !capturedBase64) {
      showResult("error", "Please fill in all fields and capture or select a photo.");
      return;
    }

    setLoading(true);
    hideResult();

    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:   name,
          expiry: expiry,
          image:  capturedBase64
        })
      });

      const data = await res.json();

      if (res.ok) {
        showResult("success", data.message || "Member registered successfully.");
      } else {
        showResult("error", data.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      // Network-level failure (offline, DNS, CORS, etc.)
      showResult("error", "Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  });

  // -- Helpers ------------------------------------------------

  /** Convert a File to a raw Base64 string (no data-URI prefix). */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Strip the "data:image/…;base64," prefix
        resolve(reader.result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** Toggle between normal and loading state on the submit button. */
  function setLoading(on) {
    submitBtn.disabled = on;
    if (on) {
      submitBtn.classList.add("loading");
    } else {
      submitBtn.classList.remove("loading");
    }
  }

  /** Display a success or error banner below the form. */
  function showResult(type, message) {
    resultEl.className = `result-card ${type}`;
    resultEl.textContent = message;
    resultEl.hidden = false;
  }

  function hideResult() {
    resultEl.hidden = true;
  }
});
