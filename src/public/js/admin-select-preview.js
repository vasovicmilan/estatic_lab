(function () {
  function render(panel, info) {
    panel.innerHTML = "";

    if (!info) {
      const empty = document.createElement("span");
      empty.className = "text-muted";
      empty.textContent = "Izaberite paket da vidite šta sadrži.";
      panel.appendChild(empty);
      return;
    }

    const price = document.createElement("div");
    price.className = "fw-semibold mb-1";
    price.textContent = `Cena: ${info.cena}`;
    panel.appendChild(price);

    if (info.stavke && info.stavke.length) {
      const list = document.createElement("ul");
      list.className = "mb-0 ps-3";
      info.stavke.forEach((s) => {
        const item = document.createElement("li");
        item.textContent = s;
        list.appendChild(item);
      });
      panel.appendChild(list);
    }
  }

  function init(select) {
    const name = select.dataset.selectPreview;
    const panel = document.querySelector(`[data-select-preview-panel="${name}"]`);
    if (!panel) return;

    let data = {};
    try {
      data = JSON.parse(panel.dataset.selectPreviewData || "{}");
    } catch {
      data = {};
    }

    select.addEventListener("change", () => render(panel, data[select.value]));
    render(panel, data[select.value]);
  }

  document.querySelectorAll("[data-select-preview]").forEach(init);
})();