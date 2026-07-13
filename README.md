# PostLullaby 🎶

**👉 Try it live / 在线试玩：[postlullaby.vercel.app](https://postlullaby.vercel.app)**

[English](#english) · [中文](#中文)

---

## English

One photo + one song = a particle stage that explodes and reassembles to the beat.

A weekend toy: drop in a photo, pick a track with some energy, and the photo instantly dissolves into a sky of particles that breathe, glow, and burst with the beat. When the song ends, the particles drift back together into the original photo and hold. Move your mouse through the particle field and they scatter out of the way; hit spacebar mid-playback for a shockwave.

No sign-up, no waiting, no payment — three seconds after opening the page you already know what to do.

### What you can do

- 📷 **Drop a photo** — portraits or pet photos both work great, processed entirely in your own browser, never uploaded anywhere
- 🎵 **Pick a track** — a bundled 15-second original electronic track, a licensed 30-second dance track with real drums, or your own local audio file
- 🖱️ **Mouse repulsion** — move your cursor/finger through the particles and they dodge out of the way
- ⌨️ **Spacebar shockwave** — hit space during playback for a ripple burst
- ⏯️ **Switch anytime** — pause, replay, change photo, change track, whatever you want

### What this project is

Built for a DEV Challenge (Gemini + ElevenLabs prize track). This live demo is currently a "visual effect prototype" — the photo-to-particles transformation and beat-sync are already tuned and feel good. Next step: wire up Gemini and ElevenLabs so the AI generates a full 45-second memorial song straight from a photo. That part is still waiting on API keys — stay tuned.

### Tech stack

Next.js (App Router) + TypeScript, pure client-side Canvas 2D for particle rendering, Web Audio API for real-time beat detection. No backend — all audio analysis runs in your own browser, and your photo and song never leave your device.

### Run it locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### About copyright

- The original bundled track and all particle-effect code are owned by this repo, MIT licensed — play with it, fork it, whatever
- The second bundled track comes from Pixabay's royalty-free library; source and license are recorded in [`public/sample/library/LICENSES.md`](public/sample/library/LICENSES.md)
- If you pick your own local song to play with, the copyright responsibility for that song is yours — the app never uploads or retains it

---

## 中文

一张照片 + 一首歌 = 会跟着鼓点炸开又聚拢的粒子舞台。

一个周末闲出来的小玩具：传一张照片上去，挑一首带感的曲子，照片会当场溶解成漫天粒子，跟着鼓点一起呼吸、发光、炸裂；一曲放完，粒子又慢慢聚拢回原来的照片，定格收尾。播放时鼠标划过粒子群会被推开，按一下空格键还能炸出一圈冲击波。

不用注册、不用等待、不用付费，打开网页三秒就能看懂在玩什么。

### 能玩什么

- 📷 **传照片**：人像、宠物照都行，只在你自己浏览器里处理，不会上传到任何地方
- 🎵 **选曲子**：内置一首原创 15 秒电子曲，加一首真实商用授权的 30 秒舞曲，也可以选你电脑里自己的歌
- 🖱️ **鼠标排斥**：手指/鼠标划过粒子群，粒子会自动躲开
- ⌨️ **空格冲击波**：播放中按空格，炸出一圈波纹特效
- ⏯️ **随时切换**：暂停、重播、换照片、换歌，随便试

### 这是什么项目

这是给一个 DEV 挑战赛（Gemini + ElevenLabs 单项奖方向）做的参赛作品，目前这个在线 demo 是"视觉效果原型"——照片粒子化 + 卡点特效已经调得很顺手了。下一步计划接入 Gemini 和 ElevenLabs，让 AI 直接根据一张照片生成一首专属的 45 秒纪念曲，这部分还在等 API Key 上线，敬请期待。

### 技术栈

Next.js（App Router）+ TypeScript，纯前端 Canvas 2D 做粒子渲染，Web Audio API 做实时节拍检测——没有后端，音频分析全在你自己的浏览器里跑完，照片和歌都不会离开你的设备。

### 本地跑起来

```bash
npm install
npm run dev
```

然后打开 [http://localhost:3000](http://localhost:3000)。

### 关于版权

- 内置的原创曲、粒子特效代码全部本仓库自有，MIT 协议随便玩随便抄
- 内置的第二首曲子来自 Pixabay 免版权曲库，出处和授权记录在 [`public/sample/library/LICENSES.md`](public/sample/library/LICENSES.md)
- 选自己电脑里的歌来玩，那首歌的版权责任在你自己，程序不会上传它、也不会留存它
