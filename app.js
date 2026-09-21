/* =========================================================
   FIREBASE CHATROOM
   Authentication + Firestore Chat + Realtime Presence
   Public Chat + Private Chat + Typing Indicator
========================================================= */


/* =========================================================
   1. FIREBASE IMPORTS
========================================================= */

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
  deleteUser
} from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  where,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
  getDatabase,
  ref,
  set,
  remove,
  onDisconnect,
  onValue,
  serverTimestamp as rtdbTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";


/* =========================================================
   2. FIREBASE CONFIG
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyCsImFYpdYejQHaMEsERqCVK2TX0bMkJTU",
  authDomain: "chatroom-78015.firebaseapp.com",
  databaseURL: "https://chatroom-78015-default-rtdb.firebaseio.com",
  projectId: "chatroom-78015",
  storageBucket: "chatroom-78015.firebasestorage.app",
  messagingSenderId: "135624570705",
  appId: "1:135624570705:web:cc0b9219e411d51de68570",
  measurementId: "G-KJD2DZ6JNM"
};


/* =========================================================
   3. INITIALIZE FIREBASE
========================================================= */

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);

const db = getFirestore(firebaseApp);

const rtdb = getDatabase(firebaseApp);


/* =========================================================
   4. HELPER
========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   5. DOM ELEMENTS
========================================================= */

const authScreen = $("authScreen");
const appScreen = $("appScreen");

const authForm = $("authForm");
const authBtn = $("authBtn");
const authError = $("authError");

const nameInput = $("nameInput");
const emailInput = $("emailInput");
const passwordInput = $("passwordInput");

const loginTab = $("loginTab");
const signupTab = $("signupTab");

const logoutBtn = $("logoutBtn");

const myAvatar = $("myAvatar");
const myName = $("myName");

const userSearch = $("userSearch");
const userList = $("userList");

const backBtn = $("backBtn");

const chatAvatar = $("chatAvatar");
const chatName = $("chatName");
const chatStatus = $("chatStatus");

const messagesEl = $("messages");
const typingEl = $("typing");

const messageForm = $("messageForm");
const messageInput = $("messageInput");

const toast = $("toast");


/* =========================================================
   6. APPLICATION STATE
========================================================= */

let authMode = "login";

let currentUser = null;

let myProfile = null;

let selectedChat = {
  type: "public",
  id: "public",
  name: "Public Chat"
};

let usersCache = [];

let presenceCache = {};

let unsubscribeMessages = null;

let unsubscribeUsers = null;

let unsubscribePresence = null;

let unsubscribeTyping = null;

let typingTimer = null;

let isSendingMessage = false;


/* =========================================================
   7. AUTH MODE
========================================================= */

function setAuthMode(mode) {

  authMode = mode;

  const isLogin = mode === "login";

  loginTab?.classList.toggle(
    "active",
    isLogin
  );

  signupTab?.classList.toggle(
    "active",
    !isLogin
  );

  nameInput?.classList.toggle(
    "hidden",
    isLogin
  );

  if (authBtn) {
    authBtn.textContent =
      isLogin
        ? "Login"
        : "Create account";
  }

  if (authError) {
    authError.textContent = "";
  }

}


/* =========================================================
   8. LOGIN TAB
========================================================= */

loginTab?.addEventListener(
  "click",
  () => {

    setAuthMode("login");

  }
);


/* =========================================================
   9. SIGNUP TAB
========================================================= */

signupTab?.addEventListener(
  "click",
  () => {

    setAuthMode("signup");

  }
);


/* =========================================================
   10. TOAST
========================================================= */

function showToast(message) {

  if (!toast) {
    return;
  }

  toast.textContent = message;

  toast.classList.add("show");

  setTimeout(() => {

    toast.classList.remove("show");

  }, 2500);

}


/* =========================================================
   11. ESCAPE HTML
========================================================= */

function escapeHtml(value) {

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(
    /[&<>"']/g,
    (character) => {

      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };

      return map[character];

    }
  );

}


