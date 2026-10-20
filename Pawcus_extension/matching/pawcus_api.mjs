// Pawcus 매칭 기능 API — 화면(HTML)은 만들지 않고 데이터만 돌려준다. 화면은 UI 담당(팀원)이 자유롭게 그린다.
// 규칙은 매칭엔진 Python(src/matching_core.py · src/enrichment.py)과 같다.
//   - 추천·판정: core.mjs (Python과 1,405개 항목 대조 일치, 10/07)
//   - 고려해야 할 사항·후속 질문·더 알아보기: dog_enrichment.json (노트북 10 enrichment.export_json 결과)
// 후속 질문 답 규칙: '모자란 단계' 1 → 확인 필요, 2 → 부담 있음, 비움('잘 모르겠어요')·답 없음 → 그대로. 점수는 바꾸지 않는다.
//
// 사용 예(확장 프로그램 content script):
//   const api = await import(chrome.runtime.getURL('matching/pawcus_api.mjs'));
//   const {cards} = await api.recommendCards(profile);           // profile = 확장 저장소의 data.profile
//   const card = await api.cardFor('경기-가평-2026-00034', profile); // 113마리 밖이면 null
//   profile = api.withFollowupAnswer(profile, card.dog_id, 'ANAPLASMA', '조금 어려워요');  // 저장 후 cardFor 다시 호출
import * as core from './core.mjs';

