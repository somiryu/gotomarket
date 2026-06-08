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
		const stock = data.get('stock')?.toString() || 'Suficiente';
		const quantityRaw = data.get('quantity')?.toString().trim();
		const unit = data.get('unit')?.toString().trim() || null;

		if (!name) {
			return fail(400, { error: 'El nombre del producto es requerido.' });
		}

		const validStocks = ['Alto', 'Suficiente', 'Bajo', 'Agotado'];
		if (!validStocks.includes(stock)) {
			return fail(400, { error: 'Nivel de stock inválido.' });
		}

		const quantity = quantityRaw ? parseFloat(quantityRaw) : null;
		if (quantity !== null && isNaN(quantity)) {
			return fail(400, { error: 'La cantidad habitual debe ser un número.' });
		}

		const { error: dbError } = await supabase
			.from('market_products')
			.insert({
				user_id: locals.user.id,
				name,
				stock,
				quantity,
				unit
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
	},

	addPrice: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const data = await request.formData();
		const productId = data.get('productId')?.toString();
		const priceRaw = data.get('price')?.toString();
		const unit = data.get('unit')?.toString().trim();
		const place = data.get('place')?.toString().trim();

		if (!productId || !priceRaw || !unit || !place) {
			return fail(400, { error: 'Todos los campos son requeridos para agregar un precio.' });
		}

		const price = parseFloat(priceRaw);
		if (isNaN(price) || price <= 0) {
			return fail(400, { error: 'Ingresa un valor numérico válido mayor a cero.' });
		}

		// Verify product belongs to user
		const { data: product, error: checkError } = await supabase
			.from('market_products')
			.select('id')
			.eq('id', productId)
			.eq('user_id', locals.user.id)
			.maybeSingle();

		if (checkError || !product) {
			return fail(403, { error: 'No autorizado o producto no existe.' });
		}

		const { error: dbError } = await supabase
			.from('market_prices')
			.insert({
				product_id: productId,
				price,
				unit,
				place
			});

		if (dbError) {
			return fail(500, { error: 'Error al registrar el precio: ' + dbError.message });
		}

		return { success: true };
	}
};
