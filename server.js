require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// ✅ Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// ✅ Define MongoDB Schema & Model
const reportSchema = new mongoose.Schema({
  loop: String,
  section: String,
  status: { type: String, default: "green" },
  assigned: { type: String, default: null },
  remark: { type: String, default: "" },
  timestamp: { 
    type: String, 
    default: () => new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }) 
  }
});

const Report = mongoose.model("Report", reportSchema);

// ✅ Backend status check
app.get("/", (req, res) => res.send("Backend is running..."));

// ✅ Get all reports
app.get("/reports", async (req, res) => {
  try {
    const reports = await Report.find({}, "loop section status assigned remark timestamp");
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Create or Update a Report (with Manila time)
app.post("/report", async (req, res) => {
  const { loop, section, status, assigned, remark } = req.body;
  try {
    let report = await Report.findOne({ loop, section });
    const manilaTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });

    if (report) {
      report.status = status;
      report.assigned = assigned;
      report.remark = remark || report.remark;
      report.timestamp = manilaTime;
      await report.save();
    } else {
      report = new Report({ loop, section, status, assigned, remark: remark || "", timestamp: manilaTime });
      await report.save();
    }
    io.emit("newReport", report);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Resolve a Report (set status to green, clear remark, update timestamp)
app.post("/resolve/:id", async (req, res) => {
  try {
    const manilaTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: "green", remark: "", timestamp: manilaTime },
      { new: true }
    );
    if (report) {
      io.emit("resolveReport", { id: report._id });
      res.json({ success: true, id: report._id });
    } else {
      res.status(404).json({ error: "Report not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ WebSocket Connection
io.on("connection", (socket) => {
  console.log("🔌 A user connected");
  socket.on("disconnect", () => console.log("❌ A user disconnected"));
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
