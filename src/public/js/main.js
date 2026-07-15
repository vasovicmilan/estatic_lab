document.addEventListener("DOMContentLoaded", () => {
  const modalEl = document.getElementById("confirmActionModal");
  if (!modalEl || typeof bootstrap === "undefined") return;

  const modal = new bootstrap.Modal(modalEl);
  const messageEl = document.getElementById("confirmActionMessage");
  const confirmBtn = document.getElementById("confirmActionButton");
  let pendingForm = null;

  // Intercepts submission of ANY form with data-confirm="..." anywhere on the page —
  // shows the shared modal with that message instead of submitting immediately.
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const message = form.dataset.confirm;
    if (!message) return;
    if (form.dataset.confirmed === "true") return; // already confirmed once — let it through

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

  // if the modal is dismissed (Cancel, backdrop click, Esc) without confirming,
  // just drop the pending form — nothing submits
  modalEl.addEventListener("hidden.bs.modal", () => {
    pendingForm = null;
  });
});