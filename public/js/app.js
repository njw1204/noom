const STORAGE_KEY = Object.freeze({
  USER_ID: "userId",
  USER_PASSWORD: "userPassword",
});

const socket = window.io();
let id = "";
let nickname = "";

function joinRoomCallback(response) {
  document.getElementById("chat_room_form_container").style.display = "none";
  document.getElementById("chat_room_list_container").style.display = "none";
  document.getElementById("chat_list_container").style.display = "";
  document.getElementById("chat_form_container").style.display = "";

  const icon = document.createElement("i");
  icon.classList.add("ri-user-fill");

  const sizeOfRoom = document.createElement("span");
  sizeOfRoom.id = "size_of_room";
  sizeOfRoom.innerText = response.sizeOfRoom;

  const leaveButton = document.createElement("button");
  leaveButton.type = "button";
  leaveButton.classList.add("chat-room-leave-button");
  leaveButton.innerText = "Leave";

  document.getElementById("app_title").innerText = `${response.chatRoom} (`;
  document.getElementById("app_title").appendChild(icon);
  document.getElementById("app_title").appendChild(sizeOfRoom);
  document.getElementById("app_title").appendChild(document.createTextNode(")"));
  document.getElementById("app_title").appendChild(leaveButton);

  document.querySelector("#chat_list_container .chat-list").innerHTML = "";
  document.querySelector("#nickname_form .nickname-text-input").value = nickname;
  document.querySelector("#chat_submit_form .chat-submit-text-input").value = "";

  leaveButton.addEventListener("click", () => {
    socket.emit("leave-room", () => {
      document.getElementById("chat_room_form_container").style.display = "";
      document.getElementById("chat_room_list_container").style.display = "";
      document.getElementById("chat_list_container").style.display = "none";
      document.getElementById("chat_form_container").style.display = "none";
      document.getElementById("app_title").innerText = "Noom";
    });
  });
}

function refreshRooms(_rooms) {
  const chatRoomListContainer = document.getElementById("chat_room_list_container");
  chatRoomListContainer.innerHTML = "";

  _rooms.forEach((room) => {
    const roomDiv = document.createElement("div");
    roomDiv.classList.add("room-enter-badge");
    roomDiv.innerText = room;

    roomDiv.addEventListener("click", () => {
      socket.emit("join-room", roomDiv.innerText, joinRoomCallback);
    });

    chatRoomListContainer.appendChild(roomDiv);
  });
}

function initChat() {
  const chatRoomForm = document.getElementById("chat_room_form");
  const chatRoomTextInput = chatRoomForm.querySelector(".chat-room-text-input");
  const nicknameForm = document.getElementById("nickname_form");
  const nicknameTextInput = nicknameForm.querySelector(".nickname-text-input");
  const chatSubmitForm = document.getElementById("chat_submit_form");
  const chatSubmitTextInput = chatSubmitForm.querySelector(
    ".chat-submit-text-input",
  );

  chatRoomForm.addEventListener("submit", (event) => {
    event.preventDefault();
    socket.emit("join-room", chatRoomTextInput.value, joinRoomCallback);
  });

  nicknameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    socket.emit("change-nickname", nicknameTextInput.value, () => {
      nickname = nicknameTextInput.value;
    });
  });

  chatSubmitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    socket.emit("send-chat", chatSubmitTextInput.value, () => {});
    chatSubmitForm.reset();
  });

  socket.emit("login", window.sessionStorage.getItem(STORAGE_KEY.USER_ID), window.sessionStorage.getItem(STORAGE_KEY.USER_PASSWORD), (user) => {
    window.sessionStorage.setItem(STORAGE_KEY.USER_ID, user.id);
    window.sessionStorage.setItem(STORAGE_KEY.USER_PASSWORD, user.password);
    id = user.id;
    nickname = user.nickname;
  });

  socket.emit("get-rooms", refreshRooms);
}

function onReceiveChat(response) {
  const chatListContainer = document.getElementById("chat_list_container");
  const chatList = chatListContainer.querySelector(".chat-list");
  const chatItem = document.createElement("li");

  const nicknameView = document.createElement("strong");
  nicknameView.innerText = response.nickname;

  const contentView = document.createElement("div");
  contentView.innerText = response.msg;

  chatItem.appendChild(nicknameView);
  chatItem.appendChild(contentView);
  chatList.appendChild(chatItem);

  if (response.id === id) {
    chatItem.style.backgroundColor = "#CCCC9999";
  }

  window.scrollTo(0, document.body.scrollHeight);
}

socket.on("receive-chat", onReceiveChat);

socket.on("refresh-rooms", refreshRooms);

socket.on("notify-join-room", (response) => {
  document.getElementById("size_of_room").innerText = response.sizeOfRoom;
  onReceiveChat({
    id: response.id,
    nickname: response.nickname,
    msg: "# Hi there!",
  });
});

socket.on("notify-leave-room", (response) => {
  document.getElementById("size_of_room").innerText = response.sizeOfRoom;
  onReceiveChat({
    id: response.id,
    nickname: response.nickname,
    msg: "# Goodbye",
  });
});

socket.on("notify-change-nickname", (response) => {
  onReceiveChat({
    id: response.id,
    nickname: response.oldNickname,
    msg: `# Change my nickname to ${response.nickname}`,
  });
});

initChat();