/* =========================================================
   12. INITIAL LETTER
========================================================= */

function getInitial(name) {

  if (!name) {
    return "U";
  }

  return String(name)
    .trim()
    .charAt(0)
    .toUpperCase() || "U";

}


/* =========================================================
   13. FORMAT MESSAGE TIME
========================================================= */

function formatTime(timestamp) {

  if (!timestamp) {
    return "";
  }

  let date = null;

  try {

    if (
      timestamp &&
      typeof timestamp.toDate === "function"
    ) {

      date = timestamp.toDate();

    } else if (
      typeof timestamp === "number"
    ) {

      date = new Date(timestamp);

    } else if (
      timestamp?.seconds
    ) {

      date = new Date(
        timestamp.seconds * 1000
      );

    } else {

      date = new Date(timestamp);

    }

  } catch (error) {

    return "";

  }

  if (
    !date ||
    Number.isNaN(date.getTime())
  ) {

    return "";

  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


/* =========================================================
   14. PRIVATE CHAT ID
========================================================= */

function conversationId(uid1, uid2) {

  return [
    uid1,
    uid2
  ]
    .sort()
    .join("_");

}


/* =========================================================
   15. FRIENDLY FIREBASE ERRORS
========================================================= */

function friendlyError(error) {

  const errors = {

    "auth/invalid-credential":
      "Email or password is incorrect.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/email-already-in-use":
      "This email is already registered.",

    "auth/weak-password":
      "Password must be at least 6 characters.",

    "auth/user-not-found":
      "User account was not found.",

    "auth/wrong-password":
      "Incorrect password.",

    "auth/too-many-requests":
      "Too many attempts. Please try again later.",

    "auth/network-request-failed":
      "Network error. Check your internet connection.",

    "permission-denied":
      "Permission denied. Check Firebase rules."

  };

  return (
    errors[error?.code] ||
    error?.message ||
    "Something went wrong."
  );

}


/* =========================================================
   16. SIGNUP / LOGIN
========================================================= */

authForm?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    if (authError) {
      authError.textContent = "";
    }

    if (authBtn) {
      authBtn.disabled = true;
    }

    try {

      const email =
        emailInput.value.trim();

      const password =
        passwordInput.value;

      if (!email) {

        throw new Error(
          "Please enter your email."
        );

      }

      if (!password) {

        throw new Error(
          "Please enter your password."
        );

      }


      /* =====================================
         SIGNUP
      ===================================== */

      if (authMode === "signup") {

        const name =
          nameInput.value.trim();

        if (!name) {

          throw new Error(
            "Please enter your name."
          );

        }

        if (name.length < 2) {

          throw new Error(
            "Name must contain at least 2 characters."
          );

        }


        const credential =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );


        await saveProfile(
          credential.user.uid,
          name,
          credential.user.email || email
        );


        showToast(
          "Account created successfully!"
        );

      }


      /* =====================================
         LOGIN
      ===================================== */

      else {

        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        showToast(
          "Login successful!"
        );

      }

    } catch (error) {

      console.error(
        "Authentication error:",
        error
      );

      if (authError) {

        authError.textContent =
          friendlyError(error);

      }

    } finally {

      if (authBtn) {
        authBtn.disabled = false;
      }

    }

  }
);


/* =========================================================
   17. SAVE USER PROFILE
========================================================= */

async function saveProfile(
  uid,
  name,
  email
) {

  await setDoc(
    doc(
      db,
      "users",
      uid
    ),
    {

      uid: uid,

      name: name,

      email: email,

      createdAt: serverTimestamp()

    },
    {
      merge: true
    }
  );

}


/* =========================================================
   18. LOGOUT
========================================================= */

logoutBtn?.addEventListener(
  "click",
  async () => {

    try {

      await setOfflinePresence();

      await signOut(auth);

      showToast(
        "Logged out successfully."
      );

    } catch (error) {

      console.error(
        "Logout error:",
        error
      );

      showToast(
        friendlyError(error)
      );

    }

  }
);


