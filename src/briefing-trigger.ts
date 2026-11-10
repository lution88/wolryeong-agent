import { dispatch } from '@flue/runtime';
import { Briefing } from './agents/briefing.ts';
import { todayInSeoul } from './domain/dates.ts';
import { loadState } from './domain/store.ts';

/**
 * 브리핑 에이전트를 깨운다. 아침 스케줄과 /briefing 명령이 함께 쓴다.
 * 매번 새 대화(id)로 시작해서 대화 기록이 끝없이 길어지지 않게 한다.
 */
export async function triggerBriefing(reason: 'schedule' | 'command', suffix = ''): Promise<boolean> {
	const state = loadState();
	if (state.chatId === undefined) {
		console.warn('[briefing] 등록된 채팅방이 없어요. 텔레그램 방에서 /start 를 먼저 보내 주세요.');
		return false;
	}
	const today = todayInSeoul();
	await dispatch(Briefing, {
		id: `briefing-${today}${suffix ? `-${suffix}` : ''}`,
		initialData: {
			chatId: state.chatId,
			...(state.chatTitle ? { chatTitle: state.chatTitle } : {}),
		},
		message: {
			kind: 'signal',
			type: reason,
			body: '오늘의 육아 브리핑을 만들어 텔레그램 방에 보내 줘.',
			attributes: { today },
		},
	});
	return true;
}
