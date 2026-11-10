import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { addMonths, daysBetween, formatShort } from './dates.ts';
import { claimUpdate, loadProfile, loadState, ProfileError, updateState } from './store.ts';
import { actionableTasks, computeBriefing, type Profile } from './tasks.ts';

// 기획서의 클라이언트: 2026-06-10생, 2027-03-02 복직, 4개월 접종·부모급여 완료
const profile: Profile = {
	birthDate: '2026-06-10',
	returnDate: '2027-03-02',
	doneIds: ['vax-2m', 'vax-4m', 'checkup-1', 'money-parent-pay', 'money-child-allowance', 'daycare-waitlist'],
};

const byId = (briefing: ReturnType<typeof computeBriefing>, id: string) => {
	const task = briefing.tasks.find((t) => t.id === id);
	assert.ok(task, id);
	return task;
};

test('날짜 계산', () => {
	assert.equal(addMonths('2026-06-10', 4), '2026-10-10');
	assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
	assert.equal(addMonths('2027-03-02', -3), '2026-12-02');
	assert.equal(daysBetween('2026-06-10', '2026-11-05'), 148);
	assert.equal(formatShort('2026-11-05'), '11/5(목)');
});

test('기획서 예시: 11/5 기준 생후 148일', () => {
	const briefing = computeBriefing(profile, {}, '2026-11-05');
	assert.equal(briefing.ageDays, 148);
	assert.equal(briefing.ageMonths, 4);

	const checkup2 = byId(briefing, 'checkup-2');
	assert.equal(checkup2.status, 'urgent');
	assert.equal(checkup2.dueDate, '2026-12-10');

	const vax6 = byId(briefing, 'vax-6m');
	assert.equal(vax6.status, 'upcoming');
	assert.equal(vax6.startDate, '2026-12-10');

	assert.equal(byId(briefing, 'vax-4m').status, 'done');
	assert.equal(byId(briefing, 'money-first-meeting').dueDate, '2028-06-10');
	assert.equal(byId(briefing, 'daycare-fee').status, 'later');
	assert.equal(byId(briefing, 'checkup-3').status, 'later');
});

test('완료 버튼을 누르면 done, 마감이 지나면 missed', () => {
	const done = { 'checkup-2': { by: '엄마', at: '2026-11-06T00:00:00Z' } };
	const afterClick = computeBriefing(profile, done, '2026-11-06');
	assert.equal(byId(afterClick, 'checkup-2').status, 'done');
	assert.equal(byId(afterClick, 'checkup-2').doneBy, '엄마');

	const late = computeBriefing(profile, {}, '2026-12-11');
	assert.equal(byId(late, 'checkup-2').status, 'missed');
});

test('복직 한 달 전에는 보육료 신청이 🔴', () => {
	const briefing = computeBriefing(profile, {}, '2027-02-05');
	assert.equal(byId(briefing, 'daycare-fee').status, 'urgent');
	assert.equal(byId(briefing, 'daycare-docs').status, 'urgent');
	assert.equal(briefing.daysUntilReturn, 25);
});

test('버튼 대상은 놓친 것 → 급한 것 → 곧 할 것 순서', () => {
	const briefing = computeBriefing(profile, {}, '2026-11-05');
	const ids = actionableTasks(briefing).map((t) => t.id);
	assert.deepEqual(ids, ['checkup-2', 'vax-6m', 'vax-flu-first']);
});

test('프로필에 생일이나 복직일이 없으면 되묻는 메시지', () => {
	const dir = mkdtempSync(join(tmpdir(), 'wolryeong-'));
	const path = join(dir, 'profile.json');
	writeFileSync(path, JSON.stringify({ returnDate: '2027-03-02' }));
	assert.throws(() => loadProfile(path), (error: unknown) => {
		assert.ok(error instanceof ProfileError);
		assert.match(error.message, /아이 생일/);
		return true;
	});
});

test('상태 저장과 update_id 중복 방지', () => {
	const path = join(mkdtempSync(join(tmpdir(), 'wolryeong-')), 'data', 'state.json');
	assert.deepEqual(loadState(path).done, {});
	updateState((s) => {
		s.done['vax-6m'] = { by: '아빠', at: 'now' };
	}, path);
	assert.equal(loadState(path).done['vax-6m'].by, '아빠');
	assert.equal(claimUpdate(1, path), true);
	assert.equal(claimUpdate(1, path), false);
});
