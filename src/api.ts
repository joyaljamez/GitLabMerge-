import { ExtensionConfig } from "./type";
import { Platform } from "./remote";
import GitlabApi from "./gitlabApi";
import GithubApi from "./githubApi";

export type GitMergeApi = GitlabApi | GithubApi;

export function createApi(
  platform: Platform,
  configuration: ExtensionConfig,
  host?: string
): GitMergeApi {
  return platform === "github"
    ? new GithubApi(configuration, host)
    : new GitlabApi(configuration, host);
}

export default createApi;
