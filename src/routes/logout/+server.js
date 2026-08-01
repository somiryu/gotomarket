import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';

function clearAuthCookie(cookies) {
	cookies.set('market_user_id', '', {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 0,
		expires: new Date(0)
	});
	cookies.delete('market_user_id', {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev
	});
}

export async function POST({ cookies }) {
	clearAuthCookie(cookies);
	throw redirect(303, '/login');
}

export async function GET({ cookies }) {
	clearAuthCookie(cookies);
	throw redirect(303, '/login');
}
