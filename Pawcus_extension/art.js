// Pawcus 그림(2026-10-12): Texture 온보딩처럼 손으로 그린 듯 살짝 흔들리는 선 + 선에서 조금 어긋난 거친 색칠. 3D 이모티콘 대신 모든 아이콘·장면에 쓴다.
// 그리는 법: 같은 모양을 '색 층'(살짝 비껴 찍고 크레파스 결)과 '선 층'(손떨림 흔들림)으로 두 번 그린다 — rough()
// 선 #33281f 2.4px · 크림 #fff4e4 · 살구 #ffd2a1 · 주황 #ffa24c(포인핸드 주황 계열) · 갈색 #c98a52 · 분홍 #ff9eab · 초록 #a8d99a · 하늘 #bfe0ff · 노랑 #ffd76a
(() => {
  const K = '#2a2420', CR = '#fff4e4', AP = '#ffd2a1', OR = '#ffa24c', BR = '#c98a52', PK = '#ff9eab', GR = '#a8d99a', SK = '#bfe0ff', YE = '#ffd76a', GY = '#e4ded4';
  const L = `stroke="${K}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"`;
  const p = (d, fill = 'none', extra = '') => `<path d="${d}" fill="${fill}" ${L} ${extra}/>`;
  const dot = (x, y, r = 1.7) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${K}"/>`;
  const blush = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.5" fill="${PK}" opacity=".8"/>`;
  const tube = (d, fill, w = 4) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 4.8}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;

  // 얼굴(작은 아이콘·대화 얼굴용): 이목구비는 얼굴 위쪽 가운데에 작게 모으고, 일부러 조금씩 짝짝이로(손으로 그린 느낌)
  const dogFace = (o = {}) => `${p('M19 18 C11 17 8 28 12 35 C17 35 20 29 21 23Z', BR)}${p('M45 18 C53 17 56 28 52 35 C47 35 44 29 43 23Z', BR)}
    ${p('M16 31 C16 19 23 13 32 13 C41 13 48 19 48 31 C48 41 41 47 32 47 C23 47 16 41 16 31Z', AP)}
    ${o.happy ? p('M26.3 24.8 Q27.9 22.3 29.7 24.6', 'none', 'stroke-width="2.2"') + p('M34.1 24.3 Q35.8 22.4 37.3 24.9', 'none', 'stroke-width="2.2"') : `<ellipse cx="28.1" cy="24.2" rx="1.6" ry="1.9" fill="${K}"/><ellipse cx="35.9" cy="23.8" rx="1.4" ry="1.7" fill="${K}"/>`}
    <path d="M30.4 27.6 C31.2 26.7 33.2 26.8 33.7 27.7 C33.4 29 32.4 29.6 31.8 29.5 C31 29.4 30.3 28.6 30.4 27.6Z" fill="${K}"/>${p('M30.1 31 Q31.2 32.7 32.1 31 Q33.2 32.9 34.5 31.2', 'none', 'stroke-width="1.8"')}${blush(23.6, 30.4)}${blush(40.6, 30)}`;
  const catFace = (o = {}) => `${p('M18 26 L18 10 L29 17Z', OR)}${p('M46 26 L46 10 L35 17Z', OR)}<path d="M21.5 19.5 L21.5 14.5 L25 17Z" fill="${PK}"/><path d="M42.5 19.5 L42.5 14.5 L39 17Z" fill="${PK}"/>
    ${p('M16 32 C16 21 23 16 32 16 C41 16 48 21 48 32 C48 41 41 47 32 47 C23 47 16 41 16 32Z', OR)}
    ${p('M29 18 V21 M32 17.5 V21.5 M35 18 V21', 'none', 'stroke-width="2"')}
    ${o.love ? `<path d="M28 25.6 c-1.1-1.9-3.6-.6-2.4 1.1 l2.4 2.1 2.4-2.1 c1.2-1.7-1.3-3-2.4-1.1z" fill="#e8475f"/><path d="M36.1 25.3 c-1.1-1.9-3.6-.6-2.4 1.1 l2.4 2.1 2.4-2.1 c1.2-1.7-1.3-3-2.4-1.1z" fill="#e8475f"/>` : o.happy ? p('M26.4 27 Q28 24.7 29.7 26.8', 'none', 'stroke-width="2.2"') + p('M34.3 26.7 Q36 24.5 37.6 27.1', 'none', 'stroke-width="2.2"') : `<ellipse cx="28.1" cy="26.4" rx="1.6" ry="1.9" fill="${K}"/><ellipse cx="35.8" cy="26" rx="1.4" ry="1.7" fill="${K}"/>`}
    <path d="M30.7 29.3 L33.4 29.1 L32.1 30.7Z" fill="${PK}" ${L} stroke-width="1.5"/>${p('M30 32.3 Q31 33.7 32.1 32.2 Q33.2 33.9 34.3 32.4', 'none', 'stroke-width="1.8"')}
    ${p('M24.5 29.8 L18.6 28.7 M24.6 31.8 L19 33 M39.6 29.6 L45.6 28.5 M39.5 31.7 L45.2 33', 'none', 'stroke-width="1.7"')}${blush(23.8, 32.2)}${blush(40.4, 32)}`;
  // 앉아 있는 강아지·고양이(카드·빈 화면용)
  const dogSit = (o = {}) => `${tube('M45 54 C53 52 55 45 52 40', CR, 4)}${p('M19 60 C16 48 21 41 32 41 C43 41 48 48 45 60Z', CR)}<ellipse cx="38" cy="47" rx="4" ry="3" fill="${AP}"/>
    ${p('M27 60 V51 M37 60 V51')}<g transform="translate(0 -6) scale(1)">${dogFace(o)}</g>`;
  const catSit = (o = {}) => `${tube('M44 58 C55 58 57 47 50 42', OR, 4)}${p('M20 60 C17 48 22 40 32 40 C42 40 47 48 44 60Z', OR)}<ellipse cx="32" cy="50" rx="6" ry="7" fill="${CR}"/>
    ${p('M27 60 V52 M37 60 V52')}${p('M21 48 Q24 47 25 49 M43 48 Q40 47 39 49', 'none', 'stroke-width="1.8"')}<g transform="translate(0 -8)">${catFace(o)}</g>`;

  const heart = (fill = '#ff6f7f') => `<path d="M32 52 C14 40 10 30 14 22 C18 14 28 14 32 22 C36 14 46 14 50 22 C54 30 50 40 32 52Z" fill="${fill}" ${L}/>${p('M21 24 Q19 28 21 31', 'none', 'stroke="#fff" stroke-width="2.4"')}`;
  const pawPrint = (fill = OR) => `<ellipse cx="32" cy="40" rx="11" ry="9" fill="${fill}" ${L}/><ellipse cx="18" cy="28" rx="4.5" ry="5.5" fill="${fill}" ${L}/><ellipse cx="26" cy="20" rx="4.5" ry="5.5" fill="${fill}" ${L}/><ellipse cx="38" cy="20" rx="4.5" ry="5.5" fill="${fill}" ${L}/><ellipse cx="46" cy="28" rx="4.5" ry="5.5" fill="${fill}" ${L}/>`;
  const sparkle = (x, y, s = 1, fill = YE) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -8 C1 -2 2 -1 8 0 C2 1 1 2 0 8 C-1 2 -2 1 -8 0 C-2 -1 -1 -2 0 -8Z" fill="${fill}" ${L} stroke-width="${2 / s}"/>`;

  const ICONS = {
    'dog': () => dogSit(), 'dog-happy': () => dogSit({happy: true}), 'dog-face': () => dogFace(), 'dog-face-happy': () => dogFace({happy: true}),
    'cat': () => catSit(), 'cat-happy': () => catSit({happy: true}), 'cat-love': () => catSit({love: true}), 'cat-face': () => catFace(), 'cat-grin': () => catFace({happy: true}),
    'heart': () => heart(), 'yellow-heart': () => heart(OR), 'heart-sparkle': () => heart() + sparkle(51, 14, .9) + sparkle(13, 46, .6),
    'paw': () => pawPrint(), 'paw-dog': () => pawPrint(BR), 'paw-cat': () => pawPrint(PK),
    'memo': () => `${p('M16 12 H44 L50 18 V56 H16Z', CR)}${p('M44 12 V18 H50')}${p('M22 26 H42 M22 33 H42 M22 40 H34')}${p('M40 48 L52 36 L56 40 L44 52 L39 53Z', OR)}`,
    'clipboard': () => `${p('M15 14 H49 V58 H15Z', CR)}${p('M24 10 H40 V18 H24Z', OR)}${p('M21 28 L24 31 L29 25 M33 28 H43 M21 40 L24 43 L29 37 M33 40 H43')}`,
    'home': () => `${p('M12 30 L32 12 L52 30', 'none')}${p('M17 27 V54 H47 V27 L32 14Z', CR)}${p('M12 31 L32 13 L52 31 L47 31 L32 18 L17 31Z', OR)}${p('M27 54 V41 H37 V54', AP)}<circle cx="34.5" cy="47.5" r="1.3" fill="${K}"/>${p('M48 54 C46 46 50 42 54 42 C58 42 60 48 56 54Z', GR)}`,
    'house': () => ICONS.home(),
    'gear': () => `${p('M32 10 L36 16 L43 14 L44 21 L51 23 L48 30 L53 35 L47 39 L48 46 L41 46 L38 53 L32 49 L26 53 L23 46 L16 46 L17 39 L11 35 L16 30 L13 23 L20 21 L21 14 L28 16Z', AP)}<circle cx="32" cy="32" r="7" fill="${CR}" ${L}/>`,
    'magnifier': () => `<circle cx="27" cy="27" r="14" fill="${SK}" ${L}/>${tube('M38 38 L52 52', OR, 5)}<g transform="translate(15 15) scale(.38)">${pawPrint(CR)}</g>`,
    'search': () => ICONS.magnifier(),
    'sun-face': () => `${p('M32 6 V12 M32 52 V58 M6 32 H12 M52 32 H58 M13.6 13.6 L17.8 17.8 M46.2 46.2 L50.4 50.4 M50.4 13.6 L46.2 17.8 M17.8 46.2 L13.6 50.4')}<circle cx="32" cy="32" r="15" fill="${YE}" ${L}/>${p('M25 31 Q27 28 29 31 M35 31 Q37 28 39 31')}${p('M28 36 Q32 39.5 36 36')}${blush(24, 35.5)}${blush(40, 35.5)}`,
    'money': () => `<ellipse cx="32" cy="44" rx="18" ry="7" fill="${YE}" ${L}/>${p('M14 36 V44 M50 36 V44', 'none')}<ellipse cx="32" cy="36" rx="18" ry="7" fill="${YE}" ${L}/>${p('M14 28 V36 M50 28 V36')}<ellipse cx="32" cy="28" rx="18" ry="7" fill="#ffe59a" ${L}/>${p('M29 25 Q32 23 35 25 Q32 28 29 31 Q32 33 35 31', 'none', 'stroke-width="2"')}`,
    'clock': () => `${p('M18 12 L12 18 M46 12 L52 18')}<circle cx="32" cy="34" r="19" fill="${CR}" ${L}/>${p('M32 22 V34 L40 39')}${p('M22 52 L19 57 M42 52 L45 57')}`,
    'bone': () => `${p('M20 24 C14 18 22 10 26 16 L38 28 C44 22 52 30 46 34 C52 38 44 46 40 40 L28 28 C22 34 14 26 20 24Z', CR)}`,
    'speaker': () => `${p('M12 26 H22 L34 16 V48 L22 38 H12Z', OR)}${p('M41 25 Q46 32 41 39 M46 20 Q55 32 46 44')}`,
    'broom': () => `${tube('M44 10 L30 34', BR, 4)}${p('M22 32 L36 38 L30 56 C24 56 16 52 14 46Z', YE)}${p('M20 40 L28 44 M18 46 L26 50')}`,
    'people': () => `<circle cx="23" cy="22" r="8" fill="${AP}" ${L}/>${p('M10 50 C10 38 16 33 23 33 C30 33 36 38 36 50Z', SK)}<circle cx="42" cy="26" r="7" fill="${AP}" ${L}/>${p('M31 52 C31 42 36 37 42 37 C48 37 54 42 54 52Z', GR)}`,
    'cap': () => `${p('M6 26 L32 14 L58 26 L32 38Z', K, 'fill-opacity=".85"')}${p('M18 32 V44 C18 50 46 50 46 44 V32', OR)}${p('M52 28 V42')}<circle cx="52" cy="44" r="2.6" fill="${YE}" ${L}/>`,
    'baby': () => `<circle cx="32" cy="32" r="18" fill="${AP}" ${L}/>${p('M28 16 C30 12 34 12 35 15')}${dot(26, 31)}${dot(38, 31)}<circle cx="32" cy="40" r="3.4" fill="${PK}" ${L}/>${blush(21, 37)}${blush(43, 37)}`,
    'pill': () => `<g transform="rotate(-35 32 32)">${p('M14 32 C14 25 19 22 24 22 H32 V42 H24 C19 42 14 39 14 32Z', '#fff')}${p('M32 22 H40 C45 22 50 25 50 32 C50 39 45 42 40 42 H32Z', OR)}</g>`,
    'hospital': () => `${p('M12 22 H52 V54 H12Z', CR)}${p('M24 22 V16 H40 V22')}${p('M28 30 H36 V35 H41 V43 H36 V48 H28 V43 H23 V35 H28Z', '#ff6f7f')}`,
    'sparkles': () => sparkle(30, 32, 1.9) + sparkle(50, 14, .9, OR) + sparkle(14, 50, .8, OR),
    'question': () => `${p('M10 30 C10 18 20 12 32 12 C44 12 54 18 54 30 C54 42 44 48 32 48 L22 56 L24 46 C15 43 10 37 10 30Z', CR)}${p('M27 25 C27 20 37 20 37 25 C37 29 32 29 32 34')}${dot(32, 40, 2)}`,
    'moon': () => `${p('M40 12 C26 12 18 22 18 33 C18 45 28 53 40 52 C30 47 26 40 26 32 C26 23 31 16 40 12Z', YE)}${sparkle(46, 30, .6, '#fff')}`,
    'bell': () => `${p('M20 42 V30 C20 22 25 17 32 17 C39 17 44 22 44 30 V42 L48 47 H16Z', YE)}<circle cx="32" cy="51" r="3.6" fill="${OR}" ${L}/>${p('M32 12 V17')}`,
    'warning': () => `${p('M32 10 L56 52 H8Z', YE)}${p('M32 25 V38')}${dot(32, 45, 2.2)}`,
    'phone': () => `${p('M18 12 L26 10 L30 22 L24 26 C27 33 31 37 38 40 L42 34 L54 38 L52 46 C50 52 40 54 30 46 C20 38 12 28 12 22 C12 16 14 13 18 12Z', OR)}`,
    'calendar': () => `${p('M10 16 H54 V54 H10Z', CR)}${p('M10 16 H54 V26 H10Z', OR)}${p('M20 10 V20 M44 10 V20')}<g fill="${K}"><circle cx="22" cy="36" r="2"/><circle cx="32" cy="36" r="2"/><circle cx="42" cy="36" r="2"/><circle cx="22" cy="45" r="2"/><circle cx="32" cy="45" r="2"/></g>`,
    'check': () => `<circle cx="32" cy="32" r="20" fill="${GR}" ${L}/>${p('M23 32 L30 39 L42 25', 'none', 'stroke-width="3.4"')}`,
    'party': () => `${p('M12 54 L22 22 L44 44Z', YE)}${p('M18 40 L30 48 M15 47 L22 51')}${sparkle(44, 16, .8, OR)}<circle cx="52" cy="30" r="3" fill="${PK}" ${L}/><circle cx="34" cy="12" r="2.6" fill="${SK}" ${L}/>`
  };
  // 동물별 대표 그림(아이콘 이름이 없으면 발바닥)
  // 손그림 효과: 선은 낮은 주파수로 출렁이게, 색은 선에서 비껴 찍고 점점이 빠진 크레파스 결
  const FILTERS = `<defs><filter id="pwL" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="pwF" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="3" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="4" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="5" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 2.05" result="m"/><feComposite in="d" in2="m" operator="in"/></filter></defs>`;
  const rough = html => {
    const fillLayer = html.replace(new RegExp(`stroke="${K}"`, 'g'), 'stroke="none"');
    const lineLayer = html.replace(/fill="(?!#2a2420)[^"]*"/g, 'fill="none"');   // 꼬리처럼 굵은 선 안의 색은 선 층에도 남긴다
    // 밑바탕: 모양대로 옅은 종이색을 먼저 깔아 뒤의 선이 비치지 않게(거친 색은 그 위에 비껴 찍힘)
    const base = fillLayer.replace(/fill="(?!#2a2420|none)[^"]*"/g, 'fill="#fffaf2"').replace(/stroke="(?!none)[^"]*"/g, 'stroke="#fffaf2"');
    return `${FILTERS}<g>${base}</g><g filter="url(#pwF)" transform="translate(1.4 1.8)">${fillLayer}</g><g filter="url(#pwL)">${lineLayer}</g>`;
  };
  const svg = (name, size = 24, cls = '') => `<svg class="pc-art ${cls}" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" focusable="false">${rough((ICONS[name] || ICONS.paw)())}</svg>`;

  // 큰 장면: 햇살 드는 방, 쿠션 위 강아지와 고양이(첫 화면·홈)
  // 큰 장면: 물건마다 따로 그려 겹친 뒤쪽 선(창문·소파)이 앞쪽 동물에 비치지 않게 한다
  const hero = () => `<svg class="pc-art-hero" viewBox="0 0 360 200" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
    <rect x="0" y="0" width="360" height="200" fill="#fff3e6"/>
    ${rough(`<path d="M244 20 H326 V104 H244Z" fill="${SK}" ${L}/><path d="M285 20 V104 M244 62 H326" ${L}/><circle cx="306" cy="40" r="10" fill="${YE}" ${L}/><path d="M238 104 H332" ${L}/>`)}
    ${rough(`<path d="M34 150 C28 118 40 98 54 94 C68 98 76 118 70 150Z" fill="${GR}" ${L}/><path d="M52 150 V108 M52 122 L42 112 M52 132 L62 118" ${L}/><path d="M28 150 H76 L70 182 H34Z" fill="${OR}" ${L}/>`)}
    ${rough(`<path d="M-4 182 H364 V204 H-4Z" fill="#ffe7cf" ${L}/>`)}
    ${rough(`<path d="M104 182 C96 158 128 148 196 148 C266 148 298 158 290 182Z" fill="${AP}" ${L}/>`)}
    ${rough(`<g transform="translate(92 58) scale(1.9)">${dogSit({happy: true})}</g>`)}
    ${rough(`<g transform="translate(192 70) scale(1.65)">${catSit({happy: true})}</g>`)}
    ${rough(`<path d="M196 48 c-3-5-10-2-7 3 l7 6 7-6 c3-5-4-8-7-3z" fill="#ff6f7f" ${L}/>${sparkle(98, 66, .7, YE)}${sparkle(318, 150, .6, YE)}`)}</svg>`;

  globalThis.PawcusArt = {svg, hero, names: Object.keys(ICONS), rough};   // [팀원요청 1014] rough를 team_ui.js(로딩 그림)에서도 쓰도록 내보냄
})();
