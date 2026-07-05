export function requireImageDescIfUploaded(getUploadedFile) {
  return (value, { req }) => {
    const uploaded = getUploadedFile(req);
    if (uploaded && !value?.trim()) {
      throw new Error("Opis slike (alt tekst) je obavezan kada se dodaje nova slika");
    }
    return true;
  };
}

export default { requireImageDescIfUploaded };