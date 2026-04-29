import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { updateAt, uploadImages, useReadDoc } from "../hooks/useFirebaseDb";
import type { PostFields } from "../types";

export default function PostEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: post, loading, error } = useReadDoc<PostFields>("posts", "id", id);

  // 폼 상태 — 글이 로드되면 한 번 채웁니다.
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  // const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!post || loaded) return;
    setTitle(post.title);
    // setAuthor(post.author ?? "");
    setContent(post.content);
    setExistingUrls(post.imageUrls ?? []);
    setLoaded(true);
  }, [post, loaded]);

  // 새로 고른 파일들의 미리보기 URL 정리
  useEffect(() => {
    return () => {
      newPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newPreviews]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;
    const arr = Array.from(list);
    setNewFiles((prev) => [...prev, ...arr]);
    setNewPreviews((prev) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);
    // 같은 파일을 다시 고를 수 있도록 input 초기화
    e.target.value = "";
  }

  function removeExisting(url: string) {
    setExistingUrls((prev) => prev.filter((u) => u !== url));
  }

  function removeNew(index: number) {
    setNewPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;

    if (!title.trim() || !content.trim()) {
      alert("제목과 내용을 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const newlyUploadedUrls = await uploadImages(newFiles);
      const imageUrls = [...existingUrls, ...newlyUploadedUrls];

      await updateAt<PostFields>(`posts/${id}`, {
        title: title.trim(),
        // author: author.trim() || "운영자",
        content: content.trim(),
        // 이미지가 한 장도 없으면 필드를 비우고, 있으면 배열로 저장.
        ...(imageUrls.length > 0 ? { imageUrls } : {}),
      });

      navigate(`/posts/${id}`);
    } catch (err) {
      alert("저장에 실패했습니다: " + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="empty">불러오는 중…</p>;
  if (error) return <p className="error">에러: {error.message}</p>;
  // 존재하지 않거나 이미 소프트 삭제된 글은 수정도 막습니다.
  if (!post || post.deleteSwitch) {
    return <p className="empty">게시글을 찾을 수 없습니다.</p>;
  }

  return (
    <section>
      <h1>글 수정</h1>

      <form className="post-form" onSubmit={handleSubmit}>
        <label>
          제목
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label>
          내용
          <textarea
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
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
          <Link to={`/posts/${id}`} className="button">
            취소
          </Link>
          <button type="submit" disabled={submitting}>
            {submitting ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </section>
  );
}
