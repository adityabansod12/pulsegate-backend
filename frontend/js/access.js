// ============================================================
// PulseGate — Gym Access Verification
// ============================================================
// Change this single URL to point at your deployed API Gateway.
const API_BASE = "https://kyta607as7.execute-api.ap-south-1.amazonaws.com/prod";

document.addEventListener("DOMContentLoaded", () => {
  const imageInput  = document.getElementById("access-image");
  const uploadArea  = document.getElementById("upload-area");
  const statusCard  = document.getElementById("status-card");
  const statusIcon  = document.getElementById("status-icon");
  const statusTitle = document.getElementById("status-title");
  const statusMsg   = document.getElementById("status-message");
  const scanAgain   = document.getElementById("scan-again");

  // -- The moment a file is selected, verify immediately --
  imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];
    if (!file) return;

    // Swap the upload zone for a "Verifying" card
    uploadArea.classList.add("hidden");
    showStatus("verifying", "Verifying\u2026", "Scanning biometric data");

    try {
      const base64 = await fileToBase64(file);

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

    // Reset so the same file can be re-selected if needed
    imageInput.value = "";
  });

  // -- "Scan another" resets the view --
  scanAgain.addEventListener("click", () => {
    statusCard.hidden = true;
    uploadArea.classList.remove("hidden");
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
