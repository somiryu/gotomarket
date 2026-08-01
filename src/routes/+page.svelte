<script>
	import { enhance } from '$app/forms';

	let { data } = $props();
	/** @type {any[]} */
	let products = $state([]);

	// Keep internal state updated when server data changes
	$effect(() => {
		products = data.products || [];
	});

	/** @type {HTMLDialogElement | null} */
	let addDialog = $state(null);
	/** @type {HTMLDialogElement | null} */
	let priceDialog = $state(null);
	/** @type {HTMLDialogElement | null} */
	let filterDialog = $state(null);
	/** @type {HTMLDialogElement | null} */
	let detailsDialog = $state(null);
	let selectedProduct = $state({ id: '', name: '' });
	let selectedProductId = $state(null);
	let isEditingDetails = $state(false);

	let selectedProductDetails = $derived(
		products.find(p => p.id === selectedProductId) || null
	);

	// Close details dialog if the product is deleted from list
	$effect(() => {
		if (selectedProductId && !selectedProductDetails) {
			detailsDialog?.close();
			selectedProductId = null;
		}
	});

	/** @type {Record<string, boolean>} */
	let isSaving = $state({});
	let searchQuery = $state('');
	/** @type {string[]} */
	let activeFilters = $state([]);
	/** @type {string[]} */
	let activeTags = $state([]);
	let stickyHeight = $state(0);
	let showOnlyEssential = $state(false);

	let isSubmittingAdd = $state(false);
	let isSubmittingPrice = $state(false);
	let isSubmittingUpdate = $state(false);
	let isSubmittingDelete = $state(false);
	let isSubmittingScan = $state(false);

	let scanDialog = $state(null);
	let isScanningIA = $state(false);
	let scanImagePreview = $state(null);
	let scanResult = $state({
		productId: 'new',
		productName: '',
		price: '',
		unit: 'un',
		brand: '',
		place: 'Supermercado',
		stock: 'Alto',
		isNew: true
	});

	async function handleScanImage(event) {
		const input = event.target;
		if (!input.files || input.files.length === 0) return;

		const file = input.files[0];
		scanImagePreview = URL.createObjectURL(file);
		isScanningIA = true;
		scanDialog?.showModal();

		const formData = new FormData();
		formData.append('image', file);

		try {
			const response = await fetch('/api/scan', {
				method: 'POST',
				body: formData
			});
			const result = await response.json();

			if (result.success && result.data) {
				const data = result.data;
				scanResult = {
					productId: data.matched_product_id || 'new',
					productName: data.matched_product_name || data.suggested_name || '',
					price: data.price ? String(data.price) : '',
					unit: data.unit || 'un',
					brand: data.brand || '',
					place: data.place || 'Supermercado',
					stock: 'Alto',
					isNew: Boolean(data.is_new)
				};
			} else {
				alert(result.error || 'No se pudo procesar la etiqueta de la imagen.');
			}
		} catch (err) {
			console.error(err);
			alert('Error al procesar la imagen con la IA.');
		} finally {
			isScanningIA = false;
			input.value = '';
		}
	}

	let allTags = $derived(
		Array.from(new Set(products.flatMap(p => p.tags || []))).sort()
	);

	/** @param {any} productItem */
	function openDetailsDialog(productItem) {
		selectedProductId = productItem.id;
		isEditingDetails = false;
		detailsDialog?.showModal();
	}

	let filteredProducts = $derived(
		products.filter(p => {
			const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesFilter = activeFilters.length === 0 || activeFilters.includes(p.stock);
			const matchesEssential = !showOnlyEssential || p.is_essential;
			const matchesTags = activeTags.length === 0 || activeTags.some(t => (p.tags || []).includes(t));
			return matchesSearch && matchesFilter && matchesEssential && matchesTags;
		})
	);

	/** @param {any} productItem */
	function openPriceDialog(productItem) {
		selectedProduct = productItem;
		priceDialog?.showModal();
	}

	/** @param {string} filter */
	function toggleFilter(filter) {
		if (activeFilters.includes(filter)) {
			activeFilters = activeFilters.filter(f => f !== filter);
		} else {
			activeFilters = [...activeFilters, filter];
		}
	}

	/** @param {string} tag */
	function toggleTag(tag) {
		if (activeTags.includes(tag)) {
			activeTags = activeTags.filter(t => t !== tag);
		} else {
			activeTags = [...activeTags, tag];
		}
	}

	function clearFilters() {
		activeFilters = [];
		showOnlyEssential = false;
		activeTags = [];
	}

	/**
	 * @param {string} productId
	 * @param {string} newStock
	 */
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

	/** @param {number|null|undefined} value */
	function formatPrice(value) {
		if (value === null || value === undefined) return '';
		return new Intl.NumberFormat('es-CO', {
			style: 'currency',
			currency: 'COP',
			minimumFractionDigits: 0
		}).format(value);
	}

	/** @param {string} stock */
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

	<!-- Sticky Header Wrapper -->
	<div class="sticky-header-wrapper" bind:clientHeight={stickyHeight}>
		<!-- Barra de Búsqueda y Filtros -->
		<div class="search-filter-row">
			<div class="search-input-wrapper">
				<input 
					type="text" 
					placeholder="🔍 Buscar producto..." 
					bind:value={searchQuery}
				/>
			</div>
			<label class="btn btn-primary scan-btn" title="Escanear etiqueta de precio con IA" style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; white-space: nowrap;">
				<span>📸 Escanear IA</span>
				<input 
					type="file" 
					accept="image/*" 
					capture="environment" 
					onchange={handleScanImage} 
					style="display: none;" 
					disabled={isScanningIA}
				/>
			</label>
			<button 
				type="button" 
				onclick={() => filterDialog?.showModal()} 
				class="btn btn-secondary filter-btn {activeFilters.length > 0 || activeTags.length > 0 ? 'active' : ''}"
			>
				<span>🎛️ Filtros</span>
				{#if (activeFilters.length + activeTags.length) > 0}
					<span class="filter-count">{activeFilters.length + activeTags.length}</span>
				{/if}
			</button>
		</div>

		<!-- Chips de Filtros Activos -->
		{#if activeFilters.length > 0 || showOnlyEssential || activeTags.length > 0}
			<div class="active-filters-chips fade-in" style="margin-top: 0.75rem; margin-bottom: 0;">
				{#each activeFilters as filter}
					<button 
						type="button" 
						class="filter-chip {getStockClass(filter)}"
						onclick={() => toggleFilter(filter)}
					>
						<span>{filter}</span>
						<span class="chip-close">&times;</span>
					</button>
				{/each}
				{#each activeTags as tag}
					<button 
						type="button" 
						class="filter-chip tag-chip"
						onclick={() => toggleTag(tag)}
					>
						<span>🏷️ {tag}</span>
						<span class="chip-close">&times;</span>
					</button>
				{/each}
				{#if showOnlyEssential}
					<button 
						type="button" 
						class="filter-chip esencial-chip"
						onclick={() => showOnlyEssential = false}
					>
						<span>⭐ Esencial</span>
						<span class="chip-close">&times;</span>
					</button>
				{/if}
				<button 
					type="button" 
					class="btn-text clear-all-btn" 
					onclick={clearFilters}
				>
					Limpiar todo
				</button>
			</div>
		{/if}
	</div>

	<!-- Products Cards Grid layout -->
	<div class="products-cards-grid" style="margin-top: 1rem;">
		{#if products.length === 0}
			<div class="card empty-state w-full">
				<span style="font-size: 2rem;">🛍️</span>
				<p>No tienes productos. ¡Agrega el primero!</p>
			</div>
		{:else if filteredProducts.length === 0}
			<div class="card empty-state w-full">
				<span style="font-size: 1.5rem;">🔍</span>
				<p>No se encontraron productos con los criterios seleccionados.</p>
			</div>
		{:else}
			{#each filteredProducts as product (product.id)}
				<div class="card product-card">
					<!-- Top Row: Name + Star + Edit icon -->
					<div class="product-card-header">
						<button 
							type="button" 
							class="product-name-btn" 
							onclick={() => openDetailsDialog(product)}
							title="Ver detalles"
						>
							{#if product.is_essential}
								<span class="essential-star" title="Producto Esencial">⭐</span>
							{/if}
							<span class="product-name-text">{product.name}</span>
						</button>
						<button 
							type="button" 
							onclick={() => openDetailsDialog(product)} 
							class="btn-edit-icon" 
							title="Editar / Detalles"
						>
							✏️
						</button>
					</div>

					<!-- Tags (if any) -->
					{#if product.tags && product.tags.length > 0}
						<div class="product-tags-list">
							{#each product.tags as tag}
								<span class="product-tag-badge">{tag}</span>
							{/each}
						</div>
					{/if}

					<!-- Middle Row: $Price [- Quantity Unit] [Brand] -->
					<div class="product-card-body">
						<div class="price-qty-row">
							{#if product.latestPrice}
								<div class="price-container">
									<span class="price-value">{formatPrice(product.latestPrice.price)}</span>
									<span class="price-unit">/{product.latestPrice.unit}</span>
									{#if product.latestPrice.brand}
										<span class="price-brand-badge">{product.latestPrice.brand}</span>
									{/if}
								</div>
							{:else}
								<button type="button" onclick={() => openPriceDialog(product)} class="add-price-link">+ Precio</button>
							{/if}

							{#if product.quantity || product.unit}
								<span class="qty-dash">-</span>
								<span class="product-qty">Habitual: {product.quantity || ''} {product.unit || ''}</span>
							{/if}
						</div>
					</div>

					<!-- Bottom Row: Stock Select Dropdown -->
					<div class="product-card-footer">
						<div class="select-wrapper {getStockClass(product.stock)}">
							<select 
								value={product.stock} 
								onchange={(e) => {
									const target = e.target;
									if (target instanceof HTMLSelectElement) {
										handleStockChange(product.id, target.value);
									}
								}}
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
				</div>
			{/each}
		{/if}
	</div>
</div>

<!-- Floating Bottom IA Bar (Close to Thumb) -->
<div class="bottom-ia-bar">
	<label class="btn-ia-scan-floating" title="Escanear etiqueta de precio con IA">
		<span>✨ 📸 Escanear Etiqueta IA</span>
		<input 
			type="file" 
			accept="image/*" 
			capture="environment" 
			onchange={handleScanImage} 
			style="display: none;" 
			disabled={isScanningIA}
		/>
	</label>
	<button 
		type="button" 
		class="btn-add-floating"
		onclick={() => {
			newProduct = { name: '', stock: 'Alto', notes: '', is_essential: false, tags: [] };
			addDialog?.showModal();
		}}
		title="Agregar producto manualmente"
	>
		➕ Nuevo
	</button>
</div>

<!-- Add Product Modal Dialog -->
<dialog bind:this={addDialog}>
	<div class="dialog-header">
		<h2>Nuevo Producto</h2>
		<button onclick={() => addDialog?.close()} class="btn-text" style="font-size: 1.25rem;">&times;</button>
	</div>
	<form method="POST" action="?/addProduct" use:enhance={() => {
		isSubmittingAdd = true;
		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					addDialog?.close();
				}
				await update();
			} finally {
				isSubmittingAdd = false;
			}
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

		<div class="form-group" style="text-align: left;">
			<label for="new-product-stock">Stock Inicial</label>
			<select id="new-product-stock" name="stock">
				<option value="Alto">Alto</option>
				<option value="Suficiente" selected>Suficiente</option>
				<option value="Bajo">Bajo</option>
				<option value="Agotado">Agotado</option>
			</select>
		</div>

		<div class="flex-row gap-md" style="margin-bottom: 1.25rem;">
			<div class="form-group" style="text-align: left; flex: 1; margin-bottom: 0;">
				<label for="new-product-qty">Cantidad Habitual</label>
				<input type="number" id="new-product-qty" name="quantity" placeholder="Ej. 3" min="0" step="any" />
			</div>
			<div class="form-group" style="text-align: left; flex: 1; margin-bottom: 0;">
				<label for="new-product-unit">Unidad Habitual</label>
				<input type="text" id="new-product-unit" name="unit" placeholder="Ej. libras, kg" list="qty-units-suggestions" autocomplete="off" />
				<datalist id="qty-units-suggestions">
					<option value="libras"></option>
					<option value="paquetes"></option>
					<option value="grm"></option>
					<option value="kg"></option>
					<option value="und"></option>
				</datalist>
			</div>
		</div>

		<div class="form-group" style="flex-direction: row; align-items: center; gap: 0.5rem; margin-top: 1.25rem; margin-bottom: 1.25rem; text-align: left;">
			<input type="checkbox" id="new-product-essential" name="is_essential" style="width: 18px; height: 18px; accent-color: var(--color-primary); cursor: pointer;" />
			<label for="new-product-essential" style="font-size: 0.95rem; cursor: pointer; color: var(--color-text); font-weight: 500; margin-bottom: 0;">Marcar como producto esencial ⭐</label>
		</div>

		<div class="form-group" style="text-align: left;">
			<label for="new-product-tags">Etiquetas / Categorías</label>
			<input 
				type="text" 
				id="new-product-tags" 
				name="tags" 
				placeholder="Ej. Carnes, Pasillo 1 (separadas por comas)" 
				autocomplete="off"
			/>
		</div>

		<div class="dialog-footer">
			<button type="button" onclick={() => addDialog?.close()} class="btn btn-secondary" disabled={isSubmittingAdd}>Cancelar</button>
			<button type="submit" class="btn btn-primary" disabled={isSubmittingAdd}>
				{isSubmittingAdd ? 'Guardando...' : 'Agregar'}
			</button>
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
		isSubmittingPrice = true;
		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					priceDialog?.close();
				}
				await update();
			} finally {
				isSubmittingPrice = false;
			}
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
			<label for="brand">Marca (Opcional)</label>
			<input type="text" id="brand" name="brand" placeholder="Ej. Roa, Diana, Alpina" autocomplete="off" />
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
			<button type="button" onclick={() => priceDialog?.close()} class="btn btn-secondary" disabled={isSubmittingPrice}>Cancelar</button>
			<button type="submit" class="btn btn-primary" disabled={isSubmittingPrice}>
				{isSubmittingPrice ? 'Registrando...' : 'Registrar'}
			</button>
		</div>
	</form>
</dialog>

<!-- AI Scanner Modal Dialog -->
<dialog bind:this={scanDialog}>
	<div class="dialog-header">
		<h2>Escanear Etiqueta con IA</h2>
		<button onclick={() => scanDialog?.close()} class="btn-text" style="font-size: 1.25rem;">&times;</button>
	</div>

	{#if isScanningIA}
		<div class="empty-state" style="padding: 2.5rem 1rem;">
			<span style="font-size: 2.5rem; animation: pulse 1.5s infinite;">📸</span>
			<p style="font-weight: 600; color: var(--color-primary); margin-top: 0.5rem;">Analizando etiqueta con IA...</p>
			<p style="font-size: 0.8rem; color: var(--color-text-muted);">Extrayendo precio, unidad, marca y buscando coincidencias en tu catálogo...</p>
		</div>
	{:else}
		<form method="POST" action="?/saveScan" use:enhance={() => {
			isSubmittingScan = true;
			return async ({ result, update }) => {
				try {
					if (result.type === 'success') {
						scanDialog?.close();
					}
					await update();
				} finally {
					isSubmittingScan = false;
				}
			};
		}}>
			{#if scanImagePreview}
				<div style="text-align: center; margin-bottom: 1rem;">
					<img src={scanImagePreview} alt="Captura de precio" style="max-height: 120px; border-radius: 12px; object-fit: contain; border: 1px solid var(--card-border);" />
				</div>
			{/if}

			<div class="form-group" style="text-align: left;">
				<label for="scan-product">Producto detectado / Seleccionar</label>
				<select 
					id="scan-product" 
					name="productId" 
					bind:value={scanResult.productId} 
					onchange={(e) => {
						const target = e.target;
						if (target instanceof HTMLSelectElement) {
							scanResult.productId = target.value;
							if (target.value !== 'new') {
								const found = products.find(p => p.id === target.value);
								if (found) scanResult.productName = found.name;
							}
						}
					}}
				>
					<option value="new">➕ Crear como nuevo producto ({scanResult.productName || 'Nuevo'})</option>
					{#each products as product}
						<option value={product.id}>📌 {product.name}</option>
					{/each}
				</select>
			</div>

			{#if scanResult.productId === 'new'}
				<div class="form-group" style="text-align: left;">
					<label for="scan-product-name">Nombre del nuevo producto</label>
					<input type="text" id="scan-product-name" name="productName" bind:value={scanResult.productName} required />
				</div>
			{:else}
				<input type="hidden" name="productName" value={scanResult.productName} />
			{/if}

			<div class="flex-row gap-md" style="margin-bottom: 1rem;">
				<div class="form-group" style="text-align: left; flex: 1; margin-bottom: 0;">
					<label for="scan-price">Precio ($)</label>
					<input type="number" id="scan-price" name="price" bind:value={scanResult.price} placeholder="Ej. 2500" min="1" step="any" required />
				</div>
				<div class="form-group" style="text-align: left; flex: 1; margin-bottom: 0;">
					<label for="scan-unit">Unidad</label>
					<input type="text" id="scan-unit" name="unit" bind:value={scanResult.unit} placeholder="Ej. kg, un, ltr" required list="scan-units" autocomplete="off" />
					<datalist id="scan-units">
						<option value="kg"></option>
						<option value="grm"></option>
						<option value="un"></option>
						<option value="ltr"></option>
						<option value="paquete"></option>
					</datalist>
				</div>
			</div>

			<div class="flex-row gap-md" style="margin-bottom: 1rem;">
				<div class="form-group" style="text-align: left; flex: 1; margin-bottom: 0;">
					<label for="scan-brand">Marca (Opcional)</label>
					<input type="text" id="scan-brand" name="brand" bind:value={scanResult.brand} placeholder="Ej. Diana, Bimbo" autocomplete="off" />
				</div>
				<div class="form-group" style="text-align: left; flex: 1; margin-bottom: 0;">
					<label for="scan-place">Establecimiento</label>
					<input type="text" id="scan-place" name="place" bind:value={scanResult.place} placeholder="Ej. D1, Éxito" required list="scan-places" autocomplete="off" />
					<datalist id="scan-places">
						<option value="D1"></option>
						<option value="Ara"></option>
						<option value="Carulla"></option>
						<option value="Éxito"></option>
						<option value="Fruver"></option>
					</datalist>
				</div>
			</div>

			<div class="form-group" style="text-align: left;">
				<label for="scan-stock">Estado de Stock al Comprar</label>
				<select id="scan-stock" name="stock" bind:value={scanResult.stock}>
					<option value="Alto">🟢 Alto</option>
					<option value="Suficiente">🔵 Suficiente</option>
					<option value="Bajo">🟠 Bajo</option>
					<option value="Agotado">🔴 Agotado</option>
				</select>
			</div>

			<div class="dialog-footer mt-2">
				<button type="button" onclick={() => scanDialog?.close()} class="btn btn-secondary" disabled={isSubmittingScan}>Cancelar</button>
				<button type="submit" class="btn btn-primary" disabled={isSubmittingScan}>
					{isSubmittingScan ? 'Guardando...' : 'Guardar en Mercado'}
				</button>
			</div>
		</form>
	{/if}
</dialog>

<!-- Filter Modal Dialog -->
<dialog bind:this={filterDialog}>
	<div class="dialog-header">
		<h2>Filtrar Productos</h2>
		<button onclick={() => filterDialog?.close()} class="btn-text" style="font-size: 1.25rem;">&times;</button>
	</div>
	
	<div style="margin-bottom: 1.25rem; text-align: left;">
		<p class="filter-label">Stock de productos:</p>
		<div class="filter-buttons-grid" style="margin-bottom: 1.25rem;">
			{#each ['Alto', 'Suficiente', 'Bajo', 'Agotado'] as option}
				<button
					type="button"
					class="filter-option-btn {getStockClass(option)} {activeFilters.includes(option) ? 'active' : ''}"
					onclick={() => toggleFilter(option)}
				>
					<span class="option-indicator"></span>
					{option}
				</button>
			{/each}
		</div>

		<p class="filter-label">Prioridad:</p>
		<label class="essential-filter-toggle" style="margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.5rem; font-weight: 500; cursor: pointer;">
			<input type="checkbox" bind:checked={showOnlyEssential} />
			<span>Mostrar solo esenciales ⭐</span>
		</label>

		{#if allTags.length > 0}
			<p class="filter-label" style="margin-top: 1rem;">Etiquetas / Categorías:</p>
			<div class="filter-tags-grid">
				{#each allTags as tag}
					<button
						type="button"
						class="filter-tag-option-btn {activeTags.includes(tag) ? 'active' : ''}"
						onclick={() => toggleTag(tag)}
					>
						{tag}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="dialog-footer">
		<button type="button" onclick={clearFilters} class="btn btn-secondary" disabled={activeFilters.length === 0 && !showOnlyEssential && activeTags.length === 0}>
			Limpiar
		</button>
		<button type="button" onclick={() => filterDialog?.close()} class="btn btn-primary">
			Aceptar
		</button>
	</div>
</dialog>

<!-- Product Details Modal Dialog (Fullscreen style) -->
<dialog bind:this={detailsDialog} class="fullscreen-dialog">
	{#if selectedProductDetails}
		<div class="dialog-header">
			<h2>Detalles del Producto</h2>
			<button onclick={() => detailsDialog?.close()} class="btn-text" style="font-size: 1.5rem; font-weight: bold;">&times;</button>
		</div>

		<div class="dialog-body-scrollable">
			<!-- Product Info Card -->
			<div class="card" style="margin-bottom: 1.5rem; text-align: left;">
				{#if !isEditingDetails}
					<div class="flex-row justify-between mb-1" style="align-items: center;">
						<h1 style="font-size: 1.5rem; margin-bottom: 0;">{selectedProductDetails.name}</h1>
						<button onclick={() => isEditingDetails = true} class="btn btn-secondary btn-sm" style="padding: 0.35rem 0.75rem; font-size: 0.85rem;">Editar</button>
					</div>

					{#if selectedProductDetails.quantity || selectedProductDetails.unit || selectedProductDetails.is_essential}
						<div class="mb-2" style="font-size: 0.95rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
							{#if selectedProductDetails.quantity || selectedProductDetails.unit}
								<span>📍 Compra habitual: <strong style="color: var(--color-text);">{selectedProductDetails.quantity || ''} {selectedProductDetails.unit || ''}</strong></span>
							{/if}
							{#if selectedProductDetails.is_essential}
								<span class="badge-essential">⭐ Esencial</span>
							{/if}
						</div>
					{/if}
					
					{#if selectedProductDetails.tags && selectedProductDetails.tags.length > 0}
						<div class="mb-2" style="display: flex; gap: 0.35rem; flex-wrap: wrap; text-align: left;">
							{#each selectedProductDetails.tags as tag}
								<span class="product-tag-badge" style="font-size: 0.75rem; padding: 0.25rem 0.65rem;">{tag}</span>
							{/each}
						</div>
					{/if}

					<div class="product-notes mt-1">
						<span class="label">Notas adicionales / Detalles</span>
						<p class="notes-text" style="margin-top: 0.25rem;">
							{selectedProductDetails.notes || 'No hay notas adicionales para este producto.'}
						</p>
					</div>
				{:else}
					<form method="POST" action="?/updateProduct" use:enhance={() => {
						isSubmittingUpdate = true;
						return async ({ result, update }) => {
							try {
								if (result.type === 'success') {
									isEditingDetails = false;
								}
								await update();
							} finally {
								isSubmittingUpdate = false;
							}
						};
					}}>
						<input type="hidden" name="productId" value={selectedProductDetails.id} />
						
						<div class="form-group">
							<label for="edit-name">Nombre del Producto</label>
							<input type="text" id="edit-name" name="name" value={selectedProductDetails.name} required />
						</div>

						<div class="flex-row gap-md" style="margin-bottom: 1.25rem;">
							<div class="form-group" style="text-align: left; flex: 1; margin-bottom: 0;">
								<label for="edit-quantity">Cantidad Habitual</label>
								<input type="number" id="edit-quantity" name="quantity" value={selectedProductDetails.quantity || ''} min="0" step="any" />
							</div>
							<div class="form-group" style="text-align: left; flex: 1; margin-bottom: 0;">
								<label for="edit-details-unit">Unidad Habitual</label>
								<input type="text" id="edit-details-unit" name="unit" value={selectedProductDetails.unit || ''} placeholder="Ej. libras, kg" list="edit-dialog-units" autocomplete="off" />
								<datalist id="edit-dialog-units">
									<option value="libras"></option>
									<option value="paquetes"></option>
									<option value="grm"></option>
									<option value="kg"></option>
									<option value="und"></option>
								</datalist>
							</div>
						</div>

						<div class="form-group" style="flex-direction: row; align-items: center; gap: 0.5rem; margin-top: 1.25rem; margin-bottom: 1.25rem;">
							<input type="checkbox" id="edit-essential" name="is_essential" checked={selectedProductDetails.is_essential} style="width: 18px; height: 18px; accent-color: var(--color-primary); cursor: pointer;" />
							<label for="edit-essential" style="font-size: 0.95rem; cursor: pointer; color: var(--color-text); font-weight: 500; margin-bottom: 0;">Marcar como producto esencial ⭐</label>
						</div>

						<div class="form-group">
							<label for="edit-tags">Etiquetas / Categorías</label>
							<input type="text" id="edit-tags" name="tags" value={selectedProductDetails.tags?.join(', ') || ''} placeholder="Ej. Carnes, Pasillo 1 (separadas por comas)" autocomplete="off" />
						</div>

						<div class="form-group">
							<label for="edit-notes">Notas / Descripción</label>
							<textarea id="edit-notes" name="notes" rows="3" placeholder="Ej: Comprar el paquete familiar o marca específica.">{selectedProductDetails.notes || ''}</textarea>
						</div>

						<div class="flex-row mt-2" style="justify-content: flex-end; gap: 0.5rem;">
							<button type="button" onclick={() => isEditingDetails = false} class="btn btn-secondary btn-sm" disabled={isSubmittingUpdate}>Cancelar</button>
							<button type="submit" class="btn btn-primary btn-sm" disabled={isSubmittingUpdate}>
								{isSubmittingUpdate ? 'Guardando...' : 'Guardar'}
							</button>
						</div>
					</form>
				{/if}
			</div>

			<!-- Prices Section Header -->
			<div class="flex-row justify-between mb-2 mt-2" style="align-items: center;">
				<h2 style="font-size: 1.2rem; margin-bottom: 0;">Historial de Precios</h2>
				<button onclick={() => openPriceDialog(selectedProductDetails)} class="btn btn-primary btn-sm">
					+ Nuevo Precio
				</button>
			</div>

			<!-- Price list Card -->
			<div class="card prices-card" style="text-align: left;">
				<div class="prices-header-grid">
					<div>Precio</div>
					<div>Unidad</div>
					<div>Marca</div>
					<div>Lugar</div>
					<div>Fecha</div>
				</div>

				<div class="prices-body">
					{#if !selectedProductDetails.market_prices || selectedProductDetails.market_prices.length === 0}
						<div class="empty-state">
							<span style="font-size: 1.5rem;">💸</span>
							<p>No hay historial de precios para este producto.</p>
						</div>
					{:else}
						{#each selectedProductDetails.market_prices as priceLog (priceLog.id)}
							<div class="price-row-grid">
								<div class="col-price-value">
									{formatPrice(priceLog.price)}
								</div>
								<div class="col-price-unit">{priceLog.unit}</div>
								<div class="col-price-brand">{priceLog.brand || '-'}</div>
								<div class="col-price-place">{priceLog.place}</div>
								<div class="col-price-date flex-row justify-between w-full">
									<span>{new Date(priceLog.created_at).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
									
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
			<div class="card mt-2 danger-zone-card" style="background: rgba(254, 226, 226, 0.4); border-color: rgba(239, 68, 68, 0.2); text-align: left; margin-top: 1.5rem; margin-bottom: 5rem; padding: 1.25rem;">
				<h3 style="color: #991b1b; font-size: 0.95rem; font-weight: 600; margin-bottom: 0.25rem;">Zona de peligro</h3>
				<p style="font-size: 0.8rem; margin-bottom: 1rem; color: var(--color-text-muted);">Al eliminar este producto, se borrarán de forma permanente todos sus registros de precios e información.</p>
				<form method="POST" action="?/deleteProduct" use:enhance={() => {
					isSubmittingDelete = true;
					return async ({ result, update }) => {
						try {
							if (result.type === 'success') {
								detailsDialog?.close();
							}
							await update();
						} finally {
							isSubmittingDelete = false;
						}
					};
				}}>
					<input type="hidden" name="id" value={selectedProductDetails.id} />
					<button type="submit" class="btn btn-danger w-full btn-sm" disabled={isSubmittingDelete} onclick={(e) => { if (!confirm('¿Estás seguro de que deseas eliminar este producto y todo su historial de precios?')) e.preventDefault(); }}>
						{isSubmittingDelete ? 'Eliminando...' : 'Eliminar Producto'}
					</button>
				</form>
			</div>
		</div>
	{/if}
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
	}

	/* Responsive Grid Table */
	.table-header-grid {
		display: grid;
		grid-template-columns: 2.2fr 1.2fr 1.2fr 0.6fr;
		column-gap: 1.5rem;
		padding: 1.1rem 1rem;
		background: rgba(255, 255, 255, 0.96);
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-muted);
		position: sticky;
		top: var(--sticky-height, 0px);
		z-index: 40;
		border-top-left-radius: calc(var(--border-radius-md) - 1px);
		border-top-right-radius: calc(var(--border-radius-md) - 1px);
	}

	.table-row-grid {
		display: grid;
		grid-template-columns: 2.2fr 1.2fr 1.2fr 0.6fr;
		column-gap: 1.5rem;
		align-items: center;
		padding: 1.25rem 1rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.03);
	}

	.table-row-grid:last-child {
		border-bottom: none;
	}

	.col-product {
		font-weight: 500;
		padding-right: 0.25rem;
		display: flex;
		flex-direction: column;
		justify-content: center;
		overflow: hidden;
	}

	.product-name {
		font-size: 0.95rem;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.product-qty {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: 0.05rem;
	}

	.col-stock, .col-price {
		display: flex;
		align-items: center;
	}

	.col-action {
		display: flex;
		align-items: center;
		justify-content: flex-end;
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
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 600;
		text-align: center;
		border: none;
		cursor: pointer;
		font-family: inherit;
		transition: all var(--transition-fast);
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

	.sticky-header-wrapper {
		position: sticky;
		top: 0;
		z-index: 50;
		background: rgba(248, 250, 252, 0.85); /* Matches gradient light color with transparency */
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		padding: 0.75rem 0.5rem;
		margin-left: -0.5rem;
		margin-right: -0.5rem;
		margin-bottom: 1rem;
		border-radius: var(--border-radius-sm);
		box-shadow: 0 4px 20px -5px rgba(0, 0, 0, 0.03);
	}

	/* Search and filter row */
	.search-filter-row {
		display: flex;
		gap: 0.5rem;
		width: 100%;
	}

	.search-input-wrapper {
		flex: 1;
	}

	.search-input-wrapper input {
		background: var(--card-bg);
		border: 1px solid var(--card-border);
		border-radius: var(--border-radius-sm);
		font-size: 0.95rem;
		box-shadow: var(--card-shadow);
		width: 100%;
		padding: 0.75rem 1rem;
	}

	.filter-btn {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.75rem 1rem;
		white-space: nowrap;
		border-radius: var(--border-radius-sm);
		background: var(--card-bg);
		border: 1px solid var(--card-border);
		box-shadow: var(--card-shadow);
		font-weight: 500;
	}

	.filter-btn.active {
		border-color: var(--color-primary);
		background: rgba(139, 92, 246, 0.05);
		color: var(--color-primary);
	}

	.filter-count {
		background: var(--color-primary);
		color: white;
		font-size: 0.75rem;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		font-weight: 700;
	}

	/* Chips */
	.active-filters-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
		align-items: center;
	}

	.filter-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.35rem 0.65rem;
		border-radius: 12px;
		font-size: 0.8rem;
		font-weight: 600;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.filter-chip.alto {
		background-color: var(--stock-alto-bg);
		color: var(--stock-alto-text);
		border-color: rgba(6, 95, 70, 0.2);
	}
	.filter-chip.suficiente {
		background-color: var(--stock-suficiente-bg);
		color: var(--stock-suficiente-text);
		border-color: rgba(30, 64, 175, 0.2);
	}
	.filter-chip.bajo {
		background-color: var(--stock-bajo-bg);
		color: var(--stock-bajo-text);
		border-color: rgba(146, 64, 14, 0.2);
	}
	.filter-chip.agotado {
		background-color: var(--stock-agotado-bg);
		color: var(--stock-agotado-text);
		border-color: rgba(153, 27, 27, 0.2);
	}

	.filter-chip:hover {
		opacity: 0.8;
		transform: scale(0.96);
	}

	.chip-close {
		font-size: 1rem;
		line-height: 1;
		font-weight: 400;
	}

	.clear-all-btn {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-primary);
		cursor: pointer;
		padding: 0.25rem 0.5rem;
	}

	/* Filter modal */
	.filter-label {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-text-muted);
		margin-bottom: 0.75rem;
		text-align: left;
	}

	.filter-buttons-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.filter-option-btn {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-radius: var(--border-radius-sm);
		border: 1px solid rgba(0, 0, 0, 0.08);
		background: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		font-weight: 500;
		font-size: 0.9rem;
		color: var(--color-text);
		transition: all var(--transition-fast);
	}

	.filter-option-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
	}

	.option-indicator {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		border: 1.5px solid var(--color-text-muted);
		display: inline-block;
		position: relative;
		transition: all var(--transition-fast);
	}

	/* Active filter states in modal */
	.filter-option-btn.active {
		border-color: currentColor;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
	}

	.filter-option-btn.active.alto {
		background-color: var(--stock-alto-bg);
		color: var(--stock-alto-text);
	}
	.filter-option-btn.active.suficiente {
		background-color: var(--stock-suficiente-bg);
		color: var(--stock-suficiente-text);
	}
	.filter-option-btn.active.bajo {
		background-color: var(--stock-bajo-bg);
		color: var(--stock-bajo-text);
	}
	.filter-option-btn.active.agotado {
		background-color: var(--stock-agotado-bg);
		color: var(--stock-agotado-text);
	}

	.filter-option-btn.active .option-indicator {
		border-color: currentColor;
		background-color: currentColor;
	}

	.filter-option-btn.active .option-indicator::after {
		content: '✓';
		position: absolute;
		color: white;
		font-size: 10px;
		font-weight: bold;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	/* Fullscreen Dialog Overlay */
	dialog.fullscreen-dialog {
		width: 100vw;
		height: 100vh;
		max-width: 100vw;
		max-height: 100vh;
		margin: 0;
		border: none;
		border-radius: 0;
		display: none;
		flex-direction: column;
		padding: 1.25rem 1rem;
		background: var(--color-bg-gradient);
		box-shadow: none;
	}

	dialog.fullscreen-dialog[open] {
		display: flex;
		animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	@keyframes slideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}

	.dialog-body-scrollable {
		flex: 1;
		overflow-y: auto;
		padding-bottom: max(6rem, calc(5rem + env(safe-area-inset-bottom)));
		margin-top: 0.5rem;
		-webkit-overflow-scrolling: touch;
	}

	button.edit-price-link {
		font-size: 0.75rem;
		color: var(--color-primary);
		text-decoration: underline;
		margin-top: 0.1rem;
		width: fit-content;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		text-align: left;
	}

	/* Prices Grid inside Dialog */
	.prices-header-grid {
		display: grid;
		grid-template-columns: 1.1fr 0.7fr 0.9fr 0.9fr 1.4fr;
		padding: 0.85rem 0.75rem;
		background: rgba(0, 0, 0, 0.02);
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.price-row-grid {
		display: grid;
		grid-template-columns: 1.1fr 0.7fr 0.9fr 0.9fr 1.4fr;
		align-items: center;
		padding: 0.85rem 0.75rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.03);
		font-size: 0.9rem;
	}

	.col-price-brand {
		font-size: 0.85rem;
		color: var(--color-text);
		font-weight: 500;
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

	.essential-star {
		margin-right: 0.25rem;
		display: inline-block;
		color: #eab308;
		font-size: 0.95rem;
	}

	.essential-filter-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-radius: var(--border-radius-sm);
		border: 1px solid rgba(0, 0, 0, 0.08);
		background: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		font-weight: 500;
		font-size: 0.9rem;
		color: var(--color-text);
		width: 100%;
		transition: all var(--transition-fast);
	}

	.essential-filter-toggle input {
		width: 18px;
		height: 18px;
		accent-color: var(--color-primary);
		cursor: pointer;
		margin: 0;
	}

	.badge-essential {
		background: #fef3c7;
		color: #b45309;
		padding: 0.2rem 0.5rem;
		border-radius: 8px;
		font-size: 0.75rem;
		font-weight: 600;
		border: 1px solid rgba(180, 83, 9, 0.15);
		display: inline-flex;
		align-items: center;
	}

	.filter-chip.esencial-chip {
		background-color: #fef3c7;
		color: #b45309;
		border-color: rgba(180, 83, 9, 0.2);
	}

	/* Tag badges in dashboard table and details modal */
	.product-tags-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.25rem;
	}

	.product-tag-badge {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--color-primary);
		background: rgba(139, 92, 246, 0.08);
		border: 1px solid rgba(139, 92, 246, 0.15);
		padding: 0.1rem 0.35rem;
		border-radius: 6px;
		display: inline-block;
		white-space: nowrap;
	}

	/* Tag filter chips in active filters list */
	.filter-chip.tag-chip {
		background-color: rgba(139, 92, 246, 0.08);
		color: var(--color-primary);
		border-color: rgba(139, 92, 246, 0.2);
	}

	/* Filter Tags Grid inside Filter Dialog */
	.filter-tags-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		max-height: 120px;
		overflow-y: auto;
		padding: 0.1rem;
	}

	.filter-tag-option-btn {
		display: inline-flex;
		align-items: center;
		padding: 0.35rem 0.65rem;
		border-radius: 999px;
		border: 1px solid rgba(0, 0, 0, 0.08);
		background: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		font-weight: 500;
		font-size: 0.8rem;
		color: var(--color-text);
		transition: all var(--transition-fast);
	}

	.filter-tag-option-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
	}

	.filter-tag-option-btn.active {
		background-color: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
		box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
	}

	/* Products Cards Grid */
	.products-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
		width: 100%;
	}

	.product-card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 1.1rem;
		margin-bottom: 0;
		gap: 0.75rem;
		background: var(--card-bg);
		border-radius: var(--border-radius-md);
		border: 1px solid var(--card-border);
		box-shadow: var(--card-shadow);
	}

	.product-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.product-name-btn {
		background: none;
		border: none;
		padding: 0;
		font-family: inherit;
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--color-text);
		text-align: left;
		cursor: pointer;
		display: flex;
		align-items: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.product-name-btn:hover {
		color: var(--color-primary);
	}

	.product-name-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.btn-edit-icon {
		background: rgba(0, 0, 0, 0.04);
		border: none;
		font-size: 0.9rem;
		padding: 0.25rem 0.45rem;
		border-radius: 8px;
		cursor: pointer;
		transition: all var(--transition-fast);
		flex-shrink: 0;
	}

	.btn-edit-icon:hover {
		background: rgba(139, 92, 246, 0.15);
		transform: scale(1.08);
	}

	.product-card-body {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.price-qty-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
		font-size: 0.9rem;
	}

	.qty-dash {
		color: var(--color-text-muted);
		font-weight: 300;
	}

	.price-brand-badge {
		font-size: 0.72rem;
		font-weight: 500;
		color: #475569;
		background: #f1f5f9;
		border: 1px solid #cbd5e1;
		padding: 0.05rem 0.35rem;
		border-radius: 6px;
		margin-left: 0.25rem;
	}

	.product-card-footer {
		margin-top: 0.25rem;
	}

	.products-cards-grid {
		padding-bottom: max(8rem, calc(7rem + env(safe-area-inset-bottom))) !important;
	}

	.bottom-ia-bar {
		position: fixed;
		bottom: max(1.25rem, calc(1rem + env(safe-area-inset-bottom)));
		left: 50%;
		transform: translateX(-50%);
		z-index: 99;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background: rgba(255, 255, 255, 0.88);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		padding: 0.5rem 0.75rem;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.8);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
		max-width: calc(100vw - 1.5rem);
		width: max-content;
	}

	.btn-ia-scan-floating {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
		color: white;
		padding: 0.75rem 1.25rem;
		border-radius: 999px;
		font-weight: 600;
		font-size: 0.95rem;
		cursor: pointer;
		box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);
		transition: all var(--transition-fast);
		white-space: nowrap;
	}

	.btn-ia-scan-floating:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(139, 92, 246, 0.45);
	}

	.btn-add-floating {
		background: #f1f5f9;
		color: #334155;
		border: 1px solid #cbd5e1;
		padding: 0.75rem 1rem;
		border-radius: 999px;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
	}

	.btn-add-floating:hover {
		background: #e2e8f0;
		transform: translateY(-1px);
	}
</style>
