import { parser } from './cel-parser.js';
import {
	LRLanguage,
	LanguageSupport,
	indentNodeProp,
	foldNodeProp,
	foldInside
} from '@codemirror/language';
import { styleTags, tags as t } from '@lezer/highlight';
import { completeFromList, type CompletionSource } from '@codemirror/autocomplete';

const parserWithMetadata = parser.configure({
	props: [
		styleTags({
			Identifier: t.variableName,
			'CallExpression/Identifier': t.function(t.variableName),
			PropertyName: t.propertyName,
			Number: t.number,
			String: t.string,
			Boolean: t.bool,
			Null: t.null,
			LineComment: t.lineComment,
			CompareOp: t.compareOperator,
			ArithOp: t.arithmeticOperator,
			UnaryOp: t.operator,
			'in': t.operatorKeyword,
			'"||" "&&"': t.logicOperator,
			'"?" ":"': t.punctuation,
			'"(" ")"': t.paren,
			'"[" "]"': t.squareBracket,
			'"{" "}"': t.brace,
			'","': t.separator,
			'"."': t.derefOperator
		}),
		indentNodeProp.add({
			ListLiteral: (context) => context.column(context.node.from) + context.unit,
			MapLiteral: (context) => context.column(context.node.from) + context.unit
		}),
		foldNodeProp.add({
			ListLiteral: foldInside,
			MapLiteral: foldInside
		})
	]
});

const celLanguage = LRLanguage.define({
	parser: parserWithMetadata,
	languageData: {
		commentTokens: { line: '//' },
		closeBrackets: { brackets: ['(', '[', '{', '"', "'"] }
	}
});

/** Built-in CEL functions and constants. */
const builtinCompletions = [
	{ label: 'true', type: 'keyword' },
	{ label: 'false', type: 'keyword' },
	{ label: 'null', type: 'keyword' },
	{ label: 'in', type: 'keyword' },
	// Standard CEL functions
	{ label: 'size', type: 'function', info: 'size(list|map|string) -> int' },
	{ label: 'has', type: 'function', info: 'has(field) -> bool' },
	{ label: 'matches', type: 'function', info: 'string.matches(regex) -> bool' },
	{ label: 'startsWith', type: 'function', info: 'string.startsWith(prefix) -> bool' },
	{ label: 'endsWith', type: 'function', info: 'string.endsWith(suffix) -> bool' },
	{ label: 'contains', type: 'function', info: 'string.contains(sub) -> bool' },
	{ label: 'int', type: 'function', info: 'int(value) -> int' },
	{ label: 'double', type: 'function', info: 'double(value) -> double' },
	{ label: 'string', type: 'function', info: 'string(value) -> string' },
	{ label: 'type', type: 'function', info: 'type(value) -> type' },
	{ label: 'duration', type: 'function', info: 'duration(string) -> duration' },
	{ label: 'timestamp', type: 'function', info: 'timestamp(string) -> timestamp' }
];

export interface CelLanguageConfig {
	/** Additional completions (e.g. context variables specific to your app). */
	completions?: { label: string; type?: string; info?: string; detail?: string }[];
}

/**
 * CEL language support for CodeMirror 6.
 *
 * @param config - Optional configuration with extra autocomplete entries.
 */
export function cel(config?: CelLanguageConfig): LanguageSupport {
	const allCompletions = [...builtinCompletions, ...(config?.completions ?? [])];
	const completion: CompletionSource = completeFromList(allCompletions);

	return new LanguageSupport(celLanguage, [celLanguage.data.of({ autocomplete: completion })]);
}
