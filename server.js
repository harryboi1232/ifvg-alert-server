const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(message) {
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: "HTML",
  });
}

function formatAlert(msg) {
  if (msg.includes("GAP TAP")) {
    return "🟣 <b>SPONSORED GAP TAPPED</b>\n" + msg;
  }

  const dir = msg.includes("LONG") ? "LONG" : "SHORT";
  const emoji = dir === "LONG" ? "🟢" : "🔴";
  const parts = {};

  msg.split("|").map(p => p.trim()).forEach(part => {
    if (part.includes("NQ") || part.includes("MNQ")) parts.instrument = part;
    if (part.startsWith("Entry")) parts.entry = part.replace("Entry", "").trim();
    if (part.startsWith("Stop")) parts.stop = part.replace("Stop", "").trim();
    if (part.startsWith("Target")) parts.target = part.replace("Target", "").trim();
    if (part.startsWith("Pts")) parts.pts = part.replace("Pts", "").trim();
    if (part.startsWith("RR")) parts.rr = part.replace("RR", "").trim();
    if (part.startsWith("Risk")) parts.risk = part.replace("Risk", "").trim();
    if (part.startsWith("Grade")) parts.grade = part.replace("Grade", "").trim();
    if (part.startsWith("Gap")) parts.gap = part.replace("Gap", "").trim();
    if (part.match(/^\d{2}:\d{2}$/)) parts.time = part;
  });

  return `${emoji} <b>${parts.instrument || "NQ"} ${dir} — ${parts.time || ""} EST</b>
━━━━━━━━━━━━━━
🎯 Entry: ${parts.entry || "—"}
🛑 Stop: ${parts.stop || "—"} (${parts.pts || "—"}pts)
💰 Target: ${parts.target || "—"}
📊 RR: ${parts.rr || "—"} | Grade: ${parts.grade || "—"}
💵 Risk: ${parts.risk || "—"} | ${parts.instrument || "NQ"}
🟣 Gap: ${parts.gap || "None"}
━━━━━━━━━━━━━━
${parts.grade && parts.grade.includes("A") ? "✅ High probability setup" : "⚠️ Confirm HTF bias"}`;
}

app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.message || JSON.stringify(req.body);
    console.log("Alert received:", msg);
    const formatted = formatAlert(msg);
    await sendTelegram(formatted);
    console.log("Alert sent successfully");
    res.json({ ok: true });
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("IFVG Alert Server running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server live on port " + PORT));
