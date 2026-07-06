(function () {
  function initMultiselect(container) {
    const fieldName = container.getAttribute("data-multiselect-name");
    const source = container.querySelector("[data-multiselect-source]");
    const addBtn = container.querySelector("[data-multiselect-add]");
    const list = container.querySelector("[data-multiselect-list]");
    const emptyHint = container.querySelector("[data-multiselect-empty]");

    function currentValues() {
      return Array.from(list.querySelectorAll("[data-multiselect-chip]")).map((chip) => chip.getAttribute("data-value"));
    }

    function toggleEmptyHint() {
      if (!emptyHint) return;
      emptyHint.style.display = list.querySelectorAll("[data-multiselect-chip]").length === 0 ? "" : "none";
    }

    function addChip(value, label) {
      if (currentValues().includes(value)) return; // no duplicates

      const chip = document.createElement("span");
      chip.className = "badge text-bg-light border d-inline-flex align-items-center gap-1 py-2 px-2";
      chip.setAttribute("data-multiselect-chip", "");
      chip.setAttribute("data-value", value);
      chip.appendChild(document.createTextNode(`${label} `));

      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = `${fieldName}[]`;
      hidden.value = value;
      chip.appendChild(hidden);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-close";
      removeBtn.style.fontSize = "0.6rem";
      removeBtn.setAttribute("aria-label", "Ukloni");
      removeBtn.setAttribute("data-multiselect-remove", "");
      chip.appendChild(removeBtn);

      list.appendChild(chip);
      toggleEmptyHint();
    }

    addBtn.addEventListener("click", () => {
      const option = source.options[source.selectedIndex];
      if (!option || !option.value) return;
      addChip(option.value, option.textContent.trim());
      source.selectedIndex = 0;
    });

    list.addEventListener("click", (event) => {
      const removeBtn = event.target.closest("[data-multiselect-remove]");
      if (!removeBtn) return;
      const chip = removeBtn.closest("[data-multiselect-chip]");
      if (chip) chip.remove();
      toggleEmptyHint();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-multiselect]").forEach(initMultiselect);
  });
})();