import { supabase } from '$lib/supabase';
import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';

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
			event.cookies.delete('market_user_id', {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: !dev
			});
			event.locals.user = null;
		}
	} else {
		event.locals.user = null;
	}

	const isPublicRoute = 
		event.url.pathname.startsWith('/login') || 
		event.url.pathname.startsWith('/logout') || 
		event.url.pathname.startsWith('/favicon.ico');

	// Protect all routes except public ones
	if (!event.locals.user && !isPublicRoute) {
		throw redirect(303, '/login');
	}

	// If logged in and visiting GET /login directly, redirect to dashboard
	if (
		event.locals.user && 
		event.url.pathname === '/login' && 
		event.request.method === 'GET'
	) {
		throw redirect(303, '/');
	}

	const response = await resolve(event);
	return response;
}
