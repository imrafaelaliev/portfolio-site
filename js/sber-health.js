(() => {
  const phone = document.querySelector('[data-phone-screen]');
  const designStage = document.querySelector('[data-design-stage]');
  const permissionPanel = document.querySelector('[data-motion-permission]');
  const enableMotionButton = document.querySelector('[data-enable-motion]');
  const motionText = document.querySelector('[data-motion-text]');
  const motionActivation = document.querySelector('[data-motion-activation]');
  const demoToggle = document.querySelector('[data-demo-toggle]');
  const status = document.querySelector('[data-status]');

  if (
    !phone ||
    !designStage ||
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
  const isTouchDevice = navigator.maxTouchPoints > 0;
  const needsMotionPermission =
    supportsMotion && typeof window.DeviceMotionEvent.requestPermission === 'function';
  const requiredShakePeaks = 3;
  const shakePeakWindow = 620;
  const minimumPeakGap = 90;
  const summaryGenerationDuration = 5600;

  let viewportUpdateFrame = 0;
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

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  const syncViewport = () => {
    window.cancelAnimationFrame(viewportUpdateFrame);
    viewportUpdateFrame = window.requestAnimationFrame(() => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty(
        '--app-height',
        `${Math.max(1, Math.round(viewportHeight))}px`
      );

      const phoneWidth = phone.clientWidth || phone.getBoundingClientRect().width;
      const phoneHeight = phone.clientHeight || phone.getBoundingClientRect().height;
      const screenScale = phoneWidth / 402;
      const visibleDesignHeight = phoneHeight / screenScale;
      const heightDeficit = clamp(874 - visibleDesignHeight, 0, 240);
      const layoutCardScale = 1 - Math.min(0.25, heightDeficit * 0.0012);
      const shakeTop = Math.max(440, Math.min(650, visibleDesignHeight - 224));

      phone.style.setProperty('--screen-scale', screenScale.toFixed(6));
      phone.style.setProperty('--design-height', `${visibleDesignHeight.toFixed(2)}px`);
      phone.style.setProperty('--title-top', `${(124 - heightDeficit * 0.1).toFixed(2)}px`);
      phone.style.setProperty(
        '--title-size',
        `${(36 - Math.min(4, heightDeficit * 0.02)).toFixed(2)}px`
      );
      phone.style.setProperty('--lab-top', `${(219 - heightDeficit * 0.25).toFixed(2)}px`);
      phone.style.setProperty('--avatar-top', `${(231.4 - heightDeficit * 0.25).toFixed(2)}px`);
      phone.style.setProperty(
        '--relatives-top',
        `${(325 - heightDeficit * 0.35).toFixed(2)}px`
      );
      phone.style.setProperty('--doctor-top', `${(435.4 - heightDeficit * 0.7).toFixed(2)}px`);
      phone.style.setProperty('--shake-top', `${shakeTop.toFixed(2)}px`);
      phone.style.setProperty('--layout-card-scale', layoutCardScale.toFixed(3));
      phone.style.setProperty('--avatar-layout-scale', layoutCardScale.toFixed(3));
    });
  };

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
    phone.classList.remove('is-generating', 'is-shaking');
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

    if (!isTouchDevice) return;
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
    if (isRequestingPermission) return;

    isRequestingPermission = true;
    enableMotionButton.disabled = true;
    enableMotionButton.textContent = 'Подключаю…';

    try {
      if (!hasSecureMotionContext) throw new Error('Secure context required');

      if (needsMotionPermission) {
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

  window.addEventListener('resize', syncViewport, { passive: true });
  window.addEventListener('orientationchange', syncViewport, { passive: true });
  window.visualViewport?.addEventListener('resize', syncViewport, { passive: true });
  window.visualViewport?.addEventListener('scroll', syncViewport, { passive: true });

  syncViewport();

  if (!hasSecureMotionContext && supportsMotion) {
    motionText.textContent = 'Для встряхивания нужна защищённая HTTPS-ссылка.';
    enableMotionButton.textContent = 'Нужна HTTPS-ссылка';
    permissionPanel.hidden = false;
  } else if (needsMotionPermission) {
    permissionPanel.hidden = true;
    motionActivation.hidden = false;
  } else if (supportsMotion) {
    motionActivation.hidden = true;
    startListening();
  }
})();
