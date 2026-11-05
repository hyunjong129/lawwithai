/* =====================================================================
   js/app.js — 앱 전체 스크립트 (한 파일)

   [A. 데이터 영역]  사용자 데이터의 저장·삭제를 담당 (화면과 무관)
     1. 날짜 유틸   2. 샘플 데이터(SEED)   3. 저장소(localStorage) — 계약, 일정, 알림 설정, 삭제 기록
     데이터 변경 함수: removeEvent, resetData
   [B. 화면 영역]   화면 그리기와 사용자 동작
     4. 알림   5. 화면 그리기(render*)   6. 일정 추가/삭제/확인창   7. 메뉴(FAB)/화면 이동   8. 초기화

   ※ 나중에 계약서 파일/개인정보까지 저장하려면 [A] 영역의 store(저장소) 부분만 교체하면 된다.
   ===================================================================== */

/* ############################ A. 데이터 영역 ############################ */

/* ---------- 1. 날짜 유틸 ---------- */
const DAY = 86400000;                 // 하루(ms)
const WD = ['일','월','화','수','목','금','토']; // 요일 이름 (getDay() 순서)
// 시/분/초를 0으로 만든 날짜(날짜 비교용)
const startOfDay = d => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
// 날짜에 n일을 더한 새 날짜
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const TODAY = startOfDay(new Date()); // 앱이 열린 "오늘"
// 오늘 기준 남은 일수 (오늘=0, 내일=1, 어제=-1)
const dday = d => Math.round((startOfDay(d) - TODAY) / DAY);
// 남은 일수 → 'D-4', 'D-DAY', 'D+2' 문자열
const ddText = n => n === 0 ? 'D-DAY' : n > 0 ? 'D-' + n : 'D+' + (-n);
const fmtMD = d => (d.getMonth()+1) + '월 ' + d.getDate() + '일';          // 11월 8일
const fmtKR = d => `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`; // 2026년 11월 8일
const fmtDot = d => `${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')}`; // 2026. 11. 08
const fmtISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;   // 2026-11-08 (input[type=date]용)
// HTML 특수문자 이스케이프 (사용자가 직접 입력한 글자를 화면에 넣을 때 사용)
const esc = s => String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const sameDay = (a,b) => startOfDay(a).getTime() === startOfDay(b).getTime(); // 같은 날인지

/* ---------- 2. 샘플 데이터 ----------
   off = "오늘로부터 며칠 뒤인지". 오늘이 바뀌어도 D-day가 항상 맞게 보이도록 상대값으로 둔다.
   isEnd:true 인 일정은 계약 "만료 예정일"이며 계약 카드의 만료일 박스에 쓰인다.
   실제 서비스에서는 이 배열을 서버/DB 데이터로 교체하면 된다. */
const SEED = [
  // months=계약 기간(개월), issues=확인 필요한 조항 수, sum=요약({from}/{to}/{pay}는 자동 치환), terms=계약 조건 표
  { id:'c1', type:'부동산', name:'오피스텔 임대차 계약', party:'그린하우징', status:'확인 필요', months:12, issues:2,
    sum:'이 계약은 <strong class="font-extrabold">서울시 마포구 소재 오피스텔</strong>을 {from}부터 {to}까지 임차하는 계약입니다. 보증금은 1,000만 원, 월 임대료는 75만 원이며 매월 5일 납부해야 합니다. 만료 30일 전 해지 의사를 밝히지 않으면 자동 갱신되는 조항에 주의하세요.',
    terms:[['보증금','10,000,000원'],['월 임대료','750,000원 · 매월 5일']],
    events:[{off:4,label:'계약 갱신 의사 통보 기한'},{off:45,label:'계약 만료 예정일',isEnd:true}] },
  { id:'c2', type:'프리랜서', name:'디자인 외주 용역 계약', party:'스튜디오 파도', status:'안전', months:6, issues:0,
    sum:'이 계약은 <strong class="font-extrabold">스튜디오 파도</strong>와 맺은 디자인 외주 용역 계약으로, {from}부터 {to}까지 진행됩니다. 총 용역 대금은 1,200만 원이며 착수금, 중도금, 잔금으로 나누어 지급받습니다. 수정 횟수 제한과 결과물 저작권 귀속 조항을 확인하세요.',
    terms:[['총 용역 대금','12,000,000원'],['지급 방식','착수금 30% · 중도금 40% · 잔금 30%']],
    events:[{off:15,label:'2차 중도금 지급 예정일'},{off:119,label:'계약 만료 예정일',isEnd:true}] },
  { id:'c3', type:'차량', name:'차량 리스 계약', party:'안심캐피탈', status:'안전', months:36, issues:0,
    sum:'이 계약은 <strong class="font-extrabold">안심캐피탈</strong>과 맺은 차량 리스 계약으로, {from}부터 {to}까지 36개월간 이용합니다. 월 납입금은 52만 원이며 매월 {pay}일에 자동 이체됩니다. 중도 해지 시 위약금이 발생할 수 있으니 잔여 기간 조항을 확인하세요.',
    terms:[['월 납입금','520,000원 · 매월 {pay}일'],['약정 주행거리','연 20,000km']],
    events:[{off:32,label:'월 납입일'},{off:260,label:'계약 만료 예정일',isEnd:true}] }
];
const NEWS = [ // [분류, 제목] — 홈 > 뉴스 탭에 표시되는 예시 문구
  ['계약 가이드','임대차 계약 갱신 전, 꼭 확인할 3가지'],
  ['계약 가이드','자동 갱신 조항, 어떻게 읽어야 할까'],
  ['프리랜서','용역 계약서 필수 체크리스트'],
  ['부동산','보증금 반환이 늦어질 때 대응 방법']
];

/* ---------- 3. 저장소 (localStorage) ----------
   저장이 막힌 환경에서도 앱이 죽지 않도록 try/catch로 감싼다. */
const store = {
  get(k,d){ try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} },
  del(k){ try { localStorage.removeItem(k); } catch(e){} }
};
let alarms  = store.get('sg_alarms', { 'c1-0': true });                           // { 일정id: true } 알림 켠 일정
let cfg     = store.get('sg_cfg', { master:true, leads:[7,3,1,0], time:'09:00' });  // 알림 설정(전체on/off, 며칠 전, 시각)
let deleted = store.get('sg_deleted', { c:[], e:[] });                              // 삭제한 샘플 계약/일정 id 기록