/* =========================================================
   19. AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      currentUser = null;

      myProfile = null;

      cleanupListeners();

      if (authScreen) {
        authScreen.classList.remove(
          "hidden"
        );
      }

      if (appScreen) {
        appScreen.classList.add(
          "hidden"
        );

      }

      return;

    }


    currentUser = user;


    /* =====================================
       GET PROFILE
    ===================================== */

    try {

      const profileSnapshot =
        await getDoc(
          doc(
            db,
            "users",
            user.uid
          )
        );


      if (
        profileSnapshot.exists()
      ) {

        myProfile =
          profileSnapshot.data();

      } else {

        myProfile = {

          uid: user.uid,

          name:
            user.email
              ?.split("@")[0] ||
            "User",

          email:
            user.email || ""

        };


        await saveProfile(
          myProfile.uid,
          myProfile.name,
          myProfile.email
        );

      }

    } catch (error) {

      console.error(
        "Profile error:",
        error
      );

      myProfile = {

        uid: user.uid,

        name:
          user.email
            ?.split("@")[0] ||
          "User",

        email:
          user.email || ""

      };

    }


    /* =====================================
       SHOW MY PROFILE
    ===================================== */

    if (myName) {

      myName.textContent =
        myProfile.name;

    }

    if (myAvatar) {

      myAvatar.textContent =
        getInitial(
          myProfile.name
        );

    }


    /* =====================================
       SHOW APP
    ===================================== */

    authScreen?.classList.add(
      "hidden"
    );

    appScreen?.classList.remove(
      "hidden"
    );


    /* =====================================
       START SERVICES
    ===================================== */

    setOnlinePresence();

    listenUsers();


    /* =====================================
       OPEN PUBLIC CHAT
    ===================================== */

    openChat({

      type: "public",

      id: "public",

      name: "Public Chat"

    });

  }
);


/* =========================================================
   20. ONLINE PRESENCE
========================================================= */

function setOnlinePresence() {

  if (!currentUser) {
    return;
  }


  const statusRef =
    ref(
      rtdb,
      `presence/${currentUser.uid}`
    );


  const onlineData = {

    online: true,

    name:
      myProfile?.name ||
      "User",

    lastChanged:
      rtdbTimestamp()

  };


  /* =====================================
     Set offline automatically
     when connection closes
  ===================================== */

  onDisconnect(
    statusRef
  ).set({

    online: false,

    name:
      myProfile?.name ||
      "User",

    lastChanged:
      rtdbTimestamp()

  });


  /* =====================================
     Set online
  ===================================== */

  set(
    statusRef,
    onlineData
  ).catch(
    (error) => {

      console.error(
        "Presence error:",
        error
      );

    }
  );


  /* =====================================
     Listen to presence
  ===================================== */

  if (unsubscribePresence) {

    unsubscribePresence();

  }


  unsubscribePresence =
    onValue(
      ref(
        rtdb,
        "presence"
      ),
      (snapshot) => {

        presenceCache =
          snapshot.val() || {};

        renderUsers();

        updateChatHeaderStatus();

      },
      (error) => {

        console.error(
          "Presence listener:",
          error
        );

      }
    );

}


/* =========================================================
   21. SET OFFLINE
========================================================= */

async function setOfflinePresence() {

  if (!currentUser) {
    return;
  }

  try {

    const statusRef =
      ref(
        rtdb,
        `presence/${currentUser.uid}`
      );


    await set(
      statusRef,
      {

        online: false,

        name:
          myProfile?.name ||
          "User",

        lastChanged:
          rtdbTimestamp()

      }
    );

  } catch (error) {

    console.error(
      "Offline presence error:",
      error
    );

  }

}


/* =========================================================
   22. LISTEN TO USERS
========================================================= */

