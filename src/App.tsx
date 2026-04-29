import { Link, Route, Routes } from "react-router-dom";
import PostListPage from "./pages/PostListPage";
import PostDetailPage from "./pages/PostDetailPage";
import PostWritePage from "./pages/PostWritePage";
import PostEditPage from "./pages/PostEditPage";

export default function App() {
  /*** 플렛폼의 layout */
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="logo">
          🔥 Firebase 게시판 예시
        </Link>
      </header>

      <main className="content">
        {/* 페이지 라우터 url path  */}
        <Routes>
          <Route path="/" element={<PostListPage />} />
          <Route path="/posts/:id" element={<PostDetailPage />} />
          <Route path="/posts/:id/edit" element={<PostEditPage />} />
          <Route path="/write" element={<PostWritePage />} />
        </Routes>
      </main>
    </div>
  );
}
