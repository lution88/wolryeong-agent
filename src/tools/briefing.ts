import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { formatShort, todayInSeoul } from '../domain/dates.ts';
import { loadProfile, loadState, ProfileError } from '../domain/store.ts';
import { actionableTasks, computeBriefing } from '../domain/tasks.ts';
import { hasTelegramToken, sendHtml, taskKeyboard } from '../telegram/client.ts';

/** 오늘 기준 할 일을 계산한다. 기한·출처는 전부 코드(기준표)에서 나온다. */
export const getDueTasks = defineTool({
	name: 'get_due_tasks',
	description:
		'아이 생일·복직일·완료 기록으로 오늘 챙겨야 할 육아 행정 일을 계산해 돌려준다. ' +
		'브리핑에 들어가는 날짜, 기한, 금액, 출처 링크는 반드시 이 결과만 사용한다. ' +
		'status: missed=기한 지남, urgent=🔴 이번에 꼭, upcoming=🟡 곧 시작, open=🟢 지금 가능·여유 있음, done=✅ 완료.',
	async run() {
		const profile = loadProfile();
		const state = loadState();
		const today = todayInSeoul();
		const briefing = computeBriefing(profile, state.done, today);
		const tasks = briefing.tasks.filter(
			(task) => task.status !== 'later' && !(task.status === 'done' && task.daysUntilDue < 0),
		);
		return {
			output: {
				today,
				todayLabel: formatShort(today),
				ageDays: briefing.ageDays,
				ageMonths: briefing.ageMonths,
				returnDate: profile.returnDate,
				daysUntilReturn: briefing.daysUntilReturn,
				daycares: profile.daycares ?? [],
				tasks: tasks.map((task) => ({
					...task,
					startLabel: formatShort(task.startDate),
					dueLabel: formatShort(task.dueDate),
				})),
			},
		};
	},
});

/**
 * 브리핑을 텔레그램 방에 보낸다. 버튼은 모델이 고르지 않고 코드가 붙인다
 * (놓친 것·급한 것·곧 할 것마다 [완료]/[아직]).
 * chatId가 없으면(예: `flue run`) 보내지 않고 dry-run 결과만 돌려준다.
 */
export function sendBriefing(chatId: number | undefined) {
	return defineTool({
		name: 'send_briefing',
		description:
			'완성한 아침 브리핑을 부부 텔레그램 방에 보낸다. 한 번만 호출한다. ' +
			'text는 Telegram HTML(<b>, <i>, <a href="...">만 사용)로 쓴다. [완료]/[아직] 버튼은 자동으로 붙는다.',
		input: v.object({ text: v.pipe(v.string(), v.minLength(1)) }),
		async run({ data: { text } }) {
			const state = loadState();
			// 프로필이 비어 있어 되묻는 메시지를 보낼 때는 버튼 없이 보낸다.
			let buttons: ReturnType<typeof actionableTasks> = [];
			try {
				buttons = actionableTasks(computeBriefing(loadProfile(), state.done, todayInSeoul()));
			} catch (error) {
				if (!(error instanceof ProfileError)) throw error;
			}
			const target = chatId ?? state.chatId;

			if (target === undefined || !hasTelegramToken()) {
				return {
					output: {
						sent: false,
						dryRun: true,
						reason: '텔레그램 채팅방이나 봇 토큰이 설정되지 않아 보내지 않았어요.',
						buttons: buttons.map((task) => task.id),
					},
					terminate: true,
				};
			}
			const messageId = await sendHtml(target, text, taskKeyboard(buttons));
			return { output: { sent: true, messageId, buttons: buttons.map((task) => task.id) }, terminate: true };
		},
	});
}
