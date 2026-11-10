import { createTelegramChannel } from '@flue/telegram';
import type { CallbackQuery, Message } from 'grammy/types';
import { triggerBriefing } from '../briefing-trigger.ts';
import { claimUpdate, updateState } from '../domain/store.ts';
import { SCHEDULE } from '../domain/schedule.ts';
import { telegram } from '../telegram/client.ts';

const HELP = [
	'👶 <b>월령 비서</b> (프로토타입)',
	'매일 아침 7시에 이 방으로 육아 브리핑을 보내 드려요.',
	'',
	'/briefing — 지금 바로 브리핑 받기',
	'/start — 이 방을 브리핑 받을 방으로 등록',
	'',
	'브리핑의 [✅ 완료] 버튼을 누르면 두 분 모두 누가 무엇을 끝냈는지 볼 수 있어요.',
].join('\n');

/** "/briefing@MyBot 이후 텍스트" → "briefing" */
function commandOf(text: string | undefined): string | undefined {
	return text?.match(/^\/([a-z_]+)(?:@\w+)?(?:\s|$)/i)?.[1]?.toLowerCase();
}

function displayName(from: { first_name: string; last_name?: string; username?: string }): string {
	return [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || '누군가';
}

async function reply(message: Message, text: string) {
	await telegram.sendMessage(message.chat.id, text, {
		parse_mode: 'HTML',
		...(message.message_thread_id ? { message_thread_id: message.message_thread_id } : {}),
	});
}

async function onMessage(message: Message, updateId: number) {
	const command = commandOf(message.text);

	if (command === 'start') {
		updateState((state) => {
			state.chatId = message.chat.id;
			state.chatTitle = message.chat.title;
		});
		await reply(message, `${HELP}\n\n✅ 이 방을 브리핑 받을 방으로 등록했어요.`);
		return;
	}

	if (command === 'briefing') {
		updateState((state) => {
			state.chatId ??= message.chat.id;
		});
		await telegram.sendChatAction(message.chat.id, 'typing');
		await triggerBriefing('command', `manual-${updateId}`);
		return;
	}

	if (command === 'help') {
		await reply(message, HELP);
		return;
	}

	// 맘카페 링크 질문 같은 자유 대화는 다음 단계 기능
	if (message.chat.type === 'private' || command) {
		await reply(message, '아직 프로토타입이라 /briefing 과 [완료]/[아직] 버튼만 할 수 있어요. 🙏');
	}
}

async function onCallback(query: CallbackQuery) {
	const [action, taskId] = (query.data ?? '').split(':');
	const item = SCHEDULE.find((entry) => entry.id === taskId);
	if (!item || (action !== 'done' && action !== 'later')) {
		await telegram.answerCallbackQuery(query.id, { text: '알 수 없는 버튼이에요.' });
		return;
	}
	const who = displayName(query.from);
	const message = query.message;

	if (action === 'later') {
		await telegram.answerCallbackQuery(query.id, { text: `내일 브리핑에서 "${item.title}"을 다시 알려 드릴게요.` });
		return;
	}

	updateState((state) => {
		state.done[item.id] = { by: who, at: new Date().toISOString() };
	});
	await telegram.answerCallbackQuery(query.id, { text: `"${item.title}" 완료로 기록했어요.` });
	if (!message || !('chat' in message)) return;

	// 누른 줄의 버튼은 지우고, 방에 누가 끝냈는지 남긴다.
	const keyboard = 'reply_markup' in message ? message.reply_markup?.inline_keyboard ?? [] : [];
	const remaining = keyboard.filter(
		(row) => !row.some((button) => 'callback_data' in button && button.callback_data?.endsWith(`:${item.id}`)),
	);
	await telegram
		.editMessageReplyMarkup(message.chat.id, message.message_id, { reply_markup: { inline_keyboard: remaining } })
		.catch((error) => console.warn('[telegram] 버튼 갱신 실패', error));
	await telegram.sendMessage(message.chat.id, `✅ ${who}님이 <b>${item.title}</b>을(를) 완료로 표시했어요.`, {
		parse_mode: 'HTML',
		reply_parameters: { message_id: message.message_id, allow_sending_without_reply: true },
	});
}

export const channel = createTelegramChannel({
	secretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN ?? '',

	// Path: /channels/telegram/webhook
	async webhook({ update }) {
		// Telegram은 실패한 webhook을 재전송하므로 같은 update는 한 번만 처리한다.
		if (!claimUpdate(update.update_id)) return;
		try {
			if (update.message) await onMessage(update.message, update.update_id);
			else if (update.callback_query) await onCallback(update.callback_query);
		} catch (error) {
			// 여기서 throw하면 Telegram이 같은 update를 계속 재전송하므로 기록만 한다.
			console.error('[telegram] update 처리 실패', update.update_id, error);
		}
	},
});
