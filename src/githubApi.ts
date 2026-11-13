import {
  MRParams,
  CreateMrResponse,
  ExtensionConfig,
  MergeRequestSummary,
  PlatformUser,
} from "./type";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { handleResError, isSilentApiError } from "./utils";
import { apiBaseUrl, Platform } from "./remote";

interface GithubRepo {
  id: number;
  full_name: string;
  html_url: string;
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
  };
}

interface GithubUser {
  id: number;
  login: string;
  name: string | null;
}

interface GithubPull {
  number: number;
  title: string;
  html_url: string;
  head: { ref: string };
  base: { ref: string };
  labels: { name: string }[];
  mergeable_state?: string;
  user?: { login: string };
}

export default class GithubApi {
  id?: number;
  readonly platform: Platform = "github";
  private axios: AxiosInstance;
  private owner = "";
  private repo = "";
  private collaborators: PlatformUser[] = [];
  /** Whether the token can write (merge/close need this on GitHub). */
  private repoWrite = false;

  constructor(configuration: ExtensionConfig, host?: string) {
    const token = configuration.token || "";
    this.axios = axios.create({
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      baseURL: apiBaseUrl("github", configuration.instanceUrl, host),
      timeout: 20000,
    });
    this.axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (isSilentApiError(err.config)) {
          return Promise.reject(err);
        }
        const content = err?.response?.data;
        const msg =
          typeof content?.message === "string" ? content.message : undefined;
        if (msg?.includes("Resource not accessible by personal access token")) {
          handleResError({
            message: `${msg} GitHub: use a classic PAT with the "repo" scope, or a fine-grained PAT with Pull requests and Contents (Read and write) for this repository. Authorize SSO on the org if required.`,
          });
        } else {
          handleResError(content || err.message);
        }
        return Promise.reject(err);
      }
    );
  }

  getProject(projectPath: string) {
    const [owner, repo] = projectPath.split("/");
    this.owner = owner;
    this.repo = repo;
    return this.axios
      .get<GithubRepo>(`/repos/${owner}/${repo}`, {
        headers: { "X-GitMerge-Silent-Error": "1" },
      })
      .then((res) => {
        this.id = res.data.id;
        const p = res.data.permissions;
        this.repoWrite = Boolean(p?.push || p?.admin || p?.maintain);
      });
  }

  async getUsers(name?: string) {
    await this.ensureCollaborators();
    const filtered = this.filterUsers(name);
    return { data: filtered } as AxiosResponse<PlatformUser[]>;
  }

  getLabels() {
    return this.axios.get(`/repos/${this.owner}/${this.repo}/labels`);
  }

  async getMyCreatedMergeRequests() {
    const userRes = await this.axios.get<GithubUser>("/user");
    const login = userRes.data.login;
    if (!this.owner || !this.repo) {
      return this.mapPullRequests({
        data: [],
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as AxiosResponse["config"],
      });
    }
    const res = await this.axios.get<GithubPull[]>(
      `/repos/${this.owner}/${this.repo}/pulls`,
      { params: { state: "open", per_page: 100 } }
    );
    const mine = res.data.filter((pr) => pr.user?.login === login);
    const enriched = await Promise.all(
      mine.map(async (pr) => {
        const mergeable = (pr as GithubPull & { mergeable?: boolean | null })
          .mergeable;
        if (mergeable !== null && mergeable !== undefined) {
          return pr;
        }
        const detail = await this.axios.get<GithubPull & { mergeable?: boolean }>(
          `/repos/${this.owner}/${this.repo}/pulls/${pr.number}`
        );
        return { ...pr, ...detail.data };
      })
    );
    return this.mapPullRequests({ ...res, data: enriched });
  }

  closeMergeRequest(pullNumber: number) {
    return this.axios.patch(
      `/repos/${this.owner}/${this.repo}/pulls/${pullNumber}`,
      { state: "closed" }
    );
  }

  mergeMergeRequest(pullNumber: number) {
    return this.axios.put(
      `/repos/${this.owner}/${this.repo}/pulls/${pullNumber}/merge`,
      { merge_method: "merge" }
    );
  }

  async submitMR(data: MRParams) {
    const body: Record<string, unknown> = {
      title: data.title,
      head: data.source_branch,
      base: data.target_branch,
      body: data.description,
    };
    if (data.assignee_username) {
      body.assignees = [data.assignee_username];
    }
    if (data.labels?.length) {
      body.labels = data.labels;
    }

    const res = await this.axios.post<GithubPull & { number: number }>(
      `/repos/${this.owner}/${this.repo}/pulls`,
      body
    );
    if (data.reviewer_username && res.data.number) {
      await this.axios
        .post(
          `/repos/${this.owner}/${this.repo}/pulls/${res.data.number}/requested_reviewers`,
          { reviewers: [data.reviewer_username] }
        )
        .catch(() => undefined);
    }
    const mapped: CreateMrResponse = {
      web_url: res.data.html_url,
      id: String(res.data.number),
    };
    return { ...res, data: mapped };
  }

  private async ensureCollaborators() {
    if (this.collaborators.length || !this.owner || !this.repo) {
      return;
    }
    const res = await this.axios.get<GithubUser[]>(
      `/repos/${this.owner}/${this.repo}/collaborators`,
      { params: { per_page: 100 } }
    );
    this.collaborators = res.data.map((u) => ({
      id: u.id,
      name: u.name || u.login,
      username: u.login,
    }));
  }

  private filterUsers(query?: string) {
    if (!query?.trim()) {
      return this.collaborators;
    }
    const q = query.toLowerCase();
    return this.collaborators.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  }

  private mapPullRequests(res: AxiosResponse<GithubPull[]>) {
    const data: MergeRequestSummary[] = res.data.map((pr) => {
      const mergeable = (pr as GithubPull & { mergeable?: boolean | null })
        .mergeable;
      const state = pr.mergeable_state;
      const canMerge =
        mergeable === true &&
        (state === "clean" || state === "has_hooks" || state === "unstable");
      let mergeHint = "Not mergeable yet";
      if (state === "dirty") {
        mergeHint = "Has merge conflicts";
      } else if (state === "blocked") {
        mergeHint = "Blocked by branch protection or reviews";
      } else if (state === "behind") {
        mergeHint = "Branch is behind the base branch";
      } else if (mergeable === null) {
        mergeHint = "Mergeability is still being computed";
      } else if (!this.repoWrite && mergeable === true) {
        mergeHint =
          "Token lacks write access (repo scope or PR/Contents write on fine-grained PAT)";
      } else if (canMerge) {
        mergeHint = "";
      }
      return {
        title: pr.title,
        source_branch: pr.head.ref,
        target_branch: pr.base.ref,
        labels: pr.labels?.map((l) => l.name) || [],
        web_url: pr.html_url,
        has_conflicts: state === "dirty",
        close_id: pr.number,
        can_merge: canMerge && this.repoWrite,
        merge_hint: mergeHint,
      };
    });
    return { ...res, data };
  }
}
