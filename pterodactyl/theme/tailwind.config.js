const colors = require('tailwindcss/colors');

const gray = {
    50: '#f2f1f6',
    100: '#b6b5c2',
    200: '#b6b5c2',
    300: '#7c7b88',
    400: '#7c7b88',
    500: '#26262f',
    600: '#1e1e25',
    700: '#17171c',
    800: '#121216',
    900: '#0a0a0d',
};

const primary = {
    50: '#f4f2ff',
    100: '#e8e2ff',
    200: '#d0c3ff',
    300: '#b39cff',
    400: '#9a7bff',
    500: '#8257ff',
    600: '#6c3ff0',
    700: '#5931c4',
    800: '#452697',
    900: '#2f1a69',
};

module.exports = {
    content: [
        './resources/scripts/**/*.{js,ts,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                header: ['"IBM Plex Sans"', '"Roboto"', 'system-ui', 'sans-serif'],
            },
            colors: {
                black: '#0a0a0d',
                // "primary" and "neutral" are deprecated, prefer the use of "blue" and "gray"
                // in new code.
                primary: primary,
                blue: primary,
                gray: gray,
                neutral: gray,
                cyan: primary,
            },
            fontSize: {
                '2xs': '0.625rem',
            },
            transitionDuration: {
                250: '250ms',
            },
            borderColor: theme => ({
                default: theme('colors.neutral.400', 'currentColor'),
            }),
        },
    },
    plugins: [
        require('@tailwindcss/line-clamp'),
        require('@tailwindcss/forms')({
            strategy: 'class',
        }),
    ]
};
