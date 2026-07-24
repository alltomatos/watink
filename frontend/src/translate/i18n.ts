import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { messages } from "./languages";

i18n.use(LanguageDetector).init({
	debug: false,
	defaultNS: ["translations"],
	fallbackLng: "en",
	ns: ["translations"],
	resources: messages,
	// escapeValue defaults to true when initReactI18next isn't used (our i18n.t()
	// calls are plain JS, not the react-i18next hook) — that default HTML-escapes
	// interpolated values, turning "/" into "&#x2F;" in dates like "24/07/2026".
	// React already escapes text nodes on render, so this second pass is both
	// redundant and visibly broken; disable it.
	interpolation: { escapeValue: false },
});

export { i18n };
