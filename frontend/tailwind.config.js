/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── Primary Blue (ERP / Zoho Books style) ───────────────────────────
        primary: {
          DEFAULT: '#2563EB',
          hover:   '#1D4ED8',
          light:   '#EFF6FF',
          border:  '#BFDBFE',
        },

        // ─── Semantic colors ──────────────────────────────────────────────────
        success: {
          DEFAULT: '#16A34A',
          bg:      '#F0FDF4',
          border:  '#BBF7D0',
        },
        warning: {
          DEFAULT: '#D97706',
          bg:      '#FFFBEB',
          border:  '#FDE68A',
        },
        danger: {
          DEFAULT: '#DC2626',
          bg:      '#FEF2F2',
          border:  '#FECACA',
        },
        info: {
          DEFAULT: '#0284C7',
          bg:      '#F0F9FF',
          border:  '#BAE6FD',
        },

        // ─── Marketplace channel colors ───────────────────────────────────────
        amazon:  '#FF9900',
        flipkart:'#2874F0',
        meesho:  '#F43397',

        // ─── Theme-aware backgrounds (values come from globals.css CSS vars) ─
        bg: {
          base:     'var(--bg-base)',
          surface:  'var(--bg-surface)',
          card:     'var(--bg-card)',
          elevated: 'var(--bg-elevated)',
        },
        'border-default': 'var(--border-default)',
        'border-subtle':  'var(--border-subtle)',

        // ─── Theme-aware text ─────────────────────────────────────────────────
        text: {
          primary:     'var(--text-primary)',
          secondary:   'var(--text-secondary)',
          muted:       'var(--text-muted)',
          placeholder: '#CBD5E1',
        },
      },

      // ─── Typography ──────────────────────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },

      // ─── Spacing / sizing tokens ──────────────────────────────────────────────
      width: {
        sidebar:           '240px',
        'sidebar-collapsed': '56px',
      },
      height: {
        navbar: '56px',
      },

      // ─── Border radius ────────────────────────────────────────────────────────
      borderRadius: {
        btn:   '6px',
        card:  '8px',
        input: '6px',
        badge: '4px',
      },

      // ─── Elevation shadows (no glow, no color tints) ─────────────────────────
      boxShadow: {
        card:     '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        dropdown: '0 4px 16px rgba(0,0,0,0.12)',
        modal:    '0 20px 60px rgba(0,0,0,0.20)',
        input:    '0 0 0 3px rgba(37,99,235,0.12)',
      },

      // ─── Background images ────────────────────────────────────────────────────
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #2563EB, #1D4ED8)',
        'gradient-success': 'linear-gradient(135deg, #16A34A, #15803D)',
        shimmer:            'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
      },

      // ─── Animations (shimmer only — no glow, no float) ───────────────────────
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
