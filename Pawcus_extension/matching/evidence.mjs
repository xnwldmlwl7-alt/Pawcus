// 공고 원문 문장 근거 + 태그·막대와 소개글의 모순 검사. 원본: 매칭엔진 src/listing_evidence.py (규칙·정규식 동일).
// 공고 문장은 원문 그대로 인용만 한다. 모순 후보는 값을 바꾸지 않고 '꼭 확인'에 올린다(자동 후보, 사람이 원문 확인).
// 2026-10-08: Python patch_18(2026-10-07)과 같게 맞춤 — 부정 표현('입질은 일절 없는', '낯가림 없이', '짖음이 뭐예요')은 괜찮음,
//             '조용한 성격은 아니라는'은 부담, 놓치던 부담 문장('겁이 있어', '혼자 남겨질때면 … 많이 불안', '털이 … 많이 빠진다') 보완.
export const TEXT_FIELDS=['text_personality','text_feature','text_medical'];
export const FIELD_LABEL={text_personality:'소개글',text_feature:'특징',text_medical:'건강 메모'};

const PATTERNS={
 alone:{
  topic:String.raw`분리\s*불안|혼자\s*(있|지내|남|두)|외출|부재|집을\s*비`,
  burden:String.raw`분리\s*불안\s*(이\s*)?(있|심)|혼자.{0,25}(짖|울|낑낑|불안|힘들어|어려워|싫어|못\s*있)`,
  good:String.raw`혼자.{0,10}(잘\s*(있|지내|기다)|얌전|괜찮)|분리\s*불안\s*(은\s*|이\s*)?(없|전혀)`},
 activity:{
  topic:String.raw`활동량|활발|에너지|뛰어|산책을?\s*좋아|차분|얌전`,
  burden:String.raw`활동량\s*(이\s*)?(많|높|넘)|에너지\s*(가\s*)?(넘|많|폭발)|매우\s*활발`,
  good:String.raw`활동량\s*(이\s*)?(적|보통)|차분한\s*(성격|편|아이|스타일)|조용한\s*편`},
 barking:{
  topic:String.raw`짖`,
  burden:String.raw`(많이|자주|크게|계속)\s*짖|짖음\s*(이\s*)?(있|많|심)|짖는\s*편`,
  good:String.raw`짖지\s*않|안\s*짖|짖음\s*(이\s*)?(없|적|거의)|조용|짖음이\s*뭐|짖을\s*줄\s*모르`},
 shedding:{
  topic:String.raw`털.{0,12}(빠|날)|털갈이|이중모|털이\s*많`,
  burden:String.raw`털.{0,12}많이\s*빠|털\s*(이\s*)?(많이\s*)?빠(져|지는|짐이\s*많)|털갈이|이중모`,
  good:String.raw`털\s*(빠짐|이\s*잘\s*안\s*빠|이\s*거의\s*안\s*빠)\s*(이\s*)?(적|없|거의)?`},
 dogs:{
  topic:String.raw`(다른|타)\s*(개|강아지|동물|친구)|강아지\s*친구|동물\s*친화|단독\s*가정|외동`,
  burden:String.raw`(다른|타)\s*(개|강아지|동물|친구).{0,15}(예민|짖|공격|싫어|거리|무서워|싸우|경계)|(단독\s*가정|외동)\s*(을|으로)?\s*(추천|권|희망|만)`,
  good:String.raw`(다른|타)\s*(개|강아지|동물|친구).{0,15}(잘\s*지내|좋아|친하|사이\s*좋|어울|잘\s*놀|다투지\s*않|사회성\S{0,2}\s*좋)|(개|강아지|동물)\s*(친구)?\S{0,4}\s*스스럼\s*없`},
 people:{
  topic:String.raw`사람|낯|경계|겁|손님|아이|어린이|친화력`,
  burden:String.raw`낯을?\s*(많이\s*)?가리|경계(심)?\s*(이\s*)?(있|많|심)|겁이?\s*(많|있)|(사람|낯선|손길|손)\S{0,4}\s*무서워|낯설고\s*무서(워|운)|사람을?\s*피하(는|고|며)|입질|물었|물기도`,
  good:String.raw`사람을?\s*(너무\s*|정말\s*|무척\s*)?(좋아|잘\s*따)|사람\s*친화력\s*:?\s*(상|좋)|낯을?\s*(안|거의\s*안)\s*가리|낯가림\S{0,2}\s*(거의|전혀)?\s*(찾아볼\s*수\s*)?없|스스럼\s*없|거부감\s*없|겁이\s*없`},
 training:{
  topic:String.raw`배변|교육|훈련|앉아|기다려|산책\s*(연습|교육|가능)`,
  burden:String.raw`배변.{0,8}(실수|못\s*가|안\s*돼|교육\s*중|연습)|교육\s*(이\s*)?필요|산책.{0,8}(어려|거부|못)`,
  good:String.raw`배변.{0,8}(잘|완료|가려|가림)|(앉아|기다려|엎드려)[,\s·]*(돌아|기다려|손)?\s*(를|도|까지)?\s*(할\s*수|해요|가능|잘)|산책\s*(을\s*)?(잘|가능)|훈련\s*(이\s*)?(잘|완료)`},
 cost:{
  topic:String.raw`치료|수술|약|병원|질환|탈구|양성|발치|피부|건강`,
  burden:String.raw`치료\s*(중|필요)|(?<!중성화\s)수술\s*(필요|예정)|(?<!음)양성|탈구|발치\s*필요|질환|(상태|건강)\S{0,3}\s*안\s*좋`,
  good:String.raw`매우\s*건강|이상\s*(없|소견\s*없)|모두\s*음성|특이\s*사항\s*없`},
};
// 부담 문장에서 빼는 경우: 지난 일, 해소, 부정, 날짜 기록(지난 진료)
const NOT_NOW=String.raw`(였|었|했)던|처음.{0,12}때(는|엔)|사라|커녕|완료|예방|받았|^\d{1,2}\s*/\s*\d{1,2}`;
// 부정 표현: 부담 낱말 바로 뒤가 '없다·안 한다'이면 괜찮다는 문장
const NEG_NEAR=String.raw`^\s*(성|심)?\s*(은|는|이|가|도|이나|나|을|를)?\s*(일절|전혀|하나도|절대|거의|별로)?\s*(없|안\s*(해|하|함)|않)`;
const NEG_FAR=String.raw`^.{0,10}?(일절|전혀|하나도|절대)\s*(없|안\s*(해|하|함)|않)`;
const NEG_TOPIC={barking:String.raw`헛?짖음|짖는\s*(것|일|소리)`, people:String.raw`입질|경계(심)?|공격(성)?|으르렁|낯가림|겁`,
 alone:String.raw`분리\s*불안`, shedding:String.raw`털\s*(빠짐|날림)`, training:String.raw`배변\s*실수|마킹`};
