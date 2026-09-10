(function () {
  const data = window.__manualAppointmentData;
  const serviceSelect = document.querySelector("[data-manual-service-select]");
  if (!data || !serviceSelect) return; // not the manual appointment creation form

  const variantSelect = document.querySelector("[data-manual-variant-select]");
  const employeeSelect = document.querySelector("[data-manual-employee-select]");
  const existingUserToggle = document.querySelector("[data-manual-existing-user-toggle]");
  const existingUserField = document.querySelector("[data-manual-existing-user-field]");
  const existingUserSelect = document.getElementById("existingUserId");
  const contactFields = document.querySelectorAll("[data-manual-contact-field]");
  const contactRequiredInputs = document.querySelectorAll("[data-manual-contact-required]");
  const overrideToggle = document.querySelector("[data-manual-override-toggle]");
  const overrideField = document.querySelector("[data-manual-override-field]");
  const priceOverrideInput = document.getElementById("priceOverride");
  const packageOption = document.querySelector("[data-manual-package-option]");
  const packageCheckbox = document.querySelector("[data-manual-package-checkbox]");
  const packageRemaining = document.querySelector("[data-manual-package-remaining]");

  const servicesById = Object.fromEntries(data.services.map((s) => [s.id, s]));

  function resetSelect(select, placeholder) {
    select.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder;
    select.appendChild(opt);
  }

  function populateVariants(serviceId) {
    const service = servicesById[serviceId];
    if (!service || !service.variants.length) {
      resetSelect(variantSelect, "Nema dostupnih varijanti");
      variantSelect.disabled = true;
      return;
    }
    resetSelect(variantSelect, "Izaberite...");
    service.variants.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = `${v.name} - ${v.duration} min - ${v.price} ${window.__currencySymbol || "RSD"}`;
      variantSelect.appendChild(opt);
    });
    variantSelect.disabled = false;
  }

  function populateEmployees(serviceId) {
    const employees = (data.employeesByService && data.employeesByService[serviceId]) || [];
    resetSelect(employeeSelect, "Automatski / bilo koji dostupan");
    employees.forEach((e) => {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = e.name;
      employeeSelect.appendChild(opt);
    });
    employeeSelect.disabled = employees.length === 0;
  }

  // ---- postojeći korisnik ima paket koji pokriva izabranu varijantu? ----
  // Re-checked every time the existing-user pick or the variant changes -
  // there's no server-preloaded matrix of this (unlike services/employees
  // above) since it's a per-user, per-variant combination.
  function hidePackageOption() {
    if (!packageOption) return;
    packageOption.style.display = "none";
    packageCheckbox.checked = false;
    packageCheckbox.value = "";
    packageRemaining.textContent = "";
  }

  async function checkPackageAvailability() {
    if (!packageOption) return;
    const useExisting = existingUserToggle && existingUserToggle.checked;
    const userId = existingUserSelect ? existingUserSelect.value : "";
    const servicePackageId = variantSelect ? variantSelect.value : "";

    if (!useExisting || !userId || !servicePackageId) {
      hidePackageOption();
      return;
    }

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
      const res = await fetch("/admin/termini/rucno-kreiranje/proveri-paket", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ existingUserId: userId, servicePackageId }),
      });
      const result = await res.json();

      if (!result.usable) {
        hidePackageOption();
        return;
      }

      packageCheckbox.value = result.packagePurchaseId;
      packageRemaining.textContent = `(preostalo ${result.preostaloSeansi} seansi za ovu uslugu)`;
      packageOption.style.display = "";
      // default to checked when a usable package is found (matching the public
      // booking flow's own default), unless a price override is already active -
      // the two are mutually exclusive, see priceOverride/packagePurchaseId
      // handling in bookAppointment
      packageCheckbox.checked = !(overrideToggle && overrideToggle.checked);
    } catch {
      hidePackageOption();
    }
  }

  serviceSelect.addEventListener("change", () => {
    const serviceId = serviceSelect.value;
    if (!serviceId) {
      resetSelect(variantSelect, "Prvo izaberite uslugu");
      variantSelect.disabled = true;
      resetSelect(employeeSelect, "Automatski / bilo koji dostupan");
      employeeSelect.disabled = true;
      hidePackageOption();
      return;
    }
    populateVariants(serviceId);
    populateEmployees(serviceId);
    hidePackageOption();
  });

  if (variantSelect) {
    variantSelect.addEventListener("change", checkPackageAvailability);
  }

  if (existingUserToggle) {
    existingUserToggle.addEventListener("change", () => {
      const useExisting = existingUserToggle.checked;
      existingUserField.style.display = useExisting ? "" : "none";
      contactFields.forEach((field) => {
        field.style.display = useExisting ? "none" : "";
      });
      // contact firstName/email are only actually required when there's no
      // existing user to pull them from - an existing user's own record
      // supplies them server-side (see manual-appointment.controller.js)
      contactRequiredInputs.forEach((input) => {
        input.required = !useExisting;
      });
      checkPackageAvailability();
    });
  }

  if (existingUserSelect) {
    existingUserSelect.addEventListener("change", checkPackageAvailability);
  }

  if (overrideToggle) {
    overrideToggle.addEventListener("change", () => {
      overrideField.style.display = overrideToggle.checked ? "" : "none";
      if (priceOverrideInput) priceOverrideInput.required = overrideToggle.checked;
      // mutually exclusive with paying from a package - see bookAppointment's
      // own priceOverride/packagePurchaseId mutual-exclusion check
      if (overrideToggle.checked && packageCheckbox) packageCheckbox.checked = false;
    });
  }

  if (packageCheckbox) {
    packageCheckbox.addEventListener("change", () => {
      if (packageCheckbox.checked && overrideToggle && overrideToggle.checked) {
        overrideToggle.checked = false;
        overrideField.style.display = "none";
        if (priceOverrideInput) priceOverrideInput.required = false;
      }
    });
  }
})();