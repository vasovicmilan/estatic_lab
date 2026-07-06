(function () {
  function getColumns(columnsFieldName) {
    const field = document.querySelector(`[data-field="${columnsFieldName}"]`);
    if (!field) return [];
    return field.value.split(",").map((c) => c.trim()).filter(Boolean);
  }

  function buildRow(columns, rowData) {
    const row = document.createElement("div");
    row.className = "row g-2 align-items-end border-bottom pb-2 mb-2";
    row.dataset.comparisonRow = "";

    const labelCol = document.createElement("div");
    labelCol.className = "col-md-3";
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "form-control form-control-sm";
    labelInput.placeholder = "Naziv reda";
    labelInput.dataset.comparisonLabel = "";
    labelInput.value = rowData?.label || "";
    labelCol.appendChild(labelInput);
    row.appendChild(labelCol);

    const valuesWrap = document.createElement("div");
    valuesWrap.className = "col d-flex flex-wrap gap-2";
    columns.forEach((col, i) => {
      const valInput = document.createElement("input");
      valInput.type = "text";
      valInput.className = "form-control form-control-sm";
      valInput.style.width = "140px";
      valInput.placeholder = col;
      valInput.dataset.comparisonValue = i;
      valInput.value = rowData?.values?.[i] ?? "";
      valuesWrap.appendChild(valInput);
    });
    row.appendChild(valuesWrap);

    const removeCol = document.createElement("div");
    removeCol.className = "col-auto";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-sm btn-outline-danger";
    removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
    removeBtn.dataset.comparisonRemove = "";
    removeCol.appendChild(removeBtn);
    row.appendChild(removeCol);

    return row;
  }

  function readRow(row) {
    const label = row.querySelector("[data-comparison-label]").value;
    const values = Array.from(row.querySelectorAll("[data-comparison-value]")).map((i) => i.value);
    return { label, values };
  }

  function sync(container) {
    const name = container.dataset.comparisonTable;
    const rowsContainer = container.querySelector("[data-comparison-rows]");
    const rows = Array.from(rowsContainer.querySelectorAll("[data-comparison-row]"));
    const value = rows.map(readRow);
    const hiddenInput = container.parentElement.querySelector(`[data-repeater-input="${name}"]`);
    if (hiddenInput) hiddenInput.value = JSON.stringify(value);
  }

  function rerenderColumns(container) {
    const columns = getColumns(container.dataset.comparisonColumnsField);
    const rowsContainer = container.querySelector("[data-comparison-rows]");
    const existingRows = Array.from(rowsContainer.querySelectorAll("[data-comparison-row]")).map(readRow);
    rowsContainer.innerHTML = "";
    existingRows.forEach((rowData) => rowsContainer.appendChild(buildRow(columns, rowData)));
    sync(container);
  }

  function init(container) {
    let initialValue = [];
    try {
      initialValue = JSON.parse(container.dataset.comparisonValue || "[]");
    } catch {
      initialValue = [];
    }
    const columnsFieldName = container.dataset.comparisonColumnsField;
    const rowsContainer = container.querySelector("[data-comparison-rows]");
    initialValue.forEach((rowData) => rowsContainer.appendChild(buildRow(getColumns(columnsFieldName), rowData)));

    container.querySelector("[data-comparison-add]").addEventListener("click", () => {
      rowsContainer.appendChild(buildRow(getColumns(columnsFieldName), null));
      sync(container);
    });

    rowsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-comparison-remove]");
      if (!btn) return;
      btn.closest("[data-comparison-row]").remove();
      sync(container);
    });

    container.addEventListener("input", () => sync(container));
    container.addEventListener("change", () => sync(container));

    const columnsField = document.querySelector(`[data-field="${columnsFieldName}"]`);
    if (columnsField) {
      columnsField.addEventListener("change", () => rerenderColumns(container));
      columnsField.addEventListener("blur", () => rerenderColumns(container));
    }

    const form = container.closest("form");
    if (form) form.addEventListener("submit", () => sync(container));

    sync(container);
  }

  document.querySelectorAll("[data-comparison-table]").forEach(init);
})();