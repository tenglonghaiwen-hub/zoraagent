import {spawn, execFile} from 'node:child_process';

// This is a user-approved host process, NOT a filesystem or network sandbox.
export function runNativeScript(file, script, {cwd, signal, timeout = 30000} = {}) {
  const env = {};
  for (const key of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'LANG', 'HOME', 'USERPROFILE']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  env.PYTHONUTF8 = '1';
  env.PYTHONNOUSERSITE = '1';
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Error('用户已中止执行'));
    const child = spawn(file, ['-'], {cwd, env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe']});
    let stdout = '', stderr = '', failure, stopping;
    const stop = message => {
      if (stopping) return stopping;
      failure = message;
      stopping = new Promise(done => {
        if (!child.pid) return done();
        if (process.platform === 'win32') {
          execFile(`${process.env.SystemRoot || 'C:\\Windows'}\\System32\\taskkill.exe`, ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true, timeout: 5000}, error => {
            if (error) { failure += '；进程树终止未确认'; child.kill(); }
            done();
          });
        } else {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
          done();
        }
      });
      return stopping;
    };
    const abort = () => void stop('用户已中止执行');
    signal?.addEventListener('abort', abort, {once: true});
    const timer = setTimeout(() => void stop('脚本执行超时，已请求终止进程树'), timeout);
    const collect = key => chunk => {
      if (key === 'stdout') stdout += chunk.toString(); else stderr += chunk.toString();
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > 65536) {
        stdout = stdout.slice(0, 32768); stderr = stderr.slice(0, 32768);
        void stop('脚本输出超过上限，已请求终止');
      }
    };
    child.stdout.on('data', collect('stdout')); child.stderr.on('data', collect('stderr'));
    child.stdin.on('error', () => {});
    child.on('error', error => { failure = error.message; });
    child.on('close', async code => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      await stopping;
      if (failure || code !== 0) reject(Object.assign(Error(failure || `脚本退出码：${code}`), {stdout, stderr}));
      else resolve({stdout, stderr});
    });
    child.stdin.end(script);
  });
}
