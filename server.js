const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const querystring = require('querystring');

const PORT = process.env.PORT || 3000;
// Admin kirish ma'lumotlari (xohlasangiz PORT kabi environment variable orqali ham o'zgartirsa bo'ladi)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'hanif';
const CONTENT_FILE = path.join(__dirname, 'content.json');

const defaultContent = {
  // Hero
  heroBadge: 'Smart Money Concepts (SMC) & ICT Halol Kripto Savdosi',
  heroTitle1: 'Halol va Intizomli',
  heroTitle2: 'Top Muslim Traders Academy',
  heroDesc: "Top Muslim Traders Academy — shariat tamoyillariga mos keluvchi Spot kriptovalyuta savdosi, Smart Money Concepts (SMC), ICT tahlili va intizomli risk-menedjmentni mukammal o'rgatuvchi xalqaro treyderlar akademiyasidir.",
  stat1Value: '100%', stat1Label: 'Spot & Halol Kripto',
  stat2Value: '25K+', stat2Label: "Jami Obunachilar",
  stat3Value: 'SMC / ICT', stat3Label: 'Smart Money Tahlil',
  telegramBot: 'https://t.me/TopMuslimTradersBot',
  telegramChannel: 'https://t.me/Scalp_TMT',
  telegramResults: 'https://t.me/TMT_Natijalari',
  instagram: 'https://www.instagram.com/top_muslim_traders?stkn=MWFiZWd6cGZua3d6aw==',
  heroImage: '',
  logoImage: '',

  // YouTube / video darslar (cheksiz miqdorda qo'shsa bo'ladi)
  youtubeChannel: 'https://youtube.com/@topmuslimtraders',
  videos: [
    { title: "SMC asoslari: Order Block va Liquidity", url: 'https://youtube.com/@topmuslimtraders' },
    { title: 'ICT tahlil: Market Structure tushunchasi', url: 'https://youtube.com/@topmuslimtraders' },
    { title: 'Risk-menedjment: Halol pozitsiya hajmi', url: 'https://youtube.com/@topmuslimtraders' }
  ],

  // Kripto halolmi?
  halalTitle: 'Kripto Savdosi Islom Nuqtai Nazaridan Halolmi?',
  halalText: "Akademiyamizda faqat Spot (naqd) savdo o'rgatiladi — fyucherslar, marja va qarzga savdo (riboga asoslangan mexanizmlar) qat'iyan tavsiya etilmaydi. Bizningcha, aniq egalik huquqi mavjud bo'lgan, ortiqcha noaniqlik (g'arar) va foizga (riбо) asoslanmagan savdo shariat tamoyillariga mos keladi. Har bir talaba o'z mintaqasidagi bilimdon olimlar bilan maslahatlashishni tavsiya qilamiz.",
  halalPoint1: "Faqat Spot savdo — aktivga to'liq egalik huquqi",
  halalPoint2: 'Riboga asoslangan marja va fyuchers savdosi yo\u2019q',
  halalPoint3: "Ortiqcha g'arar (noaniqlik)dan saqlanish va intizomli risk boshqaruvi",

  // PDF kutubxona (cheksiz miqdorda qo'shsa bo'ladi)
  pdfs: [
    { title: 'SMC & ICT Boshlang\u2019ich Qo\u2019llanma', desc: "Smart Money Concepts va ICT tahlilining asosiy tushunchalari haqida qisqa qo'llanma.", url: '' },
    { title: "Risk-menedjment Yo'riqnomasi", desc: "Halol va intizomli risk boshqaruvi bo'yicha amaliy maslahatlar.", url: '' },
    { title: "Halol Savdo Qo'llanmasi", desc: 'Spot savdoda shariat tamoyillariga rioya qilish bo\u2019yicha asosiy qoidalar.', url: '' }
  ]
};

function migrateOldFields(c) {
  // Eski (fixed) youtube1..3 / pdf1..3 formatidan yangi arrayga o'tkazish
  if (!Array.isArray(c.videos)) {
    const vids = [];
    for (let i = 1; i <= 10; i++) {
      const t = c['youtube' + i + 'Title'];
      const u = c['youtube' + i + 'Url'];
      if (t || u) vids.push({ title: t || '', url: u || '' });
    }
    c.videos = vids.length ? vids : defaultContent.videos;
  }
  if (!Array.isArray(c.pdfs)) {
    const pdfs = [];
    for (let i = 1; i <= 10; i++) {
      const t = c['pdf' + i + 'Title'];
      const d = c['pdf' + i + 'Desc'];
      const u = c['pdf' + i + 'Url'];
      if (t || d || u) pdfs.push({ title: t || '', desc: d || '', url: u || '' });
    }
    c.pdfs = pdfs.length ? pdfs : defaultContent.pdfs;
  }
  return c;
}
function loadContent() {
  try {
    const raw = fs.readFileSync(CONTENT_FILE, 'utf8');
    const merged = Object.assign({}, defaultContent, JSON.parse(raw));
    return migrateOldFields(merged);
  } catch (e) {
    return Object.assign({}, defaultContent);
  }
}
function saveContent(c) {
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(c, null, 2), 'utf8');
}
let content = loadContent();

