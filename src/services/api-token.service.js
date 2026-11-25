import crypto from "node:crypto";
import apiTokenRepo from "../repositories/api-token.repository.js";
import userRepo from "../repositories/user.repository.js";
import Role from "../models/role.model.js";
import User from "../models/user.model.js";
import { sha256 } from "./crypto.service.js";
import { TOKEN_SCOPES, TOKEN_MIN_DAYS, TOKEN_MAX_DAYS } from "../models/api-token.model.js";
import { AuthenticationError, badRequest, notFound } from "../utils/error.util.js";
import auditLogService from "./audit-log.service.js";
import { logInfo } from "../utils/logger.util.js";

export const TOKEN_PREFIX = "elk_";

// Koje dozvole role token uopšte može da iskoristi, po oblasti. Presek sa rolom: ako rola nema
// dozvolu, oblast ne pomaže; ako oblast nije izabrana, dozvola iz role se ne koristi.
export const SCOPE_PERMISSIONS = {
  blog: ["manage_blog", "manage_taxonomy"],
  catalog: ["manage_services", "manage_packages", "manage_products", "manage_resources", "manage_taxonomy"],
  materials: ["manage_marketing"],
  site: ["manage_site_content"],
};

// Token nikad ne sme da nosi nalog sa ovim rolama, bez obzira na izbor oblasti.
const FORBIDDEN_ROLE_NAMES = new Set(["admin"]);

const PAUSE_CACHE_MS = 5000;
let pauseCache = { value: false, at: 0 };

export function invalidatePauseCache() {
  pauseCache = { value: false, at: 0 };
}

export async function isPaused() {
  const now = Date.now();
  if (now - pauseCache.at < PAUSE_CACHE_MS) return pauseCache.value;
  const state = await apiTokenRepo.getAccessState();
  pauseCache = { value: !!state?.paused, at: now };
  return pauseCache.value;
}

export function effectivePermissions(rolePermissions = [], scopes = []) {
  const allowed = new Set(["access_admin_panel"]);
  for (const scope of scopes) for (const p of SCOPE_PERMISSIONS[scope] || []) allowed.add(p);
  return rolePermissions.filter((p) => allowed.has(p));
}

export function looksLikeApiToken(raw) {
  return typeof raw === "string" && raw.startsWith(TOKEN_PREFIX);
}

/**
 * Pravi token. Sirova tajna se vraća SAMO ovde (jednom) i nigde se ne čuva.
 * @returns {{ token: string, record: object }}
 */
export async function createApiToken({ name, userId, scopes, days, actor }) {
  const cleanName = String(name || "").trim();
  if (!cleanName) badRequest("Naziv tokena je obavezan.");

  const cleanScopes = [...new Set(Array.isArray(scopes) ? scopes : [])].filter((s) => TOKEN_SCOPES.includes(s));
  if (cleanScopes.length === 0) badRequest("Izaberite bar jednu oblast.");

  const dayCount = Number(days);
  if (!Number.isInteger(dayCount) || dayCount < TOKEN_MIN_DAYS || dayCount > TOKEN_MAX_DAYS) {
    badRequest(`Rok važenja mora biti ceo broj dana od ${TOKEN_MIN_DAYS} do ${TOKEN_MAX_DAYS}.`);
  }

  const user = await userRepo.findUserById(userId, { populateFields: ["role"] });
  if (!user) notFound("Korisnik");
  if (user.status !== "active") badRequest("Nalog za token mora biti aktivan.");
  if (FORBIDDEN_ROLE_NAMES.has(user.role?.name)) badRequest("Token ne može da koristi nalog sa rolom administratora.");

  const secret = TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url");
  const record = await apiTokenRepo.createToken({
    name: cleanName,
    user: user._id,
    tokenHash: sha256(secret),
    prefix: secret.slice(0, 8),
    scopes: cleanScopes,
    expiresAt: new Date(Date.now() + dayCount * 24 * 60 * 60 * 1000),
    createdBy: actor?.id,
  });

  logInfo("API token created", { tokenId: record._id.toString(), userId: user._id.toString() });
  await auditLogService.recordAuditLog({
    actor,
    action: "API_TOKEN_CREATED",
    entity: { type: "ApiToken", id: record._id },
    changes: { name: cleanName, scopes: cleanScopes, expiresAt: record.expiresAt, user: user.email },
  });
  return { token: secret, record: record.toObject() };
}

