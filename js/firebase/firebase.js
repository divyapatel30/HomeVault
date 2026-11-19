import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBXYJ8GrtbpCcj_wD4WrdMbMUOciSx7yeQ",
    authDomain: "homevault-3d291.firebaseapp.com",
    projectId: "homevault-3d291",
    messagingSenderId: "639022089280",
    appId: "1:639022089280:web:a6b88afde979d73d254ba5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Firebase Authentication Action URL
export function getAuthActionCodeSettings() {
    return {
        url: new URL(
            "pages/action-handler.html",
            window.location.origin
        ).href
    };
}