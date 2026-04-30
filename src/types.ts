import type { Timestamp } from "firebase/firestore";

// Firestore 문서 안에 실제로 들어가는 필드들.
// 입력(addDocument) 시에는 id / createdAt 을 자동 생성하므로 호출자가 안 넣어도 됩니다
// (`Omit<PostFields, "id" | "createdAt">` 가 그 자리를 가립니다).
export interface PostFields {
  // 문서 경로의 id 를 본문에도 함께 저장합니다 (addDocument 가 자동 주입).
  id: string; //문서 경로 id
  title: string; // 문서 제목
  content: string; // 문서 내용
  author?: string; // 작성자 => 보통 user의 userId를 지정해 놓습니다.
  createdAt?: Timestamp; //글 올린 날짜
  updatedAt?: Timestamp; // 글을 수정한 날짜
  deleteSwitch: boolean; //삭제 한 글인지
  deletedAt?: Timestamp; // 삭제한 날짜
  // Storage 에 업로드된 이미지의 다운로드 URL 목록.
  // 이미지 없이 글만 작성한 경우 필드 자체가 없을 수 있습니다.
  imageUrls?: string[]; // 이미지 리스트
}

export type Post = PostFields;
