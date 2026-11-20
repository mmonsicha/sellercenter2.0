// Font profile switch — VITE_FONT_PROFILE=heavent|noto (default: heavent).
//
// A typeface and its size scale are one pair: DB HeaventRounded renders much smaller
// than Noto Sans Thai at the same px, so the DS ships a bigger scale with it
// (xs 18px vs 12px). Mixing a face with the other face's scale is what makes text
// look too big / too small. Each profile therefore sets BOTH family and sizes.
//
// - heavent: the current DS default (0.27.x) — no override, the DS decides.
// - noto:    the upcoming DS face, with the scale DS 0.27.0-beta.1 paired it with.
//
// Once the DS itself ships Noto Sans Thai, delete this file and its call sites.
// Code must size text with --ssk-font-size-* tokens (never px) so it follows the profile.

export type FontProfile = 'heavent' | 'noto';

const NOTO = 'Noto Sans Thai';

// Noto scale/line-heights = what DS 0.27.0-beta.1 paired with Noto Sans Thai.
const NOTO_SIZE = {
	xs: '12px',
	sm: '14px',
	md: '16px',
	lg: '18px',
	xl: '20px',
	'2xl': '24px',
	'3xl': '30px',
	'4xl': '36px',
	'5xl': '48px'
};
// DB HeaventRounded is set at line-height 1em; Thai vowels/tone marks above and below
// the line get clipped at 1em in Noto Sans Thai, so it needs real leading.
const NOTO_LINE_HEIGHT = {
	xs: '1.5',
	sm: '1.5',
	md: '1.5',
	lg: '1.5',
	xl: '1.45',
	'2xl': '1.4',
	'3xl': '1.35',
	'4xl': '1.3',
	'5xl': '1.25'
};

// The DS also hard-sets per-component sizes in theme.components (all tuned for
// DB HeaventRounded), so overriding the top-level scale alone leaves <ssk-text>,
// <ssk-heading>, badges, tags and tables at the Heavent sizes. Mapped with the same
// Heavent→Noto pairing as the scale (18→12, 20→14, 24→16, 16→~11).
// Icons and avatar initials are left alone — they size a box, not reading text.
const PROFILES: Record<FontProfile, Record<string, unknown>> = {
	heavent: {},
	noto: {
		fontFamily: {
			sans: [NOTO, 'Roboto', 'sans-serif'],
			serif: [NOTO, 'Merriweather', 'serif'],
			mono: [NOTO, 'Roboto Mono', 'monospace']
		},
		fontSize: NOTO_SIZE,
		lineHeight: NOTO_LINE_HEIGHT,
		components: {
			text: { fontSize: NOTO_SIZE, lineHeight: NOTO_LINE_HEIGHT },
			heading: { fontSize: NOTO_SIZE, lineHeight: NOTO_LINE_HEIGHT },
			badge: { fontSize: { sm: '11px', md: '12px', lg: '14px' } },
			tag: { fontSize: { sm: '11px', md: '12px', lg: '14px' } },
			table: { fontSize: { sm: '12px', md: '14px', lg: '16px' } },
			progressBar: { fontSize: { sm: '14px', md: '16px' } }
		}
	}
};

export const fontProfile: FontProfile =
	import.meta.env.VITE_FONT_PROFILE === 'noto' ? 'noto' : 'heavent';

/** Theme fragment to spread into applyTheme(). */
export const fontProfileTheme = PROFILES[fontProfile];

/** Loads the self-hosted font files a profile needs (the DS already bundles DB HeaventRounded). */
export async function loadFontProfile(): Promise<void> {
	if (fontProfile !== 'noto') return;
	document.documentElement.style.setProperty('--app-font-family', `'${NOTO}', Roboto, sans-serif`);
	await Promise.all([
		import('@fontsource/noto-sans-thai/400.css'),
		import('@fontsource/noto-sans-thai/500.css'),
		import('@fontsource/noto-sans-thai/600.css'),
		import('@fontsource/noto-sans-thai/700.css')
	]);
}
