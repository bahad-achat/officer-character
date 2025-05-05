import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

const app = initializeApp({
  apiKey: "AIzaSyD6PAFF5Qs13XKkddB15w3qO_aBTRm-rvI",
  authDomain: "officer-character.firebaseapp.com",
  projectId: "officer-character",
  storageBucket: "officer-character.appspot.com",
  messagingSenderId: "1035907227345",
  appId: "1:1035907227345:web:251bf7fb8fde02916c2ff0",
})

export const firestore = getFirestore(app)
export const auth = getAuth(app)