// '조용한 성격은 아니라는'처럼 괜찮다는 말 뒤에 '아니'가 오면 반대 뜻(부담)
const GOOD_NOT=String.raw`^\S*\s*(성격|편|스타일|아이|친구)?\s*(은|는|이|가)?\s*아니`;
// 's' 플래그: 파이썬 re 의 '.'(줄바꿈만 빼고 모두)와 맞춘다. 문장에는 줄바꿈이 없다.
const rx=s=>new RegExp(s,'s'), rxg=s=>new RegExp(s,'gs');
const RX=Object.fromEntries(Object.entries(PATTERNS).map(([k,p])=>[k,{topic:rx(p.topic),burden:rxg(p.burden),good:rxg(p.good)}]));
const RX_NOT_NOW=rx(NOT_NOW), RX_NEG_NEAR=rx(NEG_NEAR), RX_NEG_FAR=rx(NEG_FAR), RX_GOOD_NOT=rx(GOOD_NOT);
const RX_NEG_TOPIC=Object.fromEntries(Object.entries(NEG_TOPIC).map(([k,p])=>[k,rxg(p)]));
const STRIP=' -·*:';
function strip(s){let a=0,b=s.length;while(a<b&&STRIP.includes(s[a]))a++;while(b>a&&STRIP.includes(s[b-1]))b--;return s.slice(a,b);}
const chars=s=>Array.from(s);

const negated=(s,end)=>{const tail=s.slice(end);return RX_NEG_NEAR.test(tail)||RX_NEG_FAR.test(tail);};
function hits(re,s){let live=false,neg=false;for(const m of s.matchAll(re)){if(negated(s,m.index+m[0].length))neg=true;else live=true;}return [live,neg];}

/** 한 문장 → burden / good / topic / null (Python listing_evidence.classify 와 같음) */
export function classify(ind,s){
 const p=RX[ind];
 const [live,neg]=hits(p.burden,s);
 if(live&&!RX_NOT_NOW.test(s))return 'burden';
 const goods=[...s.matchAll(p.good)];
 if(goods.length&&goods.every(m=>RX_GOOD_NOT.test(s.slice(m.index+m[0].length))))return 'burden';
 if(goods.length||neg||(RX_NEG_TOPIC[ind]&&hits(RX_NEG_TOPIC[ind],s)[1]))return 'good';
 return p.topic.test(s)?'topic':null;
}

export function sentences(text,field=null){
 // 건강 메모는 '중성화 완료, 슬개골 탈구 3기'처럼 쉼표로 나열하므로 쉼표에서도 나눈다
 const sep=field==='text_medical'?/[\n.!?,]+/:/[\n.!?]+/;
 return String(text||'').split(sep).map(strip).filter(s=>chars(s).length>=2);
}

export function extract(dog){
 const out={};
 for(const field of TEXT_FIELDS){
  for(const s of sentences(dog[field],field)){
   for(const [ind,p] of Object.entries(RX)){
    if(ind==='cost'&&field!=='text_medical'&&!p.topic.test(s))continue;
    const kind=classify(ind,s);
    if(kind)(out[ind]??=[]).push({field,quote:chars(s).slice(0,160).join(''),kind});
   }
  }
 }
 return out;
}

export function conflict(ind,val,quotes){
 if(val===null||val===undefined)return null;
 const want=val<=2?'burden':val>=4?'good':null;
 for(const q of quotes[ind]||[])if(q.kind===want)return q;
 return null;
}
