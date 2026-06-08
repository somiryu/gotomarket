import { supabase } from '$lib/supabase';
import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	try {
		const { id, stock } = await request.json();

		if (!id || !stock) {
			return json({ error: 'ID y Stock son requeridos.' }, { status: 400 });
		}

		const validStocks = ['Alto', 'Suficiente', 'Bajo', 'Agotado'];
		if (!validStocks.includes(stock)) {
			return json({ error: 'Nivel de stock inválido.' }, { status: 400 });
		}

		const { error: dbError } = await supabase
			.from('market_products')
			.update({ stock, updated_at: new Date().toISOString() })
			.eq('id', id)
			.eq('user_id', locals.user.id);

		if (dbError) {
			return json({ error: 'Error de base de datos: ' + dbError.message }, { status: 500 });
		}

		return json({ success: true });
	} catch (err) {
		return json({ error: 'Error de servidor: ' + err.message }, { status: 500 });
	}
}
