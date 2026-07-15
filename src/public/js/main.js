document.addEventListener("DOMContentLoaded", () => {
  // multi-phase form progress bar (see admin/_form.ejs) — the width has to be
  // applied via JS because Bootstrap's .progress-bar has no width without it
  document.querySelectorAll("[data-progress-bar]").forEach((bar) => {
    const wrapper = bar.closest("[data-progress]");
    if (!wrapper) return;
    const percent = parseFloat(wrapper.dataset.progress);
    if (!isNaN(percent)) bar.style.width = `${percent}%`;
  });

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