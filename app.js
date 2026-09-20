/* =========================================================
   FIREBASE CHATROOM
   Authentication + Firestore Chat + Online Presence
========================================================= */

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
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
  onDisconnect,
  onValue,
  serverTimestamp as rtdbTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";


/* =========================================================
   1. FIREBASE CONFIG
=========================================================

   // For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCsImFYpdYejQHaMEsERqCVK2TX0bMkJTU",
  authDomain: "chatroom-78015.firebaseapp.com",
  projectId: "chatroom-78015",
  storageBucket: "chatroom-78015.firebasestorage.app",
  messagingSenderId: "135624570705",
  appId: "1:135624570705:web:cc0b9219e411d51de68570",
  measurementId: "G-KJD2DZ6JNM"
};


/* =========================================================
   2. INITIALIZE FIREBASE
========================================================= */

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);

const db = getFirestore(firebaseApp);

const rtdb = getDatabase(firebaseApp);


/* =========================================================
   3. HELPER
========================================================= */

const $ = (id) => {
  return document.getElementById(id);
};


/* =========================================================
   4. DOM ELEMENTS
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
   5. APPLICATION STATE
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

let typingTimer = null;


/* =========================================================
   6. AUTH MODE
========================================================= */

function setAuthMode(mode) {

  authMode = mode;

  const isLogin = mode === "login";

  loginTab.classList.toggle(
    "active",
    isLogin
  );

  signupTab.classList.toggle(
    "active",
    !isLogin
  );

  nameInput.classList.toggle(
    "hidden",
    isLogin
  );

  authBtn.textContent =
    isLogin
      ? "Login"
      : "Create account";

  authError.textContent = "";

}


/* =========================================================
   7. LOGIN TAB
========================================================= */

loginTab.addEventListener(
  "click",
  () => {
    setAuthMode("login");
  }
);


/* =========================================================
   8. SIGNUP TAB
========================================================= */

signupTab.addEventListener(
  "click",
  () => {
    setAuthMode("signup");
  }
);


/* =========================================================
   9. TOAST
========================================================= */

function showToast(message) {

  toast.textContent = message;

  toast.classList.add("show");

  setTimeout(() => {

    toast.classList.remove("show");

  }, 2500);

}


/* =========================================================
   10. ESCAPE HTML
=========================================================

   User message को HTML के रूप में execute होने से
   बचाता है।
========================================================= */

function escapeHtml(value) {

  if (!value) {
    return "";
  }

  return String(value).replace(
    /[&<>"']/g,
    function (character) {

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
   11. FORMAT MESSAGE TIME
========================================================= */

function formatTime(timestamp) {

  if (!timestamp) {
    return "";
  }

  let date;

  try {

    if (
      timestamp &&
      typeof timestamp.toDate === "function"
    ) {

      date = timestamp.toDate();

    } else {

      date = new Date(timestamp);

    }

  } catch (error) {

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
   12. PRIVATE CHAT ID
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
   13. FRIENDLY FIREBASE ERRORS
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
      "Network error. Check your internet connection."

  };

  return (
    errors[error.code] ||
    error.message ||
    "Something went wrong."
  );

}


/* =========================================================
   14. SIGNUP / LOGIN
========================================================= */

authForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    authError.textContent = "";

    authBtn.disabled = true;

    try {

      const email =
        emailInput.value.trim();

      const password =
        passwordInput.value;

      /* -------------------------------------
         SIGNUP
      ------------------------------------- */

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
          credential.user.email
        );

        showToast(
          "Account created successfully!"
        );

      }

      /* -------------------------------------
         LOGIN
      ------------------------------------- */

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

      authError.textContent =
        friendlyError(error);

    } finally {

      authBtn.disabled = false;

    }

  }
);


/* =========================================================
   15. SAVE USER PROFILE
========================================================= */

async function saveProfile(
  uid,
  name,
  email
) {

  await setDoc(
    doc(db, "users", uid),
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
   16. LOGOUT
========================================================= */

logoutBtn.addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

    } catch (error) {

      showToast(
        error.message
      );

    }

  }
);


