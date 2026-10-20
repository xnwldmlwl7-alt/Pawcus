# Pawcus 매칭 기능 사용법 (UI 담당용)

화면(HTML·CSS)은 UI 담당이 자유롭게 만든다. 이 폴더의 `pawcus_api.mjs`는 **데이터만** 돌려준다.
추천·판정 규칙은 매칭엔진 Python판과 같다(10/07 1,405개 항목 대조 일치). 후속 질문 규칙은 노트북 10에서 400건 자동 점검했다.

## 엔진 판 (2026-10-08 갱신)

`core.mjs`·`evidence.mjs`·`engine-data.json`을 Python 최신판과 맞췄다. 입양자 10명 × 113마리에서 판정·점수·꼭 확인·모순·보호소 질문·추천 순서 등 **7,930개 항목이 모두 같다.**
- 소개글 값은 한 단계 더 나빠도 감당 범위면 질문하지 않고 `card.noted`에 남긴다. 물을 때는 확인형 문장으로 묻는다.
- 부정 표현 분류를 보완했다('입질은 일절 없는' → 괜찮음).
- 임시 견종값을 삭제했다(짖음·털 빠짐 → 모름 → 보호소 질문).
- 동점 정렬: 판정 → 점수 → 꼭 확인 → 비교 지표 수 → 크기 차이 → 감당 여유 → 공고번호.

## 지금 연결된 것 (0.1.1)

`content.js`에서 바꾼 곳은 아래뿐이다. 화면 템플릿(intro·질문·완료·선택·로딩·추천·비교 화면, animalCard, compareMarkup, CSS)은 손대지 않았다.

| 위치 | 바꾼 것 | 화면 변화 |
|---|---|---|
| `recommendationList()` (새 함수) | 강아지 추천을 매칭 엔진으로 계산한다. 고양이와 엔진 오류 때는 기존 `recommendation()`을 쓴다 | 같은 카드에 엔진이 고른 3마리가 나온다 |
| `render('recommend')` | `recommendation(data)` → `await recommendationList(data)` 한 줄 | 없음 |
| `isAnimalPhoto()` | 사진 규칙이 포인핸드 보호소 아이콘(`img/shelter_icon…png`)을 잡던 문제를 고쳤다 | 집 그림 대신 공고 사진이 보이고, ♡도 사진 위에 붙는다 |
| 종 판별 | `[개]` 표시를 먼저 본다(메뉴의 '고양이' 글자 때문에 개를 고양이로 보던 문제) | 없음 |
| 문장으로 답하기 | 보내기 버튼에서 `opts`가 정의되지 않아 나던 오류를 고쳤다 | 오류가 사라진다 |
| `manifest.json` | `web_accessible_resources: matching/*`, 버전 0.1.1 | 없음 |

추천 목록 각 항목에는 기존 칸(id·url·species·headline·shelter·phone·photo·area)에 더해 **`.pawcus`(전체 카드 데이터)**가 붙어 있다. 지금 화면은 이 칸을 쓰지 않는다. 추천 이유·고려해야 할 사항·후속 질문을 보여 주려면 아래 칸을 그리면 된다.

### UI 담당이 바꿔 주면 좋은 문구 (Claude는 건드리지 않음)

- 추천 화면 안내 문구 "현재 포인핸드 목록·상세에서 확인한 공고 중…"은 이제 사실과 다르다. 강아지는 생활 조건 답으로 10/02 수집 113마리 중에서 고른다(`rec.dataNote`, `rec.pool`).
- `animalCard`의 "추천 이유 · 희망 지역 … 공고"는 지역만 보고 만든 문장이다. 항목의 `.pawcus.reasons`를 쓰면 엔진의 추천 이유가 나온다.

## 불러오기

