import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { getChromePath, launch } from 'chrome-launcher'

const require = createRequire(import.meta.url)
const config = require('../lighthouserc.cjs').ci.collect
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outputDir = path.join(root, 'reports', 'lighthouse')
const args = process.argv.slice(2)
const option = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.split('=')[1]
const profileFilter = option('--profile')
const pageFilter = option('--page')
const runCount = Number(option('--runs') ?? config.numberOfRuns)
const profiles = profileFilter ? [profileFilter] : ['desktop', 'mobile']
const pages = config.url.map((url, index) => ({ name: index === 0 ? 'home' : 'nft-detail', url }))
  .filter(({ name }) => !pageFilter || name === pageFilter)

if (!profiles.every((profile) => ['desktop', 'mobile'].includes(profile)) || pages.length === 0 || !Number.isInteger(runCount) || runCount < 1) {
  throw new Error('Use --profile=desktop|mobile, --page=home|nft-detail e --runs=N.')
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

async function waitForServer(server, url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Preview encerrou com código ${server.exitCode}.`)
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch { /* The preview is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('O preview não respondeu em 30 segundos.')
}

const preview = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
})

try {
  await waitForServer(preview, config.url[0])
  await mkdir(outputDir, { recursive: true })
  const measurements = []

  for (const profile of profiles) {
    for (const page of pages) {
      for (let run = 1; run <= runCount; run++) {
        console.log(`Lighthouse: ${page.name} / ${profile} / ${run} de ${runCount}`)
        const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'] })
        try {
          const result = await lighthouse(page.url, {
            port: chrome.port,
            output: ['html', 'json'],
            logLevel: 'error',
            onlyCategories: config.settings.onlyCategories,
          }, profile === 'desktop' ? desktopConfig : undefined)
          if (!result || result.lhr.runtimeError) throw new Error(result?.lhr.runtimeError?.message ?? 'Lighthouse não retornou um relatório.')
          if (result.lhr.configSettings.formFactor !== profile) throw new Error(`Perfil incorreto: esperado ${profile}, recebido ${result.lhr.configSettings.formFactor}.`)
          const prefix = `${page.name}-${profile}-run-${run}`
          await writeFile(path.join(outputDir, `${prefix}.html`), result.report[0])
          await writeFile(path.join(outputDir, `${prefix}.json`), result.report[1])
          const { lhr } = result
          const scores = Object.fromEntries(config.settings.onlyCategories.map((category) => [category, Math.round((lhr.categories[category]?.score ?? 0) * 100)]))
          const metrics = {
            lcpMs: lhr.audits['largest-contentful-paint']?.numericValue,
            cls: lhr.audits['cumulative-layout-shift']?.numericValue,
            tbtMs: lhr.audits['total-blocking-time']?.numericValue,
          }
          measurements.push({ page: page.name, profile, run, scores, metrics, lighthouseVersion: lhr.lighthouseVersion, userAgent: lhr.userAgent, hostUserAgent: lhr.environment.hostUserAgent, throttling: lhr.configSettings.throttling, throttlingMethod: lhr.configSettings.throttlingMethod })
          console.log(`  ${Object.entries(scores).map(([name, score]) => `${name}: ${score}`).join(' | ')}; LCP ${Math.round(metrics.lcpMs)} ms, CLS ${metrics.cls.toFixed(3)}, TBT ${Math.round(metrics.tbtMs)} ms`)
        } finally {
          await chrome.kill()
        }
      }
    }
  }

  const summary = []
  for (const profile of profiles) {
    for (const page of pages) {
      const rows = measurements.filter((row) => row.profile === profile && row.page === page.name)
      summary.push({
        page: page.name,
        profile,
        runs: rows.length,
        scores: Object.fromEntries(config.settings.onlyCategories.map((category) => [category, median(rows.map((row) => row.scores[category]))])),
        metrics: {
          lcpMs: median(rows.map((row) => row.metrics.lcpMs)),
          cls: median(rows.map((row) => row.metrics.cls)),
          tbtMs: median(rows.map((row) => row.metrics.tbtMs)),
        },
      })
    }
  }

  const vitePackage = JSON.parse(await readFile(path.join(root, 'node_modules', 'vite', 'package.json'), 'utf8'))
  const chromePath = getChromePath()
  const chromeVersion = measurements[0]?.hostUserAgent.match(/(?:HeadlessChrome|Chrome)\/([\d.]+)/)?.[1] ?? 'indisponível'
  const environment = {
    measuredAt: new Date().toISOString(),
    operatingSystem: `${os.platform()} ${os.release()} (${os.arch()})`,
    node: process.version,
    lighthouse: measurements[0]?.lighthouseVersion,
    chromePath,
    chromeVersion,
    userAgent: measurements[0]?.userAgent,
    vite: vitePackage.version,
    conditions: 'Build de produção com Vite preview em 127.0.0.1:4173; MSW habilitado, cenário default; perfis padrão Lighthouse mobile e desktop com throttling simulado; Chrome headless; armazenamento do navegador isolado por execução.',
  }
  await writeFile(path.join(outputDir, 'summary.json'), JSON.stringify({ environment, measurements, medians: summary }, null, 2))
  const lines = [
    '# Auditoria Lighthouse', '',
    `Data UTC: ${environment.measuredAt}`, '',
    `Ambiente: ${environment.operatingSystem}; Node ${environment.node}; Chrome ${environment.chromeVersion}; Lighthouse ${environment.lighthouse}; Vite ${environment.vite}.`,
    environment.conditions, '',
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...summary.map((row) => `| ${row.page} | ${row.profile} | ${row.scores.performance} | ${row.scores.accessibility} | ${row.scores['best-practices']} | ${row.scores.seo} | ${Math.round(row.metrics.lcpMs)} ms | ${row.metrics.cls.toFixed(3)} | ${Math.round(row.metrics.tbtMs)} ms |`),
    '',
    `Cada valor da tabela é a mediana de ${runCount} execução(ões). Os relatórios individuais HTML/JSON e dados brutos estão nesta pasta.`,
  ]
  await writeFile(path.join(outputDir, 'README.md'), `${lines.join('\n')}\n`)
  console.log(lines.join('\n'))
  const failures = summary.flatMap((row) => Object.entries(require('../lighthouserc.cjs').ci.assert.assertions)
    .filter(([name, [, { minScore }]]) => row.scores[name.replace('categories:', '')] < minScore * 100)
    .map(([name]) => `${row.page}/${row.profile}: ${name} abaixo da meta`))
  if (failures.length > 0) {
    console.error(failures.join('\n'))
    process.exitCode = 1
  }
} finally {
  preview.kill()
}
