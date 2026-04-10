<script lang="ts">
	import { basicSetup } from 'codemirror';
	import { EditorView } from '@codemirror/view';
	import { EditorState, type Extension } from '@codemirror/state';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { cel, type CelLanguageConfig } from './cel/cel-language';

	interface Props {
		doc?: string;
		celConfig?: CelLanguageConfig;
		theme?: 'light' | 'dark';
		onchange?: (value: string) => void;
	}

	let { doc = '', celConfig, theme = 'dark', onchange }: Props = $props();

	let container: HTMLDivElement;

	$effect(() => {
		const extensions: Extension[] = [
			basicSetup,
			cel(celConfig),
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					onchange?.(update.state.doc.toString());
				}
			})
		];

		if (theme === 'dark') {
			extensions.push(oneDark);
		}

		const view = new EditorView({
			parent: container,
			state: EditorState.create({ doc, extensions })
		});

		return () => view.destroy();
	});
</script>

<div class="cel-editor-wrapper">
	<div class="editor-container" bind:this={container}></div>
</div>

<style>
	.cel-editor-wrapper {
		border: 1px solid #374151;
		border-radius: 8px;
		overflow: hidden;
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