export const ANY_REGION = '상관없음(전국)';
export const VERDICTS = ['잘 맞음', '맞을 가능성 · 확인 필요', '부담 있음', '판단 불가'];
export const LEVELS = ['부담', '꼭 확인', '고려', '수용 의사 확인', '참고'];   // considerations[].level ('확인함' → '수용 의사 확인', 2026-10-10)
const collectedDate = s => { const m = String(s || '').match(/^(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };

let enrichPromise = null;
/** dog_enrichment.json 불러오기. 다른 위치(웹사이트 등)에서 쓰면 setEnrichment(json)으로 직접 넣는다. */
export function loadEnrichment(url = new URL('./dog_enrichment.json', import.meta.url)) {
  return enrichPromise ??= fetch(url).then(r => r.json()).catch(() => ({dogs: {}, followup_rules: {}}));
}
export function setEnrichment(json) { enrichPromise = Promise.resolve(json); }

/** 확장 저장소 profile → 엔진 입력. Q_* = 생활 조건, R_* = 준비 항목, regions = 지역(전국이면 null) */
export function personInput(profile = {}) {
  const answers = {}, readiness = {};
  for (const [id, v] of Object.entries(profile)) {
    if (typeof v !== 'string' || !v) continue;
    if (id.startsWith('Q_')) answers[id] = v; else if (id.startsWith('R_')) readiness[id] = v;
  }
  const regions = profile.regions && profile.regions !== ANY_REGION ? [profile.regions] : null;
  return {answers, readiness, regions};
}
export function personOf(profile) {
  const {answers, readiness, regions} = personInput(profile);
  return core.scorePerson(answers, readiness, regions);
}

function followupsFor(en, dogId) {
  return (en.dogs[dogId] || []).filter(t => en.followup_rules[t.topic_id])
    .map(t => ({...en.followup_rules[t.topic_id], topic_id: t.topic_id, evidence: t.evidence}));
}
function applyFollowups(res, en, answers = {}) {
  const r = {...res, burden: [...res.burden], followupAnswers: answers};
  for (const f of followupsFor(en, res.dog.dog_id)) {
    const steps = (f.options.find(o => o[0] === answers[f.topic_id]) || [])[1];
    if (steps) r.burden.push({ind: 'care:' + f.topic_id, name: f.topic + ' 돌봄', dog: null, source: 'followup', person: null, gap: steps / 4, followup: answers[f.topic_id]});
  }
  r.verdict = core.verdict(r);
  return r;
}

/** 엔진 결과(res) → 카드 데이터. Python enrichment.chat_card 와 같은 칸. */
function toCard(r, en) {
  const lab = core.cfg.label, src = x => lab[x.source] || x.source || '', dogId = r.dog.dog_id, ans = r.followupAnswers || {};
  const d = core.display[dogId] || {}, c = r.card || {}, topics = en.dogs[dogId] || [];
  const reasons = r.good.map(x => `${x.name}: 아이 ${x.dog}단계 · 내가 괜찮은 정도 ${x.person}단계 (${src(x)})`)
    .concat((r.filter || []).filter(x => x.filter === '맞음').map(x => `${x.name}: 원하는 조건과 맞음`));
  const cons = [];
  for (const x of r.burden) cons.push({level: '부담', text: x.source === 'followup' ? `${x.name}: 내 답 '${x.followup}'` : `${x.name}: 아이 ${x.dog}단계인데 내가 괜찮은 정도는 ${x.person}단계예요 (${src(x)})`});
  for (const x of r.must) cons.push({level: '꼭 확인', text: x.check ? `${x.name}: 정보가 없어요 — ${core.CHECKS[x.ind].why}`
    : x.exception ? `${x.name}: 보호소 기록에 예외가 있어요 — ${x.exception}`
    : x.alt_matters ? `${x.name}: 소개글을 두 AI가 ${Math.round(x.dog)}·${Math.round(x.alt)}단계로 다르게 읽었어요(판정이 달라짐)`
    : x.conflict ? `${x.name}: 공고 값과 다른 문장이 있어요 — "${x.conflict.quote}"` : x.dog === null ? `${x.name}: 공고에 정보가 없어요` : `${x.name}: ${src(x)} 값이라 실제와 다를 수 있어요`});
  for (const t of topics) {
    if (t.topic_id === 'BREED') cons.push({level: '참고', text: `견종 경향(${r.dog.breed}): 같은 견종도 개체 차이가 커서 참고만 해요`, topic_id: t.topic_id});
    else if (t.topic_id === 'PUPPY') cons.push({level: '참고', text: '1살 미만이에요: 혼자 있기·기본 훈련을 기준표에서 이미 부담으로 계산했어요', topic_id: t.topic_id});
    else {
      const a = ans[t.topic_id], rule = en.followup_rules[t.topic_id], steps = rule && a ? (rule.options.find(o => o[0] === a) || [])[1] : null;
      // 2026-10-10(평가 의견 4.2): '할 수 있어요'는 입양자 수용 의사만 확인된 것 → 보호소 돌봄 요구·돌봄 계획은 아직 확인 전
      const ok = Boolean(a) && steps === 0;
      cons.push({level: ok ? '수용 의사 확인' : '고려', text: `${t.topic}: 공고 "${t.evidence}"${a ? ` → 내 답 '${a}'` : ''}${ok ? ' · 보호소에 실제 돌봄 내용 확인 필요 · 돌봄 계획 세우기' : ''}`, topic_id: t.topic_id});
    }
  }
  const left = r.unknown.filter(x => !r.must.includes(x)).map(x => x.name);
  if (left.length) cons.push({level: '참고', text: '공고에 정보가 없는 항목: ' + left.join(', ')});
  const shelter = (c.questions || []).map(([t, n, q]) => ({must: t === '꼭', common: t === '공통', topic: n, text: q}));
  for (const t of topics) for (const q of t.shelter_questions) if (!shelter.some(s => s.text.includes(q))) shelter.push({must: false, common: false, topic: t.topic, text: q});
  return {
    dog_id: dogId, name: d.name || dogId,
    photo: String(c.image_urls || '').split('|').map(s => s.trim()).find(Boolean) || null,
    photos: String(c.image_urls || '').split('|').map(s => s.trim()).filter(Boolean),
    url: c.page_url || `https://pawinhand.kr/shelter/animal/detail/${encodeURIComponent(dogId)}`,
    headline: [d.breeds, d.age_text, d.weight_text].filter(Boolean).join(' / '), region: r.dog.region,
    shelter: c.shelter_name || null, tel: c.shelter_tel || null,
    verdict: r.verdict, coverage: r.coverage, score: r.score,
    // 2026-10-10 판정 구조: 생활 적합성 · 정보 충분성 · 꼭 확인을 따로 (판정은 셋을 합친 결과)
    fit: r.fit, info: r.info, must_count: r.must.length,
    reasons, considerations: cons,
    adopter_questions: followupsFor(en, dogId).map(f => ({topic_id: f.topic_id, topic: f.topic, question: f.question, options: f.options.map(o => o[0]), answer: ans[f.topic_id] || null})),
    shelter_questions: shelter,
    learn_more: topics.flatMap(t => t.learn.map(x => ({...x, topic: t.topic}))),
    adoption_process: c.adoption_process || null,
    // 2026-10-10(평가 의견 4.4·5): 결과를 바꾸는 조건 · 근거 범위 · 다음 확인 질문
    what_if: (r.what_if || []).map(w => ({...w, note: '생활 계획이 바뀐다는 가정이에요. 아이의 행동이 확인된 것은 아니에요'})),
    basis: {collected: collectedDate(core.dataSource?.collected), note: '이 날짜에 수집한 공고 기준이에요. 지금 상태는 공고에서 확인해 주세요', url: c.page_url || null},
    next_question: (shelter.find(s => s.must) || shelter.find(s => !s.common) || null),
  };
}

/** 추천 카드 k개. 반환: {cards, pool, groups, flags, unknownSize} — unknownSize=true면 1살 미만 믹스라 다 컸을 때 크기 모름 */
export async function recommendCards(profile = {}, {k = 3} = {}) {
  const en = await loadEnrichment(), person = personOf(profile), fu = profile.followups || {};
  const rec = core.recommend(person, core.dogs, core.info, k);
  const raw = rec.top.length ? rec.top : rec.topUnknownSize;
  const cards = raw.map(r => toCard(applyFollowups(r, en, fu[r.dog.dog_id]), en));
  const flags = [...person.flags], g = rec.groups, total = Object.values(g).reduce((a, b) => a + b, 0);
  // 2026-10-10: '부담 있음'·'판단 불가'로 3마리를 채우지 않는다 → 후보가 없거나 적으면 그대로 알린다
  if (!cards.length) {
    if (!rec.pool) flags.unshift('선택한 지역에 수집된 강아지가 없어요. 지역을 바꿔 보세요');
    else if (!total) flags.unshift(rec.excludedBySize ? `원하는 크기와 맞는 강아지가 없어요(같은 지역 ${rec.pool}마리 중 크기 때문에 뺀 ${rec.excludedBySize}마리). 원하는 크기나 지역을 바꿔 보세요`
                                                       : '비교할 수 있는 강아지가 없어요. 지역이나 원하는 크기를 바꿔 보세요');
    else if (total && g['판단 불가'] === total) flags.unshift('생활 조건 답이 거의 없어 비교할 수 없어요 → 질문에 답해 주세요');
    else flags.unshift(`지금 조건으로 추천할 수 있는 후보가 없어요(비교한 ${total}마리 중 부담 있음 ${g['부담 있음'] || 0}마리). 입력 정보 수정에서 조건을 다시 살펴봐 주세요`);
  } else if (cards.length < k) flags.unshift(`조건에 맞는 후보가 ${cards.length}마리라 ${cards.length}마리만 보여 드려요`);
  return {cards, pool: rec.pool, groups: g, flags, nReady: rec.nReady, nCheck: rec.nCheck,
          unknownSize: !rec.top.length && rec.topUnknownSize.length > 0, dataNote: '10/02 수집 강아지 113마리 기준'};
}

/** 공고 한 건의 카드. 매칭 데이터(113마리)에 없으면 null. */
export async function cardFor(dogId, profile = {}) {
  if (!core.dogs.some(d => d.dog_id === dogId)) return null;
  const en = await loadEnrichment(), fu = profile.followups || {};
  return toCard(applyFollowups(core.checkOne(dogId, personOf(profile)), en, fu[dogId]), en);
}

/** 후속 질문 답을 넣은 새 profile(원본은 바꾸지 않음). 저장은 호출하는 쪽이 한다. */
export function withFollowupAnswer(profile, dogId, topicId, label) {
  const followups = {...(profile.followups || {})};
  followups[dogId] = {...(followups[dogId] || {}), [topicId]: label};
  return {...profile, followups};
}

// ───────── 입양 전 리허설: '이 아이와 나의 평일 하루' 타임라인 (2026-10-10) ─────────
// 강아지 정보와 판정은 엔진 값만 쓴다(지어내지 않음). 사용자는 바꿀 수 있는 답만 버튼으로 바꿔 보고, 결과를 바로 본다.
// 마지막에 보호소 문의(꼭 확인 먼저)로 이어진다.
export const DAY = [
  {id: 'morning', when: '아침', title: '일어나서 · 배변', inds: ['training'], items: ['Q_FIRST2W'],
   note: '입양 초기에는 배변 실수와 밤에 낑낑거림이 흔해요. 처음 2주를 어떻게 보낼지 정해 두세요.'},
  {id: 'alone', when: '낮', title: '혼자 있는 시간', inds: ['alone'], items: ['Q_ALONE_HOURS', 'Q_ALONE_PLAN'],
   note: '집을 비우는 시간이 길수록 이 아이가 혼자 어떻게 지내는지가 중요해요.'},
  {id: 'walk', when: '저녁', title: '산책 · 놀이', inds: ['activity'], items: ['Q_WALK'],
   note: '하루에 쓸 수 있는 산책·놀이 시간과 이 아이의 활동 요구를 나란히 봐요.'},
  {id: 'home', when: '저녁', title: '집 안 · 가족·손님·다른 동물', inds: ['people', 'kids', 'dogs', 'cats'], items: ['Q_VISITORS', 'Q_DOG_MEET'],
   note: '함께 사는 사람과 동물, 자주 오는 손님을 이 아이가 어떻게 대할지 봐요.'},
  {id: 'night', when: '밤', title: '조용한 시간 · 이웃', inds: ['barking'], items: [],
   note: '사는 곳의 소음 민감도는 바꾸기 어려운 조건이라 이 아이의 짖음 정보를 꼭 확인해요.'},
  {id: 'weekend', when: '주말', title: '청소 · 털 관리', inds: ['shedding'], items: ['Q_SHED'],
   note: '털 청소 부담만 봐요. 알레르기는 털 양으로 알 수 없어 따로 확인해요.'},
  {id: 'month', when: '한 달', title: '비용 · 병원', inds: ['cost', 'allergy'], items: ['Q_BUDGET', 'Q_EMERGENCY'],
   note: '한 달 돌봄 비용과 갑작스러운 병원비에 대비할 수 있는지 봐요.'},
];
const STATUS = r => r.inMust ? '꼭 확인' : r.inBurden ? '부담' : r.gap === null || r.gap === undefined ? (r.dog === null ? '모름' : '참고') : '맞음';

function surveyItem(id) { return core.cfg.survey.find(x => x.item_id === id); }

/** 리허설 한 번 계산. overrides = 리허설 안에서만 바꿔 본 답 {item_id: 선택지}. 저장은 호출하는 쪽이 정한다. */
export async function rehearsal(dogId, profile = {}, overrides = {}) {
  if (!core.dogs.some(d => d.dog_id === dogId)) return null;
  const base = await cardFor(dogId, profile);
  const tried = {...profile, ...overrides};
  const card = Object.keys(overrides).length ? await cardFor(dogId, tried) : base;
  const res = core.checkOne(dogId, personOf(tried));
  const lab = core.cfg.label;
  const all = [...res.rows, ...(res.checks || [])];
  const blocks = DAY.map(b => {
    const lines = b.inds.map(ind => all.find(r => r.ind === ind)).filter(Boolean).map(r => ({
      ind: r.ind, name: r.name, dog: r.dog, person: r.person, source: r.source ? (lab[r.source] || r.source) : null,
      status: STATUS({...r, inMust: res.must.includes(r), inBurden: res.burden.includes(r)}),
      exception: r.exception || null, situation: r.situation || null, evidence: r.evidence || null,
    }));
    const choices = b.items.filter(id => !core.WHAT_IF_FIXED.includes(id)).map(surveyItem).filter(Boolean).map(it => ({
      item_id: it.item_id, question: it.question,
      options: Object.keys(core.parseOptions(it.options)),
      base: profile[it.item_id] ?? null, current: tried[it.item_id] ?? null,
    }));
    const worst = lines.some(l => l.status === '부담') ? '부담' : lines.some(l => l.status === '꼭 확인') ? '꼭 확인' : lines.some(l => l.status === '모름') ? '모름' : '맞음';
    return {...b, lines, choices, status: worst};
  });
  const qs = card.shelter_questions;
  const copy = [`[${card.name}] ${card.url}`, `${card.shelter || ''} ${card.tel || ''}`.trim(), '',
    ...qs.filter(q => !q.common).map((q, i) => `${i + 1}. ${q.must ? '(꼭) ' : ''}${q.topic}: ${q.text}`)].join('\n');
  return {
    dog_id: dogId, name: card.name, photo: card.photo, headline: card.headline, region: card.region, url: card.url,
    shelter: card.shelter, tel: card.tel, adoption_process: card.adoption_process,
    before: {verdict: base.verdict, fit: base.fit}, after: {verdict: card.verdict, fit: card.fit}, changed: Object.keys(overrides),
    blocks, shelter_questions: qs, copy_text: copy,
    demo_shelter: Boolean(core.dataSource?.demo_shelter),
  };
}

/** 팀원 0.1.0 화면의 animalCard가 그대로 그릴 수 있는 모양(id·url·species·headline·shelter·phone·photo·area) + 전체 카드(pawcus) */
export function toLegacyAnimal(card) {
  return {id: card.dog_id, url: card.url, species: '개', headline: card.headline, shelter: card.shelter || '보호소 정보는 공고 상세에서 확인',
          phone: card.tel || '', photo: card.photo || '', area: card.dog_id.split('-').slice(0, 2).join('-'), capturedAt: null, pawcus: card};
}
