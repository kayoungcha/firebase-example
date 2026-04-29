# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 명령어

- `npm run dev` — Vite 개발 서버 실행 (http://localhost:5173)
- `npm run build` — 타입 체크(`tsc -b`) 후 프로덕션 빌드
- `npm run preview` — 빌드된 `dist/` 결과물 미리보기

테스트 / 린터 / 포매터는 별도로 설정되어 있지 않습니다.

## 사전 준비

루트의 `.env` 파일이 없으면 앱이 정상적으로 초기화되지 않습니다. `.env.example` 을 `.env` 로 복사한 뒤, Firebase 콘솔(프로젝트 설정 → 내 앱)에서 받은 6개의 `VITE_FIREBASE_*` 값을 채워야 합니다. Vite 는 `VITE_` 접두사가 붙은 환경변수만 노출하므로, 이름을 바꾸면 [src/lib/firebase.ts](src/lib/firebase.ts) 의 `import.meta.env` 조회가 전부 `undefined` 가 됩니다.

## 아키텍처

세 화면(목록 / 상세 / 글쓰기) 으로 구성된 Firestore + Storage 학습용 예제이며, React Router 7 로 라우팅합니다. 데이터 계층이 의도적으로 매우 얇아서(공개 함수 4개), 각 페이지가 직접 그 함수를 호출합니다. 전역 상태 라이브러리도, 인증도, Firestore 실시간 리스너도 없습니다 — 모든 읽기는 `getDocs` / `getDoc` 으로 한 번만 가져옵니다.

**데이터 계층 — [src/hooks/useFirebaseDb.ts](src/hooks/useFirebaseDb.ts)**

[src/lib/firebase.ts](src/lib/firebase.ts) 의 싱글턴 `db` / `storage` 위에 네 개의 함수를 제공합니다.

- `useReadDb<T>(collectionName, orderKey, direction)` — 컬렉션 전체 조회 + loading / error 상태. 목록 페이지에서 사용.
- `useReadDoc<T>(collectionName, id)` — 단일 문서 조회. 문서가 존재하지 않을 때 `data: null` 을 반환합니다 (loading 과 구분됨). 상세 페이지에서 사용.
- `updateAt<T>(path, data)` — 생성/갱신/소프트 삭제를 모두 처리하는 통합 저장 함수. **path 의 segment 수로 동작 결정**:
  - 홀수 (`"posts"`) → 새 문서 생성. id 자동 생성 + 본문에도 박고, `createdAt: serverTimestamp()` 주입, 생성된 docId 반환 (`Promise<string>`).
  - 짝수 (`"posts/abc123"`) → 부분 갱신 (setDoc + merge). `updatedAt: serverTimestamp()` 자동 주입, 반환 `void`.
  - 입력 타입은 `PartialWithFieldValue<Omit<T, "id" | "createdAt" | "updatedAt">>` — `serverTimestamp()` 같은 FieldValue 도 그대로 넣을 수 있어서, **소프트 삭제는 별도 함수 없이** `updateAt(\`posts/${id}\`, { deleteSwitch: true, deletedAt: serverTimestamp() })` 한 줄로 처리합니다.
  - 룰에서 `data.id == postId` 를 검증해서 경로 id 와 본문 id 가 어긋나지 않도록 강제합니다.
- `uploadImages(files, pathPrefix?)` — 파일 배열을 Storage 의 `posts/` 아래에 올린 뒤 다운로드 URL 배열을 돌려줍니다. 글쓰기/수정 페이지에서 `updateAt` 보다 먼저 호출해 받은 URL 들을 문서의 `imageUrls` 필드로 저장합니다.

두 훅 모두 effect cleanup 에서 `cancelled` 플래그를 사용해, 언마운트 이후 setState 가 호출되지 않도록 합니다. 새로운 훅을 추가할 때도 이 패턴을 유지해 주세요.

**라우팅 — [src/App.tsx](src/App.tsx)**

`/` → 목록, `/posts/:id` → 상세, `/posts/:id/edit` → 수정, `/write` → 글쓰기. `BrowserRouter` 는 [src/main.tsx](src/main.tsx) 에서 마운트됩니다.

**스키마 — [src/types.ts](src/types.ts)**

컬렉션은 `posts` 하나뿐입니다. `PostFields` 가 문서 안에 들어가는 필드 — 필수: `id: string`, `title`, `content`, `deleteSwitch: boolean`. 선택: `author`, `createdAt: Timestamp`, `updatedAt: Timestamp`, `deletedAt: Timestamp`, `imageUrls: string[]`. `Post = PostFields` 입니다 — id 가 본문에도 저장되므로 read 형태와 write 형태가 같은 모양입니다. 컬렉션은 첫 글쓰기 시 자동 생성되므로 콘솔에서 미리 만들지 마세요.

**소프트 삭제 컨벤션**

`deleteSwitch: true` 인 문서는 "삭제된 것" 으로 취급합니다 — `softDeleteDocument` 가 `deletedAt` 과 함께 박아주고, 목록 페이지는 클라이언트에서 `data.filter(p => !p.deleteSwitch)` 로 걸러내며, 상세 / 수정 페이지는 `post.deleteSwitch` 면 "찾을 수 없음" 처리합니다. 서버 사이드에서 걸러내려면 `where("deleteSwitch", "==", false) + orderBy("createdAt", "desc")` 가 필요한데, 이 조합은 컴포지트 인덱스 셋업이 따로 필요해서 학습 단계에선 클라이언트 필터로 둡니다.

**보안 룰 — [firestore.rules](firestore.rules) / [storage.rules](storage.rules)**

이 프로젝트는 **단일 사용자 전제 + 인증 없음 + 프로덕션 모드 + 형태 검증** 으로 운영합니다. Firestore 룰은 `posts` 문서의 필드 목록 / 타입 / 길이 / `createdAt == request.time` 검증 + `data.id == postId` 일치 검증 + create / update 허용 / delete 차단. Storage 룰은 `posts/` 아래에 5MB 이하 이미지 파일만 올라가도록 제한합니다. **누구나 create / update / upload 가능** 하므로 인터넷에 공개하면 즉시 망가집니다 — 다중 사용자로 갈 때는 Firebase Authentication 도입 + 룰에 `request.auth` 조건을 더해야 합니다. 룰을 변경했을 때는 Firebase 콘솔(Firestore Database → 규칙, Storage → 규칙) 에 붙여넣고 게시해야 적용됩니다.

## 코드를 수정할 때 알아둘 점

- 두 훅은 `T extends DocumentData` 로 제네릭하며 `{ id, ...data }` 형태로 펼쳐 반환합니다. `PostFields` 에 필드를 추가해도 훅은 타입 오류를 내주지 않으므로, [src/types.ts](src/types.ts) 를 함께 갱신해야 합니다.
- `PostFields` 에 새 필드를 추가하면 [firestore.rules](firestore.rules) 의 `hasOnly([...])` / `hasAll([...])` 목록과 형태 검증도 함께 갱신해야 합니다. 그렇지 않으면 새 필드를 포함한 쓰기가 룰에서 거부됩니다.
- Firestore `orderBy` 는 정렬 키가 모든 문서에 존재해야 합니다. 새 쓰기에서도 반드시 `createdAt` 을 포함해야 하며, 그렇지 않으면 일부 문서가 `useReadDb` 결과에서 사라질 수 있습니다.
- 글쓰기 / 수정 흐름은 항상 "이미지 업로드 → 문서 저장" 순서입니다. 업로드 실패 시 `addDocument` / `updateDocument` 는 호출되지 않습니다. 반대로 업로드 성공 후 문서 저장이 실패하면 Storage 에 고아 파일이 남는데, 학습 예제 수준에서는 별도 정리 로직을 두지 않습니다.
- 수정 페이지에서 기존 첨부 이미지를 ✕ 로 제거해도 **Storage 의 실제 파일은 지우지 않습니다** — 문서의 `imageUrls` 배열에서만 빠지고, 원본은 고아 파일로 남습니다. 정리가 필요해지면 `deleteObject(ref(storage, url))` 로 같이 지우면 됩니다.
