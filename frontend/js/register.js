// ============================================================
// PulseGate — Member Registration
// ============================================================
// Change this single URL to point at your deployed API Gateway.
const API_BASE = "https://kyta607as7.execute-api.ap-south-1.amazonaws.com/prod";

document.addEventListener("DOMContentLoaded", () => {
  const form         = document.getElementById("register-form");
  const nameInput    = document.getElementById("member-name");
  const expiryInput  = document.getElementById("membership-expiry");
  const imageInput   = document.getElementById("member-image");
  const submitBtn    = document.getElementById("register-btn");
  const resultEl     = document.getElementById("result");
  const previewImg   = document.getElementById("image-preview");
  const fileNameEl   = document.getElementById("file-name");

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
  });

  // -- Handle form submission --
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name   = nameInput.value.trim();
    const expiry = expiryInput.value;
    const file   = imageInput.files[0];

    // Basic client-side validation
    if (!name || !expiry || !file) {
      showResult("error", "Please fill in all fields and select a photo.");
      return;
    }

    setLoading(true);
    hideResult();

    try {
      const base64 = await fileToBase64(file);

      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:   name,
          expiry: expiry,
          image:  base64
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
