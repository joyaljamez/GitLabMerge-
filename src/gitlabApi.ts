import {
  MRParams,
  GitlabProject,
  GitlabUsers,
  CreateMrResponse,
  ExtensionConfig,
  MergeRequestSummary,
  PlatformUser,
} from "./type";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { handleResError, isSilentApiError } from "./utils";
import { apiBaseUrl, Platform } from "./remote";

export default class GitlabApi {
  id?: number;
  readonly platform: Platform = "gitlab";
  private axios: AxiosInstance;

  constructor(configuration: ExtensionConfig, host?: string) {
    this.axios = axios.create({
      headers: {
        "PRIVATE-TOKEN": configuration.token || "",
      },
      baseURL: apiBaseUrl("gitlab", configuration.instanceUrl, host),
      timeout: 20000,
    });
    this.axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (isSilentApiError(err.config)) {
          return Promise.reject(err);
        }
        const content = err?.response?.data;
        handleResError(content || err.message);
        return Promise.reject(err);
      }
    );
  }

  getProject(projectPath: string, url = "") {
    const searchName = projectPath.split("/").pop() || projectPath;
    return this.axios
      .get<GitlabProject[]>(`/projects`, {
        headers: { "X-GitMerge-Silent-Error": "1" },
        params: { search: searchName },
      })
      .then((res) => {
        if (res.data.length) {
          const result = res.data.find((item) => {
            return (
              item["path_with_namespace"] === projectPath ||
              url.endsWith(item["path_with_namespace"] as string) ||
              item["http_url_to_repo"] === url + ".git" ||
              item["ssh_url_to_repo"] === url + ".git"
            );
          });
          this.id = result?.id;
        }
      });
  }

  getUsers(name?: string) {
    return this.axios
      .get<GitlabUsers[]>(`/projects/${this.id}/members/all`, {
        params: { query: name, per_page: 100 },
      })
      .then((res) => this.mapUsers(res));
  }

  getLabels() {
    return this.axios.get(`/projects/${this.id}/labels`);
  }

  getMyCreatedMergeRequests() {
    return this.axios
      .get(`/projects/${this.id}/merge_requests`, {
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        params: { scope: "created_by_me", state: "opened", per_page: 100 },
      })
      .then((res) => this.mapMergeRequests(res));
  }

  submitMR(data: MRParams) {
    return this.axios.post<CreateMrResponse>(
      `/projects/${this.id}/merge_requests`,
      data
    );
  }

  closeMergeRequest(mergeRequestIid: number) {
    return this.axios.put(`/projects/${this.id}/merge_requests/${mergeRequestIid}`, {
      state_event: "close",
    });
  }

  mergeMergeRequest(mergeRequestIid: number) {
    return this.axios.put(
      `/projects/${this.id}/merge_requests/${mergeRequestIid}/merge`
    );
  }

  private mapUsers(res: AxiosResponse<GitlabUsers[]>) {
    const data: PlatformUser[] = res.data.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
    }));
    return { ...res, data };
  }

  private mapMergeRequests(res: AxiosResponse<any[]>) {
    const data: MergeRequestSummary[] = res.data.map((mr) => {
      const mergeStatus = mr.merge_status as string | undefined;
      const detailed = mr.detailed_merge_status as string | undefined;
      const canMerge =
        !mr.has_conflicts &&
        (mergeStatus === "can_be_merged" || detailed === "mergeable");
      let mergeHint = "Not mergeable yet";
      if (mr.has_conflicts) {
        mergeHint = "Has merge conflicts";
      } else if (mergeStatus === "checking" || detailed === "checking") {
        mergeHint = "Merge status is still checking";
      } else if (canMerge) {
        mergeHint = "";
      }
      return {
        title: mr.title,
        source_branch: mr.source_branch,
        target_branch: mr.target_branch,
        labels: (mr.labels || []).map((l: { name: string } | string) =>
          typeof l === "string" ? l : l.name
        ),
        web_url: mr.web_url,
        has_conflicts: Boolean(mr.has_conflicts),
        close_id: Number(mr.iid),
        can_merge: canMerge,
        merge_hint: mergeHint,
      };
    });
    return { ...res, data };
  }
}
