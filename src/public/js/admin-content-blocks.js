(function () {
  // Confirmed against content.blog.schema.js: paragraph/heading/quote use `text`
  // (+`level` for heading, +`meta` for quote's attribution); image/video are nested
  // objects (`image.img`/`image.imgDesc`, `video.url`/`video.title`); list uses
  // `items` (array of strings) + `ordered` (boolean); table uses `table.columns`
  // (array of strings) + `table.rows` (array of {label, values}); cards uses
  // `cards` (array of {icon, title, text}). `order` is derived from each block's
  // position in the list, not user-edited.
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
      { name: "video.thumbnail", label: "Slika za pregled (thumbnail) - opciono", type: "text" },
      { name: "video.isExternal", label: "Eksterni video (YouTube/Vimeo link, ne fajl sa servera)", type: "checkbox" },
    ],
    list: [
      { name: "items", label: "Stavke (jedna po redu)", type: "textarea" },
      { name: "ordered", label: "Numerisana lista", type: "checkbox" },
    ],
    callout: [
      { name: "title", label: "Naslov (opciono)", type: "text" },
      { name: "text", label: "Tekst", type: "textarea" },
      { name: "variant", label: "Stil (info/success/warning/danger)", type: "text" },
    ],
    cta: [
      { name: "title", label: "Naslov", type: "text" },
      { name: "text", label: "Tekst", type: "textarea" },
      { name: "button.text", label: "Tekst dugmeta", type: "text" },
      { name: "button.url", label: "Link dugmeta", type: "text" },
    ],
    serviceReference: [
      { name: "title", label: "Naslov", type: "text" },
      { name: "text", label: "Kratak opis", type: "textarea" },
      { name: "button.text", label: "Tekst linka", type: "text" },
      { name: "button.url", label: "Link ka usluzi", type: "text" },
    ],
    productReference: [
      { name: "title", label: "Naslov", type: "text" },
      { name: "text", label: "Kratak opis", type: "textarea" },
      { name: "button.text", label: "Tekst linka", type: "text" },
      { name: "button.url", label: "Link ka proizvodu (npr. /prodavnica/naziv-proizvoda)", type: "text" },
    ],
    divider: [],
    // table, cards, gallery, and faq are handled separately below (buildTableBuilder/
    // buildCardsBuilder/buildGalleryBuilder/buildFaqBuilder) - they need their own
    // add/remove-row UI, not a flat list of scalar inputs like everything above.
    table: [],
    cards: [],
    gallery: [],
    faq: [{ name: "title", label: "Naslov sekcije (opciono)", type: "text" }],
  };

  // Shown in the "add block" dropdown and each block's own header - purely a
  // display label, the underlying stored `type` value stays the English enum
  // from content.blog.schema.js (BLOG_BLOCK_TYPES) so storage/schema/SEO-builder
  // code never has to deal with a translated string.
  const BLOCK_TYPE_LABELS = {
    paragraph: "Pasus",
    heading: "Naslov",
    image: "Slika",
    gallery: "Galerija slika",
    quote: "Citat",
    list: "Lista",
    video: "Video",
    table: "Tabela",
    cards: "Kartice",
    callout: "Istaknuta napomena",
    faq: "Pitanja i odgovori (FAQ)",
    cta: "Poziv na akciju (CTA)",
    divider: "Razdvajač",
    serviceReference: "Link ka usluzi",
    productReference: "Link ka proizvodu",
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

  // ---- Table builder: add/remove columns, add/remove rows, one labeled input
  // per cell - no delimiter syntax, meant to be usable by someone who has never
  // written code. Columns and row-value-inputs are kept in sync: adding/removing
  // a column adds/removes the matching value input on every existing row. ----

  function tableColumnCount(builderEl) {
    return builderEl.querySelectorAll("[data-table-columns] [data-table-column]").length;
  }

  function addTableColumn(builderEl, value) {
    const columnsList = builderEl.querySelector("[data-table-columns]");
    const colIndex = tableColumnCount(builderEl);

    const wrapper = document.createElement("div");
    wrapper.className = "input-group input-group-sm mb-1";
    wrapper.dataset.tableColumn = "";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control";
    input.placeholder = `Naziv kolone ${colIndex + 1}`;
    input.value = value ?? "";
    input.dataset.columnInput = "";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-outline-danger";
    removeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
    removeBtn.dataset.columnRemove = "";

    wrapper.appendChild(input);
    wrapper.appendChild(removeBtn);
    columnsList.appendChild(wrapper);

    // every existing row needs a matching new (empty) value cell
    builderEl.querySelectorAll("[data-table-rows] [data-table-row]").forEach((rowEl) => {
      addTableRowValueCell(rowEl, "");
    });
  }

  function addTableRowValueCell(rowEl, value) {
    const valuesList = rowEl.querySelector("[data-row-values]");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control form-control-sm mb-1";
    input.dataset.rowValue = "";
    input.value = value ?? "";
    valuesList.appendChild(input);
  }

  function addTableRow(builderEl, rowData) {
    const rowsList = builderEl.querySelector("[data-table-rows]");
    const colCount = tableColumnCount(builderEl);

    const rowEl = document.createElement("div");
    rowEl.className = "border rounded p-2 mb-2";
    rowEl.dataset.tableRow = "";

    const header = document.createElement("div");
    header.className = "d-flex align-items-center gap-2 mb-1";

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "form-control form-control-sm";
    labelInput.placeholder = "Naziv reda";
    labelInput.value = rowData?.label ?? "";
    labelInput.dataset.rowLabel = "";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-sm btn-outline-danger flex-shrink-0";
    removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
    removeBtn.dataset.rowRemove = "";

    header.appendChild(labelInput);
    header.appendChild(removeBtn);
    rowEl.appendChild(header);

    const valuesList = document.createElement("div");
    valuesList.dataset.rowValues = "";
    rowEl.appendChild(valuesList);

    rowsList.appendChild(rowEl);

    const existingValues = rowData?.values || [];
    for (let i = 0; i < colCount; i++) {
      addTableRowValueCell(rowEl, existingValues[i] ?? "");
    }
  }

  function buildTableBuilder(blockData) {
    const builder = document.createElement("div");
    builder.dataset.tableBuilder = "";

    const columnsSection = document.createElement("div");
    columnsSection.className = "mb-3";
    const columnsLabel = document.createElement("label");
    columnsLabel.className = "form-label small mb-1 fw-semibold";
    columnsLabel.textContent = "Kolone";
    const columnsList = document.createElement("div");
    columnsList.dataset.tableColumns = "";
    const addColumnBtn = document.createElement("button");
    addColumnBtn.type = "button";
    addColumnBtn.className = "btn btn-sm btn-outline-primary mt-1";
    addColumnBtn.innerHTML = '<i class="bi bi-plus-lg"></i> Dodaj kolonu';
    addColumnBtn.dataset.columnAdd = "";
    columnsSection.appendChild(columnsLabel);
    columnsSection.appendChild(columnsList);
    columnsSection.appendChild(addColumnBtn);
    builder.appendChild(columnsSection);

    const rowsSection = document.createElement("div");
    const rowsLabel = document.createElement("label");
    rowsLabel.className = "form-label small mb-1 fw-semibold";
    rowsLabel.textContent = "Redovi";
    const rowsList = document.createElement("div");
    rowsList.dataset.tableRows = "";
    const addRowBtn = document.createElement("button");
    addRowBtn.type = "button";
    addRowBtn.className = "btn btn-sm btn-outline-primary mt-1";
    addRowBtn.innerHTML = '<i class="bi bi-plus-lg"></i> Dodaj red';
    addRowBtn.dataset.rowAdd = "";
    rowsSection.appendChild(rowsLabel);
    rowsSection.appendChild(rowsList);
    rowsSection.appendChild(addRowBtn);
    builder.appendChild(rowsSection);

    (blockData?.table?.columns || []).forEach((col) => addTableColumn(builder, col));
    (blockData?.table?.rows || []).forEach((row) => addTableRow(builder, row));

    builder.addEventListener("click", (e) => {
      if (e.target.closest("[data-column-add]")) {
        addTableColumn(builder, "");
      } else if (e.target.closest("[data-row-add]")) {
        addTableRow(builder, null);
      } else if (e.target.closest("[data-column-remove]")) {
        const colEl = e.target.closest("[data-table-column]");
        const colIndex = Array.from(builder.querySelectorAll("[data-table-column]")).indexOf(colEl);
        colEl.remove();
        // remove the matching value cell from every row
        builder.querySelectorAll("[data-table-row]").forEach((rowEl) => {
          const cells = rowEl.querySelectorAll("[data-row-value]");
          if (cells[colIndex]) cells[colIndex].remove();
        });
      } else if (e.target.closest("[data-row-remove]")) {
        e.target.closest("[data-table-row]").remove();
      }
    });

    return builder;
  }

  function readTableBuilder(builderEl) {
    const columns = Array.from(builderEl.querySelectorAll("[data-column-input]")).map((i) => i.value.trim());
    const rows = Array.from(builderEl.querySelectorAll("[data-table-row]")).map((rowEl) => ({
      label: rowEl.querySelector("[data-row-label]").value.trim(),
      values: Array.from(rowEl.querySelectorAll("[data-row-value]")).map((i) => i.value),
    }));
    return { columns, rows };
  }

  // ---- Cards builder: add/remove cards, each with icon/title/text fields. ----

  function addCard(builderEl, cardData) {
    const list = builderEl.querySelector("[data-cards-list]");

    const cardEl = document.createElement("div");
    cardEl.className = "border rounded p-2 mb-2";
    cardEl.dataset.contentCard = "";

    const header = document.createElement("div");
    header.className = "d-flex justify-content-end mb-1";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-sm btn-outline-danger";
    removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
    removeBtn.dataset.cardRemove = "";
    header.appendChild(removeBtn);
    cardEl.appendChild(header);

    const iconInput = document.createElement("input");
    iconInput.type = "text";
    iconInput.className = "form-control form-control-sm mb-1";
    iconInput.placeholder = "Ikonica (npr. bi bi-heart-pulse) - opciono";
    iconInput.value = cardData?.icon ?? "";
    iconInput.dataset.cardIcon = "";
    cardEl.appendChild(iconInput);

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "form-control form-control-sm mb-1";
    titleInput.placeholder = "Naslov kartice";
    titleInput.value = cardData?.title ?? "";
    titleInput.dataset.cardTitle = "";
    cardEl.appendChild(titleInput);

    const textInput = document.createElement("textarea");
    textInput.className = "form-control form-control-sm";
    textInput.rows = 2;
    textInput.placeholder = "Tekst kartice";
    textInput.value = cardData?.text ?? "";
    textInput.dataset.cardText = "";
    cardEl.appendChild(textInput);

    list.appendChild(cardEl);
  }

  function buildCardsBuilder(blockData) {
    const builder = document.createElement("div");
    builder.dataset.cardsBuilder = "";

    const list = document.createElement("div");
    list.dataset.cardsList = "";
    builder.appendChild(list);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-sm btn-outline-primary mt-1";
    addBtn.innerHTML = '<i class="bi bi-plus-lg"></i> Dodaj karticu';
    addBtn.dataset.cardAdd = "";
    builder.appendChild(addBtn);

    (blockData?.cards || []).forEach((card) => addCard(builder, card));

    builder.addEventListener("click", (e) => {
      if (e.target.closest("[data-card-add]")) {
        addCard(builder, null);
      } else if (e.target.closest("[data-card-remove]")) {
        e.target.closest("[data-content-card]").remove();
      }
    });

    return builder;
  }

  function readCardsBuilder(builderEl) {
    return Array.from(builderEl.querySelectorAll("[data-content-card]")).map((cardEl) => ({
      icon: cardEl.querySelector("[data-card-icon]").value.trim(),
      title: cardEl.querySelector("[data-card-title]").value.trim(),
      text: cardEl.querySelector("[data-card-text]").value.trim(),
    }));
  }

  // ---- Gallery builder: add/remove images, each with img path + alt text. ----

  function addGalleryImage(builderEl, imgData) {
    const list = builderEl.querySelector("[data-gallery-list]");

    const itemEl = document.createElement("div");
    itemEl.className = "border rounded p-2 mb-2";
    itemEl.dataset.galleryImage = "";

    const header = document.createElement("div");
    header.className = "d-flex justify-content-end mb-1";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-sm btn-outline-danger";
    removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
    removeBtn.dataset.galleryImageRemove = "";
    header.appendChild(removeBtn);
    itemEl.appendChild(header);

    const imgInput = document.createElement("input");
    imgInput.type = "text";
    imgInput.className = "form-control form-control-sm mb-1";
    imgInput.placeholder = "Putanja do slike (iz galerije)";
    imgInput.value = imgData?.img ?? "";
    imgInput.dataset.galleryImgPath = "";
    itemEl.appendChild(imgInput);

    const descInput = document.createElement("input");
    descInput.type = "text";
    descInput.className = "form-control form-control-sm";
    descInput.placeholder = "Opis slike (alt tekst)";
    descInput.value = imgData?.imgDesc ?? "";
    descInput.dataset.galleryImgDesc = "";
    itemEl.appendChild(descInput);

    list.appendChild(itemEl);
  }

  function buildGalleryBuilder(blockData) {
    const builder = document.createElement("div");
    builder.dataset.galleryBuilder = "";

    const list = document.createElement("div");
    list.dataset.galleryList = "";
    builder.appendChild(list);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-sm btn-outline-primary mt-1";
    addBtn.innerHTML = '<i class="bi bi-plus-lg"></i> Dodaj sliku';
    addBtn.dataset.galleryImageAdd = "";
    builder.appendChild(addBtn);

    (blockData?.gallery || []).forEach((img) => addGalleryImage(builder, img));

    builder.addEventListener("click", (e) => {
      if (e.target.closest("[data-gallery-image-add]")) {
        addGalleryImage(builder, null);
      } else if (e.target.closest("[data-gallery-image-remove]")) {
        e.target.closest("[data-gallery-image]").remove();
      }
    });

    return builder;
  }

  function readGalleryBuilder(builderEl) {
    return Array.from(builderEl.querySelectorAll("[data-gallery-image]")).map((el) => ({
      img: el.querySelector("[data-gallery-img-path]").value.trim(),
      imgDesc: el.querySelector("[data-gallery-img-desc]").value.trim(),
    }));
  }

  // ---- FAQ builder: add/remove question/answer pairs. ----

  function addFaqItem(builderEl, itemData) {
    const list = builderEl.querySelector("[data-faq-list]");

    const itemEl = document.createElement("div");
    itemEl.className = "border rounded p-2 mb-2";
    itemEl.dataset.faqItem = "";

    const header = document.createElement("div");
    header.className = "d-flex justify-content-end mb-1";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-sm btn-outline-danger";
    removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
    removeBtn.dataset.faqItemRemove = "";
    header.appendChild(removeBtn);
    itemEl.appendChild(header);

    const questionInput = document.createElement("input");
    questionInput.type = "text";
    questionInput.className = "form-control form-control-sm mb-1";
    questionInput.placeholder = "Pitanje";
    questionInput.value = itemData?.question ?? "";
    questionInput.dataset.faqQuestion = "";
    itemEl.appendChild(questionInput);

    const answerInput = document.createElement("textarea");
    answerInput.className = "form-control form-control-sm";
    answerInput.rows = 2;
    answerInput.placeholder = "Odgovor";
    answerInput.value = itemData?.answer ?? "";
    answerInput.dataset.faqAnswer = "";
    itemEl.appendChild(answerInput);

    list.appendChild(itemEl);
  }

  function buildFaqBuilder(blockData) {
    const builder = document.createElement("div");
    builder.dataset.faqBuilder = "";

    const list = document.createElement("div");
    list.dataset.faqList = "";
    builder.appendChild(list);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-sm btn-outline-primary mt-1";
    addBtn.innerHTML = '<i class="bi bi-plus-lg"></i> Dodaj pitanje';
    addBtn.dataset.faqItemAdd = "";
    builder.appendChild(addBtn);

    (blockData?.faqItems || []).forEach((item) => addFaqItem(builder, item));

    builder.addEventListener("click", (e) => {
      if (e.target.closest("[data-faq-item-add]")) {
        addFaqItem(builder, null);
      } else if (e.target.closest("[data-faq-item-remove]")) {
        e.target.closest("[data-faq-item]").remove();
      }
    });

    return builder;
  }

  function readFaqBuilder(builderEl) {
    return Array.from(builderEl.querySelectorAll("[data-faq-item]")).map((el) => ({
      question: el.querySelector("[data-faq-question]").value.trim(),
      answer: el.querySelector("[data-faq-answer]").value.trim(),
    }));
  }

  function buildBlock(type, blockData) {
    const block = document.createElement("div");
    block.className = "border rounded p-3 mb-2";
    block.dataset.contentBlock = "";
    block.dataset.blockType = type;

    const header = document.createElement("div");
    header.className = "d-flex justify-content-between align-items-center mb-2";
    const typeLabel = document.createElement("strong");
    typeLabel.textContent = BLOCK_TYPE_LABELS[type] || type;
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

    if (type === "table") {
      block.appendChild(buildTableBuilder(blockData));
    } else if (type === "cards") {
      block.appendChild(buildCardsBuilder(blockData));
    } else if (type === "gallery") {
      block.appendChild(buildGalleryBuilder(blockData));
    } else if (type === "faq") {
      // faq also has a plain "title" field (section heading) via BLOCK_FIELDS,
      // rendered above the question/answer builder
      const fieldsRow = document.createElement("div");
      fieldsRow.className = "row";
      (BLOCK_FIELDS.faq || []).forEach((field) => fieldsRow.appendChild(buildFieldInput(field, blockData)));
      block.appendChild(fieldsRow);
      block.appendChild(buildFaqBuilder(blockData));
    } else {
      const fieldsRow = document.createElement("div");
      fieldsRow.className = "row";
      (BLOCK_FIELDS[type] || []).forEach((field) => fieldsRow.appendChild(buildFieldInput(field, blockData)));
      block.appendChild(fieldsRow);
    }

    return block;
  }

  function readBlock(block, index) {
    const type = block.dataset.blockType;
    const obj = { type, order: index };

    if (type === "table") {
      obj.table = readTableBuilder(block.querySelector("[data-table-builder]"));
      return obj;
    }
    if (type === "cards") {
      obj.cards = readCardsBuilder(block.querySelector("[data-cards-builder]"));
      return obj;
    }
    if (type === "gallery") {
      obj.gallery = readGalleryBuilder(block.querySelector("[data-gallery-builder]"));
      return obj;
    }
    if (type === "faq") {
      obj.faqItems = readFaqBuilder(block.querySelector("[data-faq-builder]"));
      const titleInput = block.querySelector('[data-block-field="title"]');
      if (titleInput) obj.title = titleInput.value;
      return obj;
    }

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

  function relabelTypeSelect(container) {
    const select = container.querySelector("[data-block-type-select]");
    if (!select) return;
    Array.from(select.options).forEach((option) => {
      option.textContent = BLOCK_TYPE_LABELS[option.value] || option.value;
    });
  }

  function init(container) {
    relabelTypeSelect(container);

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
    container.addEventListener("click", () => sync(container));
    const form = container.closest("form");
    if (form) form.addEventListener("submit", () => sync(container));

    sync(container);
  }

  document.querySelectorAll("[data-content-blocks]").forEach(init);
})();