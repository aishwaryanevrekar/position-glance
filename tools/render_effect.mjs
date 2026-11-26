/** Export effects/perspective-shift/effect.html to an 8s H.264 MP4 + looping GIF. */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCENE = resolve(ROOT, 'effects/perspective-shift/effect.html');
const OUT = resolve(ROOT, 'docs');
const TMP = resolve(ROOT, '.render-effect');
const W = 1920, H = 1080, FPS = 30, DURATION = 8;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function run(cmd, args) {
  return new Promise((ok, no) => {
    const p = spawn(cmd, args, { stdio: 'ignore' });
    p.on('error', no);
    p.on('exit', c => c === 0 ? ok() : no(new Error(`${cmd} exited ${c}`)));
  });
}
function wavHeader(bytes, rate = 22050) {
  const h = Buffer.alloc(44);
  h.write('RIFF',0); h.writeUInt32LE(36+bytes,4); h.write('WAVE',8);
  h.write('fmt ',12); h.writeUInt32LE(16,16); h.writeUInt16LE(1,20); h.writeUInt16LE(1,22);
  h.writeUInt32LE(rate,24); h.writeUInt32LE(rate*2,28); h.writeUInt16LE(2,32); h.writeUInt16LE(16,34);
  h.write('data',36); h.writeUInt32LE(bytes,40); return h;
}
function score(path) {
  const rate = 22050, n = rate * DURATION, buf = Buffer.alloc(n*2);
  for (let i=0;i<n;i++) {
    const t=i/rate;
    let v = 0.05*Math.sin(2*Math.PI*55*t) + 0.03*Math.sin(2*Math.PI*82.4*t);
    for (const h of [0.9,2.2,6.6]) {
      const d=t-h;
      if (d>=0 && d<1) v += 0.12*Math.exp(-d*4)*Math.sin(2*Math.PI*180*d);
    }
    if (t<0.5) v*=t/0.5;
    if (t>7.5) v*=(8-t)/0.5;
    buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767), i*2);
  }
  writeFileSync(path, Buffer.concat([wavHeader(buf.length), buf]));
}

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no});
  let id=0; const wait=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&wait.has(m.id)){wait.get(m.id)(m);wait.delete(m.id)}};
  const send=(method,params={})=>new Promise((ok,no)=>{const n=++id;wait.set(n,m=>m.error?no(new Error(JSON.stringify(m.error))):ok(m.result));ws.send(JSON.stringify({id:n,method,params}))});
  return {send,close:()=>ws.close()};
}

async function main() {
  mkdirSync(TMP,{recursive:true});
  const frames=resolve(TMP,'frames'); mkdirSync(frames,{recursive:true});
  const url=`file://${SCENE}?render`;
  const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
    '--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run',
    '--remote-debugging-port=9224','--remote-allow-origins=*',
    `--user-data-dir=${resolve(TMP,'chrome')}`,`--window-size=${W},${H}`,'about:blank'],{stdio:'ignore'});
  let tab;
  for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:9224/json/new?${encodeURIComponent(url)}`,{method:'PUT'});tab=await r.json();break}catch{await sleep(250)}}
  if(!tab) throw new Error('CDP did not start');
  const c=await cdp(tab.webSocketDebuggerUrl);
  await c.send('Page.enable');
  await c.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
  await sleep(600);
  console.log('[effect] rendering 240 frames');
  for(let n=0;n<FPS*DURATION;n++){
    const t=n/FPS;
    await c.send('Runtime.evaluate',{expression:`window.seek(${t.toFixed(4)})`});
    const {data}=await c.send('Page.captureScreenshot',{format:'jpeg',quality:88});
    writeFileSync(resolve(frames,`f${String(n).padStart(4,'0')}.jpg`),Buffer.from(data,'base64'));
  }
  c.close(); chrome.kill('SIGTERM');

  const audio=resolve(TMP,'audio.m4a'); const wav=resolve(TMP,'score.wav'); score(wav);
  await run('ffmpeg',['-y','-loglevel','error','-i',wav,'-c:a','aac','-b:a','128k',audio]);
  const mp4=resolve(OUT,'perspective-shift.mp4');
  await run('ffmpeg',['-y','-loglevel','error','-framerate',String(FPS),'-i',resolve(frames,'f%04d.jpg'),
    '-i',audio,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-pix_fmt','yuv420p',
    '-crf','20','-preset','veryfast','-c:a','aac','-shortest','-movflags','+faststart',mp4]);
  await run('ffmpeg',['-y','-loglevel','error','-framerate',String(FPS),'-i',resolve(frames,'f%04d.jpg'),
    '-filter_complex','scale=640:-1:flags=lanczos,fps=15,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer',
    '-loop','0',resolve(OUT,'perspective-shift.gif')]);
  rmSync(TMP,{recursive:true,force:true});
  console.log(`[effect] done: ${mp4}`);
}
main().catch(e=>{console.error('[effect] FAILED',e.message);process.exit(1)});
