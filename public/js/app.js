const STORAGE_KEY = Object.freeze({
  USER_ID: "userId",
  USER_PASSWORD: "userPassword",
});

const socket = window.io();
let id = "";
let nickname = "";
let myMediaStream;
let myRTCPeerConnection;

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
  chatList.insertAdjacentElement("afterbegin", chatItem);

  if (response.id === id) {
    chatItem.style.backgroundColor = "rgb(243, 243, 208)";
  }
}

async function makeMediaStream() {
  try {
    if (myMediaStream) {
      myMediaStream.getTracks().forEach((track) => track.stop());
    }

    myMediaStream = await window.navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        facingMode: "user",
      },
    });

    document.getElementById("my_face").srcObject = myMediaStream;
  } catch (e) {
    myMediaStream = null;
    console.trace(e);
  }
}

function makeRTCPeerConnection() {
  myRTCPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  });

  if (myMediaStream) {
    myMediaStream.getTracks()
      .forEach((track) => myRTCPeerConnection.addTrack(track, myMediaStream));
  }

  myRTCPeerConnection.ontrack = (event) => {
    [document.getElementById("peer_face").srcObject] = event.streams;
  };

  myRTCPeerConnection.onicecandidate = undefined;
}

function createDataChannel(isOffer) {
  const onChatDataChannelMessage = (event) => {
    onReceiveChat(JSON.parse(event.data));
  };

  if (isOffer) {
    myRTCPeerConnection.chatDataChannel = myRTCPeerConnection.createDataChannel("chat");
    myRTCPeerConnection.chatDataChannel.onmessage = onChatDataChannelMessage;
  } else {
    myRTCPeerConnection.ondatachannel = (event) => {
      myRTCPeerConnection.chatDataChannel = event.channel;
      myRTCPeerConnection.chatDataChannel.onmessage = onChatDataChannelMessage;
    };
  }
}

async function joinRoomCallback(response) {
  if (response.error) {
    window.alert(response.message);
    return;
  }

  document.getElementById("chat_room_form_container").style.display = "none";
  document.getElementById("chat_room_list_container").style.display = "none";
  document.getElementById("face_player_container").style.display = "";
  document.getElementById("chat_list_container").style.display = "";
  document.getElementById("chat_form_container").style.display = "";
  document.getElementById("chat_controller").style.display = "";

  const icon = document.createElement("i");
  icon.classList.add("ri-user-fill");

  const sizeOfRoom = document.createElement("span");
  sizeOfRoom.id = "size_of_room";
  sizeOfRoom.innerText = response.sizeOfRoom;

  const leaveButton = document.createElement("button");
  leaveButton.type = "button";
  leaveButton.classList.add("chat-room-leave-button");
  leaveButton.innerText = "Leave";

  document.getElementById("app_title").innerText = `${response.chatRoom}`;

  const appTitleDiv = document.createElement("div");
  appTitleDiv.style.display = "flex";
  appTitleDiv.innerHTML = "&nbsp;(";
  appTitleDiv.appendChild(icon);
  appTitleDiv.appendChild(sizeOfRoom);
  appTitleDiv.appendChild(document.createTextNode(")"));

  document.getElementById("app_title").appendChild(appTitleDiv);
  document.getElementById("app_title").appendChild(leaveButton);

  document.querySelector("#chat_list_container .chat-list").innerHTML = "";
  document.querySelector("#nickname_form .nickname-text-input").value = nickname;
  document.querySelector("#chat_submit_form .chat-submit-text-input").value = "";

  document.getElementById("video_on_off_button").classList.add("on");
  document.getElementById("video_on_off_button").classList.add("ri-camera-fill");
  document.getElementById("video_on_off_button").classList.remove("ri-camera-off-fill");

  document.getElementById("mic_on_off_button").classList.add("on");
  document.getElementById("mic_on_off_button").classList.add("ri-mic-fill");
  document.getElementById("mic_on_off_button").classList.remove("ri-mic-off-fill");

  document.getElementById("peer_face").srcObject = null;

  leaveButton.addEventListener("click", () => {
    if (myRTCPeerConnection) {
      myRTCPeerConnection.close();
      myRTCPeerConnection = null;
    }

    if (myMediaStream) {
      myMediaStream.getTracks().forEach((track) => track.stop());
      myMediaStream = null;
    }

    socket.emit("leave-room", () => {
      document.getElementById("chat_room_form_container").style.display = "";
      document.getElementById("chat_room_list_container").style.display = "";
      document.getElementById("face_player_container").style.display = "none";
      document.getElementById("chat_list_container").style.display = "none";
      document.getElementById("chat_form_container").style.display = "none";
      document.getElementById("chat_controller").style.display = "none";
      document.getElementById("app_title").innerText = "Noom";
    });
  });
}

async function joinRoom(room) {
  await makeMediaStream();
  makeRTCPeerConnection();
  socket.emit("join-room", room, joinRoomCallback);
}

function refreshRooms(_rooms) {
  const chatRoomListContainer = document.getElementById("chat_room_list_container");
  chatRoomListContainer.innerHTML = "";

  _rooms.forEach((room) => {
    const roomDiv = document.createElement("div");
    roomDiv.classList.add("room-enter-badge");
    roomDiv.innerText = room;

    roomDiv.addEventListener("click", async () => {
      await joinRoom(roomDiv.innerText);
    });

    chatRoomListContainer.appendChild(roomDiv);
  });
}