```js
const api = await import(chrome.runtime.getURL('matching/pawcus_api.mjs'));
const data = await store.get();                       // 기존 저장소
const rec = await api.recommendCards(data.profile);   // {cards, pool, groups, flags, unknownSize, dataNote}
const card = await api.cardFor('경기-가평-2026-00034', data.profile);   // 113마리 밖이면 null
```

## 카드 칸 (`rec.cards[i]`, `cardFor()` 결과)

| 칸 | 내용 | 예 |
|---|---|---|
| `dog_id`, `name`, `url` | 공고번호, 이름, 포인핸드 공고 주소 | `세모🌪️` |
| `photo`, `photos[]` | 대표 사진, 전체 사진 주소 | animal.go.kr 사진 |
| `headline`, `region` | 품종 / 나이 / 체중, 지역 | `[개] 믹스견 / 2022(년생) / 23(Kg)` |
| `shelter`, `tel`, `adoption_process` | 보호소 이름·전화·입양 절차 | |
| `verdict` | `잘 맞음` / `맞을 가능성 · 확인 필요` / `부담 있음` / `판단 불가` | |
| `coverage` | 비교한 지표 수(최대 8) | `5` |
| `reasons[]` | **추천 이유** 문장 | `활동 요구: 아이 4단계 · 내가 괜찮은 정도 5단계 (공고 기재)` |
| `considerations[]` | **고려해야 할 사항** `{level, text, topic_id?}` — level: `부담` `꼭 확인` `고려` `확인함` `참고` | `{level:'꼭 확인', text:'비용·건강: 공고 값과 다른 문장이 있어요 — "아나플라즈마 양성"'}` |
| `adopter_questions[]` | **입양자에게 묻는 후속 질문** `{topic_id, topic, question, options[], answer}` | 진드기 예방약을 매달 챙길 수 있나요? [할 수 있어요 / 조금 어려워요 / 어려워요 / 잘 모르겠어요] |
| `shelter_questions[]` | **보호소에 물어볼 것** `{must, common, topic, text}` — must=꼭 확인(★) | |
| `learn_more[]` | **더 알아보기** `{source, title, text, url, license, topic}` | 서울시 문제은행 문항(원문 그대로), 위키백과 |

## 후속 질문 답 처리

```js
let profile = api.withFollowupAnswer(data.profile, card.dog_id, 'ANAPLASMA', '조금 어려워요');
data.profile = profile; await store.set(data);          // 저장은 화면 쪽에서
const updated = await api.cardFor(card.dog_id, profile); // verdict·considerations가 바뀐 카드
```

- `조금 어려워요` → 고려 사항 맨 위에 `[부담] … 돌봄`, 판정은 최대 '확인 필요'
- `어려워요` → 판정 '부담 있음'
- `할 수 있어요` → 해당 고려 사항이 '확인함'으로 바뀜, `잘 모르겠어요`·답 없음 → 그대로
- 점수는 바꾸지 않는다. 그 아이의 판정만 바뀐다. 답은 `profile.followups[공고번호][주제]`에 들어간다.

## 표시할 때 지킬 것

- `learn_more`의 **서울시 문제은행** 문항은 공공누리 4유형(변경 금지)이다. 문제·정답·해설을 고쳐 쓰지 말고 그대로 보여 주고, `url`·`license`로 출처를 붙인다.
- 위키백과는 CC BY-SA 4.0이다. 출처 링크를 붙인다.
- 로얄캐닌 항목(`source: '로얄캐닌'`)은 사용 범위를 팀이 정한다.
- 견종 경향은 '경향'으로만 보여 준다. 개체 성격으로 단정하지 않는다.
- 추천 대상은 **10/02 수집 113마리**다(`rec.dataNote`). 그 밖의 공고는 `cardFor()`가 null을 돌려준다.

## 참고

전달 폴더의 `기능구현수정_엔진연결/참고_기능시연판_0.3.0/`에 이 데이터를 한 카드로 그려 본 예시 화면이 있다. 디자인 제안이 아니라 기능 확인용이다.
