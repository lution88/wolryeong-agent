// 기준표: 아이 생일(birth) 또는 복직일(return)을 기준으로 "언제부터 언제까지" 해야 하는 육아 행정 일.
// 날짜 계산은 여기 데이터와 tasks.ts 코드가 하고, LLM은 이 결과를 문장으로 옮기기만 한다.
// 출처는 기획서 부록(2026-11-04 확인)을 따른다. 정책이 바뀔 수 있는 항목은 needsCheck로 표시한다.

export type Category = 'vaccine' | 'checkup' | 'money' | 'daycare';

/** 기준일로부터의 오프셋. months와 days를 함께 쓸 수 있고, 음수면 기준일 이전. */
export type Offset = { from: 'birth' | 'return'; months?: number; days?: number };

export type Source = { name: string; url: string };

export type ScheduleItem = {
	id: string;
	category: Category;
	title: string;
	detail: string;
	/** 할 수 있게 되는 날 */
	start: Offset;
	/** 마감일 (이날까지 포함) */
	due: Offset;
	source: Source;
	/** 정책·지자체마다 달라질 수 있어 공식 출처에서 다시 확인해야 하는 항목 */
	needsCheck?: boolean;
	/** 마감 며칠 전부터 🔴로 올릴지 (기본 42일) */
	urgentDays?: number;
	/** 시작 며칠 전부터 🟡로 미리 알릴지 (기본 42일) */
	noticeDays?: number;
};

const KDCA: Source = { name: '질병관리청 예방접종도우미', url: 'https://nip.kdca.go.kr' };
const NHIS: Source = {
	name: '국민건강보험공단',
	url: 'https://www.nhis.or.kr/nhis/healthin/wbhaca04800m01.do',
};
const BOKJIRO_PARENT: Source = {
	name: '복지로 2026년 부모급여 안내',
	url: 'https://www.bokjiro.go.kr/ssis-tbu/cms/pc/customer/notice/1309189_1141.html',
};
const BOKJIRO_CHILD: Source = {
	name: '복지로 아동수당 안내',
	url: 'https://www.bokjiro.go.kr/ssis-tbu/cms/pc/news/news/1309692_1114.html',
};
const GOV24_VOUCHER: Source = {
	name: '정부24 첫만남이용권',
	url: 'https://www.gov.kr/portal/service/serviceInfo/135200005015',
};
const CHILDCARE: Source = { name: '아이사랑 포털', url: 'https://www.childcare.go.kr' };

const birth = (months: number, days = 0): Offset => ({ from: 'birth', months, days });
const beforeReturn = (months: number, days = 0): Offset => ({
	from: 'return',
	months: -months,
	days: -days,
});

export const SCHEDULE: ScheduleItem[] = [
	// ── 예방접종 (질병관리청 표준예방접종일정) ──
	{
		id: 'vax-2m',
		category: 'vaccine',
		title: '2개월 예방접종',
		detail: 'DTaP·폴리오·Hib·폐렴구균 1차, 로타바이러스 1차',
		start: birth(2),
		due: birth(3),
		source: KDCA,
	},
	{
		id: 'vax-4m',
		category: 'vaccine',
		title: '4개월 예방접종',
		detail: 'DTaP·폴리오·Hib·폐렴구균 2차, 로타바이러스 2차',
		start: birth(4),
		due: birth(5),
		source: KDCA,
	},
	{
		id: 'vax-6m',
		category: 'vaccine',
		title: '6개월 예방접종',
		detail: 'DTaP·폴리오·Hib·폐렴구균·B형간염 3차 등 (로타바이러스 3차는 백신 종류에 따라 다름)',
		start: birth(6),
		due: birth(7),
		source: KDCA,
	},
	{
		id: 'vax-flu-first',
		category: 'vaccine',
		title: '첫 인플루엔자 접종',
		detail: '생후 6개월부터 가능. 처음 맞는 해에는 4주 간격으로 2회. 접종 시기는 절기마다 다름',
		start: birth(6),
		due: birth(12),
		source: KDCA,
		needsCheck: true,
		urgentDays: 30,
	},
	{
		id: 'vax-12m',
		category: 'vaccine',
		title: '12개월 예방접종',
		detail: 'MMR 1차, 수두, Hib·폐렴구균 4차(추가), A형간염 1차, 일본뇌염 1차',
		start: birth(12),
		due: birth(15),
		source: KDCA,
	},

	// ── 영유아건강검진 (검진 가능 기간: 시작 월의 출생일 ~ 종료 월의 출생일) ──
	{
		id: 'checkup-1',
		category: 'checkup',
		title: '영유아건강검진 1차',
		detail: '생후 14~35일',
		start: birth(0, 14),
		due: birth(0, 35),
		source: NHIS,
	},
	{
		id: 'checkup-2',
		category: 'checkup',
		title: '영유아건강검진 2차',
		detail: '생후 4~6개월. 기간이 지나면 무료 검진 기회가 사라짐',
		start: birth(4),
		due: birth(6),
		source: NHIS,
	},
	{
		id: 'checkup-3',
		category: 'checkup',
		title: '영유아건강검진 3차',
		detail: '생후 9~12개월. 복직 직후와 겹칠 수 있음',
		start: birth(9),
		due: birth(12),
		source: NHIS,
	},

	// ── 지원금·바우처 ──
	{
		id: 'money-parent-pay',
		category: 'money',
		title: '부모급여 신청',
		detail: '0세 월 100만원. 출생 후 60일 안에 신청하면 출생월부터 소급',
		start: birth(0),
		due: birth(0, 60),
		source: BOKJIRO_PARENT,
	},
	{
		id: 'money-child-allowance',
		category: 'money',
		title: '아동수당 신청',
		detail: '만 9세 미만, 기본 월 10만원. 출생 후 60일 안에 신청하면 소급',
		start: birth(0),
		due: birth(0, 60),
		source: BOKJIRO_CHILD,
	},
	{
		id: 'money-first-meeting',
		category: 'money',
		title: '첫만남이용권 사용',
		detail: '첫째 200만원. 출생일로부터 2년 안에 다 써야 함',
		start: birth(0),
		due: birth(24),
		source: GOV24_VOUCHER,
		urgentDays: 60,
	},

	// ── 어린이집 (복직일 기준) ──
	{
		id: 'daycare-waitlist',
		category: 'daycare',
		title: '어린이집 입소대기 신청',
		detail: '아이사랑 포털에서 희망 어린이집에 입소대기 신청. 늦게 걸수록 순번이 밀림',
		start: birth(0),
		due: beforeReturn(3),
		source: CHILDCARE,
		urgentDays: 90,
	},
	{
		id: 'daycare-docs',
		category: 'daycare',
		title: '어린이집 입소 서류 준비',
		detail: '입소 확정 후 재직증명서 등 우선순위 증빙 서류 제출. 필요한 서류는 어린이집·지자체마다 다름',
		start: beforeReturn(2),
		due: beforeReturn(0, 7),
		source: CHILDCARE,
		needsCheck: true,
	},
	{
		id: 'daycare-fee',
		category: 'daycare',
		title: '보육료(바우처) 신청',
		detail:
			'입소하면 0세 부모급여 월 100만원이 보육료 바우처 58.4만원 + 현금 41.6만원으로 바뀜. 보육료는 따로 신청해야 함',
		start: beforeReturn(1),
		due: beforeReturn(0, 1),
		source: BOKJIRO_PARENT,
	},
];

export const CATEGORY_LABEL: Record<Category, string> = {
	vaccine: '예방접종',
	checkup: '영유아검진',
	money: '지원금·바우처',
	daycare: '어린이집',
};