/* 삭제 기록을 반영해 실제로 쓸 계약/일정 목록을 만든다 */
// 분석 계약은 저장된 ISO 날짜를 Date 객체로 복원해 샘플 계약과 함께 관리한다.
const analyzedData = store.get('sg_analyzed', []);
const CONTRACTS = SEED.filter(c => !deleted.c.includes(c.id)).concat(analyzedData.filter(c => !deleted.c.includes(c.id)).map(c => ({...c, analyzed:true, expiry:null})));
const EVENTS = [];                                              // 달력/홈/알림에 쓰는 전체 일정(날짜순)
CONTRACTS.forEach(c => {
  if (c.analyzed) {
    c.events = (c.events || []).map((e,i) => { const p=e.date.split('-').map(Number), event={...e,id:e.id||c.id+'-'+i,date:new Date(p[0],p[1]-1,p[2]),contract:c}; if(e.isEnd)c.expiry=event.date; return event; });
    c.events.forEach(e => { if(!deleted.e.includes(e.id)) EVENTS.push(e); });
    return;
  }
  c.events.forEach((e,i) => {
    e.id = c.id + '-' + i;               // 일정 id (예: c1-0)
    e.date = addDays(TODAY, e.off);      // 실제 날짜
    e.contract = c;                      // 소속 계약 연결
    if (e.isEnd) c.expiry = e.date;      // 계약 만료일 기억(일정을 지워도 유지)
    if (!deleted.e.includes(e.id)) EVENTS.push(e); // 삭제한 일정은 목록에서 제외
  });
});
const sortEvents = () => EVENTS.sort((a,b) => a.date - b.date);
sortEvents();

/* 직접 추가한 일정을 EVENTS에 넣는다. o = {id,label,date('YYYY-MM-DD'),cname}
   계약 이름이 기존 계약과 같으면 그 계약에 연결, 아니면 이름만 가진 독립 일정이 된다. */
const FREE = {}; // 직접 입력한 계약 이름별 독립 계약 객체 보관소 { id: 계약객체 }
function addCustomEvent(o){
  let c = CONTRACTS.find(x => x.name === o.cname);                     // 같은 이름의 기존 계약이 있으면 연결
  if (!c) {
    const fid = 'free:' + encodeURIComponent(o.cname).replace(/'/g, '%27'); // 따옴표가 없는 안전한 id
    c = FREE[fid] = FREE[fid] || { id:fid, name:o.cname, type:'기타', party:'', status:'안전', free:true };
  }
  const p = o.date.split('-').map(Number);
  const e = { id:o.id, label:o.label, date:new Date(p[0], p[1]-1, p[2]), contract:c, custom:true };
  EVENTS.push(e); sortEvents();
  return e;
}
store.get('sg_custom', []).forEach(addCustomEvent); // 저장된 직접 추가 일정 복원

/* ---------- 데이터 변경 함수 (화면과 무관) ---------- */
// 일정 1건 삭제: 직접 추가한 일정은 저장소에서 제거, 샘플 일정은 삭제 기록에 id 추가
function removeEvent(id){
  const i = EVENTS.findIndex(e => e.id === id); if (i < 0) return;
  const e = EVENTS[i];
  EVENTS.splice(i, 1);
  if (e.contract.analyzed) { const list=store.get('sg_analyzed',[]).map(c=>c.id===e.contract.id?{...c,events:c.events.filter((_,i)=>c.id+'-'+i!==id)}:c); store.set('sg_analyzed',list); }
  else if (e.custom) store.set('sg_custom', store.get('sg_custom', []).filter(o => o.id !== id));
  else if (!deleted.e.includes(id)) { deleted.e.push(id); store.set('sg_deleted', deleted); }
  if (alarms[id]) { delete alarms[id]; store.set('sg_alarms', alarms); }
}

// 설정 > 샘플 데이터 복원: 저장된 모든 값을 지우고 새로고침
function resetData(){ ['sg_alarms','sg_cfg','sg_deleted','sg_custom','sg_fired','sg_analyzed'].forEach(store.del); location.reload(); }

/* ############################ B. 화면 영역 ############################ */

/* 화면 상태 변수 */
let homeTab = 'schedule';                       // 홈 탭: 'schedule' | 'news'
let filter = '전체';                            // 계약 목록 필터
let calY = TODAY.getFullYear(), calM = TODAY.getMonth(); // 달력에 보이는 연/월(월은 0~11)
let selDate = TODAY;                            // 달력에서 선택한 날짜
let current = 'home';
let detailId = 'c1';                            // 계약 상세 화면에 보여줄 계약 id
const openCards = new Set();                    // 일정 목록을 펼쳐 둔 계약 카드 id                           // 현재 화면 id
let pendingConfirm = null;                      // 확인창에서 "삭제"를 눌렀을 때 실행할 함수

/* ---------- 4. 알림 ---------- */
let toastT;
// 화면 위쪽에 잠깐 뜨는 안내 배너
function showToast(title, body){
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-body').textContent = body || '';
  const t = document.getElementById('toast');
  t.classList.remove('opacity-0','-translate-y-3');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add('opacity-0','-translate-y-3'), 3800);
}
// 브라우저 알림 권한 요청(이미 정해졌으면 그 값을 반환)
async function ensurePerm(){
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') { try { return await Notification.requestPermission(); } catch(e){ return 'denied'; } }
  return Notification.permission;
}
// 앱 안 배너 + (허용 시) 브라우저 알림을 함께 보낸다
function notify(title, body){
  showToast(title, body);
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body }); } catch(e){}
}
/* 알림 검사: 켜 둔 일정 중 "오늘이 알림 시점(7일 전 등)"이고 설정한 시각이 지났으면 한 번만 알린다.
   1분마다 + 앱을 열 때 실행. 같은 알림이 반복되지 않게 sg_fired에 기록한다. */
