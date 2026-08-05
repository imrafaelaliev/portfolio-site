(() => {
  let viewportUpdateFrame = 0;

  const syncViewportHeight = () => {
    window.cancelAnimationFrame(viewportUpdateFrame);
    viewportUpdateFrame = window.requestAnimationFrame(() => {
      const viewport = window.visualViewport;
      const measuredHeight = viewport
        ? viewport.height * viewport.scale
        : window.innerHeight;
      const safeHeight = Math.max(320, Math.round(measuredHeight));
      document.documentElement.style.setProperty('--app-height', `${safeHeight}px`);
    });
  };

  syncViewportHeight();
  window.addEventListener('resize', syncViewportHeight, { passive: true });
  window.addEventListener('orientationchange', syncViewportHeight, { passive: true });
  window.visualViewport?.addEventListener('resize', syncViewportHeight, { passive: true });
  window.visualViewport?.addEventListener('scroll', syncViewportHeight, { passive: true });

  const phone = document.querySelector('[data-phone-screen]');
  const permissionPanel = document.querySelector('[data-motion-permission]');
  const enableMotionButton = document.querySelector('[data-enable-motion]');
  const motionText = document.querySelector('[data-motion-text]');
  const motionActivation = document.querySelector('[data-motion-activation]');
  const demoToggle = document.querySelector('[data-demo-toggle]');
  const status = document.querySelector('[data-status]');

  if (
    !phone ||
    !permissionPanel ||
    !enableMotionButton ||
    !motionText ||
    !motionActivation ||
    !demoToggle ||
    !status
  ) return;

  const supportsMotion = 'DeviceMotionEvent' in window;
  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const hasSecureMotionContext = window.isSecureContext || isLocalhost;
  const needsPermission =
    supportsMotion && typeof window.DeviceMotionEvent.requestPermission === 'function';
  const requiredShakePeaks = 3;
  const shakePeakWindow = 620;
  const minimumPeakGap = 90;
  const summaryGenerationDuration = 5600;

  let isSummaryVisible = false;
  let isListening = false;
  let isRequestingPermission = false;
  let statusTimer = 0;
  let generationTimer = 0;
  let lastMotion = null;
  let lastPeakAt = 0;
  let peakCount = 0;
  let transitionLockedUntil = 0;
  let motionEventSeen = false;
  let motionCheckTimer = 0;

  const showStatus = (message) => {
    window.clearTimeout(statusTimer);
    status.textContent = message;
    status.classList.add('is-visible');
    statusTimer = window.setTimeout(() => status.classList.remove('is-visible'), 1800);
  };

  const setSummary = (nextValue, source = 'demo') => {
    const now = Date.now();
    if (now < transitionLockedUntil) return;

    transitionLockedUntil = now + 900;
    isSummaryVisible = nextValue;
    window.clearTimeout(generationTimer);
    phone.classList.remove('is-generating');
    phone.classList.remove('is-shaking');
    void phone.offsetWidth;

    if (isSummaryVisible) {
      phone.classList.add('is-generating');
      generationTimer = window.setTimeout(() => {
        phone.classList.remove('is-generating');
        if (source === 'shake') showStatus('Сводка готова');
      }, summaryGenerationDuration);
    }

    phone.classList.toggle('is-summary', isSummaryVisible);
    phone.classList.add('is-shaking');

    demoToggle.textContent = isSummaryVisible ? 'Вернуть главный экран' : 'Показать сводку';
    demoToggle.setAttribute(
      'aria-label',
      isSummaryVisible ? 'Вернуть главный экран' : 'Показать экран сводки'
    );

    if (source === 'shake') {
      showStatus(isSummaryVisible ? 'ИИ-помощник формирует сводку…' : 'Главный экран');
    }

    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate([35, 30, 35]);
    }
  };

  const registerPeak = (now) => {
    if (now - lastPeakAt < minimumPeakGap) return;
    if (now - lastPeakAt > shakePeakWindow) peakCount = 0;

    peakCount += 1;
    lastPeakAt = now;

    if (peakCount >= requiredShakePeaks) {
      peakCount = 0;
      setSummary(!isSummaryVisible, 'shake');
    }
  };

  const onDeviceMotion = (event) => {
    motionEventSeen = true;
    window.clearTimeout(motionCheckTimer);

    const linearAcceleration = event.acceleration;
    const hasLinearValues =
      linearAcceleration &&
      [linearAcceleration.x, linearAcceleration.y, linearAcceleration.z].some(Number.isFinite);
    const acceleration = hasLinearValues
      ? linearAcceleration
      : event.accelerationIncludingGravity;
    if (!acceleration) return;

    const x = Number(acceleration.x) || 0;
    const y = Number(acceleration.y) || 0;
    const z = Number(acceleration.z) || 0;
    const now = event.timeStamp || performance.now();

    if (!lastMotion) {
      lastMotion = { x, y, z, time: now };
      return;
    }

    const elapsed = Math.max(now - lastMotion.time, 12);
    const delta = Math.abs(x - lastMotion.x) + Math.abs(y - lastMotion.y) + Math.abs(z - lastMotion.z);
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const intensity = (delta / elapsed) * 1000;

    lastMotion = { x, y, z, time: now };

    if (magnitude > 19 || intensity > 82) registerPeak(Date.now());
  };

  const startListening = () => {
    if (isListening || !supportsMotion) return;
    window.addEventListener('devicemotion', onDeviceMotion, { passive: true });
    isListening = true;

    window.clearTimeout(motionCheckTimer);
    motionCheckTimer = window.setTimeout(() => {
      if (motionEventSeen) return;
      motionText.textContent = 'Датчик движения не отвечает. Нажми кнопку и разреши доступ.';
      enableMotionButton.textContent = 'Подключить датчик';
      enableMotionButton.disabled = false;
      permissionPanel.hidden = false;
    }, 2200);
  };

  const requestMotionPermission = async () => {
    if (isListening || isRequestingPermission) return;

    isRequestingPermission = true;
    enableMotionButton.disabled = true;
    enableMotionButton.textContent = 'Подключаю…';

    try {
      if (!hasSecureMotionContext) throw new Error('Secure context required');

      if (needsPermission) {
        const permission = await window.DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') throw new Error('Motion permission denied');
      }

      permissionPanel.hidden = true;
      motionActivation.hidden = true;
      startListening();
      showStatus('Готово — встряхни телефон');
    } catch (error) {
      enableMotionButton.disabled = false;
      enableMotionButton.textContent = 'Попробовать ещё раз';
      if (!hasSecureMotionContext) {
        motionText.textContent = 'Для встряхивания нужна защищённая HTTPS-ссылка.';
        enableMotionButton.textContent = 'Нужна HTTPS-ссылка';
      }
      motionActivation.hidden = true;
      permissionPanel.hidden = false;
      showStatus('Датчик движения не подключён');
    } finally {
      isRequestingPermission = false;
    }
  };

  enableMotionButton.addEventListener('click', requestMotionPermission);
  motionActivation.addEventListener('click', requestMotionPermission);
  demoToggle.addEventListener('click', () => setSummary(!isSummaryVisible));

  if (!hasSecureMotionContext && supportsMotion) {
    motionText.textContent = 'Для встряхивания нужна защищённая HTTPS-ссылка.';
    enableMotionButton.textContent = 'Нужна HTTPS-ссылка';
    permissionPanel.hidden = false;
  } else if (needsPermission) {
    permissionPanel.hidden = true;
    motionActivation.hidden = false;
  } else if (supportsMotion) {
    motionActivation.hidden = true;
    startListening();
  }
})();
