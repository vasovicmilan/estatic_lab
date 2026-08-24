(function () {
  const data = window.__manualAppointmentData;
  const serviceSelect = document.querySelector("[data-manual-service-select]");
  if (!data || !serviceSelect) return; // not the manual appointment creation form

  const variantSelect = document.querySelector("[data-manual-variant-select]");
  const employeeSelect = document.querySelector("[data-manual-employee-select]");
  const existingUserToggle = document.querySelector("[data-manual-existing-user-toggle]");
  const existingUserField = document.querySelector("[data-manual-existing-user-field]");
  const contactFields = document.querySelectorAll("[data-manual-contact-field]");
  const contactRequiredInputs = document.querySelectorAll("[data-manual-contact-required]");
  const overrideToggle = document.querySelector("[data-manual-override-toggle]");
  const overrideField = document.querySelector("[data-manual-override-field]");
  const priceOverrideInput = document.getElementById("priceOverride");

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

  serviceSelect.addEventListener("change", () => {
    const serviceId = serviceSelect.value;
    if (!serviceId) {
      resetSelect(variantSelect, "Prvo izaberite uslugu");
      variantSelect.disabled = true;
      resetSelect(employeeSelect, "Automatski / bilo koji dostupan");
      employeeSelect.disabled = true;
      return;
    }
    populateVariants(serviceId);
    populateEmployees(serviceId);
  });

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
    });
  }

  if (overrideToggle) {
    overrideToggle.addEventListener("change", () => {
      overrideField.style.display = overrideToggle.checked ? "" : "none";
      if (priceOverrideInput) priceOverrideInput.required = overrideToggle.checked;
    });
  }
})();