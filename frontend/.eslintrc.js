/**
 * ESLint configuration — Watink Frontend
 *
 * Stack: React 17 + Vite + MUI v4 (em migracao para shadcn/ui + Tailwind)
 * Plugin local: watink-design-system (Design System governance)
 */
"use strict";

const path = require("path");

module.exports = {
	env: {
		browser: true,
		es2021: true,
		node: true,
	},
	extends: [
		"eslint:recommended",
		"plugin:react/recommended",
		"plugin:react-hooks/recommended",
		"plugin:@typescript-eslint/recommended",
	],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaVersion: "latest",
		sourceType: "module",
		ecmaFeatures: {
			jsx: true,
		},
	},
	plugins: [
		"react",
		"react-hooks",
		"@typescript-eslint",
		// Local plugin — resolves via file: link in package.json
		"watink-design-system",
	],
	settings: {
		react: {
			version: "detect",
		},
	},
	rules: {
		// ── Design System Governance ──

		// GAP-003: proibir import direto de @material-ui em arquivos novos
		// Aplicado globalmente; legado fica isento via override abaixo
		"no-restricted-imports": [
			"error",
			{
				patterns: [
					{
						group: ["@material-ui/*", "@material-ui/core", "@material-ui/icons", "@material-ui/lab"],
						message:
							"MUI v4 proibido em arquivos novos. Use shadcn/ui em src/components/ui/ — DS v2 GAP-003.",
					},
				],
			},
		],

		// GAP-003: prop-contract dos componentes DS v2 (shadcn/ui + Watink tokens)
		"no-restricted-syntax": [
			"warn",
			{
				selector: "JSXOpeningElement[name.name='Avatar'] > JSXAttribute[name.name='size'] > Literal[value!=/^(?:xs|sm|md|lg|xl)$/]",
				message: "<Avatar> size must be one of 'xs' | 'sm' | 'md' | 'lg' | 'xl'.",
			},
			{
				selector: "JSXOpeningElement[name.name='Button'] > JSXAttribute[name.name='variant'] > Literal[value!=/^(?:default|destructive|outline|secondary|ghost|destructive-ghost|link)$/]",
				message: "<Button> variant must be one of 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'destructive-ghost' | 'link'.",
			},
			{
				selector: "JSXOpeningElement[name.name='Button'] > JSXAttribute[name.name='size'] > Literal[value!=/^(?:default|sm|lg|icon)$/]",
				message: "<Button> size must be one of 'default' | 'sm' | 'lg' | 'icon'.",
			},
			{
				selector: "JSXOpeningElement[name.name='Button'] > JSXAttribute[name.name='type'] > Literal[value!=/^(?:button|submit|reset)$/]",
				message: "<Button> type must be one of 'button' | 'submit' | 'reset'.",
			},
			{
				selector: "JSXOpeningElement[name.name='MetricCard'] > JSXAttribute[name.name='color'] > Literal[value!=/^(?:primary|success|warning|error|info)$/]",
				message: "<MetricCard> color must be one of 'primary' | 'success' | 'warning' | 'error' | 'info'.",
			},
			{
				selector: "JSXOpeningElement[name.name='StatusChip'] > JSXAttribute[name.name='status'] > Literal[value!=/^(?:success|error|warning|info|default)$/]",
				message: "<StatusChip> status must be one of 'success' | 'error' | 'warning' | 'info' | 'default'.",
			},
			{
				selector: "JSXOpeningElement[name.name='StatusChip'] > JSXAttribute[name.name='size'] > Literal[value!=/^(?:sm|md|lg)$/]",
				message: "<StatusChip> size must be one of 'sm' | 'md' | 'lg'.",
			},
		],

		"watink-design-system/no-hardcoded-colors": [
			"error",
			{
				exemptPatterns: ["ColorPicker", "FlowBuilder", "tagColors", "MainListItems", "metric-card"],
			},
		],

		// ── Migration Guard (ADR-001) ──
		"watink-design-system/no-make-styles": "error",

		// ── React ──
		"react/prop-types": "off",
		"react/react-in-jsx-scope": "off",
		"react/no-unescaped-entities": "off",

		// ── Code Quality ──
		"no-console": ["warn", { allow: ["warn", "error"] }],
		"no-unused-vars": "off",
		"@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
		// Gradual typing migration — tracked as tech debt in CLAUDE.md
		"@typescript-eslint/no-explicit-any": "off",
		"prefer-const": "warn",
		"no-var": "error",

		// Rule from @next/next doesn't exist in this non-Next.js project — silence the "rule not found" error
		"@next/next/no-img-element": "off",
	},
	overrides: [
		{
			// Legacy components dir — exempt from migration guard
			files: ["src/components/legacy/**/*"],
			rules: {
				"watink-design-system/no-make-styles": "off",
				"no-restricted-imports": "off",
			},
		},
		{
			// Config files & scripts exempt from DS rule
			files: ["vite.config.*", "copy-assets.*", "sync-embed-go.*", "*.config.js"],
			rules: {
				"watink-design-system/no-hardcoded-colors": "off",
			},
		},
		{
			// Token definition files legitimately contain hex/hsl values
			files: ["src/theme/tokens/**"],
			rules: {
				"watink-design-system/no-hardcoded-colors": "off",
			},
		},
		{
			// Suppress Next.js-only rules that don't exist in this project
			files: ["**/*.tsx", "**/*.ts", "**/*.js", "**/*.jsx"],
			rules: {
				"@next/next/no-img-element": "off",
			},
		},
	],
	ignorePatterns: [
		"build/",
		"node_modules/",
		"dist/",
		"public/",
		"*.min.js",
	],
};
