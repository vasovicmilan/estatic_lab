/**
 * Graditelj za /admin/sajt/sadrzaj/:section (views/admin/marketing/site-content.ejs).
 *
 * Dva tipa složenih polja, oba se čuvaju kao JSON string u skrivenom input-u
 * pored kontejnera (kontroler ih parsira u buildSectionPayload):
 *
 *   [data-sc-items]    lista objekata sa fiksnim poljima (FAQ, koraci, kartice...)
 *                      data-sc-schema = [{name,label,type,rows,placeholder,help}]
 *   [data-sc-sections] sekcije pravnih/informativnih stranica:
 *                      { title, paragraphs[], list[], closingParagraphs[], subsections[] }
 *                      (pod-sekcije samo jedan nivo dubine, kao i na javnoj stranici)
 *
 * Nizovi stringova (paragraphs/list/closingParagraphs) se u formi unose kao
 * textarea, jedan red = jedna stavka.
 */
(function () {
  function el(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (key) {
      if (key === "className") node.className = props[key];
      else if (key === "text") node.textContent = props[key];
      else if (key === "dataset") Object.keys(props.dataset).forEach(function (d) { node.dataset[d] = props.dataset[d]; });
      else node.setAttribute(key, props[key]);
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function parseJson(text, fallback) {
    try {
      var parsed = JSON.parse(text || "");
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function toLines(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map(function (line) { return line.trim(); })
      .filter(Boolean);
  }

  function fromLines(value) {
    return Array.isArray(value) ? value.join("\n") : "";
  }

  function labelled(labelText, control, help) {
    var wrap = el("div", { className: "mb-2" }, [el("label", { className: "form-label small mb-1", text: labelText }), control]);
    if (help) wrap.appendChild(el("small", { className: "text-muted d-block mt-1", text: help }));
    return wrap;
  }

  function textControl(field, value) {
    var control;
    if (field.type === "textarea") {
      control = el("textarea", { className: "form-control form-control-sm", rows: String(field.rows || 3) });
    } else {
      control = el("input", { className: "form-control form-control-sm", type: "text" });
    }
    control.value = value == null ? "" : value;
    if (field.placeholder) control.placeholder = field.placeholder;
    return control;
  }

  function moveControls(onUp, onDown, onRemove) {
    function btn(icon, label, cls, handler) {
      var b = el("button", { type: "button", className: "btn btn-sm " + cls, "aria-label": label, title: label }, [
        el("i", { className: "bi " + icon }),
      ]);
      b.addEventListener("click", handler);
      return b;
    }
    return el("div", { className: "btn-group btn-group-sm", role: "group" }, [
      btn("bi-arrow-up", "Pomeri gore", "btn-outline-secondary", onUp),
      btn("bi-arrow-down", "Pomeri dole", "btn-outline-secondary", onDown),
      btn("bi-trash", "Ukloni", "btn-outline-danger", onRemove),
    ]);
  }

  function moveNode(node, direction) {
    var parent = node.parentElement;
    if (!parent) return;
    if (direction < 0 && node.previousElementSibling) parent.insertBefore(node, node.previousElementSibling);
    if (direction > 0 && node.nextElementSibling) parent.insertBefore(node.nextElementSibling, node);
  }

  // ---------------------------------------------------------------- items

  function initItems(container) {
    var schema = parseJson(container.dataset.scSchema, []);
    var input = container.parentElement.querySelector('[data-sc-input="' + container.dataset.scItems + '"]');
    var rowsBox = container.querySelector("[data-sc-rows]");
    var empty = container.querySelector("[data-sc-empty]");

    function sync() {
      var rows = Array.prototype.slice.call(rowsBox.children);
      var value = rows.map(function (row) {
        var obj = {};
        schema.forEach(function (field) {
          var control = row.querySelector('[data-sc-field="' + field.name + '"]');
          obj[field.name] = control ? control.value : "";
        });
        return obj;
      });
      input.value = JSON.stringify(value);
      if (empty) empty.style.display = rows.length ? "none" : "";
      Array.prototype.forEach.call(rowsBox.children, function (row, index) {
        var num = row.querySelector("[data-sc-index]");
        if (num) num.textContent = "#" + (index + 1);
      });
    }

    function buildRow(data) {
      var row = el("div", { className: "border rounded p-3 mb-2 bg-body" });
      var head = el("div", { className: "d-flex justify-content-between align-items-center mb-2" }, [
        el("span", { className: "small text-muted fw-bold", dataset: { scIndex: "" } }),
        moveControls(
          function () { moveNode(row, -1); sync(); },
          function () { moveNode(row, 1); sync(); },
          function () { row.remove(); sync(); }
        ),
      ]);
      row.appendChild(head);

      var grid = el("div", { className: "row g-2" });
      schema.forEach(function (field) {
        var control = textControl(field, data ? data[field.name] : "");
        control.dataset.scField = field.name;
        var col = el("div", { className: field.type === "textarea" ? "col-12" : "col-md-6" });
        col.appendChild(labelled(field.label + (field.required ? " *" : ""), control, field.help));
        grid.appendChild(col);
      });
      row.appendChild(grid);
      return row;
    }

    (parseJson(container.dataset.scValue, [])).forEach(function (item) {
      rowsBox.appendChild(buildRow(item));
    });

    container.querySelector("[data-sc-add]").addEventListener("click", function () {
      var row = buildRow(null);
      rowsBox.appendChild(row);
      sync();
      var first = row.querySelector("input, textarea");
      if (first) first.focus();
    });

    container.addEventListener("input", sync);
    container.addEventListener("change", sync);
    var form = container.closest("form");
    if (form) form.addEventListener("submit", sync);
    sync();
  }

  // ------------------------------------------------------------- sections

  function buildSection(data, isSub, onChange) {
    var card = el("div", { className: (isSub ? "border-start border-2 ps-3 mb-3" : "border rounded p-3 mb-3 bg-body") });
    var sectionIndex = el("span", { className: "small text-muted fw-bold", dataset: { scIndex: "" } });
    card.appendChild(
      el("div", { className: "d-flex justify-content-between align-items-center mb-2" }, [
        sectionIndex,
        moveControls(
          function () { moveNode(card, -1); onChange(); },
          function () { moveNode(card, 1); onChange(); },
          function () { card.remove(); onChange(); }
        ),
      ])
    );

    var title = textControl({ type: "text", placeholder: isSub ? "Naslov pod-sekcije" : "Naslov sekcije" }, data && data.title);
    title.dataset.scPart = "title";
    card.appendChild(labelled((isSub ? "Naslov pod-sekcije" : "Naslov sekcije") + " *", title));

    [
      ["paragraphs", "Paragrafi (jedan paragraf po redu)", 4],
      ["list", "Lista (jedna stavka po redu)", 3],
      ["closingParagraphs", "Zaključni paragrafi (jedan po redu)", 2],
    ].forEach(function (part) {
      var area = textControl({ type: "textarea", rows: part[2] }, fromLines(data && data[part[0]]));
      area.dataset.scPart = part[0];
      card.appendChild(labelled(part[1], area));
    });

    if (!isSub) {
      var subBox = el("div", { className: "mt-2", dataset: { scPart: "subsections" } });
      var subRows = el("div", { dataset: { scSubRows: "" } });
      ((data && data.subsections) || []).forEach(function (sub) {
        subRows.appendChild(buildSection(sub, true, onChange));
      });
      var addSub = el("button", { type: "button", className: "btn btn-sm btn-outline-secondary" }, [
        el("i", { className: "bi bi-plus-lg me-1" }),
        document.createTextNode("Dodaj pod-sekciju"),
      ]);
      addSub.addEventListener("click", function () {
        subRows.appendChild(buildSection(null, true, onChange));
        onChange();
      });
      subBox.appendChild(subRows);
      subBox.appendChild(addSub);
      card.appendChild(subBox);
    }
    return card;
  }

  function readSection(card, isSub) {
    var out = { title: card.querySelector(':scope > .mb-2 [data-sc-part="title"]').value };
    ["paragraphs", "list", "closingParagraphs"].forEach(function (part) {
      out[part] = toLines(card.querySelector(':scope > .mb-2 [data-sc-part="' + part + '"]').value);
    });
    if (!isSub) {
      var subRows = card.querySelector("[data-sc-sub-rows]");
      out.subsections = Array.prototype.map.call(subRows.children, function (subCard) {
        return readSection(subCard, true);
      });
    }
    return out;
  }

  function initSections(container) {
    var input = container.parentElement.querySelector('[data-sc-input="' + container.dataset.scSections + '"]');
    var rowsBox = container.querySelector("[data-sc-rows]");
    var empty = container.querySelector("[data-sc-empty]");

    function sync() {
      var cards = Array.prototype.slice.call(rowsBox.children);
      input.value = JSON.stringify(cards.map(function (card) { return readSection(card, false); }));
      if (empty) empty.style.display = cards.length ? "none" : "";
      cards.forEach(function (card, index) {
        var num = card.querySelector("[data-sc-index]");
        if (num) num.textContent = "Sekcija " + (index + 1);
        var subs = card.querySelector("[data-sc-sub-rows]");
        if (subs) {
          Array.prototype.forEach.call(subs.children, function (sub, subIndex) {
            var subNum = sub.querySelector("[data-sc-index]");
            if (subNum) subNum.textContent = "Pod-sekcija " + (index + 1) + "." + (subIndex + 1);
          });
        }
      });
    }

    parseJson(container.dataset.scValue, []).forEach(function (section) {
      rowsBox.appendChild(buildSection(section, false, sync));
    });

    container.querySelector("[data-sc-add]").addEventListener("click", function () {
      var card = buildSection(null, false, sync);
      rowsBox.appendChild(card);
      sync();
      var first = card.querySelector("input");
      if (first) first.focus();
    });

    container.addEventListener("input", sync);
    container.addEventListener("change", sync);
    var form = container.closest("form");
    if (form) form.addEventListener("submit", sync);
    sync();
  }

  document.querySelectorAll("[data-sc-items]").forEach(initItems);
  document.querySelectorAll("[data-sc-sections]").forEach(initSections);
})();
