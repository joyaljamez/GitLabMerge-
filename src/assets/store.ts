import * as vscode from 'vscode';

export class SharedStore {
  private static _instance: SharedStore;
  private _onReady = new vscode.EventEmitter<string>();
  public onReady = this._onReady.event;

  public apiId: number | null = null;
  public isReady = false;

  private constructor() {}

  static get instance() {
    if (!SharedStore._instance) {
      SharedStore._instance = new SharedStore();
    }
    return SharedStore._instance;
  }

  markReady(id: number) {
    this.apiId = id;
    this.isReady = true;
    this._onReady.fire(id.toString());
  }
}
