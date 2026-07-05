import { getCsrfToken } from "./csrf.js";
import Role from "../../src/models/role.model.js";
import userRepo from "../../src/repositories/user.repository.js";

export async function ensureRole(name) {
  const existing = await Role.findOne({ name });
  if (existing) return existing;
  const priority = name === "admin" ? 100 : name === "employee" ? 50 : 0;
  return Role.create({ name, isDefault: name === "user", priority });
}

export async function registerAndLogin(agent, { email, roleName, firstName = "Test", lastName = "Korisnik" }) {
  await ensureRole("admin");
  const role = await ensureRole(roleName);

  const { token } = await getCsrfToken(agent, "/registracija");
  await agent.post("/registracija").type("form").send({
    CSRFToken: token,
    email,
    password: "lozinka123",
    passwordConfirm: "lozinka123",
    firstName,
    lastName,
  });

  const user = await userRepo.findUserByEmail(email);
  await userRepo.updateUserById(user._id, { status: "active", confirmed: true, role: role._id });

  const { token: loginToken } = await getCsrfToken(agent, "/prijava");
  await agent.post("/prijava").type("form").send({ email, password: "lozinka123", CSRFToken: loginToken });

  return user;
}

export default { ensureRole, registerAndLogin };