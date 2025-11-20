import db, { IEmoticon } from './database';

const CHOSUNG_LIST = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

function isAllChosung(str: string): boolean {
  return Array.from(str).every(char => CHOSUNG_LIST.includes(char));
}

// 검색태그배열을 기준으로 행동, 결과를 정의
class ArcaconTagSearch{

  private tags:Set<string> = new Set();
  private chosung:Set<string> = new Set();
  private searchResult:IEmoticon[] = [];
  private resultElement:HTMLElement;

  constructor(resultElement:HTMLElement){
    this.resultElement = resultElement;
  }

  // 검색후 이벤트 발생
  public async search(){
    if(this.tags.size === 0 && this.chosung.size === 0) {
      const event = new CustomEvent('onSearch', { detail: [] });
      this.resultElement.dispatchEvent(event);
      return;
    }

    const searchA = await db
      .emoticon
      .where('tags')
      .startsWithAnyOfIgnoreCase(Array.from(this.tags))
      .toArray();
    console.log(searchA);
    const searchB = await db
      .emoticon
      .where('chosung')
      .startsWithAnyOfIgnoreCase(Array.from(this.chosung))
      .toArray();
    console.log(searchB);

    const combined = searchA.concat(searchB);
    const uniqueMap = new Map();
    combined.forEach(item => {
      const key = `${item.conId}`;
      uniqueMap.set(key, item);
    });

    this.searchResult = Array.from(uniqueMap.values());

    const event = new CustomEvent('onSearch', { detail: this.searchResult });
    this.resultElement.dispatchEvent(event);
  }

  public add(inputTag:string):string {
    if(isAllChosung(inputTag)) this.chosung.add(inputTag);
    else this.tags.add(inputTag);
    this.search();
    return inputTag;
  }

  public remove(inputTag:string):string {
    this.tags.delete(inputTag);
    this.chosung.delete(inputTag);
    this.search();
    return inputTag;
  }

  public clear():void {
    this.tags.clear();
    this.search();
  }
  
  // GET, SET...
  public getTags():Set<string> {
    return this.tags;
  }
  public getSearchResult():IEmoticon[] {
    return this.searchResult;
  }
}

export default ArcaconTagSearch;