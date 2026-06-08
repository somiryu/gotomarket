<script>
	import { enhance } from '$app/forms';

	let { data } = $props();
	let products = $state([]);

	// Keep internal state updated when server data changes
	$effect(() => {
		products = data.products || [];
	});

	let addDialog = $state(null);
	let priceDialog = $state(null);
	let selectedProduct = $state({ id: '', name: '' });
	let isSaving = $state({});

	function openPriceDialog(productItem) {
		selectedProduct = productItem;
		priceDialog?.showModal();
	}

	async function handleStockChange(productId, newStock) {
		isSaving[productId] = true;
		try {
			const res = await fetch('/api/stock', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ id: productId, stock: newStock })
			});

			const result = await res.json();
			if (!res.ok || result.error) {
				alert(result.error || 'Error al actualizar stock.');
				// Reset local state by fetching page data again or restoring
			} else {
				// Update stock in local state array to trigger visual updates if any
				const product = products.find(p => p.id === productId);
				if (product) {
					product.stock = newStock;
				}
			}
		} catch (err) {
			alert('Error de red al actualizar stock.');
		} finally {
			isSaving[productId] = false;
		}
	}

	function formatPrice(value) {
		if (value === null || value === undefined) return '';
		return new Intl.NumberFormat('es-CO', {
			style: 'currency',
			currency: 'COP',
			minimumFractionDigits: 0
		}).format(value);
	}

	function getStockClass(stock) {
		switch (stock) {
			case 'Alto': return 'alto';
			case 'Suficiente': return 'suficiente';
			case 'Bajo': return 'bajo';
			case 'Agotado': return 'agotado';
			default: return '';
		}
	}
</script>

<svelte:head>
	<title>Mi Despensa - GoToMarket</title>
</svelte:head>

<div class="dashboard-container fade-in">
	<div class="dashboard-header flex-row justify-between mb-2">
		<div>
			<h1>Mi Lista</h1>
			<p>Lleva el control de tus compras y precios.</p>
		</div>
		<button onclick={() => addDialog?.showModal()} class="btn btn-primary">
			+ Nuevo
		</button>
	</div>

	<!-- Custom Table/Grid layout -->
	<div class="card table-card">
		<div class="table-header-grid">
			<div class="col-product">Producto</div>
			<div class="col-stock">Stock</div>
			<div class="col-price">Precios</div>
			<div class="col-action">Ver</div>
		</div>

		<div class="table-body">
			{#if products.length === 0}
				<div class="empty-state">
					<span style="font-size: 2rem;">🛍️</span>
					<p>No tienes productos. ¡Agrega el primero!</p>
				</div>
			{:else}
				{#each products as product (product.id)}
					<div class="table-row-grid">
						<div class="col-product">
							<span class="product-name">{product.name}</span>
						</div>
						
						<div class="col-stock">
							<div class="select-wrapper {getStockClass(product.stock)}">
								<select 
									value={product.stock} 
									onchange={(e) => handleStockChange(product.id, e.target.value)}
									disabled={isSaving[product.id]}
								>
									<option value="Alto">Alto</option>
									<option value="Suficiente">Suficiente</option>
									<option value="Bajo">Bajo</option>
									<option value="Agotado">Agotado</option>
								</select>
								{#if isSaving[product.id]}
									<span class="save-indicator">⏳</span>
								{/if}
							</div>
						</div>

						<div class="col-price">
							{#if product.latestPrice}
								<div class="price-container">
									<span class="price-value">{formatPrice(product.latestPrice.price)}</span>
									<span class="price-unit">/{product.latestPrice.unit}</span>
									<a href="/product/{product.id}" class="edit-price-link">Edit</a>
								</div>
							{:else}
								<button type="button" onclick={() => openPriceDialog(product)} class="add-price-link">+ Precio</button>
							{/if}
						</div>

						<div class="col-action">
							<a href="/product/{product.id}" class="btn-ver">Ver</a>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

<!-- Add Product Modal Dialog -->
<dialog bind:this={addDialog}>
	<div class="dialog-header">
		<h2>Nuevo Producto</h2>
		<button onclick={() => addDialog?.close()} class="btn-text" style="font-size: 1.25rem;">&times;</button>
	</div>
	<form method="POST" action="?/addProduct" use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				addDialog?.close();
			}
			await update();
		};
	}}>
		<div class="form-group">
			<label for="new-product-name">Nombre del Producto</label>
			<input 
				type="text" 
				id="new-product-name" 
				name="name" 
				placeholder="Ej. Papas a la francesa" 
				required 
				autocomplete="off"
			/>
		</div>
		<div class="dialog-footer">
			<button type="button" onclick={() => addDialog?.close()} class="btn btn-secondary">Cancelar</button>
			<button type="submit" class="btn btn-primary">Agregar</button>
		</div>
	</form>
