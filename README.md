# 👶 월령 비서 (wolryeong-agent)

> 아이 생일과 복직일을 기준으로 접종·검진·지원금·어린이집 입소처럼 **기한이 있는 육아 행정 일**을 계산하고 추적해서
> 매일 아침 텔레그램으로 부부에게 브리핑하는 에이전트. [Flue](https://flueframework.com) 2.3으로 만들었다.

기획서: <https://gist.github.com/lution88/3b9441bc9e776a93310bd38d66482ab6>

## 누구를 위한 에이전트인가

**5개월 딸을 키우며 육아휴직 중이고, 2027년 3월 복직을 앞둔 부모** (그리고 같이 육아하는 배우자)

- 혼자 쓸 수 있는 시간은 아이가 낮잠 자는 30분~1시간뿐이다. 이 시간에 맘카페를 보면서 "지금 뭘 챙겨야 하지?"를 찾는다.
- 해야 할 일을 **우연히** 알게 된다. 그래서 어린이집 입소대기를 늦게 걸어 순번이 밀린 적이 있다.
- 진행 상황이 배우자와 공유되지 않아서 "그거 했어?" 하다가 다툰다.

## 어떤 업무를 대신하나

아이 월령에 따라 돌아오는 **"기한 있는 육아 행정"을 챙기는 일**

| 분류 | 예시 | 놓치면 |
|---|---|---|
| 예방접종 | 2·4·6·12개월 접종, 첫 인플루엔자 | 접종 지연 |
| 영유아건강검진 | 1차(14~35일), 2차(4~6개월), 3차(9~12개월) | 무료 검진 기회를 잃음 |
| 지원금·바우처 | 부모급여, 아동수당, 첫만남이용권 사용 기한 | 받을 수 있는 돈을 못 받음 |
| 어린이집 | 입소대기 신청, 입소 서류, 보육료(바우처) 신청 | 복직했는데 맡길 곳이 없음 |

**비포**: 맘카페에서 우연히 알게 됨 → 여러 사이트를 오가며 확인 → 메모앱 → 카톡으로 배우자에게 알림(자주 잊음)
**애프터**: 매일 아침 7시 부부 텔레그램 방에 브리핑 → 끝낸 일은 [✅ 완료] 버튼 → 누가 무엇을 끝냈는지 둘 다 봄

## 진행 상황

이번 제출은 기획서 "최소 기능" 1번인 **월령 기반 할 일 계산 + 텔레그램 아침 브리핑 + [완료]/[아직] 버튼**만 만든 첫 프로토타입이다.

### ✅ 지금 되는 것

- **할 일 계산** (`src/domain/`): 생일·복직일·완료 기록으로 오늘 기준 항목마다 상태를 계산한다
  (⚠️ 기한 지남 / 🔴 이번에 꼭 / 🟡 곧 시작 / 🟢 진행 가능 / ✅ 완료). 기준표 14개 항목에 공식 출처 링크가 붙어 있다.
  단위 테스트 7개 통과 (기획서 예시 "11/5 기준 생후 148일, 검진 2차 🔴, 6개월 접종 🟡"를 그대로 검증)
- **브리핑 에이전트** (`src/agents/briefing.ts`): `get_due_tasks` 도구로 계산 결과를 받아 기획서 형식의 브리핑을 쓰고
  `send_briefing` 도구로 보낸다. 날짜·금액·출처는 도구 결과만 쓰도록 했다 (LLM이 기한을 지어내지 않게)
- **텔레그램 채널** (`src/channels/telegram.ts`, `@flue/telegram`): webhook secret 검증, `/start`(방 등록), `/briefing`(즉시 브리핑),
  [✅ 완료] 버튼 → 상태 저장 + 해당 버튼 제거 + "○○님이 완료로 표시했어요" 알림, [⏰ 아직] 버튼 → 다음 날 브리핑에 다시 올라옴,
  update_id 중복 처리 방지
- **아침 7시 스케줄** (`src/app.ts`, croner, Asia/Seoul)
- **로컬 테스트 브리지** (`scripts/poll.ts`): 공개 URL 없이 getUpdates → 로컬 webhook으로 넘겨준다
- 프로필에 생일·복직일이 없으면 브리핑 대신 무엇이 필요한지 되묻는다

로컬에서 확인한 것: 타입 체크, `vite build`, dev 서버에 가짜 Telegram update를 보내 secret 거부(401)·`/start` 등록·완료 버튼 상태 저장·중복 무시 동작,
`flue run`으로 에이전트가 모델 호출 단계까지 가는 것.

### 🚧 아직 안 되는 것

- **실제 텔레그램 방과 Claude API로 끝까지 돌려 보지 못했다** (봇 토큰과 API 키를 넣고 시험해야 함)
- 배포하지 않았다. 지금은 내 컴퓨터에서 `npm run dev` + `npm run poll`로만 돌아간다 (컴퓨터가 꺼져 있으면 7시 브리핑도 안 감)
- 처음 설정을 대화로 받지 못한다 → `profile.json`을 직접 고쳐야 한다
- 기획서 기능 중 이번에 만들지 않은 것
  - 어린이집 입소대기 **순번 조회**와 변화 알림 (Playwright로 아이사랑 포털 조회)
  - **신청서 작성 대행** (본인 인증·최종 승인은 사람이 하는 흐름)
  - 맘카페 링크를 붙여 "이거 우리도 해당돼?"라고 묻는 **질문 응답**
  - 일요일 **주간 요약표**, 이번 달 챙긴 지원금 금액 표시
  - 응답이 없을 때 따로 다시 알리기 (지금은 다음 날 브리핑에 다시 나오는 것만 됨)
- 기준표는 직접 관리한다 (2026-11-04 확인 기준). 정책이 바뀌어도 자동으로 감지하지 못하고, 바뀔 수 있는 항목은 "⚠️ 확인 필요"로 표시만 한다

## 구조

```
 매일 7:00 (croner) ─┐
 텔레그램 /briefing ──┴─▶ dispatch(Briefing) ──▶ get_due_tasks ──▶ domain/tasks.ts (기준표 + 날짜 계산)
                                   │                                    ▲
                                   └──▶ send_briefing ──▶ 텔레그램 방     │ data/state.json (완료 기록)
                                         (버튼은 코드가 붙임)              │
 [✅ 완료] 버튼 ──▶ channels/telegram.ts ────────────────────────────────┘ (LLM 없이 바로 저장 + 알림)
```

| 경로 | 역할 |
|---|---|
| `src/domain/schedule.ts` | 기준표: 항목, 시작·마감(생일+N개월 / 복직일−N개월), 공식 출처 |
| `src/domain/tasks.ts` | 오늘 기준 상태·긴급도 계산 |
| `src/domain/store.ts` | `profile.json` 읽기·검증, `data/state.json` 완료 기록 |
| `src/tools/briefing.ts` | flue 도구 `get_due_tasks`, `send_briefing` |
| `src/agents/briefing.ts` | 브리핑 에이전트 (`'use agent'`) |
| `src/channels/telegram.ts` | Telegram webhook 채널, 명령과 버튼 처리 |
| `src/app.ts` | Hono 라우터 + 아침 스케줄 |
| `scripts/poll.ts` | 로컬 개발용 polling → webhook 브리지 |

## 실행 방법

Node.js 22.19 이상이 필요하다.

```bash
npm install
cp .env.example .env              # ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET_TOKEN 입력
cp profile.example.json profile.json   # 아이 생일, 복직일, 이미 끝낸 항목 입력

npm test                          # 할 일 계산 단위 테스트
npx flue run src/agents/briefing.ts --data '{}' --message "오늘 브리핑"   # 텔레그램 없이 브리핑만 만들어 보기
```

텔레그램으로 돌려 보기

1. [@BotFather](https://t.me/BotFather)에서 봇을 만들고 토큰을 `.env`에 넣는다
2. 부부 그룹방에 봇을 초대한다
3. 터미널 두 개에서 `npm run dev`, `npm run poll`
4. 그룹방에서 `/start` → `/briefing`

`profile.json`의 `doneIds`에 넣을 수 있는 항목 id는 `src/domain/schedule.ts`에 있다.

> **참고**: `@flue/runtime` 2.3.0은 `@earendil-works/pi-ai` 1.5.0 이상에서 `Type` export가 빠져 실행이 깨진다.
> 그래서 `package.json`의 `overrides`로 pi-ai와 pi-agent-core를 1.4.0에 고정했다.

## 기준 정보 출처 (2026-11-04 확인)

- 영유아건강검진: [국민건강보험공단](https://www.nhis.or.kr/nhis/healthin/wbhaca04800m01.do)
- 부모급여: [복지로 2026년 부모급여 안내](https://www.bokjiro.go.kr/ssis-tbu/cms/pc/customer/notice/1309189_1141.html)
- 첫만남이용권: [정부24](https://www.gov.kr/portal/service/serviceInfo/135200005015)
- 아동수당: [복지로 뉴스](https://www.bokjiro.go.kr/ssis-tbu/cms/pc/news/news/1309692_1114.html)
- 예방접종: [질병관리청 예방접종도우미](https://nip.kdca.go.kr)
- 어린이집: [아이사랑 포털](https://www.childcare.go.kr)
