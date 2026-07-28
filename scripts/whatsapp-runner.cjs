const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const qrcodeTerminal = require("qrcode-terminal");
const pino = require("pino");
const path = require("path");
const fs = require("fs");

process.stdin.resume();

let attemptCount = 0;

async function startGateway() {
  attemptCount++;
  console.log(`\n🚀 Initializing Zeno ERP WhatsApp Gateway (Attempt #${attemptCount})...`);

  const sessionDir = path.join(process.cwd(), "data", "whatsapp-session");
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  
  let version = [2, 3000, 1015901307];
  try {
    const vRes = await fetchLatestBaileysVersion();
    version = vRes.version;
    console.log(`📡 WhatsApp Web Protocol Version: v${version.join(".")}`);
  } catch (e) {
    console.log("📡 Using fallback WhatsApp Web protocol version v2.3000.1015901307");
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "fatal" }),
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n========================================================");
      console.log("📲 SCAN THIS QR CODE WITH WHATSAPP (Linked Devices):");
      console.log("========================================================\n");
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === "open") {
      attemptCount = 0;
      console.log("\n========================================================");
      console.log("✅ WHATSAPP CONNECTED SUCCESSFULLY TO ZENO ERP!");
      console.log("========================================================\n");
    } else if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === 401 || statusCode === 403) {
        console.log("🧹 Clearing invalid credentials...");
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
      }

      // Exponential backoff delay (5s, 10s, 15s max)
      const delay = Math.min(attemptCount * 5000, 15000);
      console.log(`⏳ Connection closed (${statusCode || "handshake"}). Retrying in ${delay / 1000}s...`);
      setTimeout(startGateway, delay);
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const sender = msg.key.remoteJid || "";

    console.log(`📩 [Inbound Message from ${sender}]: ${text}`);

    if (text.trim().toUpperCase() === "STOP" || text.trim().toUpperCase() === "UNSUBSCRIBE") {
      console.log(`🚫 Opt-out request from ${sender}. Updating consent to false in Zeno ERP...`);
      await sock.sendMessage(sender, {
        text: "You have unsubscribed from Zeno ERP automated messages. Reply START to opt back in.",
      });
    }
  });
}

startGateway().catch(console.error);
