import { Link } from "react-router-dom";
import type { LegalDocument } from "./types";
import { LEGAL_ENTITY as E } from "./entity";

// Privacy Policy. Written to satisfy California's CalOPPA requirements for
// any commercial site collecting personal information from Californians:
// categories collected, categories of third parties shared with, how to
// review/change your information, how changes are announced, an effective
// date, and how Do Not Track signals are handled. Covers the marketing site
// as it exists today AND the hosting service as designed, so it doesn't need
// rewriting when accounts launch. DRAFT: have an attorney review before
// relying on it. Keep section ids stable — they're deep-link anchors.
export const privacy: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  shortTitle: "Privacy",
  description: "What information we collect, why, who we share it with, and the choices you have.",
  lastUpdated: "2026-08-29",
  summary: [
    "We collect what we need to run your account and server: contact details, billing information (handled by our payment processor), and technical logs.",
    "We don't sell your personal information, and we don't run advertising or ad trackers.",
    "Your server's files and your players' data are yours — we host them and don't look unless you ask us to or the law requires.",
    "Everything is stored in " + E.dataLocation + ".",
    "You can see, correct, export, or delete your information from your account or by emailing us.",
    "Accounts are for adults (18+). We don't knowingly collect personal information from children under 13.",
  ],
  sections: [
    {
      id: "scope",
      title: "Who we are and what this covers",
      body: (
        <>
          <p>
            This Privacy Policy explains how {E.name}, {E.operatorDescription}, based in {E.state}, {E.country} ("we", "us"), collects, uses, and shares information when you visit our website, create an account, or run a Minecraft server with us (together, the "Service"). It is effective as of the "Last updated" date above.
          </p>
          <p>
            It covers information about you, the account holder or website visitor. Information about the players who join <em>your</em> server is handled differently — see <a href="#players">Players on your server</a> below.
          </p>
        </>
      ),
    },
    {
      id: "collect",
      title: "Information we collect",
      body: (
        <>
          <p><strong>Information you give us</strong></p>
          <ul>
            <li><strong>Account details:</strong> username, email address, and a password (stored only as a salted hash — we can't see it).</li>
            <li><strong>Billing details:</strong> name, billing address, and payment method. Card numbers go directly to our payment processor; we receive only a token, the card type, and the last four digits.</li>
            <li><strong>Support and correspondence:</strong> anything you send us by email, ticket, or chat, including screenshots and files.</li>
            <li><strong>Server content:</strong> the worlds, configuration, plugins, mods, and other files you upload to or create on your server.</li>
          </ul>
          <p><strong>Information collected automatically</strong></p>
          <ul>
            <li><strong>Log data:</strong> IP address, browser and device type, pages visited, timestamps, and referring URLs when you use the website or control panel.</li>
            <li><strong>Server telemetry:</strong> resource usage (CPU, memory, storage, bandwidth), server status, console output, and connection logs — including the IP addresses that connect to your server — which we need to run, secure, and support it.</li>
            <li><strong>Cookies and similar technologies:</strong> see <a href="#cookies">Cookies, analytics and Do Not Track</a>.</li>
          </ul>
          <p><strong>Information from third parties</strong></p>
          <ul>
            <li>Payment confirmations, fraud signals, and dispute information from our payment processor.</li>
            <li>If we offer sign-in through a third party (for example Google) and you use it, we receive your name, email address, and profile identifier from that provider.</li>
          </ul>
        </>
      ),
    },
    {
      id: "use",
      title: "How we use information",
      body: (
        <>
          <ul>
            <li><strong>To provide the Service:</strong> create and manage your account, provision and run your server, process payments, and deliver support.</li>
            <li><strong>To keep things secure:</strong> detect and mitigate attacks (including DDoS traffic against your server), prevent abuse and fraud, and enforce our <Link to="/legal/terms">Terms</Link> and <Link to="/legal/acceptable-use">Acceptable Use Policy</Link>.</li>
            <li><strong>To communicate with you:</strong> send transactional messages — receipts, renewal and price-change notices, maintenance and outage alerts, security warnings, and replies to your requests. We'll only send marketing email if you opt in, and every marketing email will have an unsubscribe link.</li>
            <li><strong>To improve the Service:</strong> understand how the website and control panel are used, diagnose problems, and plan capacity, using aggregated or de-identified data where we can.</li>
            <li><strong>To comply with the law:</strong> keep required financial records, respond to lawful requests, and meet our legal obligations.</li>
          </ul>
        </>
      ),
    },
    {
      id: "cookies",
      title: "Cookies, analytics and Do Not Track",
      body: (
        <>
          <p>
            We use <strong>essential cookies</strong> only: a session cookie that keeps you signed in to the control panel, and a security token that protects forms. These are required for the Service to work and don't track you anywhere else.
          </p>
          <p>
            We <strong>don't use advertising cookies</strong>, ad networks, social-media pixels, or cross-site tracking. The public website currently uses no analytics at all. If we add a privacy-respecting analytics tool in the future, we'll update this section to say which one and what it collects.
          </p>
          <p>
            <strong>Do Not Track:</strong> because we don't track visitors across third-party websites, our website behaves the same whether or not your browser sends a "Do Not Track" or Global Privacy Control signal. We don't currently respond to those signals differently.
          </p>
        </>
      ),
    },
    {
      id: "sharing",
      title: "When we share information",
      body: (
        <>
          <p><strong>We don't sell your personal information</strong> and we don't share it with third parties for their own marketing. We share it only:</p>
          <ul>
            <li><strong>With service providers</strong> who help us run the Service and are bound to use the information only for that purpose: payment processors ({E.paymentProcessors}), email delivery, network and DDoS-protection providers (for example Cloudflare), and the data-center and hardware providers that host our infrastructure.</li>
            <li><strong>When the law requires it</strong> — in response to a subpoena, court order, or other lawful request, or where we believe in good faith that disclosure is necessary to comply with the law, protect someone's safety, or address fraud or abuse. Where the law allows, we'll try to notify you.</li>
            <li><strong>To report illegal content.</strong> As a {E.country} provider we are required to report apparent child sexual abuse material to the National Center for Missing & Exploited Children, and we will.</li>
            <li><strong>In a business transfer.</strong> If {E.name} is reorganized (for example, into a limited liability company), sold, or merged, your information may transfer to the successor, who will be bound by this policy.</li>
            <li><strong>With your consent</strong> or at your direction.</li>
          </ul>
        </>
      ),
    },
    {
      id: "players",
      title: "Players on your server",
      body: (
        <>
          <p>
            When someone joins a server you run with us, the Minecraft server software records their username, Minecraft UUID, IP address, and in-game activity in the server's logs and world data. That information sits inside <em>your</em> server files. <strong>You control it and are responsible for it</strong> — including for any rules your jurisdiction imposes on collecting data from your players and for whatever additional data your plugins gather. We process it only as your hosting provider: to store it, back it up, and defend your server from attacks. We don't use player data for our own purposes and don't share it except as described in this policy.
          </p>
          <p>
            If you're a player on someone else's {E.name}-hosted server and have a question about your data, please contact that server's owner first. If you can't reach them, email <a href={"mailto:" + E.privacyEmail}>{E.privacyEmail}</a> and we'll help where we can.
          </p>
        </>
      ),
    },
    {
      id: "retention",
      title: "How long we keep information",
      body: (
        <>
          <ul>
            <li><strong>Account information:</strong> for as long as your account is open, and for <strong>30 days</strong> after you close it, in case you change your mind or we need to resolve a dispute.</li>
            <li><strong>Server files and backups:</strong> for as long as the server exists, plus <strong>14 days</strong> after it's cancelled or terminated so you can request an export. Then they're permanently deleted.</li>
            <li><strong>Website and panel logs, connection logs:</strong> up to <strong>90 days</strong>, longer only if needed to investigate a specific security incident or abuse report.</li>
            <li><strong>Billing records:</strong> up to <strong>7 years</strong>, as tax and accounting law requires.</li>
            <li><strong>Support correspondence:</strong> up to <strong>2 years</strong> after the request is closed.</li>
          </ul>
          <p>We may keep de-identified or aggregated information (which no longer identifies you) indefinitely.</p>
        </>
      ),
    },
    {
      id: "security",
      title: "Security",
      body: (
        <>
          <p>
            We protect information with measures appropriate to a hosting service: encryption in transit (TLS) for the website, control panel, and API; passwords stored as salted hashes; access to infrastructure restricted to the people who run it and protected by strong authentication; and DDoS mitigation in front of our network. No system is perfectly secure, so we can't promise that unauthorized access will never happen. If a breach affects your personal information, we'll notify you as required by law — in {E.state}, that means without unreasonable delay.
          </p>
        </>
      ),
    },
    {
      id: "rights",
      title: "Your choices and rights",
      body: (
        <>
          <p>You can, at any time:</p>
          <ul>
            <li><strong>Review and update</strong> your account and billing details from your account settings, or by emailing <a href={"mailto:" + E.privacyEmail}>{E.privacyEmail}</a> from your account email address.</li>
            <li><strong>Export</strong> your server files (backups can be downloaded from the control panel) and request a copy of the personal information we hold about you.</li>
            <li><strong>Delete</strong> your account and its data, subject to the retention periods above and any records we must keep by law.</li>
            <li><strong>Opt out</strong> of marketing email using the unsubscribe link in any such message. You can't opt out of essential service messages while you have an account.</li>
          </ul>
          <p>
            We'll respond to requests within 30 days and may ask you to verify your identity first. We won't discriminate against you for exercising these rights.
          </p>
          <p>
            <strong>{E.state} residents:</strong> in addition to the above, {E.state} law lets you ask what categories of personal information we've collected and shared, and with whom. This policy is that disclosure. We don't share personal information with third parties for their direct marketing, so there is nothing to opt out of under {E.state}'s "Shine the Light" law.
          </p>
        </>
      ),
    },
    {
      id: "children",
      title: "Children",
      body: (
        <>
          <p>
            You must be <strong>18 or older</strong> to hold a {E.name} account, and the Service is not directed at children. We don't knowingly collect personal information from anyone under 13. If you believe a child has given us personal information, email <a href={"mailto:" + E.privacyEmail}>{E.privacyEmail}</a> and we'll delete it. Players of any age may join servers our customers run; the account holder, not {E.name}, is responsible for how their server treats its players.
          </p>
        </>
      ),
    },
    {
      id: "international",
      title: "Where your information lives",
      body: (
        <>
          <p>
            Our website, control panel, and servers are located in <strong>{E.dataLocation}</strong>, and that's where your information is stored and processed. If you use the Service from outside the {E.country}, you're sending your information to the {E.country}, where privacy laws may differ from those where you live. If you're in the European Economic Area, the United Kingdom, or another jurisdiction with its own data-protection law, we'll honor the access, correction, deletion, portability, and objection rights that law gives you — use the contacts below. For player data on a customer's server, we act as that customer's processor, and the customer is the controller.
          </p>
        </>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: (
        <>
          <p>
            When we change this policy, we'll update the "Last updated" date at the top. For material changes — anything that expands what we collect or how we share it — we'll also email account holders at least <strong>14 days</strong> before the change takes effect and post a notice in the control panel. Earlier versions are available on request.
          </p>
        </>
      ),
    },
    {
      id: "contact",
      title: "Contact",
      body: (
        <>
          <p>
            Privacy questions and requests: <a href={"mailto:" + E.privacyEmail}>{E.privacyEmail}</a>. General questions: <a href={"mailto:" + E.supportEmail}>{E.supportEmail}</a>. {E.name} is based in {E.state}, {E.country}.
          </p>
        </>
      ),
    },
  ],
};