function checkAlarms(){
  if (!cfg.master) return;
  const now = new Date(), [h,m] = cfg.time.split(':').map(Number);
  const at = new Date(now); at.setHours(h, m, 0, 0);
  if (now < at) return;                         // 아직 알림 시각 전
  const fired = store.get('sg_fired', {});
  EVENTS.forEach(e => {
    if (!alarms[e.id]) return;                  // 이 일정은 알림 꺼짐
    const n = dday(e.date);
    if (!cfg.leads.includes(n)) return;         // 오늘이 알림 시점이 아님
    const key = e.id + '|' + n + '|' + TODAY.toDateString();
    if (fired[key]) return;                     // 오늘 이미 알림
    fired[key] = 1;
    notify(e.contract.name + ' · ' + ddText(n), e.label + ' · ' + fmtMD(e.date));
  });
  store.set('sg_fired', fired);
}
async function sendTest(){ await ensurePerm(); notify('테스트 알림', '알림이 정상적으로 동작하고 있어요.'); renderSettings(); }
// 일정별 알림 켜기/끄기 (종 버튼)
async function toggleAlarm(id){
  if (!alarms[id]) {
    alarms[id] = true;
    if (cfg.master) await ensurePerm();
    const e = EVENTS.find(x => x.id === id);
    if (e) showToast('알림을 켰어요', e.label + ' · ' + cfg.leads.slice().sort((a,b)=>b-a).map(n => n === 0 ? '당일' : n + '일 전').join(', '));
  } else { delete alarms[id]; }
  store.set('sg_alarms', alarms);
  rerender(); checkAlarms();
}
// 설정: 전체 알림 on/off
async function toggleMaster(){
  cfg.master = !cfg.master;
  if (cfg.master) await ensurePerm();
  store.set('sg_cfg', cfg); renderSettings(); updateBadge(); checkAlarms();
}
// 설정: 알림 시점(7/3/1/0일 전) 선택·해제
function toggleLead(n){
  cfg.leads = cfg.leads.includes(n) ? cfg.leads.filter(x => x !== n) : cfg.leads.concat(n);
  store.set('sg_cfg', cfg); renderSettings();
}
// 설정: 알림 시각 변경
function setAlarmTime(v){ if (v) { cfg.time = v; store.set('sg_cfg', cfg); checkAlarms(); } }

/* ---------- 5. 화면 그리기 ---------- */
/* 긴급도 색상: 14일 이내=빨강, 60일 이내=주황, 그 외=기본(샌드). 기준을 바꾸려면 숫자만 수정. */
const URG = n => n <= 14 ? { fg:'#B91C1C', bg:'#FEE2E2', bd:'#FCA5A5', solid:'#DC2626' }
              : n <= 60 ? { fg:'#92400E', bg:'#FEF3C7', bd:'#FCD34D', solid:'#D97706' }
                        : { fg:'#0F172A', bg:'#F5F2EB', bd:'#EAE6DF', solid:'#0F172A' };
// D-day 칩 (14일 이내는 빨간 꽉 찬 칩)
const chip = n => { const u = URG(n);
  return n <= 14
    ? `<span class="text-[12px] font-extrabold px-2.5 py-1 rounded-full text-white" style="background:${u.solid}">${ddText(n)}</span>`
    : `<span class="text-[12px] font-bold px-2.5 py-1 rounded-full border" style="background:${u.bg};color:${u.fg};border-color:${u.bd}">${ddText(n)}</span>`; };
// 종 모양 알림 토글 버튼 (켜짐=네이비+골드, 꺼짐=샌드)
const bell = id => { const on = !!alarms[id];
  return `<button onclick="event.stopPropagation();toggleAlarm('${id}')" aria-pressed="${on}" aria-label="알림 ${on?'끄기':'켜기'}" class="w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition active:scale-95 ${on ? 'bg-[#0F172A] border-[#0F172A] text-[#C5A059]' : 'bg-[#F5F2EB] border-[#EAE6DF] text-[#475569]'}"><svg width="17" height="17" viewBox="0 0 24 24" fill="${on?'currentColor':'none'}" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg></button>`; };
// 휴지통 버튼 (kind: 'event' | 'contract')
const trashBtn = (kind, id) => `<button onclick="event.stopPropagation();askDelete('${kind}','${id}')" aria-label="삭제" class="w-9 h-9 rounded-full border border-[#EAE6DF] bg-[#F5F2EB] text-[#475569] flex items-center justify-center shrink-0 active:scale-95 transition"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>`;
/* 일정 한 줄 (홈/달력/알림/상세 공용)
   showDate: 왼쪽 날짜(11월 8일) 표시 여부, del: 휴지통 버튼 표시 여부 */
const eventRow = (e, showDate, del) => `<div onclick="openDetail('${e.contract.id}')" class="bg-[#FAFAFA] border border-[#EAE6DF] rounded-[16px] p-3.5 flex items-center gap-3 cursor-pointer">
  ${showDate ? `<div class="w-[52px] text-center shrink-0"><div class="text-[11.5px] text-[#475569]">${e.date.getMonth()+1}월</div><div class="serif text-[22px] font-bold text-[#0F172A] leading-none">${e.date.getDate()}</div></div>` : ''}
  <div class="flex-1 min-w-0"><div class="text-[14.5px] font-bold text-[#0F172A] truncate">${esc(e.contract.name)}</div><div class="text-[12.5px] text-[#475569] mt-0.5 truncate">${esc(e.label)}</div></div>
  ${chip(dday(e.date))}${bell(e.id)}${del ? trashBtn('event', e.id) : ''}</div>`;

/* 홈: 오늘 날짜 문구 + 다가오는 일정 3건 + 뉴스 카드 */
function renderHome(){
  document.getElementById('today-text').textContent = `${fmtKR(TODAY)}, ${WD[TODAY.getDay()]}요일`;
  const up = EVENTS.filter(e => dday(e.date) >= 0).slice(0,3); // 오늘 이후 가장 가까운 3건
  document.getElementById('home-schedule-list').innerHTML = up.map(e => eventRow(e, true)).join('') || '<div class="text-[13px] text-[#475569] py-6 text-center">다가오는 일정이 없어요.</div>';
  document.getElementById('home-panel-news').innerHTML = NEWS.map(n => `<div class="bg-[#FAFAFA] border border-[#EAE6DF] rounded-[16px] p-4"><span class="text-[11.5px] font-bold text-[#0F172A] bg-[#F5F2EB] border border-[#EAE6DF] px-2 py-0.5 rounded-full"><span class="inline-block w-1.5 h-1.5 rounded-full bg-[#C5A059] mr-1"></span>${n[0]}</span><div class="serif text-[16px] font-bold text-[#0F172A] mt-2 leading-snug">${n[1]}</div><div class="text-[12px] text-[#475569] mt-1.5">계약 콘텐츠</div></div>`).join('');
  setHomeTab(homeTab);
}
// 홈의 [일정 | 뉴스] 전환
function setHomeTab(t){
  homeTab = t;
  ['schedule','news'].forEach(k => {
    const on = k === t, b = document.getElementById('home-tab-' + k);
    b.className = 'flex-1 py-2 rounded-[11px] text-[14px] transition ' + (on ? 'bg-[#FAFAFA] text-[#0F172A] font-bold shadow-sm' : 'text-[#475569] font-semibold');
    document.getElementById('home-panel-' + k).classList.toggle('hidden', !on);
  });
}
/* 내 계약 > 월간 달력 (삼성 캘린더 스타일) + 선택한 날짜의 일정 목록 */
function renderCalendar(){
  document.getElementById('cal-title').textContent = `${calY}년 ${calM+1}월`;
  let h = WD.map(w => `<div class="text-[12px] text-[#475569] pb-1">${w}</div>`).join(''); // 요일 머리글
  const first = new Date(calY, calM, 1).getDay(), days = new Date(calY, calM+1, 0).getDate();
  for (let i = 0; i < first; i++) h += '<div class="cal-day out"></div>'; // 1일 앞 빈칸
  for (let d = 1; d <= days; d++) {
    const date = new Date(calY, calM, d), cls = ['cal-day'];
    if (sameDay(date, TODAY)) cls.push('today');                       // 오늘: 네이비 원
    if (sameDay(date, selDate)) cls.push('sel');                        // 선택한 날: 골드 테두리
    if (EVENTS.some(e => sameDay(e.date, date))) cls.push('ev');        // 일정 있는 날: 골드 점
    h += `<button class="${cls.join(' ')}" onclick="pickDate(${calY},${calM},${d})" aria-label="${calM+1}월 ${d}일"><span class="n">${d}</span></button>`;
  }
  document.getElementById('cal-grid').innerHTML = h;
  const list = EVENTS.filter(e => sameDay(e.date, selDate));
  document.getElementById('sel-date-label').textContent = `${fmtKR(selDate)} ${WD[selDate.getDay()]}요일` + (sameDay(selDate, TODAY) ? ' · 오늘' : '');
  document.getElementById('sel-day-list').innerHTML = list.map(e => eventRow(e, false, true)).join('') || '<div class="text-[13px] text-[#475569] py-2">이 날은 일정이 없어요.</div>';
}
function calMove(n){ const d = new Date(calY, calM + n, 1); calY = d.getFullYear(); calM = d.getMonth(); renderCalendar(); } // 이전/다음 달
function calToday(){ calY = TODAY.getFullYear(); calM = TODAY.getMonth(); selDate = TODAY; renderCalendar(); }              // "오늘" 버튼
function pickDate(y,m,d){ selDate = new Date(y,m,d); renderCalendar(); }                                                    // 날짜 선택

