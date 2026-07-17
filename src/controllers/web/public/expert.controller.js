import * as expertService from "../../../services/expert.service.js";
import { prepareExpertListData, prepareExpertDetailData } from "../../../presenters/public/expert.presenter.js";
import { generateSeo } from "../../../seo/index.js";
import { logError } from "../../../utils/logger.util.js";

export async function expertList(req, res, next) {
  try {
    const experts = await expertService.getActiveExperts();
    const viewData = prepareExpertListData(experts);
    const seo = await generateSeo("page", { title: "Naš tim", description: "Upoznajte stručnjake Estetik Lab wellness centra.", slug: "/nas-tim" }, req);

    return res.render("landing/team", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[expertList] Greška pri učitavanju liste eksperata", error);
    next(error);
  }
}

export async function expertDetails(req, res, next) {
  try {
    const { slug } = req.params;
    const expert = await expertService.getExpertBySlug(slug);
    const viewData = prepareExpertDetailData(expert);
    const seo = await generateSeo("expert", expert, req);

    return res.render("landing/expert-details", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[expertDetails] Greška pri učitavanju profila eksperta", error, { slug: req.params.slug });
    next(error);
  }
}

export default { expertList, expertDetails };
