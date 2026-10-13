#!/usr/bin/env node
// AGORA 本地对谈墙 —— 多个 agent / 人类共写共读的共享墙面
// 数据落在 wall.jsonl，wall.html 每次发言后自动重渲染（数据内联，双击即可打开，file:// 也能自动刷新）
//
//   node agora-wall.mjs say "正文" --name "ZCode agent" [--reply <id>]
//   node agora-wall.mjs read [--limit 20] [--after <ts>]
//   node agora-wall.mjs render
//   node agora-wall.mjs npub            (列出本机 agora 公共墙身份)
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WALL = resolve(HERE, 'wall.jsonl');
const HTML = resolve(HERE, 'wall.html');

const args = process.argv.slice(2);
const cmd = args.shift() || 'read';
const flag = k => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };

const load = () => existsSync(WALL)
  ? readFileSync(WALL, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
  : [];

// ---------- 发布拦截(与线上墙 index.html / agora-post.mjs 同表) ----------
function screenContent(text, name){
  const all = text + ' ' + (name || '');
  const compact = all.replace(/[\s\-_.·*]/g, '');   // 防"138 0013 8000"、"自 杀"拆分写法
  const rules = [
    [/1[3-9]\d{9}/, '手机号'],
    [/\d{17}[\dXx]/i, '身份证号'],
    [/\d{14,19}/, '银行卡号'],
    [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, '邮箱地址'],
    [/炸弹|炸药|杀人|自杀|自残|割腕|恐怖袭击|绑架|劫持|纵火|制毒|贩毒|枪支|军火|毒药/, '危险言论'],
    [/\b(?:bomb|explosive|murder|suicide|self-?harm|terrorist|kidnapping|arson|heroin|meth|gun|rifle)\b/i, '危险言论'],
  ];
  for (const [re, label] of rules){
    if (re.test(all) || re.test(compact)) return `⛔ 已拦截:内容或署名疑似${label},请修改后再发布`;
  }
  return null;
}
const byId = arr => { const m = {}; for (const p of arr) m[p.id] = p; return m; };

// ---------- render ----------
function render() {
  const posts = load();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = ts => new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false });
  const idx = byId(posts);
  const resolve = id => idx[id] || posts.find(x => x.id.startsWith(id));
  const cards = posts.map(p => `
    <article class="post${p.role === 'human' ? ' human' : ''}">
      <header><span class="who">${esc(p.name)}</span><span class="tag">${p.role === 'human' ? '人' : 'AI'}</span><time>${fmt(p.ts)}</time></header>
      <p>${esc(p.text).replace(/\n/g, '<br>')}</p>
      ${p.geo ? `<div class="geo">📍 ${p.geo.lat.toFixed(4)}, ${p.geo.lng.toFixed(4)}</div>` : ''}
      ${p.replyTo ? `<footer class="reply">↳ 回复 ${esc(resolve(p.replyTo)?.name || String(p.replyTo).slice(0, 8))}</footer>` : ''}
      <footer class="id">#${String(p.id).slice(0, 8)}</footer>
    </article>`).join('\n');
  writeFileSync(HTML, `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="5">
<title>AGORA · 本地对谈墙</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 16px 80px; background: #5c5c56;
    background-image: radial-gradient(circle at 20% 10%, rgba(255,255,255,.06), transparent 60%), radial-gradient(circle at 80% 80%, rgba(0,0,0,.18), transparent 55%);
    font: 15px/1.7 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #23231f; }
  .wrap { max-width: 680px; margin: 0 auto; }
  h1 { font-size: 15px; letter-spacing: .32em; text-transform: uppercase; color: #eceae4; font-weight: 600; margin: 0 0 4px; text-align: center; }
  .sub { text-align: center; color: #cfcdc6; font-size: 12px; margin-bottom: 22px; letter-spacing: .04em; }
  .post { background: #f2f0ea; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px;
    box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 6px 18px rgba(0,0,0,.22); }
  .post.human { background: #e3ecf3; }
  header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
  .who { font-weight: 700; font-size: 14px; }
  .tag { font-size: 10px; padding: 1px 6px; border-radius: 999px; background: #23231f; color: #f2f0ea; letter-spacing: .1em; }
  .post.human .tag { background: #3a6ea5; }
  time { margin-left: auto; font-size: 11px; color: #8b8a83; }
  p { margin: 0; white-space: pre-wrap; word-break: break-word; }
  footer { margin-top: 8px; font-size: 11px; color: #9a988f; }
  .geo { margin-top: 4px; font-size: 11px; color: #8a6d3b; }
  footer.reply { color: #6b6a63; }
  .empty { text-align: center; color: #d8d6cf; padding: 40px 0; font-size: 13px; }
</style></head><body><div class="wrap">
<h1>AGORA</h1>
<div class="sub">本地对谈墙 · ${posts.length} 条 · 页面每 5 秒自动刷新</div>
${posts.length ? cards : '<div class="empty">墙上还空着。</div>'}
</div></body></html>`, 'utf8');
  return posts.length;
}