/* =========================================================
   17. AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      currentUser = null;

      myProfile = null;

      authScreen.classList.remove(
        "hidden"
      );

      appScreen.classList.add(
        "hidden"
      );

      cleanupListeners();

      return;

    }


    currentUser = user;


    /* -------------------------------------
       GET PROFILE
    ------------------------------------- */

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
          "User"

      };

    }


    /* -------------------------------------
       SHOW USER
    ------------------------------------- */

    myName.textContent =
      myProfile.name;

    myAvatar.textContent =
      getInitial(
        myProfile.name
      );


    /* -------------------------------------
       SHOW APP
    ------------------------------------- */

    authScreen.classList.add(
      "hidden"
    );

    appScreen.classList.remove(
      "hidden"
    );


    /* -------------------------------------
       START SERVICES
    ------------------------------------- */

    setOnlinePresence();

    listenUsers();


    /* -------------------------------------
       OPEN PUBLIC CHAT
    ------------------------------------- */

    openChat({

      type: "public",

      id: "public",

      name: "Public Chat"

    });

  }
);


/* =========================================================
   18. INITIAL LETTER
========================================================= */

function getInitial(name) {

  if (!name) {
    return "U";
  }

  return name
    .trim()
    .charAt(0)
    .toUpperCase();

}


/* =========================================================
   19. ONLINE PRESENCE
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


  /* -------------------------------------
     Set online
  ------------------------------------- */

  set(
    statusRef,
    {

      online: true,

      name:
        myProfile?.name ||
        "User",

      lastChanged:
        rtdbTimestamp()

    }
  );


  /* -------------------------------------
     Automatically set offline
     when connection closes
  ------------------------------------- */

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


  /* -------------------------------------
     Listen to all presence
  ------------------------------------- */

  if (unsubscribePresence) {

    unsubscribePresence();

  }


  unsubscribePresence =
    onValue(
      ref(rtdb, "presence"),
      (snapshot) => {

        presenceCache =
          snapshot.val() || {};

        renderUsers();

        updateChatHeaderStatus();

      }
    );

}


/* =========================================================
   20. LISTEN TO USERS
========================================================= */

function listenUsers() {

  if (unsubscribeUsers) {

    unsubscribeUsers();

  }


  unsubscribeUsers =
    onSnapshot(
      collection(db, "users"),
      (snapshot) => {

        usersCache =
          snapshot.docs
            .map(
              (document) =>
                document.data()
            )
            .filter(
              (user) =>
                user.uid !== currentUser.uid
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
   21. RENDER USERS
========================================================= */

function renderUsers() {

  if (!currentUser) {
    return;
  }


  const search =
    userSearch.value
      .trim()
      .toLowerCase();


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
            presenceCache[a.uid]?.online
              ? 1
              : 0;

          const onlineB =
            presenceCache[b.uid]?.online
              ? 1
              : 0;

          return onlineB - onlineA;

        }
      );


  userList.innerHTML = "";


  if (filteredUsers.length === 0) {

    const empty =
      document.createElement("div");

    empty.className = "muted";

    empty.style.padding = "20px";

    empty.textContent =
      "No users found.";

    userList.appendChild(
      empty
    );

    return;

  }


  filteredUsers.forEach(
    (user) => {

      const row =
        document.createElement("div");

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

            uid: user.uid,

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
   22. USER SEARCH
========================================================= */

userSearch.addEventListener(
  "input",
  () => {

    renderUsers();

  }
);


/* =========================================================
   23. PUBLIC CHAT CLICK
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
   24. OPEN CHAT
========================================================= */

function openChat(chat) {

  selectedChat = chat;


  /* -------------------------------------
     Header
  ------------------------------------- */

  chatName.textContent =
    chat.name;


  if (chat.type === "public") {

    chatAvatar.textContent =
      "🌐";

  } else {

    chatAvatar.textContent =
      getInitial(
        chat.name
      );

  }


  updateChatHeaderStatus();


  /* -------------------------------------
     Mobile
  ------------------------------------- */

  appScreen.classList.add(
    "mobile-chat"
  );


  typingEl.textContent = "";


  /* -------------------------------------
     Remove old listener
  ------------------------------------- */

  if (unsubscribeMessages) {

    unsubscribeMessages();

    unsubscribeMessages = null;

  }


  /* -------------------------------------
     Firestore path
  ------------------------------------- */

  let messagesCollection;


  if (chat.type === "public") {

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


  /* -------------------------------------
     Query
  ------------------------------------- */

  const messagesQuery =
    query(
      messagesCollection,
      orderBy(
        "createdAt",
        "asc"
      ),
      limit(200)
    );


  /* -------------------------------------
     Listen
  ------------------------------------- */

  unsubscribeMessages =
    onSnapshot(
      messagesQuery,
      (snapshot) => {

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


        messagesEl.innerHTML = `

          <div class="error">

            Could not load messages.

            <br>

            ${escapeHtml(
              error.message
            )}

          </div>

        `;

      }
    );

}


/* =========================================================
   25. UPDATE CHAT HEADER STATUS
========================================================= */

function updateChatHeaderStatus() {

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
     
