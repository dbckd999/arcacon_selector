import Dexie from 'dexie';

// 데이터베이스에서 가져올 데이터의 구조를 정의합니다.
interface IEmoticon {
  conId: string;
  packageId: number;
  conOrder: number;
  tags: string[];
  image: string;
  video?: string; // video는 선택적 속성일 수 있습니다.
}

// Dexie 인스턴스에 테이블의 타입을 알려줍니다.
class ArcaconDB extends Dexie {
  emoticon!: Dexie.Table<IEmoticon, string>; // 'emoticon' 테이블, 기본 키는 string

  constructor() {
    super('Arcacons');
    this.version(1).stores({ emoticon: '&conId, [packageId+conOrder], *tags' });
  }
}

const arcaconsDB = new ArcaconDB();

// 검색에 필요한 기능
async function search(term:string) :Promise<[]>{
  if (!term) return [];
  let results = await arcaconsDB.emoticon.where('tags').equalsIgnoreCase(term).toArray();
  console.log(results);
}

document.getElementById('conSearch')?.addEventListener('input', async (e) => {
  const term:string = (e.target as HTMLInputElement).value;
  search(term);
});