/* 내 계약 > 계약 목록
   - 만료일 박스: 그 계약의 "만료 예정일" 일정(isEnd)에서 읽는다 → 일정을 지우면 박스도 사라져 홈/달력과 항상 일치
   - "일정 N건 관리"를 누르면 카드 안에서 그 계약의 일정을 보고, 알림 켜기/삭제/추가할 수 있다 */
function renderContracts(){
  document.getElementById('contracts-count').textContent = CONTRACTS.length ? `보관 중인 계약 ${CONTRACTS.length}건 · 일정은 달력에서 확인하세요.` : '보관 중인 계약이 없어요.';
  document.getElementById('contract-filters').innerHTML = ['전체','확인 필요','안전'].map(f => `<button onclick="setFilter('${f}')" class="text-[12.5px] px-3 py-1.5 rounded-full border ${f === filter ? 'bg-[#0F172A] text-white border-[#0F172A] font-bold' : 'bg-[#FAFAFA] text-[#475569] border-[#EAE6DF]'}">${f}</button>`).join('');
  const rows = CONTRACTS.filter(c => filter === '전체' || c.status === filter);
  document.getElementById('contract-list').innerHTML = rows.map(c => {
    const evs = EVENTS.filter(e => e.contract === c);                              // 이 계약의 모든 일정(날짜순)
    const nx = evs.filter(e => dday(e.date) >= 0 && !e.isEnd)[0];                   // 만료 외 가장 가까운 일정
    const endEv = evs.find(e => e.isEnd);                                           // 만료 예정일 일정(삭제했으면 없음)
    const sp = c.status === '안전' ? { fg:'#166534', bg:'#DCFCE7', bd:'#86EFAC' } : { fg:'#92400E', bg:'#FEF3C7', bd:'#FCD34D' }; // 상태 라벨 색
    let exp = '';
    if (endEv) { const d = endEv.date, n = dday(d), u = URG(n);
      exp = `<div class="mt-3 rounded-[14px] px-3.5 py-3 flex items-center justify-between border-l-[5px]" style="background:${u.bg};border-left-color:${u.solid}">
        <div><div class="text-[12px] font-bold" style="color:${u.fg}">만료일</div><div class="text-[19px] font-extrabold tracking-tight" style="color:${u.fg}">${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()} <span class="text-[13px] font-bold">(${WD[d.getDay()]})</span></div></div>
        <div class="text-right"><div class="text-[26px] font-extrabold leading-none" style="color:${u.fg}">${ddText(n)}</div><div class="text-[12px] font-bold mt-1" style="color:${u.fg}">${n}일 남음</div></div></div>`; }
    const nxLine = nx ? `<div class="flex items-center justify-between mt-2.5 text-[13px]"><span class="text-[#475569]">가장 가까운 일정 · <b class="text-[#0F172A]">${esc(nx.label)}</b></span>${chip(dday(nx.date))}</div>` : '';
    const open = openCards.has(c.id);
    const toggle = `<button onclick="event.stopPropagation();toggleCard('${c.id}')" class="mt-3 w-full py-2.5 rounded-[12px] border border-[#EAE6DF] bg-[#F5F2EB] text-[#0F172A] text-[13px] font-bold">일정 ${evs.length}건 ${open ? '접기 ▴' : '관리 ▾'}</button>`;
    const panel = open ? `<div onclick="event.stopPropagation()" class="mt-3 space-y-2.5">${evs.map(e => eventRow(e, true, true)).join('') || '<div class="text-[13px] text-[#475569] py-1">등록된 일정이 없어요.</div>'}<button onclick="openAddFor('${c.id}')" class="w-full py-2.5 rounded-[12px] bg-[#0F172A] text-white text-[13px] font-bold">+ 이 계약에 일정 추가</button></div>` : '';
    return `<div onclick="openDetail('${c.id}')" class="bg-[#FAFAFA] border border-[#EAE6DF] rounded-[20px] p-4 cursor-pointer">
      <div class="flex items-center justify-between gap-2"><span class="text-[12px] text-[#475569]">${c.type}</span><span class="flex items-center gap-2"><span class="text-[12px] font-bold px-2.5 py-0.5 rounded-full border" style="background:${sp.bg};color:${sp.fg};border-color:${sp.bd}">${c.status}</span>${trashBtn('contract', c.id)}</span></div>
      <h3 class="text-[17px] text-[#0F172A] mt-1">${esc(c.name)}</h3><div class="text-[13px] text-[#475569]">${esc(c.party)}</div>${exp}${nxLine}${toggle}${panel}</div>`;
  }).join('') || '<div class="bg-[#FAFAFA] border border-[#EAE6DF] rounded-[20px] p-8 text-center text-[14px] text-[#475569]">표시할 계약이 없어요.</div>';
}
function setFilter(f){ filter = f; renderContracts(); }
function toggleCard(id){ if (openCards.has(id)) openCards.delete(id); else openCards.add(id); renderContracts(); } // 카드의 일정 목록 펼치기/접기
function openAddFor(id){ const c = CONTRACTS.find(x => x.id === id); if (c) openAdd(c.name); }                      // 이 계약 이름을 채워 일정 추가 시트 열기

