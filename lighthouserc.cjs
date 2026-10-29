module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview -- --host 127.0.0.1',
      startServerReadyPattern: 'Local',
      url: ['http://127.0.0.1:4173/'],
      numberOfRuns: 3,
      settings: { preset: 'desktop' },
    },
    upload: { target: 'filesystem', outputDir: './lighthouse-reports' },
  },
}
