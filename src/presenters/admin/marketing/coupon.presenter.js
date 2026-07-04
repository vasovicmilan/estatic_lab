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
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Kod", value: coupon.osnovno.kod },
          { label: "Tip", value: coupon.osnovno.tip },
          { label: "Popust", value: coupon.osnovno.popust },
          { label: "Minimalna vrednost termina", value: coupon.osnovno.minimalnaVrednostTermina || "-" },
          { label: "Status", value: coupon.osnovno.aktivnost },
        ],
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
        title: "Istorija korišćenja",
        type: "table",
        rows: coupon.istorijaKoriscenja.map((u) => ({ label: u.iskoriscenoU, value: `${u.iznosPopusta} (termin ${u.terminId})` })),
      },
    ],
    sidebar: [
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

export function prepareCouponFormData(coupon = null, { serviceOptions = [] } = {}) {
  const isEdit = !!coupon;

  return {
    formAction: isEdit ? `/admin/kuponi/izmena/${coupon.id}` : "/admin/kuponi/dodavanje",
    isEdit,
    formType: "coupon",
    backUrl: "/admin/kuponi",
    formData: isEdit
      ? coupon
      : {
          code: "",
          discountType: "percentage",
          discountValue: 0,
          minAppointmentValue: 0,
          maxUses: null,
          maxUsesPerUser: 1,
          applicableServices: [],
          validFrom: new Date(),
          validUntil: null,
          isActive: true,
        },
    serviceOptions,
    discountTypes: [
      { value: "percentage", label: "Procenat" },
      { value: "fixed", label: "Fiksni iznos" },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kuponi", url: "/admin/kuponi" },
      { label: isEdit ? "Izmena" : "Novi kupon", url: null },
    ],
  };
}
