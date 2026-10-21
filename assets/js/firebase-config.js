import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

export const firebaseConfig = {
    apiKey: "AIzaSyCGNgq99LU300dMjBA-quKFe04VQwRVQvM",
    authDomain: "helth-c7e42.firebaseapp.com",
    projectId: "helth-c7e42",
    databaseURL: "https://helth-c7e42-default-rtdb.firebaseio.com"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
