<script>
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let product = $state({ name: '', notes: '' });
	let prices = $state([]);

	$effect(() => {
		product = data.product;
		prices = data.prices || [];
	});

	let priceDialog = $state(null);
	let isEditingDetails = $state(false);

	function formatPrice(value) {
		return new Intl.NumberFormat('es-CO', {
			style: 'currency',
			currency: 'COP',
			minimumFractionDigits: 0
		}).format(value);
	}

	function formatDate(dateString) {
		const date = new Date(dateString);
		const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
		return `${months[date.getMonth()]} / ${date.getDate()} / ${date.getFullYear()}`;
	}
</script>

<svelte:head>
	<title>{product.name} - Detalles - GoToMarket</title>
</svelte:head>

<div class="product-details-container fade-in">
	<div class="mb-2">
		<a href="/" class="btn-back">← Volver a la lista</a>
	</div>

	<!-- Product Info Card -->
	<div class="card">
		{#if !isEditingDetails}
			<div class="flex-row justify-between mb-1">
				<h1>{product.name}</h1>
				<button onclick={() => isEditingDetails = true} class="btn-text">Editar</button>
			</div>
			
			<div class="product-notes mt-1">
				<span class="label">Notas adicionales / Detalles</span>
				<p class="notes-text">
					{product.notes || 'No hay notas adicionales para este producto.'}
				</p>
			</div>
		{:else}
			<form method="POST" action="?/updateProduct" use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						isEditingDetails = false;
					}
					await update();
				};
			}}>
				<div class="form-group">
					<label for="name">Nombre del Producto</label>
					<input type="text" id="name" name="name" value={product.name} required />
				</div>

				<div class="form-group">
					<label for="notes">Notas / Descripción</label>
					<textarea id="notes" name="notes" rows="3" placeholder="Ej: Comprar el paquete familiar o marca específica.">{product.notes || ''}</textarea>
				</div>

				{#if form?.error && !form?.success}
					<p class="error-msg mb-2">{form.error}</p>
				{/if}

				<div class="flex-row mt-2" style="justify-content: flex-end;">
					<button type="button" onclick={() => isEditingDetails = false} class="btn btn-secondary">Cancelar</button>
					<button type="submit" class="btn btn-primary">Guardar</button>
				</div>
			</form>
		{/if}
	</div>

	<!-- Prices Section Header -->
	<div class="flex-row justify-between mb-2 mt-2">
		<h2>Historial de Precios</h2>
		<button onclick={() => priceDialog?.showModal()} class="btn btn-primary btn-sm">
			+ Nuevo Precio
		</button>
	</div>

	<!-- Price list Card -->
	<div class="card prices-card">
		<div class="prices-header-grid">
			<div>Precio</div>
			<div>Unidad</div>
			<div>Lugar</div>
			<div>Fecha</div>
		</div>

		<div class="prices-body">
			{#if prices.length === 0}
				<div class="empty-state">
					<span style="font-size: 1.5rem;">💸</span>
					<p>No hay historial de precios para este producto.</p>
				</div>
			{:else}
				{#each prices as priceLog (priceLog.id)}
					<div class="price-row-grid">
						<div class="col-price-value">
							{formatPrice(priceLog.price)}
						</div>
						<div class="col-price-unit">{priceLog.unit}</div>
						<div class="col-price-place">{priceLog.place}</div>
						<div class="col-price-date flex-row justify-between w-full">
							<span>{formatDate(priceLog.created_at)}</span>
							
							<form method="POST" action="?/deletePrice" use:enhance style="display:inline;">
								<input type="hidden" name="priceId" value={priceLog.id} />
								<button type="submit" class="btn-delete-price" title="Eliminar registro">&times;</button>
							</form>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Dangerous Actions -->
	<div class="card mt-2" style="background: rgba(254, 226, 226, 0.4); border-color: rgba(239, 68, 68, 0.2);">
		<h3 style="color: #991b1b; font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem;">Zona de peligro</h3>
		<p style="font-size: 0.85rem; margin-bottom: 1rem;">Al eliminar este producto, se borrarán de forma permanente todos sus registros de precios e información.</p>
		<form method="POST" action="?/deleteProduct" use:enhance={() => {
			return ({ result }) => {
				// handled by redirect
			};
		}}>
			<button type="submit" class="btn btn-danger w-full btn-sm" onclick={(e) => { if (!confirm('¿Estás seguro de que deseas eliminar este producto y todo su historial de precios?')) e.preventDefault(); }}>
				Eliminar Producto
			</button>
		</form>
	</div>
</div>

<!-- Add Price Modal Dialog -->
<dialog bind:this={priceDialog}>
	<div class="dialog-header">
		<h2>Registrar Precio</h2>
		<button onclick={() => priceDialog?.close()} class="btn-text" style="font-size: 1.25rem;">&times;</button>
	</div>
	<form method="POST" action="?/addPrice" use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				priceDialog?.close();
			}
			await update();
		};
	}}>
		<div class="form-group">
			<label for="price">Precio ($)</label>
			<input type="number" id="price" name="price" placeholder="Ej. 20000" min="1" step="any" required />
		</div>

		<div class="form-group">
			<label for="unit">Unidad</label>
			<input type="text" id="unit" name="unit" placeholder="Ej. grm, kg, und, ltr" required list="units-suggestions" autocomplete="off" />
			<datalist id="units-suggestions">
				<option value="grm"></option>
				<option value="kg"></option>
				<option value="und"></option>
				<option value="ltr"></option>
				<option value="paquete"></option>
			</datalist>
		</div>

		<div class="form-group">
			<label for="place">Establecimiento / Lugar</label>
			<input type="text" id="place" name="place" placeholder="Ej. Ara, D1, Éxito, Carulla" required list="places-suggestions" autocomplete="off" />
			<datalist id="places-suggestions">
				<option value="Ara"></option>
				<option value="D1"></option>
				<option value="Éxito"></option>
				<option value="Carulla"></option>
				<option value="Mercado local"></option>
			</datalist>
		</div>

		<div class="dialog-footer">
			<button type="button" onclick={() => priceDialog?.close()} class="btn btn-secondary">Cancelar</button>
			<button type="submit" class="btn btn-primary">Registrar</button>
		</div>
	</form>
