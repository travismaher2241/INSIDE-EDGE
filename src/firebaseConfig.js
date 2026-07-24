import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Independent Firebase Configuration for Inside Edge
 * (Does NOT share CoachCore credentials, Auth users or Firestore collections)
 */
const firebaseConfig = {
  apiKey: "AIzaSy_INSIDE_EDGE_CRICKET_KEY_MOCK",
  authDomain: "inside-edge-cricket.firebaseapp.com",
  projectId: "inside-edge-cricket",
  storageBucket: "inside-edge-cricket.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:insideedgecricketapp"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };
