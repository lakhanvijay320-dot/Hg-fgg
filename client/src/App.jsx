import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Search,
  Send,
  CheckCheck,
  LogOut,
  UserPlus,
  LogIn,
  Menu,
  X
} from "lucide-react";

const SERVER =
  import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

function Avatar({ username, small = false }) {
  const letters = username
    ? username.slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className={`avatar blue ${small ? "small" : ""}`}>
      {letters}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("orbit_token") || ""
  );

  const [me, setMe] = useState(null);
  const [mode, setMode] = useState("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const bottomRef = useRef(null);

  const socket = useMemo(() => {
    return io(SERVER, {
      autoConnect: false
    });
  }, []);

  // =========================
  // GET CURRENT USER
  // =========================

  useEffect(() => {
    if (!token) return;

    fetch(`${SERVER}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(async (res) => {
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Login expired");
        }

        setMe(data.user);
      })
      .catch(() => {
        localStorage.removeItem("orbit_token");
        setToken("");
        setMe(null);
      });
  }, [token]);

  // =========================
  // SOCKET
  // =========================

  useEffect(() => {
    if (!me) return;

    socket.connect();

    socket.on("connect", () => {
      socket.emit("join", me._id);
    });

    socket.on("message", (message) => {
      const isMyChat =
        selected &&
        (
          (message.from === me._id &&
            message.to === selected._id) ||
          (message.from === selected._id &&
            message.to === me._id)
        );

      if (isMyChat) {
        setMessages((prev) => {
          const exists = prev.some(
            (item) =>
              item.createdAt === message.createdAt &&
              item.text === message.text &&
              item.from === message.from
          );

          if (exists) return prev;

          return [...prev, message];
        });
      }
    });

    return () => {
      socket.off("connect");
      socket.off("message");
      socket.disconnect();
    };
  }, [me, selected]);

  // =========================
  // SCROLL
  // =========================

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);

  // =========================
  // LOGIN / SIGNUP
  // =========================

  async function handleAuth(e) {
    e.preventDefault();

    setAuthError("");

    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername || !password) {
      setAuthError("Username aur password required hai.");
      return;
    }

    setAuthLoading(true);

    try {
      const endpoint =
        mode === "login"
          ? "/api/auth/login"
          : "/api/auth/signup";

      const response = await fetch(
        `${SERVER}${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username: cleanUsername,
            password
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Something went wrong"
        );
      }

      localStorage.setItem(
        "orbit_token",
        data.token
      );

      setToken(data.token);
      setMe(data.user);

      setUsername("");
      setPassword("");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // =========================
  // LOGOUT
  // =========================

  function logout() {
    localStorage.removeItem("orbit_token");

    setToken("");
    setMe(null);
    setUsers([]);
    setSelected(null);
    setMessages([]);
    setText("");
  }

  // =========================
  // SEARCH USERS
  // =========================

  async function searchUsers(value) {
    setSearch(value);

    if (!value.trim() || !token) {
      setUsers([]);
      return;
    }

    setLoadingUsers(true);

    try {
      const response = await fetch(
        `${SERVER}/api/users/search?q=${encodeURIComponent(
          value
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (response.ok) {
        setUsers(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingUsers(false);
    }
  }

  // =========================
  // OPEN CHAT
  // =========================

  async function openChat(user) {
    setSelected(user);
    setMessages([]);
    setUsers([]);
    setSearch("");

    setLoadingMessages(true);

    try {
      const response = await fetch(
        `${SERVER}/api/messages/${user._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessages(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMessages(false);
    }
  }

  // =========================
  // SEND MESSAGE
  // =========================

  function sendMessage() {
    const value = text.trim();

    if (!value || !selected || !me) return;

    const message = {
      from: me._id,
      to: selected._id,
      text: value
    };

    socket.emit("message", message);

    setText("");
  }

  // =========================
  // AUTH SCREEN
  // =========================

  if (!me) {
    return (
      <div className="auth-page">
        <div className="auth-card">

          <div className="logo">✦</div>

          <h1>Orbit</h1>

          <p>
            {mode === "login"
              ? "Welcome back"
              : "Create your account"}
          </p>

          <form onSubmit={handleAuth}>

            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              autoComplete="username"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
            />

            {authError && (
              <div className="auth-error">
                {authError}
              </div>
            )}

            <button
              className="auth-button"
              disabled={authLoading}
            >
              {authLoading ? (
                "Please wait..."
              ) : mode === "login" ? (
                <>
                  <LogIn size={18} />
                  Login
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Create account
                </>
              )}
            </button>
          </form>

          <button
            className="switch-auth"
            onClick={() => {
              setMode(
                mode === "login"
                  ? "signup"
                  : "login"
              );
              setAuthError("");
            }}
          >
            {mode === "login"
              ? "Create a new account"
              : "Already have an account? Login"}
          </button>

        </div>
      </div>
    );
  }

  // =========================
  // CHAT APP
  // =========================

  return (
    <div className="app">

      <aside className="sidebar">

        <div className="brand">
          <div className="logo">✦</div>
          <strong>Orbit</strong>
        </div>

        <div className="profile">

          <Avatar username={me.username} />

          <div>
            <strong>@{me.username}</strong>
            <small>Online</small>
          </div>

          <button
            className="logout-button"
            onClick={logout}
            title="Logout"
          >
            <LogOut size={17} />
          </button>

        </div>

        <div className="search-box">

          <Search size={17} />

          <input
            value={search}
            onChange={(e) =>
              searchUsers(e.target.value)
            }
            placeholder="Search users..."
          />

        </div>

        {search.trim() && (
          <div className="search-results">

            {loadingUsers && (
              <p className="empty-text">
                Searching...
              </p>
            )}

            {!loadingUsers &&
              users.length === 0 && (
                <p className="empty-text">
                  No users found
                </p>
              )}

            {users.map((user) => (
              <button
                className="user-item"
                key={user._id}
                onClick={() =>
                  openChat(user)
                }
              >
                <Avatar
                  username={user.username}
                />

                <div className="user-info">
                  <strong>
                    @{user.username}
                  </strong>

                  <p>
                    Tap to chat
                  </p>
                </div>
              </button>
            ))}

          </div>
        )}

        <div className="messages-title">
          <span>CHAT</span>
        </div>

        {!selected && (
          <div className="empty-sidebar">
            Search a username above to start chatting.
          </div>
        )}

        {selected && (
          <button className="user-item selected">
            <Avatar
              username={selected.username}
              online
            />

            <div className="user-info">
              <strong>
                @{selected.username}
              </strong>

              <p>
                Active chat
              </p>
            </div>
          </button>
        )}

      </aside>

      <main className="chat">

        {!selected ? (
          <div className="welcome-screen">
            <div className="logo">✦</div>

            <h2>Welcome to Orbit</h2>

            <p>
              Search for a username to start a
              conversation.
            </p>
          </div>
        ) : (
          <>
            <header className="header">

              <Avatar
                username={selected.username}
                online
              />

              <div className="header-user">

                <strong>
                  @{selected.username}
                </strong>

                <span>
                  <i className="online" />
                  Online
                </span>

              </div>

            </header>

            <section className="messages">

              {loadingMessages && (
                <div className="empty-text">
                  Loading messages...
                </div>
              )}

              {!loadingMessages &&
                messages.length === 0 && (
                  <div className="empty-chat">
                    <Avatar
                      username={selected.username}
                    />

                    <strong>
                      @{selected.username}
                    </strong>

                    <p>
                      No messages yet. Say hello!
                    </p>
                  </div>
                )}

              {messages.map((message, index) => {

                const mine =
                  message.from === me._id;

                return (
                  <div
                    key={
                      message._id ||
                      `${message.createdAt}-${index}`
                    }
                    className={`message-row ${
                      mine ? "mine" : ""
                    }`}
                  >

                    {!mine && (
                      <Avatar
                        username={
                          selected.username
                        }
                        small
                      />
                    )}

                    <div className="message-wrapper">

                      <div className="bubble">
                        {message.text}
                      </div>

                      <div className="message-meta">

                        {new Date(
                          message.createdAt
                        ).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit"
                        })}

                        {mine && (
                          <CheckCheck size={14} />
                        )}

                      </div>

                    </div>

                  </div>
                );
              })}

              <div ref={bottomRef} />

            </section>

            <footer className="composer-area">

              <div className="composer">

                <input
                  value={text}
                  onChange={(e) =>
                    setText(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      sendMessage();
                    }
                  }}
                  placeholder={`Message @${selected.username}...`}
                />

                <button
                  className="send"
                  onClick={sendMessage}
                  disabled={!text.trim()}
                >
                  <Send size={17} />
                </button>

              </div>

              <small>
                Enter to send · Realtime messaging
              </small>

            </footer>
          </>
        )}

      </main>
    </div>
  );
            }
