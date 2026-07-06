(function () {
  function buildRowInput(subfield, value) {
    const wrapper = document.createElement("div");
    wrapper.className = "col";

    let input;
    if (subfield.type === "select") {
      input = document.createElement("select");
      input.className = "form-select form-select-sm";
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "Izaberite...";
      input.appendChild(blank);
      (subfield.options || []).forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        if (value !== undefined && String(value) === String(opt.value)) o.selected = true;
        input.appendChild(o);
      });
    } else if (subfield.type === "textarea") {
      input = document.createElement("textarea");
      input.className = "form-control form-control-sm";
      input.value = value ?? "";
    } else {
      input = document.createElement("input");
      input.type = subfield.type || "text";
      input.className = "form-control form-control-sm";
      if (subfield.min !== undefined) input.min = subfield.min;
      if (subfield.step !== undefined) input.step = subfield.step;
      input.value = value !== undefined ? value : (subfield.type === "number" ? (subfield.value ?? "") : "");
    }
    input.dataset.repeaterField = subfield.name;
    if (subfield.required) input.required = true;
    if (subfield.placeholder) input.placeholder = subfield.placeholder;

    const label = document.createElement("label");
    label.className = "form-label small mb-1";
    label.textContent = subfield.label || subfield.name;

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    return wrapper;
  }

  function buildRow(schema, rowData) {
    const row = document.createElement("div");
    row.className = "row g-2 align-items-end border-bottom pb-2 mb-2";
    row.dataset.repeaterRow = "";

    schema.forEach((subfield) => row.appendChild(buildRowInput(subfield, rowData ? rowData[subfield.name] : undefined)));

    const removeCol = document.createElement("div");
    removeCol.className = "col-auto";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-sm btn-outline-danger";
    removeBtn.setAttribute("aria-label", "Ukloni stavku");
    removeBtn.dataset.repeaterRemove = "";
    removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
    removeCol.appendChild(removeBtn);
    row.appendChild(removeCol);

    return row;
  }

  function readRow(row, schema) {
    const obj = {};
    schema.forEach((subfield) => {
      const input = row.querySelector(`[data-repeater-field="${subfield.name}"]`);
      if (!input) return;
      obj[subfield.name] = subfield.type === "number" ? (input.value === "" ? null : Number(input.value)) : input.value;
    });
    return obj;
  }

  function sync(container) {
    const name = container.dataset.repeater;
    const schema = JSON.parse(container.dataset.repeaterSchema || "[]");
    const rowsContainer = container.querySelector("[data-repeater-rows]");
    const rows = Array.from(rowsContainer.querySelectorAll("[data-repeater-row]"));
    const value = rows.map((row) => readRow(row, schema));

    const hiddenInput = container.parentElement.querySelector(`[data-repeater-input="${name}"]`);
    if (hiddenInput) hiddenInput.value = JSON.stringify(value);

    const emptyNotice = container.querySelector("[data-repeater-empty]");
    if (emptyNotice) emptyNotice.style.display = rows.length ? "none" : "";
  }

  function init(container) {
    const schema = JSON.parse(container.dataset.repeaterSchema || "[]");
    let initialValue = [];
    try {
      initialValue = JSON.parse(container.dataset.repeaterValue || "[]");
    } catch {
      initialValue = [];
    }

    const rowsContainer = container.querySelector("[data-repeater-rows]");
    initialValue.forEach((rowData) => rowsContainer.appendChild(buildRow(schema, rowData)));

    container.querySelector("[data-repeater-add]").addEventListener("click", () => {
      rowsContainer.appendChild(buildRow(schema, null));
      sync(container);
    });

    rowsContainer.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-repeater-remove]");
      if (!removeBtn) return;
      removeBtn.closest("[data-repeater-row]").remove();
      sync(container);
    });

    container.addEventListener("input", () => sync(container));
    container.addEventListener("change", () => sync(container));
    const form = container.closest("form");
    if (form) form.addEventListener("submit", () => sync(container));

    sync(container);
  }

  document.querySelectorAll("[data-repeater]").forEach(init);
})();