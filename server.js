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

async function claudeFormat(alertData) {
  const prompt = `You are a trading assistant. Format this ICT IFVG trading alert into a clean, concise Telegram message. Use emojis. Be brief and clear. Include all the numbers exactly as given.

Alert data: ${JSON.stringify(alertData)}

Format it like this example:
🟢 NQ LONG — 10:14 EST
━━━━━━━━━━━━━━
🎯 Entry: 21,228
🛑 Stop: 21,219 (9pts)
💰 Target: 21,274 (46pts)
📊 RR: 1:5.1 | Grade: A+
💵 Risk: $180 | NQ x1
🟣 Gap: NDOG tapped
━━━━━━━━━━━━━━
✅ High probability setup`;

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
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
    const raw = req.body;
    console.log("Alert received:", raw);

    // Parse the alert message string from TradingView
    const msg = raw.message || raw;
    let parsed = {};

    if (typeof msg === "string") {
      // Parse key-value pairs from alert string
      // Format: "LONG IFVG | NQ x1 | Entry 21228 | Stop 21219 ..."
      const parts = msg.split("|").map((p) => p.trim());
      parts.forEach((part) => {
        if (part.includes("LONG") || part.includes("SHORT")) {
          parsed.direction = part.includes("LONG") ? "LONG" : "SHORT";
          parsed.type = "IFVG";
        }
        if (part.startsWith("Entry")) parsed.entry = part.replace("Entry", "").trim();
        if (part.startsWith("Stop")) parsed.stop = part.replace("Stop", "").trim();
        if (part.startsWith("Target")) parsed.target = part.replace("Target", "").trim();
        if (part.startsWith("Pts")) parsed.stop_pts = part.replace("Pts", "").trim();
        if (part.startsWith("RR")) parsed.rr = part.replace("RR", "").trim();
        if (part.startsWith("Risk")) parsed.risk = part.replace("Risk", "").trim();
        if (part.startsWith("Grade")) parsed.grade = part.replace("Grade", "").trim();
        if (part.startsWith("Gap")) parsed.gap = part.replace("Gap", "").trim();
        if (part.includes("NQ") || part.includes("MNQ")) parsed.instrument = part;
        // Last part is time
        if (part.match(/^\d{2}:\d{2}$/)) parsed.time = part + " EST";
      });
    } else {
      parsed = msg;
    }

    // Handle gap tap alerts separately
    if (typeof msg === "string" && msg.includes("GAP TAP")) {
      const gapMsg = `🟣 <b>SPONSORED GAP TAPPED</b>\n${msg}`;
      await sendTelegram(gapMsg);
      return res.json({ ok: true });
    }

    // Format via Claude
    const formatted = await claudeFormat(parsed);
    await sendTelegram(formatted);

    res.json({ ok: true });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("IFVG Alert Server running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
