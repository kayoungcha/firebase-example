import { useEffect, useState } from "react";
import {
  type DocumentData,
  type OrderByDirection,
  type PartialWithFieldValue,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "../lib/firebase";

// ────────────────────────────────────────────────────────────
// 1) 컬렉션 전체 조회 — 목록 페이지에서 사용
// ────────────────────────────────────────────────────────────
export function useReadDb<T extends DocumentData>(
  collectionName: string,
  orderKey: string = "createdAt",
  direction: OrderByDirection = "desc"
) {
  const [data, setData] = useState<Array<T & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        const ref = collection(db, collectionName);
        const q = query(ref, orderBy(orderKey, direction));
        const snapshot = await getDocs(q);

        const rows = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as T),
        }));

        if (!cancelled) setData(rows);
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [collectionName, orderKey, direction]);

  return { data, loading, error };
}

// ────────────────────────────────────────────────────────────
// 2) where 조건으로 단일 문서 조회 — 상세 / 수정 페이지에서 사용
// ────────────────────────────────────────────────────────────
// (col, field, value) 로 받아 `where(field, "==", value)` + `limit(1)` 로 한 건만 가져옵니다.
// 예: useReadDoc<PostFields>("posts", "id", id)
//     useReadDoc<PostFields>("posts", "title", "제목입니다")
export function useReadDoc<T extends DocumentData>(
  collectionName: string,
  field: string,
  value: string | undefined
) {
  const [data, setData] = useState<(T & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    // value 가 아직 정해지지 않은 상태:
    // "찾을 수 없음" 으로 단정 짓지 말고 로딩을 유지합니다.
    if (!value) {
      setData(null);
      return () => {
        cancelled = true;
      };
    }

    const safeValue = value;

    async function fetchDoc() {
      try {
        setLoading(true);
        const q = query(
          collection(db, collectionName),
          where(field, "==", safeValue),
          limit(1)
        );
        const snapshot = await getDocs(q);

        if (cancelled) return;

        const first = snapshot.docs[0];
        if (first) {
          setData({ id: first.id, ...(first.data() as T) });
        } else {
          setData(null);
        }
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDoc();
    return () => {
      cancelled = true;
    };
  }, [collectionName, field, value]);

  return { data, loading, error };
}

// ────────────────────────────────────────────────────────────
// 3) 저장 — 새 문서 업로드 / 수정
// ────────────────────────────────────────────────────────────
// 경로 segment 수로 동작이 결정됩니다.
//   - 홀수 ("posts"):           새 문서 생성. id / createdAt 자동 주입, 생성된 docId 반환.
//   - 짝수 ("posts/abc123"):    기존 문서 부분 갱신 (setDoc + merge). updatedAt 자동 주입.
//
// data 타입이 PartialWithFieldValue 라 serverTimestamp() 같은 FieldValue 도 그대로 넣을 수 있습니다.
// 예)  삭제: updateAt(`posts/${id}`, { deleteSwitch: true, deletedAt: serverTimestamp() })
export async function updateAt<T extends DocumentData>(
  path: string,
  data: PartialWithFieldValue<Omit<T, "id" | "createdAt" | "updatedAt">>
): Promise<string | void> {
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    throw new Error("path 가 비어 있습니다.");
  }

  const payload = data as DocumentData;

  // 짝수: 특정 문서 갱신
  if (segments.length % 2 === 0) {
    await setDoc(
      doc(db, path),
      { ...payload, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return;
  }

  // 홀수: 새 문서 생성
  const docRef = doc(collection(db, path));
  await setDoc(docRef, {
    ...payload,
    id: docRef.id,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// ────────────────────────────────────────────────────────────
// 4) 이미지 여러 장 업로드 — 글쓰기 / 수정 페이지에서 사용
// ────────────────────────────────────────────────────────────
// 각 파일을 Storage 에 올린 뒤 다운로드 URL 배열을 돌려줍니다.
// 파일명 충돌을 피하려고 timestamp + 짧은 랜덤값을 prefix 로 붙입니다.
export async function uploadImages(
  files: File[],
  pathPrefix: string = "posts"
): Promise<string[]> {
  if (files.length === 0) return [];

  const uploads = files.map(async (file) => {
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf("."))
      : "";
    const random = Math.random().toString(36).slice(2, 8);
    const path = `${pathPrefix}/${Date.now()}-${random}${ext}`;
    const ref = storageRef(storage, path);
    const snap = await uploadBytes(ref, file);
    return getDownloadURL(snap.ref);
  });

  return Promise.all(uploads);
}
