import jobjob from '@jobinjia/eslint-config'

export default jobjob(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.md',
      'test-*.html',
      'verify-*.js',
      '**/reference-code/**',
      'playground/public/reference-code/**',
    ],
  },
)
