(function () {
  const data = window.__manualOrderData;
  const itemsContainer = document.querySelector("[data-manual-items]");
  if (!data || !itemsContainer) return; // not the manual order creation form

  const MAX_ROWS = 20; // matches MAX_MANUAL_ORDER_ITEMS on the server
  const currency = window.__currencySymbol || "RSD";

  const addButton = document.querySelector("[data-manual-add-item]");
  const finalTotalInput = document.querySelector("[data-manual-final-total]");
  const shippingInput = document.querySelector("[data-manual-shipping]");
  const summaryItems = document.querySelector("[data-manual-summary-items]");
  const summaryShipping = document.querySelector("[data-manual-summary-shipping]");
  const summaryTotal = document.querySelector("[data-manual-summary-total]");
  const summaryNote = document.querySelector("[data-manual-summary-note]");

  const existingUserToggle = document.querySelector("[data-manual-existing-user-toggle]");
  const existingUserField = document.querySelector("[data-manual-existing-user-field]");
  const contactFields = document.querySelectorAll("[data-manual-contact-field]");
  const contactRequiredInputs = document.querySelectorAll("[data-manual-contact-required]");

  const productsById = Object.fromEntries(data.products.map((p) => [p.id, p]));
  let nextIndex = 0; // form field index - never reused, so removing a row can't make two rows collide

  const money = (n) => `${Math.round((Number(n) || 0) * 100) / 100} ${currency}`;

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (v !== false && v != null) node.setAttribute(k, v === true ? "" : v);
    });
    children.forEach((c) => node.appendChild(c));
    return node;
  }

  function fillVariants(select, productId, selectedVariantId) {
    const product = productsById[productId];
    select.innerHTML = "";
    if (!product || !product.variants.length) {
      select.appendChild(el("option", { value: "", text: productId ? "Nema dostupnih varijanti" : "Prvo izaberite proizvod" }));
      select.disabled = true;
      return;
    }
    select.appendChild(el("option", { value: "", text: "Izaberite..." }));
    product.variants.forEach((v) => {
      const priceLabel = product.priceOnRequest ? "cena na upit" : `${v.price} ${currency}`;
      const opt = el("option", { value: v.id, text: `${v.name} - ${priceLabel} (${v.stock} na stanju)` });
      if (v.id === selectedVariantId) opt.selected = true;
      select.appendChild(opt);
    });
    select.disabled = false;
  }

  function createRow(initial = {}) {
    const i = nextIndex++;
    const row = el("div", { class: "row g-2 align-items-start mb-2 manual-order-row", "data-manual-row": "" });

    const productSelect = el("select", { class: "form-select", name: `items[${i}][productId]`, required: true, "aria-label": "Proizvod" });
    productSelect.appendChild(el("option", { value: "", text: "Proizvod..." }));
    data.products.forEach((p) => {
      const opt = el("option", { value: p.id, text: p.name + (p.priceOnRequest ? " (cena na upit)" : "") });
      if (p.id === initial.productId) opt.selected = true;
      productSelect.appendChild(opt);
    });

    const variantSelect = el("select", { class: "form-select", name: `items[${i}][variantId]`, required: true, "aria-label": "Varijanta", disabled: true });
    const qtyInput = el("input", { type: "number", class: "form-control", name: `items[${i}][quantity]`, min: "1", value: initial.quantity || "1", required: true, "aria-label": "Količina" });
    const priceInput = el("input", { type: "number", class: "form-control", name: `items[${i}][price]`, min: "0", step: "0.01", value: initial.price || "", placeholder: "iz kataloga", "aria-label": "Cena po komadu" });
    const lineTotal = el("div", { class: "form-control-plaintext text-md-end", "data-manual-line-total": "", text: "-" });
    const removeBtn = el("button", { type: "button", class: "btn btn-outline-danger btn-sm", title: "Ukloni proizvod", "aria-label": "Ukloni proizvod" }, [el("i", { class: "bi bi-trash", "aria-hidden": "true" })]);

    row.appendChild(el("div", { class: "col-md-3" }, [productSelect]));
    row.appendChild(el("div", { class: "col-md-3" }, [variantSelect]));
    row.appendChild(el("div", { class: "col-4 col-md-1" }, [qtyInput]));
    row.appendChild(el("div", { class: "col-8 col-md-3" }, [priceInput]));
    row.appendChild(el("div", { class: "col-8 col-md-1 text-md-end" }, [lineTotal]));
    row.appendChild(el("div", { class: "col-4 col-md-1 text-end" }, [removeBtn]));

    fillVariants(variantSelect, initial.productId || "", initial.variantId || "");

    productSelect.addEventListener("change", () => {
      fillVariants(variantSelect, productSelect.value, "");
      priceInput.value = "";
      refresh();
    });
    [variantSelect, qtyInput, priceInput].forEach((input) => input.addEventListener("input", refresh));
    variantSelect.addEventListener("change", refresh);
    removeBtn.addEventListener("click", () => {
      row.remove();
      if (!itemsContainer.querySelector("[data-manual-row]")) itemsContainer.appendChild(createRow());
      refresh();
    });

    row._parts = { productSelect, variantSelect, qtyInput, priceInput, lineTotal };
    return row;
  }

  // catalog price (default) -> typed per-line price -> final total: same order of
  // precedence as manual-order-pricing.util.js on the server, which is what actually decides.
  function computeLine(parts) {
    const product = productsById[parts.productSelect.value];
    const variant = product && product.variants.find((v) => v.id === parts.variantSelect.value);
    const qty = parseInt(parts.qtyInput.value, 10) || 0;
    const typed = parts.priceInput.value !== "" ? parseFloat(parts.priceInput.value) : null;
    const unit = typed != null ? typed : variant ? variant.price : null;
    return { product, variant, qty, typed, unit, total: unit != null ? unit * qty : null };
  }

  function refresh() {
    const finalRaw = finalTotalInput ? finalTotalInput.value : "";
    const hasFinal = finalRaw !== "" && !Number.isNaN(parseFloat(finalRaw));
    const rows = [...itemsContainer.querySelectorAll("[data-manual-row]")];

    let sum = 0;
    let missingPrice = false;
    rows.forEach((row) => {
      const parts = row._parts;
      const line = computeLine(parts);

      // a "cena na upit" product has no usable catalog price: it needs its own price,
      // unless a final total for the whole order is given
      const needsPrice = !!(line.product && line.product.priceOnRequest) && line.typed == null && !hasFinal;
      parts.priceInput.required = needsPrice;
      parts.priceInput.placeholder = line.product && line.product.priceOnRequest ? "obavezno" : "iz kataloga";
      if (needsPrice) missingPrice = true;

      if (line.product && line.product.priceOnRequest && line.typed == null) {
        parts.lineTotal.textContent = "-";
      } else if (line.total != null) {
        parts.lineTotal.textContent = money(line.total);
        sum += line.total;
      } else {
        parts.lineTotal.textContent = "-";
      }
      parts.lineTotal.classList.toggle("text-decoration-line-through", hasFinal);
      parts.lineTotal.classList.toggle("text-muted", hasFinal);
    });

    const goods = hasFinal ? parseFloat(finalRaw) : sum;
    const shipping = parseFloat(shippingInput && shippingInput.value) || 0;
    summaryItems.textContent = money(goods);
    summaryShipping.textContent = money(shipping);
    summaryTotal.textContent = money(goods + shipping);

    if (hasFinal) {
      summaryNote.hidden = false;
      summaryNote.textContent = `Finalna cena zamenjuje cene proizvoda (po ceni iz kataloga / ručnoj: ${money(sum)}). Pojedinačne cene se srazmerno usklađuju.`;
    } else if (missingPrice) {
      summaryNote.hidden = false;
      summaryNote.textContent = 'Proizvod sa "cenom na upit" zahteva ručnu cenu, ili upiši finalnu cenu.';
    } else {
      summaryNote.hidden = true;
    }

    if (addButton) addButton.disabled = rows.length >= MAX_ROWS;
  }

  const initial = Array.isArray(data.initialItems) ? data.initialItems : [];
  (initial.length ? initial : [{}]).forEach((item) => itemsContainer.appendChild(createRow(item)));

  if (addButton) {
    addButton.addEventListener("click", () => {
      if (itemsContainer.querySelectorAll("[data-manual-row]").length >= MAX_ROWS) return;
      const row = createRow();
      itemsContainer.appendChild(row);
      row._parts.productSelect.focus();
      refresh();
    });
  }
  if (finalTotalInput) finalTotalInput.addEventListener("input", refresh);
  if (shippingInput) shippingInput.addEventListener("input", refresh);

  function applyExistingUserState() {
    const useExisting = existingUserToggle.checked;
    existingUserField.style.display = useExisting ? "" : "none";
    contactFields.forEach((field) => {
      field.style.display = useExisting ? "none" : "";
    });
    contactRequiredInputs.forEach((input) => {
      input.required = !useExisting;
    });
  }
  if (existingUserToggle) {
    existingUserToggle.addEventListener("change", applyExistingUserState);
    applyExistingUserState(); // the form can be re-shown after a validation error with the box already ticked
  }

  refresh();
})();
