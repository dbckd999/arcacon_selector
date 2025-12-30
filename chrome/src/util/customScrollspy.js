export class ScrollSpy {
  constructor(wrapper, opt = {}) {
    // 1. 기본 설정 및 DOM 참조
    this.doc = document;
    this.win = window;
    this.wrapper =
      typeof wrapper === 'string' ? this.doc.querySelector(wrapper) : wrapper;

    // nav는 wrapper 내부가 아닌 전체 문서에서 찾을 수 있도록 유연하게 설정
    this.nav = this.doc.querySelectorAll(opt.nav);
    this.contents = [];
    this.className = opt.className || 'active';
    this.callback = opt.callback;

    // 2. 스크롤 컨테이너 설정 (가장 중요한 변경점)
    this.scrollContainer =
      typeof opt.scrollContainer === 'string'
        ? this.doc.querySelector(opt.scrollContainer)
        : opt.scrollContainer || this.win;

    // 3. 초기화 (이제 안전하게 모든 속성이 준비된 후 실행됩니다)
    this.winH = this.win.innerHeight;
    this.contents = this.getContents();
    this.attachEvent();

    // 페이지 로드 직후 현재 위치 파악
    this.spy(this.callback);
  }

  getContents() {
    return Array.from(this.nav)
      .map((link) => {
        const id = link.getAttribute('href').split('#')[1];
        return this.doc.getElementById(id);
      })
      .filter((el) => el !== null); // 존재하는 요소만 필터링
  }

  isInView(el) {
    if (!el) return false;

    // 컨테이너가 window(전체화면)인 경우
    if (
      this.scrollContainer === this.win ||
      this.scrollContainer === this.doc.body
    ) {
      const rect = el.getBoundingClientRect();
      return rect.top < this.win.innerHeight && rect.bottom > 0;
    }

    // 컨테이너가 특정 div(overflow: scroll)인 경우
    const containerRect = this.scrollContainer.getBoundingClientRect();
    const elementRect = el.getBoundingClientRect();

    // 컨테이너의 뷰포트 범위 내에 요소가 있는지 계산
    return (
      elementRect.top < containerRect.bottom &&
      elementRect.bottom > containerRect.top
    );
  }

  attachEvent() {
    // 스크롤 이벤트 대상 결정
    const target = this.scrollContainer;
    let scrollingTimer;
    let resizingTimer;

    // 스크롤 이벤트 (Debounce 적용)
    target.addEventListener('scroll', () => {
      if (scrollingTimer) clearTimeout(scrollingTimer);
      scrollingTimer = setTimeout(() => this.spy(this.callback), 10);
    });

    // 리사이즈 이벤트 (window에서 감지)
    this.win.addEventListener('resize', () => {
      if (resizingTimer) clearTimeout(resizingTimer);
      resizingTimer = setTimeout(() => {
        this.winH = this.win.innerHeight;
        this.spy(this.callback);
      }, 10);
    });
  }

  spy(cb) {
    const elems = this.getElemsViewState();
    this.markNav(elems);

    if (typeof cb === 'function') {
      cb(elems);
    }
  }

  getElemsViewState() {
    const viewStatusList = this.contents.map((el) => this.isInView(el));

    return {
      inView: this.contents.filter((_, i) => viewStatusList[i]),
      outView: this.contents.filter((_, i) => !viewStatusList[i]),
      viewStatusList: viewStatusList,
    };
  }

  markNav(elems) {
    let isAlreadyMarked = false;

    this.nav.forEach((item, i) => {
      // 뷰포트 안에 있는 첫 번째 요소만 마킹 (일반적인 스파이 동작)
      if (elems.viewStatusList[i] && !isAlreadyMarked) {
        isAlreadyMarked = true;
        item.classList.add(this.className);
      } else {
        item.classList.remove(this.className);
      }
    });
  }
}
