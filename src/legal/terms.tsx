import { Link } from "react-router-dom";
import type { LegalDocument } from "./types";
import { LEGAL_ENTITY as E } from "./entity";

// Terms of Service. Drafted 2026-08-29 for a sole-proprietor Minecraft hosting
// business under California law — see the DEVLOG entry of that date for the
// decisions behind the specific numbers (grace periods, retention, venue,
// refunds-only-when-our-fault). DRAFT: have an attorney review before relying
// on it. Keep the section ids stable — they're deep-link anchors.
export const terms: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  shortTitle: "Terms",
  description: "The agreement between you and Vantablock when you create an account or run a server with us.",
  lastUpdated: "2026-08-29",
  summary: [
    "You must be 18 or older to hold an account. Anyone can play on your server.",
    "You own your worlds, plugins and data. We host them; we don't claim them.",
    "Plans renew monthly until you cancel. You can cancel any time from your account and keep the time you've paid for.",
    "Refunds are only for problems on our side — see the Refund Policy.",
    "Keep your own backups. We take reasonable care, but we aren't liable for lost data.",
    "Follow the Acceptable Use Policy and the Minecraft EULA, or we can suspend or close your server.",
    "California law applies. If we have a dispute, we talk first; if that fails, it goes to court in " + E.county + ", " + E.state + ".",
  ],
  sections: [
    {
      id: "agreement",
      title: "Agreement to these Terms",
      body: (
        <>
          <p>
            These Terms of Service (the "Terms") are a binding agreement between you and {E.name}, {E.operatorDescription}, based in {E.state}, {E.country} ("{E.name}", "we", "us"). They govern your use of the {E.name} website, control panel, and Minecraft server hosting service (together, the "Service").
          </p>
          <p>
            By creating an account, running a server, or otherwise using the Service, you agree to these Terms, to our <Link to="/legal/acceptable-use">Acceptable Use Policy</Link>, and to our <Link to="/legal/refunds">Refund Policy</Link>, all of which are part of this agreement. Our <Link to="/legal/privacy">Privacy Policy</Link> explains how we handle your information. If you don't agree, don't use the Service.
          </p>
          <p>
            {E.name} is an independent hosting provider. <strong>We are not affiliated with, endorsed by, or sponsored by Mojang AB, Microsoft, or any of their affiliates.</strong> "Minecraft" is a trademark of Mojang AB.
          </p>
        </>
      ),
    },
    {
      id: "eligibility",
      title: "Eligibility and accounts",
      body: (
        <>
          <p>
            <strong>You must be at least 18 years old</strong> to create an account, purchase a plan, or otherwise enter into these Terms. The account holder is the person who agrees to these Terms and is responsible for the server. Players who join your server may be any age — that's between you and them — but the account itself must belong to an adult.
          </p>
          <ul>
            <li>Give us accurate, current contact and billing information and keep it up to date. We use your account email for legally required notices, so make sure it works.</li>
            <li>Keep your password and any API credentials confidential. You're responsible for everything done through your account, including by staff, sub-users, or anyone you give access to.</li>
            <li>Tell us promptly at <a href={"mailto:" + E.supportEmail}>{E.supportEmail}</a> if you think your account has been compromised.</li>
            <li>Don't create accounts for someone else, share an account, or use another person's account without their permission. We may refuse, suspend, or close accounts that were opened with false information or in violation of these Terms.</li>
          </ul>
        </>
      ),
    },
    {
      id: "service",
      title: "The Service",
      body: (
        <>
          <p>
            {E.name} provides hosted Minecraft game servers: an allocation of memory, processor time, and storage on our hardware, a web control panel to manage it, and network connectivity so players can join. Each plan describes what's included (RAM, vCores, storage, and recommended player counts). We may update plan specifications, features, supported software versions, or the control panel over time; if a change materially reduces what you're paying for, we'll tell you in advance and you may cancel.
          </p>
          <p>
            The Service is designed to run Minecraft server software (for example Vanilla, Paper, Forge, Fabric, and compatible proxies) and the plugins, mods, and modpacks that go with it. It is not general-purpose hosting — see the <Link to="/legal/acceptable-use">Acceptable Use Policy</Link> for what may and may not run on it.
          </p>
        </>
      ),
    },
    {
      id: "early-access",
      title: "Early access (invite-only) phase",
      body: (
        <>
          <p>
            While {E.name} is in its early, invite-only phase, we provide servers to a small group at no charge so we can build and test the Service. During that phase:
          </p>
          <ul>
            <li>the Service is provided strictly "as available" — we may change it, take it offline, reset servers, or end the free phase at any time, and we'll give as much notice as we reasonably can;</li>
            <li>no payment is collected, so the billing and refund provisions below don't apply until paid plans launch;</li>
            <li>everything else in these Terms — eligibility, acceptable use, your responsibility for your content, and the limits on our liability — applies in full.</li>
          </ul>
          <p>
            If and when paid plans launch, we'll tell you before anything is charged, and you'll choose whether to continue on a paid plan. We won't convert a free server into a paid one without your affirmative consent.
          </p>
        </>
      ),
    },
    {
      id: "resources",
      title: "Plans, resources and fair use",
      body: (
        <>
          <p>
            Your plan's RAM and storage are yours. Processor cores are allocated per plan, and network bandwidth is offered without a fixed cap, but both live on shared physical hardware, so we ask that you use them fairly:
          </p>
          <ul>
            <li>Player counts on plan pages are recommendations for a good experience, not hard limits or guarantees — heavily modded servers may support fewer players than listed.</li>
            <li>"Unlimited" bandwidth means we don't meter it for ordinary Minecraft traffic. It doesn't mean the Service may be used for bulk file distribution, streaming, or anything other than serving your Minecraft server and its players.</li>
            <li>If a server consistently saturates its allocation in a way that degrades the node for others (for example, a runaway plugin or an intentionally abusive workload), we may throttle it, ask you to fix the cause or upgrade, or, for deliberate abuse, suspend it under the Acceptable Use Policy.</li>
          </ul>
        </>
      ),
    },
    {
      id: "your-content",
      title: "Your content and data",
      body: (
        <>
          <p>
            You keep ownership of everything you upload to or create on your server — worlds, builds, configurations, plugins, mods, and any other files ("Your Content"). We claim no rights in it. You grant {E.name} only the limited, non-exclusive license needed to host, store, back up, transmit, and display Your Content in order to run the Service for you, including moving it between machines and making backups.
          </p>
          <p>You are responsible for Your Content. That means:</p>
          <ul>
            <li>you must have the right to use everything you upload — including mods, plugins, modpacks, resource packs, and maps — and must comply with their licenses;</li>
            <li>Your Content and your players' conduct must comply with the <Link to="/legal/acceptable-use">Acceptable Use Policy</Link> and applicable law;</li>
            <li>you're responsible for the rules, moderation, and data practices on your own server, including anything you collect from your players.</li>
          </ul>
          <p>
            We don't routinely monitor the contents of servers. We may access or review Your Content when you ask us to for support, when required by law, or when we have a good-faith reason to believe it violates these Terms or the Acceptable Use Policy, and we may remove or disable content that does.
          </p>
        </>
      ),
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      body: (
        <>
          <p>
            The <Link to="/legal/acceptable-use">Acceptable Use Policy</Link> sets out what you can't do with the Service — including illegal activity, attacks on other networks, crypto-mining, pirated software, and running anything other than Minecraft-related software. It's part of these Terms. In short: run your Minecraft server, don't harm anyone else's, and don't break the law. Violations can lead to warnings, throttling, suspension, or termination without refund.
          </p>
        </>
      ),
    },
    {
      id: "billing",
      title: "Billing and automatic renewal",
      body: (
        <>
          <p>
            This section applies once paid plans launch. Plans are subscriptions, billed in advance for each billing period (monthly unless the plan says otherwise).
          </p>
          <ul>
            <li>
              <strong>Automatic renewal.</strong> Your plan renews automatically at the end of each billing period, and we'll charge the payment method on file at the then-current price of your plan, until you cancel. The renewal price, billing frequency, and how to cancel are shown before you subscribe, and we'll confirm them by email after you do.
            </li>
            <li>
              <strong>Cancelling.</strong> You can cancel at any time from your account's billing page, or by emailing <a href={"mailto:" + E.supportEmail}>{E.supportEmail}</a> from your account email. Cancellation takes effect at the end of the current billing period; you keep the service until then, and no further charges are made.
            </li>
            <li>
              <strong>Price changes.</strong> We'll give you at least 30 days' notice by email before a price increase applies to your plan. If you don't want to pay the new price, cancel before it takes effect.
            </li>
            <li>
              <strong>Upgrades and downgrades.</strong> Upgrades take effect immediately and are charged pro-rata for the rest of the period. Downgrades take effect at the next renewal.
            </li>
            <li>
              <strong>Payment processing.</strong> Payments are handled by third-party processors (currently {E.paymentProcessors}). We don't store full card numbers. You authorize us and our processor to charge your payment method for amounts due.
            </li>
            <li>
              <strong>Taxes.</strong> Prices exclude any applicable sales, use, or similar taxes, which we'll add where the law requires.
            </li>
            <li>
              <strong>Failed payments.</strong> If a renewal payment fails, we'll notify you and retry. If it's still unpaid <strong>3 days</strong> after the due date, we may suspend the server (it stops running but the data stays). If it remains unpaid <strong>14 days</strong> after suspension, we may terminate the server and permanently delete its data.
            </li>
            <li>
              <strong>Chargebacks.</strong> Contact us before disputing a charge with your bank — we'll fix genuine billing errors quickly. A chargeback filed without contacting us may result in suspension of the account until it's resolved. See the <Link to="/legal/refunds">Refund Policy</Link>.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "cancellation",
      title: "Cancellation and refunds",
      body: (
        <>
          <p>
            You may cancel at any time as described above. Because plans are billed in advance and you keep the service through the end of the period, <strong>cancellation does not entitle you to a refund of the current period.</strong> Refunds are available only for problems on our side — billing errors, extended outages we caused, or our inability to deliver what you paid for — as set out in the <Link to="/legal/refunds">Refund Policy</Link>.
          </p>
        </>
      ),
    },
    {
      id: "suspension",
      title: "Suspension and termination",
      body: (
        <>
          <p>We may suspend or terminate your server or account, with or without notice depending on severity, if:</p>
          <ul>
            <li>you breach these Terms or the Acceptable Use Policy;</li>
            <li>a payment is overdue as described in the Billing section;</li>
            <li>your server is being used in a way that threatens the security, stability, or reputation of the Service or other customers (for example, it's the source or target of an attack we can't otherwise mitigate);</li>
            <li>we're required to by law, a court order, or a request from law enforcement;</li>
            <li>you've given us false information or we reasonably believe the account is fraudulent.</li>
          </ul>
          <p>
            Where practical we'll warn you first and give you a chance to fix the problem. For serious or urgent issues — illegal content, attacks in progress, credible legal demands — we may act immediately. Terminations for breach are not refunded.
          </p>
          <p>
            You may close your account at any time. When a server is terminated for any reason, we'll keep its data for <strong>14 days</strong> so you can request an export, unless we're legally required to delete it sooner or keep it longer. After that it is permanently deleted. Sections of these Terms that by their nature should survive (your content responsibilities, disclaimers, liability limits, indemnification, and dispute terms) do so.
          </p>
        </>
      ),
    },
    {
      id: "backups",
      title: "Backups and data loss",
      body: (
        <>
          <p>
            Some plans include automated backups, and you can create backups from the control panel. These are provided as a convenience and on a best-effort basis: they may fail, be incomplete, or be unavailable, and backups are stored on the same infrastructure as your server unless a plan says otherwise. <strong>You are responsible for keeping your own off-site copies of anything you can't afford to lose.</strong> Hardware fails, software has bugs, and we can't guarantee that any particular file will be recoverable. We'll take reasonable care with your data, but we are not liable for its loss, corruption, or unavailability.
          </p>
        </>
      ),
    },
    {
      id: "availability",
      title: "Availability and maintenance",
      body: (
        <>
          <p>
            We aim to keep servers online around the clock, but <strong>we don't guarantee any particular uptime</strong> and these Terms don't include a service-level agreement. Downtime can result from scheduled maintenance (we'll try to announce it in advance and schedule it at low-traffic times), emergency maintenance, hardware failure, network or upstream provider problems, DDoS attacks and the mitigation that responds to them, or problems caused by the software you run. If an extended outage is our fault, the <Link to="/legal/refunds">Refund Policy</Link> explains what you can claim. Service credits beyond that are at our discretion.
          </p>
        </>
      ),
    },
    {
      id: "support",
      title: "Support",
      body: (
        <>
          <p>
            We provide support through the channels published on our website. Support covers our infrastructure, the control panel, and getting supported server software running. Within reason we'll help with plugin, mod, and modpack problems, but we can't guarantee that third-party software will work, debug your custom configuration for you, or provide in-game moderation. Plans that list "priority support" move your requests to the front of the queue; they don't promise a specific response time.
          </p>
        </>
      ),
    },
    {
      id: "third-party",
      title: "Third-party software and Minecraft",
      body: (
        <>
          <p>
            Minecraft, server implementations such as Paper, Forge, and Fabric, and every plugin, mod, and modpack you install are made by third parties and come with their own licenses. You're responsible for complying with them. In particular:
          </p>
          <ul>
            <li>You must comply with the <strong>Minecraft End User License Agreement</strong> and Mojang's <strong>Usage Guidelines</strong>, including their rules on monetizing a server. Selling gameplay advantages, running "cracked" or unauthenticated servers, or presenting your server as official or affiliated with Mojang or Microsoft can get your server suspended.</li>
            <li>We may add, remove, or update the server software, versions, and one-click installers we offer at any time.</li>
            <li>We aren't responsible for third-party software, its security, or its behavior on your server.</li>
          </ul>
        </>
      ),
    },
    {
      id: "ip",
      title: "Intellectual property",
      body: (
        <>
          <p>
            The {E.name} name, logo, website, control panel, and everything we've built to run the Service belong to us or our licensors. These Terms don't give you any right to use them except as needed to use the Service. If you send us feedback or suggestions, we may use them without obligation to you. "Minecraft" and related marks belong to Mojang AB; we use the name only to describe what our service is compatible with.
          </p>
        </>
      ),
    },
    {
      id: "copyright",
      title: "Copyright complaints",
      body: (
        <>
          <p>
            We respond to notices of claimed copyright infringement under the Digital Millennium Copyright Act (DMCA). If you believe material hosted on the Service infringes your copyright, send a notice to <a href={"mailto:" + E.legalEmail}>{E.legalEmail}</a> containing: identification of the copyrighted work; identification and location of the allegedly infringing material; your contact information; a statement that you have a good-faith belief the use is not authorized; a statement, under penalty of perjury, that the information is accurate and you are (or are authorized to act for) the copyright owner; and your physical or electronic signature.
          </p>
          <p>
            If your content is removed in response to a notice and you believe that was a mistake, you may send a counter-notice to the same address. We terminate the accounts of repeat infringers.
          </p>
        </>
      ),
    },
    {
      id: "disclaimers",
      title: "Disclaimers",
      body: (
        <>
          <p>
            <strong>The Service is provided "as is" and "as available", without warranties of any kind</strong>, whether express, implied, or statutory, including implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement, to the fullest extent the law allows. We don't warrant that the Service will be uninterrupted, error-free, secure, or free of harmful components, that data won't be lost, or that any third-party software will work. Some jurisdictions don't allow some of these exclusions, so some may not apply to you.
          </p>
        </>
      ),
    },
    {
      id: "liability",
      title: "Limitation of liability",
      body: (
        <>
          <p>
            To the fullest extent permitted by law, {E.name} will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of data, profits, revenue, goodwill, or players, arising out of or related to the Service or these Terms, however caused and under any theory of liability, even if we've been told such damages are possible.
          </p>
          <p>
            <strong>Our total liability to you for all claims arising out of or related to the Service or these Terms will not exceed the amount you paid us for the Service in the three (3) months before the event giving rise to the claim</strong> — or, if you've paid nothing (for example during the free early-access phase), fifty US dollars (US$50).
          </p>
          <p>
            Nothing in these Terms limits liability that can't be limited by law, including for fraud or for death or personal injury caused by negligence. If you're a consumer, you may have rights under the laws of your state or country that these Terms don't override.
          </p>
        </>
      ),
    },
    {
      id: "indemnification",
      title: "Indemnification",
      body: (
        <>
          <p>
            You agree to defend, indemnify, and hold harmless {E.name} and its owner from any claims, damages, losses, and expenses (including reasonable attorneys' fees) arising out of Your Content, your use of the Service, your players' use of your server, your breach of these Terms or the Acceptable Use Policy, or your violation of any law or third-party right. We'll notify you of any such claim and may take over its defense at our expense.
          </p>
        </>
      ),
    },
    {
      id: "disputes",
      title: "Governing law and disputes",
      body: (
        <>
          <p>
            These Terms are governed by the laws of the State of {E.state} and the federal laws of the {E.country}, without regard to conflict-of-law rules.
          </p>
          <ul>
            <li>
              <strong>Talk to us first.</strong> If you have a dispute with us, email <a href={"mailto:" + E.legalEmail}>{E.legalEmail}</a> with a description of the problem and what you'd like us to do. We'll do the same if we have a dispute with you. Both of us agree to try in good faith to resolve it informally for at least <strong>30 days</strong> before starting any formal proceeding.
            </li>
            <li>
              <strong>Then the courts.</strong> If we can't resolve it informally, either of us may bring a claim in small claims court, or in the state or federal courts located in <strong>{E.county}, {E.state}</strong>. You and we each consent to the personal jurisdiction of those courts. Nothing prevents either of us from seeking an injunction to protect intellectual property or to stop an ongoing violation of the Acceptable Use Policy.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "changes",
      title: "Changes to the Service or these Terms",
      body: (
        <>
          <p>
            We may update these Terms from time to time. For material changes we'll give at least <strong>14 days' notice</strong> by email to your account address and/or a notice in the control panel before they take effect; minor changes (clarifications, typos, contact details) take effect when posted. The "Last updated" date at the top tells you when the current version took effect. If you keep using the Service after a change takes effect, you accept the new Terms; if you don't agree, cancel before then.
          </p>
        </>
      ),
    },
    {
      id: "general",
      title: "General terms",
      body: (
        <>
          <ul>
            <li><strong>Entire agreement.</strong> These Terms, together with the Acceptable Use Policy, Refund Policy, and Privacy Policy, are the whole agreement between you and us about the Service and replace any earlier agreements.</li>
            <li><strong>Assignment.</strong> You may not transfer your account or these Terms to anyone else without our consent. We may assign this agreement to a successor — for example, to a company formed to run {E.name} — and will let you know if we do.</li>
            <li><strong>Severability.</strong> If any part of these Terms is found unenforceable, the rest stays in effect and the unenforceable part is replaced by the closest enforceable term.</li>
            <li><strong>No waiver.</strong> If we don't enforce a term right away, we can still enforce it later.</li>
            <li><strong>Force majeure.</strong> Neither of us is liable for delays or failures caused by events outside our reasonable control — natural disasters, power or internet outages, upstream provider failures, attacks, labor disputes, or government action.</li>
            <li><strong>Notices.</strong> We'll send notices to your account email. You can send notices to us at <a href={"mailto:" + E.legalEmail}>{E.legalEmail}</a>.</li>
            <li><strong>Export and sanctions.</strong> You may not use the Service if you're located in a country or on a list subject to {E.country} sanctions or embargoes.</li>
          </ul>
        </>
      ),
    },
    {
      id: "contact",
      title: "Contact",
      body: (
        <>
          <p>
            Questions about these Terms: <a href={"mailto:" + E.legalEmail}>{E.legalEmail}</a>. Support: <a href={"mailto:" + E.supportEmail}>{E.supportEmail}</a>. Abuse reports: <a href={"mailto:" + E.abuseEmail}>{E.abuseEmail}</a>.
          </p>
        </>
      ),
    },
  ],
};
