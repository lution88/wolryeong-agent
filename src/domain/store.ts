// 프로필(profile.json)과 진행 상태(data/state.json)를 파일로 보관한다.
// 텔레그램 버튼 처리(채널 코드)와 브리핑 에이전트(도구)가 같은 상태를 읽고 써야 해서
// 대화별로 저장되는 flue persistent state 대신 공용 파일을 쓴다.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isIsoDate } from './dates.ts';
import type { DoneRecord, Profile } from './tasks.ts';

export type State = {
	/** 브리핑을 보낼 텔레그램 채팅방 (/start 한 방) */
	chatId?: number;
	chatTitle?: string;
	done: Record<string, DoneRecord>;
	/** 최근 처리한 update_id (텔레그램 재전송 중복 방지) */
	recentUpdateIds: number[];
};

const PROFILE_PATH = resolve(process.env.PROFILE_PATH ?? 'profile.json');
const STATE_PATH = resolve(process.env.STATE_PATH ?? 'data/state.json');

export class ProfileError extends Error {}

export function loadProfile(path = PROFILE_PATH): Profile {
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		throw new ProfileError(
			`프로필 파일(${path})을 읽지 못했어요. profile.example.json을 복사해 profile.json을 만들어 주세요.`,
			{ cause: error },
		);
	}
	const profile = raw as Partial<Profile>;
	const missing: string[] = [];
	if (!isIsoDate(profile.birthDate)) missing.push('아이 생일(birthDate, 예: 2026-06-10) — 접종과 검진 일정을 계산하는 데 필요해요');
	if (!isIsoDate(profile.returnDate)) missing.push('복직일(returnDate, 예: 2027-03-02) — 어린이집 입소 일정을 계산하는 데 필요해요');
	if (missing.length) throw new ProfileError(`프로필에 다음 정보를 알려 주세요:\n- ${missing.join('\n- ')}`);
	return profile as Profile;
}

export function loadState(path = STATE_PATH): State {
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<State>;
		return { done: {}, recentUpdateIds: [], ...parsed };
	} catch {
		return { done: {}, recentUpdateIds: [] };
	}
}

/** 상태를 읽고 고쳐서 저장한다. 원자적으로 쓰려고 임시 파일에 쓴 뒤 바꿔 끼운다. */
export function updateState(change: (state: State) => void, path = STATE_PATH): State {
	const state = loadState(path);
	change(state);
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(state, null, '\t')}\n`);
	renameSync(tmp, path);
	return state;
}

/** 처음 보는 update_id면 기록하고 true. 이미 처리한 것이면 false. */
export function claimUpdate(updateId: number, path = STATE_PATH): boolean {
	let fresh = false;
	updateState((state) => {
		if (state.recentUpdateIds.includes(updateId)) return;
		fresh = true;
		state.recentUpdateIds = [...state.recentUpdateIds, updateId].slice(-200);
	}, path);
	return fresh;
}
