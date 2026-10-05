'use strict';
/* ==========================================================
   FRONTIER'S END — açılış videosu
   Oyun her açıldığında ana menüden önce video/intro.mp4 (ya da
   video/intro.webm) tam ekran oynar. Herhangi bir tuş, tıklama ya da
   kol tuşu videoyu geçer; bitince ana menüye yumuşakça geçilir.
   Dosya yoksa ya da açılamazsa hiçbir şey göstermeden menü açılır.
   Tarayıcı sesli videoyu kullanıcı etkileşimi olmadan başlatmazsa
   (itch.io gibi) önce "Başlamak için bir tuşa bas" ekranı çıkar.
   ========================================================== */
const Intro = {
  SRC: ['video/intro.mp4', 'video/intro.webm'],
  play(done) {
    let finished = false;
    const finish = () => { if (finished) return; finished = true; done(); };
    if (window.__testNoIntro) { finish(); return; }
    const srcs = window.__introSrc ? [window.__introSrc] : this.SRC.slice();
    const root = document.createElement('div');
    root.id = 'intro';
    root.setAttribute('style', 'position:fixed;inset:0;z-index:900;background:#080808;display:flex;align-items:center;justify-content:center;cursor:none');
    const v = document.createElement('video');
    v.setAttribute('playsinline', ''); v.preload = 'auto';
    v.setAttribute('style', 'width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity 0.6s');
    const hint = document.createElement('div');
    hint.setAttribute('style', 'position:absolute;right:28px;bottom:22px;font:15px var(--serif);letter-spacing:0.08em;color:rgba(240,226,196,0.6);opacity:0;transition:opacity 0.8s');
    hint.textContent = Tr('Geçmek için bir tuşa bas');
    root.append(v, hint);
    document.body.appendChild(root);
    let state = 'load', raf = 0, padPrev = true, hintT = 0;
    const cleanup = () => {
      cancelAnimationFrame(raf); clearTimeout(hintT); clearTimeout(loadT);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
    // bitiş: video kararır, siyah perde açılır, ana menü görünür
    const end = (fast) => {
      if (state === 'end') return;
      state = 'end'; cleanup();
      v.style.opacity = '0'; hint.style.opacity = '0';
      try { if (fast) v.pause(); } catch (e) {}
      setTimeout(() => {
        finish();
        root.style.transition = 'opacity 0.5s'; root.style.opacity = '0';
        setTimeout(() => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} root.remove(); }, 520);
      }, fast ? 250 : 600);
    };
    const start = () => {
      state = 'play';
      v.muted = false;
      const p = v.play();
      if (p && p.then) p.then(() => { v.style.opacity = '1'; hintT = setTimeout(() => (hint.style.opacity = '1'), 1200); }).catch((e) => {
        // tarayıcı sesli oynatmaya izin vermedi: tıklama/tuş bekle
        if (e && e.name === 'NotAllowedError') gate(); else end(true);
      });
      else { v.style.opacity = '1'; }
    };
    // tarayıcı engeli: "Başlamak için bir tuşa bas"
    const gate = () => {
      state = 'gate';
      root.style.cursor = 'pointer';
      const g = document.createElement('div');
      g.id = 'intro-gate';
      g.setAttribute('style', 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:#efe2c4;text-align:center');
      g.innerHTML = `<div style="font:56px var(--west);letter-spacing:0.04em">Frontier's End</div><div style="font:18px var(--sc);letter-spacing:0.12em;opacity:0.8">${Tr('Başlamak için bir tuşa bas')}</div>`;
      root.appendChild(g);
    };
    const advance = () => {
      if (state === 'gate') { const g = document.getElementById('intro-gate'); if (g) g.remove(); root.style.cursor = 'none'; try { Audio_.unlock(); } catch (e) {} start(); return; }
      if (state === 'play' || state === 'load') end(true);
    };
    // geçme tuşu menüye sızmasın: yakala ve durdur
    const onKey = (e) => { if (state === 'end') return; e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) advance(); };
    const onPointer = (e) => { if (state === 'end') return; e.preventDefault(); e.stopImmediatePropagation(); advance(); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    // kol: herhangi bir tuşa yeni basılınca
    const poll = () => {
      let any = false;
      try { for (const pad of navigator.getGamepads ? navigator.getGamepads() : []) if (pad) for (const b of pad.buttons) if (b.pressed) any = true; } catch (e) {}
      if (any && !padPrev) advance();
      padPrev = any;
      if (state !== 'end') raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    v.addEventListener('ended', () => end(false));
    // kaynak sırayla denenir; hiçbiri açılmazsa video yok demektir
    const tryNext = () => {
      const s = srcs.shift();
      if (!s) { end(true); return; }
      v.src = s; v.load();
    };
    v.addEventListener('error', () => { if (state === 'load') tryNext(); else end(true); });
    v.addEventListener('canplay', () => { if (state === 'load') start(); }, { once: false });
    const loadT = setTimeout(() => { if (state === 'load') end(true); }, 8000);
    tryNext();
  },
};
