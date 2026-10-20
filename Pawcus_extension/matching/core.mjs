// 입양자 매칭 엔진. 원본: 매칭엔진 src/matching_core.py — 규칙·순서·반올림을 그대로 옮겼다.
// 결과가 Python과 같은지는 `node scripts/test-matching.mjs`(tests/matching/golden.json 비교)로 확인한다.
// 기준값은 이 파일에 쓰지 않는다. 엔진 폴더 data/config CSV → scripts/export-matching.py → engine-data.json.
// 기능 1 checkOne(): 강아지 한 마리 → 맞는 점 / 부담 / 모름 / 꼭 확인 + 보호소 문의 카드
// 기능 2 recommend(): 전체 강아지 → 판정 순 추천 + 각 강아지의 기능 1 결과
// 준비   applicationDraft(): 입양신청서 문항별 초안(제출 기능 없음)
import data from './engine-data.json' with {type:'json'};
import * as le from './evidence.mjs';

export const ORDER=data.order;
export const cfg={
 criteria:data.criteria, survey:data.survey, readiness:data.readiness, breed:data.breed, settings:data.settings,
 common:data.common, answers:data.answers,
 weight:Object.fromEntries(Object.entries(data.sources).map(([k,v])=>[k,v.weight])),
 label:Object.fromEntries(Object.entries(data.sources).map(([k,v])=>[k,v.label])),
};
export const dogs=data.dogs;
export const info=data.info;
export const display=data.display;
export const dataSource=data.source;
// 2026-10-13 하루 갱신: Colab paste_26이 만든 pawcus_live.json의 강아지·정보·표시 칸으로 바꾼다(기준값 cfg는 그대로).
// 같은 배열·객체를 고쳐 쓰므로 list=dogs 같은 기본값도 새 데이터를 본다. 값이 이상하면 바꾸지 않고 false.
export function useLiveData(live){
 if(!Array.isArray(live?.dogs)||!live.dogs.length||!live.dogs.every(d=>d&&d.dog_id))return false;
 dogs.splice(0,dogs.length,...live.dogs);
 for(const [obj,src] of [[info,live.info],[display,live.display]]){for(const k of Object.keys(obj))delete obj[k];Object.assign(obj,src||{});}
 dataSource.live=live.source||{};
 return true;
}

// ───────── 공통 ─────────
const NUM=/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
export function num(v){
 if(v===null||v===undefined)return null;
 if(typeof v==='number')return Number.isNaN(v)?null:v;
 if(typeof v==='string'){const s=v.trim();return NUM.test(s)?Number(s):null;}
 return null;
}
const has=v=>num(v)!==null;
const own=(o,k)=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(o,k);

// 파이썬 round(x, n)과 같은 결과(정확한 값 기준, 딱 반일 때는 짝수 쪽).
export function pyRound(x,n){
 if(x===null||x===undefined||!Number.isFinite(x)||x===0)return x;
 const v=new DataView(new ArrayBuffer(8));v.setFloat64(0,x);
 const hi=v.getUint32(0),lo=v.getUint32(4),exp=(hi>>>20)&0x7ff;
 let mant=(BigInt(hi&0xfffff)<<32n)|BigInt(lo),e;
 if(exp===0)e=-1074;else{mant|=1n<<52n;e=exp-1075;}
 if(e>=0)return x;
 const D=1n<<BigInt(-e),scaled=mant*10n**BigInt(n);
 let q=scaled/D;const twice=2n*(scaled%D);
 if(twice>D||(twice===D&&(q&1n)===1n))q+=1n;
 return Number(`${x<0?'-':''}${q}e-${n}`);
}

export const scored=()=>ORDER.filter(i=>cfg.criteria[i].role==='score');

export function parseOptions(text){
 const out={};
 for(const part of String(text).split(';')){
  if(!part.trim())continue;
  const at=part.lastIndexOf(':');
  const label=at<0?'':part.slice(0,at),val=at<0?part:part.slice(at+1);
  out[label.trim()]=num(val);
 }
 return out;
}

// ───────── 강아지 데이터 ─────────
const quoteCache=new Map();
export function listingQuotes(dog){
 const texts=le.TEXT_FIELDS.map(f=>typeof dog[f]==='string'?dog[f]:'');
 const key=texts.join('\u0000');
 if(!quoteCache.has(key))quoteCache.set(key,le.extract(Object.fromEntries(le.TEXT_FIELDS.map((f,i)=>[f,texts[i]]))));
 return quoteCache.get(key);
}

