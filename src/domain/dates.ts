// 시간대 없이 "YYYY-MM-DD" 날짜만 다루는 작은 유틸. 내부적으로 UTC 자정으로 계산한다.

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
	if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
	return toIso(parse(value)) === value;
}

function parse(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** 개월 수를 더한다. 말일을 넘기면 그 달의 마지막 날로 맞춘다 (1/31 + 1개월 = 2/28). */
export function addMonths(iso: string, months: number): string {
	const date = parse(iso);
	const day = date.getUTCDate();
	date.setUTCDate(1);
	date.setUTCMonth(date.getUTCMonth() + months);
	const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
	date.setUTCDate(Math.min(day, lastDay));
	return toIso(date);
}

export function addDays(iso: string, days: number): string {
	return toIso(new Date(parse(iso).getTime() + days * DAY_MS));
}

/** b - a (일) */
export function daysBetween(a: string, b: string): number {
	return Math.round((parse(b).getTime() - parse(a).getTime()) / DAY_MS);
}

/** 한국 시간 기준 오늘 날짜 */
export function todayInSeoul(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(now);
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** "11/5(목)" */
export function formatShort(iso: string): string {
	const date = parse(iso);
	return `${date.getUTCMonth() + 1}/${date.getUTCDate()}(${WEEKDAYS[date.getUTCDay()]})`;
}
