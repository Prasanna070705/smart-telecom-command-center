// Runs the model checks with the right Python command on Windows, macOS and Linux (override with PYTHON=...).
import { spawn } from 'node:child_process';
const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const stages = process.argv.slice(2).length ? process.argv.slice(2) : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I', 'J'];
spawn(py, ['verify.py', ...stages], { cwd: new URL('../engine/', import.meta.url), stdio: 'inherit' }).on('exit', (c) => process.exit(c ?? 1));