export const isPuppy=dog=>has(dog.age_years)&&num(dog.age_years)<cfg.settings.puppy_age;

// 다 컸을 때 체중: 1살 이상 → 공고 체중 / 1살 미만 → 품종 성견 체중 / 1살 미만 믹스 → 모름
export function expectedKg(dog){
 if(!isPuppy(dog))return has(dog.kg)?[num(dog.kg),'notice']:[null,null];
 if(own(cfg.breed,dog.breed)&&has(cfg.breed[dog.breed].adult_kg))return [num(cfg.breed[dog.breed].adult_kg),'breed'];
 return [null,null];
}

export const kgToSize=kg=>kg<=5?1:kg<=10?2:kg<=15?3:kg<=25?4:5;

// 지표별 [값, 출처, 근거 문장]. 순서: 보호소 관찰 → 보호소 확인(입양자 전달) → 공고 → 소개글 추출 → 나이 기준 → 품종 → 미확인
export function dogProfile(dog){
 const s=cfg.settings,base=own(cfg.breed,dog.breed)?cfg.breed[dog.breed]:null,prof={};
 for(const ind of ORDER){
  let val=null,src=null,ev=null;
  for(const [prefix,name] of [['shelter_','shelter'],['relay_','relay'],['notice_','notice'],['video_','video'],['comment_','comment']]){   // video_: 2026-10-08 Python patch_19와 같음
   if(has(dog[prefix+ind])){
    val=num(dog[prefix+ind]);src=name;
    if(name==='comment'){
     ev=dog[`comment_${ind}_evidence`];
     const m1=num(dog[`comment_${ind}_model1`]),m2=num(dog[`comment_${ind}_model2`]);
     if(m1!==null&&m2!==null&&m1!==m2)val=Math.max(m1,m2);   // 2026-10-10: 두 AI가 1단계 다르면 더 부담스러운 값
    }
    break;
   }
  }
  if(val===null&&ind==='size'){const [kg,k]=expectedKg(dog);if(kg!==null){val=kgToSize(kg);src=k;}}
  if(val===null&&(ind==='alone'||ind==='training')&&isPuppy(dog)){val=s['puppy_'+ind];src='age';}
  if(val===null&&base!==null&&own(base,ind)&&ind!=='source'&&has(base[ind])){val=num(base[ind]);src='breed';}
  prof[ind]=[val,src,typeof ev==='string'?ev:null];
 }
 return prof;
}

// ───────── 입양자 답 → 점수 ─────────
// 선택지에 없는 답('아직 생각 안 해 봄' 등)은 점수를 비우고 '생각해 볼 점'으로 돌린다(감점 없음).
export function scorePerson(answers,readiness={},regions=null){
 readiness=readiness||{};
 const score=Object.fromEntries(ORDER.map(k=>[k,null])),why={},think=[];
 for(const it of [...cfg.survey].sort((a,b)=>a.order-b.order)){
  const ans=answers[it.item_id],opts=parseOptions(it.options);
  if(ans===undefined||ans===null||ans==='')continue;
  if(!own(opts,ans)){think.push(`${it.question} → ${ans}`);continue;}
  const v=opts[ans],cur=score[it.indicator];
  if(it.kind==='base')score[it.indicator]=v;
  else if(it.kind==='plus'&&cur!==null&&v)score[it.indicator]=Math.min(5,cur+v);
  else if(it.kind==='cap'&&cur!==null&&v!==null)score[it.indicator]=Math.min(cur,v);
  (why[it.indicator]??=[]).push(`${ans}`);
 }
 // 2026-10-10(v2 평가 2.1): 알레르기를 털 빠짐 감당 1로 바꾸지 않는다(털 양으로 판단 불가, AAAAI). CHECKS의 별도 확인 항목으로만
 const flags=[];
 if(['아니오','아직 이야기 안 함'].includes(readiness.R_FAMILY))flags.push('가족 모두의 동의가 아직 없음 → 입양 전에 먼저 이야기해 보기');
 if(readiness.R_OWN==='아니오')flags.push('임대 주택 → 반려동물 허용 여부와 이사 계획 확인');
 if(readiness.R_TRAVEL==='아직 생각 안 해 봄')flags.push('여행·명절에 맡길 곳 정하기');
 if(readiness.R_LIFE_CHANGE==='아직 생각 안 해 봄')flags.push('결혼·이사 같은 변화가 생길 때 계획 세우기');
 if(readiness.R_HELP==='아직 없음')flags.push('문제가 생기면 도움 받을 곳(동물병원·훈련사·보호소) 정해 두기');
 return {score,why:Object.fromEntries(Object.entries(why).map(([k,v])=>[k,v.join(' + ')])),think,flags,
  allergy:readiness.R_ALLERGY==='있음',regions,answers,readiness};
}

