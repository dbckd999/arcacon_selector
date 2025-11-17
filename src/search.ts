import db, { IEmoticon } from './database';

// 검색태그배열을 기준으로 행동, 결과를 정의

class ArcaconTagSearch{

  private tags:Set<string> = new Set();
  private searchResult:IEmoticon[] = [];
  private resultElement:HTMLElement;

  constructor(resultElement:HTMLElement){
    this.resultElement = resultElement;
  }

  // 검색후 이벤트 발생
  public async search(){
    if(this.tags.size === 0) {
      const event = new CustomEvent('onSearch', { detail: [] });
      this.resultElement.dispatchEvent(event);
      return;
    }

    this.searchResult = await 
    db
      .emoticon
      .where('tags')
      .startsWithAnyOfIgnoreCase(Array.from(this.tags))
      .toArray();
    const event = new CustomEvent('onSearch', { detail: this.searchResult });
    this.resultElement.dispatchEvent(event);
  }

  public add(inputTag:string):string {
    this.tags.add(inputTag);
    this.search();
    return inputTag;
  }

  public remove(tag:string):string {
    this.tags.delete(tag);
    this.search();
    return tag;
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