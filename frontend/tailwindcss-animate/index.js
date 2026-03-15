const plugin = require('tailwindcss/plugin')

module.exports = plugin(({ addUtilities }) => {
  addUtilities({
    '.animate-in': {
      animation: 'animate-in 0.2s ease-out',
    },
    '.animate-out': {
      animation: 'animate-out 0.2s ease-out',
    },
    '.fade-in': {
      animation: 'fade-in 0.2s ease-out',
    },
    '.fade-out': {
      animation: 'fade-out 0.2s ease-out',
    },
    '.zoom-in': {
      animation: 'zoom-in 0.2s ease-out',
    },
    '.zoom-out': {
      animation: 'zoom-out 0.2s ease-out',
    },
    '.slide-in-from-top': {
      animation: 'slide-in-from-top 0.2s ease-out',
    },
    '.slide-out-to-top': {
      animation: 'slide-out-to-top 0.2s ease-out',
    },
    '.slide-in-from-bottom': {
      animation: 'slide-in-from-bottom 0.2s ease-out',
    },
    '.slide-out-to-bottom': {
      animation: 'slide-out-to-bottom 0.2s ease-out',
    },
    '.slide-in-from-left': {
      animation: 'slide-in-from-left 0.2s ease-out',
    },
    '.slide-out-to-left': {
      animation: 'slide-out-to-left 0.2s ease-out',
    },
    '.slide-in-from-right': {
      animation: 'slide-in-from-right 0.2s ease-out',
    },
    '.slide-out-to-right': {
      animation: 'slide-out-to-right 0.2s ease-out',
    },
  })
})
