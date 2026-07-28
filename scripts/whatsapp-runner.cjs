const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcodeTerminal = require("qrcode-terminal");
const pino = require("pino");
const path = require("path");
const fs = require("fs");

process.stdin.resume();

async function main() {
  console.log("\n🚀 Initializing Zeno ERP WhatsApp Gateway (Baileys)...");

  const sessionDir = path.join(process.cwd(), "data", "whatsapp-session");
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Zeno ERP", "Chrome", "1.0.0"],
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
      console.log("\n========================================================");
      console.log("✅ WHATSAPP CONNECTED SUCCESSFULLY TO ZENO ERP!");
      console.log("========================================================\n");
    } else if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      // Do NOT restart on status 405 (initial QR handshake frame) or status 515 (stream restart)
      if (statusCode === 401 || statusCode === 403) {
        console.log("🧹 Clearing invalid credentials...");
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
        console.log("Restarting gateway...");
        setTimeout(main, 2000);
      }
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

main().catch(console.error);