export async function listApiTokens() {
  const tokens = await apiTokenRepo.listTokens();
  const now = Date.now();
  return tokens.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    prefix: t.prefix,
    scopes: t.scopes,
    userEmail: t.user?.email || "(obrisan nalog)",
    expiresAt: t.expiresAt,
    revokedAt: t.revokedAt,
    lastUsedAt: t.lastUsedAt,
    lastUsedIp: t.lastUsedIp,
    createdAt: t.createdAt,
    status: t.revokedAt ? "revoked" : new Date(t.expiresAt).getTime() <= now ? "expired" : "active",
  }));
}

/** Aktivni nalozi sa rolom "claude asistent" - jedini koji se nude pri pravljenju tokena. */
export async function listAssistantAccounts() {
  const role = await Role.findOne({ name: "claude asistent" }).select("_id").lean();
  if (!role) return [];
  const users = await User.find({ role: role._id, status: "active" }).select("firstName lastName email").lean();
  return users.map((u) => ({ id: u._id.toString(), label: `${[u.firstName, u.lastName].filter(Boolean).join(" ") || "Asistent"} (${u.email})` }));
}

/** Menja oblasti AKTIVNOG tokena (tajna ostaje ista). Dozvole role i dalje ograničavaju presek. */
export async function updateApiTokenScopes(tokenId, scopes, actor) {
  const clean = [...new Set(Array.isArray(scopes) ? scopes : [])].filter((s) => TOKEN_SCOPES.includes(s));
  if (clean.length === 0) badRequest("Izaberite bar jednu oblast.");
  const existing = await apiTokenRepo.findTokenById(tokenId);
  if (!existing || existing.revokedAt || new Date(existing.expiresAt).getTime() <= Date.now()) notFound("Aktivan token");
  const updated = await apiTokenRepo.updateScopes(tokenId, clean);
  await auditLogService.recordAuditLog({
    actor,
    action: "API_TOKEN_UPDATED",
    entity: { type: "ApiToken", id: tokenId },
    changes: { scopes: { old: existing.scopes, new: clean } },
  });
  return updated;
}

export async function revokeApiToken(tokenId, actor) {
  const revoked = await apiTokenRepo.revokeToken(tokenId, actor?.id);
  if (!revoked) notFound("Aktivan token");
  await auditLogService.recordAuditLog({
    actor,
    action: "API_TOKEN_REVOKED",
    entity: { type: "ApiToken", id: tokenId },
    changes: { name: revoked.name },
  });
  return revoked;
}

export async function setApiAccessPaused(paused, actor) {
  const state = await apiTokenRepo.setPaused(!!paused, actor?.id);
  invalidatePauseCache();
  await auditLogService.recordAuditLog({
    actor,
    action: paused ? "API_ACCESS_PAUSED" : "API_ACCESS_RESUMED",
    entity: { type: "ApiAccessState", id: "singleton" },
  });
  return state;
}

export async function getApiAccessState() {
  const state = await apiTokenRepo.getAccessState();
  return { paused: !!state?.paused, pausedAt: state?.pausedAt || null };
}

/**
 * Proverava sirovi token i vraća objekat za req.user (isti oblik kao JWT payload, plus oznake).
 * Dozvole se čitaju UŽIVO iz role pri svakom zahtevu, ne iz tokena.
 */
export async function authenticateApiToken(rawToken, { ip } = {}) {
  const fail = () => new AuthenticationError("Token nije validan ili je istekao");

  const record = await apiTokenRepo.findByHash(sha256(rawToken));
  if (!record || record.revokedAt || new Date(record.expiresAt).getTime() <= Date.now()) throw fail();

  if (await isPaused()) throw new AuthenticationError("Pristup preko tokena je privremeno pauziran.");

  const user = await userRepo.findUserById(record.user, { populateFields: ["role"] });
  if (!user || user.status !== "active") throw fail();
  if (FORBIDDEN_ROLE_NAMES.has(user.role?.name)) throw fail();
  if (user.tokenValidAfter && record.createdAt && new Date(record.createdAt) < new Date(user.tokenValidAfter)) throw fail();

  // beleženje poslednje upotrebe ne sme da uspori ni da obori zahtev
  apiTokenRepo.touchToken(record._id, ip).catch(() => {});

  return {
    id: user._id,
    email: user.email,
    roleId: user.role?._id,
    roleName: user.role?.name || "user",
    permissions: effectivePermissions(user.role?.permissions || [], record.scopes),
    isEmployee: false,
    isPartner: false,
    via: "api-token",
    tokenId: record._id.toString(),
    tokenName: record.name,
    scopes: record.scopes,
  };
}

export default {
  createApiToken, listApiTokens, listAssistantAccounts, updateApiTokenScopes, revokeApiToken, setApiAccessPaused, getApiAccessState,
  authenticateApiToken, effectivePermissions, looksLikeApiToken, isPaused, invalidatePauseCache,
};
