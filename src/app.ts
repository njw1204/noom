import http from "http";
import express from "express";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";

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
const io = new Server(server, {
  cors: {
    origin: ["https://admin.socket.io"],
    credentials: true,
  },
});
const users = new Map();

instrument(io, {
  auth: false,
  namespaceName: "/",
});

function getRooms(includeSids?: boolean) {
  return Array.from(io.sockets.adapter.rooms.keys())
    .filter((roomName) => includeSids || !io.sockets.adapter.sids.has(roomName));
}

function getSizeOfRoom(roomName: string) {
  return io.sockets.adapter.rooms.get(roomName)?.size || 0;
}

function createUser(id: string, password: string) {
  return {
    id,
    password,
    nickname: "Anonymous",
  };
}

function getRandomString() {
  return Math.random().toString(16).slice(2);
}

io.on("connection", (_socket) => {
  const socket = _socket;

  socket.on("disconnect", () => {
    if (socket.data.chatRoom) {
      if (getRooms().includes(socket.data.chatRoom)) {
        const user = users.get(socket.data.userId);

        if (user) {
          io.sockets.to(socket.data.chatRoom).emit("notify-leave-room", {
            id: user.id,
            nickname: user.nickname,
            sizeOfRoom: getSizeOfRoom(socket.data.chatRoom),
          });
        }
      } else {
        io.sockets.emit("refresh-rooms", getRooms());
      }
    }
  });

  socket.on("login", (id, password, done) => {
    let user;

    if (users.has(id) && users.get(id).password === password) {
      user = users.get(id);
    } else {
      user = createUser(getRandomString(), getRandomString());
      users.set(user.id, user);
    }

    socket.data.userId = user.id;
    done({
      id: user.id,
      password: user.password,
      nickname: user.nickname,
    });
  });

  socket.on("get-rooms", (done) => {
    done(getRooms());
  });

  socket.on("join-room", (_chatRoom, done) => {
    const user = users.get(socket.data.userId);
    const chatRoom = _chatRoom.trim().toUpperCase();

    if (user && chatRoom && !socket.data.chatRoom) {
      const isNewRoom = !getRooms().includes(chatRoom);

      socket.join(chatRoom);
      socket.to(chatRoom).emit("notify-join-room", {
        id: user.id,
        nickname: user.nickname,
        sizeOfRoom: getSizeOfRoom(chatRoom),
      });

      if (isNewRoom) {
        io.sockets.emit("refresh-rooms", getRooms());
      }

      socket.data.chatRoom = chatRoom;
      done({
        chatRoom,
        sizeOfRoom: getSizeOfRoom(chatRoom),
      });
    }
  });

  socket.on("leave-room", (done) => {
    const user = users.get(socket.data.userId);

    if (user && socket.data.chatRoom) {
      socket.leave(socket.data.chatRoom);

      const isRoomRemoved = !getRooms().includes(socket.data.chatRoom);

      if (isRoomRemoved) {
        io.sockets.emit("refresh-rooms", getRooms());
      } else {
        io.sockets.to(socket.data.chatRoom).emit("notify-leave-room", {
          id: user.id,
          nickname: user.nickname,
          sizeOfRoom: getSizeOfRoom(socket.data.chatRoom),
        });
      }

      socket.data.chatRoom = undefined;
      done();
    }
  });

  socket.on("change-nickname", (_nickname, done) => {
    const user = users.get(socket.data.userId);
    const nickname = _nickname.trim();

    if (!user || !nickname || user.nickname === nickname) {
      return;
    }

    const oldNickname = user.nickname;
    user.nickname = nickname;

    if (socket.data.chatRoom) {
      socket.to(socket.data.chatRoom).emit("notify-change-nickname", {
        id: user.id,
        nickname: user.nickname,
        oldNickname,
      });
    }

    done();
  });

  socket.on("webrtc-offer", async (userId, offer) => {
    const user = users.get(socket.data.userId);
    const targetSocket = (await io.fetchSockets()).find(
      (aSocket) => (aSocket.data.userId === userId),
    );

    if (user && targetSocket) {
      socket.to(targetSocket.id).emit("webrtc-offer", socket.data.userId, user.nickname, offer);
    }
  });

  socket.on("webrtc-answer", async (userId, answer) => {
    const user = users.get(socket.data.userId);
    const targetSocket = (await io.fetchSockets()).find(
      (aSocket) => (aSocket.data.userId === userId),
    );

    if (user && targetSocket) {
      socket.to(targetSocket.id).emit("webrtc-answer", socket.data.userId, user.nickname, answer);
    }
  });

  socket.on("webrtc-ice-candidate", async (userId, iceCandidate) => {
    const user = users.get(socket.data.userId);
    const targetSocket = (await io.fetchSockets()).find(
      (aSocket) => (aSocket.data.userId === userId),
    );

    if (user && targetSocket) {
      socket.to(targetSocket.id).emit("webrtc-ice-candidate", socket.data.userId, iceCandidate);
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${process.env.PORT || 3000}...`);
});
