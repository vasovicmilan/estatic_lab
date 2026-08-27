(function () {
  const data = window.__manualOrderData;
  const productSelect = document.querySelector("[data-manual-product-select]");
  if (!data || !productSelect) return; // not the manual order creation form

  const variantSelect = document.querySelector("[data-manual-variant-select]");
  const existingUserToggle = document.querySelector("[data-manual-existing-user-toggle]");
  const existingUserField = document.querySelector("[data-manual-existing-user-field]");
  const contactFields = document.querySelectorAll("[data-manual-contact-field]");
  const contactRequiredInputs = document.querySelectorAll("[data-manual-contact-required]");
  const overrideToggle = document.querySelector("[data-manual-override-toggle]");
  const overrideField = document.querySelector("[data-manual-override-field]");
  const priceOverrideInput = document.getElementById("priceOverride");

  const productsById = Object.fromEntries(data.products.map((p) => [p.id, p]));

  function resetSelect(select, placeholder) {
    select.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder;
    select.appendChild(opt);
  }

  function populateVariants(productId) {
    const product = productsById[productId];
    if (!product || !product.variants.length) {
      resetSelect(variantSelect, "Nema dostupnih varijanti");
      variantSelect.disabled = true;
      return;
    }
    resetSelect(variantSelect, "Izaberite...");
    product.variants.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.id;
      const priceLabel = product.priceOnRequest ? "cena na upit" : `${v.price} ${window.__currencySymbol || "RSD"}`;
      opt.textContent = `${v.name} - ${priceLabel} (${v.stock} na stanju)`;
      variantSelect.appendChild(opt);
    });
    variantSelect.disabled = false;
  }

  productSelect.addEventListener("change", () => {
    const productId = productSelect.value;
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    const isPriceOnRequest = selectedOption && selectedOption.dataset.priceOnRequest === "1";

    if (!productId) {
      resetSelect(variantSelect, "Prvo izaberite proizvod");
      variantSelect.disabled = true;
      return;
    }
    populateVariants(productId);

    if (isPriceOnRequest && overrideToggle && !overrideToggle.checked) {
      overrideToggle.checked = true;
      overrideToggle.dispatchEvent(new Event("change"));
    }
  });

  if (existingUserToggle) {
    existingUserToggle.addEventListener("change", () => {
      const useExisting = existingUserToggle.checked;
      existingUserField.style.display = useExisting ? "" : "none";
      contactFields.forEach((field) => {
        field.style.display = useExisting ? "none" : "";
      });
      contactRequiredInputs.forEach((input) => {
        input.required = !useExisting;
      });
    });
  }

  if (overrideToggle) {
    overrideToggle.addEventListener("change", () => {
      overrideField.style.display = overrideToggle.checked ? "" : "none";
      if (priceOverrideInput) priceOverrideInput.required = overrideToggle.checked;
    });
  }
})();
