// Lets the admin add gallery images one at a time, each paired with its own
// alt-text description, instead of one <input multiple> + a single shared
// description applied to every file in the batch. Mirrors admin-repeater.js's
// IIFE + data-attribute convention, but can't reuse that component directly -
// it JSON-serializes row values into a hidden input, which works for text/
// number/select rows but not for real File objects (a file input's .value is
// just a fake path string, the actual blob lives in input.files).
//
// Submission shape: every row's file input keeps the same name="gallery" (so
// multer's upload.fields([{ name: "gallery", maxCount: 10 }]) collects them
// into req.uploadedFiles.gallery in DOM order, same as the old <input
// multiple>), and every row's description input uses name="newGalleryDesc[]"
// so the descriptions arrive as a parallel array - see buildGalleryPayload in
// media-form.util.js, which zips the two arrays back together by index.
(function () {
  function buildRow() {
    const row = document.createElement("div");
    row.className = "row g-2 align-items-end mb-2";
    row.dataset.galleryRow = "";

    const fileCol = document.createElement("div");
    fileCol.className = "col-6";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.name = "gallery";
    fileInput.className = "form-control form-control-sm";
    fileInput.accept = "image/*";
    fileInput.required = true;
    fileCol.appendChild(fileInput);

    const descCol = document.createElement("div");
    descCol.className = "col-5";
    const descInput = document.createElement("input");
    descInput.type = "text";
    descInput.name = "newGalleryDesc[]";
    descInput.className = "form-control form-control-sm";
    descInput.placeholder = "Opis slike (alt tekst)";
    descCol.appendChild(descInput);

    const removeCol = document.createElement("div");
    removeCol.className = "col-1";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-sm btn-outline-danger";
    removeBtn.dataset.galleryRemove = "";
    removeBtn.setAttribute("aria-label", "Ukloni sliku");
    removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
    removeCol.appendChild(removeBtn);

    row.appendChild(fileCol);
    row.appendChild(descCol);
    row.appendChild(removeCol);
    return row;
  }

  function init(container) {
    // Must match the corresponding field's multer maxCount (see the
    // *GalleryUploads middleware arrays in the product/service/package
    // routes files) - this is a UX guardrail only, multer independently
    // rejects anything over that limit server-side either way.
    const max = parseInt(container.dataset.max, 10) || 10;
    const rowsContainer = container.querySelector("[data-gallery-rows]");
    const addBtn = container.querySelector("[data-gallery-add]");
    const limitNotice = container.querySelector("[data-gallery-limit]");

    function rowCount() {
      return rowsContainer.querySelectorAll("[data-gallery-row]").length;
    }

    function refreshAddButton() {
      const atLimit = rowCount() >= max;
      addBtn.disabled = atLimit;
      if (limitNotice) limitNotice.classList.toggle("d-none", !atLimit);
    }

    addBtn.addEventListener("click", () => {
      if (rowCount() >= max) return;
      rowsContainer.appendChild(buildRow());
      refreshAddButton();
    });

    rowsContainer.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-gallery-remove]");
      if (!removeBtn) return;
      removeBtn.closest("[data-gallery-row]").remove();
      refreshAddButton();
    });

    // Start with one row so the "add image" affordance isn't a confusing
    // empty box - most visits to this page are "add a couple of photos".
    rowsContainer.appendChild(buildRow());
    refreshAddButton();
  }

  document.querySelectorAll("[data-gallery-uploader]").forEach(init);
})();