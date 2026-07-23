(function () {
  const packageSelect = document.getElementById("packageId");
  const couponInput = document.getElementById("couponCode");
  if (!packageSelect || !couponInput) return; // not the package-purchase creation form

  const panel = document.querySelector('[data-select-preview-panel="packageId"]');
  if (!panel) return;

  const userSelect = document.getElementById("userId");

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
    if (!code || !packageSelect.value) {
      clearCouponNote();
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

  // re-check whenever the code or the selected package changes - either one
  // affects whether/how much the coupon actually applies
  couponInput.addEventListener("blur", checkCoupon);
  packageSelect.addEventListener("change", () => {
    clearCouponNote();
    if (couponInput.value.trim()) checkCoupon();
  });
})();