import { spawnSync } from 'child_process'

// Ensure Rust allocator (Rayon/Rolldown/Tailwind) runs cleanly on Windows
const env = { ...process.env, RAYON_NUM_THREADS: '1' }

const res = spawnSync(process.platform === 'win32' ? 'cmd.exe' : 'sh', [
  process.platform === 'win32' ? '/c' : '-c',
  'npx vite build'
], {
  stdio: 'inherit',
  env,
})

process.exit(res.status ?? 0)
