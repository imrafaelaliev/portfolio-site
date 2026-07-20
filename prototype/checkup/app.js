const scene = document.querySelector('.results-scroll-scene');

if (scene) {
  const scrollPane = document.querySelector('.scroll-pane');
  const phone = document.querySelector('.phone');
  const problemScene = document.querySelector('.problem-scroll-scene');
  const problemSticky = problemScene.querySelector('.problem-sticky');
  const problemSection = problemScene.querySelector('.problem-section');
  const profilePhoto = problemScene.querySelector('.profile-photo');
  const clinicPhoto = problemScene.querySelector('.clinic-photo');
  const capsulePhoto = problemScene.querySelector('.capsule-photo');
  const sticky = scene.querySelector('.results-sticky');
  const balls = [...scene.querySelectorAll('.value')];
  const normalOrb = scene.querySelector('.normal-orb');
  const glow = scene.querySelector('.results-glow');
  const compositionSection = document.querySelector('.composition-section');
  const accordionItems = [...compositionSection.querySelectorAll('.checkup-accordion-item')];
  const accordionTriggers = [...compositionSection.querySelectorAll('.checkup-accordion-trigger')];
  const convenienceScene = document.querySelector('.convenience-scroll-scene');
  const convenienceStage = convenienceScene.querySelector('.info-card-stage');
  const convenienceCards = [...convenienceScene.querySelectorAll('[data-card-index]')];
  const convenienceDots = [...convenienceScene.querySelectorAll('[data-dot-index]')];
  const purchaseBar = document.querySelector('.purchase-bar');
  const purchaseButton = purchaseBar.querySelector('button');
  const checkoutPay = document.querySelector('.checkout-pay');
  const checkoutPromo = document.querySelector('.checkout-promo');
  const checkoutPromoLabel = checkoutPromo.querySelector('.checkout-promo-label');
  const paymentDetails = document.querySelector('.payment-details');
  const paymentCardList = paymentDetails.querySelector('.payment-card-list');
  const paymentCards = [...paymentDetails.querySelectorAll('.payment-card')];
  const paymentAddCard = paymentDetails.querySelector('.payment-add-card');
  const paymentCardItems = [...paymentDetails.querySelectorAll('.payment-card, .payment-add-card')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealElements = [...document.querySelectorAll('[data-reveal]')];

  const target = { x: 187.5, y: 452 };
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const lerp = (start, end, progress) => start + (end - start) * progress;
  const smoothstep = (value) => value * value * (3 - 2 * value);
  const problemCards = [
    {
      element: profilePhoto,
      start: { x: 0, y: 108, scaleX: 100 / 180, scaleY: 122 / 220, rotate: -3.59 },
      endRotate: 0,
    },
    {
      element: clinicPhoto,
      start: { x: 90, y: -24, scaleX: 100 / 158, scaleY: 122 / 194, rotate: -3.59 },
      endRotate: -3,
    },
    {
      element: capsulePhoto,
      start: { x: -89, y: -8, scaleX: 100 / 158, scaleY: 122 / 194, rotate: -3.59 },
      endRotate: 3,
    },
  ];

  let problemSceneStart = 0;
  let problemScrollDistance = 1;
  let sceneStart = 0;
  let scrollDistance = 1;
  let ballMotion = [];
  let frameRequested = false;
  let revealObserver;
  let convenienceIndex = 0;
  let conveniencePhase = 0;
  let convenienceAnimationFrame;
  let swipeState;
  let compositionResizeObserver;
  let paymentOpen = false;
  let paymentReturnScrollTop;
  let paymentCardScrollState;
  let paymentCardScrollDragged = false;
  let paymentCardWheelTimer;

  revealElements.forEach((element) => {
    const delay = Number(element.dataset.revealDelay) || 0;
    element.style.setProperty('--reveal-delay', `${delay}ms`);
  });

  function reveal(element) {
    element.classList.add('is-visible');
  }

  function setupReveals() {
    revealObserver?.disconnect();

    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      revealElements.forEach(reveal);
      return;
    }

    revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const groupName = entry.target.dataset.revealGroup;
        const targets = groupName
          ? revealElements.filter((element) => element.dataset.revealGroup === groupName)
          : [entry.target];

        targets.forEach((element) => {
          reveal(element);
          observer.unobserve(element);
        });
      });
    }, {
      root: scrollPane,
      rootMargin: '0px 32px -12% 32px',
      threshold: 0.14,
    });

    revealElements.forEach((element) => {
      if (element.classList.contains('is-visible')) return;

      if (scrollPane.contains(element)) {
        revealObserver.observe(element);
      } else {
        window.requestAnimationFrame(() => reveal(element));
      }
    });
  }

  function syncCompositionLayout() {
    const layoutExtra = Math.max(0, compositionSection.getBoundingClientRect().height - 294);
    document.documentElement.style.setProperty('--composition-layout-extra', `${layoutExtra}px`);
    requestUpdate();
  }

  function setAccordionItemState(item, isOpen) {
    const trigger = item.querySelector('.checkup-accordion-trigger');
    const panel = item.querySelector('.checkup-accordion-panel');

    item.classList.toggle('is-open', isOpen);
    trigger.setAttribute('aria-expanded', String(isOpen));
    panel.setAttribute('aria-hidden', String(!isOpen));
  }

  function handleAccordionToggle(event) {
    const selectedItem = event.currentTarget.closest('.checkup-accordion-item');
    const shouldOpen = !selectedItem.classList.contains('is-open');

    accordionItems.forEach((item) => {
      setAccordionItemState(item, shouldOpen && item === selectedItem);
    });

    window.requestAnimationFrame(syncCompositionLayout);
  }

  function measure() {
    const problemSceneRect = problemScene.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    const scrollPaneRect = scrollPane.getBoundingClientRect();

    problemSceneStart = problemSceneRect.top - scrollPaneRect.top + scrollPane.scrollTop;
    problemScrollDistance = Math.max(1, problemScene.offsetHeight - problemSticky.offsetHeight);
    sceneStart = sceneRect.top - scrollPaneRect.top + scrollPane.scrollTop;
    scrollDistance = Math.max(1, scene.offsetHeight - sticky.offsetHeight);
    ballMotion = balls.map((ball) => ({
      element: ball,
      x: target.x - (ball.offsetLeft + ball.offsetWidth / 2),
      y: target.y - (ball.offsetTop + ball.offsetHeight / 2),
    }));
  }

  function renderProblem(progress, scrollOffset) {
    const activeProgress = clamp(progress);
    const motionProgress = smoothstep(activeProgress);
    const remaining = 1 - motionProgress;
    const isAnimating = progress > 0 && progress < 1 && !reducedMotion.matches;

    problemSection.style.transform = `translate3d(0, ${78 - scrollOffset}px, 0)`;
    problemSection.style.willChange = isAnimating ? 'transform' : 'auto';

    problemCards.forEach(({ element, start, endRotate }) => {
      const scaleX = start.scaleX + (1 - start.scaleX) * motionProgress;
      const scaleY = start.scaleY + (1 - start.scaleY) * motionProgress;
      const rotate = start.rotate + (endRotate - start.rotate) * motionProgress;
      const startRadius = 24 / ((start.scaleX + start.scaleY) / 2);
      const radius = startRadius + (44 - startRadius) * motionProgress;

      element.style.transform = `translate3d(${start.x * remaining}px, ${start.y * remaining}px, 0) rotate(${rotate}deg) scale(${scaleX}, ${scaleY})`;
      element.style.borderRadius = `${radius}px`;
      element.style.willChange = isAnimating ? 'transform' : 'auto';
    });
  }

  function render(progress) {
    const blueProgress = clamp(progress / 0.62);
    const blueScale = 1 - 0.65 * blueProgress * blueProgress;
    const blueOpacity = clamp(1 - blueProgress * 1.22);

    ballMotion.forEach(({ element, x, y }) => {
      element.style.transform = `translate3d(${x * blueProgress}px, ${y * blueProgress}px, 0) scale(${blueScale})`;
      element.style.opacity = blueOpacity;
    });

    const greenProgress = clamp((progress - 0.58) / 0.42);
    const greenScale = 0.2 + greenProgress * 0.8;
    normalOrb.style.transform = `scale(${greenScale})`;
    normalOrb.style.opacity = greenProgress;
    glow.style.opacity = greenProgress;
  }

  function getConvenienceCardState(relativeIndex) {
    if (relativeIndex <= -2) {
      return { x: -448, y: 221.29, rotate: -7, opacity: 0 };
    }

    if (relativeIndex === -1) {
      return { x: -328, y: 202, rotate: -7, opacity: 1 };
    }

    if (relativeIndex === 0) {
      return { x: 28, y: 154, rotate: 0, opacity: 1 };
    }

    if (relativeIndex === 1) {
      return { x: 267.73, y: 172.71, rotate: 7, opacity: 0.2 };
    }

    return {
      x: 267.73 + 120 * (relativeIndex - 1),
      y: 172.71,
      rotate: 7,
      opacity: 0.2,
    };
  }

  function renderConveniencePhase(phase, isAnimating = false) {
    const maxIndex = convenienceCards.length - 1;
    const boundedPhase = clamp(phase, 0, maxIndex);
    const step = boundedPhase >= maxIndex ? maxIndex - 1 : Math.floor(boundedPhase);
    const transitionProgress = boundedPhase - step;

    conveniencePhase = boundedPhase;

    convenienceCards.forEach((card, index) => {
      const start = getConvenienceCardState(index - step);
      const end = getConvenienceCardState(index - step - 1);
      const x = lerp(start.x, end.x, transitionProgress);
      const y = lerp(start.y, end.y, transitionProgress);
      const rotate = lerp(start.rotate, end.rotate, transitionProgress);
      const opacity = lerp(start.opacity, end.opacity, transitionProgress);
      const relativeIndex = index - boundedPhase;

      card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg)`;
      card.style.opacity = opacity;
      card.style.zIndex = relativeIndex < 0 && relativeIndex >= -1
        ? 5
        : relativeIndex >= 0 && relativeIndex < 1
          ? 4
          : relativeIndex === 1
            ? 3
            : relativeIndex > 1
              ? 2
              : 0;
      card.style.willChange = isAnimating ? 'transform, opacity' : 'auto';
    });

    const activeIndex = Math.round(boundedPhase);
    convenienceCards.forEach((card, index) => {
      card.setAttribute('aria-hidden', String(index !== activeIndex));
    });

    convenienceDots.forEach((dot, index) => {
      const activation = clamp(1 - Math.abs(index - boundedPhase));
      dot.style.width = `${12 + 12 * activation}px`;
      dot.style.opacity = 0.2 + 0.8 * activation;
    });
  }

  function animateConvenienceTo(targetIndex) {
    const nextIndex = Math.round(clamp(targetIndex, 0, convenienceCards.length - 1));
    const startPhase = conveniencePhase;
    const distance = Math.abs(nextIndex - startPhase);

    convenienceIndex = nextIndex;
    window.cancelAnimationFrame(convenienceAnimationFrame);

    if (distance < 0.001 || reducedMotion.matches) {
      renderConveniencePhase(nextIndex);
      return;
    }

    const startTime = performance.now();
    const duration = 360 + Math.min(distance, 1) * 80;

    function tick(time) {
      const progress = clamp((time - startTime) / duration);
      const easedProgress = 1 - (1 - progress) ** 3;

      renderConveniencePhase(lerp(startPhase, nextIndex, easedProgress), progress < 1);

      if (progress < 1) {
        convenienceAnimationFrame = window.requestAnimationFrame(tick);
      }
    }

    convenienceAnimationFrame = window.requestAnimationFrame(tick);
  }

  function handleSwipeStart(event) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;

    convenienceStage.classList.add('is-pointer-focus');
    swipeState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      startIndex: Math.round(conveniencePhase),
      startPhase: conveniencePhase,
      horizontal: false,
    };
  }

  function handleSwipeMove(event) {
    if (!swipeState || event.pointerId !== swipeState.pointerId) return;

    const deltaX = event.clientX - swipeState.startX;
    const deltaY = event.clientY - swipeState.startY;

    if (!swipeState.horizontal) {
      if (Math.abs(deltaY) > 8 && Math.abs(deltaY) > Math.abs(deltaX)) {
        swipeState = undefined;
        return;
      }

      if (Math.abs(deltaX) <= 8 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

      window.cancelAnimationFrame(convenienceAnimationFrame);
      swipeState.startX = event.clientX;
      swipeState.startTime = performance.now();
      swipeState.startPhase = conveniencePhase;
      swipeState.startIndex = Math.round(conveniencePhase);
      convenienceIndex = swipeState.startIndex;
      swipeState.horizontal = true;
      convenienceStage.setPointerCapture?.(event.pointerId);
      convenienceStage.classList.add('is-dragging');
    }

    event.preventDefault();
    renderConveniencePhase(swipeState.startPhase - deltaX / 280, true);
  }

  function finishSwipe(event, cancelled = false) {
    if (!swipeState || event.pointerId !== swipeState.pointerId) return;

    const currentSwipe = swipeState;
    swipeState = undefined;
    convenienceStage.classList.remove('is-dragging');

    if (convenienceStage.hasPointerCapture?.(event.pointerId)) {
      convenienceStage.releasePointerCapture(event.pointerId);
    }

    if (!currentSwipe.horizontal) return;

    const deltaX = event.clientX - currentSwipe.startX;
    const elapsed = Math.max(1, performance.now() - currentSwipe.startTime);
    const velocity = Math.abs(deltaX) / elapsed;
    const shouldChange = !cancelled && (Math.abs(deltaX) > 52 || velocity > 0.45);
    const direction = deltaX < 0 ? 1 : -1;
    const targetIndex = shouldChange
      ? currentSwipe.startIndex + direction
      : currentSwipe.startIndex;

    animateConvenienceTo(targetIndex);
  }

  function handleConvenienceKeydown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    event.preventDefault();
    convenienceStage.classList.remove('is-pointer-focus');
    animateConvenienceTo(convenienceIndex + (event.key === 'ArrowRight' ? 1 : -1));
  }

  function update() {
    frameRequested = false;
    const scrollTop = scrollPane.scrollTop;
    const problemProgress = reducedMotion.matches
      ? 1
      : clamp((scrollTop - problemSceneStart) / problemScrollDistance);
    const problemScrollOffset = reducedMotion.matches
      ? 0
      : clamp(scrollTop - problemSceneStart, 0, problemScrollDistance);
    const resultsProgress = reducedMotion.matches
      ? 1
      : clamp((scrollTop - sceneStart) / scrollDistance);
    const remainingScroll = scrollPane.scrollHeight - scrollPane.clientHeight - scrollTop;
    const checkoutComplete = remainingScroll <= 1;
    const purchaseBarFadeProgress = reducedMotion.matches
      ? Number(checkoutComplete)
      : clamp((160 - remainingScroll) / 160);
    const purchaseBarFading = purchaseBarFadeProgress > 0;

    renderProblem(problemProgress, problemScrollOffset);
    render(resultsProgress);
    purchaseBar.classList.toggle('is-checkout-fading', purchaseBarFading);
    purchaseBar.classList.toggle('is-checkout-hidden', purchaseBarFadeProgress >= 1);
    if (purchaseBarFading) {
      purchaseBar.style.opacity = `${1 - purchaseBarFadeProgress}`;
    } else {
      purchaseBar.style.removeProperty('opacity');
    }
    phone.classList.toggle('is-checkout-complete', checkoutComplete);
  }

  function requestUpdate() {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(update);
  }

  function refresh() {
    measure();
    requestUpdate();
  }

  function handleMotionPreferenceChange() {
    refresh();
    setupReveals();
  }

  function setPaymentOpen(nextOpen, returnScrollTop) {
    if (!nextOpen && paymentDetails.contains(document.activeElement)) {
      checkoutPromo.focus({ preventScroll: true });
    }

    const scrollTopToRestore = !nextOpen ? paymentReturnScrollTop : undefined;
    if (nextOpen) paymentReturnScrollTop = returnScrollTop;

    paymentOpen = nextOpen;
    paymentDetails.toggleAttribute('inert', !nextOpen);
    paymentDetails.setAttribute('aria-hidden', String(!nextOpen));
    phone.classList.toggle('is-payment-open', nextOpen);
    checkoutPay.textContent = nextOpen ? 'Оплатить' : 'К оплате';
    checkoutPromoLabel.textContent = nextOpen ? 'Назад' : 'У меня есть промокод';

    if (!nextOpen && Number.isFinite(scrollTopToRestore)) {
      paymentReturnScrollTop = undefined;
      scrollPane.scrollTop = scrollTopToRestore;
      requestUpdate();
    }
  }

  function openPaymentFromPurchaseBar() {
    if (paymentOpen) return;

    const returnScrollTop = scrollPane.scrollTop;
    scrollPane.scrollTop = scrollPane.scrollHeight - scrollPane.clientHeight;
    requestUpdate();

    window.requestAnimationFrame(() => setPaymentOpen(true, returnScrollTop));
  }

  function handlePaymentCardScrollStart(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    paymentCardScrollState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: paymentCardList.scrollLeft,
    };
    paymentCardScrollDragged = false;
    paymentCardList.setPointerCapture?.(event.pointerId);
  }

  function handlePaymentCardScrollMove(event) {
    if (!paymentCardScrollState || event.pointerId !== paymentCardScrollState.pointerId) return;

    const deltaX = event.clientX - paymentCardScrollState.startX;
    if (!paymentCardScrollDragged && Math.abs(deltaX) < 5) return;

    paymentCardScrollDragged = true;
    paymentCardList.classList.add('is-dragging');
    event.preventDefault();
    paymentCardList.scrollLeft = paymentCardScrollState.startScrollLeft - deltaX;
  }

  function snapPaymentCardList(targetCard) {
    const firstCard = paymentCardItems[0];
    if (!firstCard) return;

    const listStyles = window.getComputedStyle(paymentCardList);
    const gap = Number.parseFloat(listStyles.columnGap || listStyles.gap) || 0;
    const cardStep = firstCard.offsetWidth + gap;
    const targetIndex = targetCard
      ? paymentCardItems.indexOf(targetCard)
      : Math.round(paymentCardList.scrollLeft / cardStep);
    const safeIndex = clamp(targetIndex, 0, paymentCardItems.length - 1);
    const maxScrollLeft = paymentCardList.scrollWidth - paymentCardList.clientWidth;
    const nextScrollLeft = Math.min(safeIndex * cardStep, maxScrollLeft);
    const activeItem = paymentCardItems[safeIndex];

    if (paymentCards.includes(activeItem)) selectPaymentCard(activeItem);
    paymentCardList.scrollTo({
      left: nextScrollLeft,
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
    });
  }

  function finishPaymentCardScroll(event) {
    if (!paymentCardScrollState || event.pointerId !== paymentCardScrollState.pointerId) return;

    paymentCardScrollState = undefined;
    paymentCardList.classList.remove('is-dragging');

    if (paymentCardList.hasPointerCapture?.(event.pointerId)) {
      paymentCardList.releasePointerCapture(event.pointerId);
    }

    if (paymentCardScrollDragged) {
      window.requestAnimationFrame(() => snapPaymentCardList());
    }

    window.setTimeout(() => {
      paymentCardScrollDragged = false;
    }, 0);
  }

  function handlePaymentCardWheel(event) {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const maxScrollLeft = paymentCardList.scrollWidth - paymentCardList.clientWidth;
    const canScroll = (delta < 0 && paymentCardList.scrollLeft > 0)
      || (delta > 0 && paymentCardList.scrollLeft < maxScrollLeft);

    if (!canScroll) return;

    event.preventDefault();
    paymentCardList.scrollLeft += delta;
    window.clearTimeout(paymentCardWheelTimer);
    paymentCardWheelTimer = window.setTimeout(() => snapPaymentCardList(), 120);
  }

  function selectPaymentCard(selectedCard) {
    paymentCards.forEach((card) => {
      card.setAttribute('aria-pressed', String(card === selectedCard));
    });
  }

  function handlePaymentKeydown(event) {
    if (event.key !== 'Escape' || !paymentOpen) return;

    event.preventDefault();
    setPaymentOpen(false);
  }

  scrollPane.addEventListener('scroll', requestUpdate, { passive: true });
  convenienceStage.addEventListener('pointerdown', handleSwipeStart);
  convenienceStage.addEventListener('pointermove', handleSwipeMove);
  convenienceStage.addEventListener('pointerup', finishSwipe);
  convenienceStage.addEventListener('pointercancel', (event) => finishSwipe(event, true));
  convenienceStage.addEventListener('keydown', handleConvenienceKeydown);
  convenienceStage.addEventListener('blur', () => convenienceStage.classList.remove('is-pointer-focus'));
  convenienceStage.addEventListener('dragstart', (event) => event.preventDefault());
  accordionTriggers.forEach((trigger) => {
    trigger.addEventListener('click', handleAccordionToggle);
  });
  checkoutPay.addEventListener('click', () => {
    if (!paymentOpen) setPaymentOpen(true);
  });
  checkoutPromo.addEventListener('click', () => setPaymentOpen(!paymentOpen));
  purchaseButton.addEventListener('click', openPaymentFromPurchaseBar);
  paymentCardList.addEventListener('pointerdown', handlePaymentCardScrollStart);
  paymentCardList.addEventListener('pointermove', handlePaymentCardScrollMove);
  paymentCardList.addEventListener('pointerup', finishPaymentCardScroll);
  paymentCardList.addEventListener('pointercancel', finishPaymentCardScroll);
  paymentCardList.addEventListener('wheel', handlePaymentCardWheel, { passive: false });
  paymentCardList.addEventListener('dragstart', (event) => event.preventDefault());
  paymentCards.forEach((card) => {
    card.addEventListener('click', () => {
      if (!paymentCardScrollDragged) snapPaymentCardList(card);
    });
  });
  paymentAddCard.addEventListener('click', () => {
    if (!paymentCardScrollDragged) snapPaymentCardList(paymentAddCard);
  });
  document.addEventListener('keydown', handlePaymentKeydown);
  window.addEventListener('resize', refresh);
  reducedMotion.addEventListener?.('change', handleMotionPreferenceChange);
  renderConveniencePhase(0);
  setupReveals();

  if ('ResizeObserver' in window) {
    compositionResizeObserver = new ResizeObserver(syncCompositionLayout);
    compositionResizeObserver.observe(compositionSection);
  }

  syncCompositionLayout();

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      syncCompositionLayout();
      refresh();
    });
  } else {
    refresh();
  }
}
