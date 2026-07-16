export function prepareMediaFormData(entity, { entityLabel, backUrl, submitUrl, listUrl, listLabel }) {
  return {
    id: entity.id,
    name: entity.name,
    entityLabel,
    backUrl,
    submitUrl,
    image: entity.image || null,
    gallery: entity.gallery || [],
    videos: entity.videos || [],
    breadcrumbs: listUrl
      ? [
          { label: listLabel, url: listUrl },
          { label: entity.name, url: backUrl },
          { label: "Galerija i video", url: null },
        ]
      : [],
  };
}

export default { prepareMediaFormData };