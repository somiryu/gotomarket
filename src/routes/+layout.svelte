<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children } = $props();
</script>

<svelte:head>
	<title>GoToMarket - Lista de Compras</title>
	<link rel="icon" type="image/svg+xml" href="{favicon}?v=3" />
</svelte:head>

<div class="app-container">
	{#if data?.user}
		<header class="fade-in">
			<a href="/" class="logo">
				🛒 <span>GoToMarket</span>
			</a>
			<form action="/login?/logout" method="POST" class="flex-row">
				<span style="font-size: 0.8rem; color: var(--color-text-muted); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
					{data.user.email}
				</span>
				<button type="submit" class="btn-text" title="Cerrar sesión">Salir</button>
			</form>
		</header>
	{/if}

	<main style="flex: 1; display: flex; flex-direction: column;">
		{@render children()}
	</main>
</div>
