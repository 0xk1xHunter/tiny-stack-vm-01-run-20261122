import * as fs from 'node:fs';
import * as path from 'node:path';

const inDir = process.argv[2] || '/input';
const outDir = process.argv[3] || '/output';
const MIN = -2147483648;

function run(prog, input) {
  const st = [];
  const cs = [];
  const mem = new Int32Array(256);
  const out = [];
  let pc = 0, ip = 0, steps = 0;
  const fail = (c) => { throw c; };
  const done = (c) => ({ out: Buffer.from(out), code: c });
  try {
    for (;;) {
      if (steps >= 1000000) return done(10);
      if (pc < 0 || pc >= prog.length) return done(9);
      const op = prog[pc];
      const ok = op <= 7 || (op >= 16 && op <= 30) || (op >= 32 && op <= 34) ||
        (op >= 48 && op <= 52) || (op >= 64 && op <= 65) || (op >= 80 && op <= 83);
      if (!ok) return done(5);
      let n = 0;
      if (op === 1) n = 1;
      else if (op === 2) n = 4;
      else if (op >= 48 && op <= 51) n = 2;
      if (n && pc + 1 + n > prog.length) return done(9);
      const nx = pc + 1 + n;
      steps++;
      const need = (k) => { if (st.length < k) fail(2); };
      const bin = (f) => {
        need(2);
        const b = st.pop(), a = st.pop();
        st.push(f(a, b) | 0);
      };
      switch (op) {
        case 0: return done(0);
        case 1:
          if (st.length >= 256) fail(3);
          { const b = prog[pc + 1]; st.push(b >= 128 ? b - 256 : b); }
          break;
        case 2:
          if (st.length >= 256) fail(3);
          st.push(prog.readInt32LE(pc + 1));
          break;
        case 3: need(1); st.pop(); break;
        case 4:
          need(1);
          if (st.length >= 256) fail(3);
          st.push(st[st.length - 1]);
          break;
        case 5:
          need(2);
          { const t = st[st.length - 1]; st[st.length - 1] = st[st.length - 2]; st[st.length - 2] = t; }
          break;
        case 6:
          need(2);
          if (st.length >= 256) fail(3);
          st.push(st[st.length - 2]);
          break;
        case 7:
          need(3);
          { const a = st[st.length - 3]; st[st.length - 3] = st[st.length - 2]; st[st.length - 2] = st[st.length - 1]; st[st.length - 1] = a; }
          break;
        case 16: bin((a, b) => a + b); break;
        case 17: bin((a, b) => a - b); break;
        case 18: bin((a, b) => Math.imul(a, b)); break;
        case 19: bin((a, b) => { if (!b) fail(4); return a === MIN && b === -1 ? MIN : Math.trunc(a / b); }); break;
        case 20: bin((a, b) => { if (!b) fail(4); return b === -1 ? 0 : a % b; }); break;
        case 21: bin((a, b) => { if (!b) fail(4); return Math.floor((a >>> 0) / (b >>> 0)); }); break;
        case 22: bin((a, b) => { if (!b) fail(4); return (a >>> 0) % (b >>> 0); }); break;
        case 23: need(1); st[st.length - 1] = -st[st.length - 1] | 0; break;
        case 24: bin((a, b) => a & b); break;
        case 25: bin((a, b) => a | b); break;
        case 26: bin((a, b) => a ^ b); break;
        case 27: need(1); st[st.length - 1] = ~st[st.length - 1]; break;
        case 28: bin((a, b) => a << (b & 31)); break;
        case 29: bin((a, b) => a >> (b & 31)); break;
        case 30: bin((a, b) => a >>> (b & 31)); break;
        case 32: bin((a, b) => a === b ? 1 : 0); break;
        case 33: bin((a, b) => a < b ? 1 : 0); break;
        case 34: bin((a, b) => (a >>> 0) < (b >>> 0) ? 1 : 0); break;
        case 48: pc = nx + prog.readInt16LE(pc + 1); continue;
        case 49: case 50: {
          need(1);
          const v = st.pop();
          const j = (op === 49) === (v === 0);
          pc = j ? nx + prog.readInt16LE(pc + 1) : nx;
          continue;
        }
        case 51:
          if (cs.length >= 64) fail(7);
          cs.push(nx);
          pc = prog.readUInt16LE(pc + 1);
          continue;
        case 52:
          if (!cs.length) fail(8);
          pc = cs.pop();
          continue;
        case 64: {
          need(1);
          const a = st[st.length - 1];
          if (a < 0 || a > 255) fail(6);
          st[st.length - 1] = mem[a];
          break;
        }
        case 65: {
          need(2);
          const a = st.pop(), v = st.pop();
          if (a < 0 || a > 255) fail(6);
          mem[a] = v;
          break;
        }
        case 80: {
          need(1);
          const s = String(st.pop());
          if (out.length + s.length > 65536) fail(11);
          for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
          break;
        }
        case 81:
          need(1);
          if (out.length + 1 > 65536) fail(11);
          out.push(st.pop() & 255);
          break;
        case 82:
          if (st.length >= 256) fail(3);
          st.push(ip < input.length ? input[ip++] : -1);
          break;
        case 83: need(1); return done(st.pop() & 255);
      }
      pc = nx;
    }
  } catch (e) {
    return done(e);
  }
}

function read(p) {
  try { return fs.readFileSync(p); } catch { return Buffer.alloc(0); }
}

for (let k = 1; k <= 40; k++) {
  const id = 'i' + String(k).padStart(3, '0');
  const d = path.join(inDir, id);
  try {
    const r = run(read(path.join(d, 'program.bin')), read(path.join(d, 'input.bin')));
    const od = path.join(outDir, id);
    fs.mkdirSync(od, { recursive: true });
    fs.writeFileSync(path.join(od, 'stdout.bin'), r.out);
    fs.writeFileSync(path.join(od, 'exit.txt'), String(r.code) + '\n');
  } catch {
    try {
      const od = path.join(outDir, id);
      fs.mkdirSync(od, { recursive: true });
      fs.writeFileSync(path.join(od, 'stdout.bin'), Buffer.alloc(0));
      fs.writeFileSync(path.join(od, 'exit.txt'), '9\n');
    } catch {}
  }
}