</dialog>

<style>
	.product-details-container {
		width: 100%;
	}

	.btn-back {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-primary);
		display: inline-block;
	}

	.product-notes {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.product-notes .label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.notes-text {
		font-size: 1rem;
		color: var(--color-text);
		white-space: pre-wrap;
		background: rgba(0, 0, 0, 0.02);
		padding: 0.75rem;
		border-radius: var(--border-radius-sm);
		border-left: 3px solid var(--color-primary);
	}

	.prices-card {
		padding: 0;
		overflow: hidden;
	}

	/* Prices Grid Table */
	.prices-header-grid {
		display: grid;
		grid-template-columns: 1.2fr 0.8fr 1fr 1.5fr;
		padding: 0.85rem 0.75rem;
		background: rgba(0, 0, 0, 0.02);
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.price-row-grid {
		display: grid;
		grid-template-columns: 1.2fr 0.8fr 1fr 1.5fr;
		align-items: center;
		padding: 0.85rem 0.75rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.03);
		font-size: 0.9rem;
	}

	.price-row-grid:last-child {
		border-bottom: none;
	}

	.col-price-value {
		font-weight: 600;
		color: var(--color-text);
	}

	.col-price-unit {
		color: var(--color-text-muted);
	}

	.col-price-place {
		font-weight: 500;
	}

	.col-price-date {
		color: var(--color-text-muted);
		font-size: 0.8rem;
	}

	.btn-delete-price {
		background: none;
		border: none;
		color: #ef4444;
		font-size: 1.2rem;
		cursor: pointer;
		line-height: 1;
		padding: 0 0.25rem;
		border-radius: 4px;
		transition: background var(--transition-fast);
	}

	.btn-delete-price:hover {
		background: #fee2e2;
	}

	.error-msg {
		color: #b91c1c;
		background: #fee2e2;
		padding: 0.5rem 0.75rem;
		border-radius: var(--border-radius-sm);
		font-size: 0.85rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2.5rem 1rem;
		text-align: center;
		gap: 0.5rem;
	}

	.btn-sm {
		padding: 0.5rem 0.75rem;
		font-size: 0.85rem;
	}
</style>