// ───────── 비교 ─────────
// 2026-10-10 판정 구조 변경(Python matching_core와 같음): 점수는 지표 중요도로만 가중하고 출처 신뢰도는 곱하지 않는다.
// 신뢰도는 정보 충분성(info)과 '나에게 중요한 항목'의 꼭 확인에만 쓴다. 결과는 fit(생활 적합성) · info(정보 충분성) · must(꼭 확인).
const KEY_IND=['alone','barking','shedding','dogs','people'];
export const isWeak=src=>src===null||src===undefined||(cfg.weight[src]??0)<(cfg.settings.strong_source_min??0.8);
// 입양자에게 중요한 항목 {지표: 이유}: 내가 괜찮은 정도가 key_cap(2) 이하인 행동 지표 + 알레르기 → 털 + 함께 사는 개 → 다른 개
export function keyItems(person){
 const s=cfg.settings,out={};
 for(const ind of KEY_IND){const cap=person.score[ind]??null;if(cap!==null&&cap<=(s.key_cap??2))out[ind]=person.why[ind]??'';}
 if(['개 1마리','개 2마리 이상'].includes((person.answers||{}).Q_PETS)&&!own(out,'dogs'))out.dogs=person.why.dogs??'함께 사는 개가 있음';
 return out;
}
// 별도 확인 항목(2026-10-10, v2 평가 2.1·2.2, Python CHECKS와 같음): 점수·비교 지표 수에는 넣지 않고 꼭 확인·부담으로만 반영
export const CHECKS={
 allergy:{name:'알레르기 반응',question:'입양 전에 함께 사는 사람이 이 아이를 직접 만나 알레르기 반응을 확인할 수 있나요? (털 빠짐 양으로는 알 수 없어요)',why:'반려동물 알레르겐은 비듬·침·소변에 있어 털 길이나 빠짐 양으로 판단할 수 없음(AAAAI)'},
 kids:{name:'아이와 지낸 경험',question:'아이(특히 미취학 아동)를 만나 본 적이 있나요? 그때 어떤 반응이었나요? (만난 적 없음과 문제 없음은 달라요)',why:'어른에게 편안한 것과 어린아이와 함께 지낼 수 있는 것은 별개의 정보'},
 cats:{name:'고양이와 지낸 경험',question:'고양이와 지내 본 적이 있나요? 그때 어떤 반응이었나요?',why:'다른 개와의 관계로 고양이와의 관계를 대신 판단할 수 없음'},
};
export function checkItems(person){
 const a=person.answers||{},out={};
 if(person.allergy)out.allergy=1;
 const hh=a.Q_HOUSEHOLD;
 if(hh==='미취학 자녀 있음'||hh==='초등학생 이상 자녀 있음')out.kids=hh==='미취학 자녀 있음'?1:2;
 if(a.Q_PETS==='고양이 등 다른 동물')out.cats=2;
 return out;
}
function mustRule(ind,cap,person,val){   // 크기 전용. 행동 지표의 꼭 확인은 keyItems()로 정한다
 if(ind==='size')return val===null&&cap!==null;   // 원하는 크기가 있을 때만
 return false;
}