function listenUsers() {

  if (!currentUser) {
    return;
  }


  if (unsubscribeUsers) {

    unsubscribeUsers();

  }


  unsubscribeUsers =
    onSnapshot(
      collection(
        db,
        "users"
      ),
      (snapshot) => {

        usersCache =
          snapshot.docs
            .map(
              (document) =>
                document.data()
            )
            .filter(
              (user) =>
                user.uid !==
                currentUser.uid
            );


        renderUsers();

      },
      (error) => {

        console.error(
          "Users listener:",
          error
        );

        showToast(
          "Could not load users."
        );

      }
    );

}


/* =========================================================
   23. RENDER USERS
========================================================= */

function renderUsers() {

  if (
    !currentUser ||
    !userList
  ) {

    return;

  }


  const search =
    userSearch?.value
      ?.trim()
      .toLowerCase() || "";


  const filteredUsers =
    usersCache
      .filter(
        (user) =>
          (user.name || "")
            .toLowerCase()
            .includes(search)
      )
      .sort(
        (a, b) => {

          const onlineA =
            presenceCache[
              a.uid
            ]?.online
              ? 1
              : 0;

          const onlineB =
            presenceCache[
              b.uid
            ]?.online
              ? 1
              : 0;

          return onlineB - onlineA;

        }
      );


  userList.innerHTML = "";


  if (
    filteredUsers.length === 0
  ) {

    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "muted";

    empty.style.padding =
      "20px";

    empty.textContent =
      search
        ? "No users found."
        : "No other users yet.";

    userList.appendChild(
      empty
    );

    return;

  }


  filteredUsers.forEach(
    (user) => {

      const row =
        document.createElement(
          "div"
        );

      row.className =
        "user-item";


      const initial =
        getInitial(
          user.name
        );


      const online =
        Boolean(
          presenceCache[
            user.uid
          ]?.online
        );


      row.innerHTML = `

        <div class="avatar">
          ${escapeHtml(initial)}
        </div>

        <div class="user-meta">

          <strong>
            ${escapeHtml(
              user.name || "User"
            )}
          </strong>

          <span>
            ${
              online
                ? "Online"
                : "Offline"
            }
          </span>

        </div>

        <span
          class="status-dot ${
            online
              ? "online"
              : ""
          }"
        ></span>

      `;


      row.addEventListener(
        "click",
        () => {

          openChat({

            type: "private",

            id:
              conversationId(
                currentUser.uid,
                user.uid
              ),

            uid:
              user.uid,

            name:
              user.name || "User"

          });

        }
      );


      userList.appendChild(
        row
      );

    }
  );

}


/* =========================================================
   24. USER SEARCH
========================================================= */

userSearch?.addEventListener(
  "input",
  () => {

    renderUsers();

  }
);


/* =========================================================
   25. PUBLIC CHAT CLICK
========================================================= */

const publicRoom =
  document.querySelector(
    ".room-item[data-chat='public']"
  );


if (publicRoom) {

  publicRoom.addEventListener(
    "click",
    () => {

      openChat({

        type: "public",

        id: "public",

        name: "Public Chat"

      });

    }
  );

}


/* =========================================================
   26. OPEN CHAT
========================================================= */

