import { Link } from "react-router-dom";
import type { LegalDocument } from "./types";
import { LEGAL_ENTITY as E } from "./entity";

// Refund Policy — "no refunds except our fault", the user's choice on
// 2026-08-29 (over 72-hour / 7-day / prorated alternatives). The specific
// triggers (billing error, 24h+ outage we caused, can't provision within 48h,
// plan discontinued) are what make "our fault" concrete. DRAFT: have an
// attorney review before relying on it. Keep section ids stable.
export const refunds: LegalDocument = {
  slug: "refunds",
  title: "Refund Policy",
  shortTitle: "Refunds",
  description: "When you can and can't get money back, and how to ask.",
  lastUpdated: "2026-08-29",
  summary: [
    "Plans are billed in advance and are non-refundable — except when the problem is on our side.",
    "If we double-charged you, your server was down for more than 24 hours because of us, we couldn't set up your server, or we discontinue your plan, you're entitled to a refund.",
    "Changing your mind, cancelling mid-cycle, plugin problems, or being suspended for breaking the rules don't qualify.",
    "Email us within 14 days of the issue. Approved refunds go back to your original payment method within 5–10 business days.",
    "Talk to us before filing a chargeback — we fix genuine mistakes fast, and chargebacks pause your account.",
  ],
  sections: [
    {
      id: "overview",
      title: "The policy in one paragraph",
      body: (
        <>
          <p>
            {E.name} plans are prepaid subscriptions. Once a billing period has been paid for, the resources are reserved for you for that whole period, so <strong>payments are non-refundable</strong> — with one important exception: <strong>when we're the cause of the problem.</strong> This policy spells out exactly what that means, what doesn't qualify, and how to ask. It's part of our <Link to="/legal/terms">Terms of Service</Link>.
          </p>
        </>
      ),
    },
    {
      id: "eligible",
      title: "When you're entitled to a refund",
      body: (
        <>
          <p>You may request a refund if any of the following happens:</p>
          <ul>
            <li>
              <strong>Billing error.</strong> We charged you twice, charged the wrong amount, or charged you after you had cancelled. We'll refund the incorrect amount in full.
            </li>
            <li>
              <strong>Extended outage caused by us.</strong> Your server was unavailable for more than <strong>24 consecutive hours</strong> within a billing period because of a failure in our hardware, network, or infrastructure. You may choose a refund or an account credit for the downtime, pro-rated against your monthly price. This doesn't cover scheduled maintenance we announced in advance, outages caused by DDoS attacks against your server or the mitigation that responds to them, upstream internet failures outside our network, or downtime caused by the software or configuration you run — see the <Link to="/legal/terms#availability">Terms</Link>.
            </li>
            <li>
              <strong>We couldn't deliver.</strong> We were unable to provision your server within <strong>48 hours</strong> of a successful payment, or we can't provide a plan feature that was advertised when you bought it. Full refund of the affected period.
            </li>
            <li>
              <strong>We discontinue your plan or the Service.</strong> If we stop offering your plan (and don't offer an equivalent or better one at the same price) or shut down the Service, we'll refund the unused portion of anything you've prepaid.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "not-eligible",
      title: "What isn't refundable",
      body: (
        <>
          <ul>
            <li>Changing your mind, no longer needing the server, or your community moving elsewhere.</li>
            <li>Unused time after you cancel. Cancellation stops future charges; the current period runs to its end. See <a href="#cancellation">Cancelling your plan</a>.</li>
            <li>Downgrades mid-period. A downgrade takes effect at your next renewal.</li>
            <li>Problems with plugins, mods, modpacks, world corruption caused by them, or any other third-party software — including performance that falls short of a plan's recommended player count because of what you've installed.</li>
            <li>Suspension or termination for breaching the <Link to="/legal/terms">Terms</Link> or the <Link to="/legal/acceptable-use">Acceptable Use Policy</Link>, or for non-payment.</li>
            <li>Purchases made with promotional pricing, discount codes, or account credit (credit has no cash value).</li>
            <li>Outages of less than 24 consecutive hours, or any outage not caused by us as described above.</li>
            <li>Chargeback fees, bank fees, or currency-conversion differences.</li>
          </ul>
        </>
      ),
    },
    {
      id: "credits",
      title: "Service credits",
      body: (
        <>
          <p>
            Separately from the refunds above, we may — at our discretion — add credit to your account as a goodwill gesture for shorter disruptions or other inconveniences. Credit is applied to future invoices, can't be withdrawn as cash, and expires if the account is closed.
          </p>
        </>
      ),
    },
    {
      id: "how",
      title: "How to request a refund",
      body: (
        <>
          <ul>
            <li>Email <a href={"mailto:" + E.supportEmail}>{E.supportEmail}</a> from your account email address <strong>within 14 days</strong> of the issue.</li>
            <li>Include the server name, the date(s) and approximate times of the problem, and, for outages, what you saw. We keep our own monitoring records and will check them against your report.</li>
            <li>We'll reply within <strong>5 business days</strong>. Approved refunds are returned to the original payment method; depending on your bank they typically appear within <strong>5–10 business days</strong>.</li>
          </ul>
        </>
      ),
    },
    {
      id: "cancellation",
      title: "Cancelling your plan",
      body: (
        <>
          <p>
            You can cancel at any time from your account's billing page, or by emailing <a href={"mailto:" + E.supportEmail}>{E.supportEmail}</a> from your account address. Cancelling stops automatic renewal; your server keeps running until the end of the period you've already paid for, and no further charges are made. Cancelling does not refund the current period. After the period ends, your server's files are kept for 14 days so you can download a backup, then permanently deleted.
          </p>
        </>
      ),
    },
    {
      id: "chargebacks",
      title: "Chargebacks and payment disputes",
      body: (
        <>
          <p>
            If you think a charge is wrong, <strong>please contact us before disputing it with your bank or card issuer.</strong> Genuine billing errors are refunded quickly under this policy. A chargeback filed without contacting us first costs us a fee and time, so when one is opened we'll suspend the account until the dispute is resolved. If the chargeback is reversed or the amount is repaid, we'll reinstate the account. Repeated or fraudulent chargebacks may lead to permanent closure.
          </p>
        </>
      ),
    },
    {
      id: "early-access",
      title: "Free and early-access servers",
      body: (
        <>
          <p>
            During {E.name}'s invite-only phase, servers are provided at no charge. Because nothing is paid, nothing can be refunded, and free servers may be changed, reset, or withdrawn as described in the <Link to="/legal/terms#early-access">Terms</Link>. Any promotional credit we grant during this phase has no cash value.
          </p>
        </>
      ),
    },
    {
      id: "changes",
      title: "Changes and contact",
      body: (
        <>
          <p>
            We may update this policy; the "Last updated" date shows the current version, and material changes are announced the same way as changes to the Terms. Refund requests are judged under the policy in effect when the payment was made. Questions: <a href={"mailto:" + E.supportEmail}>{E.supportEmail}</a>.
          </p>
        </>
      ),
    },
  ],
};
