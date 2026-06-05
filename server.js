const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

async function sendTelegram(message) {
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: "HTML",
  });
}

async function claudeFormat(rawMessage) {
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: "You are a trading alert formatter. Format this raw ICT IFVG trading alert into a clean Telegram message. Use emojis. Keep it concise. Use exactly the numbers given, do not change any values.\n\nRaw alert: " + rawMessage + "\n\nFormat like this example:\n🟢 <b>NQ LONG — 10:14 EST</b>\n━━━━━━━━━━━━━━\n🎯 Entry: 21,228.50\n🛑 Stop: 21,219.00 (9.5pts)\n💰 Target: 21,274.00 (46pts)\n📊 RR: 1:4.8 | Grade: A+\n💵 Risk: $190 | NQ x1\n🟣 Gap: NDOG tapped\n━━━━━━━━━━━━━━\n✅ High probability setup\n\nFor SHORT use 🔴 instead of 🟢. Only output the formatted message, nothing else."
        }
      ]
    },
    {
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
    }
  );
  return response.data.content[0].text;
}

app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.message || JSON.stringify(req.body);
    console.log("Alert received:", msg);
    console.log("Using model: claude-haiku-4-5-20251001");

    if (typeof msg === "string" && msg.includes("GAP TAP")) {
      await sendTelegram("🟣 <b>SPONSORED GAP TAPPED</b>\n" + msg);
      return res.json({ ok: true });
    }

    const formatted = await claudeFormat(msg);
    console.log("Claude response received, sending to Telegram");
    await sendTelegram(formatted);
    console.log("Alert sent successfully");
    res.json({ ok: true });
  } catch (err) {
    const errDetail = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error("Error detail:", errDetail);
    res.status(500).json({ error: errDetail });
  }
});

app.get("/", (req, res) => res.send("IFVG Alert Server running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server live on port " + PORT));
