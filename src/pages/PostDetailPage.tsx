import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { serverTimestamp } from "firebase/firestore";
import { updateAt, useReadDoc } from "../hooks/useFirebaseDb";
import type { PostFields } from "../types";

export default function PostDetailPage() {
  // URL 의 :id 부분을 가져옵니다 (예: /posts/abc123 → id === "abc123")
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: post, loading, error } = useReadDoc<PostFields>("posts", "id", id);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!post) return;
    if (!confirm("정말 삭제하시겠어요? 목록에서 즉시 사라집니다.")) return;

    setDeleting(true);
    try {
      await updateAt<PostFields>(`posts/${post.id}`, {
        deleteSwitch: true,
        deletedAt: serverTimestamp(),
      });
      navigate("/");
    } catch (err) {
      alert("삭제에 실패했습니다: " + (err as Error).message);
      setDeleting(false);
    }
  }

  if (loading) return <p className="empty">불러오는 중…</p>;
  if (error) return <p className="error">에러: {error.message}</p>;
  // 존재하지 않거나 이미 소프트 삭제된 글은 동일하게 "없음" 으로 처리
  if (!post || post.deleteSwitch) {
    return <p className="empty">게시글을 찾을 수 없습니다.</p>;
  }

  return (
    <article className="post-detail">
      <h1>{post.title}</h1>
      <p className="meta">
        작성자: {post.author ?? "운영자"}
        {post.createdAt && (
          <> · {post.createdAt.toDate().toLocaleString("ko-KR")}</>
        )}
      </p>
      <div className="content">{post.content}</div>

      {post.imageUrls && post.imageUrls.length > 0 && (
        <ul className="image-gallery">
          {post.imageUrls.map((url, i) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`첨부 이미지 ${i + 1}`} />
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="post-detail-actions">
        <Link to="/" className="back-link">
          ← 목록으로
        </Link>
        <div className="post-detail-actions-right">
          <Link to={`/posts/${post.id}/edit`} className="button">
            수정
          </Link>
          <button
            type="button"
            className="danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "삭제 중…" : "삭제"}
          </button>
        </div>
      </div>
    </article>
  );
}
