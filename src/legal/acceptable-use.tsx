import { Link } from "react-router-dom";
import type { LegalDocument } from "./types";
import { LEGAL_ENTITY as E } from "./entity";

// Acceptable Use Policy for a Minecraft-only hosting service: the standard
// hosting prohibitions (illegal content, network attacks, resource abuse,
// malware) plus the Minecraft-specific ones (EULA compliance, online mode,
// no pirated mods, no reselling). DRAFT: have an attorney review before
// relying on it. Keep section ids stable — they're deep-link anchors.
export const acceptableUse: LegalDocument = {
  slug: "acceptable-use",
  title: "Acceptable Use Policy",
  shortTitle: "Acceptable Use",
  description: "What you can't do with a Vantablock server — and what happens if you do.",
  lastUpdated: "2026-08-29",
  summary: [
    "Run your Minecraft server. Don't run anything else on it — no crypto-mining, file hosting, or unrelated software.",
    "Nothing illegal, and nothing that harms other people: no attacks on other networks, no malware, no exploitation of minors, no doxxing.",
    "Only use mods, plugins and modpacks you have the right to use. No pirated software, and no \"cracked\" (offline-mode) servers.",
    "Follow the Minecraft EULA, including its rules on monetizing your server.",
    "You're responsible for what your staff and players do on your server.",
    "Break these rules and we can throttle, suspend, or terminate your server — without a refund.",
  ],
  sections: [
    {
      id: "scope",
      title: "Who this applies to",
      body: (
        <>
          <p>
            This Acceptable Use Policy (the "AUP") is part of the {E.name} <Link to="/legal/terms">Terms of Service</Link>. It applies to every account holder and to everyone who uses a {E.name}-hosted server — your staff, sub-users, and players. <strong>You, the account holder, are responsible for making sure they comply</strong>, and for what happens on your server even when you're not online. We wrote it to protect our customers, our infrastructure, and the rest of the internet from a small number of bad actors; if you're running a normal Minecraft community, none of it should get in your way.
          </p>
        </>
      ),
    },
    {
      id: "illegal",
      title: "Illegal activity and prohibited content",
      body: (
        <>
          <p>You may not use the Service to do, host, or promote anything that is illegal where you are, where we are ({E.state}, {E.country}), or where your players are. Without limiting that, you may not host or distribute:</p>
          <ul>
            <li><strong>Child sexual abuse material, or any content that sexualizes minors.</strong> Zero tolerance: we terminate immediately, preserve evidence, and report to the National Center for Missing & Exploited Children and law enforcement as the law requires.</li>
            <li>Content that harasses, threatens, or incites violence against a person or group, or that is defamatory.</li>
            <li>Personal information about others published without their consent ("doxxing"), or content that facilitates stalking or swatting.</li>
            <li>Material that infringes anyone's copyright, trademark, or other rights — see <a href="#software">Mods, plugins and pirated software</a>.</li>
            <li>Fraud, phishing, scams, or the sale or promotion of illegal goods.</li>
            <li>Malware, or tools whose primary purpose is unauthorized access to systems or accounts.</li>
          </ul>
          <p>
            You may set whatever in-game rules you like for your own community, and we don't moderate gameplay, chat, or builds for you. But if what happens on your server crosses into the categories above, it's our problem too, and we will act.
          </p>
        </>
      ),
    },
    {
      id: "network",
      title: "Network abuse",
      body: (
        <>
          <p>You may not use the Service, or allow it to be used, to:</p>
          <ul>
            <li>launch, participate in, or "stress test" with denial-of-service attacks against anyone — including other Minecraft servers, and including your own server if it's hosted elsewhere;</li>
            <li>scan, probe, or attempt to access networks, systems, or accounts you don't have permission to use;</li>
            <li>run open proxies, VPN endpoints, Tor relays, open mail relays, botnet command-and-control, or any service that forwards traffic that isn't your server's Minecraft traffic;</li>
            <li>spoof IP addresses, forge headers, or otherwise misrepresent where traffic comes from;</li>
            <li>send spam or unsolicited bulk messages of any kind.</li>
          </ul>
          <p>
            If your server becomes the <em>target</em> of an attack, that's not a violation — that's what our DDoS mitigation is for. Tell us if it's persistent so we can tune the filters.
          </p>
        </>
      ),
    },
    {
      id: "resources",
      title: "Resource abuse and permitted software",
      body: (
        <>
          <p>
            Your plan buys resources for <strong>running a Minecraft server</strong>: the server software itself (Vanilla, Paper, Spigot, Forge, Fabric, NeoForge, and similar), proxies that connect Minecraft servers (Velocity, BungeeCord, and similar), and the plugins, mods, modpacks, and world tools that go with them. Anything else needs our written permission first. In particular, you may not:
          </p>
          <ul>
            <li>mine, stake, or otherwise process cryptocurrency, or run any workload whose purpose is to consume CPU for its own sake;</li>
            <li>use the server as general file storage, a download mirror, a media or streaming host, or a backup target for data unrelated to your Minecraft server;</li>
            <li>run servers for other games, web applications, databases, bots, or other software unrelated to your Minecraft server;</li>
            <li>deliberately overload the node, bypass or tamper with resource limits, or run scripts that keep a server artificially busy;</li>
            <li>rely on "unlimited" bandwidth for anything other than ordinary player traffic — it's unmetered, not a CDN.</li>
          </ul>
          <p>
            A busy server that legitimately uses everything it paid for is fine. A server that hurts its neighbors will be throttled, and one doing it on purpose will be suspended.
          </p>
        </>
      ),
    },
    {
      id: "software",
      title: "Mods, plugins and pirated software",
      body: (
        <>
          <ul>
            <li>Only install software you have the right to use, and comply with its license. That includes premium plugins and paid mods and modpacks — buy them; don't upload "leaked" or "nulled" copies.</li>
            <li>Don't host or distribute cracked game clients, launchers, or account-stealing tools.</li>
            <li>Don't upload software you don't understand from sources you don't trust. Malicious plugins are a real thing, and a compromised server is your problem first and ours second.</li>
            <li>If a plugin or mod is found to be malicious, pirated, or grossly destabilizing, we may remove it or stop the server until it's removed.</li>
          </ul>
        </>
      ),
    },
    {
      id: "minecraft",
      title: "Minecraft EULA and online mode",
      body: (
        <>
          <p>
            Every server hosted with us must comply with the <strong>Minecraft End User License Agreement</strong> and Mojang's <strong>Usage Guidelines</strong>. Notably:
          </p>
          <ul>
            <li><strong>Online mode stays on.</strong> Servers must authenticate players against Mojang's servers. "Offline mode" (which lets pirated clients join) is only permitted on backend servers behind a proxy that performs the authentication itself.</li>
            <li><strong>Monetize within the rules.</strong> You may charge for access to your server, accept donations, and sell cosmetics — but the EULA prohibits selling gameplay advantages, and it's your job to know where that line is.</li>
            <li><strong>Don't pretend to be official.</strong> Don't use "Minecraft" as the leading word in your server's name, don't use Mojang's or Microsoft's logos, and make clear that your server isn't affiliated with them.</li>
          </ul>
          <p>
            {E.name} itself is not affiliated with Mojang AB or Microsoft, and we'll comply with any legitimate request from them regarding servers on our platform.
          </p>
        </>
      ),
    },
    {
      id: "security",
      title: "Account and system security",
      body: (
        <>
          <ul>
            <li>Keep your control-panel credentials private, use a strong unique password, and enable two-factor authentication when it's available. Only give sub-user access to people you trust.</li>
            <li>Don't attempt to access other customers' servers, our management systems, or any data that isn't yours — even to "see if you can".</li>
            <li>If you discover a security vulnerability in the Service, tell us at <a href={"mailto:" + E.abuseEmail}>{E.abuseEmail}</a> and give us a reasonable chance to fix it before disclosing it. We won't take action against good-faith research that follows this rule.</li>
            <li>Don't upload or run malware on your server, and don't disable or work around security measures we've put in place.</li>
          </ul>
        </>
      ),
    },
    {
      id: "reselling",
      title: "Reselling and sharing",
      body: (
        <>
          <p>
            Plans are for your own server and community. You may not resell, sublease, or otherwise provide {E.name} hosting to third parties as a service — for example, splitting one plan into "servers" you sell to other people — without our written permission. Giving your own staff panel access, or charging your players for access to your server in line with the Minecraft EULA, is fine.
          </p>
        </>
      ),
    },
    {
      id: "reporting",
      title: "Reporting abuse",
      body: (
        <>
          <p>
            To report a {E.name}-hosted server that's violating this policy, email <a href={"mailto:" + E.abuseEmail}>{E.abuseEmail}</a> with the server's address, what you observed, when, and any evidence (logs, screenshots). We investigate every report, but we can't always tell you the outcome. Copyright complaints should follow the DMCA process in the <Link to="/legal/terms#copyright">Terms</Link>. We cooperate with law enforcement on lawful requests.
          </p>
        </>
      ),
    },
    {
      id: "enforcement",
      title: "Enforcement",
      body: (
        <>
          <p>
            We decide how to respond to a violation based on how serious it is, whether it's a first offense, and whether it's ongoing. Depending on that, we may: warn you and ask you to fix it; throttle or limit the server; remove or disable specific content; suspend the server or account; terminate the account; and/or preserve evidence and report to authorities. For urgent or severe violations — attacks in progress, illegal content, credible legal demands — we may act without warning.
          </p>
          <p>
            <strong>Suspensions and terminations under this policy are not refunded.</strong> If you believe we've made a mistake, reply to the notice we sent or email <a href={"mailto:" + E.supportEmail}>{E.supportEmail}</a> and we'll take a second look.
          </p>
        </>
      ),
    },
    {
      id: "changes",
      title: "Changes",
      body: (
        <>
          <p>
            We may update this policy as the Service and the threats to it evolve. The "Last updated" date shows the current version; material changes are announced the same way as changes to the <Link to="/legal/terms#changes">Terms</Link>. Questions: <a href={"mailto:" + E.legalEmail}>{E.legalEmail}</a>.
          </p>
        </>
      ),
    },
  ],
};
