(function () {
  // Confirmed against content.blog.schema.js: paragraph/heading/quote use `text`
  // (+`level` for heading, +`meta` for quote's attribution); image/video are nested
  // objects (`image.img`/`image.imgDesc`, `video.url`/`video.title`); list uses
  // `items` (array of strings) + `ordered` (boolean). `order` is derived from each
  // block's position in the list, not user-edited.
  const BLOCK_FIELDS = {
    paragraph: [{ name: "text", label: "Tekst", type: "textarea" }],
    heading: [
      { name: "text", label: "Naslov", type: "text" },
      { name: "level", label: "Nivo (2-4)", type: "number", min: 2, max: 4, value: 2 },
    ],
    quote: [
      { name: "text", label: "Citat", type: "textarea" },
      { name: "meta", label: "Izvor / autor citata", type: "text" },
    ],
    image: [
      { name: "image.img", label: "Putanja do slike (iz galerije)", type: "text" },
      { name: "image.imgDesc", label: "Opis slike (alt tekst)", type: "text" },
    ],
    video: [
      { name: "video.url", label: "URL videa", type: "text" },
      { name: "video.title", label: "Naslov videa", type: "text" },
    ],
    list: [
      { name: "items", label: "Stavke (jedna po redu)", type: "textarea" },
      { name: "ordered", label: "Numerisana lista", type: "checkbox" },
    ],
  };

  function getNested(obj, dottedName) {
    return dottedName.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
  }

  function setNested(obj, dottedName, value) {
    const keys = dottedName.split(".");
    let target = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      target[keys[i]] = target[keys[i]] || {};
      target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;
  }

  function buildFieldInput(field, blockData) {
    const value = blockData ? getNested(blockData, field.name) : undefined;
    let input;

    if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.className = "form-control form-control-sm";
      input.rows = 3;
      input.value = field.name === "items" && Array.isArray(value) ? value.join("\n") : value ?? "";
    } else if (field.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.className = "form-check-input";
      input.checked = Boolean(value);
    } else {
      input = document.createElement("input");
      input.type = field.type || "text";
      input.className = "form-control form-control-sm";
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
      input.value = value !== undefined ? value : (field.type === "number" ? (field.value ?? "") : "");
    }
    input.dataset.blockField = field.name;

    const wrapper = document.createElement("div");
    wrapper.className = field.type === "checkbox" ? "col-12 mb-2 form-check" : "col-12 mb-2";
    const label = document.createElement("label");
    label.className = field.type === "checkbox" ? "form-check-label" : "form-label small mb-1";
    label.textContent = field.label;

    if (field.type === "checkbox") {
      wrapper.appendChild(input);
      wrapper.appendChild(label);
    } else {
      wrapper.appendChild(label);
      wrapper.appendChild(input);
    }
    return wrapper;
  }

  function buildBlock(type, blockData) {
    const block = document.createElement("div");
    block.className = "border rounded p-3 mb-2";
    block.dataset.contentBlock = "";
    block.dataset.blockType = type;

    const header = document.createElement("div");
    header.className = "d-flex justify-content-between align-items-center mb-2";
    const typeLabel = document.createElement("strong");
    typeLabel.textContent = type;
    header.appendChild(typeLabel);

    const btnGroup = document.createElement("div");
    [
      ["bi-arrow-up", "blockMoveUp", "btn-outline-secondary me-1"],
      ["bi-arrow-down", "blockMoveDown", "btn-outline-secondary me-1"],
      ["bi-trash", "blockRemove", "btn-outline-danger"],
    ].forEach(([icon, dataset, cls]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn btn-sm ${cls}`;
      btn.innerHTML = `<i class="bi ${icon}"></i>`;
      btn.dataset[dataset] = "";
      btnGroup.appendChild(btn);
    });
    header.appendChild(btnGroup);
    block.appendChild(header);

    const fieldsRow = document.createElement("div");
    fieldsRow.className = "row";
    (BLOCK_FIELDS[type] || []).forEach((field) => fieldsRow.appendChild(buildFieldInput(field, blockData)));
    block.appendChild(fieldsRow);

    return block;
  }

  function readBlock(block, index) {
    const type = block.dataset.blockType;
    const obj = { type, order: index };
    (BLOCK_FIELDS[type] || []).forEach((field) => {
      const input = block.querySelector(`[data-block-field="${field.name}"]`);
      if (!input) return;

      let value;
      if (field.type === "checkbox") {
        value = input.checked;
      } else if (field.name === "items") {
        value = input.value.split("\n").map((s) => s.trim()).filter(Boolean);
      } else if (field.type === "number") {
        value = input.value === "" ? null : Number(input.value);
      } else {
        value = input.value;
      }
      setNested(obj, field.name, value);
    });
    return obj;
  }

  function sync(container) {
    const name = container.dataset.contentBlocks;
    const blocksContainer = container.querySelector("[data-content-blocks-list]");
    const blocks = Array.from(blocksContainer.querySelectorAll("[data-content-block]"));
    const value = blocks.map((block, index) => readBlock(block, index));
    const hiddenInput = container.parentElement.querySelector(`[data-repeater-input="${name}"]`);
    if (hiddenInput) hiddenInput.value = JSON.stringify(value);
  }

  function init(container) {
    let initialValue = [];
    try {
      initialValue = JSON.parse(container.dataset.contentBlocksValue || "[]");
    } catch {
      initialValue = [];
    }
    const blocksContainer = container.querySelector("[data-content-blocks-list]");
    initialValue
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((blockData) => blocksContainer.appendChild(buildBlock(blockData.type, blockData)));

    const typeSelect = container.querySelector("[data-block-type-select]");
    container.querySelector("[data-block-add]").addEventListener("click", () => {
      blocksContainer.appendChild(buildBlock(typeSelect.value, null));
      sync(container);
    });

    blocksContainer.addEventListener("click", (e) => {
      const block = e.target.closest("[data-content-block]");
      if (!block) return;
      if (e.target.closest("[data-block-remove]")) {
        block.remove();
        sync(container);
      } else if (e.target.closest("[data-block-move-up]")) {
        const prev = block.previousElementSibling;
        if (prev) blocksContainer.insertBefore(block, prev);
        sync(container);
      } else if (e.target.closest("[data-block-move-down]")) {
        const next = block.nextElementSibling;
        if (next) blocksContainer.insertBefore(next, block);
        sync(container);
      }
    });

    container.addEventListener("input", () => sync(container));
    container.addEventListener("change", () => sync(container));
    const form = container.closest("form");
    if (form) form.addEventListener("submit", () => sync(container));

    sync(container);
  }

  document.querySelectorAll("[data-content-blocks]").forEach(init);
})();