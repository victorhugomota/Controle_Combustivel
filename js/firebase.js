// Inicialização do Firebase (banco principal: consumocombustivel-3adda)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJ4UkjwJUqm-CfI6DN3bz6O4fxpBCaUck",
  authDomain: "consumocombustivel-3adda.firebaseapp.com",
  projectId: "consumocombustivel-3adda",
  storageBucket: "consumocombustivel-3adda.firebasestorage.app",
  messagingSenderId: "492857361214",
  appId: "1:492857361214:web:c48b5082b203a9fbe8a26f",
  measurementId: "G-9GH0VHHGZ0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Autenticação anônima (funciona com regras `if request.auth != null`).
// Se a autenticação anônima não estiver habilitada no console, o app continua
// funcionando desde que as regras do Firestore permitam acesso aberto.
export function iniciarAuth(onReady) {
  onAuthStateChanged(auth, (user) => onReady(user));
  signInAnonymously(auth).catch((e) => {
    console.warn("Auth anônima indisponível, seguindo sem auth:", e.code);
    onReady(null);
  });
}

export {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDoc
};
