import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// .env 파일에서 값을 읽어옵니다.
// Vite 는 VITE_ 로 시작하는 환경변수만 import.meta.env 로 노출시킵니다.
// vite를 사용하지 않는 경우 환경 변수 prefix(VITE_)가 다를수 있으니 확인하세요!
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Firestore (DB) — 게시글 문서 저장
export const db = getFirestore(app);

// Cloud Storage — 이미지 파일 저장
export const storage = getStorage(app);