function openChat(chat) {

  if (!currentUser) {
    return;
  }


  selectedChat = chat;


  /* =====================================
     Header
  ===================================== */

  if (chatName) {

    chatName.textContent =
      chat.name;

 }


  if (chat.type === "public") {

    if (chatAvatar) {

      chatAvatar.textContent =
        "🌐";

    }

  } else {

    if (chatAvatar) {

      chatAvatar.textContent =
        getInitial(
          chat.name
        );

    }

  }


  updateChatHeaderStatus();


  /* =====================================
     Mobile
  ===================================== */

  appScreen?.classList.add(
    "mobile-chat"
  );


  if (typingEl) {

    typingEl.textContent = "";

  }


  /* =====================================
     Remove old message listener
  ===================================== */

  if (unsubscribeMessages) {

    unsubscribeMessages();

    unsubscribeMessages = null;

  }


  /* =====================================
     Remove old typing listener
  ===================================== */

  if (unsubscribeTyping) {

    unsubscribeTyping();

    unsubscribeTyping = null;

  }


  /* =====================================
     Firestore message collection
  ===================================== */

  let messagesCollection;


  if (
    chat.type === "public"
  ) {

    messagesCollection =
      collection(
        db,
        "publicMessages"
      );

  } else {

    messagesCollection =
      collection(
        db,
        "privateChats",
        chat.id,
        "messages"
      );

  }


  /* =====================================
     Message query
  ===================================== */

  const messagesQuery =
    query(
      messagesCollection,
      orderBy(
        "createdAt",
        "asc"
      ),
      limit(200)
    );


  /* =====================================
     Listen to messages
  ===================================== */

  unsubscribeMessages =
    onSnapshot(
      messagesQuery,
      (snapshot) => {

        if (!messagesEl) {
          return;
        }


        messagesEl.innerHTML = "";


        snapshot.docs.forEach(
          (document) => {

            renderMessage({

              id:
                document.id,

              ...document.data()

            });

          }
        );


        scrollMessagesToBottom();

      },
      (error) => {

        console.error(
          "Message listener:",
          error
        );


        if (messagesEl) {

          messagesEl.innerHTML = `

            <div class="error">

              Could not load messages.

              <br><br>

              ${escapeHtml(
                friendlyError(error)
              )}

            </div>

          `;

        }

      }
    );


  /* =====================================
     Listen to typing
  ===================================== */

  listenTyping();

}


/* =========================================================
   27. UPDATE CHAT HEADER STATUS
========================================================= */

function updateChatHeaderStatus() {

  if (!chatStatus) {
    return;
  }


  if (
    selectedChat.type ===
    "public"
  ) {

    chatStatus.textContent =
      "Everyone can join";

    return;

  }


  const online =
    Boolean(
      presenceCache[
        selectedChat.uid
      ]?.online
    );


  chatStatus.textContent =
    online
      ? "Online"
      : "Offline";

}


/* =========================================================
   28. RENDER MESSAGE
========================================================= */

function renderMessage(message) {

  if (!messagesEl) {
    return;
  }


  const isMine =
    message.uid ===
    currentUser?.uid;


  const messageElement =
    document.createElement(
      "div"
    );


  messageElement.className =
    `message ${
      isMine
        ? "message-mine"
        : "message-other"
    }`;


  const senderName =
    message.name ||
    "User";


  const text =
    message.text || "";


  const time =
    formatTime(
      message.createdAt
    );


  messageElement.innerHTML = `

    ${
      !isMine &&
      selectedChat.type === "public"
        ? `
          <div class="message-sender">
            ${escapeHtml(senderName)}
          </div>
        `
        : ""
    }

    <div class="message-text">
      ${escapeHtml(text)}
    </div>

    <div class="message-time">
      ${escapeHtml(time)}
    </div>

  `;


  messagesEl.appendChild(
    messageElement
  );

}


/* =========================================================
   29. SEND MESSAGE
========================================================= */

messageForm?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    await sendMessage();

  }
);


/* =========================================================
   30. SEND MESSAGE FUNCTION
========================================================= */

async function sendMessage() {

  if (
    !currentUser ||
    !messageInput ||
    isSendingMessage
  ) {

    return;

  }


  const text =
    messageInput.value.trim();


  if (!text) {
    return;
  }


  if (text.length > 1000) {

    showToast(
      "Message is too long. Maximum 1000 characters."
    );

    return;

  }


  isSendingMessage = true;


  try {

    let messagesCollection;


    if (
      selectedChat.type ===
      "public"
    ) {

      messagesCollection =
        collection(
          db,
          "publicMessages"
        );

    } else {

      messagesCollection =
        collection(
          db,
          "privateChats",
          selectedChat.id,
          "messages"
        );

    }


    await addDoc(
      messagesCollection,
      {

        uid:
          currentUser.uid,

        name:
          myProfile?.name ||
          "User",

        text:
          text,

        createdAt:
          serverTimestamp()

      }
    );


    messageInput.value = "";

    stopTyping();


    /* Keep focus on input */

    messageInput.focus();


  } catch (error) {

    console.error(
      "Send message error:",
      error
    );

    showToast(
      friendlyError(error)
    );

  } finally {

    isSendingMessage = false;

  }

}


