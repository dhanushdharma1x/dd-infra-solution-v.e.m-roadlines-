import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCBpc9OU_2wr9ICGXvqA8rF_MNVnikoSBw",
  authDomain: "gen-lang-client-0122303365.firebaseapp.com",
  projectId: "gen-lang-client-0122303365",
  storageBucket: "gen-lang-client-0122303365.firebasestorage.app",
  messagingSenderId: "187946871611",
  appId: "1:187946871611:web:a28d04ae66369e43b7e51e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firestore with custom database ID from config
export const db = getFirestore(app, "ai-studio-951a16c4-101c-49c1-8a55-a6af1dcfde13");
