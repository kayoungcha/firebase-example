import { useEffect, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { updateDoc, uploadImages, useReadDoc } from "../hooks/useFirebaseDb";
import type { PostFields } from "../types";

export default function PostWritePage() {
  // URL 의 :id 가 있으면 수정 모드, 없으면 글쓰기 모드
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  // 수정 모드일 때만 기존 글을 가져옵니다 (id 가 undefined 면 useReadDoc 이 즉시 null 반환)
  const {
    data: post,
    loading,
    error,
  } = useReadDoc<PostFields>("posts", "id", id);

  // 수정 모드에서 기존 글을 폼에 한 번 채웠는지 표시
  const [loaded, setLoaded] = useState(false);
  // 글 제목
  const [title, setTitle] = useState("");
  // const [author, setAuthor] = useState("");=> 지금은 작성자를 단일로 설정해놔서 주석처리
  // 글 내용
  const [content, setContent] = useState("");
  // 기존에 저장된 이미지 url 목록 (수정 모드일 때만 채워짐)
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  // 새로 고른 파일들 — 업로드 전에 잠시 담아놓는 곳
  const [newFiles, setNewFiles] = useState<File[]>([]);
  // 새로 고른 파일들의 미리보기용 object URL
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  // 저장 진행 중 상태 (버튼 disabled / 라벨 변경용)
  const [submitting, setSubmitting] = useState(false);

  // 수정 모드: post 가 로드되면 폼 각 칸에 한 번만 채워줍니다 (사용자가 입력 중이면 덮어쓰지 않게 loaded 플래그 사용)
  useEffect(() => {
    if (!isEdit || !post || loaded) return;
    setTitle(post.title);
    // setAuthor(post.author ?? "");
    setContent(post.content);
    setExistingUrls(post.imageUrls ?? []);
    setLoaded(true);
  }, [isEdit, post, loaded]);

  // 새로 고른 파일들의 미리보기 URL 은 컴포넌트가 사라질 때 / 새 파일 set 될 때 해제합니다 (메모리 누수 방지)
  useEffect(() => {
    return () => {
      newPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newPreviews]);

  // 이미지 파일 추가 — 기존 선택에 누적됩니다
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;
    const arr = Array.from(list);
    setNewFiles((prev) => [...prev, ...arr]);
    setNewPreviews((prev) => [
      ...prev,
      ...arr.map((f) => URL.createObjectURL(f)),
    ]);
    // 같은 파일을 다시 고를 수 있도록 input 값 초기화
    e.target.value = "";
  }

  // 기존 이미지 제거 — 문서의 imageUrls 에서만 빠지고 Storage 원본 파일은 그대로 남습니다
  function removeExisting(url: string) {
    setExistingUrls((prev) => prev.filter((u) => u !== url));
  }

  // 방금 고른 이미지 취소 — 아직 업로드 전이라 미리보기 URL 만 해제하면 끝
  function removeNew(index: number) {
    setNewPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // 저장 — id 가 있으면 수정 (짝수 path), 없으면 새 글 (홀수 path) 로 분기
  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      alert("제목과 내용을 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) 새로 고른 파일이 있으면 Storage 에 먼저 업로드 → 다운로드 URL 배열을 받음
      const newlyUploadedUrls = await uploadImages(newFiles);
      // 2) 남겨둔 기존 이미지 + 새로 올린 이미지 합치기
      const imageUrls = [...existingUrls, ...newlyUploadedUrls];

      if (isEdit) {
        // 수정 모드: `posts/${id}` (짝수 segment) → setDoc + merge, updatedAt 자동 주입
        await updateDoc<PostFields>(`posts/${id}`, {
          title: title.trim(),
          // author: author.trim() || "운영자",
          content: content.trim(),
          ...(imageUrls.length > 0 ? { imageUrls } : {}),
        });
        navigate(`/posts/${id}`);
      } else {
        // 글쓰기 모드: `posts` (홀수 segment) → 새 문서 생성, id / createdAt 자동 주입
        await updateDoc<PostFields>("posts", {
          title: title.trim(),
          // author: author.trim() || "운영자",
          deleteSwitch: false,
          content: content.trim(),
          ...(imageUrls.length > 0 ? { imageUrls } : {}),
        });
        navigate("/");
      }
    } catch (err) {
      alert("저장에 실패했습니다: " + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // 수정 모드 한정 가드: 로딩 / 에러 / 글 없음(또는 이미 삭제된 글) 상태 처리
  if (isEdit && loading) return <p className="empty">불러오는 중…</p>;
  if (isEdit && error) return <p className="error">에러: {error.message}</p>;
  if (isEdit && (!post || post.deleteSwitch)) {
    return <p className="empty">게시글을 찾을 수 없습니다.</p>;
  }

  // 취소 버튼이 돌아갈 곳 — 수정이면 상세로, 글쓰기면 목록으로
  const cancelTo = isEdit ? `/posts/${id}` : "/";

  return (
    <section>
      <h1>{isEdit ? "글 수정" : "글쓰기"}</h1>

      <form className="post-form">
        <label>
          제목
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
          />
        </label>

        <label>
          내용
          <textarea
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요"
          />
        </label>

        <label>
          이미지 추가 (선택, 여러 장 가능)
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
          />
        </label>

        {/* 이미지 보이는 곳 */}
        {(existingUrls.length > 0 || newPreviews.length > 0) && (
          <ul className="image-previews">
            {existingUrls.map((url, i) => (
              <li key={url}>
                <img src={url} alt={`기존 이미지 ${i + 1}`} />
                <button
                  type="button"
                  className="preview-remove"
                  onClick={() => removeExisting(url)}
                  aria-label="이미지 제거"
                >
                  ✕
                </button>
              </li>
            ))}
            {newPreviews.map((url, i) => (
              <li key={url}>
                <img src={url} alt={`새 이미지 ${i + 1}`} />
                <button
                  type="button"
                  className="preview-remove"
                  onClick={() => removeNew(i)}
                  aria-label="이미지 제거"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="form-actions">
          <Link to={cancelTo} className="button">
            취소
          </Link>
          <button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "저장 중…" : isEdit ? "저장" : "등록"}
          </button>
        </div>
      </form>
    </section>
  );
}
