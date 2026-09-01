# Vantablock — Legal Launch Checklist

The four legal documents (Terms of Service, Privacy Policy, Refund Policy, Acceptable Use
Policy) are **written and waiting** in `src/legal/`. They're visible on `npm run dev` at
`/legal/terms` etc., and **hidden on the live site** until everything below is done — then
launching them is a one-line code change.

Last updated: 2026-09-01

---

## Where things stand

| Item | Status |
|---|---|
| Four documents drafted (CalOPPA / ARL / DMCA / Mojang-guideline aware) | ✅ Done |
| Key decisions made (sole proprietor, CA law, refund rules, 18+, courts not arbitration) | ✅ Done |
| Venue filled in: Tulare County, California | ✅ Done |
| Real contact addresses: legal@ / privacy@ / abuse@ / support@vantablock.net | ✅ Done |
| Cloudflare Email Routing forwarding all four to the private Gmail inbox | ✅ Done |
| Send a test email to legal@vantablock.net and confirm it arrives | ⬜ 2 minutes |
| Fictitious Business Name (FBN) statement — Tulare County | ⬜ To do |
| DMCA agent registration — US Copyright Office ($6) | ⬜ To do |
| Attorney review of the four documents | ⬜ To do |
| Flip `LEGAL_PAGES_ENABLED` to `true` and deploy | ⬜ Last step (ask Claude) |

---

## 1. Test the mailboxes (2 minutes)

1. From any email account, send a message **to** `legal@vantablock.net`.
2. Check the Gmail inbox it forwards to (look in **Spam** the first time).
3. Optional: in Cloudflare → vantablock.net → Email → Email Routing → Routing rules, turn on
   **Catch-all → Send to your Gmail** so typos and `hello@vantablock.net` reach you too.

---

## 2. Fictitious Business Name statement — Tulare County

**Why:** You're doing business as "Vantablock," which doesn't contain your surname. California
requires sole proprietors to file an FBN statement **in the county where the business is based,
within 40 days of first doing business** under the name. Banks also require it to open a business
bank account under "Vantablock."

**Steps:**

1. Go to the **Tulare County Clerk-Recorder** website (tularecounty.ca.gov → County
   Clerk-Recorder) and find "Fictitious Business Name." Check the current fee there (typically
   $40–60 for one name / one owner).
2. Fill out the FBN statement form: business name **Vantablock**, your name and home/business
   address, business type **individual** (sole proprietor). *Note: this filing is public record.*
3. File it — in person at the Visalia office, by mail, or online if the county offers it.
4. **Publish it**: California requires the statement to run **once a week for 4 consecutive
   weeks** in an adjudicated newspaper in the county (the *Visalia Times-Delta* is the usual
   choice; many papers handle the whole process for a fee if you give them the stamped filing).
   Publication must start within **30 days** of filing.
5. The newspaper files (or gives you) a **proof of publication** — make sure it gets back to the
   County Clerk.
6. Keep the stamped copy. The statement is valid for **5 years**, then you renew.

---

## 3. DMCA agent registration — $6, ~10 minutes

**Why:** Customers upload content (worlds, mods, plugins) you don't control. The DMCA §512 "safe
harbor" shields the host from copyright liability for user content — but **only if** a designated
agent is registered with the US Copyright Office. The Terms already describe the takedown
process; this registration is what makes it count.

**Steps:**

1. Go to **dmca.copyright.gov**.
2. Create a login (it's a standalone account system).
3. Add a **service provider**: name **Vantablock**, and list `vantablock.net` under alternate
   names.
4. Designate the **agent** — yourself: name, phone, mailing address, and email
   **legal@vantablock.net**.
   - ⚠️ The agent's mailing address is published in a **public, searchable directory**. A PO box
     or UPS Store box is fine as long as you receive mail there — and the same box works for the
     FBN filing above.
5. Pay the **$6** fee.
6. **Set a calendar reminder: the registration expires every 3 years.** Renewal is another $6;
   they email reminders, but don't rely on that alone.
7. Tell Claude the mailing address you listed — the Terms' copyright section gets the matching
   agent contact added so the two are consistent.

---

## 4. Attorney review

The documents are careful drafts, not reviewed legal work. One flat-fee review session with a
business attorney is enough — you're asking "is anything here wrong or missing for a California
sole proprietor hosting game servers," not asking them to draft from scratch.

**To hand them the documents:**

1. Run `npm run dev` and open, one at a time:
   - `http://localhost:5173/legal/terms`
   - `http://localhost:5173/legal/privacy`
   - `http://localhost:5173/legal/refunds`
   - `http://localhost:5173/legal/acceptable-use`
2. Print each page to PDF (Ctrl+P → Save as PDF) and send the four PDFs over.

**Decisions already made on purpose — tell the attorney these were deliberate:**
- Sole proprietor ("an individual doing business as Vantablock"), California law, courts in
  Tulare County — **no arbitration clause** (chosen deliberately).
- **Refunds only when it's our fault** (billing error; >24h outage caused by our
  hardware/network; failure to provision within 48h; discontinued plan) — no general money-back
  window.
- **18+ to hold an account**; players of any age may join customers' servers.
- Free/beta servers are "as available," and no free→paid conversion without explicit consent.

**Numbers that are easy to change if the attorney (or you) wants different ones:** suspend after
3 days of failed payment, delete 14 days after suspension; 14-day post-cancellation file
retention; logs 90 days; billing records 7 years; liability cap of 3 months' fees.

---

## 5. Launch (ask Claude — one minute)

When 1–4 are done, say the word. What happens:

1. `LEGAL_PAGES_ENABLED` in `src/config.ts` flips to `true`.
2. That single flag turns on: the `/legal/*` pages, the Legal column in the footer, and the
   consent line on the signup form ("By creating an account you agree to…").
3. Commit, push, confirm the Cloudflare build goes green and the pages are live.

---

## Later — not blocking launch

- **When billing actually launches:** the checkout screen must show the automatic-renewal terms
  the documents promise (California ARL) — price, renewal period, how to cancel — before the
  customer pays, and the confirmation email must repeat them. Stripe is already named as the
  processor in the documents.
- **Real analytics or ads?** The Privacy Policy currently (truthfully) says functional cookies
  only, no analytics, no ad pixels. If that ever changes, the policy must change first.
- **If you form an LLC:** the entity name and "sole proprietorship" description live in ONE file
  (`src/legal/entity.ts`) — all four documents update from it. The FBN filing and DMCA
  registration would also need updating to the LLC's name.
- **Google sign-in:** the Privacy Policy mentions Google as a sign-in provider. If the real
  signup launches without Google login, remove that mention (or keep it if it ships).
