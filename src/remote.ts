export type Platform = "gitlab" | "github";

export interface RemoteInfo {
  platform: Platform;
  host: string;
  projectPath: string;
  webBaseUrl: string;
}

/** Map SSH config Host aliases (e.g. github.com-work) to real hostnames. */
export function canonicalGitHost(host: string): string {
  const h = host.toLowerCase();
  if (h === "github.com" || h.startsWith("github.com-")) {
    return "github.com";
  }
  if (h === "gitlab.com" || h.startsWith("gitlab.com-")) {
    return "gitlab.com";
  }
  return h;
}

export function isGithubHost(host: string): boolean {
  const h = host.toLowerCase();
  if (canonicalGitHost(h) === "github.com") {
    return true;
  }
  return h.endsWith(".github.com") || h === "ghe.com";
}

function normalizeRemoteUrl(fetchUrl?: string): string | undefined {
  if (!fetchUrl) {
    return undefined;
  }
  let url = fetchUrl.trim();
  if (url.startsWith("git@")) {
    const match = url.match(/^git@([^:]+):(.+?)(?:\.git)?\/?$/);
    if (match) {
      const host = canonicalGitHost(match[1]);
      return `https://${host}/${match[2]}`;
    }
  }
  return url.replace(/\.git\/?$/, "").replace(/\/$/, "");
}

export function parseGitRemote(fetchUrl?: string): RemoteInfo | null {
  const normalized = normalizeRemoteUrl(fetchUrl);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(https?):\/\/([^/]+)(\/.+)?$/i);
  if (!match) {
    return null;
  }

  const protocol = match[1].toLowerCase();
  const rawHost = match[2].toLowerCase();
  const host = canonicalGitHost(rawHost);
  const path = (match[3] || "").replace(/^\//, "").replace(/\/$/, "");
  if (!path) {
    return null;
  }

  if (isGithubHost(rawHost)) {
    const segments = path.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }
    const projectPath = `${segments[0]}/${segments[1]}`;
    return {
      platform: "github",
      host,
      projectPath,
      webBaseUrl: `${protocol}://${host}/${projectPath}`,
    };
  }

  return {
    platform: "gitlab",
    host,
    projectPath: path,
    webBaseUrl: `${protocol}://${host}/${path}`,
  };
}

function hostFromInstanceUrl(instanceUrl: string): string | undefined {
  const match = instanceUrl.match(/^https?:\/\/([^/]+)/i);
  return match?.[1]?.toLowerCase();
}

/** Ignore instanceUrl when it clearly belongs to the other host (e.g. legacy gitlab.com + GitHub remote). */
export function effectiveInstanceUrl(
  platform: Platform,
  instanceUrl?: string
): string | undefined {
  const trimmed = instanceUrl?.trim().replace(/\/$/, "");
  if (!trimmed) {
    return undefined;
  }
  const instanceHost = hostFromInstanceUrl(trimmed);
  if (!instanceHost) {
    return trimmed;
  }

  const isGitlabHost =
    instanceHost === "gitlab.com" || instanceHost.includes("gitlab");
  const isGithubHost =
    instanceHost === "github.com" ||
    instanceHost === "api.github.com" ||
    instanceHost.endsWith(".github.com");

  if (platform === "github" && isGitlabHost) {
    return undefined;
  }
  if (platform === "gitlab" && isGithubHost && !isGitlabHost) {
    return undefined;
  }
  return trimmed;
}

export function apiBaseUrl(
  platform: Platform,
  instanceUrl?: string,
  host?: string
): string {
  const trimmed = effectiveInstanceUrl(platform, instanceUrl);
  if (platform === "github") {
    if (trimmed) {
      return `${trimmed}/api/v3`;
    }
    const apiHost = canonicalGitHost(host || "");
    if (apiHost && apiHost !== "github.com") {
      return `https://${apiHost}/api/v3`;
    }
    return "https://api.github.com";
  }

  if (trimmed) {
    return `${trimmed}/api/v4`;
  }
  return `https://${host || "gitlab.com"}/api/v4`;
}
