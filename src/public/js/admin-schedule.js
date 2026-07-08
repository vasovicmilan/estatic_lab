(function () {
  function buildSlotRow(slot) {
    const row = document.createElement("div");
    row.className = "d-flex align-items-end gap-2 mb-2";
    row.dataset.scheduleSlot = "";

    const fromWrap = document.createElement("div");
    const fromLabel = document.createElement("label");
    fromLabel.className = "form-label small mb-1";
    fromLabel.textContent = "Od";
    const fromInput = document.createElement("input");
    fromInput.type = "time";
    fromInput.className = "form-control form-control-sm";
    fromInput.dataset.scheduleFrom = "";
    fromInput.value = slot?.from || "";
    fromWrap.appendChild(fromLabel);
    fromWrap.appendChild(fromInput);

    const toWrap = document.createElement("div");
    const toLabel = document.createElement("label");
    toLabel.className = "form-label small mb-1";
    toLabel.textContent = "Do";
    const toInput = document.createElement("input");
    toInput.type = "time";
    toInput.className = "form-control form-control-sm";
    toInput.dataset.scheduleTo = "";
    toInput.value = slot?.to || "";
    toWrap.appendChild(toLabel);
    toWrap.appendChild(toInput);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-sm btn-outline-danger";
    removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
    removeBtn.dataset.scheduleRemoveSlot = "";

    row.appendChild(fromWrap);
    row.appendChild(toWrap);
    row.appendChild(removeBtn);
    return row;
  }

  function buildDayRow(day, dayData) {
    const wrapper = document.createElement("div");
    wrapper.className = "border-bottom pb-3 mb-3";
    wrapper.dataset.scheduleDay = day.value;

    const header = document.createElement("div");
    header.className = "d-flex justify-content-between align-items-center mb-2";
    const label = document.createElement("strong");
    label.textContent = day.label;
    header.appendChild(label);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-sm btn-outline-primary";
    addBtn.innerHTML = '<i class="bi bi-plus-lg"></i> Dodaj termin';
    addBtn.dataset.scheduleAddSlot = "";
    header.appendChild(addBtn);
    wrapper.appendChild(header);

    const slotsContainer = document.createElement("div");
    slotsContainer.dataset.scheduleSlots = "";
    (dayData?.slots || []).forEach((slot) => slotsContainer.appendChild(buildSlotRow(slot)));
    wrapper.appendChild(slotsContainer);

    const emptyNotice = document.createElement("small");
    emptyNotice.className = "text-muted";
    emptyNotice.dataset.scheduleEmpty = "";
    emptyNotice.textContent = "Neradni dan";
    emptyNotice.style.display = (dayData?.slots || []).length ? "none" : "";
    wrapper.appendChild(emptyNotice);

    return wrapper;
  }

  function readDay(dayEl) {
    const day = dayEl.dataset.scheduleDay;
    const slotRows = Array.from(dayEl.querySelectorAll("[data-schedule-slot]"));
    const slots = slotRows
      .map((row) => ({
        from: row.querySelector("[data-schedule-from]").value,
        to: row.querySelector("[data-schedule-to]").value,
      }))
      .filter((s) => s.from && s.to);
    return { day, slots };
  }

  function sync(container) {
    const name = container.dataset.schedule;
    const dayEls = Array.from(container.querySelectorAll("[data-schedule-day]"));
    // days with zero slots are dropped entirely rather than sent as {day, slots: []}
    // — an empty entry and a missing entry mean the same thing ("not working that
    // day"), and the validator/service side only ever expects days that have hours.
    const value = dayEls.map(readDay).filter((d) => d.slots.length > 0);
    const hiddenInput = container.parentElement.querySelector(`[data-repeater-input="${name}"]`);
    if (hiddenInput) hiddenInput.value = JSON.stringify(value);
  }

  function updateEmptyNotice(dayEl) {
    const slotsContainer = dayEl.querySelector("[data-schedule-slots]");
    const emptyNotice = dayEl.querySelector("[data-schedule-empty]");
    if (emptyNotice) emptyNotice.style.display = slotsContainer.children.length ? "none" : "";
  }

  function init(container) {
    const days = JSON.parse(container.dataset.scheduleDays || "[]");
    let initialValue = [];
    try {
      initialValue = JSON.parse(container.dataset.scheduleValue || "[]");
    } catch {
      initialValue = [];
    }

    const daysList = container.querySelector("[data-schedule-days-list]");
    days.forEach((day) => {
      const dayData = initialValue.find((d) => d.day === day.value);
      daysList.appendChild(buildDayRow(day, dayData));
    });

    daysList.addEventListener("click", (e) => {
      const dayEl = e.target.closest("[data-schedule-day]");
      if (!dayEl) return;

      if (e.target.closest("[data-schedule-add-slot]")) {
        dayEl.querySelector("[data-schedule-slots]").appendChild(buildSlotRow(null));
        updateEmptyNotice(dayEl);
        sync(container);
      } else if (e.target.closest("[data-schedule-remove-slot]")) {
        e.target.closest("[data-schedule-slot]").remove();
        updateEmptyNotice(dayEl);
        sync(container);
      }
    });

    container.addEventListener("input", () => sync(container));
    container.addEventListener("change", () => sync(container));
    const form = container.closest("form");
    if (form) form.addEventListener("submit", () => sync(container));

    sync(container);
  }

  document.querySelectorAll("[data-schedule]").forEach(init);
})();