import http from "http";
import WebSocket from "ws";
import express from "express";

const app = express();
app.set("views", "views");
app.set("view engine", "pug");
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/*", (req, res) => {
  res.redirect("/");
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const MESSAGE_TYPE = Object.freeze({
  SERVER_HELLO: "SERVER_HELLO",
  CLIENT_HELLO: "CLIENT_HELLO",
  SERVER_CHAT: "SERVER_CHAT",
  CLIENT_CHAT: "CLIENT_CHAT",
  SERVER_PROFILE: "SERVER_PROFILE",
  CLIENT_PROFILE: "CLIENT_PROFILE",
});

function generateID() {
  return Math.random()
    .toString(16)
    .slice(2);
}

function generateUser(id: string) {
  return {
    id,
    nickname: "Anonymous",
  };
}

function makeMessage(type: string, payload: object) {
  return JSON.stringify({
    type,
    payload,
  });
}

function parseMessage(message: string) {
  return JSON.parse(message);
}

const users = new Map();
const sockets = new Map();

interface ChatSocket extends WebSocket {
  id: string;
  userId: string;
}

wss.addListener("connection", (_socket: ChatSocket) => {
  const socket = _socket;
  socket.id = generateID();
  sockets.set(socket.id, socket);

  socket.addEventListener("close", () => {
    sockets.delete(socket.id);
  });

  socket.addEventListener("message", (event) => {
    const message = parseMessage(event.data.toString());

    switch (message.type) {
      case MESSAGE_TYPE.CLIENT_HELLO: {
        const isAlreadySignUp = users.has(message.payload.id);
        const helloUserId = isAlreadySignUp ? message.payload.id : generateID();

        if (!isAlreadySignUp) {
          users.set(helloUserId, generateUser(helloUserId));
        }

        socket.userId = helloUserId;

        const helloUser = users.get(helloUserId);
        socket.send(
          makeMessage(MESSAGE_TYPE.SERVER_HELLO, {
            user: {
              id: helloUser.id,
              nickname: helloUser.nickname,
            },
          }),
        );
        break;
      }
      case MESSAGE_TYPE.CLIENT_CHAT: {
        const chatContent = message.payload.content.trim();
        const chatUserId = socket.userId;

        if (!chatContent || !users.has(chatUserId)) {
          break;
        }

        const chatUser = users.get(chatUserId);

        Array.from(sockets.values())
          .forEach((aSocket) => {
            if (!users.has(aSocket.userId)) {
              return;
            }

            aSocket.send(
              makeMessage(MESSAGE_TYPE.SERVER_CHAT, {
                user: {
                  you: aSocket.userId === chatUser.id,
                  nickname: chatUser.nickname,
                },
                content: chatContent,
              }),
            );
          });
        break;
      }
      case MESSAGE_TYPE.CLIENT_PROFILE: {
        const profileNickname = message.payload.nickname.trim();
        const profileUserId = socket.userId;

        if (!users.has(profileUserId)) {
          break;
        }

        const profileUser = users.get(profileUserId);
        profileUser.nickname = profileNickname;

        socket.send(
          makeMessage(MESSAGE_TYPE.SERVER_PROFILE, {
            user: profileUser,
          }),
        );
        break;
      }
      default:
        break;
    }
  });
});

server.listen(3000, () => {
  console.log("Listening on port 3000...");
});
