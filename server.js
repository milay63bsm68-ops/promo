import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json({ limit: "25mb" }));

const { BOT_TOKEN, ADMIN_ID } = process.env;

// Validate environment variables
if (!BOT_TOKEN || !ADMIN_ID) {
  console.error("❌ ERROR: Missing BOT_TOKEN or ADMIN_ID in .env file");
  console.log("BOT_TOKEN:", BOT_TOKEN ? "Set ✅" : "Missing ❌");
  console.log("ADMIN_ID:", ADMIN_ID ? ADMIN_ID : "Missing ❌");
  process.exit(1);
}

console.log("✅ Environment variables loaded:");
console.log("BOT_TOKEN:", BOT_TOKEN ? "Set ✅" : "Missing ❌");
console.log("ADMIN_ID:", ADMIN_ID);

/* ========================= TELEGRAM SEND FUNCTIONS ========================= */
async function sendTelegram(text, chatId) {
  if (!BOT_TOKEN || !chatId) {
    console.log("❌ Missing BOT_TOKEN or chatId");
    return { ok: false, error: "Missing credentials" };
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: Number(chatId), 
        text, 
        parse_mode: "HTML" 
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      console.error("❌ Telegram sendMessage error:", data);
    } else {
      console.log("✅ Message sent to:", chatId);
    }
    
    return data;
  } catch (err) {
    console.error("❌ Error sending Telegram message:", err.message);
    return { ok: false, error: err.message };
  }
}

async function sendTelegramPhoto(chatId, photoBase64, caption) {
  if (!BOT_TOKEN || !chatId) {
    console.log("❌ Missing BOT_TOKEN or chatId");
    return { ok: false, error: "Missing credentials" };
  }
  
  try {
    console.log("📸 Sending photo to admin:", chatId);
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: Number(chatId), 
        photo: photoBase64, 
        caption, 
        parse_mode: "HTML" 
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      console.error("❌ Telegram sendPhoto error:", data);
    } else {
      console.log("✅ Photo sent to admin successfully");
    }
    
    return data;
  } catch (err) {
    console.error("❌ Error sending Telegram photo:", err.message);
    return { ok: false, error: err.message };
  }
}

/* ========================= SERVE HTML ========================= */
app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "unlockpremium.html");
  console.log("📄 Serving HTML from:", filePath);
  res.sendFile(filePath);
});

/* ========================= UNLOCK PROMO ENDPOINT ========================= */
app.post("/unlock-promo", async (req, res) => {
  console.log("📥 Received unlock-promo request");
  
  const { telegramId, name, username, method, whatsapp, call, image, type } = req.body;

  // Validate required fields
  if (!telegramId || !image) {
    console.log("❌ Missing required data:", { telegramId, hasImage: !!image });
    return res.status(400).json({ error: "Missing telegramId or image" });
  }

  const caption = `
<b>🟢 PROMO ${type === "task" ? "TASK" : "PAYMENT"} SUBMISSION</b>
Name: ${name || "N/A"}
Username: ${username || "N/A"}
ID: ${telegramId}
Method: ${method || "Task"}
WhatsApp: ${whatsapp || "N/A"}
Call: ${call || "N/A"}
Status: Pending review by admin
`;

  console.log("📋 Submission details:", {
    telegramId,
    name,
    username,
    type,
    method,
    adminId: ADMIN_ID
  });

  try {
    // Send to admin with photo on top
    console.log("📤 Sending to admin ID:", ADMIN_ID);
    const photoResult = await sendTelegramPhoto(ADMIN_ID, image, caption);
    
    if (!photoResult.ok) {
      throw new Error(`Failed to send photo to admin: ${photoResult.error || JSON.stringify(photoResult)}`);
    }

    // Notify user
    console.log("📤 Notifying user:", telegramId);
    const userResult = await sendTelegram(
      `✅ Your ${type || "submission"} has been received. Admin will review it shortly.`, 
      telegramId
    );
    
    if (!userResult.ok) {
      console.log("⚠️ Warning: Could not notify user, but admin was notified");
    }

    console.log("✅ Submission processed successfully");
    res.json({ success: true, message: "Submission sent to admin" });
    
  } catch (err) {
    console.error("❌ Error processing submission:", err.message);
    console.error("Error details:", err);
    res.status(500).json({ 
      error: "Failed to send submission", 
      details: err.message 
    });
  }
});

/* ========================= HEALTH CHECK ========================= */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    botToken: BOT_TOKEN ? "Set" : "Missing",
    adminId: ADMIN_ID || "Missing",
    timestamp: new Date().toISOString()
  });
});

/* ========================= START SERVER ========================= */
app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Bot Token: ${BOT_TOKEN ? "Configured ✅" : "Missing ❌"}`);
  console.log(`👤 Admin ID: ${ADMIN_ID || "Missing ❌"}`);
  console.log("=".repeat(50));
});
