import { verifyJwt } from "../services/crypto.service.js";
import { AuthenticationError } from "../utils/error.util.js";
import userRepo from "../repositories/user.repository.js";

// Statuses a verified Bearer token is allowed to act as. Anything else (suspended,
// re-deactivated, anonymized/deleted, still pending) means the account is not
// currently usable even though the JWT signature itself is still valid.
const USABLE_STATUSES = new Set(["active"]);

// A verified JWT's signature/expiry alone says nothing about whether the account
// has since been suspended or deactivated - jwt.verify (crypto.service.js's
// verifyJwt) only proves the token was issued by us and hasn't expired yet, and
// this middleware previously trusted its payload entirely with no DB lookup at
// all. That's exactly the gap a prior security audit found: suspending a user
// flips their `status` in the DB, but any token issued before that kept passing
// auth until it naturally expired (see user.model.js's `status`/`tokenValidAfter`
// field comments). This one lightweight, projected-fields-only lookup (see
// user.repository.js's findAuthStateById) closes it: reject if the account isn't
// currently "active", or if the token was issued (`iat`) before tokenValidAfter -
// i.e. before the account's last suspend/deactivate.
async function assertTokenStillValid(decoded) {
  const authState = await userRepo.findAuthStateById(decoded.id);
  if (!authState) {
    throw new AuthenticationError("Nalog ne postoji");
  }
  if (authState.status === "suspended") {
    throw new AuthenticationError("Nalog je suspendovan.");
  }
  if (!USABLE_STATUSES.has(authState.status)) {
    throw new AuthenticationError("Nalog nije aktivan.");
  }
  if (authState.tokenValidAfter && decoded.iat && decoded.iat * 1000 < new Date(authState.tokenValidAfter).getTime()) {
    throw new AuthenticationError("Nalog je suspendovan.");
  }
}

export function webAuthMiddleware(req, res, next) {
  if (req.session?.isLoggedIn) {
    req.user = req.session.user;
    return next();
  }

  req.flash("error", "Morate biti prijavljeni da biste pristupili ovoj stranici");
  return res.redirect(`/prijava?redirect=${encodeURIComponent(req.originalUrl)}`);
}

export function optionalWebAuth(req, res, next) {
  if (req.session?.isLoggedIn) {
    req.user = req.session.user;
  }
  next();
}

export async function apiAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AuthenticationError("Nedostaje token za autorizaciju"));
  }

  let decoded;
  try {
    const token = authHeader.split(" ")[1];
    // verifyJwt (crypto.service.js) instead of calling the jsonwebtoken library
    // directly here - same JWT_SECRET validation-at-startup and single place that
    // knows how tokens are signed/verified, rather than this file quietly
    // reaching around that service with its own `import jwt from "jsonwebtoken"`.
    decoded = verifyJwt(token);
  } catch (error) {
    return next(new AuthenticationError("Token nije validan ili je istekao"));
  }

  try {
    await assertTokenStillValid(decoded);
  } catch (error) {
    return next(error instanceof AuthenticationError ? error : new AuthenticationError("Token nije validan ili je istekao"));
  }

  req.user = decoded;
  next();
}

export async function optionalApiAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = verifyJwt(authHeader.split(" ")[1]);
      await assertTokenStillValid(decoded);
      req.user = decoded;
    } catch (error) {
      // not logged in (or account suspended/deactivated since the token was
      // issued) - ignore, this is optional
    }
  }
  next();
}
