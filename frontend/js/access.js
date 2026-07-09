// ============================================================
// PulseGate — Gym Access Verification
// ============================================================
// Change this single URL to point at your deployed API Gateway.
const API_BASE = "https://kyta607as7.execute-api.ap-south-1.amazonaws.com/prod";

document.addEventListener("DOMContentLoaded", () => {
  const uploadArea  = document.getElementById("upload-area");
  const statusCard  = document.getElementById("status-card");
  const statusIcon  = document.getElementById("status-icon");
  const statusTitle = document.getElementById("status-title");
  const statusMsg   = document.getElementById("status-message");
  const scanAgain   = document.getElementById("scan-again");

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
  const verifyBtn           = document.getElementById("verify-btn");
  const cameraCanvas        = document.getElementById("camera-canvas");

  // -- Fallback (existing) file-upload elements -----------------
  const fileUploadFallback = document.getElementById("file-upload-fallback");
  const imageInput         = document.getElementById("access-image");
  const useCameraBtn       = document.getElementById("use-camera-btn");

  // Holds the active getUserMedia stream so it can be stopped later.
  let mediaStream = null;

  // Holds the raw Base64 (no data-URI prefix) of the last captured frame.
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

  // "Verify" sends the already-captured frame to the existing endpoint.
  verifyBtn.addEventListener("click", () => {
    if (!capturedBase64) return;
    verifyImage(capturedBase64);
  });

  // Make sure the camera is released if the user navigates away.
  window.addEventListener("beforeunload", stopCamera);

  // ============================================================
  // Fallback file-upload flow (unchanged behaviour, kept as-is)
  // ============================================================

  // -- The moment a fallback file is selected, verify immediately --
  imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];
    if (!file) return;

    const base64 = await fileToBase64(file);
    verifyImage(base64);

    // Reset so the same file can be re-selected if needed
    imageInput.value = "";
  });

  // ============================================================
  // Shared verification call (used by both camera and fallback)
  // ============================================================

  /** POST the given Base64 image to /gym-access and render the result. */
  async function verifyImage(base64) {
    // Swap whichever input UI is showing for a "Verifying" card
    uploadArea.classList.add("hidden");
    showStatus("verifying", "Verifying\u2026", "Scanning biometric data");

    try {
      const res  = await fetch(`${API_BASE}/gym-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 })
      });

      const data = await res.json();

      if (data.message === "Access Granted") {
        showStatus("granted", "Access Granted", `Welcome, ${data.name}`);
      } else if (data.message === "Membership Expired") {
        showStatus("denied", "Membership Expired", "Please renew your membership to continue.");
      } else {
        // Covers "Face not recognized" and any unexpected message
        showStatus("denied", "Face Not Recognized", "No matching member found. Please register first.");
      }
    } catch (err) {
      showStatus("denied", "Connection Error", "Unable to reach the server. Please try again.");
    }
  }

  // -- "Scan another" resets the view --
  scanAgain.addEventListener("click", () => {
    statusCard.hidden = true;
    uploadArea.classList.remove("hidden");

    // Reset the camera section back to its idle state so the next
    // scan starts fresh (camera was already stopped after capture).
    capturedBase64 = null;
    capturedImage.src = "";
    capturedPreviewWrap.hidden = true;
    cameraPreviewWrap.hidden = true;
    fileUploadFallback.hidden = true;
    cameraPlaceholder.hidden = false;
  });

  // -- Helpers ------------------------------------------------

  /** Convert a File to a raw Base64 string (no data-URI prefix). */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Render the status card with the appropriate type, heading, and body.
   * Type must be "verifying", "granted", or "denied".
   */
  function showStatus(type, title, message) {
    statusCard.className = `status-card ${type}`;
    statusCard.hidden = false;
    statusTitle.textContent = title;
    statusMsg.textContent   = message;

    // Swap the icon SVG based on the state
    statusIcon.innerHTML = iconForType(type);
  }

  /** Return an inline SVG string matching the given status type. */
  function iconForType(type) {
    if (type === "verifying") {
      // Animated pulse line — reuses the signature waveform
      return `<svg class="pulse-line pulse-line--active" viewBox="0 0 120 50" fill="none">
        <polyline points="0,25 25,25 38,25 46,6 54,44 62,4 70,42 78,22 90,25 120,25"
          fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
    if (type === "granted") {
      // Checkmark circle
      return `<svg viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2.5"/>
        <polyline points="15,24 22,31 33,18" fill="none" stroke="currentColor"
          stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
    // denied — X circle
    return `<svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2.5"/>
      <line x1="17" y1="17" x2="31" y2="31" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round"/>
      <line x1="31" y1="17" x2="17" y2="31" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;
  }
});
