(function () {
  // Client-side counterpart of the "day-hours" field used only by
  // admin/marketing/site-settings.ejs's "Radno vreme (prikaz na sajtu)"
  // form - the salon-wide DISPLAY schedule (site-settings.model.js's
  // WorkingHoursDaySchema), not Employee.workingHours (that one keeps using
  // the "schedule" field type / admin-schedule.js, a different, richer shape
  // with multiple add/remove-able shift blocks per day).
  //
  // Deliberately simpler than admin-schedule.js: exactly 7 fixed rows, one
  // per day, that are always present and never added/removed - just a
  // isOpen checkbox plus two "Od"/"Do" time inputs per row. Mirrors
  // admin-schedule.js's own hidden-JSON-sync pattern (same
  // data-repeater-input hookup, same sync-on-every-input/change/submit) so
  // the rest of the stack (parseJsonFields middleware, the validator, the
  // service) sees the exact same shape it already expects.

  function buildDayRow(day, dayData) {
    const wrapper = document.createElement("div");
    // column on phones (checkbox/Od/Do stacked, not squeezed into ~350px),
    // row again from the sm breakpoint up - same reasoning as
    // admin-schedule.js's buildSlotRow.
    wrapper.className = "d-flex flex-column flex-sm-row align-items-sm-end gap-2 mb-2 pb-2 border-bottom";
    wrapper.dataset.dayHoursDay = day.value;

    const isOpen = !!dayData?.isOpen;

    const checkWrap = document.createElement("div");
    checkWrap.className = "form-check flex-fill";
    const checkInput = document.createElement("input");
    checkInput.type = "checkbox";
    checkInput.className = "form-check-input";
    checkInput.checked = isOpen;
    checkInput.dataset.dayHoursOpen = "";
    checkInput.id = `dayHoursOpen-${day.value}`;
    const checkLabel = document.createElement("label");
    checkLabel.className = "form-check-label fw-semibold";
    checkLabel.htmlFor = checkInput.id;
    checkLabel.textContent = day.label;
    checkWrap.appendChild(checkInput);
    checkWrap.appendChild(checkLabel);

    const fromWrap = document.createElement("div");
    fromWrap.className = "flex-fill";
    const fromLabel = document.createElement("label");
    fromLabel.className = "form-label small mb-1";
    fromLabel.textContent = "Od";
    const fromInput = document.createElement("input");
    fromInput.type = "time";
    fromInput.className = "form-control form-control-sm";
    fromInput.dataset.dayHoursFrom = "";
    // keeps whatever time was previously entered even when the day is
    // currently closed - re-opening a day shouldn't force re-typing a time
    // from scratch, same reasoning site-settings.model.js's schema comment
    // gives for keeping from/to populated on a closed day rather than null.
    fromInput.value = dayData?.from || "09:00";
    fromInput.disabled = !isOpen;
    fromWrap.appendChild(fromLabel);
    fromWrap.appendChild(fromInput);

    const toWrap = document.createElement("div");
    toWrap.className = "flex-fill";
    const toLabel = document.createElement("label");
    toLabel.className = "form-label small mb-1";
    toLabel.textContent = "Do";
    const toInput = document.createElement("input");
    toInput.type = "time";
    toInput.className = "form-control form-control-sm";
    toInput.dataset.dayHoursTo = "";
    toInput.value = dayData?.to || "20:00";
    toInput.disabled = !isOpen;
    toWrap.appendChild(toLabel);
    toWrap.appendChild(toInput);

    wrapper.appendChild(checkWrap);
    wrapper.appendChild(fromWrap);
    wrapper.appendChild(toWrap);
    return wrapper;
  }

  function readDay(dayEl) {
    return {
      day: dayEl.dataset.dayHoursDay,
      isOpen: dayEl.querySelector("[data-day-hours-open]").checked,
      from: dayEl.querySelector("[data-day-hours-from]").value,
      to: dayEl.querySelector("[data-day-hours-to]").value,
    };
  }

  function updateDisabledState(dayEl) {
    const isOpen = dayEl.querySelector("[data-day-hours-open]").checked;
    dayEl.querySelector("[data-day-hours-from]").disabled = !isOpen;
    dayEl.querySelector("[data-day-hours-to]").disabled = !isOpen;
  }

  function sync(container) {
    const name = container.dataset.dayHours;
    const dayEls = Array.from(container.querySelectorAll("[data-day-hours-day]"));
    // unlike admin-schedule.js's sync (which drops closed days entirely),
    // this schedule always carries the full 7-day shape - every consumer
    // (footer.ejs, organization.builder.js, the validator/service) expects
    // to index it by day without a "day missing" branch.
    const value = dayEls.map(readDay);

    const hiddenInput = container.parentElement.querySelector(`[data-repeater-input="${name}"]`);
    if (hiddenInput) hiddenInput.value = JSON.stringify(value);
  }

  function init(container) {
    const days = JSON.parse(container.dataset.dayHoursDays || "[]");
    let initialValue = [];
    try {
      initialValue = JSON.parse(container.dataset.dayHoursValue || "[]");
    } catch {
      initialValue = [];
    }

    const rowsContainer = container.querySelector("[data-day-hours-rows]");
    days.forEach((day) => {
      const dayData = initialValue.find((d) => d.day === day.value);
      rowsContainer.appendChild(buildDayRow(day, dayData));
    });

    container.addEventListener("change", (e) => {
      if (e.target.matches("[data-day-hours-open]")) {
        updateDisabledState(e.target.closest("[data-day-hours-day]"));
      }
      sync(container);
    });
    container.addEventListener("input", () => sync(container));

    const form = container.closest("form");
    if (form) form.addEventListener("submit", () => sync(container));

    sync(container);
  }

  document.querySelectorAll("[data-day-hours]").forEach(init);
})();