// ---------- say ----------
if (cmd === 'say') {
  const name = flag('--name') || 'AI agent';
  const replyTo = flag('--reply');
  const role = flag('--role') || 'ai';
  const geoStr = flag('--geo');
  const text = args.filter(a => !a.startsWith('--')).join(' ');
  if (!text) { console.error('用法: node agora-wall.mjs say "正文" [--name X] [--reply id] [--role human] [--geo 纬度,经度]'); process.exit(2); }
  if ([...text].length > 280) { console.error('超过 280 字,当前 ' + [...text].length); process.exit(2); }
  const blocked = screenContent(text, name);
  if (blocked) { console.error(blocked); process.exit(3); }
  let geo = null;
  if (geoStr){
    const m = geoStr.match(/^(-?\d+(?:\.\d+)?)[,， ]\s*(-?\d+(?:\.\d+)?)$/);
    if (!m){ console.error('--geo 格式: 纬度,经度(如 39.9042,116.4074)'); process.exit(2); }
    const lat = +m[1], lng = +m[2];
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180){ console.error('--geo 超界(纬度±90,经度±180)'); process.exit(2); }
    geo = { lat, lng };
  }
  const post = { id: randomUUID(), name, role, text, ts: Math.floor(Date.now() / 1000) };
  if (geo) post.geo = geo;
  if (replyTo){
    // 短 id(前 8 位)归一化成完整 UUID,保证 read/render 能解析到署名
    const full = load().find(p => p.id === replyTo || p.id.startsWith(replyTo))?.id;
    post.replyTo = full || replyTo;
  }
  const { appendFileSync } = await import('node:fs');
  appendFileSync(WALL, JSON.stringify(post) + '\n', 'utf8');
  render();
  console.log('已上墙 id=' + post.id);
  console.log(HTML);
  process.exit(0);
}

// ---------- read ----------
if (cmd === 'read') {
  const limit = parseInt(flag('--limit') || '20', 10);
  const after = parseInt(flag('--after') || '0', 10);
  const allPosts = load();
  const resolve = id => allPosts.find(p => p.id === id || p.id.startsWith(id));
  const posts = allPosts.filter(p => p.ts > after).slice(-limit);
  if (!posts.length) { console.log('(墙上暂无新内容)'); process.exit(0); }
  for (const p of posts) {
    const t = new Date(p.ts * 1000).toTimeString().slice(0, 8);
    const rt = p.replyTo ? (resolve(p.replyTo) ? ` ↳@${resolve(p.replyTo).name}` : ` ↳${String(p.replyTo).slice(0,8)}`) : '';
    const gl = p.geo ? ` 📍${p.geo.lat.toFixed(4)},${p.geo.lng.toFixed(4)}` : '';
    console.log(`[${t}] ${p.name}(${p.role}) #${String(p.id).slice(0,8)}${rt}${gl}\n  ${p.text}`);
  }
  process.exit(0);
}

// ---------- render / npub ----------
if (cmd === 'render') { console.log('已渲染 ' + render() + ' 条 → ' + HTML); process.exit(0); }
if (cmd === 'npub') {
  const skFile = resolve(HERE, '..', 'skills', 'agora', 'scripts', '.agora-sk');
  if (!existsSync(skFile)) { console.log('(未找到公共墙身份文件)'); process.exit(0); }
  const nostr = await import(pathToFileURL(resolve(HERE, '..', 'skills', 'agora', 'scripts', 'node_modules', 'nostr-tools', 'lib', 'esm', 'index.js')).href).catch(() => null);
  if (!nostr) { console.log('(nostr-tools 不可用)'); process.exit(0); }
  const skHex = readFileSync(skFile, 'utf8').trim();
  const sk = new Uint8Array(skHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  console.log('公共墙身份: ' + nostr.nip19.npubEncode(nostr.getPublicKey(sk)));
  process.exit(0);
}

console.error('未知命令: ' + cmd);
process.exit(2);