export function compare(dog,person){
 const s=cfg.settings,crit=cfg.criteria,prof=dogProfile(dog),quotes=listingQuotes(dog),keys=keyItems(person);
 let n=0,d=0;
 const out={good:[],burden:[],unknown:[],must:[],rows:[],filter:[],conflict:[],quotes,keys};
 for(const ind of ORDER){
  const [val,src,ev]=prof[ind],cap=person.score[ind]??null,name=crit[ind].name;
  const row={ind,name,dog:val,source:src,evidence:ev,person:cap,gap:null,conflict:null,key:own(keys,ind)};
  const sit=src==='comment'?dog[`comment_${ind}_situation`]:null;   // 2026-10-10 paste_22 상황 추출
  row.situation=typeof sit==='string'&&sit.trim()?sit:null;
  // 2026-10-10(v2 평가 2.5·2.3): 보호소 기록의 예외 행동 / 두 AI 중 다른 쪽 값
  const exc=src==='shelter'?dog[`shelter_${ind}_exception`]:null;
  row.exception=typeof exc==='string'&&exc.trim()?exc:null;
  row.alt=null;
  if(src==='comment'){
   const m1=num(dog[`comment_${ind}_model1`]),m2=num(dog[`comment_${ind}_model2`]);
   row.alt=num(dog[`comment_${ind}_alt`]);
   if(row.alt===null&&m1!==null&&m2!==null&&m1!==m2)row.alt=Math.min(m1,m2);
  }
  // 꼭 확인: 원하는 크기가 있는데 크기를 모름 / 나에게 중요한 항목인데 정보가 없거나 약함
  if(ind==='size'){if(mustRule(ind,cap,person,val))out.must.push(row);}
  else if(own(keys,ind)&&isWeak(src))out.must.push(row);
  // 꼭 확인: 공고 태그·막대 값과 반대 방향의 공고 문장이 있음(값은 그대로 두고 확인만 요청)
  if(src==='notice'&&crit[ind].role==='score'){
   const c=le.conflict(ind,val,quotes);
   if(c){row.conflict=c;out.conflict.push(row);if(!out.must.includes(row))out.must.push(row);}
  }
  if(crit[ind].role==='filter'){
   // 희망 조건: 점수·부담·비교 수에 넣지 않고 맞음/차이/모름만 표시한다
   if(cap!==null){row.filter=val===null?'모름':val===cap?'맞음':`${Math.abs(val-cap).toFixed(0)}단계 차이`;out.filter.push(row);}
   out.rows.push(row);continue;
  }
  if(val===null||cap===null)out.unknown.push(row);
  else{
   const gap=crit[ind].need_dir==='two'?Math.abs(cap-val)/4:Math.max(0,val-cap)/4;
   row.gap=gap;
   const w=Number(crit[ind].importance);   // 2026-10-10: 출처 신뢰도는 곱하지 않음
   n+=w*gap;d+=w;
   (gap>=s.burden_gap?out.burden:out.good).push(row);
   // 두 AI 값 중 어느 쪽이냐에 따라 부담 판단이 달라지면 꼭 확인(값은 더 부담스러운 쪽)
   if(row.alt!==null&&row.alt!==val&&crit[ind].need_dir!=='two'){
    const g2=Math.max(0,row.alt-cap)/4;
    if((g2>=s.burden_gap)!==(gap>=s.burden_gap)||(g2>=s.heavy_gap)!==(gap>=s.heavy_gap)){row.alt_matters=true;if(!out.must.includes(row))out.must.push(row);}
   }
  }
  if(row.exception&&!out.must.includes(row))out.must.push(row);   // 예외 기록은 영구 부적합이 아니라 상황 확인으로
  out.rows.push(row);
 }
 // 별도 확인 항목(알레르기·아이·고양이)
 out.checks=[];
 for(const [cid,cap] of Object.entries(checkItems(person))){
  let val=null,src=null;
  for(const [prefix,name] of [['shelter_','shelter'],['relay_','relay']])if(has(dog[prefix+cid])){val=num(dog[prefix+cid]);src=name;break;}
  if(cid==='allergy'&&src!=='relay'){val=null;src=null;}   // 알레르기는 함께 사는 사람이 직접 만나 확인한 답만 인정
  const r={ind:cid,name:CHECKS[cid].name,dog:val,source:src,evidence:null,person:cap,gap:null,conflict:null,key:true,check:true,situation:null,exception:null,alt:null};
  if(val===null)out.must.push(r);
  else{r.gap=Math.max(0,val-cap)/4;(r.gap>=s.burden_gap?out.burden:out.good).push(r);}
  out.checks.push(r);
 }
 out.score=d?n/d:null;
 const compared=out.rows.filter(r=>r.gap!==null);
 out.coverage=compared.length;
 const byInd=Object.fromEntries(out.rows.map(r=>[r.ind,r]));
 const keyOpen=ORDER.filter(i=>own(keys,i)&&isWeak(byInd[i].source)).map(i=>byInd[i].name).concat(out.checks.filter(r=>r.dog===null).map(r=>r.name));
 const strong=compared.filter(r=>!isWeak(r.source)).length;
 out.info={compared:out.coverage,total:scored().length,strong,weak:out.coverage-strong,
  key:ORDER.filter(i=>own(keys,i)).map(i=>byInd[i].name).concat(out.checks.map(r=>r.name)),key_open:keyOpen,
  level:out.coverage>=s.min_coverage&&!keyOpen.length?'충분':'부족'};
 out.fit=out.score===null?'판단 불가':(out.score>s.good_max||out.burden.some(r=>r.gap>=s.heavy_gap))?'큰 부담':out.burden.length?'1단계 부담':'맞음';
 return out;
}

