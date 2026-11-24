import apiTokenService from "../../../../services/api-token.service.js";
import { TOKEN_SCOPES, TOKEN_MIN_DAYS, TOKEN_MAX_DAYS } from "../../../../models/api-token.model.js";
import { logError } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { parseCheckbox } from "../../../../utils/form-bool.util.js";
import { normalizeError } from "../../../../utils/error.util.js";

const PAGE = "/admin/api-tokeni";

export const SCOPE_LABELS = {
  blog: "Blog (nacrti postova + slike)",
  catalog: "Katalog (usluge, paketi, proizvodi + slike)",
  materials: "Materijali (PDF, katalozi, brošure)",
};

async function renderPage(req, res, extra = {}, status = 200) {
  const [tokens, accounts, state] = await Promise.all([
    apiTokenService.listApiTokens(),
    apiTokenService.listAssistantAccounts(),
    apiTokenService.getApiAccessState(),
  ]);
  return res.status(status).render("admin/api-tokens", {
    pageTitle: "API tokeni (Claude asistent)",
    pageDescription: "Pristup asistenta sistemu: pravljenje, rok važenja, opoziv i pauza",
    data: {
      tokens,
      accounts,
      state,
      scopes: TOKEN_SCOPES.map((value) => ({ value, label: SCOPE_LABELS[value] })),
      limits: { min: TOKEN_MIN_DAYS, max: TOKEN_MAX_DAYS },
      csrfToken: res.locals.csrfToken,
      breadcrumbs: [{ label: "API tokeni" }],
      ...extra,
    },
  });
}

export async function listTokens(req, res, next) {
  try {
    return await renderPage(req, res);
  } catch (error) {
    logError("[listTokens] Greška pri učitavanju API tokena", error);
    next(error);
  }
}

export async function createToken(req, res, next) {
  try {
    const scopes = [].concat(req.body.scopes || []);
    const { token, record } = await apiTokenService.createApiToken({
      name: req.body.name,
      userId: req.body.userId,
      scopes,
      days: Number(req.body.days),
      actor: req.session?.user,
    });
    // jedino mesto gde se tajna vidi; ne ide u flash, redirect ni log
    res.set("Cache-Control", "no-store");
    return await renderPage(req, res, { newToken: { secret: token, name: record.name, expiresAt: record.expiresAt } });
  } catch (error) {
    logError("[createToken] Greška pri pravljenju API tokena", error);
    const { statusCode, message } = normalizeError(error);
    if (statusCode === 400 || statusCode === 404) return flashAndRedirect(req, res, "error", message, PAGE);
    next(error);
  }
}

export async function revokeToken(req, res, next) {
  try {
    if (req.validationErrors) return flashAndRedirect(req, res, "error", "Neispravan token.", PAGE);
    await apiTokenService.revokeApiToken(req.params.tokenId, req.session?.user);
    return flashAndRedirect(req, res, "success", "Token je opozvan i više ne radi.", PAGE);
  } catch (error) {
    logError("[revokeToken] Greška pri opozivu tokena", error, { tokenId: req.params.tokenId });
    const { statusCode, message } = normalizeError(error);
    if (statusCode) return flashAndRedirect(req, res, "error", message, PAGE);
    next(error);
  }
}

export async function setPause(req, res, next) {
  try {
    const paused = parseCheckbox(req.body.paused, false);
    await apiTokenService.setApiAccessPaused(paused, req.session?.user);
    return flashAndRedirect(req, res, "success", paused ? "Svi tokeni su pauzirani." : "Pristup tokenima je ponovo uključen.", PAGE);
  } catch (error) {
    logError("[setPause] Greška pri promeni pauze", error);
    next(error);
  }
}

export default { listTokens, createToken, revokeToken, setPause };
