(() => {
  'use strict';
  if (window.top !== window) return;
  // 2026-10-11 화면 개편(0.4.0): 질문 4장 → 찾는 중 → 결과(탭으로 한 마리씩) → 하루 리허설(대화) → 보호소 문의.
  // 엔진(matching/core.mjs)·API(matching/pawcus_api.mjs)는 그대로 쓰고 화면만 새로 그린다. 이전 화면은 _이전판_20261011_화면개편전.
  const existingRoot = document.getElementById('pawcus-root');
  if (existingRoot?.dataset.pawcusVersion === '0.3.3-engine') return;   // 팀원 0.3.3과 같이 켜져 있어도 이 판이 화면을 맡는다
  existingRoot?.remove();
  document.getElementById('pawcus-fab')?.remove();
  document.getElementById('pawcus-fab-bubble')?.remove();

  const KEY = 'pawcus-v1', AI_KEY = 'pawcus-ai', PKEY = 'pawcus-profile';
  const MAX_LIKES = 3;
  const url = p => chrome.runtime.getURL(p);
  let engineData = null, health = {dogs: {}}, script = null, enrichment = null;
  let matchingEngine = null, pawcusApi = null;
  // 2026-10-13 하루 갱신: background가 Drive의 pawcus_live.json(매일 Colab으로 새로 만든 공고)을 주면 그것으로 바꾼다. 없으면 확장 안의 데이터.
  const liveReady = new Promise(resolve => {
    try { chrome.runtime.sendMessage({type: 'pawcus-live'}, r => resolve(chrome.runtime.lastError ? null : r?.data || null)); } catch { resolve(null); }
  });
  const engineReady = Promise.all([import(url('matching/core.mjs')), import(url('matching/pawcus_api.mjs')), liveReady])
    .then(async ([core, api, live]) => {
      matchingEngine = core; pawcusApi = api;
      if (live && core.useLiveData(live) && live.enrichment) api.setEnrichment(live.enrichment);
      enrichment = await api.loadEnrichment();
    })
    .catch(error => console.warn('Pawcus 매칭 엔진을 불러오지 못했어요', error));
  const dataReady = Promise.all([
    fetch(url('engine-data.json')).then(r => r.json()).then(async d => {
      const live = await liveReady;
      engineData = live?.dogs?.length ? {...d, dogs: live.dogs, info: live.info || {}, display: live.display || {}, source: {...d.source, live: live.source}} : d;
    }),
    fetch(url('health-data.json')).then(r => r.json()).then(async d => { const live = await liveReady; health = live?.health?.dogs ? live.health : d; }).catch(() => {}),
    fetch(url('rehearsal_script.json')).then(r => r.json()).then(d => { script = d; })
  ]).catch(() => {});
  const ready = () => Promise.all([engineReady, dataReady]);
  const isAnimalPhoto = src => /cloudfront\.net\/images\/shelter|animal\.go\.kr\/files/.test(src || '');

  // ───────── 질문: 엔진이 실제로 읽는 16개만, 4장 ─────────
  // 근거: 코랩_매칭엔진 data/config/criteria_v1.csv(person_items·evidence), survey_v1.csv(edu_text)
  const QUESTIONS = {
    regions: ['어느 지역 보호소의 아이를 보고 싶으세요?', ['강원','경기','경남','경북','서울','전북','제주','상관없음(전국)']],
    Q_SIZE: ['어느 정도 크기의 아이를 원하세요?', ['5kg 이하','10kg 이하','15kg 이하','25kg 이하','25kg 초과','상관없음']],
    Q_ALONE_HOURS: ['평일에 집이 완전히 비는 시간은 하루 몇 시간인가요?', ['2시간 이하','2~4시간','4~6시간','6~8시간','8시간 넘음']],
    Q_ALONE_PLAN: ['입양 후 첫 2주, 혼자 있는 시간을 줄일 방법이 있나요?', ['휴가·재택 가능','가족이 봐 줌','펫시터·유치원','방법 없음']],
    Q_WALK: ['하루에 산책·놀이에 쓸 수 있는 시간은?', ['15분 미만','15~30분','30분~1시간','1~2시간','2시간 이상']],
    Q_SHED: ['털 청소(빗질·청소기)를 일주일에 몇 번 할 수 있나요?', ['매일','주 3~4회','주 1~2회','거의 못 함']],
    Q_HOUSEHOLD: ['함께 사는 사람은 누구인가요?', ['혼자','어른만 2명 이상','초등학생 이상 자녀 있음','미취학 자녀 있음']],
    Q_VISITORS: ['집에 손님이 자주 오나요?', ['자주 옴','가끔','거의 없음']],
    Q_PETS: ['지금 함께 사는 반려동물이 있나요?', ['없음','개 1마리','개 2마리 이상','고양이 등 다른 동물']],
    Q_DOG_MEET: ['다른 개를 자주 만나는 생활인가요?', ['자주 만남(애견카페·캠핑·여행)','가끔','거의 없음']],
    Q_NOISE: ['개가 짖으면 지금 사는 곳에서 얼마나 문제가 될까요?', ['거의 문제없음(단독주택 등)','조금 신경 쓰임','매우 신경 쓰임(민원 경험·예민한 이웃)']],
    Q_BUDGET: ['반려동물을 위해 한 달에 쓸 수 있는 금액은?', ['5만원 미만','5~10만원','10~20만원','20~30만원','30만원 이상']],
    Q_EMERGENCY: ['예상치 못한 병원비(수십만 원)가 생기면?', ['모아 둔 돈·펫보험','나눠서 냄','감당하기 어려움']],
    Q_EXPERIENCE: ['강아지를 키워 본 적이 있나요?', ['키워 본 적 있음','처음']],
    Q_FIRST2W: ['배변 실수나 밤에 우는 일이 생기면 어떻게 하시겠어요?', ['교육·상담을 받아 볼 계획','기다리며 맞춰 감','잘 모르겠음']]
  };
  const SHORT = {regions: '지역', Q_SIZE: '크기', Q_ALONE_HOURS: '집 비는 시간', Q_ALONE_PLAN: '첫 2주', Q_WALK: '산책·놀이', Q_SHED: '털 청소', Q_HOUSEHOLD: '함께 사는 사람', Q_VISITORS: '손님', Q_PETS: '함께 사는 동물', Q_DOG_MEET: '다른 개 만남', R_ALLERGY: '알레르기', Q_NOISE: '소음', Q_BUDGET: '한 달 예산', Q_EMERGENCY: '갑작스러운 병원비', Q_EXPERIENCE: '경험', Q_FIRST2W: '배변 실수 대처'};
  const PAGES = [
    {title: '찾는 조건', icon: '🔍', sub: '어느 지역, 어떤 크기의 아이를 찾으세요?', ids: ['regions', 'Q_SIZE']},
    {title: '나의 하루', icon: '⏰', sub: '하루를 어떻게 보내는지 알려 주세요. 혼자 있기·활동량·털 관리와 비교해요.', ids: ['Q_ALONE_HOURS', 'Q_ALONE_PLAN', 'Q_WALK', 'Q_SHED']},
    {title: '함께 사는 환경', icon: '🏠', sub: '함께 사는 사람과 동물, 사는 곳을 알려 주세요. 사람·다른 개·짖음과 비교해요.', ids: ['Q_HOUSEHOLD', 'Q_VISITORS', 'Q_PETS', 'Q_DOG_MEET', 'Q_NOISE']},
    {title: '돌봄 준비', icon: '💛', sub: '비용과 경험을 알려 주세요. 건강 관리·기본 훈련과 비교해요.', ids: ['Q_BUDGET', 'Q_EMERGENCY', 'Q_EXPERIENCE', 'Q_FIRST2W']}
  ];
  const ALL_IDS = PAGES.flatMap(p => p.ids);
  const PAGE_PIC = ['magnifier', 'sun-face', 'home', 'money'];   // 단계마다 같은 화풍의 3D 그림
  const eng = p => Object.fromEntries(Object.entries(p || {}).filter(([k]) => !k.startsWith('R_')));   // 엔진에는 생활 질문 답만(준비·알레르기 질문은 2026-10-11 삭제)
  const IND_ITEMS = {alone: ['Q_ALONE_HOURS', 'Q_ALONE_PLAN'], activity: ['Q_WALK'], barking: ['Q_NOISE'], shedding: ['Q_SHED'], dogs: ['Q_PETS', 'Q_DOG_MEET'], people: ['Q_HOUSEHOLD', 'Q_VISITORS'], cost: ['Q_BUDGET', 'Q_EMERGENCY'], training: ['Q_EXPERIENCE', 'Q_FIRST2W'], size: ['Q_SIZE'], allergy: ['R_ALLERGY'], kids: ['Q_HOUSEHOLD'], cats: ['Q_PETS']};
  const FIT_END = {alone: '집 비는 시간', activity: '내가 낼 수 있는 산책·놀이 시간', barking: '사는 곳 소음 조건', shedding: '털 청소 여건', dogs: '다른 동물과 지내는 생활', people: '함께 사는 사람·손님 여건', cost: '예산 여건', training: '내 경험·계획'};
  function whyOf(id) {
    if (id === 'regions') return '선택한 지역 보호소에 있는 아이들 중에서 찾아 드려요.';
    if (id === 'R_ALLERGY') return script?.knowledge?.allergy?.why || '';
    if (id === 'Q_SIZE') return '1살이 넘은 아이는 지금 체중으로, 1살 미만 아이는 견종 기준으로 다 컸을 때 예상 체중으로 비교해요. 크기는 산책·이동·집 공간·비용에 영향을 줘요.';
    return engineData?.survey?.find(x => x.item_id === id)?.edu_text || '';
  }

  // [2026-10-14 되돌림] 저장은 오늘 아침과 같은 방식: 'pawcus-v1' 한 곳에 생활 조건 답·담은 아이·본 아이를 함께 저장한다.
  // (낮에 답을 따로 'pawcus-profile'로 나눴다가 답이 사라지는 문제가 생겨 되돌림. 그동안 그쪽에만 저장된 답이 있으면 처음 한 번 가져온다)
  const store = {
    get: () => new Promise(resolve => chrome.storage.local.get([KEY, PKEY], x => {
      const d = x?.[KEY] || {}, mine = d.profile || {}, moved = x?.[PKEY] || {};
      resolve({likes: [], seen: [], ...d, profile: Object.keys(moved).length > Object.keys(mine).length ? moved : mine});
    })),
    set: value => new Promise(resolve => chrome.storage.local.set({[KEY]: value}, resolve)),
    // 같은 탭 안에서 읽고-고치고-쓰기가 겹치지 않게 차례로 처리(fn이 false면 쓰지 않음)
    update: fn => (storeQ = storeQ.catch(() => {}).then(async () => { const d = await store.get(); if ((await fn(d)) !== false) { await store.set(d); try { chrome.storage.local.remove(PKEY); } catch {} } return d; }))
  };
  let storeQ = Promise.resolve();
  const aiStore = {
    get: () => new Promise(resolve => chrome.storage.local.get(AI_KEY, x => resolve(x[AI_KEY] || {}))),
    set: value => new Promise(resolve => chrome.storage.local.set({[AI_KEY]: value}, resolve))
  };

  // ───────── 포인핸드 화면 읽기(이전 판과 같음) ─────────
  function text() { return document.body?.innerText || ''; }
  function isAnimalDetail() { return /^\/shelter\/animal\/detail\//.test(location.pathname); }
  function detail() {
    const body = text().replace(/\s+/g, ' ').trim();
    const id = decodeURIComponent(location.pathname).split('/').pop() || location.href;
    const species = /\[개\]/.test(body) ? '개' : /\[고양이\]|고양이/.test(body) ? '고양이' : /강아지|개 /.test(body) ? '개' : '동물';
    const headline = body.match(/\[(개|고양이)\]\s*([^\n]{0,180}?)(?=공고번호)/)?.[0] || body.slice(0, 180);
    const shelter = body.match(/보호센터\s*([^*]{1,100}?)(?=\s*관할기관|\*)/)?.[1]?.trim() || '보호소 정보는 공고 원문에서 확인';
    const phone = body.match(/(?:tel\s*:\s*|전화|문의[^\d]{0,20})(0\d{1,2}[- )]?\d{3,4}[- ]?\d{4})/)?.[1] || '';
    const photo = [...document.images].map(i => i.currentSrc || i.src).find(isAnimalPhoto) || '';
    const area = id.split('-').slice(0, 2).join('-');
    return {id, url: location.href, species, headline, shelter, phone, photo, area, capturedAt: new Date().toISOString()};
  }
  function animalFromCard(card) {
    const raw = (card.innerText || '').replace(/\s+/g, ' ').trim();
    const id = raw.match(/공고번호\s*([가-힣A-Za-z0-9-]+)/)?.[1] || raw.match(/([가-힣]+-[가-힣A-Za-z0-9]+-\d{4}-\d+(?:\([^)]*\))?(?:-P)?)/)?.[1];
    if (!id) return null;
    const image = card.querySelector('img.ar-11') || card.querySelector('img');
    return {
      id, url: `https://pawinhand.kr/shelter/animal/detail/${encodeURIComponent(id)}`,
      species: /\[고양이\]/.test(raw) ? '고양이' : /\[개\]/.test(raw) ? '개' : '동물',
      headline: raw, shelter: '보호소 정보는 공고 상세에서 확인', phone: '',
      photo: image?.currentSrc || image?.src || '', area: id.split('-').slice(0, 2).join('-'), capturedAt: new Date().toISOString()
    };
  }
  function enrichFromSnapshot(animal) {
    if (!engineData) return animal;
    const dog = engineData.dogs?.find(x => x.dog_id === animal.id);
    const display = engineData.display?.[animal.id], info = engineData.info?.[animal.id];
    if (!dog && !display && !info) return animal;
    return {...animal, name: dog?.name || display?.name || '', headline: animal.headline || `${display?.breeds || animal.species} · ${display?.weight_text || ''}`,
      shelter: info?.shelter_name || animal.shelter, phone: info?.shelter_tel || animal.phone,
      photo: animal.photo || String(info?.image_urls || '').split(' | ')[0] || '', tags: dog?.tags || display?.tags || ''};
  }

  // ───────── 공통 도우미 ─────────
  function esc(s) { return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function josa(word, withFinal, noFinal) {   // 받침 있으면 withFinal(은·이·과), 없으면 noFinal(는·가·와)
    const c = String(word).charCodeAt(String(word).length - 1);
    if (c >= 48 && c <= 57) return word + ('0136781'.includes(String.fromCharCode(c)) ? withFinal : noFinal);   // 공고번호 끝 숫자: 영·일·삼·육·칠·팔은 받침 있음
    if (!(c >= 0xac00 && c <= 0xd7a3)) return word + noFinal;
    return word + ((c - 0xac00) % 28 ? withFinal : noFinal);
  }
  function fillName(s, name) {   // 장면 문구의 {name}가·{name}를·{name}와·{name}는 → 받침에 맞는 조사
    return String(s).replace(/\{name\}(가|를|와|는)/g, (m, p) => ({가: josa(name, '이', '가'), 를: josa(name, '을', '를'), 와: josa(name, '과', '와'), 는: josa(name, '은', '는')}[p])).replace(/\{name\}/g, name);
  }
  function dogName(id) {
    const n = String(engineData?.display?.[id]?.name || '').trim();
    return !n || /\d{4}-\d/.test(n) || /이름/.test(n) ? '이 아이' : n;
  }
  // 2026-10-13: 이름 없는 아이는 '이름 없음'이 겹쳐 구분이 안 됐다 → 공고번호로 부른다(예: 공고 경기-화성-2026-00123)
  const noName = id => id ? `공고 ${id}` : '이름 없음';
  const https = u => String(u || '').replace(/^http:\/\//, 'https://');   // 포인핸드(https) 화면에서 섞인 콘텐츠로 막히지 않게
  function dogFacts(id) {   // '2026(60일미만)(년생)' · '2.9(Kg)' 같은 공고 표기를 읽기 쉽게
    const d = engineData?.display?.[id] || {};
    const age = String(d.age_text || '').replace(/\((\d+일미만)\)\(년생\)/, '년생($1)').replace(/\(년생\)/, '년생').replace(/일미만/, '일 미만');
    const kg = String(d.weight_text || '').replace(/\(Kg\)/i, 'kg');
    return [String(d.breeds || '').replace(/^\[개\]\s*/, ''), age, kg].filter(Boolean).join(' · ');
  }
  function srcLabel(src) {
    if (!src) return '';
    const base = script?.source_label?.[src] || src;
    return src === 'shelter' && engineData?.source?.demo_shelter ? `${base}·시연용` : base;
  }
  function traitOf(ind, v) {
    const t = script?.traits?.[ind]; if (!t || v === null || v === undefined) return null;
    const r = Math.round(v); return t[r <= 2 ? 0 : r === 3 ? 1 : 2];
  }
  const SIZE_LABEL = {'5kg 이하': '5kg 이하', '10kg 이하': '5~10kg', '15kg 이하': '10~15kg', '25kg 이하': '15~25kg', '25kg 초과': '25kg 넘음', '상관없음': '상관없음'};
  const SIZE_ICON = {'5kg 이하': 18, '10kg 이하': 22, '15kg 이하': 26, '25kg 이하': 30, '25kg 초과': 34};
  function answerLabel(id, v) { if (v === '건너뜀') return '잘 모르겠어요'; if (id === 'regions' && v === '상관없음(전국)') return '전국 어디든'; return id === 'Q_SIZE' ? (SIZE_LABEL[v] || v) : v; }
  function myAnswers(ind, profile) {
    return (IND_ITEMS[ind] || []).filter(id => profile[id] && profile[id] !== '건너뜀').map(id => `${SHORT[id]} ${answerLabel(id, profile[id])}`).join(' · ');
  }
  // 출처는 말풍선·항목마다 붙이지 않고 화면 맨 아래 '참고한 자료' 한 곳에 모은다(2026-10-11 사용자 요청)
  function refsFold(list) {
    const u = [...new Set((list || []).filter(Boolean))];
    return u.length ? `<details class="pc-fold pc-refs"><summary>참고한 자료 ${u.length}</summary><ul>${u.map(s => `<li>${esc(s)}</li>`).join('')}</ul></details>` : '';
  }
  function sourcesNote(list) { return list?.length ? `<p class="pc-src">관련 근거 · ${list.map(esc).join(' / ')}</p>` : ''; }
  function quizExplain(text) {   // 서울시 문제은행 문항 → 해설 문장만(없으면 정답 줄)
    const t = String(text || ''), m = t.match(/해설\s*[:：]\s*([\s\S]+)/);
    if (m && !junkText(m[1])) return m[1].trim();   // 해설이 비어 'nan'으로 들어 있는 문항은 정답 줄로
    const a = t.match(/정답\s*[:：]\s*([^\n]+)/); return a && !junkText(a[1]) ? `정답: ${a[1].trim()}` : '';
  }
  // [2026-10-14 사용자] 매일 받아 오는 자료에 섞인 찌꺼기 글('nan', '이 주제를 다룬 구획 n개')은 보여 주지 않는다
  const junkText = s => !String(s ?? '').trim() || /^\s*(nan|none|null|undefined)\s*$/i.test(String(s)) || /이 주제를 다룬 구획/.test(String(s));
  // 공고 인용이 단어 중간에서 잘린 경우('강 특이사항 …', '… 순둥이 자') 잘린 한 글자를 떼고 '…'로 표시
  function tidyQuote(s) {
    const w = String(s || '').replace(/\s+/g, ' ').trim().split(' ');
    let pre = '', post = '';
    if (w.length > 3 && /^[가-힣]$/.test(w[0])) { w.shift(); pre = '…'; }
    if (w.length > 3 && /^[가-힣]$/.test(w[w.length - 1])) { w.pop(); post = '…'; }
    return pre + w.join(' ') + post;
  }
  // 성격 소개의 '좋아하는 것 / 싫어하는 것'(예: 싫어하는 것: 안약 넣기)에서 낱말만 걸려 건강 주제로 잡힌 경우는 건강 문제로 보지 않는다
  const realTopic = t => !(/(싫어하는|좋아하는)\s*것\s*[:：]/.test(t.evidence || '') && !/치료|질환|진단|처방|투약|복용|수술|탈구|양성|감염|염증|결막|백내장|녹내장/.test(t.evidence || ''));
  // 그림(2026-10-12): 3D 이모티콘 대신 art.js의 선+색 강아지·고양이 그림체 하나로 통일
  const ART = globalThis.PawcusArt;
  function dogIcon() { return ART.svg('dog-face', 28, 'pc-mascot'); }
  const pic = (name, size = 24, cls = '') => ART.svg(name, size, 'pc-emo ' + cls);
  // 홈 위쪽 그림: 햇살 드는 방, 쿠션 위 강아지와 고양이
  function sceneHtml(small = false) { return `<div class="pc-hero-art ${small ? 'pc-hero-sm' : ''}">${ART.hero()}</div>`; }  function heart(on) { return `<span class="pawcus-heart ${on ? 'on' : ''}">${on ? '♥' : '♡'}</span>`; }
  // 위쪽 메뉴: 생활 질문을 마친 뒤에는 어느 화면에서든 추천·담은 아이·내 조건으로 바로 간다
  // 창(2026-10-13 15차): 작은 챗봇 창과 크게 보기는 각자 '기준 크기'로 그리고, 크기 조절은 통째로 확대·축소(scale)한다 → 늘리거나 줄여도 내용이 같이 커지고 작아져 빈 공간이 생기지 않는다.
  // 위치: 처음 작은 창은 오른쪽 아래 버튼 위(말풍선), 크게 보기는 화면 가운데. 머리말을 끌면 어디로든 옮기고, 옮긴 위치는 기억한다(x·y / bx·by). ⇥ 오른쪽 붙이기는 그대로.
  const BASE = {small: {w: 420, h: 680}, big: {w: 980, h: 720}};
  let ui = {side: false, center: false, z: 0, bz: 0, x: null, y: null, bx: null, by: null, sw: 0, likes: 0, ready: false};
  // [팀원요청 1014] 크기 조절이 안 되던 문제: 처음 자리(버튼 위)의 최대 크기 = 화면 높이 − 버튼 자리라서, 노트북 화면에서는 처음 크기가 이미 최대였다(1024×768에서 0.91배).
  // → 처음 자리일 때만 버튼 자리를 비워 두고, 끌어서 옮기거나 크기를 바꾼 창(free)은 화면 끝까지(최대 2.2배) 키울 수 있게
  const zMax = (b, free = false) => Math.max(.5, Math.min(2.2, (innerWidth - 16) / b.w, (innerHeight - (free ? 16 : b === BASE.big ? 24 : 150)) / b.h));
  const curZ = () => { const big = ui.center, b = big ? BASE.big : BASE.small, free = ui[big ? 'bx' : 'x'] !== null; return Math.min(zMax(b, free), Math.max(.6, (big ? ui.bz : ui.z) || (big ? Math.min(1, zMax(b)) : 1))); };
  const posKeys = () => ui.center ? ['bx', 'by'] : ['x', 'y'];
  function applyUi() {
    root.classList.toggle('pc-side', ui.side); root.classList.toggle('pc-full', ui.center && !ui.side);   // 크게 보기(이전 'pc-center'는 글자 가운데 정렬 이름과 겹쳐 창 전체 글자가 가운데로 몰렸음)
    const st = root.style, imp = (k, v) => v === null ? st.removeProperty(k) : st.setProperty(k, v, 'important');
    document.documentElement.style.setProperty('--pc-sw', ui.sw ? ui.sw + 'px' : '33.4vw');
    document.body.classList.toggle('pc-side-open', ui.side && Boolean(root.innerHTML));
    if (ui.side) { ['left', 'top', 'right', 'bottom', 'width', 'transform', 'transform-origin'].forEach(k => imp(k, null)); st.removeProperty('--pc-w'); st.removeProperty('--pc-h'); st.removeProperty('--pc-z'); root.classList.remove('pc-moved'); return; }
    // [팀원요청 1014-2] 글자 뭉개짐: 창 전체를 그림처럼 늘리던 transform: scale 대신 zoom을 쓴다(글자·선을 그 크기로 다시 그려 선명함).
    // 같은 비율로 커지고 작아지는 동작은 그대로. 창 겉 크기는 기준 크기 × 배율, 안쪽 내용(.pawcus-panel)은 zoom으로 같은 배율
    const b = ui.center ? BASE.big : BASE.small, z = curZ(), [kx, ky] = posKeys(), x = ui[kx], y = ui[ky], W = Math.round(b.w * z), H = Math.round(b.h * z);
    st.setProperty('--pc-w', b.w + 'px'); st.setProperty('--pc-h', b.h + 'px'); st.setProperty('--pc-z', z); imp('width', W + 'px'); imp('transform', 'none'); imp('transform-origin', null);
    const moved = x !== null && y !== null;
    root.classList.toggle('pc-moved', moved);
    if (moved) {   // 옮긴 위치: 화면 밖으로 나가지 않게
      imp('left', Math.round(Math.min(innerWidth - 60, Math.max(-W + 120, x))) + 'px'); imp('top', Math.round(Math.min(innerHeight - 60, Math.max(0, y))) + 'px');
      imp('right', 'auto'); imp('bottom', 'auto');
    } else if (ui.center) {   // 크게 보기: 화면 가운데(반 픽셀 위치가 생기지 않게 정수로)
      imp('left', Math.round((innerWidth - W) / 2) + 'px'); imp('top', Math.max(0, Math.round((innerHeight - H) / 2)) + 'px'); imp('right', 'auto'); imp('bottom', 'auto');
    } else {   // 작은 창: 오른쪽 아래 버튼 위
      imp('left', 'auto'); imp('top', 'auto'); imp('right', '30px'); imp('bottom', '132px');
    }
  }
  const saveUi = () => { try { chrome.storage.local.set({'pawcus-ui': {v: 3, side: ui.side, center: ui.center, z: ui.z, bz: ui.bz, x: ui.x, y: ui.y, bx: ui.bx, by: ui.by, sw: ui.sw}}); } catch {} };
  // 끌기 시작할 때 지금 보이는 위치를 왼쪽 위 기준 좌표로 바꿔 둔다(그 뒤로는 그 좌표로 움직인다)
  const pinPosition = () => { const r = root.getBoundingClientRect(), [kx, ky] = posKeys(), z = curZ(); ui[kx] = Math.round(r.left); ui[ky] = Math.round(r.top); ui[ui.center ? 'bz' : 'z'] = z; applyUi(); };   // [팀원요청 1014] 지금 보이는 배율을 그대로 고정(잡는 순간 창이 튀지 않게)
  function bindGrips() {
    // 크기 조절: 왼쪽·위·왼쪽 위 가장자리. 오른쪽 아래 모서리는 제자리, 내용은 같은 비율로 커지고 작아진다
    root.querySelectorAll('[data-grip]').forEach(g => g.addEventListener('mousedown', e => {
      e.preventDefault();
      const kind = g.dataset.grip, sx = e.clientX, sy = e.clientY;
      if (!ui.side) pinPosition();
      const box = root.getBoundingClientRect(), z0 = curZ(), zk = ui.center ? 'bz' : 'z', [kx, ky] = posKeys();
      document.body.classList.add('pc-dragging');
      const move = ev => {
        const dx = sx - ev.clientX, dy = sy - ev.clientY;
        if (ui.side) { ui.sw = Math.round(Math.min(innerWidth * 0.8, Math.max(340, box.width + dx))); applyUi(); return; }
        // [팀원요청 1014] 네 변·네 모서리 어디서든: 잡은 쪽 반대편 가장자리는 제자리, 내용은 같은 비율로(빈 공간이 생기지 않게) 커지고 작아진다
        const kw = kind.includes('l') ? (box.width + dx) / box.width : kind.includes('r') ? (box.width - dx) / box.width : 0;
        const kh = kind.includes('t') ? (box.height + dy) / box.height : kind.includes('b') ? (box.height - dy) / box.height : 0;
        const k = Math.max(kw, kh) || 1, fixR = !kind.includes('r'), fixB = !kind.includes('b'), b = ui.center ? BASE.big : BASE.small;
        ui[zk] = +(Math.min(zMax(b, true), Math.max(.6, z0 * k))).toFixed(3);
        const f = ui[zk] / z0, w = box.width * f, hh = box.height * f;
        // 한쪽이 화면 끝에 닿으면 창을 반대쪽으로 밀어서 계속 키운다(화면 안에만 있게)
        ui[kx] = Math.round(Math.min(innerWidth - w - 8, Math.max(8, fixR ? box.right - w : box.left)));
        ui[ky] = Math.round(Math.min(innerHeight - hh - 8, Math.max(8, fixB ? box.bottom - hh : box.top)));
        applyUi();
      };
      const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); document.body.classList.remove('pc-dragging'); saveUi(); };
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    }));
    // 옮기기: 머리말(버튼 제외)을 잡고 끌기
    const head = root.querySelector('.pc > header');
    head?.addEventListener('mousedown', e => {
      if (ui.side || e.button !== 0 || e.target.closest('button, a, input, textarea')) return;
      e.preventDefault(); pinPosition();
      const [kx, ky] = posKeys(), x0 = ui[kx], y0 = ui[ky], sx = e.clientX, sy = e.clientY;
      document.body.classList.add('pc-moving');
      const move = ev => { ui[kx] = x0 + ev.clientX - sx; ui[ky] = y0 + ev.clientY - sy; applyUi(); };
      const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); document.body.classList.remove('pc-moving'); saveUi(); };
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    });
  }  // 아래쪽 탭(앱처럼): 생활 질문을 마친 뒤에는 어느 화면에서든 홈·추천·담은 아이·내 조건으로 바로 간다(이전 위쪽 메뉴를 아래로 옮김)
  const NAV_GROUP = {intro: 'home', settings: 'home', results: 'results', resultDog: 'results', hearts: 'hearts', heartsResult: 'hearts', heartDog: 'hearts', conditions: 'conditions', rehearsals: 'rehearsals'};
  function bottomNav() {
    if (!NAV_GROUP[view.name]) return '';   // [2026-10-14 사용자 요청] 아래 탭은 질문을 다 했든 안 했든 홈·추천·담은 아이·리허설·내 조건 화면에서 항상 보임(전에는 15개를 다 답해야 보였음)
    const cur = NAV_GROUP[view.name];
    const items = [['home', 'intro', 'home', '홈'], ['results', 'results', 'dog', '추천'], ['hearts', ui.likes ? 'heartsResult' : 'hearts', 'heart', '담은 아이'], ['rehearsals', 'rehearsals', 'calendar', '리허설'], ['conditions', 'conditions', 'memo', '내 조건']];   // 2026-10-13: '리허설' 탭 추가(그동안 한 리허설 · 이어서 하기 · 문의하기)
    return `<nav class="pc-tabbar" aria-label="메뉴">${items.map(([g, to, icon, l]) => `<button class="${cur === g ? 'on' : ''}" data-go="${to}" ${cur === g ? 'aria-current="page"' : ''}><span class="pc-tab-ico">${pic(icon, 26)}${g === 'hearts' && ui.likes ? `<em>${ui.likes}</em>` : ''}</span><span>${esc(l)}</span></button>`).join('')}</nav>`;
  }
  function shell(content, {back = ''} = {}) {
    const nav = bottomNav();
    return `<section class="pawcus-panel pc ${nav ? 'pc-has-tabs' : ''}"><header>${back ? `<button class="pc-head-back" data-go="${esc(back)}" aria-label="뒤로">←</button>` : `<span class="pc-logo">${dogIcon()}</span>`}<div><strong>Pawcus 내 가족 찾기</strong><small>나와 꼭 맞는 가족을 만나는 첫걸음</small></div><button class="pc-size" data-action="center" title="${ui.center ? '작은 창으로' : '크게 보기 (가운데)'}" aria-label="${ui.center ? '작은 창으로' : '크게 보기 (가운데)'}">${ui.center ? '⤡' : '⤢'}</button><button class="pc-size" data-action="size" aria-label="${ui.side ? '버튼 옆 창으로' : '오른쪽에 붙이기'}" title="${ui.side ? '버튼 옆 창으로' : '오른쪽에 붙이기'}">${ui.side ? '⇤' : '⇥'}</button><button class="pawcus-close" data-action="close" aria-label="닫기">×</button></header>${content}${nav}</section><i class="pc-tail" aria-hidden="true"></i><div class="pc-grip pc-grip-l" data-grip="l" title="끌어서 크기 조절"></div><div class="pc-grip pc-grip-t" data-grip="t" title="끌어서 크기 조절"></div><div class="pc-grip pc-grip-tl" data-grip="tl" title="끌어서 크기 조절"></div>${['r', 'b', 'tr', 'bl', 'br'].map(k => `<div class="pc-grip pc-grip-${k}" data-grip="${k}" title="끌어서 크기 조절"></div>`).join('')}`;   // [팀원요청 1014] 오른쪽·아래·나머지 모서리 손잡이 추가
  }
  const VERDICT_VIEW = {
    '잘 맞음': ['ok', '잘 맞는 편'], '맞을 가능성 · 확인 필요': ['must', '확인 필요'],
    '부담 있음': ['burden', '생활 조건 차이'], '판단 불가': ['unknown', '정보 부족']
  };
  const pill = (tone, label) => `<span class="pc-pill pc-${tone}">${esc(label)}</span>`;

  // ───────── 실행 버튼(이전 판과 같음) ─────────
  document.getElementById('pawcus-launcher-style')?.remove();
  const launcherStyle = document.createElement('style');
  launcherStyle.id = 'pawcus-launcher-style';
  // 실행 버튼(2026-10-12): 노란 동그라미 안에 선으로 그린 강아지·고양이 + 아래 'Pawcus', 위에는 하는 일을 알려 주는 말풍선
  launcherStyle.textContent = `
    #pawcus-fab{position:fixed!important;right:40px!important;bottom:40px!important;z-index:2147483646!important;width:84px!important;height:84px!important;padding:0!important;margin:0!important;display:block!important;overflow:visible!important;border:3px solid #fff!important;border-radius:50%!important;background:radial-gradient(circle at 35% 28%,#ffa04a,#ff7a00 70%)!important;box-shadow:0 10px 26px #ff7a0055,0 2px 6px #0002!important;cursor:pointer!important;transition:transform .18s!important;font-family:'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',Arial,sans-serif!important}
    #pawcus-fab:hover{transform:translateY(-2px) scale(1.04)!important}
    #pawcus-fab:active{transform:scale(.96)!important}
    #pawcus-fab:focus-visible{outline:3px solid #2b2310!important;outline-offset:3px!important}
    #pawcus-fab .pf-pets{position:absolute!important;left:50%!important;top:12px!important;width:64px!important;height:37px!important;margin-left:-32px!important;display:block!important;overflow:visible!important}
    #pawcus-fab .pf-pets *{vector-effect:non-scaling-stroke}
    #pawcus-fab .pf-dog{animation:pawcus-nod 2.6s ease-in-out infinite!important;transform-origin:18px 28px!important}
    #pawcus-fab .pf-cat{animation:pawcus-nod 2.6s 1.3s ease-in-out infinite!important;transform-origin:42px 28px!important}
    #pawcus-fab .pf-name{position:absolute!important;left:0!important;right:0!important;bottom:13px!important;display:block!important;margin:0!important;padding:0!important;color:#fff!important;font-size:13px!important;font-weight:800!important;line-height:1!important;letter-spacing:.01em!important;text-align:center!important}
    @keyframes pawcus-nod{0%,70%,100%{transform:rotate(0)}80%{transform:rotate(-8deg)}90%{transform:rotate(6deg)}}
    #pawcus-fab-bubble{position:fixed!important;right:40px!important;bottom:136px!important;z-index:2147483646!important;display:block!important;max-width:260px!important;margin:0!important;padding:12px 34px 12px 16px!important;border:1.5px solid #ffd2a8!important;border-radius:18px 18px 6px 18px!important;background:#fff!important;box-shadow:0 8px 24px #3a2a1424!important;color:#2b2310!important;font-family:'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',Arial,sans-serif!important;text-align:left!important;cursor:pointer!important;animation:pawcus-bubble-in .45s cubic-bezier(.2,.8,.3,1.2) both!important}
    #pawcus-fab-bubble small{display:block!important;margin:0 0 2px!important;font-size:12px!important;font-weight:600!important;color:#d96400!important;line-height:1.3!important}
    #pawcus-fab-bubble b{display:block!important;white-space:nowrap!important;font-size:15px!important;font-weight:800!important;line-height:1.35!important;color:#2b2310!important}
    #pawcus-fab-bubble::after{content:''!important;position:absolute!important;right:30px!important;bottom:-8px!important;width:14px!important;height:14px!important;background:#fff!important;border-right:1.5px solid #ffd2a8!important;border-bottom:1.5px solid #ffd2a8!important;transform:rotate(45deg)!important}
    #pawcus-fab-bubble .pf-x{position:absolute!important;top:7px!important;right:8px!important;width:22px!important;height:22px!important;padding:0!important;margin:0!important;border:0!important;border-radius:50%!important;background:#f3efe4!important;color:#6b6252!important;font-size:14px!important;line-height:22px!important;text-align:center!important;cursor:pointer!important}
    #pawcus-fab-bubble .pf-x:hover{background:#e8e1cf!important}
    #pawcus-fab-bubble[hidden]{display:none!important}
    @keyframes pawcus-bubble-in{from{opacity:0;transform:translateY(8px) scale(.94)}to{opacity:1;transform:none}}
    @media(prefers-reduced-motion:reduce){#pawcus-fab .pf-dog,#pawcus-fab .pf-cat,#pawcus-fab-bubble{animation:none!important}}
    body.pc-side-open #pawcus-fab{right:calc(var(--pc-sw, 33.4vw) + 28px)!important}
    body.pc-dragging{user-select:none!important;cursor:nwse-resize!important}
  `;
  document.head.append(launcherStyle);
  document.getElementById('pawcus-font-style')?.remove();
  const fontStyle = document.createElement('style'); fontStyle.id = 'pawcus-font-style';
  fontStyle.textContent = `@font-face{font-family:'PawcusJua';src:url('${url('fonts/Jua.woff')}') format('woff');font-display:swap}@font-face{font-family:'PawcusGowun';src:url('${url('fonts/GowunDodum.woff')}') format('woff');font-display:swap}`;
  document.head.append(fontStyle);
  // [팀원요청 1014-2] 창 배율은 안쪽 내용에 zoom으로(applyUi의 --pc-z). 옆에 붙인 창은 배율 없음
  const zoomStyle = document.createElement('style'); zoomStyle.id = 'pawcus-zoom-style';
  zoomStyle.textContent = '#pawcus-root:not(.pc-side)>.pawcus-panel{zoom:var(--pc-z,1)}';
  document.head.append(zoomStyle);
  // 손그림 테두리(2026-10-12 시안 B): 카드·버튼·사진 동그라미 선을 그림처럼 흔들리게 하는 필터. CSS의 ::before/::after가 url(#pwBox)로 쓴다
  document.getElementById('pawcus-filters')?.remove();
  document.body.insertAdjacentHTML('beforeend', '<svg id="pawcus-filters" width="0" height="0" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"><defs><filter id="pwBox" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="4.2" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="pwRing" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="9" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>');
  const root = document.createElement('div'); root.id = 'pawcus-root'; root.dataset.pawcusVersion = '0.3.3-engine'; document.body.append(root);
  // 팀원 의견 9(2026-10-13): 창이 열려 있으면 바깥 포인핸드 화면을 살짝 어둡게. 눌림은 막지 않아 공고의 ♡는 그대로 누를 수 있다
  document.getElementById('pawcus-dim')?.remove();
  const dim = document.createElement('div'); dim.id = 'pawcus-dim'; dim.setAttribute('aria-hidden', 'true'); document.body.append(dim);
  new MutationObserver(() => dim.classList.toggle('on', Boolean(root.innerHTML))).observe(root, {childList: true});
  const fab = document.createElement('button'); fab.id = 'pawcus-fab'; fab.setAttribute('aria-label', 'Pawcus 열기 — 평생 가족 찾기');
  const LINE = 'fill="#fff" stroke="#2b2310" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  fab.innerHTML = `<svg class="pf-pets" viewBox="0 0 60 34" aria-hidden="true"><defs><filter id="pwFab" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="1.6" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g filter="url(#pwFab)">
    <g class="pf-dog"><path d="M9 12 q-6 1 -4 12 q5 0 6 -6" ${LINE}/><path d="M27 12 q6 1 4 12 q-5 0 -6 -6" ${LINE}/><ellipse cx="18" cy="19" rx="10.5" ry="10" ${LINE}/><circle cx="14" cy="18" r="1.4" fill="#2b2310"/><circle cx="22" cy="18" r="1.4" fill="#2b2310"/><ellipse cx="18" cy="22" rx="2" ry="1.4" fill="#2b2310"/><path d="M16 24.5 q2 2 4 0" fill="none" stroke="#2b2310" stroke-width="1.6" stroke-linecap="round"/></g>
    <g class="pf-cat"><path d="M33 17 L34 7 L40 12 Q42 11.4 44 12 L50 7 L51 17 Q52 29 42 29 Q32 29 33 17Z" ${LINE}/><path d="M38 19 q1 -1.6 2 0 M44 19 q1 -1.6 2 0" fill="none" stroke="#2b2310" stroke-width="1.6" stroke-linecap="round"/><path d="M41 22 h2 l-1 1.2z" fill="#2b2310" stroke="#2b2310" stroke-width="1" stroke-linejoin="round"/><path d="M36 23 h-4 M36 25 l-4 1 M48 23 h4 M48 25 l4 1" stroke="#2b2310" stroke-width="1.2" stroke-linecap="round"/></g>
  </g></svg><span class="pf-name">Pawcus</span>`;
  document.body.append(fab);
  // 말풍선: 하는 일을 한 줄로. 누르면 창이 열리고, ×를 누르면 이번 방문 동안 숨긴다. 창이 열려 있으면 보이지 않는다
  const bubble = document.createElement('div'); bubble.id = 'pawcus-fab-bubble'; bubble.setAttribute('role', 'note');
  bubble.innerHTML = '<small>내 생활에 맞는 보호소 아이</small><b>평생 가족을 찾아줄게!</b><button class="pf-x" aria-label="말풍선 닫기">×</button>';
  let bubbleOff = false; try { bubbleOff = sessionStorage.getItem('pawcus-bubble-off') === '1'; } catch {}
  const syncBubble = () => { bubble.hidden = bubbleOff || Boolean(root.innerHTML); };
  bubble.querySelector('.pf-x').addEventListener('click', e => { e.stopPropagation(); bubbleOff = true; try { sessionStorage.setItem('pawcus-bubble-off', '1'); } catch {} syncBubble(); });
  bubble.addEventListener('click', () => fab.click());
  document.body.append(bubble); syncBubble();
  new MutationObserver(syncBubble).observe(root, {childList: true});

  // ───────── 관심 동물 ♡ (이전 판과 같음) ─────────
  async function rememberCurrent() {
    const animal = detail();
    const data = await store.update(d => { const seen = [animal, ...d.seen.filter(x => x.id !== animal.id)].slice(0, 30); const plain = a => JSON.stringify(a.map(({capturedAt, ...x}) => x)); if (plain(seen) === plain(d.seen)) return false; d.seen = seen; });   // 바뀐 게 없으면 쓰지 않음
    return {data, animal};
  }
  async function rememberCards() {
    const cards = [...document.querySelectorAll('.animal-list-card, .grid-2-container > .col.cursor-pointer')].map(animalFromCard).filter(Boolean);
    if (!cards.length) return store.get();
    const cardsById = Object.fromEntries(cards.map(card => [card.id, card]));
    return store.update(data => {
      const seen = [...cards, ...data.seen.filter(item => !cardsById[item.id])].slice(0, 80);
      const likes = data.likes.map(item => cardsById[item.id] ? {...item, ...cardsById[item.id], shelter: item.shelter !== '보호소 정보는 공고 상세에서 확인' ? item.shelter : cardsById[item.id].shelter, phone: item.phone || cardsById[item.id].phone} : item);
      const same = (a, b) => JSON.stringify(a.map(({capturedAt, ...x}) => x)) === JSON.stringify(b.map(({capturedAt, ...x}) => x));   // 읽은 시각만 다른 것은 같은 것으로
      if (same(seen, data.seen) && same(likes, data.likes)) return false;   // 바뀐 게 없으면 쓰지 않음
      data.seen = seen; data.likes = likes;
    });
  }
  async function toggleLike() {
    const {animal} = await rememberCurrent();
    let full = false;
    const data = await store.update(d => {
      const exists = d.likes.some(x => x.id === animal.id);
      if (exists) d.likes = d.likes.filter(x => x.id !== animal.id);
      else if (d.likes.length < MAX_LIKES) d.likes.push(animal);
      else { full = true; return false; }
    });
    if (full) { alert('마음에 담은 아이는 최대 3마리까지예요. Pawcus에서 한 마리를 빼 주세요.'); return; }
    renderHeart(data.likes.some(x => x.id === animal.id), true);
  }
  function renderHeart(liked, force = false) {
    const current = detail().id;
    const existing = document.querySelector('#pawcus-page-heart');
    if (!force && existing?.dataset.id === current) return;
    existing?.remove();
    // 2026-10-13: 처음 찾은 사진(숨은 미리 받기 사진일 때가 있음)의 부모에 붙이면 '다음' 화살표 위에 겹쳤다
    // → 화면에 가장 크게 보이는 공고 사진의 사진 넘김 상자(.swiper)에 붙이고, 실제 그림이 보이는 영역의 오른쪽 위 모서리에 둔다
    const area = el => { const r = el.getBoundingClientRect(); return r.width * r.height; };
    const anchor = [...document.querySelectorAll('img')].filter(x => isAnimalPhoto(x.currentSrc || x.src) && x.offsetWidth > 150).sort((a, b) => area(b) - area(a))[0];
    if (!anchor) return;
    const wrap = document.createElement('button'); wrap.id = 'pawcus-page-heart'; wrap.dataset.id = current; wrap.title = 'Pawcus 마음에 담기'; wrap.innerHTML = heart(liked); wrap.onclick = toggleLike;
    const box = anchor.closest('.swiper') || anchor.parentElement; if (!box) return;
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    box.append(wrap); placeHeart();
  }
  function placeHeart() {
    const wrap = document.querySelector('#pawcus-page-heart'), box = wrap?.parentElement; if (!box) return;
    const b = box.getBoundingClientRect();
    const shown = img => {   // object-fit: contain이면 상자 안의 실제 그림 영역만 계산
      const r = img.getBoundingClientRect(), nw = img.naturalWidth, nh = img.naturalHeight;
      if (getComputedStyle(img).objectFit !== 'contain' || !nw || !nh) return r;
      const s = Math.min(r.width / nw, r.height / nh), w = nw * s, h = nh * s, left = r.left + (r.width - w) / 2, top = r.top + (r.height - h) / 2;
      return {left, top, right: left + w, bottom: top + h};
    };
    const seen = r => Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)) * Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
    const r = [...box.querySelectorAll('img')].filter(x => isAnimalPhoto(x.currentSrc || x.src)).map(shown).sort((x, y) => seen(y) - seen(x))[0];
    if (!r || !seen(r)) return;
    wrap.style.setProperty('left', `${Math.round(Math.min(r.right, b.right) - b.left - wrap.offsetWidth - 10)}px`, 'important');
    wrap.style.setProperty('top', `${Math.round(Math.max(r.top, b.top) - b.top + 10)}px`, 'important');
    wrap.style.setProperty('right', 'auto', 'important');
  }
  addEventListener('resize', placeHeart);
  document.addEventListener('click', () => { for (const t of [50, 450, 900]) setTimeout(placeHeart, t); }, true);   // 사진 넘김(화살표·작은 사진) 뒤 다시 맞춤
  document.addEventListener('transitionend', placeHeart, true);                                                     // 넘김 애니메이션·손가락 밀기가 끝난 뒤
  document.addEventListener('load', e => { if (e.target?.tagName === 'IMG') placeHeart(); }, true);
  async function installHeart() {
    if (!isAnimalDetail()) { document.querySelector('#pawcus-page-heart')?.remove(); return; }
    const {data} = await rememberCurrent();
    renderHeart(data.likes.some(x => x.id === detail().id));
  }
  async function installCardHearts() {
    const data = await rememberCards();
    document.querySelectorAll('.animal-list-card, .grid-2-container > .col.cursor-pointer').forEach(card => {
      const animal = animalFromCard(card), image = card.querySelector('img.ar-11') || card.querySelector('img');
      if (!animal || !image || card.querySelector('.pawcus-card-heart')) return;
      const photoBox = image.parentElement; if (!photoBox) return;
      photoBox.style.position = 'relative';
      const button = document.createElement('button');
      button.className = 'pawcus-card-heart'; button.dataset.id = animal.id;
      button.title = 'Pawcus 마음에 담기'; button.innerHTML = heart(data.likes.some(x => x.id === animal.id));
      button.onclick = async event => {
        event.preventDefault(); event.stopPropagation();
        let exists = false, full = false;
        await store.update(latest => {
          exists = latest.likes.some(x => x.id === animal.id);
          if (exists) latest.likes = latest.likes.filter(x => x.id !== animal.id);
          else if (latest.likes.length < MAX_LIKES) latest.likes.push(animal);
          else { full = true; return false; }
        });
        if (full) { alert('마음에 담은 아이는 최대 3마리까지예요. Pawcus에서 한 마리를 빼 주세요.'); return; }
        button.innerHTML = heart(!exists);
      };
      photoBox.append(button);
    });
  }
  async function syncHeartButtons() {
    const latest = await store.get(), likedIds = new Set(latest.likes.map(animal => animal.id));
    document.querySelectorAll('.pawcus-card-heart').forEach(button => { button.innerHTML = heart(likedIds.has(button.dataset.id)); });
    const detailHeart = document.querySelector('#pawcus-page-heart');
    if (detailHeart) detailHeart.innerHTML = heart(likedIds.has(detailHeart.dataset.id));
  }

  // ───────── 화면 ─────────
  let view = {name: 'intro'};
  const answeredNow = new Set();   // 이번에 답한 질문(이전에 저장된 답과 구분해 '불러왔어요' 안내에 씀)
  let afterQuestions = '';   // '마음에 담은 아이'에서 질문을 시작했으면 질문을 마친 뒤 그 화면으로 돌아간다
  async function go(name, extra = {}) { view = {name, ...extra}; await draw(); }
  let lastDrawn = '', lastPage;
  async function draw() {
    await ready();
    const data = await store.get();
    const v = view.name;
    ui.likes = data.likes.length; ui.ready = profileDone(data.profile);
    // 질문 쪽이 바뀌면 맨 위부터 보이게 쪽 번호도 같은 화면인지 판단에 넣는다(팀원 의견 1)
    const key = `${v}|${view.tab ?? ''}|${view.id ?? ''}|${v === 'question' ? view.page || 0 : ''}`, oldPanel = root.querySelector('.pawcus-panel'), keepScroll = key === lastDrawn && oldPanel ? oldPanel.scrollTop : null;
    if (v === 'intro') root.innerHTML = shell(introHtml(data));
    else if (v === 'species') root.innerHTML = shell(speciesHtml(), {back: 'intro'});
    else if (v === 'cat') root.innerHTML = shell(`<main class="pc-body pc-app"><div class="ap-empty">${pic('cat-love', 120)}<h2 class="pc-h">고양이 공고는 준비 중이에요</h2><p class="pc-text">고양이 찾기는 곧 열려요. 그동안 마음에 드는 아이는 ♡로 담아 둘 수 있어요.</p></div><button class="pc-main" data-go="hearts">♡ 마음에 담은 아이 보기</button><button class="pc-sub" data-go="species">강아지로 다시 고르기</button></main>`, {back: 'species'});
    else if (v === 'question') root.innerHTML = shell(questionHtml(view.page || 0, data.profile), {back: (view.page || 0) ? '' : 'species'});
    else if (v === 'loading') root.innerHTML = shell(loadingHtml());
    else if (v === 'results') root.innerHTML = shell(await resultsHtml(data), {back: 'intro'});
    else if (v === 'resultDog') root.innerHTML = shell(await resultsHtml(data, true), {back: 'results'});
    else if (v === 'rehearsal') root.innerHTML = shell(rehearsalHtml(), {back: view.back || 'results'});
    else if (v === 'settings') root.innerHTML = shell(await settingsHtml(), {back: view.from || 'intro'});
    else if (v === 'hearts') root.innerHTML = shell(heartsHtml(data), {back: 'intro'});
    else if (v === 'heartsResult') root.innerHTML = shell(await heartsResultHtml(data), {back: 'hearts'});
    else if (v === 'heartDog') root.innerHTML = shell(await heartDogHtml(data), {back: 'heartsResult'});
    else if (v === 'conditions') root.innerHTML = shell(conditionsHtml(data.profile), {back: view.from && view.from !== 'conditions' ? view.from : 'results'});
    else if (v === 'rehearsals') root.innerHTML = shell(await rehearsalsHtml(data), {back: 'results'});
    // 다른 화면으로 넘어갈 때만 부드럽게 나타난다(같은 화면을 다시 그릴 때는 그대로)
    if (key !== lastDrawn || (v === 'question' && view.page !== lastPage)) root.querySelector('.pc-body')?.classList.add('pc-enter');
    lastPage = view.page;
    lastDrawn = key;
    bind(data);
    if (keepScroll !== null) root.querySelector('.pawcus-panel').scrollTop = keepScroll;
    if (v === 'loading') runLoading();
    if (v === 'rehearsal') { if (rh?.showDone) { const sc = root.querySelector('.pawcus-panel'); if (sc) sc.scrollTop = 0; } else scrollChat(); pump(); }   // [2026-10-14 사용자] 리허설 정리 화면은 맨 위부터(대화처럼 맨 아래로 내려가 있었음)
  }

  // 첫 화면(삼쩜삼 '혜택' 참고): 위에 그림 한 장, 아래에 그림+글자 카드 3개. 질문을 마쳤는지에 따라 카드가 가는 곳만 달라진다
  function introHtml(data) {
    const ready = Boolean(data && profileDone(data.profile)), likes = data?.likes?.length || 0;
    const started = Boolean(data && ALL_IDS.some(id => data.profile?.[id]));   // [2026-10-14 사용자] 답한 것이 있으면 '내 생활 작성'은 지우지 않고 이어서, '처음부터 다시 하기'는 작은 밑줄 글자로
    const card = (attr, art, title, tag, wide = '') => `<button class="hm-card ${wide}" ${attr}>${pic(art, wide ? 64 : 72)}<b>${esc(title)}</b><span class="hm-tag">${esc(tag)}</span></button>`;
    return `<main class="pc-body pc-app pc-homev">
      <div class="hm-hero">${sceneHtml()}<div class="hm-hi"><small>${ready ? '다시 만나서 반가워멍' : '만나서 반가워멍'}${pic('paw-dog', 18)}</small><h2>평생 가족, 같이 찾아냥${pic('paw-cat', 22)}</h2></div></div>
      <div class="hm-grid">
        ${card(ready ? 'data-go="results"' : 'data-action="start"', 'dog-happy', '내 가족 찾기', ready ? '추천 다시 보기' : '추천 3마리')}
        ${card('data-go="hearts"', 'cat-love', '마음에 담은 아이 보기', likes ? `${likes}마리 담음` : '♡로 담기')}
        ${card(ready ? 'data-go="conditions"' : started ? 'data-hm-continue' : 'data-action="start"', 'memo', '내 생활 작성', ready ? '작성 완료 · 수정' : '질문 15개 · 약 3분', 'hm-wide')}
      </div>
      <div class="pc-links pc-links-reset"><button class="pc-textbtn pc-reset-link" data-cond-reset>처음부터 다시 하기</button></div>
    </main>`;
  }  function speciesHtml() {
    return `<main class="pc-body pc-app pc-species-screen"><p class="ap-kicker pc-center">시작하기</p><h2 class="pc-h pc-center">어떤 동물과 함께하고 싶으세요?</h2>
      <div class="pc-species"><button data-species="개">${pic('dog', 120)}<b>강아지</b><small>보호소 강아지 공고</small></button><button data-species="고양이">${pic('cat', 120)}<b>고양이</b><small>준비 중</small></button></div></main>`;
  }
  function stepper(active) {
    const labels = [...PAGES.map(p => p.title), '결과'];
    return `<ol class="pc-stepper">${labels.map((l, i) => `<li class="${i < active ? 'done' : i === active ? 'now' : ''}"><i>${i < active ? '✓' : i + 1}</i><span>${esc(l)}</span></li>`).join('')}</ol>`;
  }
  // 선택지 글자 길이에 맞춰 열 수를 정한다(짧은 답은 여러 열, 긴 문장은 한두 열)
  function colsFor(id, options) {
    if (id === 'regions') return 4;
    if (id === 'Q_SIZE') return 3;
    const n = Math.max(...options.map(o => o.length));
    return n <= 5 ? 4 : n <= 9 ? 3 : 2;   // [2026-10-14 사용자] 긴 선택지(다른 개 만남·짖음 소음)도 한 줄에 하나가 아니라 두 칸씩(글은 칸 안에서 줄바꿈)
  }
  function regionCount(o) {
    const dogs = engineData?.dogs || [];
    return o === '상관없음(전국)' ? dogs.length : dogs.filter(d => d.region === o).length;
  }
  function questionHtml(index, profile) {
    const page = PAGES[index];
    const answered = ALL_IDS.filter(id => profile[id]);
    const openId = view.openQ && page.ids.includes(view.openQ) ? view.openQ : page.ids.find(id => !profile[id]);
    const summaryList = answered.length ? `<ul>${ALL_IDS.map(id => `<li><button data-jump="${esc(id)}"><span>${esc(SHORT[id])}</span><b class="${profile[id] ? '' : 'pc-noans'}">${esc(profile[id] ? answerLabel(id, profile[id]) : '미응답')}</b></button></li>`).join('')}</ul>` : '';
    const summary = answered.length ? `<details class="pc-summary"><summary>답한 것 ${answered.length}개 · 요약 보기</summary>${summaryList}</details>` : '';
    const qs = page.ids.map(id => {
      const [q, options] = QUESTIONS[id], saved = profile[id], why = whyOf(id);
      // 답한 질문은 한 줄로 접힌다(누르면 다시 펼쳐 바꿀 수 있음)
      // 답한 질문도 펼친 채로 둔다(다른 답을 바로 누를 수 있게, 2026-10-12 지시서)
      if (view.collapseDone && saved && id !== openId) return `<section class="pc-q pc-q-done" id="pc-q-${esc(id)}"><button class="pc-q-row" data-reopen="${esc(id)}"><span class="pc-q-check">✓</span><span class="pc-q-name">${esc(SHORT[id])}</span><b>${esc(answerLabel(id, saved))}</b><i>바꾸기</i></button></section>`;
      const cols = colsFor(id, options);
      const btn = o => {
        const extra = id === 'regions' ? `<small>${regionCount(o)}마리</small>` : '';
        const icon = id === 'Q_SIZE' && SIZE_ICON[o] ? `<span class="pc-size-dog">${pic('dog', SIZE_ICON[o] + 6)}</span>` : '';
        return `<button class="${saved === o ? 'on' : ''}" data-answer-id="${esc(id)}" data-answer="${esc(o)}">${icon}<span>${esc(answerLabel(id, o))}</span>${extra}</button>`;
      };
      return `<section class="pc-q pc-q-open" id="pc-q-${esc(id)}"><div class="pc-q-head"><h3>${esc(q)}</h3></div>
        ${id === 'regions' ? '<p class="pc-q-note">지금 보호 중인 아이가 있는 지역만 보여요.</p>' : ''}${['Q_HOUSEHOLD', 'Q_EMERGENCY', 'Q_PETS'].includes(id) ? '<p class="pc-q-note">여러 개에 해당하면 가장 가까운 것 하나를 골라 주세요.</p>' : ''}${why ? `<button class="pc-why-link" data-pop-title="왜 물어보나요?" data-pop-body="${esc(why)}">${pic('question', 20)}왜 물어보나요?</button>` : ''}
        ${why ? `<p class="pc-why" hidden data-why="${esc(id)}">${esc(why)}</p>` : ''}
        <div class="pc-opts pc-cols-${cols}">${options.map(btn).join('')}${options.some(o => /잘 모르/.test(o)) ? '' : `<button class="pc-unsure ${saved === '건너뜀' ? 'on' : ''}" data-answer-id="${esc(id)}" data-answer="건너뜀"><span>잘 모르겠어요</span></button>`}</div></section>`;   // [팀원요청 1014] 선택지에 '잘 모르겠음'이 이미 있는 질문(배변 실수 대처)은 공통 '잘 모르겠어요'를 붙이지 않음(두 개로 보였음)
    }).join('');
    const last = index === PAGES.length - 1;
    // 옆 순서 목록(세탁특공대 주문 일정 참고): 번호·단계 이름, 그 아래 고른 답. 단계를 누르면 그 단계로 간다
    const side = `<aside class="pc-side-col pc-wide-only"><ol class="qt">${PAGES.map((p, i) => { const picked = p.ids.filter(id => profile[id]).map(id => answerLabel(id, profile[id])); return `<li class="${i < index ? 'done' : i === index ? 'now' : ''}"><button data-page="${i}"><i>${i + 1}</i><b>${esc(p.title)}</b></button>${picked.length ? `<p>${esc(picked.join(' · '))}</p>` : `<p class="qt-empty">${p.ids.length}개 질문</p>`}</li>`; }).join('')}</ol></aside>`;
    return `<main class="pc-body pc-app pc-qscreen">${stepper(index)}<div class="pc-narrow-only">${summary}</div><div class="pc-split pc-split-q"><div class="pc-main-col">
      <div class="pc-page-title"><h2 class="pc-h">${esc(page.title)}</h2></div>
      ${page.ids.some(id => profile[id] && !answeredNow.has(id)) ? '<p class="pc-loaded">저장된 답을 불러왔어요. 바꿀 것만 고치면 돼요.</p>' : ''}
      ${qs}
      <div class="pc-nav pc-nav-sticky">${index ? `<button class="pc-sub" data-page="${index - 1}">이전</button>` : ''}<button class="pc-main" data-page="${last ? 'done' : index + 1}">${last ? '후보 보기' : '다음'}</button></div></div>${side}</div></main>`;
  }
  function conditionsHtml(profile) {
    return `<main class="pc-body pc-app pc-conds"><div class="ap-head pc-conds-head"><div><h2 class="pc-h">내 조건</h2><p class="pc-small">항목을 눌러 바꾸면 바로 저장돼요.</p></div><button class="pc-reset-btn" data-cond-reset>↺ 처음부터 다시 하기</button></div>
      ${PAGES.map((p, pi) => `<h3 class="dx-h">${esc(p.title)}</h3><section class="pc-cond ap-card">${p.ids.map(id => `<div class="pc-cond-row"><button class="pc-cond-head" data-open="cond-${esc(id)}"><span>${esc(QUESTIONS[id][0])}</span><b data-cond-val="${esc(id)}">${esc(profile[id] ? answerLabel(id, profile[id]) : '잘 모르겠어요')}</b><i>›</i></button>
        <div class="pc-opts" data-panel="cond-${esc(id)}" hidden>${QUESTIONS[id][1].map(o => `<button class="${profile[id] === o ? 'on' : ''}" data-cond-id="${esc(id)}" data-answer="${esc(o)}">${esc(answerLabel(id, o))}</button>`).join('')}</div></div>`).join('')}</section>`).join('')}
      <div class="ap-bottom"><button class="pc-main" data-cond-done>이 조건으로 다시 찾기</button>
      <button class="pc-reset" data-cond-reset>조건 처음부터 다시 하기</button></div></main>`;
  }
  // 로딩: 옆을 보는 사람이 무릎을 꿇고, 달려온 강아지·고양이를 품에 안는 장면(3D 그림과 같은 둥근 형태·부드러운 음영). 가짜 진행률 없음
  function loadingHtml() {
    if (globalThis.PawcusTeam?.loadingHtml) return PawcusTeam.loadingHtml();   // [팀원요청 1014] 세 장면 로딩(team_ui.js). 파일이 없으면 아래 기존 그림
    return `<main class="pc-body pc-app pc-loading pc-hug">
      <svg class="pc-hug-scene" viewBox="0 0 360 190" role="img" aria-label="사람이 달려온 강아지와 고양이를 안아 주는 그림">
        <defs>
          <radialGradient id="hgSkin" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffe6cf"/><stop offset="1" stop-color="#f5bf94"/></radialGradient>
          <radialGradient id="hgShirt" cx=".3" cy=".25" r=".9"><stop offset="0" stop-color="#c9e7bf"/><stop offset="1" stop-color="#86c182"/></radialGradient>
          <radialGradient id="hgDog" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff3df"/><stop offset="1" stop-color="#e9be86"/></radialGradient>
          <radialGradient id="hgCat" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#ffd59a"/><stop offset="1" stop-color="#ee9a3c"/></radialGradient>
          <linearGradient id="hgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6e6"/><stop offset="1" stop-color="#fffcf6"/></linearGradient>
        </defs>
        <rect width="360" height="190" rx="22" fill="url(#hgSky)"/>
        <circle cx="318" cy="36" r="15" fill="#ffd66b" opacity=".8"/>
        <path d="M0 170 Q90 152 180 162 T360 158 V190 H0Z" fill="#dcedcc"/>
        <ellipse cx="236" cy="170" rx="92" ry="7" fill="#0000000f"/>
        <path d="M30 168 q-4 -20 6 -30 q2 14 -6 30z M34 168 q8 -16 20 -18 q-6 12 -20 18z" fill="#9ccd93"/>
        <g class="pc-person" transform="translate(276 44)">
          <path d="M-6 114 Q-40 114 -44 124 Q-40 134 -6 132 Z" fill="#8a6a54"/>
          <ellipse cx="22" cy="128" rx="18" ry="8" fill="#8a6a54"/><ellipse cx="38" cy="132" rx="9" ry="5" fill="#5b4537"/>
          <g class="pc-arm-back" transform="translate(-2 58)"><g class="pc-arm-rot2"><rect x="-64" y="-6" width="66" height="13" rx="6.5" fill="#74b06f"/><circle cx="-64" cy=".5" r="7.5" fill="#f2b88b"/></g></g>
          <path d="M-18 48 Q-24 84 -14 118 H26 Q34 84 22 48 Q2 38 -18 48Z" fill="url(#hgShirt)"/>
          <circle cx="0" cy="22" r="23" fill="url(#hgSkin)"/>
          <path d="M-20 14 Q-18 -8 6 -6 Q30 -2 24 30 Q20 12 8 9 Q-6 6 -20 14Z" fill="#6b4a33"/>
          <circle cx="-23" cy="25" r="3.4" fill="#f5bf94"/>
          <path d="M-14 21 Q-10 16.5 -6 21" stroke="#3b2a20" stroke-width="2.4" fill="none" stroke-linecap="round"/>
          <ellipse cx="-8" cy="29" rx="4.5" ry="2.6" fill="#ff9e8a" opacity=".55"/>
          <path d="M-20 32 Q-16 37 -11 33" stroke="#c45a4a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        </g>
        <g class="pc-runner pc-cat"><g class="pc-bob">
          <path d="M150 150 q-18 -6 -14 -26" stroke="#e48f33" stroke-width="6" fill="none" stroke-linecap="round"/>
          <ellipse cx="172" cy="152" rx="22" ry="13" fill="url(#hgCat)"/>
          <path d="M166 142 q2 10 0 20 M176 141 q2 10 0 21" stroke="#e08a2e" stroke-width="2" fill="none" opacity=".6"/>
          <circle cx="196" cy="138" r="13" fill="url(#hgCat)"/>
          <path d="M187 130 L189 118 L197 127Z M199 126 L207 118 L206 132Z" fill="#ee9a3c"/>
          <path d="M197 137 q3 -3 6 0" stroke="#3b2a20" stroke-width="2" fill="none" stroke-linecap="round"/>
          <circle cx="207" cy="141" r="1.6" fill="#e0607a"/>
          <rect class="pc-leg" x="160" y="160" width="6" height="11" rx="3" fill="#e48f33"/><rect class="pc-leg pc-leg2" x="178" y="160" width="6" height="11" rx="3" fill="#e48f33"/>
        </g></g>
        <g class="pc-runner pc-dog"><g class="pc-bob">
          <path d="M162 112 q-20 -4 -20 -24" stroke="#e2b77c" stroke-width="9" fill="none" stroke-linecap="round"/>
          <ellipse cx="196" cy="120" rx="34" ry="20" fill="url(#hgDog)"/>
          <circle cx="230" cy="98" r="19" fill="url(#hgDog)"/>
          <ellipse cx="220" cy="100" rx="7.5" ry="13" fill="#d9a466" transform="rotate(16 220 100)"/>
          <ellipse cx="245" cy="104" rx="9" ry="7" fill="#fff6e8"/>
          <circle cx="251" cy="101" r="3.4" fill="#3b2a20"/>
          <path d="M231 94 q3 -3 6 0" stroke="#3b2a20" stroke-width="2.2" fill="none" stroke-linecap="round"/>
          <path d="M243 110 q3 6 7 1" fill="#ff8fa0"/>
          <rect class="pc-leg" x="172" y="132" width="9" height="18" rx="4.5" fill="#e2b77c"/><rect class="pc-leg pc-leg2" x="186" y="132" width="9" height="18" rx="4.5" fill="#e2b77c"/>
          <rect class="pc-leg pc-leg2" x="204" y="132" width="9" height="18" rx="4.5" fill="#e2b77c"/><rect class="pc-leg" x="216" y="132" width="9" height="18" rx="4.5" fill="#e2b77c"/>
        </g></g>
        <g transform="translate(274 102)"><g class="pc-arm-rot"><rect x="-58" y="-7" width="60" height="14" rx="7" fill="#8cc787"/><circle cx="-58" cy="0" r="8" fill="url(#hgSkin)"/></g></g>
        <g transform="translate(262 40)"><g class="pc-heart2"><path d="M0 6 C0 -2 -12 -2 -12 6 C-12 12 0 18 0 20 C0 18 12 12 12 6 C12 -2 0 -2 0 6Z" fill="#ff7f6e"/></g></g>
      </svg>
      <h2 class="pc-h pc-center">내 생활에 맞는 아이를 찾고 있어요</h2></main>`;
  }
  function runLoading() {
    setTimeout(() => { if (view.name === 'loading') go('results', {tab: 0}); }, calm() ? 400 : (globalThis.PawcusTeam?.LOADING_MS || 1700));   // [팀원요청 1014] 세 장면을 다 보여 주는 시간
  }

  // ───────── 결과: 탭으로 한 마리씩 ─────────
  let lastRec = null;
  async function computeRec(profile) {
    const rec = await pawcusApi.recommendCards(eng(profile));
    const person = pawcusApi.personOf(eng(profile));
    const personFlags = new Set(person.flags || []);
    lastRec = {rec, person, flags: (rec.flags || []).filter(f => !personFlags.has(f)), results: rec.cards.map(c => matchingEngine.checkOne(c.dog_id, person))};
    return lastRec;
  }
  function reasonSentences(res, profile) {
    const name = dogName(res.dog.dog_id), out = [];
    const rows = [...res.good].filter(r => !r.check).sort((a, b) => Number(b.key) - Number(a.key) || (b.person - b.dog) - (a.person - a.dog));
    for (const r of rows) {
      const t = traitOf(r.ind, r.dog); if (!t) continue;
      out.push({ind: r.ind, title: script.knowledge[r.ind]?.title || r.name, short: `${t.replace(/편이에요$/, '편이라')} ${FIT_END[r.ind] || '내 생활'}과 맞아요`, text: `${josa(name, '은', '는')} ${t.replace(/편이에요$/, '편이라')} ${FIT_END[r.ind] || '내 생활'}과 잘 맞아요.`, src: srcLabel(r.source), mine: myAnswers(r.ind, profile)});
    }
    for (const r of res.checks || []) if (r.gap !== null && !res.burden.includes(r)) out.push({ind: r.ind, title: script.knowledge[r.ind]?.title || r.name, short: '보호소 확인 기록이 있어요', text: `${script.knowledge[r.ind]?.title || r.name}: 보호소 확인 기록이 있어요.`, src: srcLabel(r.source), mine: ''});
    const size = (res.filter || []).find(f => f.filter === '맞음');
    if (size) out.push({ind: 'size', title: '크기', short: `원하는 크기와 맞아요 · ${dogFacts(res.dog.dog_id).split(' · ').pop()}`, text: `원하는 크기와 맞아요 (${engineData.display?.[res.dog.dog_id]?.weight_text || '공고 체중'}).`, src: '공고', mine: myAnswers('size', profile)});
    return out;
  }
  function considerItems(res, card, profile) {
    const name = dogName(res.dog.dog_id), items = [], K = script.knowledge;
    for (const r of res.burden) {
      if (r.source === 'followup') continue;
      const t = traitOf(r.ind, r.dog), k = K[r.ind] || {};
      items.push({ind: r.ind, tone: 'burden', label: '차이 있음', title: k.title || r.name,
        line: t ? `${josa(name, '은', '는')} ${t.replace(/편이에요$/, '편인데')} ${FIT_END[r.ind] || '내 생활'}과 비교하면 부담이 될 수 있어요.` : `${r.name}: 내 생활과 비교하면 부담이 될 수 있어요.`,
        mine: myAnswers(r.ind, profile), src: srcLabel(r.source), why: k.why, todo: k.todo, sources: k.sources});
    }
    for (const r of res.must) {
      const k = K[r.ind] || {};
      let line;
      if (r.check) line = {allergy: '알레르기는 털 양으로 알 수 없어서 직접 만나 확인해야 해요.', kids: '아이와 지내 본 경험이 공고에 없어서 꼭 확인해야 해요.', cats: '고양이와 지내 본 경험이 공고에 없어서 꼭 확인해야 해요.'}[r.ind];
      else if (r.ind === 'size') line = '1살 미만 믹스라 다 컸을 때 크기를 알기 어려워요.';
      else if (r.dog === null) line = `나에게 중요한 항목인데 공고에 기록이 없어요.`;
      else if (r.exception) line = `보호소 기록은 대체로 괜찮지만 예외 기록이 있어요: ${r.exception}`;
      else if (r.conflict) line = `공고 표시와 다른 문장이 있어요: "${r.conflict.quote}"`;
      else if (r.alt_matters) line = '공고 소개글만으로는 판단이 엇갈려요.';
      else line = '나에게 중요한 항목인데 공고 내용만으로는 확실하지 않아요.';
      items.push({ind: r.ind, tone: 'must', label: '먼저 확인', title: k.title || r.name, line, mine: myAnswers(r.ind, profile), src: r.dog !== null ? srcLabel(r.source) : '', why: k.why, todo: k.todo, sources: k.sources});
    }
    const topics = (enrichment?.dogs?.[res.dog.dog_id] || []).filter(realTopic);   // [2026-10-14] 성격 소개 낱말로 잘못 잡힌 건강 주제 제외
    for (const t of topics) {
      const learn = (t.learn || []).filter(x => !/위키백과/.test(x.source));
      const explain = learn.map(x => ({text: /문제은행|모의고사/.test(x.title || '') || /문제은행/.test(x.source) ? quizExplain(x.text) : x.text, src: `${x.source} · ${x.title || ''}`})).filter(x => x.text && !junkText(x.text));
      if (t.topic_id === 'BREED') items.push({ind: 'breed', tone: 'unknown', label: '참고', title: `견종 경향 (${res.dog.breed})`, line: '같은 견종도 개체 차이가 커서 참고로만 봐요.', why: explain.map(x => x.text).join(' '), sources: explain.map(x => x.src)});
      else if (t.topic_id === 'PUPPY') {
        const byAge = res.rows.filter(r => r.source === 'age').map(r => r.name);
        items.push({ind: 'puppy', tone: 'unknown', label: '알아 둘 것', title: '1살 미만이에요', line: '아직 어린 아이라 자라면서 성격과 습관이 달라질 수 있어요. 사람·다른 개·바깥 환경을 얼마나 겪어 봤는지 보호소에 물어보세요.', why: explain.map(x => x.text).join(' '), sources: explain.map(x => x.src)});
      }
      else {
        const rule = enrichment.followup_rules?.[t.topic_id];
        items.push({ind: 'health', tone: 'must', label: '건강', title: t.topic, line: `공고: "${tidyQuote(t.evidence)}"`, why: [rule?.question, ...explain.map(x => x.text)].filter(x => x && !junkText(x)).join(' '), sources: explain.map(x => x.src), health: true});
      }
    }
    const left = res.unknown.filter(r => !res.must.includes(r) && r.dog === null).map(r => r.name);
    if (left.length) items.push({ind: 'unknown', tone: 'unknown', label: '정보 없음', title: '공고에 없는 정보', line: `${left.join(', ')} — 하루 리허설에서 같이 확인해요.`});
    return items;
  }
  function healthHtml(id) {
    const h = health.dogs?.[id]; if (!h) return '';
    const names = health.meta?.test_names || {};
    const tone = v => v === '음성' ? 'ok' : v === '양성' ? 'burden' : 'unknown';
    const tests = Object.entries(h.tests || {}).map(([k, v]) => `<li class="pc-${tone(v)}"><b>${esc(names[k] || k)}</b><span>${esc(v)}</span></li>`).join('');
    const neuter = {Y: ['ok', '완료'], N: ['must', '아직 안 함'], U: ['unknown', '정보 없음']}[h.neutered] || ['unknown', '정보 없음'];
    return `<div class="pc-health"><h4>건강 기록 <small>공고에 적힌 내용</small></h4>
      <div class="pc-hgroup"><span class="pc-hlabel">검사 결과</span><ul class="pc-tests">${tests}</ul></div>
      <div class="pc-hgroup pc-hrow"><span class="pc-hlabel">중성화</span><span class="pc-st pc-${neuter[0]}">${neuter[1]}</span></div>
      <div class="pc-hgroup pc-hrow"><span class="pc-hlabel">접종·진료 기록</span>${h.medical_comment ? `<details class="pc-fold"><summary>공고 원문 보기</summary><p class="pc-pre">${esc(h.medical_comment)}</p></details>` : '<span class="pc-st pc-unknown">정보 없음</span>'}</div>
      <p class="pc-small">검사 결과는 적힌 검사 항목만의 결과예요. 검사 날짜와 지금 상태는 보호소에 확인해 주세요.</p></div>`;
  }
  function shelterHtml(card) {
    const id = card.dog_id, info = engineData.info?.[id] || {}, h = health.dogs?.[id] || {};
    const row = (k, v) => v ? `<div class="pc-kv"><dt>${esc(k)}</dt><dd class="pc-pre">${esc(v)}</dd></div>` : '';
    return `<dl>${row('보호소', info.shelter_name)}${row('전화', info.shelter_tel)}${row('주소', info.shelter_address)}${row('입양 절차', info.adoption_process)}${row('입양 조건', info.adoption_condition)}${row('입양 비용', info.adoption_charge)}${row('입양비 지원', h.adoption_support_detail)}${row('공고 기간', h.notice_start ? `${h.notice_start} ~ ${h.notice_end || ''}` : '')}${row('수집 당시 상태', h.state)}</dl>

      <div class="pc-row">${info.shelter_tel ? `<a class="pc-sub" href="tel:${esc(info.shelter_tel)}">☎ 전화하기</a>` : ''}<a class="pc-sub" href="${esc(card.url)}" target="_blank" rel="noreferrer">공고 보기 ↗</a></div>`;
  }
  // '왜 리허설인가': 공고 정보가 모자라면 그 개수를, 다 있어도 기록과 내 계획을 맞춰 보는 단계라는 점을 보여 준다
  function whyRehearsal(name, total, compared, must) {
    if (compared < total) return `<p class="pc-why-rh">공고만으로는 알 수 없는 게 <b>${total - compared}가지</b> 있어요. 하루 리허설에서 ${esc(josa(name, '과', '와'))} 보낼 하루를 그려 보며 같이 살펴봐요.</p>`;
    return `<p class="pc-why-rh">하루 리허설에서 ${esc(josa(name, '과', '와'))} 보낼 하루를 미리 그려 보고, 필요한 준비와 보호소에 물어볼 것을 정리해요.</p>`;
  }
  // 잘 맞음 정도(핀크 신용점수 참고): 점수를 새로 만들지 않고, 엔진이 공고로 비교한 항목 중 부담이 아닌 항목 수를 그대로 보여 준다
  function fitOf(res) {
    const compared = res.rows.filter(r => r.gap !== null), ok = compared.filter(r => !res.burden.includes(r));
    return {m: ok.length, n: compared.length, total: res.info?.total ?? compared.length};
  }
  // [팀원요청 1014-9] 자세히 화면의 '잘 맞음' 상자: 반원 게이지·숫자 문장 대신 하트(맞는 비율만큼 차오름) + 무엇이 남았는지 알려 주는 한 줄(사용자가 정한 세 문장)
  function fitSentence(res) {
    const {m, n, total} = fitOf(res), t = r => script.knowledge[r.ind]?.title || r.name;
    const list = rs => { const ns = [...new Set(rs.map(t))]; return ns.length ? josa(ns.join(', '), '은', '는') : ''; };
    if (!n || n < total / 2) return `공고에 정보가 적어요(${total}가지 중 ${n}가지만). 보호소에 물어볼 질문을 정리해 드릴게요.`;
    const diff = res.rows.filter(r => r.gap !== null && res.burden.includes(r)), unknown = res.rows.filter(r => r.gap === null && r.ind !== 'size');   // 크기는 희망 조건(비교 항목 아님)
    if (m < n) return `${n}가지 중 ${m}가지가 맞아요. <b>${esc(list(diff))}</b> 내 생활과 차이가 있어요.`.replace(/<b>(.+?)([은는])<\/b>/, '<b>$1</b>$2');
    return `공고에 적힌 ${n}가지는 모두 내 생활과 맞아요.${unknown.length ? ` <b>${esc(list(unknown))}</b> 공고에 없어서 하루 리허설에서 같이 확인해요.`.replace(/<b>(.+?)([은는])<\/b>/, '<b>$1</b>$2') : ''}`;
  }
  function gaugeHtml(res, big = false) {
    if (big && globalThis.PawcusTeam?.fitHeartHtml) return PawcusTeam.fitHeartHtml(fitOf(res), fitSentence(res));
    const {m, n, total} = fitOf(res), r = 52, len = Math.PI * r, frac = n ? m / n : 0;
    const arc = `M${60 - r} 64 A${r} ${r} 0 0 1 ${60 + r} 64`;
    return `<div class="fg ${big ? 'fg-big' : ''}"><svg viewBox="0 0 120 70" aria-hidden="true"><path d="${arc}" class="fg-track"/><path d="${arc}" class="fg-fill" style="stroke-dasharray:${(len * frac).toFixed(1)} ${len.toFixed(1)}"/></svg>
      <div class="fg-num">${n ? `<b>${m}</b><span>/ ${n}</span>` : '<b class="fg-none">–</b>'}</div>
      ${big ? `<p class="fg-cap">${n ? `공고로 비교한 ${n}개 중 <b>${m}개</b>가 내 생활과 맞아요` : '공고로 비교할 수 있는 정보가 없어요'}${total > n ? `<small>공고에 없는 항목 ${total - n}개</small>` : ''}</p>` : '<small class="fg-lab">맞는 항목</small>'}</div>`;
  }
  // 추천·비교 결과 카드(아이엠인 피드 참고): 사진 · 이름 · 짧은 추천 이유 · 하루 리허설. 사진·이름을 누르면 한 마리씩 자세히
  function dogCardHtml(id, res, card, profile, open) {
    const name = dogName(id), nm = name === '이 아이' ? noName(id) : name;
    const [tone, vlabel] = VERDICT_VIEW[card.verdict] || ['unknown', card.verdict];
    const why = reasonSentences(res, profile)[0]?.short || '공고에 적힌 정보가 적어요';
    const checks = res.burden.length + res.must.length;
    return `<article class="mc-card"><button class="mc-photo" ${open} aria-label="${esc(nm)} 자세히 보기"><img src="${esc(https(card.photo))}" alt=""></button>
      <button class="mc-name" ${open}>${esc(nm)}</button><p class="mc-facts">${esc(dogFacts(id))}</p>
      <span class="hx-chip pc-${tone}">${esc(vlabel)}</span>
      <p class="mc-why">${esc(why)}</p>${checks ? `<p class="mc-check">확인할 점 ${checks}개</p>` : ''}
      <button class="mc-cta" data-rehearse="${esc(id)}">하루 리허설</button></article>`;
  }
  async function resultsHtml(data, detail = false) {
    if (data.profile.species && data.profile.species !== '개') return `<main class="pc-body pc-app"><div class="ap-empty">${pic('cat-love', 110)}<p class="pc-text">고양이 비교는 준비 중이에요.</p></div></main>`;
    const {rec, flags, results} = lastRec && view.keep ? lastRec : await computeRec(data.profile);
    view.keep = false;
    if (!rec.cards.length) return `<main class="pc-body pc-app">${stepper(4)}<div class="ap-empty">${pic('magnifier', 110)}<h2 class="pc-h">지금 조건으로는 추천할 아이가 없어요</h2><p class="pc-text">${esc(flags[0] || '')}</p></div><button class="pc-main" data-go="conditions">조건 바꾸기</button></main>`;
    const flagNote = flags.length ? noticeHtml('추천 안내', flags[0]) : '';
    if (!detail) return `<main class="pc-body pc-app pc-result"><div class="ap-head"><div><h2 class="pc-h">추천 후보 <span class="pc-h-count">${rec.cards.length}마리</span></h2></div><button class="pc-link" data-go="conditions">조건 수정</button></div>${flagNote}
      <div class="mc-list">${rec.cards.map((c, i) => dogCardHtml(c.dog_id, results[i], c, data.profile, `data-detail="${i}"`)).join('')}</div></main>`;
    const tab = Math.min(view.tab || 0, rec.cards.length - 1);
    const tabs = `<nav class="hx-tabs" aria-label="추천 후보">${rec.cards.map((c, i) => `<button class="${i === tab ? 'on' : ''}" data-tab="${i}"><img src="${esc(https(c.photo))}" alt=""><span>${esc(dogName(c.dog_id) === '이 아이' ? noName(c.dog_id).replace(/^공고 \S+?-/, '') : dogName(c.dog_id))}</span></button>`).join('')}</nav>`;
    return `<main class="pc-body pc-app pc-result">${tabs}${dogDetailHtml(rec.cards[tab], results[tab], data)}</main>`;
  }
  // 주의·안내(필라이즈 참고): 그림으로 눈에 띄게, 누르면 가운데 창에 자세한 내용
  function noticeHtml(title, body, art = 'warning') {
    return `<button class="nt-row" data-pop-title="${esc(title)}" data-pop-body="${esc(body)}">${pic(art, 28)}<span>${esc(title)}</span><i>›</i></button>`;
  }
  function showPop(title, bodyHtml) {
    root.querySelector('.pp-back')?.remove();
    const back = document.createElement('div'); back.className = 'pp-back';
    back.innerHTML = `<div class="pp-card" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3><div class="pp-body">${bodyHtml}</div><button class="pc-main pp-ok">확인</button></div>`;
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('.pp-ok')) close(); });
    document.addEventListener('keydown', onKey, true);
    root.append(back); back.querySelector('.pp-ok').focus();
  }
  // [팀원요청 1014-2] 초기화 확인: 브라우저 기본 확인창(confirm)은 '대화상자 더 표시 안 함'을 누르면 묻지도 않고 '취소'가 되어 초기화가 조용히 안 됐다 → 창 안 확인 창
  function askConfirm(title, body, okLabel) {
    return new Promise(resolve => {
      root.querySelector('.pp-back')?.remove();
      const back = document.createElement('div'); back.className = 'pp-back';
      back.innerHTML = `<div class="pp-card" role="alertdialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3><div class="pp-body"><p>${esc(body)}</p></div><div class="pp-btns"><button class="pc-sub pp-no">취소</button><button class="pc-main pp-yes">${esc(okLabel)}</button></div></div>`;
      const done = v => { back.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
      const onKey = e => { if (e.key === 'Escape') done(false); };
      back.addEventListener('click', e => { if (e.target === back || e.target.closest('.pp-no')) done(false); else if (e.target.closest('.pp-yes')) done(true); });
      document.addEventListener('keydown', onKey, true);
      root.append(back); back.querySelector('.pp-yes').focus();
    });
  }  // 사진 아래 한 줄: 가장 먼저 봐야 할 것(차이 > 먼저 확인 > 건강 > 정보 없음)
  function focusLine(items) {
    const t = tone => items.filter(x => x.tone === tone && !x.health).map(x => x.title);
    const burden = t('burden'), must = [...t('must'), ...items.filter(x => x.health).map(x => x.title)];
    if (burden.length) return `<p class="pc-focus pc-burden"><b>생활 조건과 차이</b> ${esc(burden.join(', '))}</p>`;
    if (must.length) return `<p class="pc-focus pc-must"><b>먼저 확인할 사항</b> ${esc(must.join(', '))}</p>`;
    const unknown = items.filter(x => x.tone === 'unknown' && x.label === '정보 없음').map(x => x.line.split(' — ')[0]);
    return unknown.length ? `<p class="pc-focus pc-unknown"><b>아직 모르는 것</b> ${esc(unknown.join(', '))}</p>` : '';
  }
  // 3D 그림(Microsoft Fluent Emoji, MIT): 항목마다 같은 화풍의 아이콘
  const ICON = {alone: 'clock', activity: 'bone', barking: 'speaker', shedding: 'broom', dogs: 'dog', people: 'people', cost: 'money', training: 'cap', size: 'paw', kids: 'baby', cats: 'cat', allergy: 'pill', health: 'hospital', puppy: 'sparkles', breed: 'dog-face', unknown: 'question'};
  const emo = pic;
  // 한 아이의 결과 카드: 추천 탭과 '마음에 담은 아이'가 같이 쓴다
  function dogDetailHtml(card, res, data) {
    const id = card.dog_id, name = dogName(id), nm = name === '이 아이' ? noName(id) : name, subj = name === '이 아이' ? '이 아이' : name;
    const [tone, vlabel] = VERDICT_VIEW[card.verdict] || ['unknown', card.verdict];
    const reasons = reasonSentences(res, data.profile), items = considerItems(res, card, data.profile);
    const liked = data.likes.some(x => x.id === id);
    // 먼저 볼 것(차이·먼저 확인)은 위 카드에, 건강은 건강 카드에, 나머지는 '알아 둘 것'에 — 같은 내용을 두 번 쓰지 않는다
    const top = items.filter(x => (x.tone === 'burden' || x.tone === 'must') && !x.health), healthItems = items.filter(x => x.health), rest = items.filter(x => !top.includes(x) && !x.health);
    // 읽는 정보는 세 단계: 제목 → 한 줄 요약 → '판단 근거'(필요한 사람만 펼침). 정보 줄은 버튼처럼 보이지 않게 화살표를 쓰지 않는다
    const row = (x, i, key) => {
      const open = x.mine || x.why || x.todo;
      return `<li class="dx-item"><div class="dx-top"><b>${esc(x.title)}</b><span class="hx-chip pc-${x.tone}">${esc(x.label)}</span></div><p class="dx-sum">${esc(x.line)}</p>${open ? `<button class="dx-why" data-pop="${key}-${i}" data-pop-title="${esc(x.title)} · 판단 근거">판단 근거</button><div class="dx-more" data-panel="${key}-${i}" hidden>${x.mine ? `<p class="hx-mine">내 답 · ${esc(x.mine)}</p>` : ''}${x.why ? `<p>${esc(x.why)}</p>` : ''}${x.todo ? `<p class="hx-todo">${esc(x.todo)}</p>` : ''}</div>` : ''}</li>`;
    };
    const reasonRow = (r, i) => `<li class="dx-item"><div class="dx-top"><b>${esc(r.title)}</b><span class="hx-chip pc-ok">맞음</span></div><p class="dx-sum">${esc(r.short || r.text)}</p>${r.mine ? `<button class="dx-why" data-pop="ok-${i}" data-pop-title="${esc(r.title)} · 판단 근거">판단 근거</button><div class="dx-more" data-panel="ok-${i}" hidden><p class="hx-mine">내 답 · ${esc(r.mine)}</p><p>${esc(r.text)}</p></div>` : ''}</li>`;
    const info = engineData.info?.[id] || {};
    // ② 입양 전 확인: 생활 조건 차이·먼저 확인 항목 + 보호소 입양 조건(숨기지 않고 처음부터 보임)
    const cond = info.adoption_condition ? `<li class="dx-item"><div class="dx-top"><b>보호소 입양 조건</b><span class="hx-chip pc-must">입양 조건</span></div><p class="dx-sum pc-pre">${esc(info.adoption_condition)}</p></li>` : '';
    const alertTone = top.some(x => x.tone === 'burden') ? 'burden' : 'must';
    const alert = top.length || cond ? `<section class="dx-sec dx-alert pc-${alertTone}" style="order:2"><h3 class="dx-h dx-h-ic">${pic('warning', 24)}입양 전 확인 <small>${top.length + (cond ? 1 : 0)}</small></h3><ul class="dx-list">${top.map((x, i) => row(x, i, 'top')).join('')}${cond}</ul></section>` : '';
    // ③ 내 생활과 비교: 맞는 점 + 알아 둘 것(차이는 ②에 있으므로 반복하지 않음). 조건 확인과 수정을 가까이
    const compare = reasons.length || rest.length ? `<section class="dx-sec" style="order:3"><div class="dx-hrow"><h3 class="dx-h">내 생활과 비교</h3><button class="dx-link" data-go="conditions">조건 수정 ›</button></div>
      <div class="dx-card"><ul class="dx-list">${reasons.slice(0, 4).map(reasonRow).join('')}${rest.map((x, i) => row(x, i, 'rs')).join('')}</ul>${reasons.length > 4 ? `<details class="hx-fold"><summary>맞는 점 ${reasons.length - 4}개 더 보기</summary><ul class="dx-list">${reasons.slice(4).map((r, i) => reasonRow(r, i + 4)).join('')}</ul></details>` : ''}</div></section>` : '';
    // ④ 건강 기록: 항목—값 정렬 목록
    const h = health.dogs?.[id], names = health.meta?.test_names || {};
    const ht = v => v === '음성' ? 'ok' : v === '양성' ? 'burden' : 'unknown';
    const neuter = h ? ({Y: ['ok', '완료'], N: ['must', '아직 안 함'], U: ['unknown', '정보 없음']}[h.neutered] || ['unknown', '정보 없음']) : null;
    const kv = (k, v, t) => `<div class="dx-kv"><dt>${esc(k)}</dt><dd class="pc-${t}">${esc(v)}</dd></div>`;
    const healthCard = h ? `<section class="dx-sec" style="order:4"><h3 class="dx-h">건강 기록${h.notice_start ? ` <small>공고 ${esc(String(h.notice_start).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1.$2.$3'))} 기준</small>` : ''}</h3><div class="dx-card">
      <dl class="dx-kvs">${Object.entries(h.tests || {}).map(([k, v]) => kv(names[k] || k, v, ht(v))).join('')}${kv('중성화', neuter[1], neuter[0])}${h.medical_comment ? `<div class="dx-kv"><dt>접종·진료 기록</dt><dd><button class="dx-why" data-pop="med" data-pop-title="접종·진료 기록 (공고 원문)">원문 보기</button></dd></div>` : ''}</dl>
      ${h.medical_comment ? `<div class="dx-more" data-panel="med" hidden><p class="pc-pre">${esc(h.medical_comment)}</p></div>` : ''}
      ${healthItems.length ? `<ul class="dx-list">${healthItems.map((x, i) => row(x, i, 'hl')).join('')}</ul>` : ''}
  </div></section>` : '';
    // ⑤ 다음 단계: 대표 행동(리허설) 하나 + 보호소로 이어지는 줄
    const next = `<section class="dx-sec dx-next" style="order:5"><h3 class="dx-h">다음 단계</h3>
      <button class="pc-main dx-cta" data-rehearse="${esc(id)}">하루 리허설</button>
      <p class="dx-hint">${esc(josa(subj, '과', '와'))} 보낼 하루를 그려 보고, 보호소에 물어볼 것을 정리해요.</p>
      <div class="dx-card dx-navs"><button class="dx-nav" data-open="shelter"><span><b>보호소 정보</b><small>${esc(card.shelter || '')} · 절차·비용·연락</small></span><i>›</i></button><div class="dx-more dx-shelter" data-panel="shelter" hidden>${shelterHtml(card)}</div></div></section>`;
    return `<div class="pc-split pc-split-r hx dx"><aside class="pc-side-col">
      <div class="dx-who" style="order:1"><article class="hx-hero">
        <img class="hx-photo" src="${esc(https(card.photo))}" alt="${esc(nm)} 공고 사진">
        <span class="hx-verdict pc-${tone}">${esc(vlabel)}</span>
        <div class="hx-name"><h2>${esc(nm)}</h2><p>${esc(dogFacts(id))} · ${esc(card.region || '')}</p></div>
      </article>
      ${gaugeHtml(res, true)}
      <div class="dx-likebar"><button class="dx-like ${liked ? 'on' : ''}" data-like-id="${esc(id)}" data-label="1">${liked ? '♥ 담았어요' : '♡ 담기'}</button><button class="dx-link" data-go="${data.likes.length ? 'heartsResult' : 'hearts'}">담은 아이 ${data.likes.length ? `${data.likes.length}마리 ` : ''}보기 ›</button></div></div>
      ${next}
      </aside><div class="pc-main-col">
      ${alert}${compare}${healthCard}
      </div></div>`;
  }

  // ───────── 하루 리허설: 챗봇 말풍선 + 버튼 답 + 직접 쓰기 ─────────
  // 장면은 이 아이의 엔진 결과(부담·꼭 확인·모름 우선)로 고른다. 고른 답은 계획 연습이라 판정을 바꾸지 않는다.
  let rh = null;
  // 2026-10-13: 리허설을 나갔다 들어오면 대화가 사라지던 문제 → 아이별로 진행 상태·대화를 저장하고, 같은 생활 조건이면 이어서 보여 준다
  const RH_KEY = 'pawcus-rh', RH_FIELDS = ['scenes', 'i', 'log', 'plans', 'asks', 'refs', 'waiting', 'finished', 'started', 'mode', 'showDone', 'chat', 'activeChips', 'lastSettled', 'ack', 'total', 'paused'];
  const rhProfileKey = profile => JSON.stringify(Object.entries(eng(profile)).sort());
  let rhSaveTimer = 0;
  function saveRh() {
    clearTimeout(rhSaveTimer);
    rhSaveTimer = setTimeout(() => { if (!rh) return; const snap = {pk: rhProfileKey(rh.profile), at: Date.now()}; RH_FIELDS.forEach(k => { snap[k] = rh[k]; });
      try { chrome.storage.local.get(RH_KEY, x => { const all = x?.[RH_KEY] || {}; all[rh.id] = snap;
        const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 5);   // 최근 5마리만
        chrome.storage.local.set({[RH_KEY]: Object.fromEntries(keep)}); }); } catch {} }, 300);
  }
  const loadRh = id => new Promise(resolve => { try { chrome.storage.local.get(RH_KEY, x => resolve(x?.[RH_KEY]?.[id] || null)); } catch { resolve(null); } });
  const clearRh = id => new Promise(resolve => { try { chrome.storage.local.get(RH_KEY, x => { const all = x?.[RH_KEY] || {}; if (id) delete all[id]; chrome.storage.local.set({[RH_KEY]: id ? all : {}}, resolve); }); } catch { resolve(); } });
  async function openRehearsal(id, profile, card, {force = false} = {}) {
    const snap = await loadRh(id);
    buildRehearsal(id, profile, card);
    if (snap && (force || (snap.pk === rhProfileKey(profile) && snap.started))) {   // 같은 생활 조건으로 하던 리허설 → 이어서(문의하기는 조건이 바뀌어도 저장된 질문을 보여 줌)
      RH_FIELDS.forEach(k => { if (k in snap) rh[k] = snap[k]; });
      rh.shown = rh.log.length; rh.busy = false; rh.restored = true;
      // [2026-10-14 버그] 질문 말풍선이 다 나오기 전에 나가면 '답 기다림'은 저장되지만 답 버튼(activeChips)은 아직 없어서, 이어서 열면 질문만 있고 버튼이 없어 멈췄다
      // → 이어서 열 때 답을 기다리는 중이면 마지막 질문의 답 버튼을 다시 띄운다(대화 보기 전환 때와 같은 규칙)
      const lastOpt = rh.log.map((x, i) => x.options && !x.pendingAsk ? i : -1).reduce((a, c) => Math.max(a, c), -1);
      if (lastOpt >= 0 && (rh.waiting || rh.finished || (rh.paused && rh.log[lastOpt]?.nextBtn)) && !(rh.activeChips || []).includes(lastOpt)) rh.activeChips = [...(rh.activeChips || []).filter(i => rh.log[i]?.pendingAsk), lastOpt];
    }
  }
  // '리허설' 탭: 그동안 한 리허설(아이별) — 이어서 하기 · 문의하기(보호소에 물어볼 것·질문 복사·전화)
  async function rehearsalsHtml() {
    const all = await new Promise(resolve => { try { chrome.storage.local.get(RH_KEY, x => resolve(x?.[RH_KEY] || {})); } catch { resolve({}); } });
    const list = Object.entries(all).filter(([id]) => matchingEngine?.dogs.some(d => d.dog_id === id)).sort((a, b) => b[1].at - a[1].at);
    const head = `<div class="ap-head"><div><h2 class="pc-h">리허설</h2><p class="pc-small">그동안 해 본 하루 리허설이에요. 이어서 하거나, 정리한 질문으로 보호소에 문의할 수 있어요.</p></div></div>`;
    if (!list.length) return `<main class="pc-body pc-app">${head}<div class="ap-empty">${pic('calendar', 96)}<h2 class="pc-h">아직 해 본 리허설이 없어요</h2><p class="pc-text">추천이나 담은 아이에서 '하루 리허설'을 눌러 시작해 보세요.</p></div><button class="pc-main" data-go="results">추천 보러 가기</button></main>`;
    const day = t => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
    return `<main class="pc-body pc-app pc-rh-list">${head}${list.map(([id, s]) => {
      const photo = https(String(engineData.info?.[id]?.image_urls || '').split('|')[0].trim()), n = (s.scenes || []).length, done = (s.plans || []).length;
      const state = s.finished ? '다 했어요' : s.started ? `${done}/${n} 장면` : '시작 전';
      return `<article class="ap-card ap-pad pc-rh-item">${photo ? `<img src="${esc(photo)}" alt="">` : `<span class="pc-rh-noimg">${dogIcon()}</span>`}
        <div class="pc-rh-item-tx"><b>${esc(dogName(id) === '이 아이' ? noName(id) : dogName(id))}</b><small>${esc(state)} · 보호소에 물어볼 것 ${(s.asks || []).length}개 · ${day(s.at)}</small>
        <div class="pc-row"><button class="pc-sub" data-rh-resume="${esc(id)}">${s.finished ? '다시 보기' : '이어서 하기'}</button><button class="pc-main" data-rh-ask="${esc(id)}">문의하기</button></div></div></article>`;
    }).join('')}</main>`;
  }
  function buildRehearsal(id, profile, card = null) {
    loadCare();
    const person = pawcusApi.personOf(eng(profile)), res = matchingEngine.checkOne(id, person);
    const name = dogName(id), S = script.scenes, order = script.scene_order;
    const rows = res.rows.filter(r => S[r.ind]);
    const rank = r => res.burden.includes(r) ? 0 : res.must.includes(r) ? 1 : r.dog === null ? 2 : 3;
    const picked = [...(res.checks || []).map(r => ({ind: r.ind, row: r, rank: 1}))];
    const topics = (enrichment?.dogs?.[id] || []).filter(t => !['BREED', 'PUPPY'].includes(t.topic_id) && realTopic(t));
    const hw = health.dogs?.[id]?.tests?.heartworm === '양성';
    if (topics.length || hw) picked.push({ind: 'health', row: null, rank: 1, topics, hw});
    const sorted = rows.map(r => ({ind: r.ind, row: r, rank: rank(r)})).sort((a, b) => a.rank - b.rank || (b.row.dog ?? 0) - (a.row.dog ?? 0));
    for (const s of sorted) { if (picked.length >= 5) break; if (s.rank <= 2 || picked.length < 3) picked.push(s); }
    picked.sort((a, b) => order.indexOf(a.ind) - order.indexOf(b.ind));
    rh = {id, name, profile, res, card, scenes: picked, i: -1, log: [], plans: [], asks: [], refs: [], waiting: false, finished: false, aiOn: false};
    // 키(저장소 또는 확장 폴더 ai-key.json)가 있으면 직접 쓴 말을 무료 AI(Gemini)가 먼저 답한다. 없거나 실패하면 낱말 방식
    try { chrome.runtime.sendMessage({type: 'pawcus-ai-ready'}, r => { if (rh && !chrome.runtime.lastError) rh.aiOn = Boolean(r?.ok); }); } catch {}
    const total = picked.length;
    rh.shown = 0; rh.busy = false; rh.activeChips = []; rh.started = false; rh.total = total;
    nextScene();
  }
  function say(who, html, extra = {}) { rh.log.push({who, html, ...extra}); if (extra.sources) rh.refs.push(...extra.sources); saveRh(); if (rh.mode === 'card') { rh.shown = rh.log.length; redrawCard(); } else queueMicrotask(pump); }
  function sceneIntro(sc) {
    const S = script.scenes[sc.ind], name = rh.name, r = sc.row, parts = [];
    parts.push(`<b class="pc-when">${esc(S.when)}</b> ${esc(fillName(S.setup, name))}`);
    if (sc.ind === 'health') {
      const lines = sc.topics.map(t => `· ${esc(t.topic)}: 공고 "${esc(tidyQuote(t.evidence))}"`);
      if (sc.hw && !sc.topics.some(t => t.topic_id === 'HW_POS')) lines.push('· 심장사상충 검사: 공고에 양성으로 적혀 있어요');
      parts.push(lines.join('<br>'));
    } else if (r && r.check) {
      parts.push(`${esc(script.knowledge[sc.ind].why)}`);
    } else if (r) {
      const t = traitOf(sc.ind, r.dog);
      if (t) parts.push(`${esc(josa(name, '은', '는'))} ${esc(t)}`);
      else parts.push(`${esc(name)}의 이 부분은 공고에 기록이 없어요.`);
      if (r.source === 'comment' && r.evidence) parts.push(`소개글: "${esc(String(r.evidence).slice(0, 80))}"`);
      if (r.exception) parts.push(`예외 기록: ${esc(r.exception)}`);
      const mine = myAnswers(sc.ind, rh.profile); if (mine) parts.push(`<small class="pc-mine">내 답 · ${esc(mine)}</small>`);
      if (rh.res.burden.includes(r)) parts.push('내 생활과 비교하면 <b class="pc-t-burden">부담이 될 수 있어요.</b>');
      else if (rh.res.must.includes(r)) parts.push('나에게 중요한 항목인데 기록이 약해서 <b class="pc-t-must">꼭 확인이 필요해요.</b>');
      else if (r.gap !== null) parts.push('기록으로는 <b class="pc-t-ok">잘 맞는 편이에요.</b>');
    }
    return parts;
  }
  function sceneOptions(sc) {
    return script.scenes[sc.ind].options.filter(o => !o.if_answer || o.if_answer[1].includes(rh.profile[o.if_answer[0]]));
  }
  const SCENE_ICON = {training: '🌙', alone: '🏠', activity: '🦮', people: '🛎️', barking: '🔔', dogs: '🐕', shedding: '🧹', cost: '💰', kids: '👶', cats: '🐈', health: '🏥'};
  const SCENE_PIC = {training: 'moon', alone: 'house', activity: 'bone', people: 'bell', barking: 'speaker', dogs: 'dog', shedding: 'broom', cost: 'money', kids: 'baby', cats: 'cat', health: 'hospital'};
  function nextScene() {
    rh.i++;
    if (rh.i >= rh.scenes.length) { finishRehearsal(); return; }
    const sc = rh.scenes[rh.i], S = script.scenes[sc.ind];
    const parts = sceneIntro(sc);
    say('bot', `<small class="pc-scene-no">${pic(SCENE_PIC[sc.ind] || 'paw', 18)} 장면 ${rh.i + 1} / ${rh.scenes.length}</small><p class="cb-t">${parts[0]}</p>${parts.slice(1).map(x => `<p class="cb-d">${x}</p>`).join('')}`);
    say('bot', `<p class="cb-t">${esc(fillName(S.ask, rh.name))}</p>`, {options: sceneOptions(sc).map(o => o.label)});
    rh.waiting = true;
  }
  function shelterQuestionFor(sc) {
    if (sc.ind === 'health') return sc.topics.map(t => `${t.topic}: 지금 치료 상태와 입양 후 필요한 병원 일정·비용은 어떻게 되나요?`)[0] || '심장사상충 양성이라면 치료 상태와 입양 후 필요한 병원 일정·비용은 어떻게 되나요?';
    if (sc.row?.check) return matchingEngine.CHECKS[sc.ind].question;
    const fromCard = rh.card?.shelter_questions?.find(q => q.topic === sc.row?.name && !q.common);
    return fromCard?.text || engineData.criteria?.[sc.ind]?.shelter_question || '';
  }
  function needsAsk(sc, status) {
    if (sc.ind === 'health' || sc.row?.check) return true;
    const r = sc.row; if (!r) return status === 'open';
    return status === 'open' || rh.res.must.includes(r) || rh.res.burden.includes(r) || r.dog === null;
  }
  function addAsk(topic, text, must) { if (text && !rh.asks.some(a => a.text === text)) rh.asks.push({topic, text, must}); }
  function settleScene(sc, {label, status, reply, ai = false, shelterQ = '', used = []}) {
    rh.waiting = false;
    rh.plans.push({title: script.knowledge[sc.ind]?.title || '건강', label, status});
    const k = script.knowledge[sc.ind] || {};
    const must = Boolean(sc.row && rh.res.must.includes(sc.row)) || sc.ind === 'health' || Boolean(sc.row?.check);
    let tail = '<p class="pc-bub-note">이 계획을 저장했어요. 실제로 할 수 있는지 한 번 더 확인해 주세요.</p>';
    if (needsAsk(sc, status)) { const q = shelterQ || shelterQuestionFor(sc); addAsk(k.title || '건강', q, must); tail = `<p class="pc-bub-note">${pic('memo', 18)} 보호소에 물어볼 것에 담았어요 · <span>${esc(q.length > 46 ? q.slice(0, 46) + '…' : q)}</span></p>`; }
    rh.lastSettled = {idx: rh.i, ind: sc.ind, label, reply, tips: tipsHtml(sc), tail}; rh.ack = false;
    say('bot', `<p>${esc(reply)}</p>${tipsHtml(sc)}${tail}`, {sources: ai ? used : (k.sources || (sc.ind === 'health' ? healthSources(sc) : [])), ai});
    if (rh.mode === 'card') { nextScene(); return; }
    // 2026-10-13(사용자 피드백): 대화로 보기에서는 바로 다음 장면으로 넘기지 않는다. 그 사이 질문은 방금 장면을 기준으로 답하고, '다음 장면 →'을 눌러야 넘어간다
    rh.paused = true;
    nextButton();
  }
  function nextButton() {
    const last = rh.i >= rh.scenes.length - 1;
    say('bot', `<p class="cb-d">${last ? '궁금한 게 있으면 아래에 물어보세요. 다 됐으면 리허설을 마칠게요.' : '이 장면에서 궁금한 게 있으면 아래에 물어보세요. 준비되면 다음 장면으로 가요.'}</p>`, {options: [last ? '리허설 마치기' : '다음 장면 →'], nextBtn: true});
  }
  // 장면별 돌봄 정보(로얄캐닌 강아지 가이드·서울시 반려인지식 문제은행 요약, rehearsal_script.json tips·prepare)
  function tipsHtml(sc) {
    const S = script.scenes[sc.ind] || {};
    const ok = x => typeof x === 'string' || !x.if_answer || x.if_answer[1].includes(rh.profile[x.if_answer[0]]);
    const tips = (S.tips || []).filter(ok).map(x => typeof x === 'string' ? x : x.text).slice(0, 3);
    if (sc.ind === 'health') for (const t of sc.topics || []) { const q = enrichment?.followup_rules?.[t.topic_id]?.question; if (q) tips.unshift(q.replace(/\s*(감당할 수 있나요|할 수 있나요|가능한가요|맞출 수 있나요|받아들일 수 있나요)\?$/, '')); }
    if (!tips.length) return '';
    return `<details class="pc-tips"><summary>자세한 관리 방법 보기</summary><ul>${tips.slice(0, 3).map(x => `<li>${esc(x)}</li>`).join('')}</ul>${S.prepare?.length ? `<p><b>준비할 것</b> ${S.prepare.map(esc).join(' · ')}</p>` : ''}</details>`;
  }
  function healthSources(sc) {
    return sc.topics.flatMap(t => (t.learn || []).filter(x => !/위키백과/.test(x.source)).map(x => `${x.source} · ${x.title || ''}`)).slice(0, 2);
  }
  function chooseOption(label) {
    if (!rh?.waiting) return;
    const sc = rh.scenes[rh.i], opt = sceneOptions(sc).find(o => o.label === label);
    if (!opt) return;
    say('me', esc(label));
    settleScene(sc, {label, status: opt.status, reply: opt.reply});
  }
  function matchByKeywords(sc, message) {
    const S = script.scenes[sc.ind], opts = sceneOptions(sc);
    const compact = message.replace(/\s/g, '');
    for (const [idx, words] of Object.entries(S.keywords || {})) {
      const o = S.options[Number(idx)];
      if (o && opts.includes(o) && words.some(w => compact.includes(w))) return o;
    }
    return null;
  }
  const looksLikeQuestion = m => /[?？]|나요|까요|인가요|뭐|어떤|얼마|언제|어디|어떡|어쩌|어떻게|면$|면요|궁금|걱정|방법|알려|해야|돼요$|되죠|는지/.test(m.trim());   // '방법·알려 줘' 같은 물음표 없는 질문도 질문으로(팀원 의견 4)
  // 주제별 공감 한마디(AI가 없을 때)
  const EMPATHY = {kids: '아이와 강아지가 함께 지내는 건 걱정될 수 있어요.', cats: '고양이와 처음 만나는 건 서로에게 큰 일이죠.', dogs: '다른 개와의 만남은 조심스러운 부분이에요.', training: '처음엔 배변 실수나 밤에 우는 일이 걱정되죠.', alone: '혼자 있는 시간은 많이들 걱정하는 부분이에요.', barking: '짖음은 이웃 때문에 신경 쓰이죠.', activity: '산책·놀이 시간은 생활에 맞춰 보는 게 중요해요.', shedding: '털 관리는 매일의 일이라 미리 알아 두면 좋아요.', cost: '비용은 미리 그려 두면 마음이 편해요.', health: '건강 기록은 꼭 짚고 가는 게 좋아요.', people: '손님이 오면 강아지도 긴장할 수 있어요.'};
  async function onUserText(message) {
    message = message.trim(); if (!message || !rh) return;
    say('me', esc(message), {qa: true});
    const sc = rh.waiting ? rh.scenes[rh.i] : null;
    const ctx = sc || (rh.paused ? rh.scenes[rh.i] : null);   // 장면 사이(다음 장면 누르기 전)에는 방금 답한 장면을 기준으로 답한다
    const backToScene = () => {
      if (rh.mode === 'card') return;
      if (sc) say('bot', '다시 장면으로 돌아가 볼게요. ' + esc(fillName(script.scenes[sc.ind].ask, rh.name)), {options: sceneOptions(sc).map(o => o.label)});
      else if (rh.paused) nextButton();
    };
    if (rh.aiOn) {   // AI가 계획(장면 답)인지 질문인지 함께 판단하고 대화하듯 답한다
      const ai = await thinking(askAI('chat', message, ctx, Boolean(sc)));
      if (ai && sc && ai.kind === 'plan') { settleScene(sc, {label: message, status: ai.status === 'ready' ? 'ready' : 'open', reply: ai.reply, ai: true, shelterQ: ai.shelter_question, used: ai.used}); return; }
      if (ai) {
        say('bot', `<p>${esc(ai.reply)}</p>`, {qa: true, sources: ai.used, ai: true, ...(ai.shelter_question ? {options: ['보호소 질문에 담기', '괜찮아요'], pendingAsk: ai.shelter_question} : {})});
        backToScene();
        return;
      }
    }
    if (sc && !looksLikeQuestion(message)) {
      const ai = null;
      if (ai) { settleScene(sc, {label: message, status: ai.status === 'ready' ? 'ready' : 'open', reply: ai.reply, ai: true, shelterQ: ai.shelter_question, used: ai.used}); return; }
      const opt = matchByKeywords(sc, message);
      if (opt) settleScene(sc, {label: message, status: opt.status, reply: opt.reply});
      else settleScene(sc, {label: message, status: 'open', reply: `'${message.length > 30 ? message.slice(0, 30) + '…' : message}' 계획으로 적어 둘게요. 이 아이에게 맞는지는 보호소와 한 번 맞춰 보면 좋아요.`});
      return;
    }
    {
      const about = ctx && !TOPIC.some(([, re]) => re.test(message)) ? message + ' ' + script.scenes[ctx.ind].setup : message;   // 질문에 주제 낱말이 없으면 방금 장면의 주제로 찾는다
      const hit = searchNotice(message), care = searchCare(about, 2), topic = TOPIC.find(([, re]) => re.test(about))?.[0];
      // 팀원 의견 4(2026-10-13): 알아듣지 못하면 그렇다고 말하고, 바로 누를 수 있는 질문 예시를 준다(보호소 질문에 담기는 그대로)
      if (!hit && !care.length) {
        const ex = ['밤에 낑낑대면 어떻게 해요?', '혼자 있는 연습은 어떻게 해요?', '털 빠짐 관리는 어떻게 해요?'];
        say('bot', `<p>질문을 알아듣지 못했어요. <b>상황 + 궁금한 점</b>으로 다시 물어봐 주세요.</p><div class="pc-ex-qs">${ex.map(q => `<button type="button" data-ex-q="${esc(q)}">${esc(q)}</button>`).join('')}</div><p class="pc-bub-note">이 질문을 그대로 보호소에 물어보고 싶다면 질문 목록에 담아 둘 수 있어요.</p>`,
          {qa: true, options: ['보호소 질문에 담기', '괜찮아요'], pendingAsk: message});
        backToScene();
        return;
      }
      const parts = [`<p>${esc(EMPATHY[topic] || '좋은 질문이에요.')}</p>`];
      if (hit) parts.push(`<p>${esc(rh.name)} 공고에는 이렇게 적혀 있어요.</p><small class="pc-quote">"${esc(hit.text)}"</small>`);
      if (care.length) parts.push(`<div class="pc-tips"><b>${pic('sparkles', 18)} 이렇게 해 보면 좋아요</b><ul>${care.map(c => `<li>${esc(c.t.length > 200 ? c.t.slice(0, 200) + '…' : c.t)}</li>`).join('')}</ul></div>`);
      if (!hit && !care.length) parts.push('<p>이 내용은 공고나 자료에서 찾지 못했어요.</p>');
      const askIt = !hit;   // 이 아이에 대한 답은 보호소가 알고 있다
      say('bot', parts.join('') + (askIt ? '<p class="pc-bub-note">이 아이의 경우는 보호소가 가장 잘 알아요. 질문 목록에 담아 둘까요?</p>' : ''), {qa: true, sources: [...(hit ? [hit.where] : []), ...care.map(c => c.s)], ...(askIt ? {options: ['보호소 질문에 담기', '괜찮아요'], pendingAsk: message} : {})});
    }
    backToScene();
  }
  function noticeTexts(id) {
    const d = engineData.display?.[id] || {}, info = engineData.info?.[id] || {}, h = health.dogs?.[id] || {};
    return [['소개글', d.personality_comment || info.personality_comment], ['특이사항', d.feature], ['공고 태그', d.tags], ['접종·진료 기록', h.medical_comment || d.medical_comment], ['입양 절차', info.adoption_process], ['입양 조건', info.adoption_condition], ['입양 비용', info.adoption_charge]]
      .filter(([, t]) => t && String(t).trim());
  }
  // 돌봄 자료(care_kb.json: 로얄캐닌 강아지 글 33개 + 서울시 문제은행 해설) 낱말 검색. AI가 없을 때 답, AI가 있을 때는 근거로 넘긴다
  let careKb = null;
  // 리허설 장면의 돌봄 정보(tips)를 먼저 찾도록 앞에 붙인다(가중치 +1)
  const sceneTips = () => Object.values(script?.scenes || {}).flatMap(s => (s.tips || []).map(x => ({t: typeof x === 'string' ? x : x.text, s: (s.sources || [])[0] || '', tip: true})));
  const loadCare = () => careKb ? Promise.resolve(careKb) : fetch(url('care_kb.json')).then(r => r.json()).then(d => (careKb = [...sceneTips(), ...d])).catch(() => (careKb = sceneTips()));
  // 같은 뜻 낱말(질문 낱말 → 자료에서 찾을 낱말)
  const SYN = {털갈이: ['털', '빗질'], 청소: ['털', '빗질'], 빗질: ['브러시', '빗질'], 목욕: ['목욕', '샴푸'], 배변: ['배변', '화장실'], 오줌: ['배변', '화장실', '소변'], 똥: ['배변', '화장실'], 짖: ['짖'], 짖음: ['짖'], 혼자: ['혼자', '분리'], 분리불안: ['분리', '혼자'], 산책: ['산책'], 합사: ['소개', '합사', '기존 반려'], 고양이: ['고양이', '반려묘'], 아기: ['어린이', '아이'], 애기: ['어린이', '아이'], 밥: ['사료', '급여'], 사료: ['사료', '급여'], 비용: ['비용', '보험'], 병원: ['수의사', '동물병원'], 접종: ['백신', '접종'], 물어: ['씹', '물어뜯'], 깨물: ['씹', '물'], 첫날: ['첫날', '첫 날', '처음'], 밤: ['밤', '낑낑']};
  const STOP = /^(이|그|저|아이|강아지|반려견|어떻게|어떤|얼마나|무엇|뭐|해요|하나요|되나요|있나요|인가요|좋아요|좋을까요|할까요|하면|해야|그리고|때|것|수|좀|많이|정말|언제|언제쯤|어디|어디서|누가|누구|왜|무슨|몇|포인핸드|알려|알려줘|알려주세요|방법|궁금|궁금해요|진짜|혹시|보통)$/;   // 물음 낱말은 자료와 맞추지 않는다('언제'가 '언제든'에 걸리던 문제)
  function words(message) {
    return (message.match(/[가-힣A-Za-z0-9]{2,}/g) || []).map(w => w.replace(/(은|는|이|가|을|를|도|에|에서|으로|로|과|와|랑|이랑|하고|요|나요|까요|해요|하나요|되나요|인가요|있나요|할까요)$/, '')).filter(w => w.length >= 2 && !STOP.test(w));
  }
  // 질문 주제 → 리허설 장면(그 장면의 돌봄 정보를 먼저 보여 준다)
  const TOPIC = [['training', /배변|화장실|오줌|소변|똥|대변|패드|실수/], ['cats', /고양이|반려묘|냥/], ['dogs', /다른 개|합사|강아지 친구|산책.*개|개.*만나/], ['shedding', /털|빗질|브러시|목욕|미용|청소/], ['alone', /혼자|분리|출근|외출|집을 비/],
    ['barking', /짖|소음|이웃|층간/], ['activity', /산책|운동|놀이|에너지|장난감/], ['kids', /아이|아기|애기|자녀|어린이/], ['people', /손님|낯선 사람|사람을 무서/], ['cost', /비용|돈|보험|병원비|얼마/], ['health', /접종|백신|병원|검진|구충|사료|밥|아파|건강/], ['training', /밤|낑낑|울어|첫날|적응/]];
  function searchCare(message, k = 3) {
    if (!careKb) return [];
    const topic = TOPIC.find(([, re]) => re.test(message))?.[0];
    if (topic && script.scenes[topic]) {
      const S = script.scenes[topic], ws = words(message);
      const tips = (S.tips || []).map(x => typeof x === 'string' ? x : x.text).map(x => ({t: x, s: (S.sources || [])[0] || '', n: ws.filter(w => x.includes(w)).length})).sort((a, b) => b.n - a.n).slice(0, 2);
      const re = TOPIC.find(([key]) => key === topic)[1];
      const extra = careKb.filter(c => !c.tip && re.test(c.t)).map(c => ({...c, n: ws.filter(w => c.t.includes(w)).length})).filter(c => c.n >= 1).sort((a, b) => b.n - a.n || a.t.length - b.t.length).slice(0, 1);
      return [...tips, ...extra];
    }
    const ws = [...new Set(words(message))]; if (!ws.length) return [];
    const groupsOf = ws.map(w => [w, ...(SYN[w] || Object.entries(SYN).find(([key]) => w.startsWith(key))?.[1] || [])]);
    return careKb.map(c => ({...c, n: groupsOf.reduce((a, g) => a + (g.some(x => c.t.includes(x)) ? 2 : 0), 0) + (c.tip ? 1 : 0)}))
      .filter(c => c.n >= 2).sort((a, b) => b.n - a.n || a.t.length - b.t.length).slice(0, k);
  }
  function searchNotice(message) {
    const words = (message.match(/[가-힣A-Za-z]{2,}/g) || []).filter(w => !/있어요|나요|인가요|어떤|얼마|좋아|이아이|아이|해요|할까|하나요|되나요/.test(w)).map(w => w.replace(/(은|는|이|가|을|를|도|에|요)$/, ''));
    if (!words.length) return null;
    for (const [where, t] of noticeTexts(rh.id)) {
      const sentences = String(t).split(/(?<=[.!?。])\s+|\n+/).map(s => s.trim()).filter(Boolean);
      const s = sentences.find(x => words.some(w => w.length >= 2 && x.includes(w)));
      if (s) return {where: `포인핸드 공고 · ${where}`, text: s.slice(0, 160)};
    }
    return null;
  }
  function finishRehearsal() {
    rh.finished = true; rh.waiting = false;
    const ready = rh.plans.filter(p => p.status === 'ready').length;
    say('bot', `리허설을 마쳤어요. 고른 계획 ${rh.plans.length}개와 보호소에 물어볼 것 ${rh.asks.length}개를 정리했어요.`, {options: ['정리 보기']});
  }
  function copyText() {
    const info = engineData.info?.[rh.id] || {};
    const asks = [...rh.asks].sort((a, b) => Number(b.must) - Number(a.must));
    return [`[${rh.name === '이 아이' ? rh.id : rh.name}] ${rh.card?.url || info.page_url || ''}`, `${info.shelter_name || ''} ${info.shelter_tel || ''}`.trim(), '',
      '보호소에 물어볼 것', ...asks.map((a, i) => `${i + 1}. ${a.must ? '(꼭) ' : ''}${a.topic}: ${a.text}`), '',
      '내가 세운 계획', ...rh.plans.map(p => `- ${p.title}: ${p.label}${p.status === 'open' ? ' (확인 필요)' : ''}`)].join('\n');
  }
  function summaryHtml() {
    const info = engineData.info?.[rh.id] || {};
    const asks = [...rh.asks].sort((a, b) => Number(b.must) - Number(a.must));
    return `<section class="pc-rh-sum"><div class="pc-done-hero"><span class="pc-done-pets">${pic('dog', 64)}${pic('cat-love', 48)}</span><h2 class="pc-h">${esc(josa(rh.name, '과', '와'))} 하루 리허설 정리</h2><p class="pc-small">고른 계획 ${rh.plans.length}개 · 보호소에 물어볼 것 ${asks.length}개</p></div>
      <h3 class="hx-h">${pic('clipboard', 24)}보호소에 물어볼 것 <small>${asks.length}</small></h3><div class="ap-card ap-pad">${asks.length ? `<ol>${asks.map(a => `<li>${a.must ? '<b class="pc-star">★</b> ' : ''}<b>${esc(a.topic)}</b> ${esc(a.text)}</li>`).join('')}</ol>` : '<p class="pc-text">따로 물어볼 것이 없어요. 공고 원문과 지금 상태만 확인해 주세요.</p>'}</div>
      <h3 class="hx-h">${pic('memo', 24)}내가 세운 계획</h3><div class="ap-card ap-pad"><ul class="pc-plans">${rh.plans.map(p => `<li>${pill(p.status === 'ready' ? 'ok' : 'must', p.status === 'ready' ? '계획 선택됨' : '확인 필요')} <b>${esc(p.title)}</b> ${esc(p.label)}</li>`).join('')}</ul></div>
      <div class="pc-shelter-card"><b>${esc(info.shelter_name || '보호소')}</b>${info.shelter_tel ? `<span>☎ ${esc(info.shelter_tel)}</span>` : ''}</div>
      <button class="pc-main" data-rh-copy>질문 복사</button>
      <div class="pc-row">${info.shelter_tel ? `<a class="pc-sub" href="tel:${esc(info.shelter_tel)}">☎ 전화하기</a>` : ''}<a class="pc-sub" href="${esc(rh.card?.url || info.page_url || '#')}" target="_blank" rel="noreferrer">공고 보기 ↗</a></div>
      <button class="pc-textbtn" data-go="${esc(view.back || 'results')}">${view.back === 'heartDog' ? '담은 아이로 돌아가기' : view.back === 'rehearsals' ? '리허설 목록으로' : '추천으로 돌아가기'}</button></section>`;
  }
  const msgHtml = (m, prev) => `<div class="pc-msg pc-${m.who}${prev && prev.who === m.who ? ' pc-cont' : ''}">${m.who === 'bot' ? `<span class="pc-ava">${prev && prev.who === 'bot' ? '' : dogIcon()}</span>` : ''}<div class="pc-bubble">${m.html}</div></div>`;
  const chipsHtml = (m, idx) => `<div class="pc-chips" data-chips="${idx}">${m.options.map(o => `<button data-${m.pendingAsk ? 'ask-reply' : 'rh-opt'}="${esc(o)}" data-idx="${idx}">${esc(o)}</button>`).join('')}</div>`;   // 2026-10-13: 직접 입력칸은 말풍선 안이 아니라 대화 화면 맨 아래에 고정(rehearsalHtml)
  function chatLogHtml() {
    return rh.log.slice(0, rh.shown).map((m, idx) => msgHtml(m, rh.log[idx - 1]) + (rh.activeChips.includes(idx) && m.options ? chipsHtml(m, idx) : '') + (m.summary ? summaryHtml() : '')).join('');
  }
  function rehearsalStartHtml() {
    const photo = rh.card?.photo || '';
    return `<main class="pc-body pc-app pc-rh-start">
      <div class="pc-rh-stage">${photo ? `<img class="pc-rh-hero" src="${esc(https(photo))}" alt="">` : `<div class="pc-hero">${dogIcon()}</div>`}${pic('sparkles', 34, 'pc-rh-spark')}${pic('heart-sparkle', 38, 'pc-rh-love')}</div>
      <p class="pc-rh-kicker">하루 리허설</p>
      <h2 class="pc-h">${esc(josa(rh.name, '과', '와'))} 보내는 하루</h2>
      <ol class="pc-rh-map">${rh.scenes.map((sc, i) => `<li><span>${pic(SCENE_PIC[sc.ind] || 'paw', 30)}</span><small>${esc(script.scenes[sc.ind].when)}</small></li>${i < rh.scenes.length - 1 ? '<i></i>' : ''}`).join('')}</ol>
      <p class="pc-small pc-center">장면 ${rh.scenes.length}개 · 약 2분 · 버튼을 누르거나 직접 말해 보세요</p>
      <div class="pc-center">${modeSwitch()}</div>
      <button class="pc-main pc-start" data-rh-start>리허설 시작</button></main>`;
  }
  const modeSwitch = () => `<div class="pc-mode" role="group" aria-label="보는 방식"><button class="${rh.mode !== 'card' ? 'on' : ''}" data-rh-mode="chat">대화로 보기</button><button class="${rh.mode === 'card' ? 'on' : ''}" data-rh-mode="card">카드로 보기</button></div>`;
  function rehearsalHtml() {
    saveRh();
    if (!rh.started) return rehearsalStartHtml();
    if (rh.showDone) return `<main class="pc-body pc-app pc-rh-done">${summaryHtml()}</main>`;
    if (rh.mode === 'card') return rehearsalCardHtml();
    const photo = rh.card?.photo || '';
    return `<main class="pc-body pc-app pc-rh"><div class="pc-rh-head">${photo ? `<img src="${esc(https(photo))}" alt="">` : ''}<div><b>${esc(josa(rh.name, '과', '와'))} 하루 리허설</b><small>${esc(dogFacts(rh.id))}</small></div>${modeSwitch()}<span class="pc-rh-progress">${rh.plans.length}/${rh.scenes.length}</span><button class="pc-textbtn pc-rh-restart" data-rh-restart>↺ 처음부터</button></div>
      <div class="pc-chat" id="pc-chat">${chatLogHtml()}</div>
      ${rh.log.some(m => m.summary) ? '' : '<form class="pc-compose pc-compose-dock"><textarea rows="1" placeholder="예: 밤에 낑낑대면 어떻게 해요?" title="Tab을 누르면 예시가 입력돼요"></textarea><button type="submit">보내기</button></form>'}
</main>`;
  }
  // 카드로 보기: 장면 하나를 카드 한 장으로(상황·내 답·공고 기록 → 선택 → 안내 1~2문장, 자세히는 접기). 아래에서 궁금한 걸 물어볼 수 있다
  function rehearsalCardHtml() {
    const photo = rh.card?.photo || '', n = rh.scenes.length;
    const head = `<div class="pc-rh-head">${photo ? `<img src="${esc(https(photo))}" alt="">` : ''}<div><b>${esc(josa(rh.name, '과', '와'))} 하루 리허설</b><small>${esc(dogFacts(rh.id))}</small></div>${modeSwitch()}<span class="pc-rh-progress">${rh.plans.length}/${n}</span><button class="pc-textbtn pc-rh-restart" data-rh-restart>↺ 처음부터</button></div>`;
    const done = rh.plans.map((p, i) => `<li><span class="pc-q-check">✓</span><span class="pc-q-name">${i + 1}/${n} · ${esc(p.title)}</span><b>${esc(p.label)}</b></li>`).join('');
    let card;
    if (rh.lastSettled && !rh.ack) {
      const L = rh.lastSettled, S = script.scenes[L.ind];
      card = `<article class="pc-sc-card"><p class="pc-sc-step">${L.idx + 1} / ${n} · ${esc(script.knowledge[L.ind]?.title || '건강')}</p><h3>${esc(fillName(S.ask, rh.name))}</h3>
        <p class="pc-sc-pick">내 계획: <b>${esc(L.label)}</b></p><p class="pc-text">${esc(L.reply)}</p>${L.tips}${L.tail}
        <button class="pc-main" data-rh-next>${rh.finished ? '정리 보기' : '다음 장면 →'}</button></article>`;
    } else if (rh.finished) {
      card = `<article class="pc-sc-card"><h3>리허설을 마쳤어요</h3><button class="pc-main" data-rh-next>정리 보기</button></article>`;
    } else {
      const sc = rh.scenes[rh.i], S = script.scenes[sc.ind], r = sc.row;
      const t = r && !r.check ? traitOf(sc.ind, r.dog) : null;
      const record = sc.ind === 'health' ? sc.topics.map(x => `${x.topic}: "${x.evidence}"`).join(' / ') || '심장사상충 검사 양성' : r?.check ? script.knowledge[sc.ind]?.why : t ? `${josa(rh.name, '은', '는')} ${t}` : '공고에 기록이 없어요';
      const mine = r ? myAnswers(sc.ind, rh.profile) : '';
      card = `<article class="pc-sc-card"><p class="pc-sc-step">${rh.i + 1} / ${n} · ${esc(script.knowledge[sc.ind]?.title || '건강')}</p><h3>${esc(fillName(S.ask, rh.name))}</h3>
        <dl class="pc-sc-facts"><div><dt>상황</dt><dd>${esc(fillName(S.setup, rh.name))}</dd></div>${mine ? `<div><dt>내 답변</dt><dd>${esc(mine)}</dd></div>` : ''}<div><dt>공고 기록</dt><dd>${esc(record)}</dd></div></dl>
        <div class="pc-sc-opts">${sceneOptions(sc).map(o => `<button data-rh-opt="${esc(o.label)}">${esc(o.label)}</button>`).join('')}</div></article>`;
    }
    const qa = rh.log.map((m, i) => [m, i]).filter(([m]) => m.qa);
    const thread = qa.length ? `<div class="pc-qa">${qa.slice(-6).map(([m, i]) => `<div class="pc-msg pc-${m.who}"><div class="pc-bubble">${m.html}</div></div>${m.options && m.pendingAsk ? chipsHtml(m, i) : ''}`).join('')}</div>` : '';
    return `<main class="pc-body pc-app pc-rh pc-rh-card">${head}${done ? `<ul class="pc-sc-done">${done}</ul>` : ''}${card}
      <section class="pc-ask"><h4>궁금한 점 물어보기</h4>${thread}<form class="pc-compose"><textarea rows="1" placeholder="예: 밤에 낑낑대면 어떻게 해요?" title="Tab을 누르면 예시가 입력돼요"></textarea><button type="submit">보내기</button></form></section></main>`;
  }
  let cardTimer = 0;
  const redrawCard = () => { clearTimeout(cardTimer); cardTimer = setTimeout(() => { if (view.name === 'rehearsal' && rh?.mode === 'card') { lastDrawn = ''; draw(); } }, 0); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const nodeOf = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };
  const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // 글자를 1~2초 동안 한 글자씩(말풍선을 누르면 바로 다 보임)
  async function typeIn(bubble) {
    if (calm()) return;
    const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push([walker.currentNode, walker.currentNode.nodeValue]);
    const total = nodes.reduce((a, [, t]) => a + t.length, 0); if (!total) return;
    nodes.forEach(([n]) => { n.nodeValue = ''; });
    const ms = Math.max(600, Math.min(1800, total * 28)), step = Math.max(1, Math.ceil(total / (ms / 30)));
    let shown = 0, skip = false; bubble.addEventListener('click', () => { skip = true; }, {once: true});
    while (shown < total && !skip) {
      shown = Math.min(total, shown + step); let left = shown;
      for (const [n, t] of nodes) { n.nodeValue = t.slice(0, Math.max(0, left)); left -= t.length; }
      scrollChat(); await wait(30);
    }
    nodes.forEach(([n, t]) => { n.nodeValue = t; });
  }
  async function pump() {
    if (!rh || rh.busy || view.name !== 'rehearsal') return;
    const chat = root.querySelector('#pc-chat'); if (!chat || rh.shown >= rh.log.length) return;
    rh.busy = true;
    const idx = rh.shown, m = rh.log[idx];
    if (m.who === 'bot') {
      const dots = nodeOf(`<div class="pc-msg pc-bot pc-typing"><span class="pc-ava">${dogIcon()}</span><div class="pc-bubble"><i></i><i></i><i></i></div></div>`).firstChild;
      chat.append(dots); scrollChat(); await wait(calm() ? 0 : 420); dots.remove();
    }
    if (root.querySelector('#pc-chat') !== chat) { rh.busy = false; return; }   // 그사이 다른 화면으로 감
    chat.append(nodeOf(msgHtml(m, rh.log[idx - 1]))); scrollChat();
    if (m.who === 'bot') await typeIn(chat.lastElementChild.querySelector('.pc-bubble'));
    rh.shown++;
    const lastOpt = rh.log.slice(0, rh.shown).map((x, i) => x.options && !x.pendingAsk ? i : -1).reduce((a, b) => Math.max(a, b), -1);
    if (m.options && (m.pendingAsk || (rh.finished && m.options[0] === '정리 보기') || ((rh.waiting || (rh.paused && m.nextBtn)) && idx === lastOpt && rh.shown >= rh.log.length))) {
      if (!m.pendingAsk) { chat.querySelectorAll('.pc-chips').forEach(c => { if (!c.querySelector('[data-ask-reply]')) c.remove(); }); rh.activeChips = rh.activeChips.filter(i => rh.log[i]?.pendingAsk); }
      rh.activeChips.push(idx); chat.append(nodeOf(chipsHtml(m, idx))); bindChips();
    }
    if (m.summary) { chat.append(nodeOf(summaryHtml())); bindChips(); root.querySelector('.pc-compose')?.remove(); }
    const prog = root.querySelector('.pc-rh-progress'); if (prog) prog.textContent = `${rh.plans.length}/${rh.scenes.length}`;
    scrollChat();
    rh.busy = false;
    pump();
  }
  // 장면 질문의 버튼은 마지막 말풍선까지 나온 뒤에 보인다(그 전에 쌓인 말풍선이 남아 있으면 기다림)
  async function thinking(promise) {
    // 내 말풍선이 먼저 화면에 나온 뒤 '…'를 붙인다(전에는 '…'가 내 말보다 위에 보였음)
    for (let n = 0; rh && rh.shown < rh.log.length && n < 100; n++) await wait(50);
    const chat = root.querySelector('#pc-chat');
    const dots = chat ? nodeOf(`<div class="pc-msg pc-bot pc-typing"><span class="pc-ava">${dogIcon()}</span><div class="pc-bubble"><i></i><i></i><i></i></div></div>`).firstChild : null;
    if (dots) { chat.append(dots); scrollChat(); }
    if (rh) rh.thinking = true;
    try { return await promise; } finally { dots?.remove(); if (rh) rh.thinking = false; }
  }
  function bindChips() {
    root.querySelectorAll('[data-rh-opt]:not([data-bound])').forEach(b => { b.dataset.bound = 1; b.addEventListener('click', () => {
      if (b.dataset.rhOpt === '정리 보기') { rh.showDone = true; lastDrawn = ''; draw(); return; }
      if (rh.log[Number(b.dataset.idx)]?.nextBtn) {   // '다음 장면 →' / '리허설 마치기'
        if (!rh.paused || rh.thinking) return;   // 답을 쓰는 중에는 넘어가지 않는다(답이 다음 장면 뒤에 붙던 문제)
        rh.paused = false;
        root.querySelectorAll('.pc-chips').forEach(c => { if (!c.querySelector('[data-ask-reply]')) c.remove(); });
        rh.activeChips = rh.activeChips.filter(i => rh.log[i]?.pendingAsk);
        nextScene(); return;
      }
      if (!rh.waiting) return;
      root.querySelectorAll('.pc-chips').forEach(c => { if (!c.querySelector('[data-ask-reply]')) c.remove(); });
      rh.activeChips = rh.activeChips.filter(i => rh.log[i]?.pendingAsk);
      chooseOption(b.dataset.rhOpt);
    }); });
    root.querySelectorAll('[data-ask-reply]:not([data-bound])').forEach(b => { b.dataset.bound = 1; b.addEventListener('click', () => {
      const idx = Number(b.dataset.idx), m = rh.log[idx]; if (!m?.pendingAsk) return;
      if (b.dataset.askReply !== '괜찮아요') addAsk('궁금한 것', m.pendingAsk, false);
      b.closest('.pc-chips')?.remove(); rh.activeChips = rh.activeChips.filter(i => i !== idx); m.pendingAsk = null;
      say('bot', b.dataset.askReply !== '괜찮아요' ? '보호소 질문에 담았어요.' : '알겠어요.', {qa: true});
    }); });
    root.querySelectorAll('.pc-compose-in:not([data-bound])').forEach(form => { form.dataset.bound = 1; const ta = form.querySelector('textarea');
      form.addEventListener('submit', e => { e.preventDefault(); const msg = ta.value; if (!msg.trim()) return; ta.value = ''; onUserText(msg); });
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } }); });
    root.querySelectorAll('[data-rh-copy]:not([data-bound])').forEach(b => { b.dataset.bound = 1; b.addEventListener('click', async e => { const t = copyText(); try { await navigator.clipboard.writeText(t); e.target.textContent = '복사했어요 ✓'; } catch { prompt('아래 내용을 복사하세요', t); } }); });
    root.querySelectorAll('.pc-rh-sum [data-go]:not([data-bound])').forEach(b => { b.dataset.bound = 1; b.addEventListener('click', e => { e.preventDefault(); go(b.dataset.go, {tab: view.tab, keep: b.dataset.go === 'results' && Boolean(lastRec), id: view.id}); }); });
  }
  function drawChat() { pump(); }
  function scrollChat() {   // 패널이 스크롤된다. 마지막 말풍선이 보이게 맨 아래로
    const panel = root.querySelector('.pawcus-panel'); if (panel) panel.scrollTop = panel.scrollHeight;
  }

  // AI: 이 아이의 기록(엔진 값·공고 문장)과 자료(knowledge)만 주고, JSON으로만 받는다. 실패하면 null → 버튼·낱말 방식.
  async function askAI(mode, message, sc, planOk = true) {   // planOk=false: 이미 답한 장면을 두고 묻는 질문(계획으로 받지 않음)
    const id = rh.id, refs = {}, lines = [];
    const add = (rid, label, text) => { refs[rid] = label; lines.push(`[${rid}] ${label}: ${text}`); };
    for (const r of [...rh.res.rows, ...(rh.res.checks || [])]) add(`R_${r.ind}`, `${r.name} 기록`, r.dog === null ? '기록 없음' : `${Math.round(r.dog)}/5 (${srcLabel(r.source)}, 숫자가 클수록 돌봄 요구가 큼)${r.evidence ? ` 근거 문장 "${String(r.evidence).slice(0, 120)}"` : ''}`);
    noticeTexts(id).forEach(([where, t], i) => add(`N${i + 1}`, `포인핸드 공고 · ${where}`, String(t).slice(0, 500)));
    const tests = health.dogs?.[id]?.tests; if (tests) add('H1', '공고 건강 검사', Object.entries(tests).map(([k, v]) => `${health.meta?.test_names?.[k] || k} ${v}`).join(', '));
    Object.entries(script.knowledge).forEach(([k, v]) => add(`K_${k}`, `자료 · ${(v.sources || []).join(' / ')}`, v.why));
    const query = message + ' ' + (sc ? script.scenes[sc.ind].setup : '');
    const recordLines = lines.slice();   // 이 아이 기록·자료 설명(돌봄 자료 검색 결과 C는 LangChain 검색기가 따로 붙인다)
    searchCare(query, 5).forEach((c, i) => add(`C${i + 1}`, c.s, c.t));
    const scene = sc ? fillName(`${planOk ? '지금 장면' : '방금 이야기한 장면(사용자의 질문은 이 장면에 대한 것)'}: ${script.scenes[sc.ind].when} — ${script.scenes[sc.ind].setup} 질문: ${script.scenes[sc.ind].ask}`, rh.name) : '장면 없음';
    const mine = ALL_IDS.filter(x => rh.profile[x]).map(x => `${SHORT[x]}=${rh.profile[x]}`).join(', ');
    // 2026-10-13: 답이 매번 '공감 → 기록 → 되묻기' 같은 틀이고 '3/5' 같은 점수를 그대로 말해서, 틀을 풀고 일반 돌봄 지식은 써도 되게 바꿈.
    // 이 아이에 대한 사실(행동·건강·성격)만 기록 안에서 말하고, 모르면 지어내지 않는 규칙은 그대로 둔다.
    const system = '너는 보호소 강아지 입양을 고민하는 사람과 이야기하는 다정하고 아는 것 많은 친구다. 질문에 바로 답한다. 정해진 순서나 틀 없이, 친구가 메신저로 답하듯 자연스럽게 2~4문장, 부드러운 한국어 존댓말(~요). '
      + '청소 도구·놀이 방법·배변 훈련 같은 일반적인 돌봄 질문은 네가 아는 일반 지식으로 구체적으로 답해도 된다(예: 도구 종류, 방법, 순서). [자료]에 맞는 내용이 있으면 그것을 우선 쓴다. '
      + '이 아이에 대한 사실(행동·건강·성격·기록)은 [기록]에 있을 때만 말하고, 없으면 지어내지 않는다. 사용자가 이 아이에 대해 물었는데 기록이 없을 때만 "공고에는 없어요"라고 짧게 말한다. '
      + '점수·숫자(예: 3/5, 4점)나 "기록상", "자료에 따르면" 같은 말은 쓰지 말고 "산책을 꽤 좋아하는 편"처럼 풀어서 말한다. 매번 공감 문장으로 시작하거나 질문으로 끝내지 않는다. 되묻기는 정말 필요할 때만 한다. '
      + '진단·약·치료 지시는 하지 않고 필요하면 수의사 상담을 권한다. 출처 이름이나 id는 답에 쓰지 않는다. '
      + 'JSON 객체 하나로만 답한다: {"kind": "plan" 또는 "question", "reply": 문자열, "status": "ready" 또는 "open", "shelter_question": 이 아이에 대해 보호소만 답할 수 있는 것이 있을 때 그 한 문장, 아니면 빈 문자열, "used": 사용한 근거 id 배열}';
    const task = mode === 'chat' ? `사용자 말: "${message}". ${sc && planOk ? '지금 장면 질문에 대한 사용자의 계획·답이면 kind="plan"으로 하고 그 계획을 이 아이 기록과 자료에 비춰 받아 주고 평가해라(충분하면 status=ready, 보호소 확인이 필요하면 open). ' : ''}궁금한 것을 묻거나 걱정을 말한 것이면 kind="question"으로 하고 그 질문에 바로 답해라. 일반 돌봄 질문이면 shelter_question은 빈 문자열로 둬라.` : mode === 'plan' ? `사용자가 이 장면에서 이렇게 답했다: "${message}". 이 계획을 이 아이 기록과 자료에 비춰 짧게 평가하고, 계획으로 충분하면 status=ready, 보호소 확인이 필요하면 open.` : `사용자 질문: "${message}". 이 아이 기록으로 답할 수 있으면 먼저 답하고, 일반적인 돌봄 방법은 [자료]의 C·K 항목으로 짧게 알려 줘라. 자료에 없는 내용은 지어내지 말고, 답할 수 없으면 shelter_question에 보호소에 물어볼 질문을 넣어라. status는 open.`;
    const prompt = `이 아이 이름: ${rh.name}\n내 생활 답: ${mine}\n${scene}\n\n[기록과 자료]\n${lines.join('\n')}\n\n${task}`;
    // 2026-10-13: 응답이 안 오면 '…'만 계속 돌던 문제 → 30초가 지나면 낱말 방식으로 답한다
    const send = m => Promise.race([new Promise(resolve => chrome.runtime.sendMessage(m, r => resolve(chrome.runtime.lastError ? null : r))), wait(30000).then(() => ({ok: false, reason: 'timeout'}))]);
    const done = (j, extraRefs = {}) => {
      if (!j || typeof j.reply !== 'string' || !j.reply.trim() || j.reply.length > 500) return null;
      const ans = {kind: j.kind === 'plan' ? 'plan' : 'question', reply: j.reply.trim(), status: j.status, shelter_question: typeof j.shelter_question === 'string' ? j.shelter_question.trim() : '', used: (Array.isArray(j.used) ? j.used : []).map(x => extraRefs[x] || refs[x]).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3)};
      (rh.chat ||= []).push({role: 'human', text: message}, {role: 'ai', text: ans.reply});   // 대화 기억(다음 질문 때 LangChain 체인에 함께 넘긴다)
      return ans;
    };
    try {
      // 1) LangChain 체인: 검색기(돌봄 자료) → 프롬프트 템플릿(+대화 기억) → Gemini 구조화 출력
      const lc = await send({type: 'pawcus-lc', input: {name: rh.name, mine, scene, records: recordLines.join('\n'), task, query, history: (rh.chat || []).slice(-8)}});
      if (lc?.ok) { rh.aiVia = 'langchain'; return done(lc.answer, Object.fromEntries((lc.docs || []).map(d => [d.id, d.source]))); }
      if (lc?.reason === 'no-key') { rh.aiOn = false; return null; }
      if (lc?.reason === 'limit' || lc?.reason === 'timeout') return null;   // 무료 한도·시간 초과: 이번 말만 낱말 방식으로, 다음 말은 다시 AI
      // 2) 체인을 쓸 수 없으면(묶음 파일 문제 등) 예전처럼 Gemini를 직접 부른다
      const out = await send({type: 'pawcus-ai', system, prompt});
      if (!out?.ok) { if (out?.reason === 'no-key') rh.aiOn = false; return null; }
      rh.aiVia = 'direct';
      return done(JSON.parse(String(out.text).replace(/^```json\s*|```$/g, '')));
    } catch { return null; }
  }

  // ───────── AI 설정 · 관심 동물 ─────────
  async function settingsHtml() {
    const s = await aiStore.get();
    return `<main class="pc-body pc-app pc-settings"><div class="ap-head"><div><h2 class="pc-h">AI 설정</h2></div></div><section class="ap-card ap-pad">
      <p class="pc-text">하루 리허설에서 직접 쓴 문장을 알아듣는 데 무료 AI(Google AI Studio의 Gemini)를 써요. Colab 노트북 04에서 쓰는 <b>GOOGLE_API_KEY</b>와 같은 키를 붙여 넣으면 돼요.</p>
      <p class="pc-small">키는 이 PC의 브라우저에만 저장되고 파일에는 남지 않아요. 키가 없거나 무료 한도에 걸리면 버튼·낱말 방식으로 계속 진행돼요.</p>
      <label class="pc-label">API 키 ${s.key ? '<span class="pc-pill pc-ok">저장됨</span>' : ''}<input type="password" class="pc-input" data-ai-key placeholder="${s.key ? '새 키로 바꾸려면 붙여 넣기' : 'AIza로 시작하는 키'}" autocomplete="off"></label>
      <button class="pc-main" data-ai-save>저장</button>
      <div class="pc-row"><button class="pc-sub" data-ai-test>연결 확인</button>${s.key ? '<button class="pc-sub" data-ai-del>키 지우기</button>' : ''}</div>
      <p class="pc-small" data-ai-result>${s.model ? `마지막으로 쓴 모델: ${esc(s.model)}` : ''}</p></section></main>`;
  }
  // ───────── ♡ 마음에 담은 아이: 추천(매칭)과 별개 ─────────
  // 사용자가 외모·사연을 보고 직접 담은 아이들 안에서 내 생활과 더 잘 맞는 순서를 보여 준다. 순서는 엔진 rankKey(추천과 같은 규칙).
  const inData = id => Boolean(matchingEngine?.dogs.some(d => d.dog_id === id));
  const profileDone = profile => profile.species === '개' && ALL_IDS.every(id => profile[id]);
  const canCompare = profile => profile.species === '개' && ALL_IDS.some(id => profile[id]);   // 추천 화면과 같은 기준(답이 하나라도 있으면 비교, 모르는 칸은 '정보 없음'으로)
  function likedPhoto(a) { return https(a.photo || String(engineData.info?.[a.id]?.image_urls || '').split('|')[0].trim()); }
  function likedName(a) { let n = inData(a.id) ? dogName(a.id) : ''; if (!n || n === '이 아이' || n === a.id) n = a.name || ''; return !n || n === '이 아이' ? noName(a.id) : n; }
  // 2026-10-13: 담은 아이가 확장 안 데이터(추천 탭 수집본)에 없으면 비교가 안 됐다 → 비교를 열 때 포인핸드 공고를 읽어 엔진에 넣는다.
  // 노트북 03(수집)·03 8장(dogs.csv 변환)과 같은 규칙. 소개글 AI 추출(comment_)과 시연용 보호소 기록(shelter_)은 없으므로 그 칸은 '모름'으로 남는다.
  const LIKED_KEY = 'pawcus-liked-live', LIKED_MAX_AGE = 6 * 60 * 60 * 1000;
  const TAG_MAP = [['활동량많음', 'activity', 5], ['놀이좋아함', 'activity', 4], ['산책좋아함', 'activity', 4], ['활동량보통', 'activity', 3], ['차분한성격', 'activity', 2],
    ['경계심있음', 'people', 4], ['겁이많음', 'people', 4], ['낯가림있음', 'people', 3], ['사람좋아함', 'people', 1], ['애교많음', 'people', 1],
    ['다른개와거리필요', 'dogs', 5], ['단독가정추천', 'dogs', 4], ['다른개와잘지냄', 'dogs', 1], ['분리불안있음', 'alone', 4],
    ['교육필요', 'training', 4], ['배변교육중', 'training', 4], ['산책가능', 'training', 2], ['배변교육완료', 'training', 2]];   // 코랩_매칭엔진 data/config/tag_map.csv
  const REGION = {'서울특별시': '서울', '경기도': '경기', '강원특별자치도': '강원', '강원도': '강원', '제주특별자치도': '제주', '경상남도': '경남', '경상북도': '경북', '전라북도': '전북', '전북특별자치도': '전북',
    '전라남도': '전남', '충청북도': '충북', '충청남도': '충남', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산', '세종특별자치시': '세종'};
  async function readListing(no) {
    const get = p => fetch('https://pawinhand.net/bridge' + p).then(r => r.ok ? r.text() : '').then(t => { try { return t ? JSON.parse(t) : null; } catch { return null; } }).catch(() => null);
    const q = encodeURIComponent(no), [b, it, tg] = await Promise.all([get(`/animal/${q}`), get(`/shelter/animal/${q}`), get(`/animal/tag/${q}`)]);
    if (!b?.notify_number) return {fail: true};
    if (b.species !== '개') return {species: b.species || '다른 동물'};
    const ex = it || {}, txt = v => typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'none' ? v.trim() : '';
    const first = (...v) => v.map(txt).find(Boolean) || '';
    const sh = (b.shelter_name && await get(`/shelter/name?name=${encodeURIComponent(b.shelter_name)}&city=${encodeURIComponent(b.city || '')}&country=${encodeURIComponent(b.country || '')}`)) || {};
    const numOf = s => { const m = String(s || '').match(/(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : null; };
    const ageText = first(b.age, ex.animal_age), y = Number((ageText.match(/(\d{4})/) || [])[1]), now = new Date().getFullYear();
    const age = y && y <= now ? Math.round(Math.max(0.1, now - y) * 10) / 10 : null;
    const weight = first(b.weight, ex.animal_weight), kg = numOf(weight);
    const tags = (Array.isArray(tg) ? tg : []).map(t => (t?.tag_name || '').trim()).filter(Boolean).join(' | ');
    let breed = txt(b.s_breeds) || txt(b.breeds).replace('[개]', '').trim();
    if (breed.includes('믹스') || !breed) breed = age !== null && age < 1 ? '믹스(자견)' : (kg || 0) < 10 ? '믹스(소형)' : (kg || 0) < 25 ? '믹스(중형)' : '믹스(대형)';
    else breed = breed.replace(/ /g, '');
    const bar = v => { const n = Number(v); return v === null || v === undefined || v === '' || Number.isNaN(n) ? null : n; };
    const inv = v => bar(v) === null ? null : 6 - bar(v);
    const dog = {dog_id: no, name: first(ex.animal_name, b.animal_name) || no, region: REGION[b.city] || b.city || '', kg, age_years: age, breed,
      notice_activity: bar(ex.activity), notice_people: inv(ex.aggression), notice_dogs: inv(ex.sociability), notice_cost: inv(ex.health_state),
      notice_alone: null, notice_barking: null, notice_shedding: null, notice_training: null, tags, source: '포인핸드 공고(담은 아이 비교 때 읽음)',
      text_personality: txt(ex.personality_comment) || null, text_feature: txt(b.feature) || null, text_medical: txt(ex.medical_comment) || null};
    if (ex.heartworm === '양성') dog.notice_cost = Math.max(dog.notice_cost ?? 4, 4);
    const hit = {};   // 태그 우선: 지표마다 맞는 태그 값 중 큰 값으로 막대 값을 덮어쓴다(03 8장과 같음)
    for (const [word, ind, v] of TAG_MAP) if (tags.includes(word)) hit[ind] = Math.max(hit[ind] ?? 0, v);
    for (const [ind, v] of Object.entries(hit)) dog['notice_' + ind] = v;
    const IMG = 'https://d12l2mexpetzlh.cloudfront.net/images/';
    const imgs = [...new Set([ex.animal_image, b.image, b.image2, b.image3, ...[1, 2, 3, 4].map(k => ex[`more_image${k}`] ? IMG + 'shelter/' + ex[`more_image${k}`] : null)].filter(Boolean))];
    const sex = first(b.sex, ex.animal_sex), neutered = first(b.neutral, ex.animal_neutral);
    const info = {shelter_name: b.shelter_name, shelter_tel: b.shelter_tel, shelter_address: b.shelter_address, adoption_process: txt(sh.adoption_process) || null,
      adoption_condition: txt(sh.adoption_condition) || null, adoption_charge: txt(sh.adoption_charge) || null, adoption_support: ex.adoption_support ?? null,
      page_url: 'https://pawinhand.kr/shelter/animal/detail/' + q, personality_comment: txt(ex.personality_comment) || null, sex, neutered, image_urls: imgs.join(' | ')};
    const display = {name: first(ex.animal_name, b.animal_name), breeds: b.breeds, sex, neutered, age_text: ageText, weight_text: weight, city: b.city, country: b.country, tags,
      state: b.state, notice_start: b.notify_sdt, notice_end: b.notify_edt, adoption_support: ex.adoption_support ?? null, medical_comment: txt(ex.medical_comment) || null,
      feature: txt(b.feature) || null, personality_comment: txt(ex.personality_comment) || null};
    const clean = v => ['미입력', 'nan', 'None'].includes(txt(v)) ? '' : txt(v);
    const hp = {tests: Object.fromEntries(['parvo', 'corona', 'heartworm', 'measles'].map(k => [k, clean(ex[k]) || '기록 없음'])), medical_comment: clean(ex.medical_comment), neutered: clean(neutered),
      adoption_support_detail: clean(ex.adoption_support_detail), notice_start: clean(b.notify_sdt), notice_end: clean(b.notify_edt), state: clean(b.state)};
    return {dog, info, display, health: hp};
  }
  // 담은 아이 중 엔진에 없는 아이를 읽어 넣는다. 결과: {cats: [강아지가 아닌 아이], failed: [못 읽은 아이]}
  async function addLikedDogs(likes) {
    const out = {other: [], failed: []}, missing = likes.filter(a => !inData(a.id));
    if (!missing.length || !matchingEngine) return out;
    let cache = {}; try { cache = (await chrome.storage.local.get(LIKED_KEY))[LIKED_KEY] || {}; } catch {}
    for (const a of missing) {
      let r = cache[a.id] && Date.now() - cache[a.id].at < LIKED_MAX_AGE ? cache[a.id].r : null;
      if (!r) { r = await readListing(a.id); if (r.dog) cache[a.id] = {at: Date.now(), r}; }
      if (r.species) { out.other.push({a, species: r.species}); continue; }
      if (!r.dog) { out.failed.push(a); continue; }
      if (!r.display.name && a.name) r = {...r, display: {...r.display, name: a.name}};   // 공고에 이름 칸이 없으면 담을 때 화면에서 읽은 이름
      matchingEngine.dogs.push(r.dog); matchingEngine.info[a.id] = r.info; matchingEngine.display[a.id] = r.display;
      if (engineData.info !== matchingEngine.info) engineData.info = {...engineData.info, [a.id]: r.info};
      if (engineData.display !== matchingEngine.display) engineData.display = {...engineData.display, [a.id]: r.display};
      health.dogs = {...(health.dogs || {}), [a.id]: r.health};
    }
    for (const k of Object.keys(cache)) if (Date.now() - cache[k].at >= LIKED_MAX_AGE || !likes.some(a => a.id === k)) delete cache[k];
    try { await chrome.storage.local.set({[LIKED_KEY]: cache}); } catch {}
    return out;
  }
  function heartsHtml(data) {
    const likes = data.likes;
    const list = likes.length ? `<div class="pc-hearts">${likes.map(a => `<article><img src="${esc(likedPhoto(a))}" alt=""><div><b>${esc(likedName(a))}</b><small>${esc(inData(a.id) ? dogFacts(a.id) + ' · ' + (a.id.split('-')[0] || '') : (a.headline || '').slice(0, 40))}</small></div><button class="pc-remove" data-remove-like="${esc(a.id)}">목록에서 빼기</button></article>`).join('')}</div>` : '';
    const action = !likes.length ? '' : canCompare(data.profile)
      ? `<button class="pc-main" data-go="heartsResult">담은 ${likes.length}마리 비교</button>`
      : `<p class="pc-small pc-center">생활 질문에 답하면 담은 아이들의 차이를 보여 드려요.</p><button class="pc-main" data-hearts-start>생활 질문 답하기</button>`;
    const more = likes.length && likes.length < MAX_LIKES ? `<p class="dx-hint">공고 사진의 ♡로 ${MAX_LIKES - likes.length}마리 더 담을 수 있어요.</p>` : '';
    const toRec = `<button class="pc-textbtn" data-go="${profileDone(data.profile) ? 'results' : 'intro'}">추천받은 아이 보기</button>`;
    return `<main class="pc-body pc-app pc-hearts-screen"><div class="ap-head"><div><h2 class="pc-h">담은 아이${likes.length ? ` <span class="pc-h-count">${likes.length}/${MAX_LIKES}</span>` : ''}</h2></div></div>
      ${list ? list + more + action + (likes.length < MAX_LIKES ? toRec : '')
        : `<div class="ap-empty ap-empty-sm">${pic('dog', 72)}${pic('cat', 56)}<p class="pc-text">공고 사진의 ♡를 눌러 담아 보세요.</p><button class="pc-main" data-go="${profileDone(data.profile) ? 'results' : 'intro'}">추천받은 아이 보기</button></div>`}</main>`;
  }
  // 항목별 상태: 부담 > 꼭 확인 > 맞음 > 모름 (엔진 결과 그대로)
  function rowState(res, ind) {
    const r = [...res.rows, ...(res.checks || [])].find(x => x.ind === ind);
    if (!r) return null;
    if (ind === 'size') { const f = (res.filter || [])[0]; return !f ? ['unknown', '–'] : f.filter === '맞음' ? ['ok', '✓'] : f.filter === '모름' ? ['must', '?'] : ['must', '차이']; }
    if (res.burden.includes(r)) return ['burden', '부담'];
    if (res.must.includes(r)) return ['must', '?'];
    if (r.gap !== null && r.gap !== undefined) return ['ok', '✓'];
    return ['unknown', '–'];
  }
  async function heartsResultHtml(data) {
    if (!canCompare(data.profile)) return heartsHtml(data);   // [2026-10-14 사용자] 추천이 나오면(강아지 선택) 담은 아이 비교도 나오게 — 전에는 15개를 다 답해야 해서 추천은 뜨는데 비교만 막혔음
    const person = pawcusApi.personOf(eng(data.profile));
    const extra = await addLikedDogs(data.likes);
    const known = [], unknown = [];
    for (const a of data.likes) {
      if (!inData(a.id)) { unknown.push(a); continue; }
      const res = matchingEngine.checkOne(a.id, person), card = await pawcusApi.cardFor(a.id, eng(data.profile));
      res.verdict = card.verdict;
      known.push({a, res, card, key: matchingEngine.rankKey(res, a.id)});
    }
    known.sort((x, y) => { for (let i = 0; i < x.key.length; i++) { if (x.key[i] < y.key[i]) return -1; if (x.key[i] > y.key[i]) return 1; } return 0; });
    // 비교하지 못한 아이는 이유를 그대로 알린다(강아지가 아님 / 공고를 읽지 못함)
    const skipped = [...extra.other.map(x => `${likedName(x.a)}: ${x.species} 공고라 아직 비교할 수 없어요(지금은 강아지만 비교해요).`),
      ...extra.failed.map(a => `${likedName(a)}: 포인핸드에서 공고를 읽지 못했어요. 공고가 끝났거나 연결이 잠시 안 될 수 있어요.`)];
    const skippedHtml = skipped.length ? `<ul class="pc-concerns pc-skipped">${skipped.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '';
    if (!known.length) return `<main class="pc-body pc-app"><h2 class="pc-h">나와 더 잘 맞는 아이</h2><div class="ap-empty">${pic('magnifier', 110)}<p class="pc-text">담은 아이를 비교하지 못했어요.</p>${skippedHtml}</div><button class="pc-sub" data-go="hearts">마음에 담은 아이로</button></main>`;
    const nm = x => likedName(x.a);
    const concern = x => {
      const b = x.res.burden.find(r => r.source !== 'followup'), m = x.res.must[0];
      if (b) return `${josa(script.knowledge[b.ind]?.title || b.name, '이', '가')} 부담이 될 수 있어요`;
      if (m) return `${josa(script.knowledge[m.ind]?.title || m.name, '은', '는')} 보호소에 꼭 물어봐야 해요`;
      return '';
    };
    const top = known[0], same = known.length > 1 && known.every(x => x.res.verdict === top.res.verdict && x.res.burden.length === top.res.burden.length && x.res.must.length === top.res.must.length);
    const firstReason = x => reasonSentences(x.res, data.profile)[0]?.text || '';
    // 이름은 사랑스럽게 강조하고, 같은 걱정을 가진 아이끼리 한 문장으로 묶는다
    const nameTag = s => `<b class="pc-name">${esc(s)}</b>`;
    const nameList = xs => xs.map(x => nameTag(nm(x))).join(', ');
    const subj = (xs, a, b) => { const last = nm(xs[xs.length - 1]); return nameList(xs) + esc(josa(last, a, b).slice(last.length)); };
    let summary = known.length === 1 ? `${nameTag(nm(top))}의 결과예요. ${esc(firstReason(top))}`
      : same ? `담은 아이들이 내 생활과 비슷하게 맞아요. 아래 표에서 차이를 보고 정해 보세요.`
      : top.res.verdict === '부담 있음' ? `담은 아이들 모두 내 생활과 맞지 않는 부분이 있어요. 그중에서는 ${subj([top], '이', '가')} 부담이 가장 적어요.`
      : `담은 아이들 중에서는 ${subj([top], '이', '가')} 내 생활과 가장 잘 맞아요.`;
    const groups = new Map();
    for (const x of known.slice(top.res.verdict === '부담 있음' ? 0 : 1)) { const c = concern(x); if (c) groups.set(c, [...(groups.get(c) || []), x]); }
    const others = [...groups].map(([c, xs]) => xs.length === known.length && xs.length > 1 ? `${xs.length === 2 ? '두' : '세'} 아이 모두 ${esc(c)}.` : `${subj(xs, '은', '는')} ${esc(c)}.`);    const rank = known.map((x, i) => {
      const [tone, label] = VERDICT_VIEW[x.res.verdict] || ['unknown', x.res.verdict];
      const shared = known.length > 1 && known.every(y => concern(y) === concern(x));
      const line = (!shared && concern(x)) || firstReason(x) || concern(x);
      // 추천 결과와 같은 카드(사진·이름·짧은 이유·하루 리허설), 사진·이름을 누르면 자세히
      return dogCardHtml(x.a.id, x.res, {...x.card, photo: x.card.photo || likedPhoto(x.a)}, data.profile, `data-heart-dog="${esc(x.a.id)}"`);
    }).join('');
    const inds = engineData.order || ['alone', 'activity', 'barking', 'shedding', 'dogs', 'people', 'size', 'cost', 'training'];
    const checkInds = [...new Set(known.flatMap(x => (x.res.checks || []).map(r => r.ind)))];
    const label = ind => ({alone: '혼자 있기', activity: '활동량', barking: '짖음', shedding: '털 빠짐', dogs: '다른 개', people: '사람·손님', size: '크기', cost: '비용·건강', training: '기본 훈련', allergy: '알레르기', kids: '아이', cats: '고양이'})[ind] || ind;
    const healthCell = id => { const t = health.dogs?.[id]?.tests || {}, v = Object.values(t); return v.includes('양성') ? ['burden', '양성'] : v.length && v.every(x => x === '음성') ? ['ok', '✓'] : ['unknown', '–']; };
    const WORD = {ok: '맞음', burden: '차이 있음', must: '확인 필요', unknown: '정보 없음'};   // 세 마리가 한 화면에 들어가게 짧게
    const HWORD = {ok: '모두 음성', burden: '양성 있음', unknown: '기록 부족', must: '확인 필요'};
    const rows = [...inds, ...checkInds].filter(ind => ind !== 'size' || (data.profile.Q_SIZE && !['상관없음', '건너뜀'].includes(data.profile.Q_SIZE))).map(ind => ({label: label(ind), st: known.map(x => (rowState(x.res, ind) || ['unknown'])[0])}))
      .concat([{label: '건강 검사', st: known.map(x => healthCell(x.a.id)[0]), health: true}]);
    const diff = rows.filter(r => new Set(r.st).size > 1), sameRows = rows.filter(r => new Set(r.st).size === 1);
    const cell = (r, st) => `<td><span class="pc-st pc-${st}">${esc(r.health ? HWORD[st] : WORD[st])}</span></td>`;
    const tr = (r, cls = '') => `<tr class="${cls}"><th scope="row">${esc(r.label)}</th>${r.st.map(st => cell(r, st)).join('')}</tr>`;
    const table = known.length > 1 ? `<section class="pc-box pc-cmp-box"><h3>아이마다 다른 점 <small>지금 입력한 생활 조건 기준</small></h3>
      <div class="pc-cmp-wrap"><table class="pc-cmp"><thead><tr><th></th>${known.map(x => `<th scope="col"><img src="${esc(likedPhoto(x.a))}" alt=""><span>${esc(nm(x))}</span></th>`).join('')}</tr></thead>
      <tbody>${diff.length ? `<tr class="pc-cmp-sec"><td colspan="${known.length + 1}"><span class="pc-cmp-sec-t">차이가 있는 항목</span></td></tr>${diff.map(r => tr(r)).join('')}` : ''}
      ${sameRows.length ? `<tr class="pc-cmp-sec"><td colspan="${known.length + 1}"><span class="pc-cmp-sec-t">같은 항목</span></td></tr>${sameRows.map(r => tr(r, 'pc-cmp-same')).join('')}` : ''}</tbody></table></div></section>` : '';
    const left = '';
    // [팀원요청 1014] 담은 아이 비교 배치(team_ui.js): 가장 잘 맞는 아이 크게 → 하트 줄 → 이름을 누르면 그 아이만 원형 차트·항목 목록 → '아이별 자세히' 버튼. 파일이 없으면 아래 기존 화면
    if (globalThis.PawcusTeam?.heartsCompareHtml) return PawcusTeam.heartsCompareHtml({
      count: known.length, summary, others, skippedHtml, rankHtml: rank, same, topBurden: top.res.verdict === '부담 있음',
      dogs: known.map(x => {
        const [tone, vlabel] = VERDICT_VIEW[x.res.verdict] || ['unknown', x.res.verdict], items = considerItems(x.res, x.card, data.profile), ok = reasonSentences(x.res, data.profile);
        return {id: x.a.id, name: nm(x), url: x.a.url || engineData.info?.[x.a.id]?.page_url || `https://pawinhand.kr/shelter/animal/detail/${encodeURIComponent(x.a.id)}`, photo: https(x.card.photo) || likedPhoto(x.a), facts: dogFacts(x.a.id), tone, vlabel, fit: fitOf(x.res), why: ok[0]?.short || '',
          ok, must: items.filter(i => i.tone === 'must'), burden: items.filter(i => i.tone === 'burden'), unknown: x.res.unknown.filter(r => !x.res.must.includes(r) && r.dog === null).map(r => r.name)};
      })}, {esc, pic});
    return `<main class="pc-body pc-app pc-hres"><div class="ap-head"><div><h2 class="pc-h">담은 아이 비교 <span class="pc-h-count">${known.length}마리</span></h2></div><button class="pc-link" data-go="hearts">담은 아이 바꾸기</button></div>
      <p class="pc-why-rh">${summary}</p>${others.length ? `<ul class="pc-concerns">${others.map(o => `<li>${o}</li>`).join('')}</ul>` : ''}
      ${table}${left}${skippedHtml}
      <div class="dx-hrow"><h3 class="dx-h">아이별 자세히</h3><small class="dx-note">지금 생활 조건 기준 순서</small></div><div class="mc-list">${rank}</div>
      <button class="pc-textbtn" data-go="results">추천받은 아이 보기</button></main>`;
  }
  async function heartDogHtml(data) {
    const id = view.id; if (!id || !inData(id)) return heartsHtml(data);
    const person = pawcusApi.personOf(eng(data.profile)), res = matchingEngine.checkOne(id, person), card = await pawcusApi.cardFor(id, eng(data.profile));
    return `<main class="pc-body pc-app pc-result">${dogDetailHtml(card, res, data)}<button class="pc-textbtn" data-go="heartsResult">담은 아이 비교로 돌아가기</button></main>`;
  }

  // ───────── 이벤트 ─────────
  function bind() {
    const $ = s => root.querySelector(s), $$ = s => root.querySelectorAll(s);
    $('[data-action="close"]')?.addEventListener('click', () => { root.innerHTML = ''; applyUi(); });
    const sizeIcons = () => { const a = $('[data-action="size"]'), c = $('[data-action="center"]'); if (a) { a.textContent = ui.side ? '⇤' : '⇥'; a.title = ui.side ? '버튼 옆 창으로' : '오른쪽에 붙이기'; } if (c) { c.textContent = ui.center ? '⤡' : '⤢'; c.title = ui.center ? '작은 창으로' : '크게 보기 (가운데)'; } };
    $('[data-action="size"]')?.addEventListener('click', () => { ui.side = !ui.side; if (ui.side) ui.center = false; applyUi(); saveUi(); sizeIcons(); });
    $('[data-action="center"]')?.addEventListener('click', () => { ui.center = !ui.center; if (ui.center) ui.side = false; applyUi(); saveUi(); sizeIcons(); });
    bindGrips(); applyUi();
    globalThis.PawcusTeam?.bind?.(root);   // [팀원요청 1014] 담은 아이 비교: 아이 고르기·아이별 자세히 펼치기
    $$('[data-cond-id]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.condId; await store.update(d => { d.profile[id] = b.dataset.answer; }); lastRec = null;
      b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      const v = root.querySelector(`[data-cond-val="${id}"]`); if (v) v.textContent = answerLabel(id, b.dataset.answer);
      b.parentElement.hidden = true; b.closest('.pc-cond-row')?.querySelector('.pc-cond-head')?.classList.remove('open');
      b.closest('.pc-cond-row')?.classList.add('changed');
    }));
    $('[data-cond-done]')?.addEventListener('click', () => go('loading'));
    $$('[data-cond-reset]').forEach(rb => rb.addEventListener('click', async () => {
      if (!(await askConfirm('처음부터 다시 할까요?', '생활 조건 답을 모두 지우고 처음부터 다시 해요. 마음에 담은 아이는 그대로 남아요.', '처음부터 다시 하기'))) return;
      await freshProfile('개'); afterQuestions = ''; go('question', {page: 0});
    }));
    // 팀원 의견 10(2026-10-13): 처음 시작은 어디서 누르든 같은 정도로 비운다(이전 답·'불러왔어요' 표시·지난 추천 모두)
    async function freshProfile(species) { await store.update(d => { d.profile = {species}; }); lastRec = null; answeredNow.clear(); rh = null; await clearRh(); }   // 저장된 리허설 대화도 비운다
    $$('[data-go]').forEach(b => (b.dataset.bound = 1) && b.addEventListener('click', e => { e.preventDefault(); const to = b.dataset.go; go(to, {from: view.name, tab: view.tab, keep: to === 'results' && Boolean(lastRec), id: view.id}); }));
    $$('[data-action="start"]').forEach(b => b.addEventListener('click', () => go('species', {from: 'intro'})));
    $$('[data-hm-continue]').forEach(b => b.addEventListener('click', async () => { const data = await store.get(); go('question', {page: Math.max(0, PAGES.findIndex(p => p.ids.some(id => !data.profile[id])))}); }));   // 답을 지우지 않고 안 한 질문부터
    $$('[data-species]').forEach(b => b.addEventListener('click', async () => {
      if (view.from === 'intro') await freshProfile(b.dataset.species);   // 홈에서 새로 시작 → 처음부터. 질문 1쪽에서 ←로 돌아온 경우는 답 유지
      else await store.update(d => { d.profile.species = b.dataset.species; });
      if (b.dataset.species === '개') go('question', {page: 0}); else go('cat');
    }));
    $$('[data-answer-id]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.answerId; answeredNow.add(id); const data = await store.update(d => { d.profile[id] = b.dataset.answer; });
      const q = b.closest('.pc-q'); q.querySelectorAll('[data-answer-id]').forEach(x => x.classList.toggle('on', x === b));
      if (view.name !== 'question') return;
      const ids = PAGES[view.page || 0].ids, after = ids.slice(ids.indexOf(id) + 1).concat(ids.slice(0, ids.indexOf(id)));
      const next = after.find(x => !data.profile[x]) || null;
      await wait(180);
      await go('question', {page: view.page || 0, openQ: next || '__none'});
      const target = root.querySelector(next ? `#pc-q-${next}` : '.pc-nav-sticky');
      target?.scrollIntoView({block: next ? 'center' : 'end', behavior: 'smooth'});
    }));
    $$('[data-reopen]').forEach(b => b.addEventListener('click', async () => { const id = b.dataset.reopen; await go('question', {page: view.page || 0, openQ: id}); root.querySelector(`#pc-q-${id}`)?.scrollIntoView({block: 'center'}); }));
    $$('[data-tip]').forEach(b => b.addEventListener('click', () => { const p = root.querySelector(`[data-why="${b.dataset.tip}"]`); if (p) p.hidden = !p.hidden; }));
    $$('[data-jump]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.jump; go('question', {page: PAGES.findIndex(p => p.ids.includes(id)), openQ: id}).then(() => root.querySelector(`#pc-q-${id}`)?.scrollIntoView({block: 'center'})); }));
    $$('[data-page]').forEach(b => b.addEventListener('click', () => { const p = b.dataset.page; if (p === 'done') { const to = afterQuestions; afterQuestions = ''; go(to || 'loading'); } else go('question', {page: Number(p)}); }));
    $('[data-hearts-start]')?.addEventListener('click', async () => { afterQuestions = 'heartsResult'; const data = await store.update(d => { d.profile.species = '개'; }); go('question', {page: Math.max(0, PAGES.findIndex(p => p.ids.some(id => !data.profile[id])))}); });
    $$('[data-heart-dog]').forEach(b => b.addEventListener('click', () => go('heartDog', {id: b.dataset.heartDog})));
    $$('[data-tab]').forEach(b => b.addEventListener('click', () => go('resultDog', {tab: Number(b.dataset.tab), keep: true})));
    $$('[data-detail]').forEach(b => b.addEventListener('click', () => go('resultDog', {tab: Number(b.dataset.detail), keep: true})));
    $$('[data-open]').forEach(b => b.addEventListener('click', () => { const p = root.querySelector(`[data-panel="${b.dataset.open}"]`); if (p) { p.hidden = !p.hidden; b.classList.toggle('open', !p.hidden); } }));
    // 숨겨진 정보(판단 근거·왜 물어보나요·주의 안내): 누르면 가운데 창(필라이즈 리뷰 작성 Tip 참고)
    $$('[data-pop-title]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const body = b.dataset.pop ? root.querySelector(`[data-panel="${b.dataset.pop}"]`)?.innerHTML || '' : `<p>${esc(b.dataset.popBody || '')}</p>`;
      showPop(b.dataset.popTitle, body);
    }));
    $$('[data-rehearse]').forEach(b => b.addEventListener('click', async () => {
      const data = await store.get(), id = b.dataset.rehearse;
      const card = lastRec?.rec.cards.find(c => c.dog_id === id) || await pawcusApi.cardFor(id, eng(data.profile));
      await openRehearsal(id, data.profile, card); lastDrawn = ''; go('rehearsal', {tab: view.tab, back: view.name, id: view.id});
    }));
    $$('[data-like-id]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.likeId; let exists = false, full = false;
      await store.update(data => {
        exists = data.likes.some(x => x.id === id);
        if (exists) data.likes = data.likes.filter(x => x.id !== id);
        else if (data.likes.length >= MAX_LIKES) { full = true; return false; }
        else { const info = engineData.info?.[id] || {}; data.likes.push({id, url: info.page_url || `https://pawinhand.kr/shelter/animal/detail/${encodeURIComponent(id)}`, species: '개', name: dogName(id) === '이 아이' ? '' : dogName(id), headline: dogFacts(id), shelter: info.shelter_name || '', phone: info.shelter_tel || '', photo: String(info.image_urls || '').split('|')[0].trim(), area: id.split('-').slice(0, 2).join('-')}); }
      });
      if (full) { alert(`마음에 담은 아이는 최대 ${MAX_LIKES}마리까지예요. 먼저 한 마리를 빼 주세요.`); return; }
      await syncHeartButtons(); b.classList.toggle('on', !exists); b.textContent = b.dataset.label ? (exists ? '♡ 담기' : '♥ 담았어요') : exists ? '♡' : '♥';
    }));
    $$('[data-remove-like]').forEach(b => b.addEventListener('click', async () => { await store.update(data => { data.likes = data.likes.filter(a => a.id !== b.dataset.removeLike); }); await syncHeartButtons(); draw(); }));
    if (view.name === 'rehearsal') bindChips();
    root.querySelectorAll('.pc-rh-done [data-go]').forEach(b => b.dataset.bound = 1);
    $('[data-rh-start]')?.addEventListener('click', () => { rh.started = true; lastDrawn = ''; draw(); });
    $$('[data-rh-resume], [data-rh-ask]').forEach(b => b.addEventListener('click', async () => {   // '리허설' 탭: 이어서 하기 / 문의하기
      const data = await store.get(), id = b.dataset.rhResume || b.dataset.rhAsk, ask = Boolean(b.dataset.rhAsk);
      let card = null; try { card = lastRec?.rec.cards.find(c => c.dog_id === id) || await pawcusApi.cardFor(id, eng(data.profile)); } catch {}
      try { await openRehearsal(id, data.profile, card, {force: ask}); } catch { alert('이 아이의 공고 정보를 지금 데이터에서 찾지 못했어요.'); return; }
      rh.showDone = ask; if (!ask && rh.restored) rh.started = true;
      lastDrawn = ''; go('rehearsal', {back: 'rehearsals', id});
    }));
    $$('[data-rh-restart]').forEach(b => b.addEventListener('click', async () => {   // 이 아이 리허설을 처음부터(저장된 대화 지움)
      if (!confirm('이 아이와의 리허설을 처음부터 다시 할까요? 지금까지의 대화와 고른 계획이 지워져요.')) return;
      await clearRh(rh.id); buildRehearsal(rh.id, rh.profile, rh.card); lastDrawn = ''; draw();
    }));
    $$('[data-rh-mode]').forEach(b => b.addEventListener('click', () => {
      if (rh.mode === b.dataset.rhMode) return;
      if (rh.paused && b.dataset.rhMode === 'card') { rh.paused = false; nextScene(); }   // 카드 보기는 장면 카드의 '다음 장면' 버튼으로 넘어간다
      rh.mode = b.dataset.rhMode; rh.shown = rh.log.length; rh.busy = false;
      const lastOpt = rh.log.map((x, i) => x.options && !x.pendingAsk ? i : -1).reduce((a, c) => Math.max(a, c), -1);
      rh.activeChips = rh.waiting && lastOpt >= 0 ? [lastOpt] : rh.finished && lastOpt >= 0 ? [lastOpt] : [];
      lastDrawn = ''; draw();
    }));
    $('[data-rh-next]')?.addEventListener('click', () => { if (rh.finished && (rh.ack || !rh.lastSettled || rh.lastSettled.idx === rh.scenes.length - 1)) rh.showDone = true; rh.ack = true; lastDrawn = ''; draw(); });
    const form = $('.pc-compose:not(.pc-compose-in)');   // 대화 말풍선 안 입력칸은 bindChips가 맡는다
    form?.addEventListener('submit', e => { e.preventDefault(); const ta = form.querySelector('textarea'), msg = ta.value; ta.value = ''; onUserText(msg); });
    form?.querySelector('textarea')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
    $('[data-ai-save]')?.addEventListener('click', async () => { const k = $('[data-ai-key]').value.trim(); if (!k) return; await aiStore.set({key: k}); draw(); });
    $('[data-ai-del]')?.addEventListener('click', async () => { await aiStore.set({}); draw(); });
    $('[data-ai-test]')?.addEventListener('click', () => {
      const out = $('[data-ai-result]'); out.textContent = '확인 중…';
      chrome.runtime.sendMessage({type: 'pawcus-ai', system: 'JSON으로만 답한다.', prompt: '{"ok": true} 를 그대로 돌려줘'}, r => {
        if (chrome.runtime.lastError || !r) out.textContent = '확장 프로그램 배경 작업에 연결하지 못했어요. 확장 프로그램을 새로고침해 주세요.';
        else if (r.ok) out.textContent = `연결됐어요 · 모델 ${r.model}`;
        else out.textContent = {'no-key': '키가 저장되지 않았어요.', limit: '무료 한도에 걸렸어요. 잠시 뒤 다시 해 보세요.'}[r.reason] || `연결 실패: ${r.detail || ''}`;
      });
    });
  }

  fab.onclick = async () => {
    await ready();
    const data = await store.get();
    if (root.innerHTML) { root.innerHTML = ''; applyUi(); return; }
    go('intro');   // [2026-10-14 사용자 요청] '포커스' 버튼을 누르면 항상 홈 화면부터(전에는 답이 다 있으면 추천, 덜 있으면 질문으로 바로 갔음)
  };
  // '질문을 알아듣지 못했어요' 말풍선의 예시 질문을 누르면 그 질문을 보낸 것처럼 답한다
  root.addEventListener('click', e => { const b = e.target.closest?.('[data-ex-q]'); if (b && rh) { e.preventDefault(); onUserText(b.dataset.exQ); } });
  // 입력칸이 비어 있을 때 Tab을 누르면 보이는 예시 문장이 그대로 들어간다
  root.addEventListener('keydown', e => {
    const ta = e.target;
    if (e.key !== 'Tab' || e.shiftKey || ta?.tagName !== 'TEXTAREA' || ta.value.trim() || !ta.placeholder) return;
    e.preventDefault(); ta.value = ta.placeholder.replace(/^예\s*[:：]\s*/, '');
  });
  // 누를 때 강아지·고양이 발바닥이 톡 나타났다 사라진다
  let pawFlip = false;
  root.addEventListener('pointerdown', e => {
    if (calm() || !e.isPrimary) return;
    pawFlip = !pawFlip;
    const p = document.createElement('span'); p.className = 'pc-paw' + (pawFlip ? '' : ' pc-paw-cat');
    p.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="27" rx="10" ry="8"/><ellipse cx="9" cy="16" rx="4" ry="5"/><ellipse cx="16" cy="10" rx="4" ry="5"/><ellipse cx="24" cy="10" rx="4" ry="5"/><ellipse cx="31" cy="16" rx="4" ry="5"/></svg>';
    p.style.left = e.clientX + 'px'; p.style.top = e.clientY + 'px'; p.style.setProperty('--r', (Math.random() * 40 - 20) + 'deg');
    document.body.append(p); setTimeout(() => p.remove(), 700);
  }, true);
  // 포인핸드 공고에서 ♡를 누르면(다른 탭 포함) 열린 화면에 바로 반영
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['pawcus-ui']) { Object.assign(ui, changes['pawcus-ui'].newValue || {}); applyUi(); }
    if (!changes[KEY]) return;
    const before = (changes[KEY].oldValue?.likes || []).map(x => x.id).join(), after = (changes[KEY].newValue?.likes || []).map(x => x.id).join();
    if (before === after) return;
    syncHeartButtons();
    if (root.innerHTML && ['hearts', 'heartsResult', 'results', 'heartDog'].includes(view.name)) { if (view.name === 'results') view.keep = Boolean(lastRec); draw(); }
    else if (root.innerHTML && view.name !== 'rehearsal' && root.querySelector('.pc-tabbar')) draw();
  });
  try { chrome.storage.local.get('pawcus-ui', x => { const u = x?.['pawcus-ui'] || {}, v3 = u.v === 3, num = v => typeof v === 'number' ? v : null; ui.side = Boolean(u.side); ui.center = v3 && Boolean(u.center); ui.z = v3 && u.z || 0; ui.bz = v3 && u.bz || 0; ui.x = v3 ? num(u.x) : null; ui.y = v3 ? num(u.y) : null; ui.bx = v3 ? num(u.bx) : null; ui.by = v3 ? num(u.by) : null; ui.sw = u.sw || 0; applyUi(); }); } catch {}
  addEventListener('resize', () => { if (root.innerHTML) applyUi(); });   // 브라우저 창 크기가 바뀌면 다시 맞춤
  installHeart();
  installCardHearts();
  let observationTimer;
  new MutationObserver(() => {
    clearTimeout(observationTimer);
    observationTimer = setTimeout(() => { installHeart(); installCardHearts(); }, 150);
  }).observe(document.documentElement, {childList: true, subtree: true});
})();

