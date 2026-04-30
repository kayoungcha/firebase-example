import { Link } from "react-router-dom";
import { useReadDb } from "../hooks/useFirebaseDb";
import type { PostFields } from "../types";

export default function PostListPage() {
  // posts 컬렉션을 createdAt 기준 내림차순으로 가져옵니다.
  const { data, loading, error } = useReadDb<PostFields>(
    "posts",
    "createdAt",
    "desc", //내림차순
  );

  // 삭제된 글은 목록에서 숨깁니다.
  // (서버 사이드 where("deleteSwitch", "==", false) + orderBy 조합은 컴포지트
  const posts = data.filter((p) => !p.deleteSwitch);

  return (
    <section>
      <div className="page-header">
        <h1>게시글 목록</h1>
        <Link to="/write" className="button">
          글쓰기
        </Link>
      </div>

      {loading && <p className="empty">불러오는 중…</p>}
      {error && <p className="error">에러: {error.message}</p>}
      {!loading && posts.length === 0 && (
        <p className="empty">아직 게시글이 없습니다. 첫 글을 작성해 보세요!</p>
      )}

      <ul className="post-list">
        {posts.map((post) => (
          <li key={post.id}>
            <Link to={`/posts/${post.id}`}>
                {/* image가 하나라도 있으면 가장 첫번째를 보여줌 */}
              {post.imageUrls && post.imageUrls.length > 0 && (
                <img className="thumb" src={post.imageUrls[0]} alt="" />
              )}
              <span className="title">
                <strong>{post.title}</strong>
                <span className="meta">{post.author ?? "운영자"}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
