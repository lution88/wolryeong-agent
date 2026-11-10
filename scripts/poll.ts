// 로컬 개발용 브리지: 공개 URL(ngrok 등) 없이 텔레그램을 테스트한다.
// getUpdates로 받은 Update를 로컬 dev 서버의 webhook 주소로 secret 헤더와 함께 그대로 넘긴다.
// 실행: npm run dev (다른 터미널) + npm run poll
// 주의: 실행하면 봇에 설정된 webhook을 지운다. 배포 후에는 setWebhook을 다시 해야 한다.

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
const target = process.env.LOCAL_WEBHOOK_URL ?? 'http://localhost:5173/channels/telegram/webhook';

if (!token || !secret) {
	console.error('.env에 TELEGRAM_BOT_TOKEN과 TELEGRAM_WEBHOOK_SECRET_TOKEN을 넣어 주세요.');
	process.exit(1);
}

const api = async (method: string, body: Record<string, unknown> = {}) => {
	const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
	const json = (await response.json()) as { ok: boolean; result: any; description?: string };
	if (!json.ok) throw new Error(`${method}: ${json.description}`);
	return json.result;
};

const me = await api('getMe');
await api('deleteWebhook');
console.log(`@${me.username} 폴링 시작 → ${target}`);

let offset = 0;
while (true) {
	try {
		const updates: { update_id: number }[] = await api('getUpdates', {
			offset,
			timeout: 30,
			allowed_updates: ['message', 'callback_query'],
		});
		for (const update of updates) {
			offset = update.update_id + 1;
			const response = await fetch(target, {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
				body: JSON.stringify(update),
			});
			console.log(`update ${update.update_id} → ${response.status}`);
		}
	} catch (error) {
		console.error('폴링 오류, 5초 뒤 다시 시도', error);
		await new Promise((resolve) => setTimeout(resolve, 5000));
	}
}
