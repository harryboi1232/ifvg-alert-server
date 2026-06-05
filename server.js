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

app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.message || JSON.stringify(req.body);
    console.log("Alert received:", msg);

    // Log the API key prefix so we can verify it
    console.log("API key starts with:", ANTHROPIC_KEY ? ANTHROPIC_KEY.substring(0, 10) : "NOT SET");

    // Send directly to Telegram first to test that pipeline
    await sendTelegram("🔔 <b>Test Alert Received</b>\n\n" + msg);

    res.json({ ok: true });
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("IFVG Alert Server running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
