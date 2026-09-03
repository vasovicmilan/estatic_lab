import { CAMPAIGN_BLOCK_TYPES } from "../../../models/campaign.model.js";

const INTEREST_OPTIONS = [
  { value: "general", label: "Opšte" },
  { value: "products", label: "Proizvodi" },
  { value: "partnership", label: "Partnerski program" },
];

export function prepareCampaignListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "naslov", label: "Naslov" },
      { key: "predmet", label: "Predmet email-a" },
      { key: "status", label: "Status" },
      { key: "segment", label: "Segment" },
      { key: "zakazanoZa", label: "Zakazano za" },
      { key: "poslatoZa", label: "Poslato" },
      { key: "poslato", label: "Uspešno" },
    ],
    actions: [
      { type: "view", url: "/admin/newsletter/kampanje/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/newsletter/kampanje/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/newsletter/kampanje/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/newsletter/kampanje",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Newsletter", url: "/admin/newsletter" },
      { label: "Kampanje", url: null },
    ],
    topbar: {
      createUrl: "/admin/newsletter/kampanje/dodavanje",
      createLabel: "Nova kampanja",
      searchUrl: "/admin/newsletter/kampanje/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "status",
          label: "Status",
          value: query.status || "",
          options: [
            { value: "", label: "Svi statusi" },
            { value: "draft", label: "Nacrt" },
            { value: "scheduled", label: "Zakazano" },
            { value: "sent", label: "Poslato" },
          ],
        },
      ],
    },
  };
}

export function prepareCampaignDetailsData(campaign) {
  return {
    backUrl: "/admin/newsletter/kampanje",
    editUrl: campaign.statusRaw === "sent" ? null : `/admin/newsletter/kampanje/izmena/${campaign.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Naslov", value: campaign.naslov },
          { label: "Predmet email-a", value: campaign.predmet },
          { label: "Status", value: campaign.status },
          { label: "Segment", value: campaign.segment },
        ],
      },
      {
        title: "Sadržaj",
        type: "blocks",
        blocks: campaign.sadrzaj,
      },
    ],
    sidebar: [
      {
        title: "Slanje",
        type: "custom",
        content: "campaign-send-form",
        data: {
          status: campaign.statusRaw,
          zakazanoZa: campaign.zakazanoZa,
          poslatoZa: campaign.poslatoZa,
          poslato: campaign.poslato,
          neuspesno: campaign.neuspesno,
          sendUrl: `/admin/newsletter/kampanje/${campaign.id}/posalji`,
        },
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreirano", value: campaign.vreme.kreiran },
          { label: "Izmenjeno", value: campaign.vreme.azuriran },
        ],
      },
    ],
  };
}

export function prepareCampaignFormData(campaign = null) {
  const isEdit = !!campaign;
  const values = campaign || {};

  return {
    formAction: isEdit ? `/admin/newsletter/kampanje/${campaign.id}` : "/admin/newsletter/kampanje",
    isEdit,
    fields: [
      {
        name: "title",
        label: "Interni naziv kampanje",
        type: "text",
        width: 12,
        value: values.title || "",
        required: true,
        help: "Vidiš samo ti u admin panelu - ne šalje se pretplatnicima.",
      },
      { name: "subject", label: "Predmet email-a", type: "text", width: 12, value: values.subject || "", required: true },
      {
        name: "targetInterests",
        label: "Segment",
        type: "checkbox-group",
        width: 12,
        value: values.targetInterests || [],
        options: INTEREST_OPTIONS,
        help: "Ništa izabrano = šalje se svim aktivnim pretplatnicima, bez obzira na interesovanja.",
      },
      { name: "content", label: "Sadržaj email-a", type: "content-blocks", width: 12, value: values.content || [], blockTypes: CAMPAIGN_BLOCK_TYPES },
      {
        name: "status",
        label: "Status",
        type: "select",
        width: 6,
        value: values.status || "draft",
        options: [
          { value: "draft", label: "Nacrt" },
          { value: "scheduled", label: "Zakazano" },
        ],
      },
      {
        name: "scheduledFor",
        label: "Zakazano za",
        type: "datetime-local",
        width: 6,
        // mapCampaignForEdit already formats this as "YYYY-MM-DDTHH:mm" in
        // Belgrade wall-clock time (see campaign.mapper.js) - no further
        // conversion here, same as post.presenter.js's identical field.
        value: values.scheduledFor || "",
        help: "Obavezno samo ako je status 'Zakazano'. Kampanja se automatski šalje u ovo vreme, ili ranije ako pritisneš 'Pošalji odmah'.",
      },
    ],
    submitLabel: isEdit ? "Sačuvaj izmene" : "Sačuvaj kao nacrt",
  };
}

export default { prepareCampaignListData, prepareCampaignDetailsData, prepareCampaignFormData };
