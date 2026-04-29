import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { updateAt, uploadImages } from "../hooks/useFirebaseDb";
import type { PostFields } from "../types";

export default function PostWritePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  // const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 미리보기용 object URL 은 컴포넌트가 사라지거나 새 파일이 선택될 때 해제합니다.
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;
    const arr = Array.from(list);
    setFiles(arr);
    setPreviews(arr.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      alert("제목과 내용을 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) 이미지가 있으면 먼저 Storage 에 업로드 — 다운로드 URL 배열을 받습니다.
      // 2) 그 URL 들을 Firestore 문서에 같이 저장합니다.
      // 업로드 실패 시 addDocument 는 아예 호출되지 않습니다.
      const imageUrls = await uploadImages(files);

      await updateAt<PostFields>("posts", {
        title: title.trim(),
        // author: author.trim() || "운영자",=> 작성자는 사실 auth가 있으면  user의 id를 넣어주는게 일반적으라 삭제 했습니다.
        deleteSwitch: false,
        content: content.trim(),
        ...(imageUrls.length > 0 ? { imageUrls } : {}),
      });
      navigate("/");
    } catch (err) {
      alert("저장에 실패했습니다: " + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1>글쓰기</h1>

      <form className="post-form" onSubmit={handleSubmit}>
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
          이미지 (선택, 여러 장 가능)
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
          />
        </label>

        {previews.length > 0 && (
          <ul className="image-previews">
            {previews.map((url, i) => (
              <li key={url}>
                <img src={url} alt={`미리보기 ${i + 1}`} />
              </li>
            ))}
          </ul>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? "저장 중…" : "등록"}
        </button>
      </form>
    </section>
  );
}
