// 애플리케이션 전체에서 공유되는 상태를 관리합니다.

interface ArcaconPackage {
  [key: number]: {
    title: string;
    visible: boolean;
    packageName?: string;
  };
}

type CustomSort = number[];

// 초기 상태값 (빈 값으로 시작)
export let packageList: ArcaconPackage = {};
export let customSort: CustomSort = [];
export let conPackage: [string, string][] = [];

/**
 * browser.storage에서 데이터를 비동기적으로 로드하여 상태 변수를 초기화합니다.
 * 애플리케이션 시작 시 한 번만 호출되어야 합니다.
 */
export async function initializeState(): Promise<void> {
  const storageData = await browser.storage.local.get([
    'arcacon_package',
    'arcacon_enabled',
  ]);
  packageList = storageData.arcacon_package ?? {};
  customSort = storageData.arcacon_enabled ?? [];
}
