/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366F1',
          dark: '#4F46E5',
          light: '#818CF8',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        // ─── Theme-aware backgrounds (swap via CSS vars) ──────────────────
        bg: {
          base:     'var(--bg-base)',
          surface:  'var(--bg-surface)',
          card:     'var(--bg-card)',
          elevated: 'var(--bg-elevated)',
        },
        'border-default': 'var(--border-default)',
        'border-subtle':  'var(--border-subtle)',
        // ─── Theme-aware text ─────────────────────────────────────────────
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 1.5s ease-in-out infinite',
        float:   'float 4s ease-in-out infinite',
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0.4)' },
          '50%':     { boxShadow: '0 0 0 8px rgba(99,102,241,0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-12px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #6366F1, #8B5CF6)',
        'gradient-hero':    'linear-gradient(135deg, #0A0F1E 0%, #1a1040 50%, #0d1f3c 100%)',
        'gradient-success': 'linear-gradient(135deg, #059669, #10B981)',
        shimmer: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
      },
      boxShadow: {
        glow:    '0 0 40px rgba(99,102,241,0.2)',
        'glow-sm': '0 0 20px rgba(99,102,241,0.15)',
        card:    '0 4px 16px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
}
