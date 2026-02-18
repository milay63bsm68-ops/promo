import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";

dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json({ limit: "25mb" }));

const { BOT_TOKEN, ADMIN_ID } = process.env;

/* ========================= LOG ENV ========================= */
console.log("=".repeat(50));
console.log("BOT_TOKEN:", BOT_TOKEN ? "SET ✅" : "MISSING ❌");
console.log("ADMIN_ID:", ADMIN_ID || "MISSING ❌");
console.log("=".repeat(50));

/* ========================= TELEGRAM FUNCTIONS ========================= */
async function sendTelegram(text, chatId) {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: Number(chatId),
          text,
          parse_mode: "HTML"
        })
      }
    );

    return await res.json();
  } catch (err) {
    console.error("❌ sendMessage error:", err.message);
    return { ok: false };
  }
}

async function sendTelegramPhoto(chatId, base64Image, caption) {
  try {
    console.log("📸 Preparing photo for Telegram...");

    // Remove base64 header if exists
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("photo", buffer, {
      filename: "promo.jpg",
      contentType: "image/jpeg"
    });

    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      {
        method: "POST",
        body: form
      }
    );

    const data = await res.json();

    if (!data.ok) {
      console.error("❌ Telegram sendPhoto error:", data);
    } else {
      console.log("✅ Photo sent to admin");
    }

    return data;
  } catch (err) {
    console.error("❌ sendPhoto exception:", err.message);
    return { ok: false, error: err.message };
  }
}

/* ========================= ROUTES ========================= */
app.get("/", (req, res) => {
  res.json({ status: "Server running ✅" });
});

app.post("/unlock-promo", async (req, res) => {
  const {
    telegramId,
    name,
    username,
    method,
    whatsapp,
    call,
    image,
    type
  } = req.body;

  if (!telegramId || !image) {
    return res.status(400).json({ error: "Missing telegramId or image" });
  }

  const caption = `
<b>🟢 PROMO ${type === "task" ? "TASK" : "PAYMENT"}</b>
Name: ${name || "N/A"}
Username: ${username || "N/A"}
Telegram ID: ${telegramId}
Method: ${method || "Task"}
WhatsApp: ${whatsapp || "N/A"}
Call: ${call || "N/A"}
Status: Pending admin review
`;

  try {
    console.log("📤 Sending submission to admin...");
    const adminResult = await sendTelegramPhoto(
      ADMIN_ID,
      image,
      caption
    );

    if (!adminResult.ok) {
      throw new Error("Telegram rejected photo");
    }

    await sendTelegram(
      "✅ Your submission has been sent to admin for review.",
      telegramId
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Submission error:", err.message);
    res.status(500).json({
      error: "Failed to send to admin",
      details: err.message
    });
  }
});

/* ========================= HEALTH ========================= */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    botToken: BOT_TOKEN ? "SET" : "MISSING",
    adminId: ADMIN_ID
  });
});

/* ========================= START ========================= */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});