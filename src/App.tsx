
import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import DOMPurify from "dompurify";
import { fetchReadme, type GitHubReadme } from "./github";

import "github-markdown-css/github-markdown.css";
import "highlight.js/styles/atom-one-dark.css";
import "./App.css";

export default function App() {
  const [url, setUrl] = useState("");
  const [readme, setReadme] = useState<GitHubReadme | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const contentRef = useRef<HTMLDivElement>(null);

  async function loadRepository() {
    try {
      setLoading(true);
      setError("");

      const result = await fetchReadme(url);
      setReadme(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }


  const html = useMemo(() => {
    if (!readme) return "";

    const directory = readme.path
      .split("/")
      .slice(0, -1)
      .join("/");

    const branchPath = encodeURI(readme.branch);

    const rawBase =
      `https://raw.githubusercontent.com/${readme.owner}/${readme.repo}/${branchPath}/${directory ? directory + "/" : ""}`;

    const blobBase =
      `https://github.com/${readme.owner}/${readme.repo}/blob/${branchPath}/${directory ? directory + "/" : ""}`;

    const resolveUrl = (href: string, base: string) => {
      if (/^(https?:|data:|mailto:|#|\/\/)/i.test(href)) {
        return href;
      }

      const rootBase =
        `https://raw.githubusercontent.com/${readme.owner}/${readme.repo}/${branchPath}/`;

      return new URL(
        href,
        href.startsWith("/") ? rootBase : base
      ).href;
    };

    const renderer = new marked.Renderer();

    renderer.image = ({ href, title, text }) => {
      const src = href ? resolveUrl(href, rawBase) : "";

      return `<img src="${src}" alt="${text || ""}" ${
        title ? `title="${title}"` : ""
      } loading="lazy" />`;
    };

    renderer.link = ({ href, title, text }) => {
      const destination = href ? resolveUrl(href, blobBase) : "#";

      return `<a href="${destination}" ${
        title ? `title="${title}"` : ""
      }>${text}</a>`;
    };

    const parsed = marked.parse(readme.content, {
      renderer,
    }) as string;

    // Sanitize untrusted repository HTML first
    const safeHTML = DOMPurify.sanitize(parsed);

    // Resolve images, including raw HTML images
    const document = new DOMParser().parseFromString(
      safeHTML,
      "text/html"
    );

    document.querySelectorAll("img").forEach(img => {
      const src = img.getAttribute("src");

      if (src) {
        img.setAttribute("src", resolveUrl(src, rawBase));
      }
    });

    // Handle responsive images
    document.querySelectorAll("source[srcset], img[srcset]").forEach(el => {
      const srcset = el.getAttribute("srcset");

      if (srcset) {
        const updated = srcset
          .split(",")
          .map(item => {
            const parts = item.trim().split(/\s+/);
            parts[0] = resolveUrl(parts[0], rawBase);
            return parts.join(" ");
          })
          .join(", ");

        el.setAttribute("srcset", updated);
      }
    });

    return document.body.innerHTML;
  }, [readme]);

  useEffect(() => {
    contentRef.current
      ?.querySelectorAll("pre code")
      .forEach(block => hljs.highlightElement(block as HTMLElement));
  }, [html]);

  return (
    <div className="app" data-color-mode="dark" data-dark-theme="dark">
      <header className="toolbar">
        <div className="brand">emdee<span>.</span></div>

        <form
          className="repo-input"
          onSubmit={e => {
            e.preventDefault();
            loadRepository();
          }}
        >
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repository"
          />

          <button type="submit" disabled={loading}>
            {loading ? "Loading..." : "Open"}
          </button>
        </form>
      </header>

      <main className="reader">
        {error && <div className="error">{error}</div>}

        {readme && (
          <div className="file-label">
            <span>◈</span>
            {readme.owner}/{readme.repo} / {readme.path}
          </div>
        )}

        {readme ? (
          <article
            ref={contentRef}
            className="markdown-body"
            data-color-mode="dark"
            data-dark-theme="dark"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="empty-state">
            <h1>emdee<span>.</span></h1>
            <p>Your GitHub README, beautifully rendered.</p>
            <p>Paste a public repository URL above to begin.</p>
          </div>
        )}
      </main>
    </div>
  );
}
