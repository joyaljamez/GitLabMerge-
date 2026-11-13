import * as vscode from "vscode";
import { Platform } from "../remote";

export interface ApiReadyPayload {
  id: string;
  platform: Platform;
  host?: string;
  projectPath?: string;
  webBaseUrl?: string;
}

export class SharedStore {
  private static _instance: SharedStore;

  private _onReady = new vscode.EventEmitter<ApiReadyPayload>();
  public onReady = this._onReady.event;

  private _onRefresh = new vscode.EventEmitter<void>();
  public onRefresh = this._onRefresh.event;

  public apiId: number | null = null;
  public isReady = false;
  private lastReady?: ApiReadyPayload;

  private constructor() {}

  static get instance() {
    if (!SharedStore._instance) {
      SharedStore._instance = new SharedStore();
    }
    return SharedStore._instance;
  }

  clearReady() {
    this.apiId = null;
    this.isReady = false;
    this.lastReady = undefined;
  }

  markReady(
    id: number,
    platform: Platform,
    host?: string,
    projectPath?: string,
    webBaseUrl?: string
  ) {
    this.apiId = id;
    this.isReady = true;
    this.lastReady = {
      id: id.toString(),
      platform,
      host,
      projectPath,
      webBaseUrl,
    };
    this._onReady.fire(this.lastReady);
  }

  getLastReady(): ApiReadyPayload | undefined {
    return this.lastReady;
  }

  triggerRefresh() {
    this._onRefresh.fire();
  }
}
