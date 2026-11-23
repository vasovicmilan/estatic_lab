import QRCode from "qrcode";
import * as employeeService from "../../../services/employee.service.js";
import employeeCardService from "../../../services/employee-card.service.js";
import { generateSeo } from "../../../seo/index.js";
import { logError, logWarn } from "../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../utils/flash.util.js";
import { parseCheckbox } from "../../../utils/form-bool.util.js";
import { deleteUploadedFile } from "../../../utils/file-cleanup.util.js";

const PAGE = "/moj-nalog/vizitka";

async function ownEmployeeId(req) {
  const employee = await employeeService.findEmployeeByUserId(req.session.user.id);
  return employee?._id?.toString() || employee?.id;
}

// pomoćna: ono što je ostalo od prethodnog (neuspešnog) čuvanja forme nije bitno - forma se uvek puni iz baze
export async function cardPage(req, res, next) {
  try {
    const employeeId = await ownEmployeeId(req);
    const editor = await employeeCardService.getEditorData(employeeId);
    const seo = await generateSeo("page", { title: "Moja vizitka", description: "Javna vizitka i QR kod", slug: req.originalUrl, noIndex: true }, req);
    const qrSvg = editor.url ? await QRCode.toString(editor.url, { type: "svg", margin: 2, errorCorrectionLevel: "M", width: 220 }) : null;

    return res.render("employee/card", {
      pageTitle: "Moja vizitka",
      pageDescription: "Javna vizitka i QR kod",
      seo,
      data: { editor, qrSvg, actionUrl: PAGE, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[cardPage] Greška pri učitavanju vizitke", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function saveCard(req, res, next) {
  try {
    if (req.validationErrors) {
      if (req.uploadedFile?.img) await deleteUploadedFile(req.uploadedFile.img);
      logWarn("[saveCard] Validacione greške vizitke", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).flat().join(", "), PAGE);
    }

    const b = req.body;
    const employeeId = await ownEmployeeId(req);

    if (parseCheckbox(b.removePhoto, false) && !req.uploadedFile) await employeeCardService.removeCardPhoto(employeeId);

    await employeeCardService.saveCard(
      employeeId,
      {
        displayName: b.displayName,
        title: b.title,
        bio: b.bio,
        instagram: b.instagram,
        facebook: b.facebook,
        website: b.website,
        isPublic: parseCheckbox(b.isPublic, false),
        show: {
          phone: parseCheckbox(b.showPhone, false),
          email: parseCheckbox(b.showEmail, false),
          bio: parseCheckbox(b.showBio, false),
          instagram: parseCheckbox(b.showInstagram, false),
          facebook: parseCheckbox(b.showFacebook, false),
          website: parseCheckbox(b.showWebsite, false),
          services: parseCheckbox(b.showServices, false),
        },
        categories: b.categories,
        pinnedServices: b.pinnedServices,
        materialId: b.materialId,
      },
      { photo: req.uploadedFile || null, copyExpertPhoto: parseCheckbox(b.copyExpertPhoto, false) }
    );
    return flashAndRedirect(req, res, "success", "Vizitka je sačuvana", PAGE);
  } catch (error) {
    if (req.uploadedFile?.img) await deleteUploadedFile(req.uploadedFile.img);
    logError("[saveCard] Greška pri čuvanju vizitke", error, { userId: req.session?.user?.id });
    if (error.statusCode) return flashAndRedirect(req, res, "error", error.message, PAGE);
    next(error);
  }
}

// svesna akcija - stari QR kodovi i linkovi prestaju da rade
export async function regenerateLink(req, res, next) {
  try {
    if (!parseCheckbox(req.body.confirmRegenerate, false)) {
      return flashAndRedirect(req, res, "error", "Potvrdite da razumete da će stari QR kod prestati da radi", PAGE);
    }
    await employeeCardService.regenerateSlug(await ownEmployeeId(req));
    return flashAndRedirect(req, res, "success", "Novi link je napravljen - preuzmite novi QR kod", PAGE);
  } catch (error) {
    logError("[regenerateLink] Greška pri pravljenju novog linka vizitke", error, { userId: req.session?.user?.id });
    if (error.statusCode) return flashAndRedirect(req, res, "error", error.message, PAGE);
    next(error);
  }
}

export async function qrDownload(req, res, next) {
  try {
    const url = await employeeCardService.getCardUrlForEmployee(await ownEmployeeId(req));
    if (!url) return flashAndRedirect(req, res, "error", "Prvo sačuvajte vizitku", PAGE);
    if (req.params.format === "png") {
      const png = await QRCode.toBuffer(url, { type: "png", margin: 3, errorCorrectionLevel: "M", width: 1200 });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", 'attachment; filename="moja-vizitka-qr.png"');
      return res.send(png);
    }
    const svg = await QRCode.toString(url, { type: "svg", margin: 3, errorCorrectionLevel: "M" });
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Content-Disposition", 'attachment; filename="moja-vizitka-qr.svg"');
    return res.send(svg);
  } catch (error) {
    logError("[qrDownload] Greška pri generisanju QR koda vizitke", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export default { cardPage, saveCard, regenerateLink, qrDownload };
