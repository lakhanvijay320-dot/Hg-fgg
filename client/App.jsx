import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Search,
  Plus,
  Phone,
  Video,
  MoreHorizontal,
  Paperclip,
  Smile,
  Send,
  CheckCheck,
  Mic,
  Settings,
  Bell,
  Menu,
  X
} from "lucide-react";

const SERVER =
  import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const users = [
  { id: "ava", name: "Ava Wilson", avatar: "AW", status: "online", color: "purple" },
  { id: "liam", name: "Liam Carter", avatar: "LC", status: "online", color: "blue" },
  { id: "mia", name: "Mia Chen", avatar: "MC", status: "away", color: "pink" },
  { id: "noah", name: "Noah Brown", avatar: "NB", status: "offline", color: "green" },
  { id: "sophia", name: "Sophia Kim", avatar: "SK", status: "online", color: "orange" }
];

const startingMessages = {
  ava: [
    {
      id: 1,
      text: "Hey! Are we still on for the project review?",
      time: "10:42 AM",
      mine: false
    },
    {
      id: 2,
      text: "Absolutely. I finished the new dashboard screens.",
      time: "10:44 AM",
      mine: true
    },
    {
      id: 3,
      text: "Nice! Send them over when you can 👀",
      time: "10:45 AM",
      mine: false
    }
  ],
  liam: [
    {
      id: 4,
      text: "That animation looks really smooth.",
      time: "Yesterday",
      mine: false
    }
  ],
  mia: [
    {
      id: 5,
      text: "Can you review the copy later?",
      time: "Yesterday",
      mine: false
    }
  ],
  noah: [
    {
      id: 6,
      text: "Thanks!",
      time: "Mon",
      mine: false
    }
  ],
  sophia: [
    {
      id: 7,
      text: "See you tomorrow!",
      time: "Sun",
      mine: false
    }
  ]
};

function Avatar({ user, small = false, online = false }) {
  return (
    <div className={`avatar ${user.color} ${small ? "small" : ""}`}>
      {user.avatar}
      {online && <span className="online-dot" />}
    </div>
  );
}

export default function App() {
  const [selected, setSelected] = useState("ava");
  const [messages, setMessages] = useState(startingMessages);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [typing, setTyping] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  const bottomRef = useRef(null);

  const socket = useMemo(
    () => io(SERVER, { autoConnect: false }),
    []
  );

  const currentUser = users.find((u) => u.id === selected);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    socket.connect();

    socket.emit("join", "demo-user");

    socket.on("typing", ({ userId }) => {
      if (userId === selected) {
        setTyping(true);

        setTimeout(() => {
          setTyping(false);
        }, 1200);
      }
    });

    socket.on("message", (message) => {
      if (message.to === "demo-user") {
        setMessages((prev) => ({
          ...prev,
          [message.from]: [
            ...(prev[message.from] || []),
            {
              ...message,
              mine: false
            }
          ]
        }));
      }
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages, selected, typing]);

  function sendMessage() {
    const value = text.trim();

    if (!value) return;

    const message = {
      id: Date.now(),
      from: "demo-user",
      to: selected,
      text: value,
      time: new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      }),
      mine: true
    };

    setMessages((prev) => ({
      ...prev,
      [selected]: [...(prev[selected] || []), message]
    }));

    socket.emit("message", message);
    setText("");
  }

  return (
    <div className="app">

      <aside className={`sidebar ${mobileSidebar ? "show" : ""}`}>

        <div className="brand">
          <div className="logo">✦</div>
          <strong>Orbit</strong>

          <button
            className="close-mobile"
            onClick={() => setMobileSidebar(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="profile">
          <Avatar
            user={{
              avatar: "JD",
              color: "blue"
            }}
            online
          />

          <div>
            <strong>Jordan Davis</strong>
            <small>Available</small>
          </div>

          <MoreHorizontal size={18} />
        </div>

        <div className="search-box">
          <Search size={17} />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people..."
          />
        </div>

        <div className="messages-title">
          <span>MESSAGES</span>
          <Plus size={17} />
        </div>

        <div className="user-list">

          {filteredUsers.map((user) => (
            <button
              key={user.id}
              className={`user-item ${
                selected === user.id ? "selected" : ""
              }`}
              onClick={() => {
                setSelected(user.id);
                setMobileSidebar(false);
              }}
            >
              <Avatar
                user={user}
                online={user.status === "online"}
              />

              <div className="user-info">
                <div className="user-name">
                  <strong>{user.name}</strong>
                  <span>
                    {messages[user.id]?.at(-1)?.time || ""}
                  </span>
                </div>

                <p>
                  {messages[user.id]?.at(-1)?.text ||
                    "Start a conversation"}
                </p>
              </div>
            </button>
          ))}

        </div>

        <div className="sidebar-footer">
          <button>
            <Bell size={18} />
            Notifications
          </button>

          <button>
            <Settings size={18} />
            Settings
          </button>
        </div>
      </aside>

      <main className="chat">

        <header className="header">

          <button
            className="mobile-menu"
            onClick={() => setMobileSidebar(true)}
          >
            <Menu size={21} />
          </button>

          <Avatar
            user={currentUser}
            online={currentUser.status === "online"}
          />

          <div className="header-user">
            <strong>{currentUser.name}</strong>

            <span>
              <i className={currentUser.status} />
              {currentUser.status === "online"
                ? "Active now"
                : currentUser.status}
            </span>
          </div>

          <div className="header-actions">
            <button>
              <Phone size={19} />
            </button>

            <button>
              <Video size={20} />
            </button>

            <button>
              <MoreHorizontal size={20} />
            </button>
          </div>
        </header>

        <section className="messages">

          <div className="today">
            <span>Today</span>
          </div>

          {(messages[selected] || []).map((message) => (
            <div
              key={message.id}
              className={`message-row ${
                message.mine ? "mine" : ""
              }`}
            >

              {!message.mine && (
                <Avatar
                  user={currentUser}
                  small
                />
              )}

              <div className="message-wrapper">

                <div className="bubble">
                  {message.text}
                </div>

                <div className="message-meta">
                  {message.time}

                  {message.mine && (
                    <CheckCheck size={14} />
                  )}
                </div>

              </div>
            </div>
          ))}

          {typing && (
            <div className="typing">
              <Avatar
                user={currentUser}
                small
              />

              <div className="typing-box">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </section>

        <footer className="composer-area">

          <div className="composer">

            <button>
              <Paperclip size={19} />
            </button>

            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);

                socket.emit("typing", {
                  userId: selected
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage();
                }
              }}
              placeholder={`Message ${currentUser.name.split(" ")[0]}...`}
            />

            <button>
              <Smile size={19} />
            </button>

            {text.trim() ? (
              <button
                className="send"
                onClick={sendMessage}
              >
                <Send size={17} />
              </button>
            ) : (
              <button>
                <Mic size={19} />
              </button>
            )}

          </div>

          <small>
            Press Enter to send · Realtime messaging
          </small>

        </footer>
      </main>
    </div>
  );
}
