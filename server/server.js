import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;
const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

const JWT_SECRET =
  process.env.JWT_SECRET || "change-this-secret";

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

// ====================
// USER MODEL
// ====================

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30
    },

    password: {
      type: String,
      required: true
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

const User = mongoose.model("User", userSchema);

// ====================
// MESSAGE MODEL
// ====================

const messageSchema = new mongoose.Schema(
  {
    from: {
      type: String,
      required: true
    },

    to: {
      type: String,
      required: true
    },

    text: {
      type: String,
      required: true,
      maxlength: 2000
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

const Message = mongoose.model("Message", messageSchema);

// ====================
// JWT AUTH
// ====================

function createToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      username: user.username
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Login required"
      });
    }

    const token = header.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired login"
    });
  }
}

// ====================
// HEALTH
// ====================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Orbit server is running"
  });
});

// ====================
// SIGN UP
// ====================

app.post("/api/auth/signup", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: "Database is not connected"
      });
    }

    const username = String(req.body.username || "")
      .trim()
      .toLowerCase();

    const password = String(req.body.password || "");

    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters"
      });
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        message:
          "Username can contain only letters, numbers and _"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters"
      });
    }

    const existingUser = await User.findOne({
      username
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Username already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    const user = await User.create({
      username,
      password: hashedPassword
    });

    const token = createToken(user);

    res.status(201).json({
      success: true,
      message: "Account created",
      token,
      user: {
        id: user._id,
        username: user.username
      }
    });
  } catch (error) {
    console.error("Signup error:", error);

    res.status(500).json({
      success: false,
      message: "Signup failed"
    });
  }
});

// ====================
// LOGIN
// ====================

app.post("/api/auth/login", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: "Database is not connected"
      });
    }

    const username = String(req.body.username || "")
      .trim()
      .toLowerCase();

    const password = String(req.body.password || "");

    const user = await User.findOne({
      username
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password"
      });
    }

    const passwordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password"
      });
    }

    const token = createToken(user);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username
      }
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});

// ====================
// CURRENT USER
// ====================

app.get(
  "/api/auth/me",
  authMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select(
        "_id username createdAt"
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      res.json({
        success: true,
        user
      });
    } catch {
      res.status(500).json({
        success: false,
        message: "Could not get user"
      });
    }
  }
);

// ====================
// SEARCH USERS
// ====================

app.get(
  "/api/users/search",
  authMiddleware,
  async (req, res) => {
    try {
      const q = String(req.query.q || "")
        .trim()
        .toLowerCase();

      if (!q) {
        return res.json([]);
      }

      const users = await User.find({
        username: {
          $regex: q,
          $options: "i"
        },
        _id: {
          $ne: req.user.id
        }
      })
        .select("_id username")
        .limit(20);

      res.json(users);
    } catch (error) {
      console.error("Search error:", error);

      res.status(500).json({
        success: false,
        message: "User search failed"
      });
    }
  }
);

// ====================
// GET CHAT HISTORY
// ====================

app.get(
  "/api/messages/:userId",
  authMiddleware,
  async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.json([]);
      }

      const me = req.user.id;
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
    } catch (error) {
      console.error("Messages error:", error);

      res.status(500).json({
        success: false,
        message: "Could not load messages"
      });
    }
  }
);

// ====================
// SOCKET.IO
// ====================

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (userId) => {
    if (userId) {
      socket.join(userId);
      console.log("Joined user room:", userId);
    }
  });

  socket.on(
    "typing",
    ({ userId, to }) => {
      if (to) {
        io.to(to).emit("typing", {
          userId
        });
      }
    }
  );

  socket.on(
    "message",
    async (message) => {
      try {
        if (
          !message.from ||
          !message.to ||
          !message.text
        ) {
          return;
        }

        const payload = {
          from: message.from,
          to: message.to,
          text: String(message.text).slice(0, 2000),
          createdAt: new Date()
        };

        if (mongoose.connection.readyState === 1) {
          await Message.create(payload);
        }

        io.to(payload.to).emit(
          "message",
          payload
        );

        // Also send back to sender
        io.to(payload.from).emit(
          "message",
          payload
        );
      } catch (error) {
        console.error(
          "Message error:",
          error
        );
      }
    }
  );

  socket.on("disconnect", () => {
    console.log(
      "User disconnected:",
      socket.id
    );
  });
});

// ====================
// MONGODB
// ====================

if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
      console.log("MongoDB connected");
    })
    .catch((error) => {
      console.error(
        "MongoDB connection failed:",
        error.message
      );
    });
} else {
  console.log(
    "MONGODB_URI not found"
  );
}

// ====================
// START SERVER
// ====================

server.listen(PORT, () => {
  console.log(
    `Server running at http://localhost:${PORT}`
  );
});