// 부담 있음: 점수가 기준을 넘거나 한 지표라도 2단계 이상 모자람 / 잘 맞음: 부담 0 + 꼭 확인 0 + 비교 지표 충분 / 그 밖: 확인 필요
export function verdict(res){
 const s=cfg.settings;
 if(res.score===null)return '판단 불가';
 if(res.score>s.good_max||res.burden.some(r=>r.gap>=s.heavy_gap))return '부담 있음';
 if(res.burden.length||res.must.length||res.coverage<s.min_coverage)return '맞을 가능성 · 확인 필요';
 return '잘 맞음';
}
export const VERDICT_ORDER={'잘 맞음':0,'맞을 가능성 · 확인 필요':1,'부담 있음':2,'판단 불가':3};
export const RECOMMENDABLE=['잘 맞음','맞을 가능성 · 확인 필요'];   // 추천 목록에 넣는 판정(2026-10-10)

// ───────── 기능 1 ─────────
// 소개글 AI 추출 값을 보호소에 확인할 필요가 있는가: 내 답이 없거나, 개 값이 한 단계 높았다면 '부담'이 되는 경우 (Python comment_needs_check)
export function commentNeedsCheck(r){
 if(r.person===null||r.person===undefined||r.dog===null||r.dog===undefined)return true;
 return Math.max(0,r.dog+1-r.person)/4>=cfg.settings.burden_gap;
}
const sitText=r=>r.situation?`(상황: ${r.situation} — 다른 상황에서는 어떤지도 확인)`:'';   // 소개글에서 함께 뽑은 상황(2026-10-10)
const shortText=(t,n=60)=>{const c=Array.from(String(t).split(/\s+/).filter(Boolean).join(' '));return c.length<=n?c.join(''):c.slice(0,n).join('')+'…';};
export function shelterCard(dogId,res,info_=info){
 const crit=cfg.criteria,ask=[],noted=[];
 for(const r of res.must){
  if(r.check){ask.push(['꼭',r.name,CHECKS[r.ind].question]);continue;}   // 알레르기·아이·고양이(2026-10-10)
  let q=crit[r.ind].shelter_question;
  if(r.exception)q=`(보호소 기록은 대체로 괜찮지만 예외 기록이 있어요: ${r.exception} — 어떤 상황이었나요?) `+q;
  else if(r.alt_matters)q=`(소개글을 두 AI가 ${Math.round(r.dog)}·${Math.round(r.alt)}단계로 다르게 읽어 판정이 달라져요: "${shortText(r.evidence||'')}"${sitText(r)}) `+q;
  else if(r.conflict)q=`(공고 태그·막대 값과 다른 문장이 있어요: "${r.conflict.quote}") `+q;
  else if(r.source==='comment'&&r.evidence)q=`(나에게 중요한 항목이라 확인해요. 소개글: "${shortText(r.evidence)}"${sitText(r)}) `+q;   // 2026-10-10
  else if(['video','age','breed'].includes(r.source))q=`(나에게 중요한 항목이라 확인해요. 지금 값은 ${cfg.label[r.source]}) `+q;
  ask.push(['꼭',r.name,q]);
 }
 for(const r of res.unknown)if(!res.must.includes(r)&&r.dog===null)ask.push(['확인',r.name,crit[r.ind].shelter_question]);
 for(const r of res.rows){
  if(r.source==='comment'&&!res.must.includes(r)){
   // 2026-10-08 Python patch_18과 같음: 한 단계 더 나빠도 감당 범위면 묻지 않고(noted), 물을 때는 소개글 문장을 먼저 보여 준다
   if(!commentNeedsCheck(r)){noted.push({name:r.name,evidence:r.evidence,why:`소개글 기준 개 ${Math.round(r.dog)} / 나 ${Math.round(r.person)} — 한 단계 더 높아도 감당 범위라 묻지 않았어요`});continue;}
   const said=r.evidence?`소개글에는 "${shortText(r.evidence)}"라고 되어 있어요${sitText(r)}. 보호소에서 보시기에도 그런가요? `:`소개글을 AI가 읽은 값(${Math.round(r.dog)}점)이에요. 보호소에서 보시기에도 그런가요? `;
   ask.push(['확인',r.name,said+crit[r.ind].shelter_question]);
  }else if(['age','breed'].includes(r.source)&&!res.must.includes(r))ask.push(['확인',r.name,`(공고·${cfg.label[r.source]} 값) `+crit[r.ind].shelter_question]);
 }
 for(const c of cfg.common)ask.push(['공통',c.topic,c.question]);   // 모든 강아지 공통 질문
 // 질문마다 관련 공고 원문 문장(부담 문장 우선, 최대 2개)
 const nameToInd=Object.fromEntries(ORDER.map(i=>[crit[i].name,i])),rank={burden:0,good:1,topic:2},quotes={};
 for(const [,name] of ask){
  const ind=nameToInd[name];
  if(ind&&res.quotes&&own(res.quotes,ind))quotes[name]=[...res.quotes[ind]].sort((a,b)=>rank[a.kind]-rank[b.kind]).slice(0,2);
 }
 const card={questions:ask,quotes,noted};
 const i=info_?.[dogId];
 if(i)for(const k of ['shelter_name','shelter_tel','shelter_address','adoption_process','adoption_condition','adoption_charge','page_url','image_urls']){
  const v=i[k];card[k]=typeof v==='string'&&v.trim()?v:null;
 }
 return card;
}

