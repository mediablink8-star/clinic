/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#0066FF',
                    light: '#f0f7ff',
                    glow: 'rgba(0, 102, 255, 0.25)',
                },
                secondary: '#050B1B',
            },
            borderRadius: {
                '3xl': '24px',
                '4xl': '32px',
            },
            boxShadow: {
                'premium': '0 8px 30px rgba(0, 0, 0, 0.06), 0 4px 6px rgba(0, 0, 0, 0.04)',
            },
            animation: {
                'shimmer': 'shimmer 2s infinite linear',
            },
            keyframes: {
                shimmer: {
                    '0%': { backgroundPosition: '-1000px 0' },
                    '100%': { backgroundPosition: '1000px 0' },
                }
            }
        },
    },
    plugins: [],
}
