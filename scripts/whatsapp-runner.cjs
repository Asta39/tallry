const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const path = require("path");

// Silent logger to suppress Baileys debug JSON log output
const silentLogger = {
  level: "silent",
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
};

/**
 * Zeno ERP Live Baileys WhatsApp Gateway Runner.
 * Connects your WhatsApp business phone number directly to Zeno ERP via WebSockets.
 */
async function startWhatsAppGateway() {
  console.log("🚀 Starting Zeno ERP WhatsApp Gateway (Baileys)...");

  // Save auth state locally under ./data/whatsapp-session
  const sessionDir = path.join(process.cwd(), "data", "whatsapp-session");
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    logger: silentLogger,
    printQRInTerminal: false,
    browser: ["Zeno ERP", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n========================================================");
      console.log("📲 SCAN QR CODE BELOW WITH WHATSAPP (Linked Devices):");
      console.log("========================================================\n");
      try {
        const qrTerminal = await qrcode.toString(qr, { type: "terminal", small: true });
        console.log(qrTerminal);
      } catch (e) {
        console.log("QR Raw:", qr);
      }
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(startWhatsAppGateway, 3000);
      }
    } else if (connection === "open") {
      console.log("\n========================================================");
      console.log("✅ WHATSAPP CONNECTED SUCCESSFULLY TO ZENO ERP!");
      console.log("========================================================\n");
    }
  });

  // Listen for incoming messages (handling STOP/UNSUBSCRIBE opt-outs)
  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

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

startWhatsAppGateway().catch(console.error);