/* =========================================================
   31. TYPING INDICATOR
========================================================= */

function typingPath() {

  return `typing/${selectedChat.id}`;

}


/* =========================================================
   32. LISTEN TO TYPING
========================================================= */

function listenTyping() {

  if (!currentUser) {
    return;
  }


  if (unsubscribeTyping) {

    unsubscribeTyping();

    unsubscribeTyping = null;

  }


  const typingRef =
    ref(
      rtdb,
      typingPath()
    );


  unsubscribeTyping =
    onValue(
      typingRef,
      (snapshot) => {

        const typingUsers =
          snapshot.val() || {};


        const otherTypingUsers =
          Object.entries(
            typingUsers
          )
            .filter(
              ([uid, value]) =>
                uid !== currentUser.uid &&
                value?.typing === true
            );


        if (
          otherTypingUsers.length === 0
        ) {

          if (typingEl) {
            typingEl.textContent = "";
          }

          return;

        }


        const names =
          otherTypingUsers.map(
            ([uid, value]) =>
              value?.name || "Someone"
          );


        if (typingEl) {

          if (names.length === 1) {

            typingEl.textContent =
              `${names[0]} is typing...`;

          } else {

            typingEl.textContent =
              `${names.slice(0, 2).join(", ")} are typing...`;

          }

        }

      },
      (error) => {

        console.error(
          "Typing listener error:",
          error
        );

      }
    );

}


/* =========================================================
   33. SET TYPING
========================================================= */

async function setTyping() {

  if (!currentUser) {
    return;
  }


  const typingUserRef =
    ref(
      rtdb,
      `${typingPath()}/${currentUser.uid}`
    );


  try {

    await set(
      typingUserRef,
      {

        typing: true,

        name:
          myProfile?.name ||
          "User",

        updatedAt:
          rtdbTimestamp()

      }
    );


    clearTimeout(
      typingTimer
    );


    typingTimer =
      setTimeout(
        () => {

          stopTyping();

        },
        3000
      );

  } catch (error) {

    console.error(
      "Set typing error:",
      error
    );

  }

}


/* =========================================================
   34. STOP TYPING
========================================================= */

async function stopTyping() {

  if (!currentUser) {
    return;
  }


  clearTimeout(
    typingTimer
  );


  const typingUserRef =
    ref(
      rtdb,
      `${typingPath()}/${currentUser.uid}`
    );


  try {

    await set(
      typingUserRef,
      {

        typing: false,

        name:
          myProfile?.name ||
          "User",

        updatedAt:
          rtdbTimestamp()

      }
    );

  } catch (error) {

    console.error(
      "Stop typing error:",
      error
    );

  }

}


/* =========================================================
   35. MESSAGE INPUT TYPING EVENTS
========================================================= */

messageInput?.addEventListener(
  "input",
  () => {

    const value =
      messageInput.value.trim();


    if (!value) {

      stopTyping();

      return;

    }


    setTyping();

  }
);


/* =========================================================
   36. MESSAGE INPUT ENTER KEY
========================================================= */

messageInput?.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      sendMessage();

    }

  }
);


/* =========================================================
   37. SCROLL MESSAGES
========================================================= */

function scrollMessagesToBottom() {

  if (!messagesEl) {
    return;
  }


  requestAnimationFrame(
    () => {

      messagesEl.scrollTop =
        messagesEl.scrollHeight;

    }
  );

}


/* =========================================================
   38. BACK BUTTON
========================================================= */

backBtn?.addEventListener(
  "click",
  () => {

    appScreen?.classList.remove(
      "mobile-chat"
    );

    stopTyping();

  }
);
/* =========================================================
   39. CLEANUP LISTENERS
========================================================= */

