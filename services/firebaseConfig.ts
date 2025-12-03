import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBFbOJd-wFo0yC5CCRPsexDkbAxjG1sRzs",
  authDomain: "us-smart-studio.firebaseapp.com",
  projectId: "us-smart-studio",
  storageBucket: "us-smart-studio.firebasestorage.app",
  messagingSenderId: "331682154208",
  appId: "1:331682154208:web:4f7f2cf9b144dab4a43285",
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

auth = getAuth(app);
db = getFirestore(app);

export { app, auth, db };
