// Points in the three original overview photographs, before viewport cropping.
function createCrownZones({host, image, portrait, panorama, select, completed = new Set()}) {
  const parts = [
    {id:'dent', name:'Крыло', detail:'Вмятина на крыле', wide:[.555,.458], bay:[.685,.487], phone:[.55,.43]},
    {id:'rust', name:'Кромка арки', detail:'Коррозия кромки арки', wide:[.618,.708], bay:[.729,.672], phone:[.61,.496]},
    {id:'bumper', name:'Бампер', detail:'Трещина бампера', wide:[.391,.742], bay:[.574,.735], phone:[.386,.514]},
    {id:'headlamp', name:'Фара', detail:'Помутнение фары', wide:[.402,.523], bay:[.587,.549], phone:[.402,.442]},
    {id:'hood', name:'Капот', detail:'Риски на капоте', wide:[.302,.402], bay:[.514,.454], phone:[.305,.403]},
    {id:'floor', name:'Днище', detail:'Антикор днища', wide:[.68,.755], bay:[.827,.688], phone:[.749,.51]},
    {id:'wash', name:'Мойка и химчистка', wide:[.735,.525], bay:[.807,.543], phone:[.735,.439]},
  ];
  const layer = document.createElement('div');
  layer.className = 'crown-zones';
  layer.setAttribute('role', 'group');
  layer.setAttribute('aria-label', 'Выберите участок автомобиля');
  host.append(layer);
  const finish = document.createElement('div');
  finish.className = 'crown-polished-layer';
  finish.setAttribute('aria-hidden','true');
  const photoMount = panorama ? host : image.closest('picture').parentElement;
  const exterior = ['dent','rust','bumper','headlamp','hood'];
  const maskUrl = id => host.dataset.photos + 'repair-masks/' + id + '.webp';
  const maskPreloads = new Map();
  const repairs = document.createElement('div');
  repairs.className = 'crown-panel-repairs';
  repairs.setAttribute('aria-hidden','true');
  const repairedPhoto = new Image();
  const wingPhoto = new Image();
  const wingPhotoUrl = () => host.dataset.photos +
    (portrait.matches ? 'phone/' : 'desktop/') + 'overview-wing-local.webp';
  const repairedPhotoUrl = () => host.dataset.photos +
    (portrait.matches ? 'phone/' : 'desktop/') + 'overview-polished-lamp.webp';
  let finishPrepared = false;
  let washFilm;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = parts[0].id;
  const hint = host.querySelector('.zone-hint') || host.parentElement.querySelector('.map-foot span');
  hint?.setAttribute('role','status');
  const buttons = parts.map((part, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'crown-zone';
    button.dataset.part = part.id;
    button.style.setProperty('--pulse-delay', (350 + index * 330) + 'ms');
    button.setAttribute('aria-label', 'Открыть крупный план — ' + part.detail);
    const leader = document.createElement('span');
    leader.className = 'crown-leader';
    const label = document.createElement('span');
    label.className = 'crown-label';
    label.textContent = part.name;
    button.append(leader, label);
    if (part.id === 'wash') {
      button.hidden = true;
      button.classList.add('crown-wash');
      button.setAttribute('aria-label', part.name);
      button.onclick = () => {
        button.hidden = true;
        startWash();
      };
    } else {
      button.onclick = () => {
        selected = part.id;
        layer.classList.add('inspecting');
        select(part.id);
      };
    }
    layer.append(button);
    return button;
  });

  function prepareWashFilm() {
    if (washFilm) return washFilm;
    washFilm = document.createElement('video');
    washFilm.className = 'crown-wash-film';
    washFilm.muted = washFilm.defaultMuted = washFilm.playsInline = true;
    washFilm.preload = 'auto';
    washFilm.setAttribute('aria-hidden','true');
    washFilm.src = host.dataset.photos + 'wash/body.mp4';
    return washFilm;
  }

  function startWash() {
    if (layer.inert || host.classList.contains('crown-restored')) return;
    layer.inert = true;
    host.classList.add('crown-washing');
    const overviewCopy = host.querySelector('.copy,.heroText');
    if (overviewCopy) overviewCopy.inert = true;
    if (hint) {
      hint.tabIndex = -1;
      hint.textContent = 'Мойка и химчистка…';
      hint.focus({preventScroll:true});
    }
    const film = reduced.matches ? washFilm : prepareWashFilm();
    let timeout, frameId, finished = false;
    function finishWash() {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      reduced.removeEventListener('change',finishWash);
      host.classList.add('crown-restored');
      image.alt = 'Чистый отполированный Toyota Crown после ремонта';
      if (film) {
        film.onended = film.onerror = film.onplaying = film.ontimeupdate = film.onwaiting = null;
        if (frameId != null) film.cancelVideoFrameCallback(frameId);
        film.remove();
        film.pause();
        film.removeAttribute('src');
        film.load();
        washFilm = undefined;
      }
      host.classList.remove('crown-washing','crown-wash-landing');
      if (overviewCopy) overviewCopy.inert = false;
      if (hint) hint.textContent = 'Мойка и химчистка выполнены';
      layer.inert = false;
      if (!hint && document.activeElement === document.body) {
        buttons.find(marker => marker.dataset.part === selected).focus({preventScroll:true});
      }
    }
    if (reduced.matches) { finishWash(); return; }
    reduced.addEventListener('change',finishWash);
    photoMount.append(film);
    layout();

    function waitForPlayback() {
      clearTimeout(timeout);
      timeout = setTimeout(finishWash,15000);
    }
    function showFrame() {
      if (!finished) film.classList.add('is-visible');
    }
    if (film.requestVideoFrameCallback) frameId = film.requestVideoFrameCallback(showFrame);
    film.onplaying = () => {
      clearTimeout(timeout);
      if (!film.requestVideoFrameCallback) showFrame();
    };
    film.onwaiting = waitForPlayback;
    film.ontimeupdate = () => {
      // The portrait extends above and below the filmed area. Settle that
      // garage surround into the final photograph while the take still plays.
      if (film.duration - film.currentTime < 1.1) host.classList.add('crown-wash-landing');
    };
    film.onended = () => {
      host.classList.add('crown-wash-landing');
      const settle = film.animate([{opacity:1},{opacity:0}],{duration:140,fill:'forwards'});
      settle.finished.then(finishWash,finishWash);
    };
    film.onerror = finishWash;
    waitForPlayback();
    film.play().catch(finishWash);
  }

  let flightStart;
  function layout() {
    if (!image.naturalWidth) return;
    const box = image.getBoundingClientRect();
    // The inspection hides the markers while a repair is being applied.
    // Size and load its photographic patch before the overview is revealed.
    const bounds = (layer.hidden ? host : layer).getBoundingClientRect();
    const phone = portrait.matches;
    // The HTML concept paints the portrait as a width-fitted, centred background.
    const widthFit = panorama && phone;
    const ratio = phone ? 9 / 16 : panorama ? 2 : 1672 / 941;
    const width = widthFit ? box.width : Math.max(box.width, box.height * ratio);
    const height = width / ratio;
    const [alignX, alignY] = getComputedStyle(image).objectPosition.split(' ').map(v => parseFloat(v) / 100);
    const left = box.left - bounds.left + (box.width - width) * (widthFit ? .5 : alignX);
    const top = box.top - bounds.top + (box.height - height) * (widthFit ? .5 : alignY);
    const photoUrl = repairedPhotoUrl();
    const background = 'url("' + photoUrl + '")';
    // The registered photograph occupies only the right side of the wider garage panorama.
    const inBay = panorama && !phone;
    const photoLeft = inBay ? left + width * 544 / 1774 : left;
    const photoTop = inBay ? top + height * 127 / 887 : top;
    const photoWidth = inBay ? width * 1207 / 1774 : width;
    const photoHeight = inBay ? height * 676 / 887 : height;
    flightStart = {
      x:photoLeft, y:photoTop + (phone ? photoHeight * 485 / 1778 : 0),
      width:photoWidth, height:phone ? photoHeight * 563 / 1778 : photoHeight
    };
    const mount = photoMount.getBoundingClientRect();
    for (const overlay of [repairs, finish]) {
      if (!overlay?.isConnected) continue;
      overlay.style.left = (photoLeft + bounds.left - mount.left) + 'px';
      overlay.style.top = (photoTop + bounds.top - mount.top) + 'px';
      overlay.style.width = photoWidth + 'px';
      overlay.style.height = photoHeight + 'px';
    }
    if (repairs.isConnected) {
      const wing = wingPhotoUrl();
      repairs.style.backgroundImage = completed.has('dent') ? 'url("' + wing + '"), ' + background : background;
      repairs.style.maskImage = exterior.filter(id => completed.has(id))
        .map(id => 'url("' + maskUrl(id) + '")').join(', ');
      // The portrait plate adds 485 units above the same 1000 × 563 photograph.
      repairs.style.maskSize = phone ? '100% ' + (563/1778*100) + '%' : '100% 100%';
      repairs.style.maskPosition = phone ? 'center ' + (485/(1778-563)*100) + '%' : 'center';
    }
    if (finishPrepared) {
      finish.hidden = panorama && phone;
      finish.style.backgroundImage = background;
    }
    if (washFilm?.isConnected) {
      // These are the dimensions of the original landscape plate inside
      // each responsive overview, in the local coordinates of the mount.
      Object.assign(washFilm.style,{
        left:(flightStart.x + bounds.left - mount.left) + 'px',
        top:(flightStart.y + bounds.top - mount.top) + 'px',
        width:flightStart.width + 'px', height:flightStart.height + 'px'
      });
    }
    const points = parts.map(part => {
      const [x,y] = phone ? part.phone : panorama ? part.bay : part.wide;
      return {x:left + x * width, y:top + y * height};
    });
    buttons.forEach((button, i) => {
      button.style.left = points[i].x + 'px';
      button.style.top = points[i].y + 'px';
    });
  }
  const observer = new ResizeObserver(layout);
  observer.observe(host);
  observer.observe(image);
  image.addEventListener('load', layout);
  portrait.addEventListener('change', layout);
  layout();
  return {
    point(id) {
      const button = buttons.find(marker => marker.dataset.part === id);
      if (!button?.style.left) return;
      return {x:parseFloat(button.style.left), y:parseFloat(button.style.top)};
    },
    flightBounds() { return flightStart; },
    prepareRepair(part) {
      if (part.id === 'dent' && wingPhoto.getAttribute('src') !== wingPhotoUrl()) {
        wingPhoto.src = wingPhotoUrl();
        wingPhoto.decode().catch(() => {});
      }
      const url = repairedPhotoUrl();
      if (!exterior.includes(part.id)) return;
      if (!maskPreloads.has(part.id)) {
        const mask = new Image();
        mask.src = maskUrl(part.id);
        maskPreloads.set(part.id,mask);
        mask.decode().catch(() => {});
      }
      if (repairedPhoto.getAttribute('src') === url) return;
      repairedPhoto.src = url;
      repairedPhoto.decode().catch(() => {});
    },
    repair(part) {
      const button = buttons.find(marker => marker.dataset.part === part.id);
      button.classList.add('is-repaired');
      button.setAttribute('aria-label', part.title + ' — ремонт выполнен, открыть');
      if (!exterior.includes(part.id)) return;
      if (!repairs.isConnected) photoMount.append(repairs);
      layout();
    },
    prepareFinish() {
      if (finishPrepared) return;
      finishPrepared = true;
      photoMount.append(finish);
      layout();
    },
    unlockWash() {
      const wash = layer.querySelector('.crown-wash');
      wash.hidden = false;
      if (!reduced.matches) prepareWashFilm();
      if (hint) hint.textContent = 'Ремонт завершён · нажмите плюс на двери';
    },
    show(visible) {
      if (layer.hidden === !visible) return;
      layer.hidden = !visible;
      if (visible) layout();
    },
    focus() {
      const pending = layer.querySelectorAll('.crown-zone:not([hidden]):not(.is-repaired)');
      pending.forEach((button,index) => button.style.setProperty('--pulse-delay', (120 + index * 300) + 'ms'));
      layer.classList.remove('inspecting');
      const target = layer.querySelector('.crown-wash:not([hidden])') || buttons.find(button => button.dataset.part === selected);
      target.focus({preventScroll:true});
    }
  };
}
