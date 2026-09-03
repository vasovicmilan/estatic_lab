import { BLOG_BLOCK_TYPES } from "../../../models/schemas/content.blog.schema.js";

export function prepareBusinessPartnerListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "slika", label: "Slika", type: "image" },
      { key: "naziv", label: "Naziv" },
      { key: "aktivan", label: "Aktivan" },
      { key: "kreirano", label: "Kreirano" },
    ],
    actions: [
      { type: "view", url: "/admin/saradnici/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/saradnici/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/saradnici/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/saradnici",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Saradnici", url: null },
    ],
    topbar: {
      createUrl: "/admin/saradnici/dodavanje",
      createLabel: "Novi saradnik",
      searchUrl: "/admin/saradnici/pretraga",
      search: query.search || "",
    },
  };
}

export function prepareBusinessPartnerDetailsData(partner) {
  return {
    backUrl: "/admin/saradnici",
    editUrl: `/admin/saradnici/izmena/${partner.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Naziv", value: partner.naziv },
          { label: "Slug", value: partner.slug },
          { label: "Kratak opis", value: partner.kratakOpis },
          { label: "Aktivan", value: partner.aktivan ? "Da" : "Ne" },
          { label: "Adresa", value: partner.adresa || "-" },
          { label: "Link ka prodavnici", value: `<a href="${partner.outboundUrl}" target="_blank" rel="noopener">${partner.outboundUrl}</a>` },
          { label: "Tekst dugmeta", value: partner.ctaLabel },
        ],
      },
      {
        title: "Naslovna slika",
        type: "custom",
        content: partner.slika ? `<img src="${partner.slika.url}" alt="${partner.slika.alt || ""}" width="200" class="img-fluid rounded">` : "Nema slike",
      },
      ...(partner.imaMapu
        ? [
            {
              title: "Lokacija",
              type: "custom",
              content: `<iframe src="https://www.google.com/maps?q=${partner.geo.latitude},${partner.geo.longitude}&output=embed" width="100%" height="250" style="border:0" loading="lazy"></iframe>`,
            },
          ]
        : []),
      {
        title: "Sadržaj",
        type: "blocks",
        blocks: partner.sadrzaj,
      },
    ],
    sidebar: [
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreirano", value: partner.vreme.kreiran },
          { label: "Izmenjeno", value: partner.vreme.azuriran },
        ],
      },
    ],
  };
}

export function prepareBusinessPartnerFormData(partner = null) {
  const isEdit = !!partner;
  const values = isEdit ? partner : { name: "", shortDescription: "", content: [], address: "", latitude: "", longitude: "", outboundUrl: "", ctaLabel: "Poseti prodavnicu", isActive: true };

  const fields = [{ name: "name", label: "Naziv", type: "text", required: true, width: isEdit ? 6 : 12, value: values.name }];

  if (isEdit) {
    fields.push({
      name: "slug",
      label: "Slug",
      type: "text",
      required: true,
      width: 6,
      value: values.slug,
      help: "Menjajte pažljivo - postojeći linkovi ka ovoj stranici mogu prestati da rade.",
    });
  }

  fields.push(
    {
      name: "shortDescription",
      label: "Kratak opis",
      type: "textarea",
      rows: 2,
      required: true,
      width: 12,
      value: values.shortDescription,
      help: "Prikazuje se na listi svih saradnika. Najviše 300 karaktera.",
    },
    {
      name: "content",
      label: "Sadržaj stranice",
      type: "content-blocks",
      width: 12,
      value: values.content || [],
      blockTypes: BLOG_BLOCK_TYPES,
    },
    {
      name: "coverImage",
      label: "Naslovna slika",
      type: "file",
      accept: "image/*",
      required: !isEdit,
      width: 6,
      // mapBusinessPartnerForEdit passes the raw {img, imgDesc} shape through
      // as-is (not {url, alt}) - .img is the actual field name to preview from.
      preview: isEdit ? values.coverImage?.img : null,
    },
    { name: "coverImageDesc", label: "Opis slike (alt tekst)", type: "text", width: 6, required: true, value: values.coverImage?.imgDesc || "" },
    { name: "address", label: "Adresa", type: "text", width: 12, value: values.address || "" },
    {
      name: "latitude",
      label: "Geografska širina (latitude)",
      type: "number",
      step: "any",
      width: 6,
      value: values.latitude,
      help: "Kako doći do ovih brojeva: otvorite Google Maps, pretražite adresu, desni klik na tačnu lokaciju na mapi - prvi broj koji se pojavi u meniju (npr. 45.267136) je širina, kopirajte ga ovde. Ostavite oba polja prazna ako ne želite mapu na stranici.",
    },
    {
      name: "longitude",
      label: "Geografska dužina (longitude)",
      type: "number",
      step: "any",
      width: 6,
      value: values.longitude,
      help: "Drugi broj iz istog menija (npr. 19.833549, posle zareza) je dužina.",
    },
    { name: "outboundUrl", label: "Link ka prodavnici saradnika", type: "text", required: true, width: 8, value: values.outboundUrl || "", help: "Pun link, uključujući vaš referalni kod ako ga saradnik koristi." },
    { name: "ctaLabel", label: "Tekst dugmeta", type: "text", width: 4, value: values.ctaLabel || "Poseti prodavnicu" },
    { name: "isActive", label: "Aktivan (vidljiv na sajtu)", type: "checkbox", width: 6, value: values.isActive }
  );

  return {
    formAction: isEdit ? `/admin/saradnici/${partner.id}` : "/admin/saradnici",
    isEdit,
    formEnctype: "multipart/form-data",
    fields,
    submitLabel: isEdit ? "Sačuvaj izmene" : "Kreiraj saradnika",
  };
}

export default { prepareBusinessPartnerListData, prepareBusinessPartnerDetailsData, prepareBusinessPartnerFormData };