function initApplication() {
  const chatRoomForm = document.getElementById("chat_room_form");
  const chatRoomTextInput = chatRoomForm.querySelector(".chat-room-text-input");
  const nicknameForm = document.getElementById("nickname_form");
  const nicknameTextInput = nicknameForm.querySelector(".nickname-text-input");
  const chatSubmitForm = document.getElementById("chat_submit_form");
  const chatSubmitTextInput = chatSubmitForm.querySelector(
    ".chat-submit-text-input",
  );

  chatRoomForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await joinRoom(chatRoomTextInput.value);
  });

  nicknameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    socket.emit("change-nickname", nicknameTextInput.value, () => {
      nickname = nicknameTextInput.value;
    });
  });

  chatSubmitForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const chat = {
      id,
      nickname,
      msg: chatSubmitTextInput.value.trim(),
    };

    if (chat.msg) {
      if (myRTCPeerConnection && myRTCPeerConnection.chatDataChannel) {
        myRTCPeerConnection.chatDataChannel.send(JSON.stringify(chat));
      }

      onReceiveChat(chat);
      chatSubmitForm.reset();
    }
  });

  document.getElementById("video_on_off_button").addEventListener("click", (event) => {
    if (!myMediaStream || !myMediaStream.getVideoTracks().length) {
      return;
    }

    if (event.currentTarget.classList.contains("on")) {
      event.currentTarget.classList.remove("on");
      event.currentTarget.classList.remove("ri-camera-fill");
      event.currentTarget.classList.add("ri-camera-off-fill");
    } else {
      event.currentTarget.classList.add("on");
      event.currentTarget.classList.add("ri-camera-fill");
      event.currentTarget.classList.remove("ri-camera-off-fill");
    }

    myMediaStream.getVideoTracks().forEach((_track) => {
      const track = _track;
      track.enabled = event.currentTarget.classList.contains("on");
    });
  });

  document.getElementById("mic_on_off_button").addEventListener("click", (event) => {
    if (!myMediaStream || !myMediaStream.getAudioTracks().length) {
      return;
    }

    if (event.currentTarget.classList.contains("on")) {
      event.currentTarget.classList.remove("on");
      event.currentTarget.classList.remove("ri-mic-fill");
      event.currentTarget.classList.add("ri-mic-off-fill");
    } else {
      event.currentTarget.classList.add("on");
      event.currentTarget.classList.add("ri-mic-fill");
      event.currentTarget.classList.remove("ri-mic-off-fill");
    }

    myMediaStream.getAudioTracks().forEach((_track) => {
      const track = _track;
      track.enabled = event.currentTarget.classList.contains("on");
    });
  });

  socket.emit("login", window.sessionStorage.getItem(STORAGE_KEY.USER_ID), window.sessionStorage.getItem(STORAGE_KEY.USER_PASSWORD), (user) => {
    window.sessionStorage.setItem(STORAGE_KEY.USER_ID, user.id);
    window.sessionStorage.setItem(STORAGE_KEY.USER_PASSWORD, user.password);
    id = user.id;
    nickname = user.nickname;
  });

  socket.emit("get-rooms", refreshRooms);
}

socket.on("refresh-rooms", refreshRooms);

socket.on("notify-join-room", async (response) => {
  document.getElementById("size_of_room").innerText = response.sizeOfRoom;

  onReceiveChat({
    id: response.id,
    nickname: response.nickname,
    msg: "# Hi there!",
  });

  createDataChannel(true);
  const offer = await myRTCPeerConnection.createOffer();

  myRTCPeerConnection.onicecandidate = (event) => {
    socket.emit("webrtc-ice-candidate", response.id, event.candidate);
  };

  await myRTCPeerConnection.setLocalDescription(offer);
  socket.emit("webrtc-offer", response.id, offer);
});

socket.on("notify-leave-room", (response) => {
  document.getElementById("size_of_room").innerText = response.sizeOfRoom;
  onReceiveChat({
    id: response.id,
    nickname: response.nickname,
    msg: "# Goodbye",
  });

  if (myRTCPeerConnection) {
    document.getElementById("peer_face").srcObject = null;
    myRTCPeerConnection.close();
    makeRTCPeerConnection();
  }
});

socket.on("notify-change-nickname", (response) => {
  onReceiveChat({
    id: response.id,
    nickname: response.oldNickname,
    msg: `# Change my nickname to ${response.nickname}`,
  });
});

socket.on("webrtc-offer", async (userId, offer) => {
  if (!myRTCPeerConnection) {
    return;
  }

  createDataChannel(false);

  await myRTCPeerConnection.setRemoteDescription(offer);
  const answer = await myRTCPeerConnection.createAnswer();

  myRTCPeerConnection.onicecandidate = (event) => {
    socket.emit("webrtc-ice-candidate", userId, event.candidate);
  };

  await myRTCPeerConnection.setLocalDescription(answer);
  socket.emit("webrtc-answer", userId, answer);
});

socket.on("webrtc-answer", async (userId, answer) => {
  if (!myRTCPeerConnection) {
    return;
  }

  await myRTCPeerConnection.setRemoteDescription(answer);
});

socket.on("webrtc-ice-candidate", (userId, candidate) => {
  if (myRTCPeerConnection && candidate) {
    myRTCPeerConnection.addIceCandidate(candidate);
  }
});

initApplication();
