import { Api } from 'grammy';
import type { InlineKeyboardButton } from 'grammy/types';
import type { DueTask } from '../domain/tasks.ts';

// 발신용 Bot API 클라이언트. 토큰이 없어도 모듈은 로드되게 해서 `flue run` dry-run이 되도록 한다.
export const telegram = new Api(process.env.TELEGRAM_BOT_TOKEN ?? '');

export function hasTelegramToken(): boolean {
	return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

const MAX_TEXT = 4000; // Telegram 한도 4096자

/** HTML 모드로 보내 보고, 모델이 만든 HTML이 깨져서 거절되면 태그를 뺀 일반 텍스트로 다시 보낸다. */
export async function sendHtml(
	chatId: number,
	html: string,
	keyboard?: InlineKeyboardButton[][],
): Promise<number> {
	const text = html.length > MAX_TEXT ? `${html.slice(0, MAX_TEXT)}…` : html;
	const reply_markup = keyboard?.length ? { inline_keyboard: keyboard } : undefined;
	try {
		const message = await telegram.sendMessage(chatId, text, {
			parse_mode: 'HTML',
			link_preview_options: { is_disabled: true },
			reply_markup,
		});
		return message.message_id;
	} catch (error) {
		console.warn('[telegram] HTML 전송 실패, 일반 텍스트로 다시 보냄', error);
		const plain = text.replace(/<a href="([^"]+)">([^<]*)<\/a>/g, '$2 ($1)').replace(/<[^>]+>/g, '');
		const message = await telegram.sendMessage(chatId, plain, {
			link_preview_options: { is_disabled: true },
			reply_markup,
		});
		return message.message_id;
	}
}

/** 할 일마다 [✅ 제목 완료] [⏰ 아직] 한 줄 */
export function taskKeyboard(tasks: DueTask[]): InlineKeyboardButton[][] {
	return tasks.map((task) => [
		{ text: `✅ ${task.title} 완료`, callback_data: `done:${task.id}` },
		{ text: '⏰ 아직', callback_data: `later:${task.id}` },
	]);
}
