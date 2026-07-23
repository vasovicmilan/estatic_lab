(function () {
  const packageSelect = document.getElementById("packageId");
  const couponInput = document.getElementById("couponCode");
  if (!packageSelect || !couponInput) return; // not the package-purchase creation form

  const panel = document.querySelector('[data-select-preview-panel="packageId"]');
  if (!panel) return;

  const userSelect = document.getElementById("userId");

  // the only trigger before was blurring the coupon field - invisible, easy to
  // miss entirely. An explicit button next to the field makes the interaction
  // unmissable, matching the "Primeni" pattern used elsewhere in the app.
  const checkBtn = document.createElement("button");
  checkBtn.type = "button";
  checkBtn.className = "btn btn-outline-secondary btn-sm mt-2";
  checkBtn.textContent = "Proveri kupon";
  couponInput.insertAdjacentElement("afterend", checkBtn);

  function clearCouponNote() {
    const existing = panel.querySelector("[data-coupon-preview]");
    if (existing) existing.remove();
  }

  function showCouponNote(className, text) {
    clearCouponNote();
    const note = document.createElement("div");
    note.className = `mt-2 small ${className}`;
    note.setAttribute("data-coupon-preview", "");
    note.textContent = text;
    panel.appendChild(note);
  }

  async function checkCoupon() {
    const code = couponInput.value.trim();

    if (!packageSelect.value) {
      showCouponNote("text-danger", "Prvo izaberite paket.");
      return;
    }
    if (!code) {
      showCouponNote("text-danger", "Unesite kod kupona.");
      return;
    }

    showCouponNote("text-muted", "Provera kupona...");

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
      const res = await fetch("/admin/kupljeni-paketi/proveri-kupon", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ code, packageId: packageSelect.value, userId: userSelect?.value || null }),
      });
      const data = await res.json();

      if (data.success) {
        showCouponNote("text-success", `Kupon važi - popust ${data.discountAmount} RSD. Cena sa kuponom: ${data.finalPrice} RSD.`);
      } else {
        showCouponNote("text-danger", data.message || "Kupon nije važeći.");
      }
    } catch {
      showCouponNote("text-danger", "Greška pri proveri kupona - pokušajte ponovo.");
    }
  }

  checkBtn.addEventListener("click", checkCoupon);
  couponInput.addEventListener("input", clearCouponNote);
  packageSelect.addEventListener("change", clearCouponNote);
})();