export function findDog(dogId,list=dogs){
 const d=list.find(x=>x.dog_id===dogId);
 if(!d)throw new Error(`공고번호를 찾지 못함: ${dogId}`);
 return d;
}

// 결과를 바꾸는 조건(2026-10-10, Python what_if와 같음): 부담 지표마다 같은 지표의 질문 답을 더 감당할 수 있는 쪽으로 바꾸면
// 부담이 사라지는지. 지표마다 가장 작은 변화 하나. 생활 계획이 바뀐다는 가정일 뿐 강아지 행동 확인이 아니다.
// 계획으로 바꿀 수 없는 조건(가족 구성·이미 키우는 동물·경험·사는 집의 소음 환경)은 뺀다 (Python WHAT_IF_FIXED와 같음)
export const WHAT_IF_FIXED=['Q_HOUSEHOLD','Q_PETS','Q_EXPERIENCE','Q_NOISE'];
export function whatIf(res,person,limit=3){
 const answers={...(person.answers||{})},readiness={...(person.readiness||{})},out=[];
 for(const b of res.burden){
  const ind=b.ind;
  if(b.source==='followup'||!ORDER.includes(ind))continue;
  let best=null;
  for(const it of cfg.survey.filter(x=>x.indicator===ind&&!WHAT_IF_FIXED.includes(x.item_id)).sort((a,b)=>a.order-b.order)){
   const opts=parseOptions(it.options),cur=answers[it.item_id],curV=own(opts,cur)?opts[cur]:null;
   const cands=Object.entries(opts).filter(([,v])=>v!==null).sort((a,b)=>a[1]-b[1]);
   for(const [label,v] of cands){
    if(label===cur||(curV!==null&&v<=curV))continue;
    const p2=scorePerson({...answers,[it.item_id]:label},readiness,person.regions),r2=compare(res.dog,p2);
    if(!r2.burden.some(x=>x.ind===ind)){
     const cand={ind,name:b.name,item_id:it.item_id,question:it.question,now:cur??'답 없음',change:label,verdict:verdict(r2)};
     if(best===null||VERDICT_ORDER[cand.verdict]<VERDICT_ORDER[best.verdict])best=cand;
     break;
    }
   }
  }
  if(best)out.push(best);
 }
 return out.slice(0,limit);
}

