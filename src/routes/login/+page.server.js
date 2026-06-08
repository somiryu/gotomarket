import { supabase } from '$lib/supabase';
import { redirect, fail } from '@sveltejs/kit';

/** @type {import('./$types').Actions} */
export const actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString().trim().toLowerCase();

		if (!email) {
			return fail(400, { error: 'El correo electrónico es requerido.' });
		}

		// Basic email format check
		if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
			return fail(400, { email, error: 'Ingresa un correo electrónico válido.' });
		}

		// Try to find the user in Supabase
		let { data: user, error } = await supabase
			.from('market_users')
			.select('*')
			.eq('email', email)
			.maybeSingle();

		if (error) {
			return fail(500, { email, error: 'Error al buscar el usuario: ' + error.message });
		}

		// Create user if not exists
		if (!user) {
			const { data: newUser, error: createError } = await supabase
				.from('market_users')
				.insert({ email })
				.select()
				.single();

			if (createError) {
				return fail(500, { email, error: 'Error al registrar el usuario: ' + createError.message });
			}
			user = newUser;
		}

		// Set user ID cookie for 30 days
		cookies.set('market_user_id', user.id, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: true,
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		throw redirect(303, '/');
	},

	logout: async ({ cookies }) => {
		cookies.delete('market_user_id', { path: '/' });
		throw redirect(303, '/login');
	}
};
