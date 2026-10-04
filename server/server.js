import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import mongoose from "mongoose";

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;
const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: CLIENT_URL
  })
);

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"]
  }
});

const messageSchema = new mongoose.Schema({
  from: String,
  to: String,
  text: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model(
  "Message",
  messageSchema
);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Orbit server is running"
  });
});

app.get("/api/messages/:userId", async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json([]);
  }

  const me = req.query.me || "demo-user";
  const other = req.params.userId;

  const messages = await Message.find({
    $or: [
      {
        from: me,
        to: other
      },
      {
        from: other,
        to: me
      }
    ]
  })
    .sort({ createdAt: 1 })
    .limit(200);

  res.json(messages);
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId);
  });

  socket.on("typing", ({ userId }) => {
    socket.broadcast.emit("typing", {
      userId
    });
  });

  socket.on("message", async (message) => {
    const payload = {
      ...message,
      createdAt: new Date()
    };

    if (mongoose.connection.readyState === 1) {
      try {
        await Message.create({
          from: message.from,
          to: message.to,
          text: message.text,
          createdAt: payload.createdAt
        });
      } catch (error) {
        console.error(error);
      }
    }

    if (message.to) {
      io.to(message.to).emit("message", payload);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(() =>
      console.log(
        "MongoDB unavailable — demo mode enabled"
      )
    );
}

server.listen(PORT, () => {
  console.log(
    `Server running at http://localhost:${PORT}`
  );
});
