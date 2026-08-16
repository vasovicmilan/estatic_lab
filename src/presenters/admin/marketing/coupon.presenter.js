export function prepareCouponListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "kod", label: "Kod" },
      { key: "tip", label: "Tip popusta" },
      { key: "popust", label: "Popust" },
      { key: "maxUpotreba", label: "Max. upotreba" },
      { key: "iskorisceno", label: "Iskorišćeno" },
      { key: "aktivnost", label: "Status" },
      { key: "vaziDo", label: "Važi do" },
    ],
    actions: [
      { type: "view", url: "/admin/kuponi/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/kuponi/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/kuponi/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/kuponi",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kuponi", url: null },
    ],
    topbar: {
      createUrl: "/admin/kuponi/dodavanje",
      createLabel: "Novi kupon",
      searchUrl: "/admin/kuponi/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "isActive",
          label: "Status",
          value: query.isActive || "",
          options: [
            { value: "", label: "Svi" },
            { value: "true", label: "Aktivni" },
            { value: "false", label: "Neaktivni" },
          ],
        },
      ],
    },
  };
}

export function prepareCouponDetailsData(coupon) {
  return {
    backUrl: "/admin/kuponi",
    editUrl: `/admin/kuponi/izmena/${coupon.id}`,
    sections: [
      {
        title: "Osnovni podaci (usluge i paketi)",
        type: "table",
        rows: [
          { label: "Kod", value: coupon.osnovno.kod },
          { label: "Tip", value: coupon.osnovno.tip },
          { label: "Popust", value: coupon.osnovno.popust },
          { label: "Maksimalan iznos popusta", value: coupon.osnovno.maxPopust || "-" },
          { label: "Minimalna vrednost", value: coupon.osnovno.minimalnaVrednost || "-" },
          { label: "Status", value: coupon.osnovno.aktivnost },
        ],
      },
      {
        title: "Popust za artikle (shop)",
        type: "table",
        rows: coupon.proizvodi.aktivno
          ? [
              { label: "Tip", value: coupon.proizvodi.tip },
              { label: "Popust", value: coupon.proizvodi.popust },
              { label: "Maksimalan iznos popusta", value: coupon.proizvodi.maxPopust || "-" },
              { label: "Minimalna vrednost porudžbine", value: coupon.proizvodi.minimalnaVrednostPorudzbine || "-" },
            ]
          : [{ label: "Status", value: "Kupon ne važi za artikle" }],
      },
      {
        title: "Ograničenja",
        type: "table",
        rows: [
          { label: "Max. upotreba (ukupno)", value: coupon.ogranicenja.maxUpotreba },
          { label: "Max. upotreba po korisniku", value: coupon.ogranicenja.maxUpotrebaPoKorisniku },
          { label: "Trenutno iskorišćeno", value: coupon.ogranicenja.trenutnoIskorisceno },
        ],
      },
      {
        title: "Primenljivo na usluge",
        type: "list",
        items: coupon.primenljivoNaUsluge.map((s) => s.naziv || s.id),
      },
      {
        title: "Primenljivo na pakete",
        type: "list",
        items: coupon.primenljivoNaPakete.map((p) => p.naziv || p.id),
      },
      {
        title: "Primenljivo na proizvode",
        type: "list",
        items: coupon.primenljivoNaProizvode.map((p) => p.naziv || p.id),
      },
      {
        title: "Istorija korišćenja",
        type: "table",
        rows: coupon.istorijaKoriscenja.map((u) => ({ label: u.iskoriscenoU, value: `${u.iznosPopusta} (termin ${u.terminId})` })),
      },
    ],
    sidebar: [
      ...(coupon.partner
        ? [
            {
              title: "Partner",
              type: "table",
              rows: [{ label: "Referalni partner", value: coupon.partner.imePrezime }],
            },
          ]
        : []),
      {
        title: "Vreme važenja",
        type: "table",
        rows: [
          { label: "Počinje", value: coupon.vremeVazenja.pocinje || "-" },
          { label: "Ističe", value: coupon.vremeVazenja.istice || "-" },
        ],
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreiran", value: coupon.vreme.kreiran },
          { label: "Poslednje izmenjen", value: coupon.vreme.poslednjeIzmenjen },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kuponi", url: "/admin/kuponi" },
      { label: coupon.osnovno.kod, url: null },
    ],
  };
}

export function prepareCouponFormData(coupon = null, { serviceOptions = [], packageOptions = [], productOptions = [], partnerOptions = [] } = {}) {
  const isEdit = !!coupon;
  const values = isEdit
    ? coupon
    : {
        code: "",
        discountType: "percentage",
        discountValue: 0,
        maxDiscountAmount: null,
        minValue: 0,
        maxUses: null,
        maxUsesPerUser: 1,
        applicableServices: [],
        applicablePackages: [],
        productDiscountEnabled: false,
        productDiscountType: "percentage",
        productDiscountValue: 0,
        productDiscountMaxAmount: null,
        productMinOrderValue: 0,
        applicableProducts: [],
        partner: null,
        validFrom: new Date(),
        validUntil: null,
        isActive: true,
      };

  // Unlike name/slug elsewhere, a coupon code has no auto-generation - it's always a
  // deliberate value the admin chooses, so it's required on both create and edit.
  return {
    formAction: isEdit ? `/admin/kuponi/${coupon.id}` : "/admin/kuponi",
    isEdit,
    fields: [
      { name: "code", label: "Kod", type: "text", required: true, width: 6, value: values.code, help: "Automatski se čuva velikim slovima." },
      {
        name: "discountType",
        label: "Tip popusta (usluge i paketi)",
        type: "select",
        required: true,
        width: 6,
        value: values.discountType,
        options: [
          { value: "percentage", label: "Procenat (%)" },
          { value: "fixed", label: "Fiksni iznos" },
        ],
      },
      { name: "discountValue", label: "Vrednost popusta (usluge i paketi)", type: "number", required: true, min: 0, step: "0.01", width: 6, value: values.discountValue },
      {
        name: "maxDiscountAmount",
        label: "Maksimalan iznos popusta u RSD (opciono)",
        type: "number",
        min: 0,
        step: "0.01",
        width: 6,
        value: values.maxDiscountAmount,
        help: "Bez efekta kod fiksnog tipa. Kod procentualnog popusta sprečava da % ispadne prevelik u RSD.",
      },
      { name: "minValue", label: "Minimalna vrednost (usluge i paketi)", type: "number", min: 0, step: "0.01", width: 6, value: values.minValue },
      { name: "maxUses", label: "Maksimalan broj upotreba (ukupno, opciono)", type: "number", min: 0, width: 6, value: values.maxUses, help: "Ostavite prazno ili unesite 0 za neograničen broj upotreba." },
      { name: "maxUsesPerUser", label: "Maksimalan broj upotreba po korisniku", type: "number", min: 0, width: 6, value: values.maxUsesPerUser, help: "Ostavite prazno ili unesite 0 za neograničen broj upotreba po korisniku." },
      {
        name: "applicableServices",
        label: "Važi samo za usluge (opciono - prazno = sve usluge)",
        type: "multiselect",
        width: 12,
        value: (values.applicableServices || []).map((s) => (typeof s === "object" ? s.id ?? s._id?.toString() : s)),
        options: serviceOptions,
      },
      {
        name: "applicablePackages",
        label: "Važi samo za pakete (opciono - prazno = svi paketi)",
        type: "multiselect",
        width: 12,
        value: (values.applicablePackages || []).map((p) => (typeof p === "object" ? p.id ?? p._id?.toString() : p)),
        options: packageOptions,
      },
      {
        name: "productDiscountEnabled",
        label: "Uključi poseban popust za artikle (shop)",
        type: "checkbox",
        width: 12,
        value: values.productDiscountEnabled,
        help: "Po defaultu OFF - kupon bez ovoga se uopšte ne može iskoristiti na porudžbini artikala. Namerno odvojeno od popusta za usluge/pakete iznad jer je katalog artikala od sitnog potrošnog materijala do skupih uređaja.",
      },
      {
        name: "productDiscountType",
        label: "Tip popusta (artikli)",
        type: "select",
        width: 6,
        value: values.productDiscountType,
        options: [
          { value: "percentage", label: "Procenat (%)" },
          { value: "fixed", label: "Fiksni iznos" },
        ],
        help: "Ignoriše se ako 'Uključi poseban popust za artikle' nije čekirano.",
      },
      { name: "productDiscountValue", label: "Vrednost popusta (artikli)", type: "number", min: 0, step: "0.01", width: 6, value: values.productDiscountValue },
      {
        name: "productDiscountMaxAmount",
        label: "Maksimalan iznos popusta za artikle u RSD (opciono)",
        type: "number",
        min: 0,
        step: "0.01",
        width: 6,
        value: values.productDiscountMaxAmount,
        help: "Preporučeno kod procentualnog popusta ako katalog uključuje skupe uređaje.",
      },
      { name: "productMinOrderValue", label: "Minimalna vrednost porudžbine (artikli)", type: "number", min: 0, step: "0.01", width: 6, value: values.productMinOrderValue },
      {
        name: "applicableProducts",
        label: "Važi samo za proizvode (opciono - prazno = svi proizvodi, ali samo ako je gornji čekboks uključen)",
        type: "multiselect",
        width: 12,
        value: (values.applicableProducts || []).map((p) => (typeof p === "object" ? p.id ?? p._id?.toString() : p)),
        options: productOptions,
      },
      {
        name: "partner",
        label: "Referalni partner (opciono)",
        type: "select",
        width: 6,
        value: values.partner ? (typeof values.partner === "object" ? values.partner.id : values.partner) : "",
        options: [{ value: "", label: "Nije partnerski kupon" }, ...partnerOptions],
        help: "Ako je izabran, korišćenje ovog kupona generiše proviziju za partnera - po odgovarajućoj stopi sa partnerovog profila (usluge/paketi ili artikli, zavisno gde je kupon iskorišćen).",
      },
      {
        name: "validFrom",
        label: "Važi od",
        type: "date",
        width: 6,
        value: values.validFrom ? String(values.validFrom).slice(0, 10) : "",
      },
      {
        name: "validUntil",
        label: "Važi do (opciono - prazno = nikad ne ističe)",
        type: "date",
        width: 6,
        value: values.validUntil ? String(values.validUntil).slice(0, 10) : "",
      },
      { name: "isActive", label: "Aktivan", type: "checkbox", width: 6, value: values.isActive },
    ],
    submitLabel: isEdit ? "Sačuvaj izmene" : "Kreiraj kupon",
    cancelUrl: "/admin/kuponi",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kuponi", url: "/admin/kuponi" },
      { label: isEdit ? "Izmena" : "Novi kupon", url: null },
    ],
  };
}