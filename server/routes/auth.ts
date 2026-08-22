import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { db } from "../db.js";
import type { UserRow } from "../db.js";
import { setSessionCookie, clearSessionCookie, getSessionUserId, toPublicUser } from "../auth.js";
import { mirrorPterodactylAccount } from "../pterodactylMirror.js";
import { isFeatureEnabled } from "../featureFlags.js";
import { consumeInviteCode } from "../inviteCodes.js";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Credential-stuffing/brute-force guard on the three routes that check a
// password or mint a session — keyed by `req.ip`, which only resolves to the
// real visitor because `app.set("trust proxy", 1)` in index.ts makes Express
// trust nginx's X-Forwarded-For. 20 attempts/15min is generous for a real
// user who mistypes a password a few times, tight enough to blunt automated
// guessing. Deliberately not applied to /logout or /me — those don't check a
// credential.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." },
});

function findByEmail(email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

// A nonexistent email short-circuits past bcrypt entirely (`!user ||`), while
// a real email always pays bcrypt's ~50-100ms even on a wrong password — a
// timing side-channel an attacker could use to enumerate real accounts
// without any difference in the response body/status. Comparing against this
// fixed dummy hash whenever there's no real one keeps login's timing
// consistent either way. (authLimiter already caps how many timing samples
// an attacker can gather per IP per window — this closes the gap outright
// rather than just relying on that.)
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("vantablock-timing-safety-dummy", 10);

function findById(id: number): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

authRouter.post("/register", authLimiter, async (req, res) => {
  if (!isFeatureEnabled("new_registration")) {
    res.status(403).json({ error: "New account registration is paused right now — check back later." });
    return;
  }

  const { username, email, password, inviteCode } = req.body ?? {};

  if (!username || typeof username !== "string" || username.trim().length < 3) {
    res.status(400).json({ error: "Username must be at least 3 characters." });
    return;
  }
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  if (!inviteCode || typeof inviteCode !== "string" || !inviteCode.trim()) {
    res.status(400).json({ error: "An invite code is required to sign up." });
    return;
  }

  const usernameTaken = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (usernameTaken) {
    res.status(409).json({ error: "That username is already taken." });
    return;
  }
  if (findByEmail(email)) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }

  const cleanUsername = username.replace(/[_\-.]/g, " ").trim();
  const [firstNameRaw, ...rest] = cleanUsername.split(/\s+/);
  const lastNameRaw = rest.join(" ") || "Owner";
  const firstName = firstNameRaw ? firstNameRaw.charAt(0).toUpperCase() + firstNameRaw.slice(1) : "New";
  const lastName = lastNameRaw.charAt(0).toUpperCase() + lastNameRaw.slice(1);

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      `INSERT INTO users (first_name, last_name, username, email, password_hash, auth_provider)
       VALUES (?, ?, ?, ?, ?, 'password')`
    )
    .run(firstName, lastName, username, email, passwordHash);

  const newUserId = result.lastInsertRowid as number;

  // Consume the code right after the local row is created but before the
  // (harder-to-undo) Pterodactyl mirror call, so an invalid/reused code only
  // ever leaves behind a local row to delete, never a stray remote account.
  if (!consumeInviteCode(inviteCode, newUserId)) {
    db.prepare("DELETE FROM users WHERE id = ?").run(newUserId);
    res.status(400).json({ error: "That invite code is invalid or has already been used." });
    return;
  }

  await mirrorPterodactylAccount(newUserId, { email, username, firstName, lastName });

  const user = findById(newUserId)!;
  setSessionCookie(res, user.id);
  res.status(201).json(toPublicUser(user));
});

authRouter.post("/login", authLimiter, (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const user = findByEmail(email);
  const passwordMatches = bcrypt.compareSync(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !user.password_hash || !passwordMatches) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  if (user.suspended) {
    res.status(403).json({ error: "This account has been suspended." });
    return;
  }

  setSessionCookie(res, user.id);
  res.json(toPublicUser(user));
});

authRouter.post("/google", authLimiter, async (req, res) => {
  if (!isFeatureEnabled("google_auth")) {
    res.status(403).json({ error: "Google sign-in is turned off right now — use email and password instead." });
    return;
  }

  const { accessToken, inviteCode } = req.body ?? {};
  if (!accessToken || typeof accessToken !== "string") {
    res.status(400).json({ error: "Missing Google access token." });
    return;
  }

  let profile: { email?: string; given_name?: string; family_name?: string; name?: string; picture?: string };
  try {
    const googleRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!googleRes.ok) throw new Error("Google rejected the access token.");
    profile = (await googleRes.json()) as typeof profile;
  } catch {
    res.status(401).json({ error: "Could not verify Google account." });
    return;
  }

  if (!profile.email) {
    res.status(400).json({ error: "Google account has no email address." });
    return;
  }

  const firstName = profile.given_name || profile.name?.split(" ")[0] || "Google";
  const lastName = profile.family_name || profile.name?.split(" ").slice(1).join(" ") || "User";

  let user = findByEmail(profile.email);
  if (user) {
    db.prepare(
      `UPDATE users SET first_name = ?, last_name = ?, avatar_url = ?, auth_provider = 'google' WHERE id = ?`
    ).run(firstName, lastName, profile.picture ?? null, user.id);
    user = findById(user.id)!;
  } else {
    // Brand-new account being created via Google — same single-use invite
    // gate as email/password signup, otherwise Google sign-up would be a
    // wide-open bypass of it.
    if (!inviteCode || typeof inviteCode !== "string" || !inviteCode.trim()) {
      res.status(400).json({ error: "An invite code is required to sign up." });
      return;
    }

    const baseUsername = profile.email.split("@")[0] || "google_user";
    let username = baseUsername;
    let suffix = 1;
    while (db.prepare("SELECT id FROM users WHERE username = ?").get(username)) {
      username = `${baseUsername}${suffix++}`;
    }

    const result = db
      .prepare(
        `INSERT INTO users (first_name, last_name, username, email, avatar_url, auth_provider)
         VALUES (?, ?, ?, ?, ?, 'google')`
      )
      .run(firstName, lastName, username, profile.email, profile.picture ?? null);
    const newUserId = result.lastInsertRowid as number;

    if (!consumeInviteCode(inviteCode, newUserId)) {
      db.prepare("DELETE FROM users WHERE id = ?").run(newUserId);
      res.status(400).json({ error: "That invite code is invalid or has already been used." });
      return;
    }

    await mirrorPterodactylAccount(newUserId, { email: profile.email, username, firstName, lastName });
    user = findById(newUserId)!;
  }

  if (user.suspended) {
    res.status(403).json({ error: "This account has been suspended." });
    return;
  }

  setSessionCookie(res, user.id);
  res.json(toPublicUser(user));
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get("/me", (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const user = findById(userId);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  res.json(toPublicUser(user));
});
