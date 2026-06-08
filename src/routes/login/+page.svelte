<script>
	let { form } = $props();
	let loading = $state(false);

	function handleSubmit() {
		loading = true;
	}
</script>

<svelte:head>
	<title>Ingresar - GoToMarket</title>
</svelte:head>

<div class="login-wrapper fade-in">
	<div class="card text-center" style="margin-top: 5vh; border-radius: var(--border-radius-lg); padding: 2.5rem 2rem;">
		<div class="logo-large mb-2">🛒</div>
		<h1 class="mb-1">GoToMarket</h1>
		<p class="mb-2">Tu lista de compras para el mercado, siempre sincronizada.</p>

		<form method="POST" action="?/login" onsubmit={handleSubmit}>
			<div class="form-group" style="text-align: left;">
				<label for="email">Ingresa tu correo electrónico</label>
				<input
					type="email"
					id="email"
					name="email"
					placeholder="ejemplo@correo.com"
					required
					value={form?.email ?? ''}
					disabled={loading}
				/>
			</div>

			{#if form?.error}
				<div class="error-msg mb-2">
					⚠️ {form.error}
				</div>
			{/if}

			<button type="submit" class="btn btn-primary w-full mt-1" disabled={loading}>
				{loading ? 'Ingresando...' : 'Entrar / Registrarse'}
			</button>
		</form>
	</div>
</div>

<style>
	.login-wrapper {
		display: flex;
		flex-direction: column;
		justify-content: center;
		flex: 1;
	}
	
	.logo-large {
		font-size: 3.5rem;
		display: inline-block;
		animation: bounce 2s infinite;
	}

	.error-msg {
		color: #b91c1c;
		background: #fee2e2;
		padding: 0.75rem;
		border-radius: var(--border-radius-sm);
		font-size: 0.875rem;
		border: 1px solid #fca5a5;
		text-align: left;
	}

	@keyframes bounce {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-8px); }
	}
</style>
