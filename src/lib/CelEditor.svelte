<script lang="ts">
	import { basicSetup } from 'codemirror';
	import { EditorView } from '@codemirror/view';
	import { EditorState, type Extension } from '@codemirror/state';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { cel } from 'codemirror-cel';
	import type { VariableDeclaration, FunctionDeclaration } from 'codemirror-cel';

	interface Props {
		doc?: string;
		variables?: VariableDeclaration[];
		functions?: FunctionDeclaration[];
		theme?: 'light' | 'dark';
		onchange?: (value: string) => void;
	}

	let {
		doc = '',
		variables = [],
		functions = [],
		theme = 'dark',
		onchange
	}: Props = $props();

	let container: HTMLDivElement;
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let errorMessage = $state('');

	$effect(() => {
		let view: EditorView | undefined;
		let terminated = false;

		status = 'loading';

		(async () => {
			try {
				const worker = new Worker(
					new URL('codemirror-cel/worker', import.meta.url),
					{ type: 'module' }
				);

				const celExtensions = await cel({ worker, variables, functions });

				if (terminated) {
					worker.terminate();
					return;
				}

				const extensions: Extension[] = [
					basicSetup,
					...celExtensions,
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							onchange?.(update.state.doc.toString());
						}
					})
				];

				if (theme === 'dark') {
					extensions.push(oneDark);
				}

				view = new EditorView({
					parent: container,
					state: EditorState.create({ doc, extensions })
				});

				status = 'ready';
			} catch (e) {
				if (!terminated) {
					status = 'error';
					errorMessage = e instanceof Error ? e.message : String(e);
				}
			}
		})();

		return () => {
			terminated = true;
			view?.destroy();
		};
	});
</script>

<div class="cel-editor-wrapper">
	{#if status === 'loading'}
		<div class="status-bar loading">Initializing CEL language server (WASM)...</div>
	{:else if status === 'error'}
		<div class="status-bar error">Failed to load: {errorMessage}</div>
	{/if}
	<div class="editor-container" bind:this={container}></div>
</div>

<style>
	.cel-editor-wrapper {
		border: 1px solid #374151;
		border-radius: 8px;
		overflow: hidden;
	}

	.status-bar {
		padding: 6px 12px;
		font-size: 12px;
		font-family: monospace;
	}

	.status-bar.loading {
		background: #1e3a5f;
		color: #93c5fd;
	}

	.status-bar.error {
		background: #5f1e1e;
		color: #fca5a5;
	}

	.editor-container {
		min-height: 80px;
	}

	.editor-container :global(.cm-editor) {
		font-size: 14px;
	}

	.editor-container :global(.cm-editor.cm-focused) {
		outline: none;
	}
</style>
