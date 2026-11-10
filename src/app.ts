import { Cron } from 'croner';
import { Hono } from 'hono';
import { triggerBriefing } from './briefing-trigger.ts';
import { channel as telegram } from './channels/telegram.ts';

const app = new Hono();

// 텔레그램 webhook: POST /channels/telegram/webhook
// (로컬 개발에서는 `npm run poll`이 받은 update를 이 주소로 넘겨준다)
app.route('/channels/telegram', telegram.route());

app.get('/', (c) => c.text('월령 비서 is running'));

// 매일 아침 7시(한국 시간) 브리핑. BRIEFING_CRON=off 로 끌 수 있다.
const cron = process.env.BRIEFING_CRON ?? '0 7 * * *';
if (cron !== 'off') {
	new Cron(
		cron,
		{
			timezone: 'Asia/Seoul',
			protect: true,
			catch: (error) => console.error('[schedule] 아침 브리핑 실패', error),
		},
		async () => {
			await triggerBriefing('schedule');
		},
	);
	console.log(`[schedule] 아침 브리핑 예약: "${cron}" (Asia/Seoul)`);
}

export default app;
