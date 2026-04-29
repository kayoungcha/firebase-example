# Firebase + Vite + React 게시판 예시

Firebase Firestore + Cloud Storage 를 사용한 간단한 게시판 예시입니다.
**목록 → 상세 → 글쓰기 → 수정** 네 화면이 들어 있습니다.

## 사용 기술

- **Vite 6** — 개발 서버 / 번들러
- **React 19** + **TypeScript**
- **React Router 7** — 페이지 이동
- **Firebase 11** — Firestore (DB) + Cloud Storage (이미지)

---

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Firebase 프로젝트 만들기

1. <https://console.firebase.google.com/> 접속 → 프로젝트 생성
2. **빌드 → Firestore Database** → "데이터베이스 만들기" → **프로덕션 모드** 선택
3. **빌드 → Storage** → "시작하기" → **프로덕션 모드** 선택
4. 좌측 상단 톱니바퀴 → **프로젝트 설정** → "내 앱" → 웹 앱 추가
5. 표시되는 `firebaseConfig` 객체의 값들을 복사
6. 보안 규칙 배포 — 이 리포의 [firestore.rules](firestore.rules) / [storage.rules](storage.rules) 내용을 각각 콘솔의 **Firestore → 규칙**, **Storage → 규칙** 탭에 붙여넣고 "게시" (룰을 배포하기 전까지는 프로덕션 모드 기본 룰 때문에 모든 읽기/쓰기가 거부됩니다)

### 3. 환경 변수 설정

`.env.example` 을 `.env` 로 복사해서 값을 채웁니다.

```bash
cp .env.example .env
```

`.env` 안에 Firebase 콘솔에서 복사한 값을 넣으세요.

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=1:...:web:...
```

> ⚠️ Vite 는 `VITE_` 접두사가 붙은 변수만 브라우저에 노출합니다.
> 다른 이름으로 만들면 `import.meta.env` 에 나타나지 않습니다.

### 4. 개발 서버 실행

```bash
npm run dev
```

<http://localhost:5173> 으로 접속.

---

## 폴더 구조

```
firestore.rules            Firestore 보안 규칙 (콘솔에 붙여넣기)
storage.rules              Storage 보안 규칙 (콘솔에 붙여넣기)
src/
├── main.tsx               앱 진입점 (BrowserRouter 설정)
├── App.tsx                라우팅 정의 (목록/상세/글쓰기)
├── index.css              전역 스타일
├── types.ts               PostFields / Post 타입 정의
├── lib/
│   └── firebase.ts        Firebase 초기화 (db + storage)
├── hooks/
│   └── useFirebaseDb.ts   Firestore + Storage 읽기/쓰기 헬퍼
└── pages/
    ├── PostListPage.tsx   목록 (/)
    ├── PostDetailPage.tsx 상세 (/posts/:id)
    ├── PostEditPage.tsx   수정 (/posts/:id/edit)
    └── PostWritePage.tsx  글쓰기 (/write)
```

---

## Firestore 데이터 구조

`posts` 컬렉션을 사용합니다. **글쓰기를 한 번 하면 컬렉션이 자동 생성**되므로,
Firestore 콘솔에서 미리 만들어 둘 필요는 없습니다.

각 문서의 필드:

| 필드           | 타입       | 설명                                                              |
| -------------- | ---------- | ----------------------------------------------------------------- |
| `id`           | string     | 문서 ID (경로 id 와 동일, `addDocument` 가 자동 주입)               |
| `title`        | string     | 제목 (1~200자)                                                    |
| `content`      | string     | 본문 (1~10000자)                                                  |
| `author`       | string     | 작성자 (선택)                                                     |
| `createdAt`    | Timestamp  | 서버 시각 (글쓰기 시 자동 입력)                                   |
| `updatedAt`    | Timestamp  | 서버 시각 (수정/삭제 시 `updateDocument` 가 자동 입력)             |
| `deleteSwitch` | boolean    | 소프트 삭제 플래그 (생성 시 false, 삭제 시 true)                  |
| `deletedAt`    | Timestamp  | 소프트 삭제된 시각 (`softDeleteDocument` 가 자동 입력)            |
| `imageUrls`    | string[]   | 첨부 이미지 다운로드 URL 목록 (선택, 최대 10장)                  |

이미지 파일 자체는 Cloud Storage 의 `posts/` 경로 아래에 올라가고, 그 다운로드 URL 만 Firestore 문서의 `imageUrls` 에 저장됩니다.

---

## 핵심 함수 한눈에 보기

`src/hooks/useFirebaseDb.ts` 안에 네 가지가 들어 있습니다.

```ts
// 목록: 컬렉션 전체 조회
const { data, loading, error } = useReadDb<PostFields>("posts", "createdAt", "desc");

// 단일 문서 조회 — where 기반: (col, field, value)
const { data, loading, error } = useReadDoc<PostFields>("posts", "id", id);

// 이미지 업로드: Storage 에 올린 뒤 다운로드 URL 배열을 받음
const imageUrls = await uploadImages(files);

// 통합 저장 — path segment 수로 동작 결정
await updateAt<PostFields>("posts", { title, content, deleteSwitch: false });        // 홀수 → 생성
await updateAt<PostFields>(`posts/${id}`, { title, content });                        // 짝수 → 수정
await updateAt<PostFields>(`posts/${id}`, {                                           // 짝수 → 소프트 삭제
  deleteSwitch: true,
  deletedAt: serverTimestamp(),
});
```

---

## 주의사항 (실서비스에 쓰기 전에)

- 이 프로젝트는 **인증 없이** 운영합니다. 룰이 형태(필드 / 길이 / 파일 타입 / 크기) 검증은 해 주지만, **누구나 글쓰기와 이미지 업로드가 가능**합니다 — 스팸/악성 데이터로부터 자유롭지 않습니다.
- 본격적인 보호가 필요하면 **Firebase Authentication**(익명 로그인이 가장 가벼움) 을 도입한 뒤, 룰에서 `request.auth != null` 과 `authorUid == request.auth.uid` 같은 조건으로 본인 글에만 update / delete 를 허용하세요.
- 입력값 검증, XSS 처리 등은 학습 후 단계별로 추가해 보세요.
