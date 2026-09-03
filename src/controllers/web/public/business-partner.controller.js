import * as businessPartnerService from "../../../services/business-partner.service.js";
import { prepareBusinessPartnerListData, prepareBusinessPartnerDetailData } from "../../../presenters/public/business-partner.presenter.js";
import { logError } from "../../../utils/logger.util.js";

export async function businessPartnerList(req, res, next) {
  try {
    const result = await businessPartnerService.listPublicBusinessPartners();
    const viewData = prepareBusinessPartnerListData(result.data);

    return res.render("partners/partner-list", {
      pageTitle: result.seo.pageTitle,
      pageDescription: result.seo.pageDescription,
      seo: result.seo,
      data: viewData,
    });
  } catch (error) {
    logError("[businessPartnerList] Greška pri učitavanju liste saradnika", error);
    next(error);
  }
}

export async function businessPartnerDetails(req, res, next) {
  try {
    const { slug } = req.params;
    const result = await businessPartnerService.getPublicBusinessPartnerBySlug(slug);
    const viewData = prepareBusinessPartnerDetailData(result);

    return res.render("partners/partner-details", {
      pageTitle: result.seo.pageTitle,
      pageDescription: result.seo.pageDescription,
      seo: result.seo,
      data: viewData,
    });
  } catch (error) {
    logError("[businessPartnerDetails] Greška pri učitavanju stranice saradnika", error, { slug: req.params.slug });
    next(error);
  }
}

export default { businessPartnerList, businessPartnerDetails };