export function checkOne(dogId,person,list=dogs,info_=info){
 const dog={...findDog(dogId,list),dog_id:dogId},res=compare(dog,person);
 res.verdict=verdict(res);res.dog=dog;res.card=shelterCard(dogId,res,info_);
 res.what_if=whatIf(res,person);
 return res;
}

// ───────── 기능 2 ─────────
const keyLess=(a,b)=>{for(let i=0;i<a.length;i++){if(a[i]<b[i])return -1;if(a[i]>b[i])return 1;}return 0;};
// 추천 순서 (2026-10-08, Python rank_key와 같음): 판정 → 점수 → 꼭 확인 개수 → 비교한 지표 수 → 원하는 크기와의 차이 → 감당 여유 → 공고번호
export function rankKey(res,id){
 const f=(res.filter||[]).find(r=>r.dog!==null&&r.person!==null);
 const sizeGap=f?Math.abs(f.dog-f.person):9;
 const rows=res.rows.filter(r=>r.gap!==null&&r.gap!==undefined);
 const margin=rows.length?rows.reduce((a,r)=>a+(r.person-r.dog),0)/rows.length:0;
 return [VERDICT_ORDER[res.verdict],res.score!==null?res.score:9,res.must.length,-res.coverage,sizeGap,-pyRound(margin,6),id];
}
export function recommend(person,list=dogs,info_=info,k=3){
 const s=cfg.settings;
 const pool=person.regions&&person.regions.length?list.filter(d=>person.regions.includes(d.region)):list;
 const want=person.score.size??null,ranked=[],unknownSize=[];let excluded=0;
 const key=rankKey;
 for(const dog of pool){
  const [kg]=expectedKg(dog);
  if(want!==null&&kg!==null&&Math.abs(kgToSize(kg)-want)>=s.size_exclude_steps){excluded++;continue;}
  const res=compare(dog,person);res.verdict=verdict(res);
  // 원하는 크기가 있는데 다 컸을 때 크기를 모르는 강아지(1살 미만 믹스)는 순위에 섞지 않고 따로 보여 준다
  (want!==null&&kg===null?unknownSize:ranked).push([key(res,dog.dog_id),res]);
 }
 ranked.sort((a,b)=>keyLess(a[0],b[0]));unknownSize.sort((a,b)=>keyLess(a[0],b[0]));
 const groups={};for(const [,r] of ranked)groups[r.verdict]=(groups[r.verdict]||0)+1;
 const idOf=x=>x[0][x[0].length-1];
 // 2026-10-10: '부담 있음'·'판단 불가'로 억지로 채우지 않는다. 전체 순위는 ranked에 그대로 둔다
 const ok=xs=>xs.filter(x=>RECOMMENDABLE.includes(x[1].verdict));
 return {top:ok(ranked).slice(0,k).map(x=>checkOne(idOf(x),person,list,info_)),
  topUnknownSize:ok(unknownSize).slice(0,k).map(x=>checkOne(idOf(x),person,list,info_)),
  pool:pool.length,excludedBySize:excluded,nUnknownSize:unknownSize.length,groups,
  nReady:groups['잘 맞음']||0,nCheck:groups['맞을 가능성 · 확인 필요']||0,
  ranked:ranked.map(x=>[idOf(x),x[1].verdict,pyRound(x[0][1],3),x[1].coverage])};
}

// ───────── 입양신청서 준비(제출하지 않음) ─────────
export function applicationDraft(person){
 const draft=[],sv=Object.fromEntries(cfg.survey.map(x=>[x.item_id,x])),rd=Object.fromEntries(cfg.readiness.map(x=>[x.item_id,x]));
 for(const [id,ans] of Object.entries(person.answers||{}))if(sv[id]&&sv[id].application_field&&sv[id].application_field!=='—')draft.push([sv[id].application_field,`${sv[id].question} → ${ans}`]);
 for(const [id,ans] of Object.entries(person.readiness||{}))if(rd[id]&&rd[id].application_field&&rd[id].application_field!=='—')draft.push([rd[id].application_field,String(rd[id].draft_template).replaceAll('{answer}',String(ans))]);
 return draft;
}
