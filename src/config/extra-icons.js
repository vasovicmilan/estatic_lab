// Ikonice koje se u bazi (Service.features[].icon, kategorije...) koriste kao podatak,
// pa se ne pojavljuju kao literal u .ejs/.js fajlovima. `npm run build:icons` skenira
// ceo src/ direktorijum, pa se ovde navode da bi ušle u subset fonta.
// Kad u adminu upišeš novu bi-* ikonicu, dodaj je ovde i ponovo pokreni `npm run build:icons`.
export const EXTRA_ICON_CLASSES = [
  "bi-snow", // ICE hlađenje (LaseSmooth laserska epilacija)
  "bi-lightning-charge",
  "bi-gift",
  "bi-patch-check",
  "bi-bullseye",
  "bi-droplet",
  "bi-stars",
];
