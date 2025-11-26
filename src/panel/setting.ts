interface SettingSchema<T> {
  key: string;
  default: T;
}

export class SettingsStore {
  constructor() {
    chrome.storage.local.get('arcacon_setting').then((settings) => {
      this.values = new Map(Object.entries(settings));
    });
  }

  private values = new Map();
  private listeners = new Map();

  get<T>(key: string): T {
    return this.values.get(key);
  }
  set<T>(key: string, value: T): any {
    this.values.set(key, value);
    chrome.storage.local.set({
      arcacon_setting: Object.fromEntries(this.values),
    });
    // 등록한 함수를 실행
    return this.listeners.get(key)(value);
  }
  onChange(key: string, listener: (...value: any) => any) {
    this.listeners.set(key, listener);
  }
}
