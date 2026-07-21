document.addEventListener("DOMContentLoaded", () => {
  // cookie consent banner (see includes/components/cookie-consent.ejs) - shown
  // once until the visitor makes a choice, stored client-side since it's purely
  // a UI preference with no server-side logic depending on it today. Exposed as
  // window.hasNonEssentialCookieConsent() for any future tracking script to
  // check before loading itself.
  (function initCookieConsent() {
    const CONSENT_COOKIE_NAME = "cookieConsent";
    const CONSENT_COOKIE_MAX_AGE_DAYS = 365;

    function getCookie(name) {
      const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
      return match ? decodeURIComponent(match[1]) : null;
    }

    function setCookie(name, value, days) {
      const maxAge = days * 24 * 60 * 60;
      document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }

    window.hasNonEssentialCookieConsent = () => getCookie(CONSENT_COOKIE_NAME) === "accepted";

    const banner = document.querySelector("[data-cookie-consent-banner]");
    if (!banner) return;

    if (getCookie(CONSENT_COOKIE_NAME)) return; // already chosen, stay hidden
    banner.classList.remove("d-none");

    banner.querySelector("[data-cookie-consent-accept]")?.addEventListener("click", () => {
      setCookie(CONSENT_COOKIE_NAME, "accepted", CONSENT_COOKIE_MAX_AGE_DAYS);
      banner.classList.add("d-none");
    });

    banner.querySelector("[data-cookie-consent-decline]")?.addEventListener("click", () => {
      setCookie(CONSENT_COOKIE_NAME, "declined", CONSENT_COOKIE_MAX_AGE_DAYS);
      banner.classList.add("d-none");
    });
  })();

  // copy-to-clipboard for referral links (see views/partner/dashboard.ejs and
  // views/partner/catalog.ejs) - one handler covers every copy button on either
  // page, scoped via the input sitting in the same .input-group
  document.querySelectorAll("[data-copy-link-btn]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const input = btn.closest(".input-group")?.querySelector("[data-referral-link-input]");
      if (!input) return;

      const original = btn.textContent;
      const showFeedback = (text, revertMs = 1500) => {
        btn.textContent = text;
        setTimeout(() => { btn.textContent = original; }, revertMs);
      };

      // navigator.clipboard requires a secure context (HTTPS or localhost) - it's
      // undefined (or writeText throws) over plain HTTP on a non-localhost host,
      // which silently did nothing before instead of falling back or showing an
      // error, making the button look completely broken with zero feedback
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(input.value);
          showFeedback("Kopirano!");
          return;
        } catch {
          // fall through to the legacy approach below
        }
      }

      try {
        input.removeAttribute("readonly");
        input.select();
        input.setSelectionRange(0, input.value.length);
        const copied = document.execCommand("copy");
        input.setAttribute("readonly", "");
        if (copied) {
          showFeedback("Kopirano!");
        } else {
          throw new Error("execCommand copy failed");
        }
      } catch {
        // both approaches failed - the link is still selected in the input, so
        // the user can copy it manually with Ctrl+C instead of nothing happening
        showFeedback("Označeno - kopirajte sa Ctrl+C", 3000);
      }
    });
  });

  // coupon apply/remove widget (see includes/components/coupon-field.ejs) - one
  // generic handler covers both the booking contact step and checkout, since the
  // actual validation differs server-side but the UI interaction is identical
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

  document.querySelectorAll("[data-coupon-widget]").forEach((widget) => {
    const context = widget.dataset.couponContext;
    const input = widget.querySelector("[data-coupon-input]");
    const applyBtn = widget.querySelector("[data-coupon-apply-btn]");
    const removeBtn = widget.querySelector("[data-coupon-remove-btn]");
    const inputGroup = widget.querySelector("[data-coupon-input-group]");
    const appliedBadge = widget.querySelector("[data-coupon-applied-badge]");
    const appliedCode = widget.querySelector("[data-coupon-applied-code]");
    const appliedDiscount = widget.querySelector("[data-coupon-applied-discount]");
    const errorEl = widget.querySelector("[data-coupon-error]");
    if (!input || !applyBtn) return;

    function showApplied(code, discountAmount) {
      appliedCode.textContent = code;
      appliedDiscount.textContent = discountAmount;
      appliedBadge.classList.remove("d-none");
      inputGroup.classList.add("d-none");
      errorEl.classList.add("d-none");
    }

    function showRemoved() {
      appliedBadge.classList.add("d-none");
      inputGroup.classList.remove("d-none");
      input.value = "";
    }

    function showError(message) {
      errorEl.textContent = message || "Kupon nije važeći.";
      errorEl.classList.remove("d-none");
    }

    applyBtn.addEventListener("click", async () => {
      const code = input.value.trim();
      if (!code) return;

      const payload = { code, context };
      if (context === "booking") {
        payload.serviceId = widget.dataset.couponServiceId;
        payload.appointmentValue = widget.dataset.couponAppointmentValue;
      } else {
        payload.productIds = (widget.dataset.couponProductIds || "").split(",").filter(Boolean);
        payload.orderValue = widget.dataset.couponOrderValue;
      }

      applyBtn.disabled = true;
      try {
        const res = await fetch("/kupon/primeni", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success) {
          showApplied(json.code, json.discountAmount);
        } else {
          showError(json.message);
        }
      } catch {
        showError("Greška - pokušajte ponovo.");
      } finally {
        applyBtn.disabled = false;
      }
    });

    removeBtn?.addEventListener("click", async () => {
      removeBtn.disabled = true;
      try {
        await fetch("/kupon/ukloni", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken } });
      } catch {
        // removing is best-effort client-side regardless - the widget resets either way
      } finally {
        showRemoved();
        removeBtn.disabled = false;
      }
    });
  });

  // homepage hero background image (see landing/home.ejs) - applied via JS rather
  // than an inline style="" attribute so this never depends on style-src allowing
  // 'unsafe-inline' (setting a CSS custom property through the DOM API isn't
  // restricted by CSP the way an inline style attribute would be)
  document.querySelectorAll("[data-hero-image]").forEach((el) => {
    el.style.setProperty("--hero-image", `url('${el.dataset.heroImage}')`);
  });

  // multi-phase form progress bar (see admin/_form.ejs) - the width has to be
  // applied via JS because Bootstrap's .progress-bar has no width without it
  document.querySelectorAll("[data-progress-bar]").forEach((bar) => {
    const wrapper = bar.closest("[data-progress]");
    if (!wrapper) return;
    const percent = parseFloat(wrapper.dataset.progress);
    if (!isNaN(percent)) bar.style.width = `${percent}%`;
  });

  // image lightbox - click any .img-clickable[data-full-src] to view it full-size
  // in the shared #imageLightboxModal (see includes/footer.ejs)
  if (typeof bootstrap !== "undefined") {
    const lightboxEl = document.getElementById("imageLightboxModal");
    if (lightboxEl) {
      lightboxEl.addEventListener("show.bs.modal", (event) => {
        const trigger = event.relatedTarget;
        if (!trigger) return;
        const img = document.getElementById("imageLightboxImg");
        img.src = trigger.dataset.fullSrc || trigger.src || "";
        img.alt = trigger.dataset.fullAlt || trigger.alt || "";
      });
    }
  }

  const modalEl = document.getElementById("confirmActionModal");
  if (!modalEl || typeof bootstrap === "undefined") return;

  const modal = new bootstrap.Modal(modalEl);
  const messageEl = document.getElementById("confirmActionMessage");
  const confirmBtn = document.getElementById("confirmActionButton");
  let pendingForm = null;

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const message = form.dataset.confirm;
    if (!message) return;
    if (form.dataset.confirmed === "true") return;

    event.preventDefault();
    pendingForm = form;
    messageEl.textContent = message;
    modal.show();
  });

  confirmBtn.addEventListener("click", () => {
    modal.hide();
    if (!pendingForm) return;

    pendingForm.dataset.confirmed = "true";
    if (typeof pendingForm.requestSubmit === "function") {
      pendingForm.requestSubmit();
    } else {
      pendingForm.submit();
    }
    pendingForm = null;
  });

  modalEl.addEventListener("hidden.bs.modal", () => {
    pendingForm = null;
  });
});