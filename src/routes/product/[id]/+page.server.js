import { supabase } from '$lib/supabase';
import { error, redirect, fail } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, locals }) {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const { id } = params;

	// Fetch product details
	const { data: product, error: productError } = await supabase
		.from('market_products')
		.select('*')
		.eq('id', id)
		.eq('user_id', locals.user.id)
		.maybeSingle();

	if (productError) {
		throw error(500, 'Error al obtener producto: ' + productError.message);
	}

	if (!product) {
		throw error(404, 'Producto no encontrado');
	}

	// Fetch price logs
	const { data: prices, error: pricesError } = await supabase
		.from('market_prices')
		.select('*')
		.eq('product_id', id)
		.order('created_at', { ascending: false });

	if (pricesError) {
		throw error(500, 'Error al obtener precios: ' + pricesError.message);
	}

	return {
		product,
		prices
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	updateProduct: async ({ request, params, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const data = await request.formData();
		const name = data.get('name')?.toString().trim();
		const notes = data.get('notes')?.toString().trim();
		const quantityRaw = data.get('quantity')?.toString().trim();
		const unit = data.get('unit')?.toString().trim() || null;

		if (!name) {
			return fail(400, { error: 'El nombre del producto es requerido.' });
		}

		const quantity = quantityRaw ? parseFloat(quantityRaw) : null;
		if (quantity !== null && isNaN(quantity)) {
			return fail(400, { error: 'La cantidad habitual debe ser un número.' });
		}

		const { error: dbError } = await supabase
			.from('market_products')
			.update({
				name,
				notes,
				quantity,
				unit,
				updated_at: new Date().toISOString()
			})
			.eq('id', params.id)
			.eq('user_id', locals.user.id);

		if (dbError) {
			return fail(500, { error: 'Error al actualizar producto: ' + dbError.message });
		}

		return { success: true };
	},

	addPrice: async ({ request, params, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const data = await request.formData();
		const priceRaw = data.get('price')?.toString();
		const unit = data.get('unit')?.toString().trim();
		const place = data.get('place')?.toString().trim();

		if (!priceRaw || !unit || !place) {
			return fail(400, { error: 'Todos los campos son requeridos para agregar un precio.' });
		}

		const price = parseFloat(priceRaw);
		if (isNaN(price) || price <= 0) {
			return fail(400, { error: 'Ingresa un valor numérico válido mayor a cero.' });
		}

		// First make sure product belongs to user
		const { data: product, error: checkError } = await supabase
			.from('market_products')
			.select('id')
			.eq('id', params.id)
			.eq('user_id', locals.user.id)
			.maybeSingle();

		if (checkError || !product) {
			return fail(403, { error: 'No autorizado o producto no existe.' });
		}

		const { error: dbError } = await supabase
			.from('market_prices')
			.insert({
				product_id: params.id,
				price,
				unit,
				place
			});

		if (dbError) {
			return fail(500, { error: 'Error al registrar el precio: ' + dbError.message });
		}

		return { success: true };
	},

	deletePrice: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const data = await request.formData();
		const priceId = data.get('priceId')?.toString();

		if (!priceId) {
			return fail(400, { error: 'ID de precio no especificado.' });
		}

		// Verify permission using joined deletion or verify relation
		// Delete price record
		const { error: dbError } = await supabase
			.from('market_prices')
			.delete()
			.eq('id', priceId);

		if (dbError) {
			return fail(500, { error: 'Error al eliminar precio: ' + dbError.message });
		}

		return { success: true };
	},

	deleteProduct: async ({ params, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const { error: dbError } = await supabase
			.from('market_products')
			.delete()
			.eq('id', params.id)
			.eq('user_id', locals.user.id);

		if (dbError) {
			return fail(500, { error: 'Error al eliminar producto: ' + dbError.message });
		}

		throw redirect(303, '/');
	}
};
