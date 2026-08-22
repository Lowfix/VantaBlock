import "./loadEnv.js";
import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { accountRouter } from "./routes/account.js";
import { serversRouter } from "./routes/servers.js";
import { bankRouter } from "./routes/bank.js";
import { accountsRouter } from "./routes/accounts.js";
import { overviewRouter } from "./routes/overview.js";
import { ownerConsoleRouter } from "./routes/ownerConsole.js";
import { requestsRouter } from "./routes/requests.js";
import { billingRouter } from "./routes/billing.js";
import { publicStatsRouter } from "./routes/publicStats.js";
import { supportRouter } from "./routes/support.js";
import { handleStripeWebhookEvent } from "./stripeBilling.js";
import { resumeInterruptedProvisioning } from "./provisioning.js";
import "./db.js";

const app = express();
const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 3001;

// nginx (the only real hop between this process and the outside world — see
// INFRASTRUCTURE.md) sets X-Forwarded-For/X-Real-IP correctly, but Express
// ignores those by default and reports every request as coming from nginx's
// own loopback connection. Without this, rate limiting keyed on `req.ip`
// would bucket every real visitor together under "127.0.0.1" — trusting
// exactly one hop back is what makes `req.ip` resolve to the real client.
app.set("trust proxy", 1);

// Stripe's signature check needs the exact raw request bytes, so this has to be
// registered before the global JSON body parser below — express.json() would
// otherwise consume and reserialize the body, breaking the signature.
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    res.status(400).send("Missing Stripe signature.");
    return;
  }
  try {
    await handleStripeWebhookEvent(req.body, signature);
    res.json({ received: true });
  } catch (err) {
    console.warn("[stripe] webhook error:", err instanceof Error ? err.message : err);
    res.status(400).send("Webhook error.");
  }
});

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/account", accountRouter);
app.use("/api/servers", serversRouter);
app.use("/api/bank", bankRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/overview", overviewRouter);
app.use("/api/owner", ownerConsoleRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/billing", billingRouter);
app.use("/api/public/stats", publicStatsRouter);
app.use("/api/support", supportRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Last-resort error handler. Must be registered after every router, and must
// keep all four parameters — Express identifies an error handler by arity, so
// dropping `_next` silently turns this back into ordinary middleware.
//
// Without this, anything a route throws fell through to Express's built-in
// handler, which answers with an **HTML** page — `<pre>Internal Server Error</pre>`
// in production, and the full stack trace including absolute filesystem paths
// when NODE_ENV isn't set. Both are wrong for a JSON API: every fetch in `src/`
// expects `{ error }`, so an HTML body degrades into a generic "something went
// wrong" toast with no usable message.
//
// The SQLite cases are the ones that actually show up under load (verified by
// deliberately holding a write lock from a second process while hammering the
// API):
//   - SQLITE_BUSY / SQLITE_BUSY_SNAPSHOT — another process held the write lock
//     past db.ts's busy_timeout. Genuinely transient, so it gets a 503 plus a
//     Retry-After rather than a 500: the client should just try again.
//   - SQLITE_CONSTRAINT_* — a uniqueness race (two requests both passed a
//     "is this taken?" check before either wrote). A 409 is the honest status,
//     and the raw SQL text ("UNIQUE constraint failed: servers.subdomain") stays
//     server-side instead of being shown to a customer.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const code = typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
  const message = err instanceof Error ? err.message : String(err);

  console.error("[api] unhandled error:", code ?? "", message, err instanceof Error ? err.stack : "");

  // Express can't rewrite a response whose headers already went out — hand it
  // back so the built-in handler can destroy the socket instead.
  if (res.headersSent) {
    _next(err);
    return;
  }

  if (code === "SQLITE_BUSY" || code === "SQLITE_BUSY_SNAPSHOT" || code === "SQLITE_BUSY_TIMEOUT") {
    res.setHeader("Retry-After", "1");
    res.status(503).json({ error: "The server is busy right now. Please try that again in a moment." });
    return;
  }
  if (typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT")) {
    res.status(409).json({ error: "That change conflicts with something that already exists. Refresh and try again." });
    return;
  }

  // Respect a 4xx the thrower already classified, instead of relabelling it 500.
  // `express.json()` throws a SyntaxError carrying `status: 400` for a malformed
  // body (the http-errors convention Express's own default handler honours) —
  // without this, a client sending bad JSON gets told *we* failed, which is both
  // wrong and a good way to bury real 500s in monitoring noise. Caught on
  // production right after this handler first shipped: a malformed body returned
  // 500 where the built-in handler had correctly returned 400.
  const rawStatus = (err as { status?: unknown; statusCode?: unknown } | null)?.status;
  const rawStatusCode = (err as { status?: unknown; statusCode?: unknown } | null)?.statusCode;
  const status = typeof rawStatus === "number" ? rawStatus : typeof rawStatusCode === "number" ? rawStatusCode : undefined;
  if (status !== undefined && status >= 400 && status < 500) {
    res.status(status).json({
      error: status === 400 ? "That request was malformed or couldn't be read." : "That request couldn't be completed.",
    });
    return;
  }

  res.status(500).json({ error: "Something went wrong on our end. Please try again." });
});

// Loopback-only — nginx is the only thing that ever needs to reach this
// process (see INFRASTRUCTURE.md's topology), and it already connects via
// 127.0.0.1. Binding to every interface (the default with no host argument)
// meant this was reachable directly over the LAN, bypassing nginx/Cloudflare
// entirely — confirmed for real with a direct curl from another machine.
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Vantablock API listening on http://127.0.0.1:${PORT}`);
  // A deploy's install watcher only lives in this process's memory, so anything
  // still 'installing' when the API last stopped (a restart mid-deploy, a
  // crash) would sit at "Installing…" forever otherwise.
  resumeInterruptedProvisioning();
});

// The monthly billing cron (server/billingCron.ts) is deliberately not started —
// this phase runs free for friends with no top-ups, so charging balances and
// suspending servers for non-payment would just be a bug. Re-enable this call
// (and the setInterval loop that used to follow it) when real pricing comes back.
