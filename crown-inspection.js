(() => {
  const host = document.querySelector('[data-crown-map]');
  if (!host) return;
  const overview = host.querySelector('picture');
  const portrait = matchMedia(overview.querySelector('source').media);
  const compact = matchMedia('(max-width:680px), (max-width:1023px) and (orientation:portrait)');
  const handheldLandscape = matchMedia('(orientation:landscape) and (pointer:coarse) and (max-height:550px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const assets = JSON.parse(document.getElementById('repair-assets')?.textContent || '{}');
  const parts = [
    {id:'dent', title:'Вмятина на крыле', action:'Выправить крыло', landing:'fender-landing/', approachFrames:126, returnAt:225/60},
    {id:'rust', title:'Коррозия на кромке арки', action:'Восстановить кромку', sharedClip:'rust-workshop/', approachFrames:138, returnAt:96/24,
      approach:{x:1034.5,y:669.5,wideWidth:215,phoneWidth:215,phoneRatio:1672/941}},
    {id:'bumper', title:'Трещина на бампере', action:'Восстановить бампер', siteClip:'bumper-repair/', returnAt:176/24, playbackRate:1.875,
      approach:{x:638,y:782,wideWidth:440,phoneWidth:164,phoneRatio:720/880}},
    {id:'headlamp', title:'Помутнение фары', action:'Отполировать фару', siteClip:'headlamp-repair/', returnAt:92/24,
      approach:{x:657,y:489,wideWidth:640,phoneWidth:360,phoneRatio:1}},
    {id:'hood', title:'Риски на капоте', action:'Отполировать капот', siteClip:'hood-repair/', originalPhotos:true,
      approachFrames:100, returnAt:94/24, phoneReturnAt:90/24,
      approach:{x:505,y:375,wideWidth:320,phoneWidth:150,phoneRatio:9/16,revealFrom:.68,revealBy:.94,tail:'hood-approach/'}},
    {id:'floor', title:'Коррозия днища', action:'Нанести антикор', siteClip:'floor-repair/', originalPhotos:true,
      approachFrames:109, returnAt:91/24, phoneReturnAt:89/24}
  ];
  const inspection = document.createElement('section');
  inspection.className = 'crown-inspection';
  inspection.hidden = true;
  inspection.setAttribute('aria-labelledby', 'inspection-title');
  inspection.innerHTML = `
    <div class="inspection-cut" aria-hidden="true"></div>
    <div class="inspection-flight-backdrop" aria-hidden="true"></div>
    <div class="inspection-bar"><button type="button" data-close>К автомобилю</button><button type="button" data-skip hidden>Пропустить пролёт</button></div>
    <div class="inspection-view">
      <img data-before alt=""><img data-after alt="">
    </div>
    <div class="inspection-captions">
      <span class="inspection-state" data-state></span>
      <span class="inspection-tip">Колесо или свайп по фото — ход ремонта</span>
    </div>
    <div class="inspection-panel">
      <div class="inspection-heading"><h2 id="inspection-title" tabindex="-1"></h2><span data-count role="status"></span></div>
      <label class="inspection-range">До <input type="range" min="0" max="100" step="1" value="0" aria-label="Ход ремонта"> После</label>
      <div class="inspection-actions">
        <button type="button" class="inspection-play"></button>
        <button type="button" data-result hidden>Весь Crown</button>
        <div class="inspection-nav"><button type="button" data-prev aria-label="Предыдущая деталь">Назад</button>
        <button type="button" data-next aria-label="Следующая деталь">Дальше</button></div>
      </div>
    </div>`;
  host.append(inspection);
  const find = selector => inspection.querySelector(selector);
  const title = find('h2'), view = find('.inspection-view'), slider = find('input');
  const play = find('.inspection-play'), before = find('[data-before]'), after = find('[data-after]');
  const badge = find('[data-state]'), count = find('[data-count]');
  const overviewFrame = overview.closest('.inspection-detail');
  const shade = host.querySelector(':scope > .shade');
  let overviewFalloff, detailFalloff;
  if (overviewFrame) {
    const lighting = document.createElement('div');
    lighting.className = 'inspection-lighting';
    lighting.setAttribute('aria-hidden', 'true');
    overviewFalloff = document.createElement('div');
    overviewFalloff.className = 'inspection-entry-falloff';
    detailFalloff = document.createElement('div');
    detailFalloff.className = 'inspection-detail-falloff';
    lighting.append(overviewFalloff, detailFalloff);
    inspection.append(lighting);
  }
  const progress = new Map(), completed = new Set();
  let index = 0, amount = 0, video, running = false, gesture;
  let playbackRequest = 0;
  let finaleTimer;
  const skip = find('[data-skip]'), panel = find('.inspection-panel');
  const overviewText = host.querySelectorAll('.copy,.folio,.location,.heroText,.hero-foot');
  let flight;
  let detailApproach;
  let returnAnimations = [];
  const filmedApproaches = false;
  const comparison = filmedApproaches && new URLSearchParams(location.search).get('flight') === 'compare'
    ? document.querySelector('[data-flight-comparison]') : null;
  const comparisonStatus = comparison?.querySelector('output');
  let requestedQuality;
  let hintedClip;
  function approachFile(part, quality) {
    const saved = progress.get(part.id) || 0;
    const fresh = saved === 0 && !completed.has(part.id);
    const mobile = compact.matches || handheldLandscape.matches;
    const bounds = host.getBoundingClientRect();
    const displayPixels = Math.max(bounds.width, bounds.height * 16/9) * window.devicePixelRatio;
    const uhd = quality ? quality === 'uhd' : !mobile && displayPixels > 1920;
    if (part.landing && (quality || (fresh && !reduced.matches)))
      return uhd ? 'dent-flight-4k.mp4' : mobile && !quality ? 'dent-flight-phone.mp4' : 'dent-flight.mp4';
    if (reduced.matches || (saved !== 0 && saved !== 1)) return;
    if (part.id === 'rust' && !host.classList.contains('crown-restored'))
      return part.sharedClip + (saved === 1 ? 'camera-repaired.mp4' : 'camera.mp4');
    if (part.id === 'hood' && (fresh || (saved === 1 && !host.classList.contains('crown-restored')))) {
      const lamp = completed.has('headlamp') ? 'lamp-' : '';
      return 'hood-approach/' + lamp + (saved === 1 ? 'polished-' : 'full-') + (uhd ? '4k.mp4' : 'hd.mp4');
    }
    if (part.id === 'floor') {
      if (saved === 1) return 'floor-approach/treated-reveal.mp4';
      if (fresh) return 'floor-approach/' + (completed.size ? 'floor-reveal.mp4' : 'sill-fade.mp4');
    }
  }
  function releaseHint() {
    if (!hintedClip) return;
    hintedClip.removeAttribute('src');
    hintedClip.load();
    hintedClip = undefined;
  }
  function hintApproach(event) {
    const marker = event.target.closest('.crown-zone[data-part]');
    if (!marker || !inspection.hidden || reduced.matches || navigator.connection?.saveData) return;
    const part = parts.find(item => item.id === marker.dataset.part);
    const file = part && approachFile(part);
    if (!file || hintedClip?.getAttribute('src') === host.dataset.photos + file) return;
    releaseHint();
    hintedClip = document.createElement('video');
    hintedClip.muted = hintedClip.playsInline = true;
    hintedClip.preload = 'auto';
    hintedClip.src = host.dataset.photos + file;
  }
  if (filmedApproaches) {
    for (const type of ['pointerover','focusin']) host.addEventListener(type, hintApproach);
  }
  if (comparison) {
    comparison.hidden = false;
    const switchView = comparison.querySelector('[data-show-wing]');
    const wing = comparison.querySelector('#wing-comparison');
    const pair = wing.querySelector('video');
    function showPair(open) {
      wing.hidden = !open;
      comparisonStatus.hidden = open;
      switchView.setAttribute('aria-expanded', String(open));
      if (open && !pair.hasAttribute('src')) {
        pair.preload = 'auto';
        const pairFile = compact.matches ? 'dent-flight-wing-pair-phone.mp4' : 'dent-flight-wing-pair.mp4';
        pair.src = host.dataset.photos + pairFile;
      }
      if (!open) pair.pause();
    }
    switchView.onclick = () => showPair(wing.hidden);
    if (new URLSearchParams(location.search).get('view') === 'wing') showPair(true);
    comparison.addEventListener('click', async event => {
      const button = event.target.closest('button[data-quality]');
      if (!button || flight || returnAnimations.length) return;
      showPair(false);
      if (!map.flightBounds()) {
        comparisonStatus.textContent = 'Загрузка общего плана…';
        try { await overview.querySelector('img').decode(); } catch {
          comparisonStatus.textContent = 'Не удалось загрузить общий план';
          return;
        }
        if (flight || returnAnimations.length) return;
      }
      if (!inspection.hidden) await leaveInspection();
      comparison.querySelectorAll('button').forEach(b => b.toggleAttribute('data-selected', b === button));
      requestedQuality = button.dataset.quality;
      host.querySelector('[data-part="dent"]').click();
      requestedQuality = undefined;
    });
  }
  const map = createCrownZones({
    host, image:overview.querySelector('img'), portrait, panorama:host.hasAttribute('data-panorama'), completed,
    select(id) {
      const start = map.flightBounds();
      map.show(false);
      host.classList.add('has-inspection');
      overviewText.forEach(element => { element.inert = true; });
      inspection.hidden = false;
      const next = parts.findIndex(part => part.id === id);
      const part = parts[next];
      const file = filmedApproaches && start && approachFile(part, requestedQuality);
      const usePhotoMove = !file && start && !reduced.matches && host.querySelector('#images');
      loadPart(next, Boolean(file || usePhotoMove));
      if (file) {
        enterFilm(start, requestedQuality, file);
      } else if (usePhotoMove) {
        enterDetail(id);
      } else {
        title.focus({preventScroll:true});
      }
    }
  });

  // The video and the before photograph share the same landing pose.
  // Keep one exposure on screen until the decoder presents the last frame.
  function endFlight(focusTitle = true) {
    if (detailApproach) {
      detailApproach.finish(focusTitle);
      return;
    }
    if (!flight) return;
    const focusInScene = inspection.contains(document.activeElement);
    const { clip, animations, timeout, frameId, flightPaint, resize, quality, maxInterval } = flight;
    if (quality) {
      comparison.querySelectorAll('button').forEach(b => { b.disabled = false; });
      const name = quality === 'uhd' ? '4K' : 'Full HD';
      const stats = clip.getVideoPlaybackQuality?.();
      if (clip.ended && stats?.totalVideoFrames) {
        const dropped = Math.max(0, stats.droppedVideoFrames - (flight.openingDrops || 0));
        comparisonStatus.textContent = `${name} · Пропуски ${dropped}/${flight.shotFrames || stats.totalVideoFrames}`
          + (maxInterval ? ` · Интервал до ${Math.round(maxInterval)} мс` : '');
      } else if (clip.error) {
        comparisonStatus.textContent = 'Не удалось воспроизвести ' + name;
      } else {
        comparisonStatus.textContent = name + (clip.ended ? ' · Готово' : ' · Просмотр прерван');
      }
    }
    flight.releasePanels?.();
    flight.entryMove?.cancel();
    flight.openingMoves.forEach(move => move.cancel());
    clearTimeout(flight.preloadProbe);
    flight = undefined;
    clearTimeout(timeout);
    resize.disconnect();
    if (frameId) clip.cancelVideoFrameCallback(frameId);
    cancelAnimationFrame(flightPaint);
    animations.forEach(animation => animation.cancel());
    clip.pause();
    clip.removeAttribute('src');
    clip.load();
    clip.parentElement.remove();
    inspection.classList.remove('in-flight', 'flight-playing', 'matched-flight');
    shade?.style.removeProperty('opacity');
    overviewFalloff?.style.removeProperty('opacity');
    detailFalloff?.style.removeProperty('opacity');
    panel.inert = false;
    skip.hidden = true;
    if (video) video.preload = 'auto';
    if (focusTitle && focusInScene) title.focus({preventScroll:true});
  }

  const openingDuration = 1000;
  const openingZoom = 1.06;
  function openingScaleAt(ms) {
    const t = Math.min(1, ms / openingDuration);
    return 1 + (openingZoom - 1) * t * (2 - t);
  }
  function sampleCamera(duration, pose) {
    const steps = Math.ceil(duration / 25);
    return Array.from({length:steps + 1}, (_, i) => pose(duration * i / steps));
  }
  function photoPath(zoom, through = false) {
    // The first 450 ms follow the filmed opening about the selected point.
    // Then traverse the remaining zoom in optical (log-scale) distance.
    const duration = through ? 1450 : Math.round(1350 + 500 * Math.log(zoom));
    const poses = sampleCamera(duration, ms => {
      const t = Math.max(0, (ms - 450) / (duration - 450));
      const pan = t * t * (through ? 2 - t : 3 - 2 * t);
      return {scale:openingScaleAt(ms) * (zoom / openingZoom) ** pan, pan};
    });
    return {duration, poses};
  }

  const cut = find('.inspection-cut');

  // Both directions use the same marker in the live overview. Its photo and
  // completed repairs travel together, including in the portrait crop.
  function overviewMove(id) {
    const images = host.querySelector('#images');
    const point = map.point(id);
    if (!point || !images) return;
    const scene = host.getBoundingClientRect();
    const mount = images.getBoundingClientRect();
    const scale = compact.matches ? 2.35 : 1.9;
    const dx = scene.width/2 - point.x + (1-scale)*(scene.left + point.x - mount.left);
    const dy = scene.height/2 - point.y + (1-scale)*(scene.top + point.y - mount.top);
    return {images, frames:[{transform:'none'}, {transform:`translate3d(${dx}px,${dy}px,0) scale(${scale})`}]};
  }

  async function enterDetail(id) {
    const camera = overviewMove(id);
    if (!camera) return;
    const animations = [];
    const approach = {finish,animations};
    function finish(focusTitle = true) {
      if (detailApproach !== approach) return;
      detailApproach = undefined;
      window.removeEventListener('resize', resized);
      animations.forEach(animation => animation.cancel());
      host.classList.remove('approaching-detail','revealing-detail');
      if (video?.preload === 'none') video.preload = 'auto';
      panel.inert = false;
      skip.hidden = true;
      if (focusTitle && inspection.contains(document.activeElement)) title.focus({preventScroll:true});
    }
    const resized = () => finish();
    detailApproach = approach;
    host.classList.add('approaching-detail');
    panel.inert = true;
    skip.hidden = false;
    find('[data-close]').focus({preventScroll:true});
    window.addEventListener('resize', resized, {once:true});
    const travel = camera.images.animate(camera.frames,{duration:620,easing:'cubic-bezier(.34,.05,.48,1)',fill:'both'});
    const darken = cut.animate([{opacity:0},{opacity:0,offset:.48},{opacity:1}],{duration:620,fill:'both'});
    animations.push(travel,darken);
    try {
      const photos = amount === 1 ? [after] : amount === 0 ? [before] : [before,after];
      await Promise.all([darken.finished,...photos.map(img=>img.decode().catch(()=>{}))]);
      if (detailApproach !== approach || inspection.inert) return;
      // Switch photographs only while the opaque cut covers both of them.
      host.classList.replace('approaching-detail','revealing-detail');
      travel.cancel();
      const reveal = cut.animate([{opacity:1},{opacity:0}],{duration:190,easing:'ease-out',fill:'both'});
      animations.push(reveal);
      await reveal.finished;
    } catch { /* Skip, close or resize can cancel the camera move. */ }
    if (!inspection.inert) finish();
  }

  function enterFilm(start, quality, file) {
    const part = parts[index];
    const hoodFilm = part.id === 'hood', rustFilm = part.id === 'rust', floorFilm = part.id === 'floor';
    const matchedFilm = hoodFilm || rustFilm || floorFilm;
    const overviewImages = host.querySelector('#images');
    const fromRepairedMap = floorFilm && completed.size > 0 && overviewImages;
    if (overviewFalloff) {
      // The overview's optical mask follows its photograph, including the
      // portrait crop. Register the same mask before the first video frame.
      const frame = overviewFrame.getBoundingClientRect();
      const stage = inspection.getBoundingClientRect();
      const mask = getComputedStyle(overviewFrame, '::after');
      Object.assign(overviewFalloff.style, {
        left:(frame.left - stage.left) + 'px', top:(frame.top - stage.top) + 'px',
        width:frame.width + 'px', height:frame.height + 'px',
        maskImage:mask.maskImage, maskPosition:mask.maskPosition
      });
    }
    const sourceUrl = host.dataset.photos + file;
    const warmed = hintedClip?.getAttribute('src') === sourceUrl && !hintedClip.error;
    const clip = warmed ? hintedClip : document.createElement('video');
    if (warmed) hintedClip = undefined;
    else releaseHint();
    const plane = document.createElement('div');
    plane.className = 'inspection-film-plane';
    plane.append(clip);
    clip.className = 'inspection-flight';
    clip.muted = clip.playsInline = true;
    clip.preload = 'auto';
    clip.setAttribute('aria-hidden', 'true');

    // Earlier repairs travel on their respective panels in the filmed shot.
    const visibleRepairs = (hoodFilm ? ['bumper','dent','rust']
      : rustFilm ? ['hood','bumper','headlamp','dent'] : []).filter(id => completed.has(id));
    let repairSurface, paintContext, registration, repairTracks = [];
    const panelFolder = host.dataset.photos + (hoodFilm ? 'hood-approach/' : 'rust-workshop/') + 'registered-panels/';
    if (visibleRepairs.length) {
      repairSurface = document.createElement('canvas');
      repairSurface.classList.add('camera-repairs');
      repairSurface.hidden = true;
      repairSurface.setAttribute('aria-hidden','true');
      paintContext = repairSurface.getContext('2d',{alpha:false});
    }
    async function prepareRepairs() {
      if (!paintContext) throw new Error('Camera canvas unavailable');
      const {signal} = session.panelLoad;
      const response = await fetch(panelFolder + 'frames.json', {signal});
      if (!response.ok) throw new Error('Camera tracking data unavailable');
      registration = await response.json();
      repairTracks = await Promise.all(visibleRepairs.map(async id => {
        const {pages,frames} = registration.parts[id];
        const images = await Promise.all(pages.map(async filename => {
          if (signal.aborted) throw new DOMException('Flight ended','AbortError');
          const image = new Image();
          const cancel = () => image.removeAttribute('src');
          signal.addEventListener('abort',cancel,{once:true});
          try {
            image.src = panelFolder + filename;
            await image.decode();
          } finally {
            signal.removeEventListener('abort',cancel);
          }
          return image;
        }));
        return {images,frames};
      }));
    }
    // Draw the decoded exposure and its registered repairs in a single paint.
    // Neither the CSS animation clock nor callback arrival time identifies a video frame.
    let previousPanelFrame = -1;
    function drawRepairs(time) {
      if (!repairTracks.length || clip.readyState < 2) return;
      let frame;
      if (typeof VideoFrame === 'function') {
        try { frame = new VideoFrame(clip); } catch { /* Use the presented HTML video frame. */ }
      }
      try {
        const stamp = frame ? frame.timestamp / 1e6 : time;
        const mediaTime = Math.abs(stamp-time) < .2 ? stamp : time;
        const index = Math.max(0,Math.round(mediaTime*60)-registration.lead);
        if (index === previousPanelFrame) return;
        previousPanelFrame = index;
        const visible = repairTracks.some(track=>track.frames[index]);
        if (visible) {
          if (repairSurface.width !== clip.videoWidth || repairSurface.height !== clip.videoHeight) {
            repairSurface.width = clip.videoWidth;
            repairSurface.height = clip.videoHeight;
          }
          paintContext.setTransform(1,0,0,1,0,0);
          paintContext.drawImage(frame || clip,0,0,repairSurface.width,repairSurface.height);
          paintContext.setTransform(repairSurface.width/registration.width,0,0,repairSurface.height/registration.height,0,0);
          for (const track of repairTracks) {
            const rect = track.frames[index];
            if (!rect) continue;
            const [page,sx,sy,w,h,x,y] = rect;
            paintContext.drawImage(track.images[page],sx,sy,w,h,x,y,w,h);
          }
        }
        repairSurface.hidden = !visible;
      } finally {
        frame?.close();
      }
    }

    const initial = inspection.getBoundingClientRect();
    const openingScale = overviewImages && !fromRepairedMap ? openingZoom : 1;
    const aimX = start.x + start.width * (part.approach ? part.approach.x / 1672 : floorFilm ? .66 : .554);
    const aimY = start.y + start.height * (part.approach ? part.approach.y / 941 : floorFilm ? .83 : .458);
    const landingShade = shade ? Number(getComputedStyle(shade).opacity) : 1;
    const animations = [];
    // Same integrated speed ramp as retime.py. The compositor interpolates
    // framing and lighting while the browser presents the video directly.
    const ramp = .28;
    function cameraProgress(t) {
      const edge = Math.min(t, 1 - t);
      const distance = (edge < ramp
        ? (edge - ramp / Math.PI * Math.sin(Math.PI * edge / ramp)) / 2
        : edge - ramp / 2) / (1 - ramp);
      return t <= .5 ? distance : 1 - distance;
    }
    const stops = Array.from({length:33}, (_, i) => cameraProgress(i / 32));
    let clockOrigin, presentedTime = 0, openingMs = 0, priming = false;
    function holdPose() {
      if (!clip.requestVideoFrameCallback) presentedTime = clip.currentTime * 1000;
      clockOrigin = undefined;
      animations.forEach(animation => {
        animation.pause();
        animation.currentTime = presentedTime;
      });
    }
    function runFrom(origin) {
      clockOrigin = origin;
      for (const animation of animations) animation.startTime = origin;
    }
    let lastLayout;
    function fitSurface() {
      if (!Number.isFinite(clip.duration) || !clip.videoWidth) return;
      const bounds = inspection.getBoundingClientRect(), end = view.getBoundingClientRect();
      const layout = [bounds.width,bounds.height,end.left-bounds.left,end.top-bounds.top,end.width,end.height,
        compact.matches,clip.videoWidth,clip.videoHeight,clip.duration,repairTracks.length].join('/');
      if (layout === lastLayout) return;
      lastLayout = layout;
      const sx = bounds.width / initial.width, sy = bounds.height / initial.height;
      const aspect = clip.videoWidth / clip.videoHeight;
      // A fixed-size video layer can move without rasterizing a new canvas each frame.
      const baseWidth = bounds.width;
      plane.style.width = baseWidth + 'px';
      plane.style.height = baseWidth / aspect + 'px';
      function pose(x, y, width, height) {
        const w = Math.max(width, height * aspect);
        return {left:x + (width - w) / 2, top:y + (height - w / aspect) / 2, scale:w / baseWidth};
      }
      const first = pose(start.x * sx, start.y * sy, start.width * sx, start.height * sy);
      let last = pose(end.left - bounds.left, end.top - bounds.top, end.width, end.height);
      if ((hoodFilm || floorFilm) && compact.matches) {
        // Each portrait still is registered to a central crop of the 1920px wide plate.
        const width = Math.max(end.width, end.height * 9/16) * 1920/(floorFilm ? 678.2 : 637);
        last = pose(end.left-bounds.left+(end.width-width)/2,
          end.top-bounds.top+(end.height-width/aspect)/2, width, width/aspect);
      }
      // The overview and film share a small move from the moment of input.
      // Register the end pose in that enlarged coordinate system so the
      // final video frame still coincides with the inspection photograph.
      const endScale = last.scale;
      last = {left:aimX + (last.left - aimX) / openingScale,
        top:aimY + (last.top - aimY) / openingScale, scale:last.scale / openingScale};
      animations.splice(0).forEach(animation => animation.cancel());
      // The visible take starts on its own IDR after a complete decoder
      // preroll. Also accept the earlier single held IDR and unprimed files.
      const extra = Math.round(clip.duration * 60) - part.approachFrames;
      const hasLead = extra === 12 || (extra >= 23 && extra < 30);
      const delay = hasLead ? extra * 1000 / 60 : 0;
      openingMs = delay;
      if (quality && hasLead && clip.requestVideoFrameCallback) session.shotFrames = part.approachFrames;
      priming = hasLead && presentedTime + 1 < delay;
      plane.classList.toggle('is-priming', priming);
      const duration = (clip.duration - 1/60) * 1000 - delay;
      function animateTake(element, frames, length = duration) {
        if (hasLead) {
          // Use an active opening pose so the compositor prepares its layers
          // during decoder lead-in, including the transparent landing surface.
          const timed = frames.map((frame, i) => ({
            ...frame, offset:(delay + length * (frame.offset ?? i / (frames.length - 1))) / (delay + length)
          }));
          frames = [{...frames[0], offset:0}, ...timed];
        }
        const animation = element.animate(frames, {duration:length + delay,fill:'both'});
        animation.pause();
        animations.push(animation);
      }
      function track(element, frame) {
        if (!element) return;
        if (fromRepairedMap) {
          animateTake(element, [frame(1), frame(1)]);
        } else if (floorFilm) {
          // Preserve the original 150-interval camera path up to the sill.
          // Switch to the still's exact crop during the two dark frames.
          const end = part.approachFrames - 1;
          const keys = Array.from({length:19}, (_, i) =>
            ({...frame(stops[i]), offset:150*i/(32*end)}));
          keys.push({...frame(cameraProgress(89/150)),offset:89/end},
            {...frame(1),offset:90/end}, {...frame(1),offset:1});
          animateTake(element, keys);
        } else {
          animateTake(element, stops.map(frame));
        }
      }
      const surfaceFrame = p => {
        const mix = (a, b) => a + (b - a) * p;
        const transform = `translate3d(${mix(first.left,last.left)}px,${mix(first.top,last.top)}px,0) scale(${mix(first.scale,last.scale)})`;
        if (!compact.matches || !matchedFilm) return {transform};
        const insetX = Math.max(0,(baseWidth-end.width/endScale)/2);
        const insetY = Math.max(0,(baseWidth/aspect-end.height/endScale)/2);
        return {transform,clipPath:`inset(${insetY*p}px ${insetX*p}px)`};
      };
      track(plane, surfaceFrame);
      if (hasLead && !clip.requestVideoFrameCallback) {
        const reveal = plane.animate([{opacity:.006,easing:'step-end'}, {opacity:1}],
          {duration:delay,fill:'forwards'});
        reveal.pause();
        animations.push(reveal);
      }
      track(shade, p => ({opacity:1 + (landingShade - 1) * p}));
      track(overviewFalloff, p => ({opacity:1 - p}));
      track(detailFalloff, p => ({opacity:p}));
      if (hoodFilm || floorFilm) {
        // Resolve the last few pixels of codec texture and the portrait crop
        // into the actual inspection photograph on the playback clock.
        animateTake(view, [{opacity:0}, {opacity:0,offset:1-64/duration}, {opacity:1}]);
      }
      if (!fromRepairedMap) {
        const backdrop = find('.inspection-flight-backdrop');
        if (matchedFilm && compact.matches)
          track(backdrop, p => ({opacity:Math.min(1,p/.8)}));
        else
          animateTake(backdrop, [{opacity:0,easing:'ease'}, {opacity:1}], 220);
      }
      if (clockOrigin !== undefined) runFrom(clockOrigin);
      else holdPose();
    }
    const resize = new ResizeObserver(fitSurface);
    const session = {clip, animations, resize, quality, openingMoves:[], frameId:0, timeout:0, lastPaint:0, maxInterval:0};
    if (repairSurface) {
      session.panelLoad = new AbortController();
      session.releasePanels = () => {
        session.panelLoad.abort();
        repairTracks = [];
        repairSurface.width = repairSurface.height = 1;
      };
    }
    if (shade) shade.style.opacity = '1';
    if (quality) {
      comparisonStatus.textContent = quality === 'uhd' ? 'Загрузка 4K…' : 'Загрузка Full HD…';
      comparison.querySelectorAll('button').forEach(b => { b.disabled = true; });
    }
    flight = session;
    const finish = () => { if (flight === session) endFlight(); };
    session.timeout = setTimeout(finish, 30000);
    inspection.classList.add('in-flight');
    inspection.classList.toggle('matched-flight', matchedFilm);
    panel.inert = true;
    skip.hidden = false;
    find('[data-close]').focus({preventScroll:true});
    if (repairSurface) plane.append(repairSurface);
    inspection.insertBefore(plane, view);
    if (openingScale > 1) {
      const scales = sampleCamera(openingDuration, openingScaleAt);
      for (const el of [overviewImages, plane, overviewFalloff].filter(Boolean)) {
        const box = el.getBoundingClientRect();
        const x = aimX + initial.left - box.left;
        const y = aimY + initial.top - box.top;
        // The plane's transform is already driven by the film's frame clock.
        const frames = scales.map(scale => {
          const dx = x*(1-scale), dy = y*(1-scale);
          return el === plane ? {translate:dx+'px '+dy+'px',scale}
            : {transformOrigin:'0 0',transform:`translate3d(${dx}px,${dy}px,0) scale(${scale})`};
        });
        session.openingMoves.push(el.animate(frames,{duration:openingDuration,fill:'both'}));
      }
    }
    if (fromRepairedMap) {
      // Carry all visible repairs into the shadow at the sill. The reveal
      // starts from the same dark colour on the stationary inspection photo.
      const rect = overviewImages.getBoundingClientRect();
      const bounds = inspection.getBoundingClientRect();
      const zoom = 3.2;
      const x = bounds.left + start.x + start.width*.66 - rect.left;
      const y = bounds.top + start.y + start.height*.83 - rect.top;
      const path = photoPath(zoom, true);
      const panX = bounds.left + bounds.width*.5 - rect.left - x;
      const panY = bounds.top + bounds.height*.55 - rect.top - y;
      session.entryMove = overviewImages.animate(path.poses.map(({scale,pan}) => ({
        transformOrigin:'0 0',
        transform:`translate3d(${x*(1-scale) + pan*panX}px,${y*(1-scale) + pan*panY}px,0) scale(${scale})`
      })), {duration:path.duration,fill:'both'});
      session.openingMoves.push(find('.inspection-flight-backdrop').animate([
        {opacity:0}, {opacity:0,offset:1-200/path.duration}, {opacity:1}
      ], {duration:path.duration,fill:'both'}));
      session.entryReady = session.entryMove.finished.then(() => true, () => false);
    }
    resize.observe(inspection);
    clip.onloadedmetadata = fitSurface;
    function showOpening() {
      if (flight !== session || clip.readyState < 2 || (repairSurface && !repairTracks.length) || (fromRepairedMap && !session.entryDone)) return;
      fitSurface();
      drawRepairs(clip.currentTime);
      plane.classList.add('is-ready');
    }
    clip.onloadeddata = showOpening;
    clip.onpause = () => { if (flight === session) holdPose(); };
    function presented(now, frame) {
      if (flight !== session) return;
      presentedTime = frame.mediaTime * 1000;
      drawRepairs(frame.mediaTime);
      if (priming && presentedTime + 1 >= openingMs) {
        priming = false;
        plane.classList.remove('is-priming');
      } else if (priming && quality) session.openingDrops = clip.getVideoPlaybackQuality?.().droppedVideoFrames || 0;
      if (!clip.paused && !inspection.inert && presentedTime > 0) {
        // Anchor every moving layer to the same displayed video frame. Leave
        // the compositor running between frames, including on high-Hz screens.
        const origin = frame.expectedDisplayTime - presentedTime;
        if (clockOrigin === undefined || Math.abs(origin - clockOrigin) > 32) runFrom(origin);
        if (presentedTime + 1 >= openingMs) {
          if (session.lastPaint) session.maxInterval = Math.max(session.maxInterval, now - session.lastPaint);
          session.lastPaint = now;
        }
      }
      session.frameId = clip.requestVideoFrameCallback(presented);
    }
    clip.onwaiting = () => {
      if (flight !== session || inspection.inert) return;
      clearTimeout(session.timeout);
      holdPose();
      session.timeout = setTimeout(finish, 30000);
    };
    clip.onplaying = () => {
      if (flight !== session || inspection.inert) return;
      inspection.classList.add('flight-playing');
      clearTimeout(session.timeout);
      session.timeout = setTimeout(finish, (clip.duration - clip.currentTime + 3) * 1000);
      if (clockOrigin === undefined) runFrom(document.timeline.currentTime - clip.currentTime * 1000);
      if (quality) comparisonStatus.textContent = quality === 'uhd' ? 'Идёт пролёт в 4K' : 'Идёт пролёт в Full HD';
    };
    clip.onended = () => {
      if (flight !== session) return;
      finish();
      if (matchedFilm && !reduced.matches) {
        for (const element of [panel, find('.inspection-captions')])
          element.animate([{opacity:0}, {opacity:1}], {duration:150, easing:'ease-out'});
      }
    };
    let started = false;
    let canRetryHD = file.endsWith('4k.mp4') && !quality;
    function playbackError() {
      if (flight !== session || inspection.inert) return;
      if (!canRetryHD || presentedTime > 0) { finish(); return; }
      canRetryHD = false;
      if (session.frameId) clip.cancelVideoFrameCallback(session.frameId);
      session.frameId = 0;
      started = false;
      inspection.classList.remove('flight-playing');
      plane.classList.remove('is-ready');
      clip.src = host.dataset.photos + (hoodFilm ? file.replace('4k.mp4','hd.mp4') : 'dent-flight.mp4');
      probePreload();
    }
    clip.onerror = playbackError;
    // Decode the landing photo and prepare the tracked panels concurrently
    // with media loading, before the camera starts moving.
    const prepared = Promise.all([
      (amount === 1 ? after : before).decode().catch(() => {}),
      repairSurface ? prepareRepairs() : undefined
    ]).then(() => true, () => false);
    async function startPlayback() {
      if (started || flight !== session || inspection.inert) return;
      started = true;
      const source = clip.src;
      if (!await prepared) { finish(); return; }
      if (flight !== session || source !== clip.src || inspection.inert) return;
      showOpening();
      if (session.entryReady) {
        if (!await session.entryReady || flight !== session || inspection.inert) return;
        session.entryDone = true;
        showOpening();
      }
      if (clip.readyState >= 2) {
        inspection.classList.add('flight-playing');
        // Commit the landing photograph, light masks and video layer before
        // the decoder starts advancing the camera.
        await new Promise(requestAnimationFrame);
        if (flight !== session || source !== clip.src || inspection.inert) return;
      }
      if (clip.requestVideoFrameCallback) session.frameId = clip.requestVideoFrameCallback(presented);
      else if (repairSurface) {
        const repaint = () => {
          if (flight !== session) return;
          drawRepairs(clip.currentTime);
          session.flightPaint = requestAnimationFrame(repaint);
        };
        session.flightPaint = requestAnimationFrame(repaint);
      }
      clip.play().catch(() => { if (source === clip.src) playbackError(); });
    }
    function startWhenBuffered() {
      if (flight !== session || started) return;
      if (clip.buffered.length && clip.buffered.start(0) < .05 &&
          clip.buffered.end(0) >= clip.duration - 1/60) startPlayback();
    }
    clip.oncanplaythrough = startWhenBuffered;
    clip.onprogress = () => {
      if (flight !== session || started || inspection.inert) return;
      clearTimeout(session.timeout);
      session.timeout = setTimeout(finish, 30000);
      startWhenBuffered();
    };
    // Some mobile browsers suspend preload until play(). A slow active
    // transfer, on the other hand, needs its uninterrupted playback buffer.
    function probePreload() {
      if (started || flight !== session) return;
      clearTimeout(session.preloadProbe);
      session.preloadProbe = setTimeout(() => {
        if (clip.networkState !== clip.NETWORK_LOADING) startPlayback();
      }, 350);
    }
    clip.onsuspend = probePreload;
    clip.onstalled = () => {
      if (!clip.buffered.length && clip.readyState < clip.HAVE_CURRENT_DATA) startPlayback();
    };
    if (!warmed) clip.src = sourceUrl;
    else {
      showOpening();
      startWhenBuffered();
    }
    if (hoodFilm && video) {
      // Prepare the repair player's first frame alongside the approach's
      // opening pose, before the visitor can press the repair button.
      video.preload = 'metadata';
      if (!completed.has('hood')) map.prepareRepair(part);
    }
    probePreload();
  }
  skip.onclick = () => endFlight();

  function stop() {
    ++playbackRequest;
    running = false;
    video?.pause();
  }

  function paint(value) {
    if (inspection.classList.contains('inspection-finished')) return;
    amount = Math.max(0, Math.min(1, value));
    const part = parts[index];
    progress.set(part.id, amount);
    if (amount > 0 && !completed.has(part.id)) map.prepareRepair(part);
    if (amount === 1 && !completed.has(part.id)) {
      completed.add(part.id);
      map.repair(part);
      if (completed.size === parts.length - 1) map.prepareFinish();
      if (completed.size === parts.length) {
        map.unlockWash();
        // Leave a moment to see the final repaired detail before showing the whole car.
        finaleTimer = window.setTimeout(leaveInspection, reduced.matches ? 0 : 650);
      }
    }
    find('[data-result]').hidden = !host.classList.contains('crown-restored');
    const percent = amount === 1 ? 100 : Math.min(99, Math.round(amount * 100));
    slider.value = String(percent);
    slider.setAttribute('aria-valuetext', percent + '%');
    after.style.opacity = part.landing && video && !video.error
      ? String(Number(amount === 1))
      : String(amount);
    const startingRepair = part.returnAt != null && running && video && (!video.paused || part.id === 'hood');
    const hasFrame = video && video.readyState >= 2 && (amount > 0 || startingRepair) && amount < 1;
    if (video) {
      // Keep the decoded hood frame mounted behind its full-resolution still.
      // On play the same video surface can come forward immediately.
      const primed = part.id === 'hood' && !running && video.readyState >= 2
        && (amount === 0 || amount === 1) && video.currentTime === 0;
      video.classList.toggle('hood-at-start', primed);
      video.hidden = !hasFrame && !primed;
    }
    badge.textContent = amount === 0 ? 'До ремонта' : amount === 1 ? 'После ремонта' : 'В процессе';
    play.textContent = running ? 'Пауза' : amount === 1 ? (reduced.matches || video?.error ? 'Показать до' : 'Повторить ремонт') : part.action;
    count.textContent = 'Восстановлено ' + completed.size + ' из ' + parts.length;
  }

  function seek(value) {
    stop();
    paint(value);
    if (Number.isFinite(video?.duration) && video.currentTime !== amount * video.duration)
      video.currentTime = amount * video.duration;
    if (amount === 1 && parts[index].returnAt != null) leaveInspection();
  }

  function loadPart(next, approaching = false) {
    if (detailApproach) endFlight(false);
    clearTimeout(finaleTimer);
    stop();
    inspection.classList.remove('inspection-finished');
    gesture = null;
    releaseRepairVideo();
    index = (next + parts.length) % parts.length;
    const part = parts[index];
    const format = compact.matches ? 'phone' : 'desktop';
    host.classList.toggle('inspecting-fender', part.id === 'dent');
    inspection.classList.toggle('inspecting-headlamp', part.id === 'headlamp');
    inspection.classList.toggle('inspecting-floor', part.id === 'floor');
    const suffix = compact.matches ? '.webp' : '-wide.webp';
    const base = host.dataset.photos + format + '/' + part.id;
    // Both viewport crops use the same landing plate as the last flight frame.
    const landing = part.landing && host.dataset.photos + part.landing;
    const clipPhotos = part.siteClip && !part.originalPhotos && host.dataset.photos + part.siteClip + format + '-';
    const photoPrefix = landing || clipPhotos || (part.sharedClip && host.dataset.photos + part.sharedClip);
    before.src = photoPrefix ? photoPrefix + 'before.webp' : base + '-before' + suffix;
    after.src = photoPrefix ? photoPrefix + 'after.webp' : base + '-after' + suffix;
    title.textContent = part.title;
    if (reduced.matches) {
      paint(progress.get(part.id) || 0);
      return;
    }
    const player = document.createElement('video');
    player.playsInline = player.muted = true;
    player.preload = approaching ? 'none' : 'auto';
    player.hidden = true;
    player.setAttribute('aria-hidden','true');
    video = player;
    // The wiping hand clears the portrait crop before it leaves the wide shot.
    const returnAt = (format === 'phone' ? part.phoneReturnAt : null) ?? part.returnAt ?? Infinity;
    let exitWatch;
    function pullBack(time) {
      if (player !== video || !running || time < returnAt) return false;
      running = false;
      paint(1);
      // Carry the actual video frame into the camera move.
      player.hidden = false;
      leaveInspection(player);
      return true;
    }
    function watchExit(_, frame) {
      exitWatch = undefined;
      if (player === video && running && !pullBack(frame.mediaTime)) {
        exitWatch = player.requestVideoFrameCallback(watchExit);
      }
    }
    player.addEventListener('playing', () => {
      if (Number.isFinite(returnAt) && player === video && running) {
        paint(amount);
        if (player.requestVideoFrameCallback && exitWatch === undefined)
          exitWatch = player.requestVideoFrameCallback(watchExit);
      }
    });
    player.addEventListener('pause', () => {
      if (exitWatch !== undefined) player.cancelVideoFrameCallback(exitWatch);
      exitWatch = undefined;
    });
    player.addEventListener('loadedmetadata', () => {
      if (player !== video) return;
      player.playbackRate = part.playbackRate ?? (part.siteClip || part.sharedClip ? 1 : player.duration / (part.seconds || 4));
      // The hood's finished photograph covers the player on a revisit.
      // Leave its decoder at the opening frame, ready for replay.
      if (!running && !(part.id === 'hood' && (amount === 0 || amount === 1)))
        player.currentTime = amount * player.duration;
    });
    player.addEventListener('seeked', () => { if (player === video && !running) paint(amount); });
    if (part.id === 'hood') player.addEventListener('loadeddata', () => {
      if (player === video && !running) paint(amount);
    }, {once:true});
    player.addEventListener('timeupdate', () => {
      if (!player.requestVideoFrameCallback && pullBack(player.currentTime)) return;
      if (player === video && running && player.duration && !(Number.isFinite(returnAt) && player.ended))
        paint(player.currentTime / player.duration);
    });
    player.addEventListener('ended', () => {
      if (player !== video || !running) return;
      if (pullBack(player.duration)) return;
      running = false;
      paint(1);
    });
    player.addEventListener('error', () => {
      if (player !== video) return;
      const finish = running;
      stop();
      paint(finish ? 1 : amount);
    });
    view.append(player);
    if (landing) {
      const phone = compact.matches || handheldLandscape.matches;
      player.src = landing + (phone ? 'repair-plate-hd.mp4' : 'repair-plate-qhd.mp4');
    } else if (part.sharedClip) {
      player.src = host.dataset.photos + part.sharedClip + 'repair-master.mp4';
    } else if (part.siteClip) {
      player.src = host.dataset.photos + part.siteClip + format + '.mp4';
    } else {
      const clip = part.clip + '-' + format + '.mp4';
      player.src = assets['morph/' + clip] || host.dataset.clips + clip;
    }
    paint(progress.get(part.id) || 0);
  }

  play.onclick = async () => {
    if (running) { stop(); paint(amount); return; }
    if (reduced.matches || video.error) { seek(amount === 1 ? 0 : 1); return; }
    if (amount === 1) seek(0);
    const request = ++playbackRequest;
    running = true;
    paint(amount);
    try { await video.play(); }
    catch { if (request === playbackRequest) { stop(); paint(1); } }
  };
  slider.oninput = () => seek(Number(slider.value) / 100);
  find('[data-prev]').onclick = () => loadPart(index - 1);
  find('[data-next]').onclick = () => loadPart(index + 1);
  find('[data-result]').onclick = () => {
    clearTimeout(finaleTimer);
    stop();
    gesture = null;
    inspection.classList.add('inspection-finished');
    const photo = (compact.matches ? 'phone/' : 'desktop/') + 'overview-polished-lamp.webp';
    before.src = host.dataset.photos + photo;
    after.style.opacity = '0';
    if (video) video.hidden = true;
    badge.textContent = 'После ремонта';
    title.textContent = 'Crown восстановлен';
    title.focus({preventScroll:true});
  };
  function releaseRepairVideo() {
    const old = video;
    if (!old) return;
    video = undefined;
    old.pause();
    old.remove();
    old.removeAttribute('src');
    old.load();
  }
  async function leaveInspection(playingExit) {
    if (returnAnimations.length || inspection.hidden) return;
    clearTimeout(finaleTimer);
    const keepPlaying = playingExit && playingExit === video;
    if (!keepPlaying) stop();
    if (video?.hidden) releaseRepairVideo();
    gesture = null;
    if (!reduced.matches) {
      inspection.inert = true;
      host.classList.add('returning-to-map');
      if (detailApproach && host.classList.contains('approaching-detail')) {
        // An early close retraces only the distance the camera has travelled.
        returnAnimations = detailApproach.animations.slice();
        for (const animation of returnAnimations) {
          animation.playbackRate = -1.5;
          animation.play();
        }
        await Promise.allSettled(returnAnimations.map(animation=>animation.finished));
      } else {
        const initialShade = Number(getComputedStyle(cut).opacity);
        if (detailApproach) detailApproach.finish(false);
        const camera = overviewMove(parts[index].id);
        const darken = cut.animate([{opacity:initialShade},{opacity:1}],{duration:110,fill:'both'});
        returnAnimations.push(darken);
        await darken.finished.catch(()=>{});
        if (flight) endFlight(false);
        host.classList.add('approaching-detail');
        const duration = reduced.matches ? 0 : 480;
        if (camera) returnAnimations.push(camera.images.animate(camera.frames,{
          duration,direction:'reverse',easing:'cubic-bezier(.35,0,.52,1)',fill:'both'
        }));
        const reveal = cut.animate([{opacity:1},{opacity:0,offset:.58},{opacity:0}],{duration,fill:'both'});
        returnAnimations.push(reveal);
        await reveal.finished.catch(()=>{});
      }
    }
    returnAnimations.forEach(animation => animation.cancel());
    returnAnimations = [];
    host.classList.remove('returning-to-map','approaching-detail','revealing-detail');
    inspection.inert = false;
    releaseRepairVideo();
    endFlight(false);
    inspection.hidden = true;
    host.classList.remove('has-inspection', 'inspecting-fender');
    overviewText.forEach(element => { element.inert = false; });
    map.show(true);
    map.focus();
    if (!reduced.matches) {
      for (const el of [...overviewText, host.querySelector('.crown-zones')]) {
        el?.animate([{opacity:0},{opacity:1}], {duration:130,easing:'ease-out'});
      }
    }
  }
  find('[data-close]').onclick = leaveInspection;
  inspection.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    leaveInspection();
  });
  compact.addEventListener('change', () => {
    if (returnAnimations.length) { returnAnimations.forEach(animation => animation.finish()); return; }
    if (inspection.hidden) return;
    endFlight();
    if (inspection.classList.contains('inspection-finished')) find('[data-result]').click();
    else loadPart(index);
  });
  reduced.addEventListener('change', () => {
    if (returnAnimations.length) { returnAnimations.forEach(animation => animation.finish()); return; }
    endFlight();
    if (!inspection.hidden && !inspection.classList.contains('inspection-finished')) loadPart(index);
  });
  view.addEventListener('wheel', event => {
    if (event.ctrlKey || inspection.classList.contains('inspection-finished')) return;
    event.preventDefault();
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.clientHeight : 1;
    seek(amount + event.deltaY * scale / Math.max(500, view.clientHeight));
  }, {passive:false});
  view.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || inspection.classList.contains('inspection-finished')) return;
    gesture = {id:event.pointerId, x:event.clientX, y:event.clientY, start:amount};
    view.setPointerCapture(event.pointerId);
  });
  view.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = gesture.x - event.clientX, dy = gesture.y - event.clientY;
    const delta = Math.abs(dx) > Math.abs(dy) ? dx / view.clientWidth : dy / view.clientHeight;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 4) seek(gesture.start + delta * 1.5);
  });
  view.addEventListener('lostpointercapture', () => { gesture = null; });
})();
