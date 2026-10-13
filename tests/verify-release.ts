import { spawn } from 'node:child_process';

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this command through npm so the selected npm CLI is explicit.');

const child = spawn(process.execPath, [npmCli, 'run', 'verify:phase2'], {
  cwd: process.cwd(),
  env: { ...process.env, VERIFY_RELEASE: '1' },
  stdio: 'inherit',
  windowsHide: true,
});

child.on('error', (error) => {
  console.error('Could not start the release verification runner.', error);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
