import { addDays, addMonths, daysBetween } from './dates.ts';
import { CATEGORY_LABEL, SCHEDULE, type Category, type Offset, type ScheduleItem } from './schedule.ts';

export type Profile = {
	/** 아이 생일 YYYY-MM-DD */
	birthDate: string;
	/** 복직일 YYYY-MM-DD */
	returnDate: string;
	address?: string;
	/** 입소대기 중인 어린이집 */
	daycares?: string[];
	/** 설정할 때 이미 끝낸 항목 id */
	doneIds?: string[];
};

export type DoneRecord = { by: string; at: string };

/**
 * urgent   🔴 기간 안이고 마감이 가까움
 * missed   ⚠️ 마감이 지났는데 완료 기록이 없음
 * upcoming 🟡 곧 시작됨
 * open     🟢 지금 할 수 있고 마감까지 여유 있음
 * done     ✅ 완료
 * later    아직 먼 일 (브리핑에 넣지 않음)
 */
export type TaskStatus = 'urgent' | 'missed' | 'upcoming' | 'open' | 'done' | 'later';

export type DueTask = {
	id: string;
	category: Category;
	categoryLabel: string;
	title: string;
	detail: string;
	startDate: string;
	dueDate: string;
	status: TaskStatus;
	/** 마감까지 남은 날 (지났으면 음수) */
	daysUntilDue: number;
	/** 시작까지 남은 날 (이미 시작했으면 0 이하) */
	daysUntilStart: number;
	source: { name: string; url: string };
	needsCheck: boolean;
	doneBy?: string;
};

export type Briefing = {
	today: string;
	ageDays: number;
	ageMonths: number;
	daysUntilReturn: number;
	tasks: DueTask[];
};

const DEFAULT_URGENT_DAYS = 42;
const DEFAULT_NOTICE_DAYS = 42;

function resolve(offset: Offset, profile: Profile): string {
	const base = offset.from === 'birth' ? profile.birthDate : profile.returnDate;
	return addDays(addMonths(base, offset.months ?? 0), offset.days ?? 0);
}

function statusOf(item: ScheduleItem, startDate: string, dueDate: string, today: string, done: boolean): TaskStatus {
	if (done) return 'done';
	const untilStart = daysBetween(today, startDate);
	const untilDue = daysBetween(today, dueDate);
	if (untilDue < 0) return 'missed';
	if (untilStart > 0) return untilStart <= (item.noticeDays ?? DEFAULT_NOTICE_DAYS) ? 'upcoming' : 'later';
	return untilDue <= (item.urgentDays ?? DEFAULT_URGENT_DAYS) ? 'urgent' : 'open';
}

/** 만 나이 개월 수 */
function ageInMonths(birthDate: string, today: string): number {
	let months = 0;
	while (addMonths(birthDate, months + 1) <= today) months++;
	return months;
}

export function computeBriefing(
	profile: Profile,
	done: Record<string, DoneRecord>,
	today: string,
	schedule: ScheduleItem[] = SCHEDULE,
): Briefing {
	const preDone = new Set(profile.doneIds ?? []);
	const tasks = schedule.map((item): DueTask => {
		const startDate = resolve(item.start, profile);
		const dueDate = resolve(item.due, profile);
		const record = done[item.id];
		const isDone = Boolean(record) || preDone.has(item.id);
		return {
			id: item.id,
			category: item.category,
			categoryLabel: CATEGORY_LABEL[item.category],
			title: item.title,
			detail: item.detail,
			startDate,
			dueDate,
			status: statusOf(item, startDate, dueDate, today, isDone),
			daysUntilDue: daysBetween(today, dueDate),
			daysUntilStart: daysBetween(today, startDate),
			source: item.source,
			needsCheck: Boolean(item.needsCheck),
			...(record ? { doneBy: record.by } : {}),
		};
	});

	return {
		today,
		ageDays: daysBetween(profile.birthDate, today),
		ageMonths: ageInMonths(profile.birthDate, today),
		daysUntilReturn: daysBetween(today, profile.returnDate),
		tasks,
	};
}

/** 브리핑에서 [완료]/[아직] 버튼을 달아 줄 항목: 지금 챙겨야 하는데 아직 안 한 것 */
export function actionableTasks(briefing: Briefing): DueTask[] {
	const order: TaskStatus[] = ['missed', 'urgent', 'upcoming', 'open'];
	return briefing.tasks
		.filter((task) => task.status === 'missed' || task.status === 'urgent' || task.status === 'upcoming')
		.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.daysUntilDue - b.daysUntilDue);
}