</dialog>

<!-- Add Price Modal Dialog -->
<dialog bind:this={priceDialog}>
	<div class="dialog-header">
		<h2>Registrar Precio</h2>
		<button onclick={() => priceDialog?.close()} class="btn-text" style="font-size: 1.25rem;">&times;</button>
	</div>
	<p style="font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: 1rem; text-align: left;">
		Producto: <strong style="color: var(--color-text);">{selectedProduct.name}</strong>
	</p>
	<form method="POST" action="?/addPrice" use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				priceDialog?.close();
			}
			await update();
		};
	}}>
		<input type="hidden" name="productId" value={selectedProduct.id} />
		
		<div class="form-group" style="text-align: left;">
			<label for="price">Precio ($)</label>
			<input type="number" id="price" name="price" placeholder="Ej. 20000" min="1" step="any" required />
		</div>

		<div class="form-group" style="text-align: left;">
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

		<div class="form-group" style="text-align: left;">
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

<!-- Floating Action Button for easy access on mobile -->
<button onclick={() => addDialog?.showModal()} class="fab" title="Nuevo producto">
	+
</button>

<style>
	.dashboard-container {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.table-card {
		padding: 0;
		overflow: hidden;
	}

	/* Responsive Grid Table */
	.table-header-grid {
		display: grid;
		grid-template-columns: 2fr 1.5fr 1.8fr 0.7fr;
		padding: 1rem 0.75rem;
		background: rgba(0, 0, 0, 0.02);
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.table-row-grid {
		display: grid;
		grid-template-columns: 2fr 1.5fr 1.8fr 0.7fr;
		align-items: center;
		padding: 0.85rem 0.75rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.03);
	}

	.table-row-grid:last-child {
		border-bottom: none;
	}

	.col-product {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding-right: 0.25rem;
	}

	.product-name {
		font-size: 0.95rem;
		color: var(--color-text);
	}

	.col-stock, .col-price, .col-action {
		display: flex;
		align-items: center;
	}

	/* Dropdown custom styling */
	.select-wrapper {
		position: relative;
		width: 100%;
		display: flex;
		align-items: center;
	}

	.select-wrapper select {
		width: 100%;
		padding: 0.35rem 1.25rem 0.35rem 0.5rem;
		font-size: 0.8rem;
		font-weight: 600;
		border-radius: 12px;
		border: none;
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
		text-align: center;
	}

	/* Stock coloring options */
	.select-wrapper.alto select {
		background-color: var(--stock-alto-bg);
		color: var(--stock-alto-text);
	}
	.select-wrapper.suficiente select {
		background-color: var(--stock-suficiente-bg);
		color: var(--stock-suficiente-text);
	}
	.select-wrapper.bajo select {
		background-color: var(--stock-bajo-bg);
		color: var(--stock-bajo-text);
	}
	.select-wrapper.agotado select {
		background-color: var(--stock-agotado-bg);
		color: var(--stock-agotado-text);
	}

	/* Simple indicator for loading */
	.save-indicator {
		position: absolute;
		right: 4px;
		font-size: 0.7rem;
	}

	/* Price section */
	.price-container {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
		font-size: 0.85rem;
	}

	.price-value {
		font-weight: 600;
		color: var(--color-text);
	}

	.price-unit {
		font-size: 0.7rem;
		color: var(--color-text-muted);
	}

	.edit-price-link {
		font-size: 0.75rem;
		color: var(--color-primary);
		text-decoration: underline;
		margin-top: 0.1rem;
		width: fit-content;
	}

	.add-price-link {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-primary);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		text-align: left;
	}

	/* Actions */
	.btn-ver {
		background: rgba(139, 92, 246, 0.08);
		color: var(--color-primary);
		padding: 0.35rem 0.65rem;
		border-radius: 12px;
		font-size: 0.8rem;
		font-weight: 600;
		text-align: center;
		width: 100%;
	}

	.btn-ver:hover {
		background: var(--color-primary);
		color: white;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1.5rem;
		text-align: center;
		gap: 0.5rem;
	}
</style>
