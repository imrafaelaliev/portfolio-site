(() => {
  const phone = document.querySelector('[data-phone-screen]');
  const designStage = document.querySelector('[data-design-stage]');
  const permissionPanel = document.querySelector('[data-motion-permission]');
  const enableMotionButton = document.querySelector('[data-enable-motion]');
  const motionText = document.querySelector('[data-motion-text]');
  const motionActivation = document.querySelector('[data-motion-activation]');
  const demoToggle = document.querySelector('[data-demo-toggle]');
  const status = document.querySelector('[data-status]');
  const tiltCards = [...document.querySelectorAll('[data-tilt-card]')];
  const tiltAvatar = document.querySelector('[data-tilt-avatar]');

  if (
    !phone ||
    !designStage ||
    !permissionPanel ||
    !enableMotionButton ||
    !motionText ||
    !motionActivation ||
    !demoToggle ||
    !status ||
    !tiltCards.length ||
    !tiltAvatar
  ) return;

  const supportsMotion = 'DeviceMotionEvent' in window;
  const supportsOrientation = 'DeviceOrientationEvent' in window;
  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const hasSecureSensorContext = window.isSecureContext || isLocalhost;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isTouchDevice = navigator.maxTouchPoints > 0;
  const needsMotionPermission =
    supportsMotion && typeof window.DeviceMotionEvent.requestPermission === 'function';
  const wantsOrientation = supportsOrientation && !prefersReducedMotion;
  const needsOrientationPermission =
    wantsOrientation && typeof window.DeviceOrientationEvent.requestPermission === 'function';
  const needsSensorPermission = needsMotionPermission || needsOrientationPermission;
  const requiredShakePeaks = 3;
  const shakePeakWindow = 620;
  const minimumPeakGap = 90;
  const summaryGenerationDuration = 5600;
  const cardProfiles = {
    lab: { moveX: 3.2, moveY: 2.4, rotateX: 3, rotateY: 3.4, depth: 8 },
    relatives: { moveX: 5.2, moveY: 3.8, rotateX: 4, rotateY: 4.5, depth: 14 },
    doctor: { moveX: 6.4, moveY: 4.6, rotateX: 4.6, rotateY: 5, depth: 18 },
  };

  let viewportUpdateFrame = 0;
  let isSummaryVisible = false;
  let isListening = false;
  let isOrientationListening = false;
  let isRequestingPermission = false;
  let statusTimer = 0;
  let generationTimer = 0;
  let lastMotion = null;
  let lastPeakAt = 0;
  let peakCount = 0;
  let transitionLockedUntil = 0;
  let motionEventSeen = false;
  let motionCheckTimer = 0;
  let orientationBaseline = null;
  let tiltFrame = 0;
  let tiltX = 0;
  let tiltY = 0;
  let tiltTargetX = 0;
  let tiltTargetY = 0;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  const syncViewport = () => {
    window.cancelAnimationFrame(viewportUpdateFrame);
    viewportUpdateFrame = window.requestAnimationFrame(() => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty(
        '--app-height',
        `${Math.max(1, Math.round(viewportHeight))}px`
      );

      const phoneWidth = phone.getBoundingClientRect().width;
      phone.style.setProperty('--screen-scale', (phoneWidth / 402).toFixed(6));
    });
  };

  const setCardProperty = (card, property, value, unit) => {
    card.style.setProperty(property, `${value.toFixed(2)}${unit}`);
  };

  const applyTilt = () => {
    tiltFrame = 0;
    tiltX += (tiltTargetX - tiltX) * 0.18;
    tiltY += (tiltTargetY - tiltY) * 0.18;

    const activity = Math.min(1, Math.hypot(tiltX, tiltY));
    const shineX = clamp(50 - tiltX * 34, 14, 86);
    const shineY = clamp(42 - tiltY * 30, 12, 84);

    tiltCards.forEach((card) => {
      const profile = cardProfiles[card.dataset.tiltCard] || cardProfiles.lab;
      setCardProperty(card, '--move-x', -tiltX * profile.moveX, 'px');
      setCardProperty(card, '--move-y', -tiltY * profile.moveY, 'px');
      setCardProperty(card, '--depth', activity * profile.depth, 'px');
      setCardProperty(card, '--rotate-x', tiltY * profile.rotateX, 'deg');
      setCardProperty(card, '--rotate-y', -tiltX * profile.rotateY, 'deg');
      setCardProperty(card, '--shine-x', shineX, '%');
      setCardProperty(card, '--shine-y', shineY, '%');
      card.style.setProperty('--shine-opacity', (0.12 + activity * 0.42).toFixed(2));
    });

    setCardProperty(tiltAvatar, '--avatar-x', -tiltX * 7.5, 'px');
    setCardProperty(tiltAvatar, '--avatar-y', -tiltY * 5.5, 'px');
    setCardProperty(tiltAvatar, '--avatar-depth', activity * 20, 'px');
    setCardProperty(tiltAvatar, '--avatar-rx', tiltY * 3.4, 'deg');
    setCardProperty(tiltAvatar, '--avatar-ry', -tiltX * 3.8, 'deg');

    phone.classList.toggle('is-tilting', activity > 0.025 && !isSummaryVisible);

    if (
      Math.abs(tiltTargetX - tiltX) > 0.002 ||
      Math.abs(tiltTargetY - tiltY) > 0.002
    ) {
      tiltFrame = window.requestAnimationFrame(applyTilt);
    }
  };

  const setTiltTarget = (x, y) => {
    if (prefersReducedMotion) return;
    tiltTargetX = clamp(x, -1, 1);
    tiltTargetY = clamp(y, -1, 1);
    if (!tiltFrame) tiltFrame = window.requestAnimationFrame(applyTilt);
  };

  const getScreenAngle = () => {
    const angle = window.screen.orientation?.angle;
    if (Number.isFinite(angle)) return angle;
    return Number(window.orientation) || 0;
  };

  const onDeviceOrientation = (event) => {
    if (isSummaryVisible || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;

    if (!orientationBaseline) {
      orientationBaseline = { beta: event.beta, gamma: event.gamma };
      return;
    }

    let rawX = clamp((event.gamma - orientationBaseline.gamma) / 18, -1, 1);
    let rawY = clamp((event.beta - orientationBaseline.beta) / 18, -1, 1);
    if (Math.abs(rawX) < 0.025) rawX = 0;
    if (Math.abs(rawY) < 0.025) rawY = 0;

    const angle = ((getScreenAngle() % 360) + 360) % 360;
    if (angle === 90) {
      setTiltTarget(rawY, -rawX);
    } else if (angle === 270) {
      setTiltTarget(-rawY, rawX);
    } else if (angle === 180) {
      setTiltTarget(-rawX, -rawY);
    } else {
      setTiltTarget(rawX, rawY);
    }
  };

  const startOrientationListening = () => {
    if (isOrientationListening || !wantsOrientation) return;
    window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
    isOrientationListening = true;
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
      setTiltTarget(0, 0);
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

  const permissionResult = (settledResult, fallback) => {
    if (!settledResult) return fallback;
    return settledResult.status === 'fulfilled' ? settledResult.value : 'denied';
  };

  const requestSensorPermission = async () => {
    if (isRequestingPermission) return;

    isRequestingPermission = true;
    enableMotionButton.disabled = true;
    enableMotionButton.textContent = 'Подключаю…';

    try {
      if (!hasSecureSensorContext) throw new Error('Secure context required');

      const motionRequest = needsMotionPermission
        ? window.DeviceMotionEvent.requestPermission()
        : Promise.resolve(supportsMotion ? 'granted' : 'unsupported');
      const orientationRequest = needsOrientationPermission
        ? window.DeviceOrientationEvent.requestPermission()
        : Promise.resolve(wantsOrientation ? 'granted' : 'unsupported');
      const [motionSettled, orientationSettled] = await Promise.allSettled([
        motionRequest,
        orientationRequest,
      ]);

      const motionAllowed = permissionResult(motionSettled, 'unsupported') === 'granted';
      const orientationAllowed = permissionResult(orientationSettled, 'unsupported') === 'granted';
      if (!motionAllowed && !orientationAllowed) throw new Error('Sensor permission denied');

      if (motionAllowed) startListening();
      if (orientationAllowed) startOrientationListening();

      motionActivation.hidden = true;
      if (motionAllowed && orientationAllowed) {
        permissionPanel.hidden = true;
        showStatus('Готово — наклоняй или встряхни телефон');
      } else {
        permissionPanel.hidden = false;
        enableMotionButton.disabled = false;
        enableMotionButton.textContent = 'Разрешить ещё раз';
        motionText.textContent = motionAllowed
          ? 'Встряхивание работает, но для 3D-наклона нужно ещё одно разрешение.'
          : '3D-наклон работает, но для встряхивания нужно ещё одно разрешение.';
      }
    } catch (error) {
      enableMotionButton.disabled = false;
      enableMotionButton.textContent = 'Попробовать ещё раз';
      if (!hasSecureSensorContext) {
        motionText.textContent = 'Для датчиков нужна защищённая HTTPS-ссылка.';
        enableMotionButton.textContent = 'Нужна HTTPS-ссылка';
      }
      motionActivation.hidden = true;
      permissionPanel.hidden = false;
      showStatus('Датчики не подключены');
    } finally {
      isRequestingPermission = false;
    }
  };

  enableMotionButton.addEventListener('click', requestSensorPermission);
  motionActivation.addEventListener('click', requestSensorPermission);
  demoToggle.addEventListener('click', () => setSummary(!isSummaryVisible));

  window.addEventListener('resize', syncViewport, { passive: true });
  window.addEventListener(
    'orientationchange',
    () => {
      orientationBaseline = null;
      setTiltTarget(0, 0);
      syncViewport();
    },
    { passive: true }
  );
  window.visualViewport?.addEventListener('resize', syncViewport, { passive: true });
  window.visualViewport?.addEventListener('scroll', syncViewport, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setTiltTarget(0, 0);
  });

  if (hasFinePointer) {
    phone.addEventListener('pointermove', (event) => {
      if (isSummaryVisible) return;
      const bounds = phone.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      setTiltTarget(x, y);
    });
    phone.addEventListener('pointerleave', () => setTiltTarget(0, 0));
  }

  syncViewport();

  if (!hasSecureSensorContext && (supportsMotion || wantsOrientation)) {
    motionText.textContent = 'Для датчиков нужна защищённая HTTPS-ссылка.';
    enableMotionButton.textContent = 'Нужна HTTPS-ссылка';
    permissionPanel.hidden = false;
  } else if (needsSensorPermission) {
    permissionPanel.hidden = true;
    motionActivation.hidden = false;
  } else {
    motionActivation.hidden = true;
    startListening();
    startOrientationListening();
  }
})();
