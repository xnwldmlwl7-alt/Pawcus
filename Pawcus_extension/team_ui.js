// [팀원요청 1014] 팀원 UI·UX 요청(2026-10-14)만 모아 둔 파일. 기존 그림체(art.js 손그림)·글꼴·색은 그대로 쓰고 배치만 바꾼다.
// 이 파일과 team_ui.css를 manifest에서 빼면 content.js가 예전 로딩·담은 아이 비교 화면으로 돌아간다.
//  1. 로딩: 동그라미 안에서 사람과 강아지가 세 장면(서로 바라봄 → 두 팔 벌려 기다림 → 안아 줌)으로 가까워지고, 마지막에 테두리가 하트로 바뀐다
//  2. 담은 아이 비교: 가장 잘 맞는 아이를 크게, 나머지는 하트 줄로 → 이름을 누르면 그 아이만 원형 차트(맞음·확인 필요·차이 있음) + 항목 목록, '아이별 자세히'는 버튼으로 펼침
(() => {
  const K = '#2a2420', CR = '#fff4e4', AP = '#ffd2a1', BR = '#c98a52', PK = '#ff9eab', GR = '#a8d99a', SK = '#bfe0ff', YE = '#ffd76a';
  const SKIN = '#ffe2c6', HAIR = '#7a5235';
  const L = `stroke="${K}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"`;
  const p = (d, fill = 'none', extra = '') => `<path d="${d}" fill="${fill}" ${L} ${extra}/>`;
  const dot = (x, y, r = 2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${K}"/>`;
  const blush = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="2" fill="${PK}" opacity=".8"/>`;
  const tube = (d, fill, w = 9) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 4.8}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;
  const smallHeart = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 4 C-2 -2 -10 -1 -9 5 C-8 10 0 14 0 15 C0 14 8 10 9 5 C10 -1 2 -2 0 4Z" fill="#ff6f7f" ${L} stroke-width="${2.2 / s}"/>`;
  const R = s => (globalThis.PawcusArt?.rough ? PawcusArt.rough(s) : s);

  // ── 상반신(동그란 프로필처럼 어깨까지) ──
  const head = (cx, cy, r, fill) => p(`M${cx - r} ${cy} C${cx - r} ${cy - r * .7} ${cx - r * .55} ${cy - r} ${cx} ${cy - r} C${cx + r * .55} ${cy - r} ${cx + r} ${cy - r * .7} ${cx + r} ${cy} C${cx + r} ${cy + r * .66} ${cx + r * .55} ${cy + r * .97} ${cx} ${cy + r * .97} C${cx - r * .55} ${cy + r * .97} ${cx - r} ${cy + r * .66} ${cx - r} ${cy}Z`, fill);
  const shoulders = (cx, top, half, fill) => p(`M${cx - half - 8} 204 C${cx - half - 6} ${top + 16} ${cx - half * .55} ${top} ${cx} ${top} C${cx + half * .55} ${top} ${cx + half + 6} ${top + 16} ${cx + half + 8} 204Z`, fill);
  // 사람: mood = 'plain' | 'smile' | 'joy'(눈 감고 웃음)
  function person(cx, cy, mood) {
    const eyes = mood === 'joy' ? p(`M${cx - 13} ${cy + 2} Q${cx - 9} ${cy - 3} ${cx - 5} ${cy + 2}`, 'none', 'stroke-width="2.3"') + p(`M${cx + 3} ${cy + 1.5} Q${cx + 7} ${cy - 3.5} ${cx + 11} ${cy + 1.5}`, 'none', 'stroke-width="2.3"')
      : mood === 'smile' ? dot(cx - 9, cy + 1, 2.2) + dot(cx + 7, cy + .5, 2) : dot(cx - 11, cy + 1, 2.2) + dot(cx + 5, cy + .5, 2);   // plain: 왼쪽(강아지 쪽)을 바라봄
    const mouth = mood === 'plain' ? p(`M${cx - 7} ${cy + 13} L${cx + 2} ${cy + 12.5}`, 'none', 'stroke-width="2.2"')
      : p(`M${cx - 9} ${cy + 11} Q${cx - 2} ${cy + 19} ${cx + 6} ${cy + 10.5}`, mood === 'joy' ? '#ff8e8e' : 'none', 'stroke-width="2.2"');
    return `${p(`M${cx - 7} ${cy + 22} V${cy + 32} H${cx + 7} V${cy + 22}`, SKIN)}${head(cx, cy, 25, SKIN)}
      ${p(`M${cx - 26} ${cy - 1} C${cx - 28} ${cy - 22} ${cx - 14} ${cy - 30} ${cx + 1} ${cy - 29} C${cx + 17} ${cy - 28} ${cx + 29} ${cy - 18} ${cx + 26} ${cy + 1} C${cx + 21} ${cy - 11} ${cx + 11} ${cy - 15} ${cx - 1} ${cy - 14} C${cx - 13} ${cy - 13} ${cx - 22} ${cy - 8} ${cx - 26} ${cy - 1}Z`, HAIR)}
      ${eyes}${mouth}${blush(cx - 16, cy + 9)}${blush(cx + 13, cy + 8.5)}`;
  }
  // 강아지: mood = 'sad'(귀 처지고 눈물) | 'hope'(귀 쫑긋, 사람 쪽을 봄) | 'joy'(눈 감고 혀)
  function dog(cx, cy, mood) {
    const ears = mood === 'sad' ? p(`M${cx - 18} ${cy - 16} C${cx - 31} ${cy - 13} ${cx - 34} ${cy + 8} ${cx - 27} ${cy + 18} C${cx - 20} ${cy + 18} ${cx - 17} ${cy + 6} ${cx - 15} ${cy - 6}Z`, BR) + p(`M${cx + 18} ${cy - 16} C${cx + 31} ${cy - 13} ${cx + 34} ${cy + 8} ${cx + 27} ${cy + 18} C${cx + 20} ${cy + 18} ${cx + 17} ${cy + 6} ${cx + 15} ${cy - 6}Z`, BR)
      : p(`M${cx - 15} ${cy - 18} C${cx - 25} ${cy - 30} ${cx - 33} ${cy - 18} ${cx - 27} ${cy - 2} C${cx - 21} ${cy - 2} ${cx - 17} ${cy - 8} ${cx - 13} ${cy - 13}Z`, BR) + p(`M${cx + 15} ${cy - 18} C${cx + 25} ${cy - 30} ${cx + 33} ${cy - 18} ${cx + 27} ${cy - 2} C${cx + 21} ${cy - 2} ${cx + 17} ${cy - 8} ${cx + 13} ${cy - 13}Z`, BR);
    const face = mood === 'sad'
      ? p(`M${cx - 11} ${cy - 3} L${cx - 4} ${cy - 7}`, 'none', 'stroke-width="2.2"') + p(`M${cx + 4} ${cy - 7} L${cx + 11} ${cy - 3}`, 'none', 'stroke-width="2.2"') + dot(cx - 5, cy + 1.5, 2.2) + dot(cx + 8, cy + 1.5, 2)
        + `<path d="M${cx - 10} ${cy + 5} C${cx - 12} ${cy + 10} ${cx - 12} ${cy + 13} ${cx - 10} ${cy + 13} C${cx - 8} ${cy + 13} ${cx - 8} ${cy + 10} ${cx - 10} ${cy + 5}Z" fill="${SK}" ${L} stroke-width="1.6"/>` + p(`M${cx - 5} ${cy + 17} Q${cx + 1} ${cy + 12.5} ${cx + 7} ${cy + 17}`, 'none', 'stroke-width="2.2"')
      : mood === 'joy'
        ? p(`M${cx - 11} ${cy + 1} Q${cx - 7} ${cy - 4} ${cx - 3} ${cy + 1}`, 'none', 'stroke-width="2.3"') + p(`M${cx + 3} ${cy + .5} Q${cx + 7} ${cy - 4.5} ${cx + 11} ${cy + .5}`, 'none', 'stroke-width="2.3"')
          + `<path d="M${cx - 2} ${cy + 15} Q${cx} ${cy + 23} ${cx + 4} ${cy + 15}Z" fill="#ff8e9e" ${L} stroke-width="1.8"/>` + p(`M${cx - 6} ${cy + 13} Q${cx - 2} ${cy + 17} ${cx + 1} ${cy + 13} Q${cx + 4} ${cy + 17} ${cx + 8} ${cy + 13}`, 'none', 'stroke-width="2"')
        : `<ellipse cx="${cx - 5}" cy="${cy}" rx="2.4" ry="2.8" fill="${K}"/><ellipse cx="${cx + 9}" cy="${cy - .5}" rx="2.2" ry="2.6" fill="${K}"/><circle cx="${cx - 4.2}" cy="${cy - 1}" r=".8" fill="#fff"/><circle cx="${cx + 9.7}" cy="${cy - 1.5}" r=".7" fill="#fff"/>`
          + p(`M${cx - 3} ${cy + 13} Q${cx + 1} ${cy + 16} ${cx + 3} ${cy + 13} Q${cx + 6} ${cy + 16} ${cx + 9} ${cy + 13}`, 'none', 'stroke-width="2"');
    return `${ears}${head(cx, cy, 24, AP)}<path d="M${cx - 1} ${cy + 6} C${cx} ${cy + 4.5} ${cx + 4} ${cy + 4.5} ${cx + 5} ${cy + 6} C${cx + 4.5} ${cy + 9} ${cx + 3} ${cy + 10} ${cx + 2} ${cy + 10} C${cx + .5} ${cy + 10} ${cx - 1.5} ${cy + 8.5} ${cx - 1} ${cy + 6}Z" fill="${K}"/>${face}${blush(cx - 14, cy + 9)}${blush(cx + 16, cy + 8.5)}`;
  }
  const sparkle = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -8 C1 -2 2 -1 8 0 C2 1 1 2 0 8 C-1 2 -2 1 -8 0 C-2 -1 -1 -2 0 -8Z" fill="${YE}" ${L} stroke-width="${2 / s}"/>`;
  const FUR = '#ffe6c2';   // 강아지 몸(바탕 크림색과 구분되게 조금 진하게)
  const grow = (s, k, cy = 150, dy = 0) => `<g transform="translate(0 ${dy}) translate(100 ${cy}) scale(${k}) translate(-100 -${cy})">${s}</g>`;
  const pages = () => [
    // 1. 슬픈 강아지와 사람이 서로 바라봄
    grow(R(shoulders(64, 156, 30, FUR)) + R(dog(64, 124, 'sad')) + R(shoulders(138, 152, 32, GR)) + R(person(138, 116, 'plain')), 1.12, 150, -6),
    // 2. 사람이 두 팔을 벌리고 웃으며 기다림(팔은 어깨 위에 그려 가려지지 않게)
    grow(R(shoulders(58, 158, 28, FUR)) + R(dog(58, 126, 'hope')) + R(shoulders(134, 156, 28, GR))
      + R(tube('M116 168 C104 162 97 150 95 134', GR, 8.5) + tube('M152 168 C164 162 171 150 173 134', GR, 8.5) + `<circle cx="95" cy="129" r="7.5" fill="${SKIN}" ${L}/><circle cx="173" cy="129" r="7.5" fill="${SKIN}" ${L}/>`)
      + R(person(134, 118, 'smile')) + R(sparkle(104, 82, .7) + sparkle(166, 78, .5)), 1, 150, -4),
    // 3. 사람이 강아지를 안아 줌, 둘 다 웃음 — 하트 안에 들어오게 조금 작게, 위로
    grow(R(shoulders(122, 148, 32, GR)) + R(person(122, 104, 'joy')) + R(shoulders(88, 164, 26, FUR)) + R(dog(88, 134, 'joy'))
      + R(tube('M150 176 C140 186 116 188 96 184 C84 182 74 178 68 172', GR, 10) + `<circle cx="66" cy="170" r="8" fill="${SKIN}" ${L}/>`)
      + R(smallHeart(150, 62, 1) + smallHeart(58, 82, .8) + smallHeart(162, 96, .6)), .82, 110, -14)
  ];
  // 테두리: 원 → 하트 (같은 명령 구조라 CSS d 애니메이션으로 모양이 바뀜)
  const CIRCLE = 'M100 14 C147.5 14 186 52.5 186 100 C186 147.5 147.5 186 100 186 C52.5 186 14 147.5 14 100 C14 52.5 52.5 14 100 14 Z';
  const HEART = 'M100 50 C116 10 190 12 188 76 C186 126 126 158 100 190 C74 158 14 126 12 76 C10 12 84 10 100 50 Z';
  function loadingHtml() {
    const pg = pages();
    return `<main class="pc-body pc-app pc-loading tl-load">
      <div class="tl-stage"><svg class="tl-svg" viewBox="0 0 200 200" role="img" aria-label="사람이 강아지에게 다가가 안아 주는 그림">
        <defs><clipPath id="tlClip"><path class="tl-shape" d="${CIRCLE}"/></clipPath></defs>
        <path class="tl-shape tl-bg" d="${CIRCLE}"/>
        <g clip-path="url(#tlClip)">${pg.map((g, i) => `<g class="tl-p tl-p${i + 1}">${g}</g>`).join('')}</g>
        <g filter="url(#pwL)"><path class="tl-shape tl-frame" d="${CIRCLE}"/></g>
      </svg></div>
      <div class="tl-dots" aria-hidden="true"><i></i><i></i><i></i></div>
      <h2 class="pc-h pc-center">내 생활에 맞는 아이를 찾고 있어요</h2></main>`;
  }

  // ── 담은 아이 비교 ──
  // 하트 개수: 점수를 새로 만들지 않고, 엔진이 공고로 비교한 항목 중 맞는 항목 비율(결과 화면 게이지와 같은 값)을 하트 5개로 나타낸다
  const heartsOf = fit => (fit.n ? Math.round(fit.m / fit.n * 10) / 2 : 0);
  const heartIcon = kind => `<svg class="tu-heart tu-${kind}" viewBox="0 0 24 22" aria-hidden="true"><defs><linearGradient id="tuHalf"><stop offset=".5" stop-color="#ff6f7f"/><stop offset=".5" stop-color="#f6e7dc"/></linearGradient></defs><path d="M12 20 C4 14 1.6 10 2.2 6.4 C2.8 2.6 7.6 1.4 12 6 C16.4 1.4 21.2 2.6 21.8 6.4 C22.4 10 20 14 12 20Z" fill="${kind === 'full' ? '#ff6f7f' : kind === 'half' ? 'url(#tuHalf)' : '#f6e7dc'}" stroke="${K}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  function heartRow(fit, esc, big = false) {
    if (!fit.n) return `<span class="tu-hearts tu-none">공고로 비교할 정보가 없어요</span>`;
    const v = heartsOf(fit), icons = [0, 1, 2, 3, 4].map(i => heartIcon(v >= i + 1 ? 'full' : v >= i + .5 ? 'half' : 'empty')).join('');
    return `<span class="tu-hearts ${big ? 'tu-big' : ''}" role="img" aria-label="하트 5개 중 ${v}개">${icons}<small>맞는 항목 ${fit.m}/${fit.n}</small></span>`;
  }
  const MEDAL = ['#ffd76a', '#dfe3ea', '#f2c29b'];
  const medal = i => `<span class="tu-medal" style="background:${MEDAL[i] || '#f1ece4'}">${i + 1}</span>`;
  const TONES = [['ok', '맞음', '#7cc983'], ['must', '확인 필요', '#ffcf4d'], ['burden', '차이 있음', '#f2786b'], ['unknown', '정보 없음', '#ddd6cc']];
  function donut(counts, esc) {
    const total = TONES.reduce((s, [k]) => s + counts[k], 0) || 1, r = 42, c = 2 * Math.PI * r;
    let off = 0;
    const segs = TONES.filter(([k]) => counts[k]).map(([k, , col]) => { const len = counts[k] / total * c, s = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${col}" stroke-width="20" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"/>`; off += len; return s; }).join('');
    return `<div class="tu-donut"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="42" fill="none" stroke="#f1ece4" stroke-width="20"/>${segs}<g filter="url(#pwL)"><circle cx="60" cy="60" r="52.5" fill="none" stroke="${K}" stroke-width="1.6"/><circle cx="60" cy="60" r="31.5" fill="#fff" stroke="${K}" stroke-width="1.6"/></g></svg>
      <div class="tu-donut-mid"><b>${counts.ok}</b><small>맞음</small></div></div>
      <ul class="tu-legend">${TONES.map(([k, l, col]) => `<li><i style="background:${col}"></i>${esc(l)}<b>${counts[k]}</b></li>`).join('')}</ul>`;
  }
  function itemRow(x, key, esc) {
    const more = x.mine || x.why || x.todo || (x.text && x.text !== x.line);
    const panel = more ? `<div class="dx-more" data-panel="${key}" hidden>${x.mine ? `<p class="hx-mine">내 답 · ${esc(x.mine)}</p>` : ''}<p>${esc(x.text || x.line)}</p>${x.why ? `<p>${esc(x.why)}</p>` : ''}${x.todo ? `<p class="hx-todo">${esc(x.todo)}</p>` : ''}</div>` : '';
    return `<li class="tu-item">${more ? `<button class="tu-item-btn" data-pop="${key}" data-pop-title="${esc(x.title)} · ${x.tone === 'burden' ? '왜 맞지 않나요?' : x.tone === 'must' ? '왜 확인해야 하나요?' : '판단 근거'}">` : '<div class="tu-item-btn">'}<b>${esc(x.title)}</b><span>${esc(x.line)}</span>${more ? '<i class="tu-pin">›</i></button>' : '</div>'}${panel}</li>`;
  }
  function dogPanel(d, i, esc) {
    const counts = {ok: d.ok.length, must: d.must.length, burden: d.burden.length, unknown: d.unknown.length};
    const group = (tone, label, list) => list.length ? `<section class="tu-grp tu-g-${tone}"><h4><i></i>${esc(label)} <small>${list.length}</small></h4><ul>${list.map((x, j) => itemRow({...x, tone}, `tu-${i}-${tone}-${j}`, esc)).join('')}</ul></section>` : '';
    return `<div class="tu-panel" data-tu-panel="${i}" ${i ? 'hidden' : ''}>
      <div class="tu-chart">${donut(counts, esc)}</div>
      ${group('ok', '맞음', d.ok.map(x => ({title: x.title, line: x.short || x.text, text: x.text, mine: x.mine})))}
      ${group('must', '확인 필요', d.must)}
      ${group('burden', '차이 있음', d.burden)}
      ${d.unknown.length ? `<section class="tu-grp tu-g-unknown"><h4><i></i>정보 없음 <small>${d.unknown.length}</small></h4><p class="tu-unk">${esc(d.unknown.join(', '))} — 공고에 없어서 하루 리허설과 보호소 질문으로 확인해요.</p></section>` : ''}</div>`;
  }
  function heartsCompareHtml(m, h) {
    const {esc} = h, [top, ...rest] = m.dogs;
    const topLabel = m.same ? '먼저 살펴볼 아이' : m.topBurden ? '부담이 가장 적어요' : '가장 잘 맞아요';
    // [팀원요청 1014-2] 사진을 누르면 포인핸드 공고(새 탭). 사진 밖을 누르면 전처럼 '아이마다 다른 점'에서 그 아이
    const photoLink = (d, small) => `<a class="tu-ph tu-ph-link ${small ? 'tu-ph-s' : ''}" href="${esc(d.url)}" target="_blank" rel="noopener" aria-label="${esc(d.name)} 공고 보기" title="공고 보기"><img src="${esc(d.photo)}" alt=""><span class="tu-ph-tip">공고 보기</span></a>`;
    // [팀원요청 1014-3] 1등도 2·3등과 같은 크기의 한 줄 카드. 이름 옆에 짧은 이유, 오른쪽에 '공고'(새 탭)·'하루 리허설'(그 아이만) 버튼.
    // 줄을 눌러 '아이마다 다른 점'으로 내려가던 동작은 뺌(아이마다 다른 점은 아래 이름 버튼으로)
    const rankRow = (d, i) => `<div class="tu-row tu-r${i}">${medal(i)}${photoLink(d, true)}<span class="tu-row-tx"><span class="tu-row-name"><b title="${esc(d.name)}">${esc(d.name)}</b>${d.why ? `<small class="tu-row-why" title="${esc(d.why)}">${esc(d.why)}</small>` : ''}</span>${heartRow(d.fit, esc)}</span>
      <span class="tu-row-acts"><a class="tu-act" href="${esc(d.url)}" target="_blank" rel="noopener">공고</a><button class="tu-act tu-act-rh" data-rehearse="${esc(d.id)}">하루 리허설</button></span></div>`;
    const rows = m.dogs.map(rankRow).join('');
    // [팀원요청 1014-3] 요약 문장과 공통 걱정 문장을 한 상자·한 문장으로: "보리가 가장 잘 맞고, 제리, 말랑은 털 관리가 부담이 될 수 있어요."
    const lead = /^담은 아이들 중에서는 (.+) 내 생활과 가장 잘 맞아요\.$/.exec(m.summary);
    const summaryLine = lead && m.others.length ? `${lead[1]} 가장 잘 맞고, ${m.others.join(' ')}` : [m.summary, ...m.others].join(' ');
    const chips = m.dogs.length > 1 ? `<nav class="tu-chips" role="tablist" aria-label="아이 고르기">${m.dogs.map((d, i) => `<button role="tab" class="${i ? '' : 'on'}" aria-selected="${!i}" data-tu-pick="${i}"><img src="${esc(d.photo)}" alt="">${esc(d.name)}</button>`).join('')}</nav>` : '';
    return `<main class="pc-body pc-app pc-hres tu-hres"><div class="ap-head"><div><h2 class="pc-h">담은 아이 비교 <span class="pc-h-count">${m.count}마리</span></h2></div><button class="pc-link" data-go="hearts">담은 아이 바꾸기</button></div>
      <p class="pc-why-rh tu-sum">${summaryLine}</p>
      <div class="tu-rank"><div class="tu-rows">${rows}</div></div>${m.skippedHtml}
      <section class="tu-diff" id="tu-diff"><h3 class="dx-h">아이마다 다른 점</h3>${chips}${m.dogs.map((d, i) => dogPanel(d, i, esc)).join('')}</section>
      <button class="pc-textbtn" data-go="results">추천받은 아이 보기</button></main>`;
  }
  function bind(root) {
    const pick = i => {
      root.querySelectorAll('[data-tu-panel]').forEach(p => { p.hidden = p.dataset.tuPanel !== String(i); });
      root.querySelectorAll('.tu-chips [data-tu-pick]').forEach(b => { const on = b.dataset.tuPick === String(i); b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    };
    const choose = b => { pick(b.dataset.tuPick); if (!b.closest('.tu-chips')) root.querySelector('#tu-diff')?.scrollIntoView({block: 'start', behavior: 'smooth'}); };
    root.querySelectorAll('[data-tu-pick]').forEach(b => {
      b.addEventListener('click', e => { if (e.target.closest('a')) return; choose(b); });   // 사진(공고 링크)은 공고만 연다
      b.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a') && b.tagName !== 'BUTTON') { e.preventDefault(); choose(b); } });
    });
    root.querySelector('[data-tu-detail]')?.addEventListener('click', e => {
      const btn = e.currentTarget, list = root.querySelector('.tu-detail'); if (!list) return;
      list.hidden = !list.hidden; btn.setAttribute('aria-expanded', !list.hidden); btn.classList.toggle('open', !list.hidden);
      if (!list.hidden) list.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    });
  }
  // [팀원요청 1014-9] 자세히 화면의 '잘 맞음' 하트: 공고로 비교한 항목 중 맞는 비율만큼 아래에서부터 차오름(다 맞으면 가득). 새 점수를 만들지 않고 기존 m/n 그대로
  const HEART_D = 'M50 88 C20 66 4 48 6 28 C8 10 26 2 40 8 C45 10 48 14 50 18 C52 14 55 10 60 8 C74 2 92 10 94 28 C96 48 80 66 50 88Z';
  function fitHeartHtml(fit, sentenceHtml) {
    const frac = fit.n ? fit.m / fit.n : 0, top = (4 + 86 * (1 - frac)).toFixed(1);
    return `<div class="fg fg-big tu-fit"><svg class="tu-fit-heart" viewBox="0 0 100 92" role="img" aria-label="공고로 비교한 ${fit.n}가지 중 ${fit.m}가지가 맞음">
        <defs><clipPath id="tuFitClip"><path d="${HEART_D}"/></clipPath></defs>
        <path d="${HEART_D}" fill="#f6e7dc"/><rect x="0" y="${top}" width="100" height="92" fill="#ff7f8a" clip-path="url(#tuFitClip)"/>
        <path d="${HEART_D}" fill="none" stroke="${K}" stroke-width="2.6" stroke-linejoin="round"/></svg>
      <p class="tu-fit-tx">${sentenceHtml}</p></div>`;
  }
  globalThis.PawcusTeam = {fitHeartHtml, loadingHtml, LOADING_MS: 3300, heartsCompareHtml, bind};
})();
