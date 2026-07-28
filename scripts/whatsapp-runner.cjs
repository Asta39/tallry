const baileys = require("@whiskeysockets/baileys");
const makeWASocket = baileys.default || baileys.makeWASocket;
const { useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, DisconnectReason } = baileys;
const qrcodeTerminal = require("qrcode-terminal");
const pino = require("pino");
const path = require("path");
const fs = require("fs");

/**
 * WhatsApp gateway.
 *
 * WhatsApp rate-limits connection attempts per IP and refuses with a 405
 * ("Connection Failure") before it will issue a QR. Retrying tightly and
 * indefinitely is what earns that block in the first place, so retries here
 * are exponential with jitter and give up instead of hammering.
 */

const SESSION_DIR = path.join(process.cwd(), "data", "whatsapp-session");
const MAX_ATTEMPTS = 6;
const BASE_DELAY_MS = 5000;
const MAX_DELAY_MS = 5 * 60 * 1000;

let attempt = 0;
let connected = false;

function backoffMs() {
  const exp = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
  return Math.round(exp * (0.75 + Math.random() * 0.5)); // jitter so retries don't sync up
}

function explain(statusCode) {
  switch (statusCode) {
    case 405:
      return [
        "WhatsApp refused the connection (405) before issuing a QR.",
        "   This is a per-IP rate limit from too many connection attempts, not bad credentials.",
        "   Wait 30-60 minutes, or run from a different network. Retrying now extends the block.",
      ].join("\n");
    case 401:
      return "Credentials rejected (401) — the linked device was probably removed from the phone.";
    case 403:
      return "Forbidden (403) — this number may be blocked or flagged by WhatsApp.";
    case 428:
      return "Connection terminated (428) before pairing completed.";
    case 440:
      return "Session replaced (440) — this session was opened somewhere else.";
    case 515:
      return "Restart required (515) — normal right after pairing.";
    default:
      return `Connection closed with status ${statusCode ?? "unknown"}.`;
  }
}

function scheduleRetry(reason) {
  if (connected) return;
  if (attempt >= MAX_ATTEMPTS) {
    console.error(`\n❌ Giving up after ${MAX_ATTEMPTS} attempts.`);
    console.error(`   ${reason}`);
    console.error("   Nothing will be retried automatically — rerun `npm run whatsapp` when ready.\n");
    process.exit(1);
  }
  const delay = backoffMs();
  console.log(`⏳ Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${MAX_ATTEMPTS})...`);
  setTimeout(startGateway, delay);
}

async function startGateway() {
  attempt++;
  console.log(`\n🚀 Starting Zeno WhatsApp gateway (attempt ${attempt}/${MAX_ATTEMPTS})...`);

  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const hasCreds = !!state.creds?.registered;

  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
    console.log(
      `📡 WhatsApp Web protocol v${version.join(".")}` +
        (hasCreds ? " · resuming saved session" : " · pairing a new device")
    );
  } catch (e) {
    console.error(`⚠️  Could not fetch the protocol version (${e.message}) — using the library default.`);
  }

  const sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    // "warn" surfaces real protocol errors. Silencing this hid the cause of
    // every failure and made a rate limit look like a handshake in progress.
    logger: pino({ level: process.env.WA_DEBUG ? "debug" : "warn" }),
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n========================================================");
      console.log("📲 Scan this QR in WhatsApp → Settings → Linked Devices");
      console.log("========================================================\n");
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === "open") {
      connected = true;
      attempt = 0;
      console.log("\n✅ Connected to WhatsApp.\n");
      return;
    }

    if (connection !== "close") return;

    connected = false;
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    console.log(`\n🔌 Disconnected — ${explain(statusCode)}`);

    // Only wipe credentials when WhatsApp says they're invalid. A 405 is a rate
    // limit, not a bad session — deleting creds there forces a needless re-pair
    // and another QR request into the same block.
    if (statusCode === DisconnectReason?.loggedOut || statusCode === 401 || statusCode === 403) {
      console.log("🧹 Clearing invalid credentials — you'll need to scan a new QR.");
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }

    // 515 is WhatsApp's normal "restart required" immediately after pairing.
    if (statusCode === DisconnectReason?.restartRequired || statusCode === 515) {
      attempt = 0;
      setTimeout(startGateway, 1000);
      return;
    }

    scheduleRetry(explain(statusCode));
  });

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages?.[0];
    if (!msg?.message || msg.key.fromMe) return;

    const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
    const sender = msg.key.remoteJid || "";
    if (!sender) return;

    console.log(`📩 ${sender}: ${text}`);

    const cmd = text.toUpperCase();
    try {
      if (cmd === "STOP" || cmd === "UNSUBSCRIBE") {
        await sock.sendMessage(sender, {
          text: "You have unsubscribed from Zeno automated messages. Reply START to opt back in.",
        });
      } else if (cmd === "START") {
        await sock.sendMessage(sender, {
          text: "You're resubscribed to Zeno automated messages. Reply STOP to opt out.",
        });
      }
    } catch (e) {
      // A send failure must not take the gateway down.
      console.error(`⚠️  Failed to reply to ${sender}: ${e.message}`);
    }
  });
}

process.on("unhandledRejection", (e) => {
  console.error("⚠️  Unhandled rejection:", e?.message || e);
});

startGateway().catch((e) => {
  console.error("❌ Gateway failed to start:", e?.message || e);
  process.exit(1);
});
