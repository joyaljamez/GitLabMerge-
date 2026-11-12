import * as vscode from "vscode";
import { ExtensionConfig, GitPlatformSetting } from "./type";
import { Platform, parseGitRemote } from "./remote";

const SECTION = "gitmerge";
const LEGACY_SECTION = "gitlabmergeplus";

export function getExtensionConfig(): ExtensionConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const legacy = vscode.workspace.getConfiguration(LEGACY_SECTION);

  const token = cfg.get<string>("token") || legacy.get<string>("token") || "";
  const instanceUrl =
    cfg.get<string>("instanceUrl") || legacy.get<string>("instanceUrl") || "";
  const platform =
    (cfg.get<GitPlatformSetting>("platform") as GitPlatformSetting) || "auto";

  return { token, instanceUrl, platform };
}

export function resolvePlatform(
  setting: GitPlatformSetting,
  remoteUrl?: string
): Platform {
  if (setting === "gitlab" || setting === "github") {
    return setting;
  }
  const remote = parseGitRemote(remoteUrl);
  return remote?.platform ?? "gitlab";
}
