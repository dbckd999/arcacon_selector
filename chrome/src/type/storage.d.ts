export declare interface Setting {
  syncSetting: boolean;
  syncArcacons: boolean;
}

export declare interface ArcaconHead{
  available: boolean,
  packageName: string,
  title: string,
  visible: boolean
}

export declare interface ArcaconPackage { [key: number]: boolean }