const sessions = new Set();
function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > -1) cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return cookies;
}
function isAuthenticated(req) {
  const cookies = parseCookies(req);
  return !!(cookies.admin_session && sessions.has(cookies.admin_session));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 15 * 1024 * 1024) { reject(new Error('Payload too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || '')); const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function logoHtml(c) {
  if (c.logoImage) {
    return `<img src="${c.logoImage}" alt="Logo" class="w-full h-full object-contain rounded-xl">`;
  }
  return `<svg class="w-full h-full drop-shadow-[0_0_15px_rgba(255,215,0,0.35)] transition-transform duration-300 group-hover:scale-105" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,3 93,25 93,75 50,97 7,75 7,25" fill="#0D121D" stroke="url(#goldGrad)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M20 35H35V20M80 35H65V20M20 65H35V80M80 65H65V80" stroke="#00E676" stroke-width="1.5" stroke-opacity="0.5" stroke-dasharray="2 2"/>
      <circle cx="35" cy="20" r="2" fill="#00E676"/><circle cx="65" cy="20" r="2" fill="#00E676"/>
      <circle cx="35" cy="80" r="2" fill="#00E676"/><circle cx="65" cy="80" r="2" fill="#00E676"/>
      <line x1="38" y1="28" x2="38" y2="72" stroke="#00E676" stroke-width="1.5"/><rect x="34" y="38" width="8" height="22" rx="1.5" fill="#00E676"/>
      <line x1="62" y1="28" x2="62" y2="72" stroke="#FF5252" stroke-width="1.5"/><rect x="58" y="44" width="8" height="18" rx="1.5" fill="#FF5252"/>
      <text x="50" y="62" font-family="'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="28" fill="url(#goldGrad)" text-anchor="middle" letter-spacing="-1">TMT</text>
      <defs><linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFF5B8"/><stop offset="50%" stop-color="#FFD700"/><stop offset="100%" stop-color="#C5A028"/></linearGradient></defs>
    </svg>`;
}

function buildPublicHtml(c) {
  return `<!DOCTYPE html>
<html lang="uz" class="dark scroll-smooth">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Top Muslim Traders Academy — halol Spot kripto savdosi, Smart Money Concepts (SMC) va ICT tahlilini o'rgatuvchi xalqaro treyderlar akademiyasi.">
<title>Top Muslim Traders Academy | Halol Kripto & Smart Money Hub</title>
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = { darkMode: 'class', theme: { extend: {
  colors: { darkBg:'#06080D', cardBg:'#0D121D', cardBorder:'#1A2436', goldAccent:'#FFD700', goldDark:'#C5A028',
    emeraldGreen:'#00E676', tradeRed:'#FF5252', accentBlue:'#00F0FF', accentPurple:'#A855F7',
    instaPink:'#E1306C', instaPurple:'#833AB4', instaOrange:'#F77737' },
  fontFamily: { sans: ['Plus Jakarta Sans','Inter','sans-serif'] }
} } }
</script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
body{font-family:'Plus Jakarta Sans',sans-serif;background-color:#06080D;color:#F1F5F9;}
.glass-card{background:rgba(13,18,29,0.75);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.07);}
.glass-card-hover{transition:all .3s cubic-bezier(.4,0,.2,1);}
.glass-card-hover:hover{transform:translateY(-4px);border-color:rgba(255,215,0,.3);box-shadow:0 12px 30px -10px rgba(0,0,0,.8),0 0 20px rgba(255,215,0,.15);}
.insta-gradient-bg{background:linear-gradient(45deg,#405DE6,#5851DB,#833AB4,#C13584,#E1306C,#FD1D1D);}
.gradient-gold-text{background:linear-gradient(135deg,#FFF5B8 0%,#FFD700 50%,#C5A028 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.grid-cyber-pattern{background-size:40px 40px;background-image:linear-gradient(to right,rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.02) 1px,transparent 1px);}
.section-label{font-size:.7rem;letter-spacing:.08em;color:#00E676;font-weight:700;}
</style>
</head>
<body class="bg-darkBg text-slate-100 antialiased flex flex-col min-h-screen justify-between relative">

<header class="bg-cardBg/80 border-b border-cardBorder/80 backdrop-blur-2xl sticky top-0 z-40">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-20">
      <a href="#hero" class="flex items-center space-x-3.5 group">
        <div class="relative w-12 h-12 flex-shrink-0">${logoHtml(c)}</div>
        <div>
          <div class="text-lg sm:text-xl font-black tracking-wider text-white leading-none">
            TOP MUSLIM TRADERS <span class="gradient-gold-text">ACADEMY</span>
          </div>
          <span class="block text-[10px] text-emeraldGreen font-bold uppercase tracking-widest mt-1">Halol Kripto & Smart Money Hub</span>
        </div>
      </a>
      <nav class="hidden xl:flex items-center space-x-6 text-sm font-bold text-slate-300">
        <a href="#hero" class="hover:text-goldAccent">Bosh Sahifa</a>
        <a href="#youtube" class="hover:text-red-400"><i class="fa-brands fa-youtube text-red-500"></i> Video Darslar</a>
        <a href="#halal" class="hover:text-goldAccent"><i class="fa-solid fa-kaaba text-goldAccent"></i> Kripto Halolmi?</a>
        <a href="#calculator" class="hover:text-accentBlue"><i class="fa-solid fa-calculator text-accentBlue"></i> Kalkulyator</a>
        <a href="#pdf-library" class="hover:text-accentPurple"><i class="fa-solid fa-book-bookmark text-accentPurple"></i> PDF Kitoblar</a>
      </nav>
      <a href="${esc(c.telegramBot)}" target="_blank" class="hidden md:flex items-center space-x-2 bg-gradient-to-r from-goldAccent to-goldDark text-darkBg font-extrabold px-4 py-2.5 rounded-xl text-xs">
        <i class="fa-solid fa-robot"></i><span>Aloqa Boti</span>
      </a>
    </div>
  </div>
</header>

<section id="hero" class="relative py-16 lg:py-28 border-b border-cardBorder grid-cyber-pattern">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
    ${c.heroImage ? `<div class="mb-10 rounded-3xl overflow-hidden border border-goldAccent/30 shadow-2xl"><img src="${c.heroImage}" alt="Banner" class="w-full max-h-[420px] object-cover"></div>` : ''}
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      <div class="lg:col-span-7 space-y-6 text-center lg:text-left">
        <div class="inline-flex items-center space-x-2.5 bg-cardBg/90 border border-goldAccent/50 px-4 py-2 rounded-full text-xs font-extrabold text-goldAccent">
          <i class="fa-solid fa-shield-halal"></i><span>${esc(c.heroBadge)}</span>
        </div>
        <h1 class="text-3xl sm:text-5xl lg:text-6xl font-black leading-tight text-white">
          ${esc(c.heroTitle1)}<br/><span class="gradient-gold-text">${esc(c.heroTitle2)}</span>
        </h1>
        <p class="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto lg:mx-0">${esc(c.heroDesc)}</p>
        <div class="flex flex-wrap justify-center lg:justify-start gap-4 pt-3">
          <a href="${esc(c.telegramChannel)}" target="_blank" class="flex items-center space-x-2.5 bg-gradient-to-r from-goldAccent to-goldDark text-darkBg font-black px-7 py-4 rounded-2xl text-sm">
            <i class="fa-brands fa-telegram text-xl"></i><span>Scalp Telegram Kanal</span>
          </a>
          <a href="${esc(c.instagram)}" target="_blank" class="flex items-center space-x-2.5 bg-gradient-to-r from-instaOrange via-instaPink to-instaPurple text-white font-black px-7 py-4 rounded-2xl text-sm">
            <i class="fa-brands fa-instagram text-xl"></i><span>Instagram Sahifamiz</span>
          </a>
        </div>
        <div class="grid grid-cols-3 gap-4 pt-8 border-t border-cardBorder/80 max-w-lg mx-auto lg:mx-0">
          <div class="glass-card p-4 rounded-2xl border border-cardBorder">
            <div class="text-2xl sm:text-3xl font-black text-white">${esc(c.stat1Value)}</div>
            <div class="text-[11px] font-medium text-slate-400 mt-1">${esc(c.stat1Label)}</div>
          </div>
          <div class="glass-card p-4 rounded-2xl border border-cardBorder">
            <div class="text-2xl sm:text-3xl font-black text-emeraldGreen">${esc(c.stat2Value)}</div>
            <div class="text-[11px] font-medium text-slate-400 mt-1">${esc(c.stat2Label)}</div>
          </div>
          <div class="glass-card p-4 rounded-2xl border border-cardBorder">
            <div class="text-2xl sm:text-3xl font-black text-goldAccent">${esc(c.stat3Value)}</div>
            <div class="text-[11px] font-medium text-slate-400 mt-1">${esc(c.stat3Label)}</div>
          </div>
        </div>
      </div>
      <div class="lg:col-span-5">
        <div class="glass-card border border-goldAccent/30 rounded-3xl p-6">
          <div class="space-y-3">
            <a href="${esc(c.instagram)}" target="_blank" class="flex items-center justify-between p-3.5 rounded-2xl bg-darkBg/90 border border-instaPink/40">
              <div class="flex items-center space-x-3.5">
                <div class="w-10 h-10 rounded-xl insta-gradient-bg text-white flex items-center justify-center"><i class="fa-brands fa-instagram text-xl"></i></div>
                <div><div class="text-sm font-bold text-white">Instagram</div><div class="text-xs text-slate-400">Video Reels & Darslar</div></div>
              </div>
            </a>
            <a href="${esc(c.telegramChannel)}" target="_blank" class="flex items-center justify-between p-3.5 rounded-2xl bg-darkBg/90 border border-cardBorder">
              <div class="flex items-center space-x-3.5">
                <div class="w-10 h-10 rounded-xl bg-accentBlue/10 text-accentBlue flex items-center justify-center"><i class="fa-brands fa-telegram text-xl"></i></div>
                <div><div class="text-sm font-bold text-white">Telegram Kanal</div><div class="text-xs text-slate-400">Signallar & Tahlillar</div></div>
              </div>
            </a>
            <a href="${esc(c.telegramResults)}" target="_blank" class="flex items-center justify-between p-3.5 rounded-2xl bg-darkBg/90 border border-cardBorder">
              <div class="flex items-center space-x-3.5">
                <div class="w-10 h-10 rounded-xl bg-emeraldGreen/10 text-emeraldGreen flex items-center justify-center"><i class="fa-solid fa-chart-line"></i></div>
                <div><div class="text-sm font-bold text-white">Natijalar</div><div class="text-xs text-slate-400">O'quvchilar natijalari</div></div>
              </div>
            </a>
            <a href="${esc(c.telegramBot)}" target="_blank" class="flex items-center justify-between p-3.5 rounded-2xl bg-darkBg/90 border border-cardBorder">
              <div class="flex items-center space-x-3.5">
                <div class="w-10 h-10 rounded-xl bg-goldAccent/10 text-goldAccent flex items-center justify-center"><i class="fa-solid fa-robot"></i></div>
                <div><div class="text-sm font-bold text-white">Bot</div><div class="text-xs text-slate-400">Savol-Javob</div></div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section id="youtube" class="py-16 lg:py-24 border-b border-cardBorder">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-2xl mx-auto mb-12">
      <span class="section-label"><i class="fa-brands fa-youtube"></i> VIDEO DARSLAR</span>
      <h2 class="text-2xl sm:text-4xl font-black text-white mt-2">O'rganishni Video Orqali Boshlang</h2>
      <p class="text-slate-400 text-sm mt-3">SMC, ICT va risk-menedjment bo'yicha bepul video darslarimiz</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      ${(c.videos || []).map(v => `
      <a href="${esc(v.url)}" target="_blank" class="glass-card glass-card-hover rounded-2xl overflow-hidden border border-cardBorder block">
        <div class="aspect-video bg-darkBg/90 flex items-center justify-center border-b border-cardBorder"><i class="fa-brands fa-youtube text-5xl text-red-500/70"></i></div>
        <div class="p-4"><div class="text-sm font-bold text-white">${esc(v.title)}</div></div>
      </a>`).join('')}
    </div>
    <div class="text-center mt-8">
      <a href="${esc(c.youtubeChannel)}" target="_blank" class="inline-flex items-center space-x-2 text-red-400 font-bold text-sm hover:text-red-300">
        <i class="fa-brands fa-youtube"></i><span>Kanalimizga obuna bo'ling</span>
      </a>
    </div>
  </div>
</section>

<section id="halal" class="py-16 lg:py-24 border-b border-cardBorder grid-cyber-pattern">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-10">
      <span class="section-label"><i class="fa-solid fa-kaaba"></i> HALOL KRIPTO</span>
      <h2 class="text-2xl sm:text-4xl font-black text-white mt-2">${esc(c.halalTitle)}</h2>
    </div>
    <div class="glass-card rounded-3xl p-6 sm:p-10 border border-goldAccent/20">
      <p class="text-slate-300 text-sm sm:text-base leading-relaxed">${esc(c.halalText)}</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        <div class="flex items-start space-x-3 bg-darkBg/60 p-4 rounded-xl border border-cardBorder">
          <i class="fa-solid fa-check text-emeraldGreen mt-1"></i><span class="text-xs text-slate-300">${esc(c.halalPoint1)}</span>
        </div>
        <div class="flex items-start space-x-3 bg-darkBg/60 p-4 rounded-xl border border-cardBorder">
          <i class="fa-solid fa-check text-emeraldGreen mt-1"></i><span class="text-xs text-slate-300">${esc(c.halalPoint2)}</span>
        </div>
        <div class="flex items-start space-x-3 bg-darkBg/60 p-4 rounded-xl border border-cardBorder">
          <i class="fa-solid fa-check text-emeraldGreen mt-1"></i><span class="text-xs text-slate-300">${esc(c.halalPoint3)}</span>
        </div>
      </div>
      <p class="text-[11px] text-slate-500 mt-6">*Bu ma'lumot umumiy tavsiya xarakteriga ega bo'lib, diniy fatvo hisoblanmaydi. Iltimos, o'z mintaqangizdagi bilimdon ulamolar bilan maslahatlashing.</p>
    </div>
  </div>
</section>

<section id="calculator" class="py-16 lg:py-24 border-b border-cardBorder">
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-10">
      <span class="section-label"><i class="fa-solid fa-calculator"></i> KALKULYATOR</span>
      <h2 class="text-2xl sm:text-4xl font-black text-white mt-2">Risk & Pozitsiya Hajmi Kalkulyatori</h2>
      <p class="text-slate-400 text-sm mt-3">Intizomli savdo uchun har bir bitimda qancha risk qilishingizni oldindan hisoblang</p>
    </div>
    <div class="glass-card rounded-3xl p-6 sm:p-8 border border-accentBlue/20">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-slate-400">Depozit (USDT)</label>
          <input id="calcDeposit" type="number" value="1000" class="w-full mt-1 p-3 rounded-xl bg-darkBg border border-cardBorder text-white">
        </div>
        <div>
          <label class="text-xs text-slate-400">Risk foizi (%)</label>
          <input id="calcRisk" type="number" value="1" class="w-full mt-1 p-3 rounded-xl bg-darkBg border border-cardBorder text-white">
        </div>
        <div>
          <label class="text-xs text-slate-400">Kirish narxi (Entry)</label>
          <input id="calcEntry" type="number" value="100" class="w-full mt-1 p-3 rounded-xl bg-darkBg border border-cardBorder text-white">
        </div>
        <div>
          <label class="text-xs text-slate-400">Stop-Loss narxi</label>
          <input id="calcStop" type="number" value="98" class="w-full mt-1 p-3 rounded-xl bg-darkBg border border-cardBorder text-white">
        </div>
      </div>
      <button onclick="calcPosition()" class="w-full mt-6 bg-gradient-to-r from-accentBlue to-emeraldGreen text-darkBg font-black py-3.5 rounded-xl">Hisoblash</button>
      <div id="calcResult" class="mt-6 hidden bg-darkBg/70 border border-cardBorder rounded-xl p-4 space-y-1.5 text-sm"></div>
    </div>
  </div>
</section>

<section id="pdf-library" class="py-16 lg:py-24 border-b border-cardBorder grid-cyber-pattern">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-2xl mx-auto mb-12">
      <span class="section-label"><i class="fa-solid fa-book-bookmark"></i> PDF KUTUBXONA</span>
      <h2 class="text-2xl sm:text-4xl font-black text-white mt-2">Bepul O'quv Materiallari</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      ${(c.pdfs || []).map(p => `
      <div class="glass-card glass-card-hover rounded-2xl p-6 border border-cardBorder flex flex-col">
        <i class="fa-solid fa-file-pdf text-3xl text-accentPurple mb-3"></i>
        <div class="text-sm font-bold text-white">${esc(p.title)}</div>
        <p class="text-xs text-slate-400 mt-2 flex-grow">${esc(p.desc)}</p>
        ${p.url ? `<a href="${esc(p.url)}" target="_blank" class="mt-4 inline-flex items-center justify-center text-xs font-bold bg-accentPurple/15 text-accentPurple px-4 py-2.5 rounded-lg">Yuklab olish</a>` : `<span class="mt-4 inline-flex items-center justify-center text-xs font-bold bg-cardBorder/40 text-slate-500 px-4 py-2.5 rounded-lg">Tez orada</span>`}
      </div>`).join('')}
    </div>
  </div>
</section>

<footer class="bg-cardBg border-t border-cardBorder py-10">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
    &copy; 2026 TOP MUSLIM TRADERS ACADEMY. Barcha huquqlar himoyalangan.
  </div>
</footer>

<script>
function calcPosition(){
  const deposit = parseFloat(document.getElementById('calcDeposit').value) || 0;
  const riskPct = parseFloat(document.getElementById('calcRisk').value) || 0;
  const entry = parseFloat(document.getElementById('calcEntry').value) || 0;
  const stop = parseFloat(document.getElementById('calcStop').value) || 0;
  const box = document.getElementById('calcResult');
  if (!deposit || !riskPct || !entry || !stop || entry === stop) {
    box.classList.remove('hidden');
    box.innerHTML = '<div class="text-tradeRed">Iltimos, barcha maydonlarni to\\'g\\'ri to\\'ldiring (Entry va Stop-Loss teng bo\\'lmasligi kerak).</div>';
    return;
  }
  const riskAmount = deposit * (riskPct / 100);
  const priceDistance = Math.abs(entry - stop);
  const positionSize = riskAmount / priceDistance;
  const positionValue = positionSize * entry;
  box.classList.remove('hidden');
  box.innerHTML =
    '<div class="flex justify-between"><span class="text-slate-400">Risk miqdori:</span><span class="text-white font-bold">' + riskAmount.toFixed(2) + ' USDT</span></div>' +
    '<div class="flex justify-between"><span class="text-slate-400">Pozitsiya hajmi (dona/coin):</span><span class="text-emeraldGreen font-bold">' + positionSize.toFixed(6) + '</span></div>' +
    '<div class="flex justify-between"><span class="text-slate-400">Pozitsiya qiymati:</span><span class="text-goldAccent font-bold">' + positionValue.toFixed(2) + ' USDT</span></div>';
}
</script>
</body>
</html>`;
}

function loginPageHtml(error) {
  return `<!DOCTYPE html><html lang="uz"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Kirish | Top Muslim Traders Academy</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center px-4">
<form method="POST" action="/admin/login" class="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl">
  <div class="text-center">
    <div class="text-xs font-bold tracking-widest text-yellow-500 uppercase">Top Muslim Traders Academy</div>
    <h1 class="text-xl font-bold mt-1">Admin Panelga Kirish</h1>
  </div>
  ${error ? `<div class="bg-red-500/20 text-red-300 text-sm p-2.5 rounded-lg">${esc(error)}</div>` : ''}
  <div>
    <label class="text-xs text-slate-400">Login</label>
    <input name="username" placeholder="Login" class="w-full p-3 mt-1 rounded-lg bg-slate-800 border border-slate-700 text-white" required autofocus>
  </div>
  <div>
    <label class="text-xs text-slate-400">Parol</label>
    <input name="password" type="password" placeholder="Parol" class="w-full p-3 mt-1 rounded-lg bg-slate-800 border border-slate-700 text-white" required>
  </div>
  <button class="w-full bg-yellow-500 hover:bg-yellow-400 transition text-black font-bold p-3 rounded-lg">Kirish</button>
</form></body></html>`;
}

function field(label, name, value, type) {
  type = type || 'text';
  return `<div><label class="text-xs text-slate-400">${esc(label)}</label>
      <input name="${name}" type="${type}" value="${esc(value)}" class="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 mt-1"></div>`;
}
function textareaField(label, name, value) {
  return `<div><label class="text-xs text-slate-400">${esc(label)}</label>
      <textarea name="${name}" rows="3" class="w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700 mt-1">${esc(value)}</textarea></div>`;
}

function adminPageHtml(c, message) {
  return `<!DOCTYPE html><html lang="uz"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Panel | Top Muslim Traders Academy</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>.tab-btn.active{background:#EAB308;color:#000;}.tab-panel{display:none;}.tab-panel.active{display:block;}</style>
</head>
<body class="bg-slate-950 text-white min-h-screen">
<div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
  <div class="flex flex-wrap justify-between items-center gap-3">
    <div>
      <div class="text-xs font-bold tracking-widest text-yellow-500 uppercase">Top Muslim Traders Academy</div>
      <h1 class="text-2xl font-bold">Saytni Boshqarish Paneli</h1>
    </div>
    <div class="flex gap-2">
      <a href="/" target="_blank" class="bg-slate-800 hover:bg-slate-700 transition px-4 py-2.5 rounded-lg text-sm font-bold">Saytni ko'rish</a>
      <form method="POST" action="/admin/logout"><button class="bg-red-600 hover:bg-red-500 transition px-4 py-2.5 rounded-lg text-sm font-bold">Chiqish</button></form>
    </div>
  </div>
  ${message ? `<div class="bg-green-500/20 text-green-300 p-3 rounded-lg text-sm">${esc(message)}</div>` : ''}
  <div id="saveMsg" class="hidden bg-green-500/20 text-green-300 p-3 rounded-lg text-sm">Saqlandi ✓</div>

  <div class="flex flex-wrap gap-2">
    <button type="button" data-tab="main" class="tab-btn active bg-slate-800 px-4 py-2 rounded-lg text-xs font-bold">Asosiy Sahifa</button>
    <button type="button" data-tab="links" class="tab-btn bg-slate-800 px-4 py-2 rounded-lg text-xs font-bold">Havolalar & Rasmlar</button>
    <button type="button" data-tab="video" class="tab-btn bg-slate-800 px-4 py-2 rounded-lg text-xs font-bold">Video Darslar</button>
    <button type="button" data-tab="halal" class="tab-btn bg-slate-800 px-4 py-2 rounded-lg text-xs font-bold">Kripto Halolmi?</button>
    <button type="button" data-tab="pdf" class="tab-btn bg-slate-800 px-4 py-2 rounded-lg text-xs font-bold">PDF Kutubxona</button>
  </div>

  <form id="editForm" class="space-y-5">

    <div class="tab-panel active space-y-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl" data-panel="main">
      <h2 class="font-bold text-yellow-500">Hero bo'limi va statistika</h2>
      ${field('Hero belgi (badge)', 'heroBadge', c.heroBadge)}
      ${field('Sarlavha 1-qator', 'heroTitle1', c.heroTitle1)}
      ${field('Sarlavha 2-qator (oltin rang)', 'heroTitle2', c.heroTitle2)}
      ${textareaField('Tavsif matni', 'heroDesc', c.heroDesc)}
      <div class="grid grid-cols-3 gap-3">
        <div>${field('Statistika 1 qiymati', 'stat1Value', c.stat1Value)}<div class="mt-1">${field('Statistika 1 nomi', 'stat1Label', c.stat1Label)}</div></div>
        <div>${field('Statistika 2 qiymati', 'stat2Value', c.stat2Value)}<div class="mt-1">${field('Statistika 2 nomi', 'stat2Label', c.stat2Label)}</div></div>
        <div>${field('Statistika 3 qiymati', 'stat3Value', c.stat3Value)}<div class="mt-1">${field('Statistika 3 nomi', 'stat3Label', c.stat3Label)}</div></div>
      </div>
    </div>

    <div class="tab-panel space-y-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl" data-panel="links">
      <h2 class="font-bold text-yellow-500">Ijtimoiy tarmoq havolalari</h2>
      ${field('Telegram Bot havolasi', 'telegramBot', c.telegramBot)}
      ${field('Telegram Kanal havolasi', 'telegramChannel', c.telegramChannel)}
      ${field('Telegram Natijalar havolasi', 'telegramResults', c.telegramResults)}
      ${field('Instagram havolasi', 'instagram', c.instagram)}
      <h2 class="font-bold text-yellow-500 pt-2">Rasmlar</h2>
      <div><label class="text-xs text-slate-400">Logo rasmi (ixtiyoriy)</label>
        <input type="file" id="logoFile" accept="image/*" class="w-full text-sm mt-1">
        <input type="hidden" name="logoImage" id="logoImage" value="${esc(c.logoImage)}"></div>
      <div><label class="text-xs text-slate-400">Hero banner rasmi (ixtiyoriy)</label>
        <input type="file" id="heroFile" accept="image/*" class="w-full text-sm mt-1">
        <input type="hidden" name="heroImage" id="heroImage" value="${esc(c.heroImage)}"></div>
    </div>

    <div class="tab-panel space-y-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl" data-panel="video">
      <h2 class="font-bold text-yellow-500">YouTube video darslar</h2>
      ${field('YouTube kanal havolasi', 'youtubeChannel', c.youtubeChannel)}
      <div id="videoList" class="space-y-3 pt-2"></div>
      <button type="button" onclick="addVideoRow()" class="w-full border-2 border-dashed border-slate-700 hover:border-yellow-500 text-slate-400 hover:text-yellow-500 transition py-3 rounded-xl text-sm font-bold">+ Yangi video qo'shish</button>
    </div>

    <div class="tab-panel space-y-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl" data-panel="halal">
      <h2 class="font-bold text-yellow-500">"Kripto halolmi?" bo'limi</h2>
      ${field('Sarlavha', 'halalTitle', c.halalTitle)}
      ${textareaField('Asosiy matn', 'halalText', c.halalText)}
      ${field('1-nuqta', 'halalPoint1', c.halalPoint1)}
      ${field('2-nuqta', 'halalPoint2', c.halalPoint2)}
      ${field('3-nuqta', 'halalPoint3', c.halalPoint3)}
    </div>

    <div class="tab-panel space-y-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl" data-panel="pdf">
      <h2 class="font-bold text-yellow-500">PDF kutubxona (havolani bo'sh qoldirsangiz, "Tez orada" deb ko'rsatiladi)</h2>
      <div id="pdfList" class="space-y-4"></div>
      <button type="button" onclick="addPdfRow()" class="w-full border-2 border-dashed border-slate-700 hover:border-yellow-500 text-slate-400 hover:text-yellow-500 transition py-3 rounded-xl text-sm font-bold">+ Yangi PDF qo'shish</button>
    </div>

    <button type="submit" class="w-full bg-yellow-500 hover:bg-yellow-400 transition text-black font-bold p-3.5 rounded-xl">Barcha o'zgarishlarni saqlash</button>
  </form>
</div>
<script>
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector('.tab-panel[data-panel="' + btn.dataset.tab + '"]').classList.add('active');
  });
});
function fileToBase64(input, hiddenId) {
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { document.getElementById(hiddenId).value = reader.result; };
    reader.readAsDataURL(file);
  });
}
fileToBase64(document.getElementById('logoFile'), 'logoImage');
fileToBase64(document.getElementById('heroFile'), 'heroImage');

// ---- Dinamik Video ro'yxati ----
const existingVideos = ${JSON.stringify(c.videos || [])};
function addVideoRow(video) {
  video = video || { title: '', url: '' };
  const wrap = document.createElement('div');
  wrap.className = 'video-row flex gap-2 items-start bg-slate-800/60 p-3 rounded-xl';
  wrap.innerHTML =
    '<div class="flex-grow space-y-2">' +
      '<input class="v-title w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700" placeholder="Video sarlavhasi" value="' + video.title.replace(/"/g,'&quot;') + '">' +
      '<input class="v-url w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700" placeholder="Video havolasi (YouTube link)" value="' + video.url.replace(/"/g,'&quot;') + '">' +
    '</div>' +
    '<button type="button" onclick="this.parentElement.remove()" class="bg-red-600 hover:bg-red-500 transition text-white text-xs font-bold px-3 py-2 rounded-lg mt-1">O\\'chirish</button>';
  document.getElementById('videoList').appendChild(wrap);
}
existingVideos.forEach(addVideoRow);

// ---- Dinamik PDF ro'yxati ----
const existingPdfs = ${JSON.stringify(c.pdfs || [])};
function addPdfRow(pdf) {
  pdf = pdf || { title: '', desc: '', url: '' };
  const wrap = document.createElement('div');
  wrap.className = 'pdf-row flex gap-2 items-start bg-slate-800/60 p-3 rounded-xl';
  wrap.innerHTML =
    '<div class="flex-grow space-y-2">' +
      '<input class="p-title w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700" placeholder="PDF sarlavhasi" value="' + pdf.title.replace(/"/g,'&quot;') + '">' +
      '<textarea class="p-desc w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700" rows="2" placeholder="Qisqa tavsif">' + pdf.desc.replace(/</g,'&lt;') + '</textarea>' +
      '<input class="p-url w-full p-2.5 rounded-lg bg-slate-800 border border-slate-700" placeholder="PDF havolasi (bo\\'sh qoldirsa \\'Tez orada\\' chiqadi)" value="' + pdf.url.replace(/"/g,'&quot;') + '">' +
    '</div>' +
    '<button type="button" onclick="this.parentElement.remove()" class="bg-red-600 hover:bg-red-500 transition text-white text-xs font-bold px-3 py-2 rounded-lg mt-1">O\\'chirish</button>';
  document.getElementById('pdfList').appendChild(wrap);
}
existingPdfs.forEach(addPdfRow);

document.getElementById('editForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = {};
  formData.forEach((v, k) => { data[k] = v; });

  data.videos = Array.from(document.querySelectorAll('#videoList .video-row')).map(row => ({
    title: row.querySelector('.v-title').value.trim(),
    url: row.querySelector('.v-url').value.trim()
  })).filter(v => v.title || v.url);

  data.pdfs = Array.from(document.querySelectorAll('#pdfList .pdf-row')).map(row => ({
    title: row.querySelector('.p-title').value.trim(),
    desc: row.querySelector('.p-desc').value.trim(),
    url: row.querySelector('.p-url').value.trim()
  })).filter(p => p.title || p.desc || p.url);

  const res = await fetch('/admin/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const msg = document.getElementById('saveMsg');
  if (res.ok) {
    msg.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => msg.classList.add('hidden'), 3000);
  } else {
    alert('Xatolik yuz berdi. Qayta urinib ko\\'ring.');
  }
});
</script>
</body></html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('OK');
    }

    if (req.url === '/admin/login' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(loginPageHtml());
    }

    if (req.url === '/admin/login' && req.method === 'POST') {
      const body = await readBody(req);
      const parsed = querystring.parse(body);
      if (safeEqual(parsed.username, ADMIN_USER) && safeEqual(parsed.password, ADMIN_PASS)) {
        const token = crypto.randomBytes(32).toString('hex');
        sessions.add(token);
        res.writeHead(302, {
          'Set-Cookie': `admin_session=${token}; HttpOnly; Path=/; Max-Age=86400`,
          'Location': '/admin'
        });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(loginPageHtml('Login yoki parol noto\'g\'ri'));
    }

    if (req.url === '/admin/logout' && req.method === 'POST') {
      const cookies = parseCookies(req);
      if (cookies.admin_session) sessions.delete(cookies.admin_session);
      res.writeHead(302, { 'Location': '/admin/login' });
      return res.end();
    }

    if (req.url === '/admin' && req.method === 'GET') {
      if (!isAuthenticated(req)) {
        res.writeHead(302, { 'Location': '/admin/login' });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(adminPageHtml(content));
    }

    if (req.url === '/admin/save' && req.method === 'POST') {
      if (!isAuthenticated(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'unauthorized' }));
      }
      const body = await readBody(req);
      const updates = JSON.parse(body);
      content = Object.assign({}, content, updates);
      saveContent(content);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    // Public site
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.end(buildPublicHtml(content));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`Top Muslim Traders Academy Server is live on port ${PORT}`);
  console.log(`Admin panel: /admin/login  (login: ${ADMIN_USER})`);
});
