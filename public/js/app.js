const STORAGE_KEY = Object.freeze({
  USER_ID: "userId",
});

const MESSAGE_TYPE = Object.freeze({
  PING: "PING",
  PONG: "PONG",
  SERVER_HELLO: "SERVER_HELLO",
  CLIENT_HELLO: "CLIENT_HELLO",
  SERVER_CHAT: "SERVER_CHAT",
  CLIENT_CHAT: "CLIENT_CHAT",
  SERVER_PROFILE: "SERVER_PROFILE",
  CLIENT_PROFILE: "CLIENT_PROFILE",
});

const socket = new WebSocket(`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`);

function makeMessage(type, payload) {
  return JSON.stringify({
    type,
    payload,
  });
}

function parseMessage(message) {
  return JSON.parse(message);
}

function initChat() {
  const nicknameForm = document.getElementById("nickname_form");
  const nicknameTextInput = nicknameForm.querySelector(".nickname-text-input");
  const chatSubmitForm = document.getElementById("chat_submit_form");
  const chatSubmitTextInput = chatSubmitForm.querySelector(
    ".chat-submit-text-input",
  );

  nicknameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    socket.send(
      makeMessage(MESSAGE_TYPE.CLIENT_PROFILE, {
        nickname: nicknameTextInput.value,
      }),
    );
    nicknameForm.querySelector(".nickname-save-button").disabled = true;
  });

  nicknameTextInput.addEventListener("input", () => {
    nicknameForm.querySelector(".nickname-save-button").disabled = !(
      socket.readyState === WebSocket.OPEN
    );
  });

  chatSubmitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    socket.send(
      makeMessage(MESSAGE_TYPE.CLIENT_CHAT, {
        content: chatSubmitTextInput.value,
      }),
    );
    chatSubmitForm.reset();
  });

  chatSubmitTextInput.addEventListener("input", () => {
    chatSubmitForm.querySelector(".chat-submit-send-button").disabled = !(
      socket.readyState === WebSocket.OPEN
    );
  });
}

socket.addEventListener("open", () => {
  socket.send(
    makeMessage(MESSAGE_TYPE.CLIENT_HELLO, {
      id: window.sessionStorage.getItem(STORAGE_KEY.USER_ID),
    }),
  );

  setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(makeMessage(MESSAGE_TYPE.PING));
    }
  }, 20000);
});

socket.addEventListener("close", () => {
  if (window.confirm("Disconnected from Server! Do you want to refresh?")) {
    window.location.reload();
  }
});

socket.addEventListener("message", (event) => {
  const message = parseMessage(event.data.toString());

  switch (message.type) {
    case MESSAGE_TYPE.PING:
      socket.send(makeMessage(MESSAGE_TYPE.PONG));
      break;
    case MESSAGE_TYPE.SERVER_HELLO:
      window.sessionStorage.setItem(
        STORAGE_KEY.USER_ID,
        message.payload.user.id.toString(),
      );
      document.querySelector("#nickname_form .nickname-text-input").value = message.payload.user.nickname;
      initChat();
      break;
    case MESSAGE_TYPE.SERVER_CHAT: {
      const chatListContainer = document.getElementById("chat_list_container");
      const chatList = chatListContainer.querySelector(".chat-list");
      const chatItem = document.createElement("li");

      chatItem.innerText = `[${message.payload.user.nickname}]\n${message.payload.content}`;
      chatList.appendChild(chatItem);

      if (message.payload.user.you) {
        chatItem.style.backgroundColor = "#CCCC9999";
        window.scrollTo(0, document.body.scrollHeight);
      }
      break;
    }
    default:
      break;
  }
});
