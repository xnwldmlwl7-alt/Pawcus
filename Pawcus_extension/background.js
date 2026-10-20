// 2026-10-11 화면 개편: 리허설 문장 이해용 무료 AI(Google AI Studio Gemini) 호출.
// 키는 사용자가 확장 프로그램 'AI 설정'에 직접 붙여 넣고 이 PC의 chrome.storage.local에만 저장된다(파일에 쓰지 않음).
// 키가 없거나 호출이 실패하면 content.js가 버튼·키워드 방식으로 진행한다.
// 2026-10-13: 'AI 설정' 화면을 뺐으므로 확장 폴더의 ai-key.json에 팀이 키를 한 번 넣어 두면 그 키를 쓴다(저장소에 키가 있으면 그것 먼저).
// 2026-10-13 LangChain: 리허설 대화는 lc_bundle.js의 체인(검색기 → 프롬프트 템플릿 + 대화 기억 → Gemini 구조화 출력)으로 답한다.
// 묶음 파일 원본은 내_확장프로그램/langchain_build/src/lc_entry.js. 불러오지 못하면 아래 callGemini(직접 호출)로 진행한다.
let LC = null;
try { importScripts('lc_bundle.js'); LC = self.PawcusLC || null; } catch (e) { console.warn('Pawcus LangChain 묶음을 불러오지 못했어요:', String(e)); }
const AI_KEY = 'pawcus-ai';
// 2026-10-13: 첫 시도가 gemini-3.8-flash면 실패 후 넘어가느라 첫 답이 15초 걸림 → 실제로 답한 gemini-flash-lite-latest를 맨 앞에
const MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.8-flash'];
let fileKey = null;
async function readFileKey() {
  if (fileKey !== null) return fileKey;
  try { const j = await fetch(chrome.runtime.getURL('ai-key.json')).then(r => r.json()); fileKey = String(j?.key || '').trim(); } catch { fileKey = ''; }
  if (!/^[\w.-]{20,}$/.test(fileKey)) fileKey = '';   // 예전 키는 AIza…, 새 키는 AQ.… 형식도 있다(2026-10-13 확인)
  return fileKey;
}
async function aiKey() { const saved = (await chrome.storage.local.get(AI_KEY))[AI_KEY] || {}; return {saved, key: saved.key || await readFileKey()}; }

async function callGemini({system, prompt}) {
  const {saved, key} = await aiKey();
  if (!key) return {ok: false, reason: 'no-key'};
  const order = saved.model ? [saved.model, ...MODELS.filter(m => m !== saved.model)] : MODELS;
  let last = '', limited = false;
  for (const model of order) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', signal: controller.signal,
        headers: {'Content-Type': 'application/json', 'x-goog-api-key': key},
        body: JSON.stringify({
          systemInstruction: {parts: [{text: system}]},
          contents: [{role: 'user', parts: [{text: prompt}]}],
          generationConfig: {temperature: 0.2, responseMimeType: 'application/json'}
        })
      });
      clearTimeout(timer);
      if (res.status === 404) { last = `${model} 없음`; continue; }          // 계정에서 못 쓰는 모델 → 다음
      if (res.status === 429) { limited = true; last = `${model} 한도`; continue; }   // 무료 한도 → 다음 모델(한도가 따로)로, 모두 막히면 낱말 방식으로
      if (!res.ok) { last = `${model} ${res.status}`; continue; }
      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      if (saved.model !== model) await chrome.storage.local.set({[AI_KEY]: {...saved, model}});
      return {ok: true, text, model};
    } catch (e) { clearTimeout(timer); last = `${model} ${e.name === 'AbortError' ? '시간 초과' : '연결 실패'}`; }
  }
  return {ok: false, reason: limited ? 'limit' : 'fail', detail: last};
}

// 2026-10-13 하루 갱신: Colab(paste_26)이 매일 덮어쓰는 Drive 파일 pawcus_live.json을 받아 쓴다.
// 파일 ID를 비워 두면 받지 않고, 받지 못하면 마지막으로 받은 파일 → 그것도 없으면 확장 안의 10/02 데이터로 동작한다.
const LIVE_FILE_ID = '1pwQAI___JPFNmqssXb-vY44hfPrxWJL1';                     // Drive 'outputs/pawcus_live/pawcus_live.json' 공유 링크의 /d/와 /view 사이 글자
const LIVE_KEY = 'pawcus-live', LIVE_MAX_AGE = 3 * 60 * 60 * 1000;   // 받은 지 3시간 안이면 다시 받지 않음

async function getLive() {
  if (!LIVE_FILE_ID) return null;
  const cached = (await chrome.storage.local.get(LIVE_KEY))[LIVE_KEY];
  if (cached?.data && cached.id === LIVE_FILE_ID && Date.now() - cached.at < LIVE_MAX_AGE) return cached.data;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(LIVE_FILE_ID)}&export=download&confirm=t`, {signal: controller.signal, cache: 'no-store'});
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();                      // 공유가 안 돼 있으면 로그인 화면(HTML)이 와서 여기서 실패한다
    if (!Array.isArray(data?.dogs) || !data.dogs.length) throw new Error('형식이 다름');
    await chrome.storage.local.set({[LIVE_KEY]: {id: LIVE_FILE_ID, at: Date.now(), data}});
    return data;
  } catch (e) {
    console.warn('Pawcus 새 공고 파일을 받지 못해 이전 데이터로 진행해요:', String(e));
    return cached?.id === LIVE_FILE_ID ? cached.data || null : null;
  } finally { clearTimeout(timer); }
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'pawcus-live') {
    getLive().then(data => reply({data}), () => reply({data: null}));
    return true;
  }
  if (msg?.type === 'pawcus-ai-ready') { aiKey().then(k => reply({ok: Boolean(k.key)}), () => reply({ok: false})); return true; }
  if (msg?.type === 'pawcus-lc') {   // LangChain 체인으로 리허설 대화 답하기
    (async () => {
      if (!LC) return {ok: false, reason: 'no-lc'};
      const {key} = await aiKey();
      if (!key) return {ok: false, reason: 'no-key'};
      // 모델 순서는 고정(예전 직접 호출이 저장해 둔 모델이 느리면 첫 답이 오래 걸리던 문제)
      return LC.rehearsalChat({input: msg.input, apiKey: key, models: MODELS, getURL: p => chrome.runtime.getURL(p)});
    })().then(reply, e => reply({ok: false, reason: 'fail', detail: String(e)}));
    return true;
  }
  if (msg?.type !== 'pawcus-ai') return;
  callGemini(msg).then(reply, e => reply({ok: false, reason: 'fail', detail: String(e)}));
  return true;   // 비동기 응답
});
