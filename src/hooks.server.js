import { supabase } from '$lib/supabase';
import { redirect } from '@sveltejs/kit';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const userId = event.cookies.get('market_user_id');

	if (userId) {
		const { data: user, error } = await supabase
			.from('market_users')
			.select('*')
			.eq('id', userId)
			.single();

		if (user && !error) {
			event.locals.user = user;
		} else {
			event.cookies.delete('market_user_id', { path: '/' });
			event.locals.user = null;
		}
	} else {
		event.locals.user = null;
	}

	// Protect all routes except /login and static files / favicon / api (if you want api endpoints open, but here api needs auth too)
	if (!event.locals.user && !event.url.pathname.startsWith('/login') && !event.url.pathname.startsWith('/favicon.ico')) {
		throw redirect(303, '/login');
	}

	// If logged in and going to login, redirect to dashboard
	if (event.locals.user && event.url.pathname.startsWith('/login')) {
		throw redirect(303, '/');
	}

	const response = await resolve(event);
	return response;
}
