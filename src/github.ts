
export interface GitHubReadme {
  content: string;
  path: string;
  owner: string;
  repo: string;
  branch: string;
}

export async function fetchReadme(
  input: string
): Promise<GitHubReadme> {
  const url = new URL(input);

  if (url.hostname !== "github.com") {
    throw new Error("Please enter a github.com repository URL.");
  }

  const [owner, repo] = url.pathname
    .split("/")
    .filter(Boolean);

  if (!owner || !repo) {
    throw new Error("Invalid repository URL.");
  }

  const cleanRepo = repo.replace(/\.git$/, "");

  const headers = {
    Accept: "application/vnd.github+json",
  };

  const api = `https://api.github.com/repos/${owner}/${cleanRepo}`;

  const [repoResponse, readmeResponse] = await Promise.all([
    fetch(api, { headers }),
    fetch(`${api}/readme`, { headers }),
  ]);

  if (!repoResponse.ok) {
    throw new Error(`Repository not found (${repoResponse.status}).`);
  }

  if (!readmeResponse.ok) {
    throw new Error(`README not found (${readmeResponse.status}).`);
  }

  const repository = await repoResponse.json();
  const readme = await readmeResponse.json();

  const binary = atob(readme.content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const content = new TextDecoder().decode(bytes);

  return {
    content,
    path: readme.path,
    owner,
    repo: cleanRepo,
    branch: repository.default_branch,
  };
}