function cleanupListeners() {

  if (unsubscribeMessages) {

    unsubscribeMessages();

    unsubscribeMessages = null;

  }


  if (unsubscribeUsers) {

    unsubscribeUsers();

    unsubscribeUsers = null;

  }


  if (unsubscribePresence) {

    unsubscribePresence();

    unsubscribePresence = null;

  }


  if (unsubscribeTyping) {

    unsubscribeTyping();

    unsubscribeTyping = null;

  }


  clearTimeout(
    typingTimer
  );

}


/* =========================================================
   40. INITIAL AUTH MODE
========================================================= */

setAuthMode("login");


/* =========================================================
   41. CONSOLE MESSAGE
========================================================= */

console.log(
  "Firebase Chatroom app loaded successfully."
);
/* =========================================================
   42. COMPLETE ACCOUNT DELETION
========================================================= */

const deleteAccountBtn =
  document.getElementById("deleteAccountBtn");

deleteAccountBtn?.addEventListener(
  "click",
  async () => {

    if (!currentUser) return;

    const uid = currentUser.uid;

    const confirmed = confirm(
      "Delete Account permanently?\n\n" +
      "Your profile, public messages and private chats " +
      "will be permanently deleted."
    );

    if (!confirmed) return;

    const finalConfirmed = confirm(
      "FINAL WARNING\n\n" +
      "Your account and all your chats will be deleted " +
      "for everyone.\n\n" +
      "This cannot be undone."
    );

    if (!finalConfirmed) return;

    try {

      deleteAccountBtn.disabled = true;

      deleteAccountBtn.textContent =
        "Deleting...";

     /* Delete public messages */

const publicQuery = query(
  collection(db, "publicMessages"),
  where("uid", "==", uid)
);

const publicSnapshot =
  await getDocs(publicQuery);

for (const messageDoc of publicSnapshot.docs) {
  await deleteDoc(messageDoc.ref);
}


/* Get all users */

const usersSnapshot = await getDocs(
  collection(db, "users")
);


/* Delete private chats */

for (const userDoc of usersSnapshot.docs) {

  const otherUid = userDoc.data().uid;

  if (!otherUid || otherUid === uid) {
    continue;
  }

  const chatId =
    conversationId(uid, otherUid);

  const messagesRef = collection(
    db,
    "privateChats",
    chatId,
    "messages"
  );

  const messagesSnapshot =
    await getDocs(messagesRef);

  for (const messageDoc of messagesSnapshot.docs) {
    await deleteDoc(messageDoc.ref);
  }

  await deleteDoc(
    doc(db, "privateChats", chatId)
  );
}
/* Remove presence */

try {
  await remove(
    ref(rtdb, `presence/${uid}`)
  );
} catch (error) {
  console.log(
    "Presence cleanup:",
    error
  );
}


/* Remove typing status */

try {

  await remove(
    ref(rtdb, `typing/public/${uid}`)
  );

  for (const userDoc of usersSnapshot.docs) {

    const otherUid =
      userDoc.data().uid;

    if (!otherUid || otherUid === uid) {
      continue;
    }

    const chatId =
      conversationId(uid, otherUid);

    await remove(
      ref(
        rtdb,
        `typing/${chatId}/${uid}`
      )
    );
  }

} catch (error) {

  console.log(
    "Typing cleanup:",
    error
  );
}
/* Delete user profile */

await deleteDoc(
  doc(db, "users", uid)
);


/* Delete Firebase Authentication account */

await deleteUser(currentUser);
       } catch (error) {

      console.error(
        "Account deletion error:",
        error
      );

      if (
        error.code === "auth/requires-recent-login"
      ) {

        alert(
          "Security ke liye recent login required hai.\n\n" +
          "Logout karke dobara login karo, " +
          "phir Delete Account try karo."
        );

      } else {

        alert(
          "Account deletion failed:\n\n" +
          friendlyError(error)
        );

      }

    } finally {
      deleteAccountBtn.disabled = false;

      deleteAccountBtn.textContent =
        "Delete Account";
    }

  }
);
   
