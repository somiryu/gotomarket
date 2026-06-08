import { supabase } from '$lib/supabase';
import { error, redirect, fail } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	// Fetch products and their prices, sorted by product name
	const { data: products, error: dbError } = await supabase
		.from('market_products')
		.select(`
			*,
			market_prices (
				id,
				price,
				unit,
				place,
				created_at
			)
		`)
		.eq('user_id', locals.user.id)
		.order('name', { ascending: true })
		.order('created_at', { foreignTable: 'market_prices', ascending: false });

	if (dbError) {
		throw error(500, 'Error al cargar productos: ' + dbError.message);
	}

	return {
		products: products.map(product => {
			// Extract the latest price (first one, since they are sorted by created_at desc)
			const latestPrice = product.market_prices && product.market_prices.length > 0
				? product.market_prices[0]
				: null;
			return {
				...product,
				latestPrice
			};
		})
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	addProduct: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const data = await request.formData();
		const name = data.get('name')?.toString().trim();

		if (!name) {
			return fail(400, { error: 'El nombre del producto es requerido.' });
		}

		const { error: dbError } = await supabase
			.from('market_products')
			.insert({
				user_id: locals.user.id,
				name,
				stock: 'Suficiente' // default stock
			});

		if (dbError) {
			return fail(500, { error: 'Error al agregar producto: ' + dbError.message });
		}

		return { success: true };
	},

	deleteProduct: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const data = await request.formData();
		const id = data.get('id')?.toString();

		if (!id) {
			return fail(400, { error: 'ID de producto no especificado.' });
		}

		const { error: dbError } = await supabase
			.from('market_products')
			.delete()
			.eq('id', id)
			.eq('user_id', locals.user.id);

		if (dbError) {
			return fail(500, { error: 'Error al eliminar producto: ' + dbError.message });
		}

		return { success: true };
	}
};