/* 계약 상세: detailId에 해당하는 계약 정보를 화면에 채운다.
   - 샘플 계약(c1~c3)은 SEED의 요약/조건을 사용, 직접 입력한 계약(free)은 간단 안내만 표시
   - 계약 기간은 만료일에서 months개월을 거꾸로 계산 */
const detailContract = () => CONTRACTS.find(c => c.id === detailId) || FREE[detailId] || CONTRACTS[0] || null;
function openDetail(id){ detailId = id; navigateTo('contract-detail'); } // 카드/일정 줄을 눌렀을 때
function renderDetail(){
  const $ = id => document.getElementById(id), c = detailContract();
  if (!c) { $('d-name').textContent = '계약을 찾을 수 없어요'; $('d-type-line').textContent = ''; $('d-meta').textContent = ''; $('d-flag').style.display = 'none'; $('d-summary').textContent = ''; $('d-terms').innerHTML = ''; $('detail-alarm-list').innerHTML = ''; return; }
  const evs = EVENTS.filter(e => e.contract === c);
  $('d-name').textContent = c.name;
  if (c.analyzed) { // 저장된 근로계약: 추출 항목과 규칙 근거를 보여준다.
    $('d-type-line').textContent = FORM_NAMES[c.formId] || FORM_NAMES.unknown;
    $('d-meta').textContent = `${c.party || '사업체 미확인'} · 브라우저에서 분석`;
    const fl=$('d-flag'); fl.style.display=''; fl.style.background=c.issues?'#FDECCF':'#DCFCE7'; fl.style.color=c.issues?'#C25E00':'#166534';
    $('d-flag-text').textContent=c.issues?`확인 필요 또는 위반 ${c.issues}개`:'확인 필요한 조항 없음';
    $('d-summary').textContent=c.sum;
    const rows=(c.terms||[]).map(t=>`<div class="p-4 border-b border-[#EAE6DF]"><div class="text-[11.5px] text-[#475569]">${esc(t[0])}</div><div class="text-[14.5px] font-extrabold text-[#0F172A] mt-1">${esc(t[1])}</div></div>`).join('');
    const findings=(c.findings||[]).map(x=>`<div class="p-3 border-t border-[#EAE6DF]"><div class="font-bold ${x.status==='위반'?'text-[#B91C1C]':'text-[#92400E]'}">${esc(x.status)} · ${esc(x.msg)}</div><div class="text-[11.5px] text-[#475569] mt-1">근거: ${esc(x.ref)}</div></div>`).join('');
    $('d-terms').innerHTML=rows+`<div class="px-4 pt-3 font-bold text-[14px]">규칙 검사 결과</div>${findings||'<div class="p-4">확인 필요 항목이 없어요.</div>'}<button onclick="openOriginal('${esc(c.id)}')" class="m-4 px-4 py-2 rounded-full border border-[#EAE6DF] text-[13px] font-bold">원본 보기</button>`;
  } else if (c.free) { // 직접 입력한 계약: 분석 정보 없음
    $('d-type-line').textContent = '기타 · 직접 추가';
    $('d-meta').textContent = '직접 추가한 일정으로 관리 중';
    $('d-flag').style.display = 'none';
    $('d-summary').textContent = '계약서를 분석하면 요약과 확인이 필요한 조항을 볼 수 있어요. 지금은 직접 추가한 일정만 관리하고 있어요.';
    $('d-terms').innerHTML = `<div class="p-4"><div class="text-[11.5px] text-[#475569]">등록된 일정</div><div class="text-[14.5px] font-extrabold text-[#0F172A] mt-1">${evs.length}건</div></div>`;
  } else {
    const end = c.expiry, start = addDays(new Date(end.getFullYear(), end.getMonth() - c.months, end.getDate()), 1); // 시작일 = 만료일 N개월 전 + 1일
    const payEv = evs.find(e => e.label === '월 납입일'), pay = payEv ? payEv.date.getDate() : '';
    const fill = t => t.replace('{from}', fmtKR(start)).replace('{to}', fmtKR(end)).replace(/\{pay\}/g, pay);
    $('d-type-line').textContent = c.type + ' · 분석 완료';
    $('d-meta').textContent = `${c.party} · ${fmtKR(start)} 등록`;
    const fl = $('d-flag'); fl.style.display = '';
    fl.style.background = c.issues ? '#FDECCF' : '#DCFCE7'; fl.style.color = c.issues ? '#C25E00' : '#166534';
    $('d-flag-text').textContent = c.issues ? `확인 필요한 조항 ${c.issues}개` : '확인 필요한 조항 없음';
    $('d-summary').innerHTML = fill(c.sum);
    const terms = [['계약 기간', `${fmtDot(start)} — ${fmtDot(end)}`]].concat(c.terms.map(t => [t[0], fill(t[1])]));
    $('d-terms').innerHTML = terms.map((t,i) => `<div class="p-4 ${i < terms.length-1 ? 'border-b border-[#EAE6DF]' : ''}"><div class="text-[11.5px] text-[#475569]">${t[0]}</div><div class="text-[14.5px] font-extrabold text-[#0F172A] mt-1">${t[1]}</div></div>`).join('');
  }
  $('detail-alarm-list').innerHTML = evs.map(e => eventRow(e, true, true)).join('') || '<div class="text-[13px] text-[#475569] py-2">등록된 일정이 없어요.</div>';
}
/* 알림 목록 화면: 알림을 켠 "다가오는" 일정만 표시 */
function renderAlarms(){
  const list = EVENTS.filter(e => alarms[e.id] && dday(e.date) >= 0);
  document.getElementById('alarms-count').textContent = list.length ? `설정한 알림 ${list.length}건` : '';
  document.getElementById('alarms-list').innerHTML = list.map(e => eventRow(e, true)).join('') ||
    '<div class="bg-[#FAFAFA] border border-[#EAE6DF] rounded-[20px] p-8 text-center text-[14px] text-[#475569] leading-relaxed">설정한 알림이 없어요.<br>일정의 종 아이콘을 눌러 추가해 보세요.</div>';
}
/* 설정 화면의 알림 카드 상태 반영 */
function renderSettings(){
  const m = document.getElementById('alarm-master');
  m.className = 'relative w-[50px] h-[30px] rounded-full transition shrink-0 ' + (cfg.master ? 'bg-[#0F172A]' : 'bg-[#EAE6DF]');
  m.firstElementChild.style.left = cfg.master ? '23px' : '3px';
  m.setAttribute('aria-checked', cfg.master);
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  document.getElementById('notif-status').textContent = !cfg.master ? '알림이 꺼져 있어요' : perm === 'granted' ? '브라우저 알림이 허용되어 있어요' : perm === 'denied' ? '브라우저 알림이 차단됨 · 앱 안에서만 알려드려요' : perm === 'unsupported' ? '이 환경은 앱 안 알림만 지원해요' : '켜면 브라우저 알림 권한을 요청해요';
  document.getElementById('lead-chips').innerHTML = [[7,'7일 전'],[3,'3일 전'],[1,'1일 전'],[0,'당일']].map(([n,l]) => `<button onclick="toggleLead(${n})" aria-pressed="${cfg.leads.includes(n)}" class="px-3.5 py-2 rounded-full text-[13px] border transition ${cfg.leads.includes(n) ? 'bg-[#0F172A] text-white border-[#0F172A] font-bold' : 'bg-[#FAFAFA] text-[#475569] border-[#EAE6DF]'}">${l}</button>`).join('');
  document.getElementById('alarm-time').value = cfg.time;
}
// 상단 종 아이콘의 숫자 배지 = 알림 켠 일정 수
function updateBadge(){
  const n = cfg.master ? EVENTS.filter(e => alarms[e.id]).length : 0, b = document.getElementById('bell-badge');
  b.textContent = n; b.classList.toggle('hidden', n === 0);
}
// 데이터가 바뀔 때마다 모든 화면을 다시 그린다 (가장 단순하고 안전한 방식)
function rerender(){ renderConsult(); renderAlarms(); renderHome(); renderCalendar(); renderContracts(); renderDetail(); renderSettings(); renderComplete(); updateBadge(); }
let lastAnalyzedId = '';
// 완료 화면의 통계를 최근 분석 결과에서 가져온다.
function renderComplete(){const c=CONTRACTS.find(x=>x.id===lastAnalyzedId);if(!c)return;document.getElementById('complete-summary').textContent=c.formId==='unknown'?'표준근로계약서 양식이 확인되지 않았어요. 결과를 검토해 주세요.':'분석 결과를 내 계약에 저장했어요. 확인 필요 항목을 검토해 주세요.';document.getElementById('complete-issues').textContent=(c.findings||[]).filter(x=>x.status==='위반'||x.status==='확인 필요').length+'개';document.getElementById('complete-events').textContent=(c.events||[]).length+'개';}
// 분석 계약을 런타임 계약·일정에 넣어 홈/달력/알림 화면을 갱신한다.
function analyzedReady(c){c.analyzed=true;c.expiry=null;c.events=(c.events||[]).map((e,i)=>{const p=e.date.split('-').map(Number),event={...e,id:e.id||c.id+'-'+i,date:new Date(p[0],p[1]-1,p[2]),contract:c};if(e.isEnd)c.expiry=event.date;return event;});CONTRACTS.push(c);c.events.forEach(e=>EVENTS.push(e));sortEvents();lastAnalyzedId=c.id;detailId=c.id;rerender();navigateTo('analyze-complete');}
// IndexedDB에 저장된 계약서 원본을 새 탭에서 연다.
async function openOriginal(id){try{const db=await openOriginalDb();const item=await new Promise((resolve,reject)=>{const r=db.transaction('files').objectStore('files').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();if(!item){showToast('원본을 찾을 수 없어요','브라우저 저장소를 확인해 주세요.');return;}const url=URL.createObjectURL(item.file);window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){showToast('원본을 열지 못했어요','');}}

/* ---------- 6. 일정 추가 / 삭제 / 확인창 ---------- */
// 아래에서 올라오는 시트 열기/닫기 공용 (id: 'add-sheet' | 'confirm-sheet')
function showSheet(id){ const sh = document.getElementById(id); sh.classList.remove('hidden'); requestAnimationFrame(() => sh.classList.remove('opacity-0')); }
function hideSheet(id){ const sh = document.getElementById(id); sh.classList.add('opacity-0'); setTimeout(() => sh.classList.add('hidden'), 180); }

// "일정 추가" 시트 열기: 선택한 날짜가 기본값. 계약명은 직접 입력(자동완성 목록만 제공)
function openAdd(cname){ // cname이 있으면 계약 이름 칸을 미리 채운다
  document.getElementById('add-contract-list').innerHTML = CONTRACTS.map(c => `<option value="${esc(c.name)}"></option>`).join('');
  document.getElementById('add-contract').value = cname || '';
  document.getElementById('add-label').value = '';
  document.getElementById('add-date').value = fmtISO(selDate);
  document.getElementById('add-alarm').checked = true;
  document.getElementById('add-err').textContent = '';
  showSheet('add-sheet');
  setTimeout(() => document.getElementById(cname ? 'add-label' : 'add-contract').focus(), 60);
}
function closeAdd(){ hideSheet('add-sheet'); }
// "추가" 버튼: 입력 검사 → 저장 → 화면 갱신
async function submitAdd(){
  const cname = document.getElementById('add-contract').value.trim(), label = document.getElementById('add-label').value.trim(), date = document.getElementById('add-date').value, err = document.getElementById('add-err');
  if (!cname) { err.textContent = '계약 이름을 입력해 주세요.'; return; }
  if (!label) { err.textContent = '일정 이름을 입력해 주세요.'; return; }
  if (!date)  { err.textContent = '날짜를 선택해 주세요.'; return; }
  const o = { id:'u-' + Date.now(), label, date, cname };               // 저장용 데이터
  const list = store.get('sg_custom', []); list.push(o); store.set('sg_custom', list);
  const e = addCustomEvent(o);
  if (document.getElementById('add-alarm').checked) { alarms[o.id] = true; store.set('sg_alarms', alarms); if (cfg.master) await ensurePerm(); }
  selDate = e.date; calY = e.date.getFullYear(); calM = e.date.getMonth(); // 추가한 날짜로 달력 이동
  closeAdd(); rerender();
  showToast('일정을 추가했어요', cname + ' · ' + label + ' · ' + fmtMD(e.date));
}

/* 삭제: 휴지통 → 확인창 → 실제 삭제. kind = 'event' | 'contract' */
function askDelete(kind, id){
  let title, body;
  if (kind === 'contract') {
    const c = CONTRACTS.find(x => x.id === id); if (!c) return;
    const n = EVENTS.filter(e => e.contract === c).length;
    title = `“${c.name}” 계약을 삭제할까요?`; body = `연결된 일정 ${n}건과 알림도 함께 삭제돼요.`;
  } else {
    const e = EVENTS.find(x => x.id === id); if (!e) return;
    title = `“${e.label}” 일정을 삭제할까요?`; body = e.contract.name + ' · ' + fmtMD(e.date);
  }
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').textContent = body;
  pendingConfirm = () => kind === 'contract' ? deleteContract(id) : deleteEvent(id);
  showSheet('confirm-sheet');
}
function closeConfirm(){ pendingConfirm = null; hideSheet('confirm-sheet'); }
function runConfirm(){ const fn = pendingConfirm; closeConfirm(); if (fn) fn(); }

function deleteEvent(id){ removeEvent(id); rerender(); showToast('일정을 삭제했어요', ''); }
// 계약 삭제: 연결된 일정을 모두 지운 뒤 계약 자체를 삭제 기록에 남긴다
function deleteContract(id){
  const c = CONTRACTS.find(x => x.id === id); if (!c) return;
  EVENTS.filter(e => e.contract === c).map(e => e.id).forEach(removeEvent);
  CONTRACTS.splice(CONTRACTS.indexOf(c), 1);
  if(c.analyzed)store.set('sg_analyzed',store.get('sg_analyzed',[]).filter(x=>x.id!==id));
  if (!deleted.c.includes(id)) deleted.c.push(id);
  store.set('sg_deleted', deleted);
  rerender(); showToast('계약을 삭제했어요', c.name);
}

/* ---------- 7. "≡" 메뉴(FAB)와 화면 이동 ---------- */
const FAB_HIDDEN = ['analyze-capture','analyze-reviewing','analyze-complete']; // 이 화면들에서는 메뉴 버튼 숨김
const FAB_CUR = { 'home':'home', 'contracts':'contracts', 'contract-detail':'contracts', 'ai-consult':'ai-consult', 'settings':'settings' }; // 화면 → 강조할 메뉴
let fabOpen = false, fabT;
// 메뉴 열기/닫기 (open 생략 시 토글). 열리면 아이콘이 ≡ → ✕
function toggleFab(open){
  fabOpen = open === undefined ? !fabOpen : open;
  const dim = document.getElementById('fab-dim'), menu = document.getElementById('fab-menu'), btn = document.getElementById('fab-btn');
  clearTimeout(fabT);
  document.getElementById('fab-ic-bars').classList.toggle('hidden', fabOpen);
  document.getElementById('fab-ic-x').classList.toggle('hidden', !fabOpen);
  btn.setAttribute('aria-expanded', fabOpen);
  if (fabOpen) { dim.classList.remove('hidden'); menu.style.display = 'flex'; requestAnimationFrame(() => dim.classList.remove('opacity-0')); }
  else { dim.classList.add('opacity-0'); fabT = setTimeout(() => { dim.classList.add('hidden'); menu.style.display = 'none'; }, 200); }
}
// 화면 전환: 모든 .screen 숨기고 대상 화면만 표시
function navigateTo(id){
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const t = document.getElementById('screen-' + id);
  if (t) { t.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  current = id;
  if (fabOpen) toggleFab(false);
  document.getElementById('fab-wrap').style.display = FAB_HIDDEN.includes(id) ? 'none' : '';
  ['home','contracts','ai-consult','settings'].forEach(k => document.getElementById('fab-item-' + k).classList.toggle('cur', FAB_CUR[id] === k));
  rerender();
}
// AI 상담의 추천 질문 칩을 눌렀을 때 입력창에 채워 넣기
/* ---------- 9. AI 상담 (프로토타입) ----------
   서버/AI 없이 "미리 써 둔 답변"을 보여준다. 질문(q)을 고르거나 입력한 글에 kw(키워드)가 들어 있으면 해당 답변(a)을 출력.
   나중에 실제 AI로 바꿀 때는 pushQA() 안의 setTimeout 부분을 AI 호출로 교체하면 된다.
   답변을 추가/수정하려면 아래 CONSULT_QA 배열만 고치면 된다. (근거는 표준근로계약서 양식과 근로기준법 기준, 법률 자문 아님) */
const CONSULT_QA = [
  { q:'근로계약서를 못 받았어요', kw:['계약서','교부','못 받','안 받'],
    a:['사업주는 근로계약을 체결할 때 계약서를 작성해서 근로자에게 바로 교부해야 해요. 근로자가 요구하지 않아도 줘야 해요.',
       '받지 못했다면 ① 사업주에게 서면(문자·메일 포함)으로 교부를 요청하고 ② 요청한 기록을 남겨 두세요.',
       '해결되지 않으면 고용노동부 상담센터(국번 없이 1350)나 관할 고용노동관서에 문의할 수 있어요.'],
    ref:'근로기준법 제17조 · 표준근로계약서 “근로계약서 교부” 항목' },
  { q:'휴게시간은 얼마나 받아야 하나요?', kw:['휴게','쉬는','점심'],
    a:['근로시간이 4시간이면 30분 이상, 8시간이면 1시간 이상의 휴게시간을 근로시간 도중에 줘야 해요.',
       '휴게시간은 근로자가 자유롭게 쓸 수 있어야 하고, 표준근로계약서 4번 항목에 시작·종료 시각을 적어요. 비어 있거나 위 기준보다 짧으면 확인이 필요해요.'],
    ref:'근로기준법 제54조 · 표준근로계약서 “소정근로시간(휴게시간)”' },
  { q:'연장·야간 근무 수당이 궁금해요', kw:['수당','초과','연장','야간','야근'],
    a:['연장·야간(22시~다음날 6시)·휴일 근로에는 통상임금의 50%를 더한 가산수당을 줘야 해요.',
       '다만 상시 근로자 4인 이하 사업장에는 적용되지 않아요(표준양식 안내).',
       '단시간근로자는 정해진 시간을 넘겨 일하면 법정 근로시간 이내여도 통상임금의 50% 이상을 가산해 받아요.'],
    ref:'근로기준법 제56조 · 표준근로계약서(단시간·외국인) 안내 문구' },
  { q:'주휴일이 뭔가요?', kw:['주휴','휴일'],
    a:['1주 동안 정해진 근로일을 모두 일하면 주 1일의 유급휴일을 주는 제도예요.',
       '표준근로계약서 5번 항목에 “주휴일 매주 ○요일”로 적어요. 요일이 비어 있으면 확인해 보세요. 적용 대상 기준은 고용노동부에 확인하는 것이 정확해요.'],
    ref:'표준근로계약서(건설일용) 주휴일 안내 · 근로기준법 제55조' },
  { q:'단시간 근로자도 연차가 있나요?', kw:['단시간','알바','아르바이트','연차'],
    a:['네, 단시간근로자는 통상근로자의 근로시간에 비례해서 연차유급휴가를 받아요(단시간근로자 표준양식 6번).',
       '단시간근로자 계약서에는 “근로일 및 근로일별 근로시간”을 반드시 적어야 하고, 빠뜨리면 과태료 대상이 될 수 있어요.'],
    ref:'표준근로계약서(단시간근로자) 6번 항목 및 하단 안내' },
  { q:'불리한 조항인지 확인해 주세요', kw:['불리','조항','분석','확인해'],
    a:['계약서를 올려 주시면 필수 항목 누락, 근로시간·휴게·임금 기준 등을 하나씩 확인해서 “위반 / 확인 필요 / 정상”으로 알려드려요.'],
    ref:'앱의 계약서 분석 기능', cta:{ label:'계약서 분석하러 가기', go:'analyze-start' } },
  { q:'자동 갱신을 취소하고 싶어요', kw:['자동','갱신','해지'],
    a:['먼저 계약서의 갱신·해지 통보 기한을 확인하세요. 기한이 지나면 같은 조건으로 이어질 수 있어요.',
       '통보는 문자·메일·내용증명처럼 기록이 남는 방법으로 하세요. 이 앱의 일정 알림을 켜 두면 기한 전에 알려드려요.'],
    ref:'계약서의 갱신·해지 조항', cta:{ label:'내 계약에서 일정 확인', go:'contracts' } }
];
const consultLog = [];   // 대화 기록(메모리): {role:'user',text} | {role:'ai',typing:true} | {role:'ai',qa:번호(-1=안내)}
let consultBusy = false; // 답변 준비 중이면 true(중복 클릭 방지)
const AI_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/></svg>';
// 말풍선 하나를 HTML로 만든다
function consultBubble(m){
  if (m.role === 'user') return `<div class="flex justify-end"><div class="max-w-[85%] bg-[#0F172A] text-white text-[13.5px] leading-relaxed px-4 py-2.5 rounded-[18px] rounded-br-[6px] text-left">${esc(m.text)}</div></div>`;
  const wrap = inner => `<div class="flex gap-2 items-start"><div class="w-8 h-8 rounded-full bg-[#0F172A] text-[#C5A059] flex items-center justify-center shrink-0">${AI_ICON}</div><div class="max-w-[88%] bg-[#F5F2EB] border border-[#EAE6DF] text-[#0F172A] text-[13.5px] leading-[1.65] px-4 py-3 rounded-[18px] rounded-tl-[6px] text-left space-y-2">${inner}</div></div>`;
  if (m.typing) return wrap('<span class="inline-flex gap-1 py-1"><i class="w-1.5 h-1.5 rounded-full bg-[#475569] animate-pulse"></i><i class="w-1.5 h-1.5 rounded-full bg-[#475569] animate-pulse"></i><i class="w-1.5 h-1.5 rounded-full bg-[#475569] animate-pulse"></i></span>');
  if (m.qa < 0) return wrap('<p>프로토타입에서는 준비된 질문에만 답해요. 아래 추천 질문을 눌러 보세요.</p>');
  const x = CONSULT_QA[m.qa];
  return wrap(x.a.map(p => `<p>${p}</p>`).join('') + `<p class="text-[11.5px] text-[#475569] pt-2 border-t border-[#EAE6DF]">근거: ${x.ref}</p>` +
    (x.cta ? `<button onclick="navigateTo('${x.cta.go}')" class="w-full py-2.5 rounded-[12px] bg-[#0F172A] text-white text-[13px] font-bold">${x.cta.label}</button>` : '') +
    '<p class="text-[11.5px] text-[#475569]">참고용 안내이며 법률 자문이 아니에요.</p>');
}
// 상담 화면 다시 그리기 (대화 + 추천 질문 칩)
function renderConsult(){
  const log = document.getElementById('consult-log'); if (!log) return;
  document.getElementById('consult-intro').style.display = consultLog.length ? 'none' : '';
  document.getElementById('consult-clear').classList.toggle('hidden', !consultLog.length);
  log.innerHTML = consultLog.map(consultBubble).join('');
  document.getElementById('consult-chips').innerHTML = CONSULT_QA.map((x,i) => `<button onclick="askConsult(${i})" ${consultBusy ? 'disabled' : ''} class="px-4 py-2 rounded-full bg-[#F5F2EB] border border-[#EAE6DF] text-[#0F172A] text-[13px] font-bold hover:bg-[#EAE6DF] transition disabled:opacity-50">${x.q}</button>`).join('');
}
// 질문을 쌓고 잠깐 "입력 중..."을 보여준 뒤 답변으로 바꾼다 (qa=-1이면 안내 문구)
function pushQA(qa, userText){
  const typing = { role:'ai', typing:true };
  consultLog.push({ role:'user', text:userText }, typing);
  consultBusy = true; renderConsult(); scrollConsult();
  setTimeout(() => {
    const i = consultLog.indexOf(typing);
    if (i > -1) consultLog[i] = { role:'ai', qa };   // 대화를 지웠다면 아무 일도 하지 않음
    consultBusy = false; renderConsult(); scrollConsult();
  }, 800);
}
function scrollConsult(){ const el = document.getElementById('consult-log').lastElementChild; if (el && el.scrollIntoView) el.scrollIntoView({ block:'end', behavior:'smooth' }); }
function askConsult(i){ if (!consultBusy) pushQA(i, CONSULT_QA[i].q); }   // 추천 질문 칩 클릭
function sendConsult(){                                                   // 직접 입력 전송: 키워드가 맞으면 해당 답변, 아니면 안내
  if (consultBusy) return;
  const inp = document.getElementById('consult-input'), t = inp.value.trim(); if (!t) return;
  inp.value = ''; pushQA(CONSULT_QA.findIndex(x => x.kw.some(k => t.includes(k))), t);
}
function clearConsult(){ consultLog.length = 0; consultBusy = false; renderConsult(); }
// Esc 키: 열려 있는 메뉴/시트 닫기
window.addEventListener('keydown', e => { if (e.key === 'Escape') { toggleFab(false); closeAdd(); closeConfirm(); } });

/* ---------- 8. 초기화 ---------- */
window.addEventListener('DOMContentLoaded', () => {
  navigateTo('home');              // 첫 화면 = 홈
  checkAlarms();                   // 열자마자 한 번 검사
  setInterval(checkAlarms, 60000); // 이후 1분마다 검사
});

  

window.addEventListener('DOMContentLoaded', () => bindAnalyzerInputs());
