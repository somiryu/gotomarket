import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';

export async function POST({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
	if (!apiKey) {
		return json({ error: 'No se ha configurado la API Key de Gemini.' }, { status: 500 });
	}

	try {
		const formData = await request.formData();
		const imageFile = formData.get('image');
		const mode = formData.get('mode')?.toString() || 'price'; // 'price', 'info', or 'receipt'

		if (!imageFile || !(imageFile instanceof Blob)) {
			return json({ error: 'No se proporcionó una imagen válida.' }, { status: 400 });
		}

		// Read image file as Base64
		const arrayBuffer = await imageFile.arrayBuffer();
		const base64Data = Buffer.from(arrayBuffer).toString('base64');
		const mimeType = imageFile.type || 'image/jpeg';

		// Fetch existing user products including notes and units for richer AI context
		const { data: userProducts, error: dbError } = await supabase
			.from('market_products')
			.select('id, name, notes, unit')
			.eq('user_id', locals.user.id)
			.order('name', { ascending: true });

		if (dbError) {
			return json({ error: 'Error al consultar productos existentes: ' + dbError.message }, { status: 500 });
		}

		// Include notes in the summary sent to Gemini for maximum matching context
		const productListSummary = userProducts?.map(p => ({
			id: p.id,
			name: p.name,
			notes: p.notes || undefined,
			unit: p.unit || undefined
		})) || [];

		// Initialize Gemini client
		const ai = new GoogleGenAI({ apiKey });

		// Choose prompt based on mode
		let prompt = '';

		if (mode === 'info') {
			prompt = `Analiza la imagen adjunta (foto del empaque de un producto, su etiqueta de ingredientes, tabla nutricional o información de producto).

Lista de productos que el usuario YA TIENE registrados en su catálogo de la app (con sus notas de contexto):
${JSON.stringify(productListSummary)}

Instrucciones:
1. Extrae y resume la información útil del producto que aparece en la imagen (ingredientes clave, instrucciones de uso, notas nutricionales o características destacadas). Haz un resumen conciso en español (máximo 2-3 frases limpias).
2. Compara el producto con la lista de productos del usuario:
   - Lee tanto el nombre ("name") como las notas ("notes") del usuario para identificar coincidencias de contexto.
   - Si coincide con un producto existente (ej: foto de reverso de "Musli" -> si las notas dicen "Ahí va sólo Musli" en Cereal Javi -> coincide con ese producto), asigna "matched_product_id" con el ID exacto y "matched_product_name" con el nombre exacto.
   - Si no coincide con ninguno, pon "matched_product_id": null y "suggested_name": nombre del producto.

RESPONDE ÚNICAMENTE EN FORMATO JSON PLANO VÁLIDO CON EL SIGUIENTE ESQUEMA EXACTO, SIN MARKDOWN:
{
  "matched_product_id": string | null,
  "matched_product_name": string | null,
  "suggested_name": string,
  "extracted_info": string
}`;
		} else {
			// Mode === 'price'
			prompt = `Analiza la imagen adjunta (foto de una etiqueta de precio o empaque de un producto en un supermercado).

Lista de productos que el usuario YA TIENE registrados en su catálogo de la app (incluye nombres y notas de contexto del usuario):
${JSON.stringify(productListSummary)}

Instrucciones de extracción:
1. Identifica el precio del producto (número flotante o entero positivo).
2. Identifica la unidad (ej: kg, grm, ltr, un, paquete, frasco, etc.).
3. Identifica la marca del producto SI Y SOLO SI aparece explícitamente impresa (ej: Diana, Bimbo, Pure Value, Refisal, De Todito). Si no figura o es genérico, retorna null.
4. Identifica el supermercado/establecimiento si figura en la etiqueta (ej: D1, Éxito, Ara, Carulla, Fruver). Si no figura, retorna null.
5. Compara el producto detectado con la lista de productos del usuario:
   - Revisa tanto el campo "name" como las "notes" adicionales de cada producto. Por ejemplo, si en la foto aparece "Musli Granola" y en las notas de un producto dice "Ahí va sólo Musli", empareja con ese producto.
   - Si coincide con un producto existente, asigna "matched_product_id" con el ID exacto, "matched_product_name" con el nombre exacto del producto en la lista, y "is_new": false.
   - Si no coincide con ninguno, asigna "matched_product_id": null, "matched_product_name": null, "suggested_name": un nombre limpio en español (ej: "Cereal Musli"), y "is_new": true.

RESPONDE ÚNICAMENTE EN FORMATO JSON PLANO VÁLIDO CON EL SIGUIENTE ESQUEMA EXACTO, SIN MARKDOWN:
{
  "matched_product_id": string | null,
  "matched_product_name": string | null,
  "suggested_name": string,
  "price": number | null,
  "unit": string | null,
  "brand": string | null,
  "place": string | null,
  "is_new": boolean
}`;
		}

		// Use model gemini-flash-latest (points to Google's newest Flash model automatically)
		let response;
		try {
			response = await ai.models.generateContent({
				model: 'gemini-flash-latest',
				contents: [
					{
						role: 'user',
						parts: [
							{ text: prompt },
							{
								inlineData: {
									mimeType: mimeType,
									data: base64Data
								}
							}
						]
					}
				]
			});
		} catch (modelErr) {
			console.warn('Fallback to gemini-2.0-flash due to:', modelErr.message);
			response = await ai.models.generateContent({
				model: 'gemini-2.0-flash',
				contents: [
					{
						role: 'user',
						parts: [
							{ text: prompt },
							{
								inlineData: {
									mimeType: mimeType,
									data: base64Data
								}
							}
						]
					}
				]
			});
		}

		const textResult = response.text || '';
		
		const cleanedJsonText = textResult
			.replace(/```json/gi, '')
			.replace(/```/g, '')
			.trim();

		const parsed = JSON.parse(cleanedJsonText);

		return json({
			success: true,
			mode,
			data: parsed
		});

	} catch (err) {
		console.error('Error scanning image with Gemini:', err);
		return json({ 
			error: 'Error al procesar la imagen con IA: ' + (err.message || 'Error desconocido')
		}, { status: 500 });
	}
}
