import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*", methods: ["GET","POST"] }));
app.use(express.json({ limit: "25mb" }));

const { BOT_TOKEN, ADMIN_ID } = process.env;

/* ========================= TELEGRAM SEND FUNCTIONS ========================= */
async function sendTelegram(text, chatId){
  if(!BOT_TOKEN || !chatId) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ chat_id:Number(chatId), text, parse_mode:"HTML" })
  });
}

async function sendTelegramPhoto(chatId, photoBase64, caption){
  if(!BOT_TOKEN || !chatId) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ chat_id:Number(chatId), photo:photoBase64, caption, parse_mode:"HTML" })
  });
}

/* ========================= SERVE HTML ========================= */
app.get("/", (req,res) => res.sendFile(path.join(__dirname,"unlockpremium.html")));

/* ========================= UNLOCK PROMO ENDPOINT ========================= */
app.post("/unlock-promo", async (req,res) => {
  const { telegramId, name, username, method, whatsapp, call, image, type } = req.body;

  if(!telegramId || !image) return res.status(400).json({ error:"Missing data" });

  const caption = `
<b>🟢 PROMO ${type === "task" ? "TASK" : "PAYMENT"} SUBMISSION</b>
Name: ${name}
Username: ${username}
ID: ${telegramId}
Method: ${method || "Task"}
WhatsApp: ${whatsapp || "N/A"}
Call: ${call || "N/A"}
Status: Pending review by admin
`;

  try {
    // Send to admin with photo on top
    await sendTelegramPhoto(ADMIN_ID, image, caption);

    // Notify user
    await sendTelegram(`✅ Your ${type} submission has been received. Admin will review it shortly.`, telegramId);

    res.json({ success:true, message:"Submission sent to admin" });
  } catch(err){
    console.error(err);
    res.status(500).json({ error:"Failed to send submission" });
  }
});

/* ========================= START SERVER ========================= */
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
