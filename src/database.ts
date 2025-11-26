import Dexie from 'dexie';

export interface IEmoticon {
  packageId?: number;
  conId: number;
  conOrder?: number;
  tags?: string[];
  chosung?: string[];
  // Blob 타입으로 변경하여 데이터베이스에 직접 저장
  image?: Blob;
  video?: Blob;
}

export interface IHeaderIcon {
  packageId: number;
  // Blob 타입으로 변경하여 데이터베이스에 직접 저장
  image?: Blob;
  video?: Blob;
}

export interface IPackageInfo {
  packageId: number;
  packageName?: string;
  title?: string;
  expires?: number;
  tags?: string[]; // 패키지 자체에 대한 검색용 태그
}

class ArcaconDB extends Dexie {
  emoticon!: Dexie.Table<IEmoticon, number>; // 기본 키는 'conId' (number)
  base_emoticon!: Dexie.Table<IHeaderIcon, number>; // 기본 키는 'conId' (number)
  search_index!: Dexie.Table<any, number>;
  package_info!: Dexie.Table<IPackageInfo, number>; // 패키지 정보 테이블

  constructor() {
    super('Arcacons');
    // 데이터베이스 스키마 버전 관리
    this.version(2).stores({
      // 기본키는 conId, packageId와 tags는 인덱싱합니다.
      emoticon: 'conId, packageId, *tags, *chosung',
      base_emoticon: 'packageId',
      search_index: '++id',
      package_info: 'packageId, *tags',
    });
  }
}

// 데이터베이스 인스턴스를 생성하고 기본 내보내기(default export) 합니다.
const db = new ArcaconDB();
export default db;
