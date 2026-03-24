(() => {
  document.documentElement.classList.add('js');
  const revealAll = () => {
    document.querySelectorAll('.reveal').forEach((node) => node.classList.add('is-visible'));
  };

  const storage = {
    get(key) {
      try {
        return window.sessionStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        window.sessionStorage.setItem(key, value);
      } catch {
        // Ignore storage errors in file:// or restricted contexts.
      }
    },
    remove(key) {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // Ignore storage errors in file:// or restricted contexts.
      }
    }
  };

  // Normalize old direct links like /path/index.html to /path/
  const normalizedPath = window.location.pathname.replace(/\/index\.html$/, '/');
  if (normalizedPath !== window.location.pathname) {
    try {
      window.history.replaceState(null, '', `${normalizedPath}${window.location.search}${window.location.hash}`);
    } catch {
      // Ignore replaceState errors in file:// previews.
    }
  }

  const isFileProtocol = window.location.protocol === 'file:';
  if (isFileProtocol) {
    const localCaseLinks = Array.from(document.querySelectorAll('a[data-case-link], a[data-back-to-home]'));
    localCaseLinks.forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (!href) return;
      if (/^(https?:|mailto:|tel:|#)/i.test(href)) return;
      if (!href.endsWith('/')) return;
      link.setAttribute('href', `${href}index.html`);
    });
  }

  const HOME_SCROLL_KEY = 'portfolioHomeScrollY';
  const RESTORE_HOME_SCROLL_KEY = 'portfolioRestoreHomeScroll';
  const CASE_SEQUENCE_KEY = 'portfolioCaseSequence';
  const NEXT_CASE_CAPTION_CLASSES = [
    'marshall-page__next-case-caption--project',
    'marshall-page__next-case-caption--mention',
    'marshall-page__next-case-caption--short'
  ];
  const FALLBACK_CASE_SEQUENCE = [
    {
      slug: 'marshall',
      title: 'Продуктовый сайт MARSHALL Autoparts',
      image: 'assets/images/marshall/hero-preview.webp',
      captionClass: 'marshall-page__next-case-caption--project'
    },
    {
      slug: 'hios',
      title: 'Дизайн операционной системы HiOS',
      image: 'assets/images/hios/hero-preview.png',
      captionClass: 'marshall-page__next-case-caption--project'
    },
    {
      slug: 'sladonezh',
      title: 'Корпоративный сайт Сладонеж',
      image: 'assets/images/sladonezh/hero-preview.png',
      captionClass: 'marshall-page__next-case-caption--project'
    },
    {
      slug: 'lori',
      title: 'Мобильное приложение Lori',
      image: 'assets/images/lori/hero-preview.png',
      captionClass: 'marshall-page__next-case-caption--project'
    },
    {
      slug: 'dacha',
      title: 'Дача | Приложение для поиска друзей',
      image: 'assets/images/dacha/hero-preview.png',
      captionClass: 'marshall-page__next-case-caption--short'
    },
    {
      slug: 'mtelectro',
      title: 'МТ Электро | Прототип и концепт сайта светотехнической компании',
      image: 'assets/images/mtelectro/hero-preview.png',
      captionClass: 'marshall-page__next-case-caption--mention'
    },
    {
      slug: 'nl',
      title: 'NL International | Концепт сайта',
      image: 'assets/images/nl/hero-preview.png',
      captionClass: 'marshall-page__next-case-caption--short'
    },
    {
      slug: 'simplecoffee',
      title: 'Simple Coffee | Мобильное приложение',
      image: 'assets/images/simplecoffee/hero-preview.png',
      captionClass: 'marshall-page__next-case-caption--mention'
    },
    {
      slug: 'tochka',
      title: 'Точка Банк | CJM телеграм бота',
      image: 'assets/images/tochka/hero-preview.png',
      captionClass: 'marshall-page__next-case-caption--mention'
    },
    {
      slug: 'insis',
      title: 'ИНСИС | Креативная кампания',
      image: 'assets/images/insis/hero-preview.png',
      captionClass: 'marshall-page__next-case-caption--mention'
    }
  ];
  const caseMetaBySlug = new Map(FALLBACK_CASE_SEQUENCE.map((item) => [item.slug, item]));

  const extractCaseSlug = (href) => {
    if (!href) return '';
    if (/^(https?:|mailto:|tel:|#)/i.test(href)) return '';

    let normalizedHref = href.trim().replace(/\\/g, '/');
    normalizedHref = normalizedHref.split('#')[0].split('?')[0];
    normalizedHref = normalizedHref.replace(/\/index\.html$/i, '/');
    normalizedHref = normalizedHref.replace(/^\.?\//, '');
    normalizedHref = normalizedHref.replace(/^(\.\.\/)+/, '');
    normalizedHref = normalizedHref.replace(/^\/+|\/+$/g, '');

    if (!normalizedHref) return '';

    return normalizedHref.split('/')[0] || '';
  };

  const getCurrentCaseSlug = () => {
    let normalizedPath = window.location.pathname.replace(/\\/g, '/');
    normalizedPath = normalizedPath.replace(/\/index\.html$/i, '/');

    const pathParts = normalizedPath.split('/').filter(Boolean);
    return pathParts.length ? pathParts[pathParts.length - 1] : '';
  };

  const toCasePreviewSrc = (value) => {
    if (!value) return '';
    if (/^(https?:|data:|\/\/)/i.test(value)) return value;
    const cleanPath = value.replace(/^\.?\//, '');
    return `../${cleanPath}`;
  };

  const readStoredCaseSequence = () => {
    const raw = storage.get(CASE_SEQUENCE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;

      const normalized = parsed
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const slug = typeof entry.slug === 'string' ? extractCaseSlug(entry.slug) : '';
          if (!slug) return null;

          const fallback = caseMetaBySlug.get(slug);
          const title = typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : fallback?.title || slug;
          const image = typeof entry.image === 'string' && entry.image.trim() ? entry.image.trim() : fallback?.image || '';
          const captionClass =
            typeof entry.captionClass === 'string' && NEXT_CASE_CAPTION_CLASSES.includes(entry.captionClass)
              ? entry.captionClass
              : fallback?.captionClass || 'marshall-page__next-case-caption--project';

          return {
            slug,
            title,
            image,
            captionClass
          };
        })
        .filter(Boolean);

      return normalized.length ? normalized : null;
    } catch {
      return null;
    }
  };

  const getCaseSequence = () => readStoredCaseSequence() || FALLBACK_CASE_SEQUENCE;

  const storeCaseSequenceFromHome = () => {
    if (!document.body.classList.contains('home')) return;

    const links = Array.from(document.querySelectorAll('.project-item[data-case-link], .mentions__card[data-case-link]'));
    if (!links.length) return;

    const sequence = links
      .map((link) => {
        const slug = extractCaseSlug(link.getAttribute('href') || '');
        if (!slug) return null;

        const fallback = caseMetaBySlug.get(slug);
        const titleNode = link.querySelector('.project-item__title, .mentions__caption');
        const domTitle = titleNode ? titleNode.textContent.replace(/\s+/g, ' ').trim() : '';
        const imageNode = link.querySelector('img');
        const domImage = imageNode ? (imageNode.getAttribute('src') || '').trim() : '';

        return {
          slug,
          title: domTitle || fallback?.title || slug,
          image: fallback?.image || domImage,
          captionClass: fallback?.captionClass || 'marshall-page__next-case-caption--project'
        };
      })
      .filter(Boolean);

    if (!sequence.length) return;

    storage.set(CASE_SEQUENCE_KEY, JSON.stringify(sequence));
  };

  const syncNextCaseCard = () => {
    if (!document.body.classList.contains('marshall-page')) return;

    const nextCaseLink = document.querySelector('.marshall-page__next-case-link[data-case-link]');
    if (!nextCaseLink) return;

    const currentSlug = getCurrentCaseSlug();
    if (!currentSlug) return;

    const caseSequence = getCaseSequence();
    if (caseSequence.length < 2) return;

    const currentIndex = caseSequence.findIndex((entry) => entry.slug === currentSlug);
    if (currentIndex === -1) return;

    const nextCase = caseSequence[(currentIndex + 1) % caseSequence.length];
    const nextHref = `../${nextCase.slug}/`;
    nextCaseLink.setAttribute('href', isFileProtocol ? `${nextHref}index.html` : nextHref);
    nextCaseLink.setAttribute('aria-label', `Открыть следующий кейс: ${nextCase.title}`);

    const nextCaseImage = nextCaseLink.querySelector('.marshall-page__next-case-preview');
    if (nextCaseImage) {
      const imageSource = toCasePreviewSrc(nextCase.image);
      if (imageSource) nextCaseImage.setAttribute('src', imageSource);
      nextCaseImage.setAttribute('alt', `Следующий кейс: ${nextCase.title}`);
    }

    const nextCaseCaption = nextCaseLink.querySelector('.marshall-page__next-case-caption');
    if (nextCaseCaption) {
      nextCaseCaption.textContent = nextCase.title;
      nextCaseCaption.classList.remove(...NEXT_CASE_CAPTION_CLASSES);
      nextCaseCaption.classList.add(nextCase.captionClass || 'marshall-page__next-case-caption--project');
    }
  };

  const initHomePixelHover = () => {
    const isHomeRebuild = document.body.classList.contains('home') && document.body.classList.contains('home--rebuild');
    if (!isHomeRebuild) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const pixelTargets = Array.from(
      document.querySelectorAll(
        '.hero__portrait, .collage__flat, .project-item__cover, .mentions__logo, .contacts__banner-bg'
      )
    ).filter((node) => node instanceof HTMLImageElement);
    if (!pixelTargets.length) return;

    const pixelCache = new WeakMap();
    const overlayByImage = new WeakMap();
    const hoverGroupByImage = new WeakMap();
    const activeImages = new Set();
    const PIXEL_RATIO = 0.07;
    const EFFECT_SIZE = 48;

    const buildPixelatedSrc = (img) => {
      const src = (img.currentSrc || img.getAttribute('src') || '').toLowerCase();
      if (!src || /\.gif($|\?)/i.test(src)) return null;
      if (!img.complete || !img.naturalWidth || !img.naturalHeight) return null;

      try {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const downscaledWidth = Math.max(1, Math.round(width * PIXEL_RATIO));
        const downscaledHeight = Math.max(1, Math.round(height * PIXEL_RATIO));

        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        const sourceCtx = sourceCanvas.getContext('2d');
        if (!sourceCtx) return null;
        sourceCtx.imageSmoothingEnabled = false;
        sourceCtx.drawImage(img, 0, 0, width, height);

        const downscaledCanvas = document.createElement('canvas');
        downscaledCanvas.width = downscaledWidth;
        downscaledCanvas.height = downscaledHeight;
        const downscaledCtx = downscaledCanvas.getContext('2d');
        if (!downscaledCtx) return null;
        downscaledCtx.imageSmoothingEnabled = false;
        downscaledCtx.drawImage(sourceCanvas, 0, 0, width, height, 0, 0, downscaledWidth, downscaledHeight);

        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = width;
        outputCanvas.height = height;
        const outputCtx = outputCanvas.getContext('2d');
        if (!outputCtx) return null;
        outputCtx.imageSmoothingEnabled = false;
        outputCtx.drawImage(downscaledCanvas, 0, 0, downscaledWidth, downscaledHeight, 0, 0, width, height);

        return outputCanvas.toDataURL('image/png');
      } catch {
        return null;
      }
    };

    const getPixelatedSrc = (img) => {
      const cachedSrc = pixelCache.get(img);
      if (cachedSrc) return cachedSrc;

      const pixelatedSrc = buildPixelatedSrc(img);
      if (!pixelatedSrc) return null;

      pixelCache.set(img, pixelatedSrc);
      return pixelatedSrc;
    };

    const syncOverlayRect = (img, overlay) => {
      const rect = img.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;

      const computed = window.getComputedStyle(img);
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.borderRadius = computed.borderRadius;
      overlay.style.objectFit = computed.objectFit || 'fill';
      overlay.style.objectPosition = computed.objectPosition || '50% 50%';
      return true;
    };

    const moveOverlayMask = (img, overlay, clientX, clientY) => {
      const rect = img.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
      const squareSize = Math.max(8, Math.min(EFFECT_SIZE, rect.width, rect.height));
      const half = squareSize / 2;
      const left = Math.max(0, Math.min(rect.width - squareSize, x - half));
      const top = Math.max(0, Math.min(rect.height - squareSize, y - half));
      const right = left + squareSize;
      const bottom = top + squareSize;

      overlay.style.clipPath = `inset(${top}px ${Math.max(0, rect.width - right)}px ${Math.max(0, rect.height - bottom)}px ${left}px)`;
    };

    const ensureOverlay = (img, pixelatedSrc) => {
      const existing = overlayByImage.get(img);
      if (existing) {
        if (existing.getAttribute('src') !== pixelatedSrc) existing.setAttribute('src', pixelatedSrc);
        return existing;
      }

      const overlay = document.createElement('img');
      overlay.className = 'pixel-hover-overlay';
      overlay.setAttribute('src', pixelatedSrc);
      overlay.setAttribute('alt', '');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.draggable = false;
      document.body.appendChild(overlay);
      overlayByImage.set(img, overlay);
      return overlay;
    };

    const showOverlay = (img, event) => {
      const pixelatedSrc = getPixelatedSrc(img);
      if (!pixelatedSrc) return;

      const overlay = ensureOverlay(img, pixelatedSrc);
      if (!syncOverlayRect(img, overlay)) return;
      moveOverlayMask(img, overlay, event.clientX, event.clientY);

      overlay.style.opacity = '1';
      img.dataset.pixelHoverActive = '1';
      img.classList.add('is-pixel-hovering');
      activeImages.add(img);
    };

    const updateOverlay = (img, event) => {
      if (img.dataset.pixelHoverActive !== '1') return;
      const overlay = overlayByImage.get(img);
      if (!overlay) return;

      if (!syncOverlayRect(img, overlay)) {
        overlay.style.opacity = '0';
        return;
      }

      moveOverlayMask(img, overlay, event.clientX, event.clientY);
    };

    const hideOverlay = (img) => {
      if (img.dataset.pixelHoverActive !== '1') return;

      const overlay = overlayByImage.get(img);
      if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.clipPath = 'inset(50% 50% 50% 50%)';
      }

      img.dataset.pixelHoverActive = '0';
      img.classList.remove('is-pixel-hovering');
      activeImages.delete(img);
    };

    const refreshActiveOverlays = () => {
      activeImages.forEach((img) => {
        const overlay = overlayByImage.get(img);
        if (!overlay) return;

        if (!syncOverlayRect(img, overlay)) {
          hideOverlay(img);
        }
      });
    };

    const pixelTargetSet = new Set(pixelTargets);
    pixelTargets.forEach((img) => {
      const banner = img.closest('.contacts__banner');
      if (!banner) {
        hoverGroupByImage.set(img, [img]);
        return;
      }

      const group = Array.from(banner.querySelectorAll('img')).filter((node) => pixelTargetSet.has(node));
      hoverGroupByImage.set(img, group.length ? group : [img]);
    });

    pixelTargets.forEach((img) => {
      img.dataset.pixelHoverTarget = '1';
      img.addEventListener('mouseenter', (event) => {
        const group = hoverGroupByImage.get(img) || [img];
        group.forEach((node) => showOverlay(node, event));
      });
      img.addEventListener('mousemove', (event) => {
        const group = hoverGroupByImage.get(img) || [img];
        group.forEach((node) => updateOverlay(node, event));
      });
      img.addEventListener('mouseleave', () => {
        const group = hoverGroupByImage.get(img) || [img];
        group.forEach((node) => hideOverlay(node));
      });
      img.addEventListener('blur', () => {
        const group = hoverGroupByImage.get(img) || [img];
        group.forEach((node) => hideOverlay(node));
      });
    });

    window.addEventListener('scroll', refreshActiveOverlays, { passive: true });
    window.addEventListener('resize', refreshActiveOverlays);
  };

  if (document.body.classList.contains('home')) {
    const shouldRestore = storage.get(RESTORE_HOME_SCROLL_KEY) === '1';
    const savedScroll = Number.parseFloat(storage.get(HOME_SCROLL_KEY) || '0');

    if (shouldRestore) {
      if (Number.isFinite(savedScroll) && savedScroll >= 0) {
        const prevScrollBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, savedScroll);
        document.documentElement.style.scrollBehavior = prevScrollBehavior;
      }
      storage.remove(RESTORE_HOME_SCROLL_KEY);
    }

    storeCaseSequenceFromHome();

    const caseLinks = Array.from(document.querySelectorAll('[data-case-link]'));
    caseLinks.forEach((link) => {
      link.addEventListener('click', () => {
        storage.set(HOME_SCROLL_KEY, String(window.scrollY));
      });
    });
  }

  const backToHomeLinks = Array.from(document.querySelectorAll('[data-back-to-home]'));
  backToHomeLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (storage.get(HOME_SCROLL_KEY) !== null) {
        storage.set(RESTORE_HOME_SCROLL_KEY, '1');
      }
    });
  });

  syncNextCaseCard();
  initHomePixelHover();

  const injectSharedCaseFooter = () => {
    if (!document.body.classList.contains('marshall-page')) return;

    const mainNode = document.querySelector('main.marshall-page__main') || document.querySelector('main');
    if (!mainNode) return;

    document.querySelectorAll('.marshall-page__footer').forEach((footerNode) => footerNode.remove());

    if (mainNode.querySelector('.contacts--shared')) return;

    const footerSection = document.createElement('section');
    footerSection.className = 'section contacts contacts--figma contacts--shared';
    footerSection.setAttribute('aria-label', 'Контакты');
    footerSection.innerHTML = `
      <div class="contacts__canvas">
        <img
          class="contacts__phone reveal"
          src="../assets/images/contacts-phone.gif"
          alt="Телефон"
          loading="lazy"
          decoding="async"
        />

        <a class="contacts__link contacts__link--telegram reveal" href="https://t.me/imrafaelaliev" target="_blank" rel="noopener noreferrer">telegram</a>
        <a
          class="contacts__link contacts__link--linkedin reveal"
          href="https://www.linkedin.com/in/%D1%80%D0%B0%D1%84%D0%B0%D1%8D%D0%BB%D1%8C-%D0%B0%D0%BB%D0%B8%D0%B5%D0%B2-a10539399/"
          target="_blank"
          rel="noopener noreferrer"
          >linkedin</a
        >
        <a class="contacts__link contacts__link--email reveal" href="mailto:rafaealiev53@gmail.com">email</a>

        <div class="contacts__banner reveal" aria-hidden="true">
          <img class="contacts__banner-bg" src="../assets/images/home/footer-bg.png" alt="" loading="lazy" decoding="async" />
          <img class="contacts__banner-word" src="../assets/images/home/footer-word.svg" alt="" loading="lazy" decoding="async" />
        </div>
      </div>
    `;

    mainNode.appendChild(footerSection);
  };

  injectSharedCaseFooter();

  const revealItems = Array.from(document.querySelectorAll('.reveal'));

  if (revealItems.length) {
    if (!('IntersectionObserver' in window)) {
      revealAll();
    } else {
      const revealedGroups = new Set();
      const groupFallbackTimers = new Map();
      const GROUP_REVEAL_MAX_WAIT_MS = 1400;

      const revealNode = (node, obs) => {
        node.classList.add('is-visible');
        obs.unobserve(node);
      };

      const clearGroupFallback = (groupName) => {
        const timerId = groupFallbackTimers.get(groupName);
        if (!timerId) return;
        clearTimeout(timerId);
        groupFallbackTimers.delete(groupName);
      };

      const revealGroupIfReady = (groupName, obs) => {
        if (revealedGroups.has(groupName)) return;

        const groupNodes = Array.from(document.querySelectorAll(`.reveal[data-reveal-group="${groupName}"]`));
        if (!groupNodes.length) return;

        const allLoaded = groupNodes.every((node) => !(node instanceof HTMLImageElement) || node.complete);
        if (!allLoaded) return;

        groupNodes.forEach((node) => revealNode(node, obs));
        revealedGroups.add(groupName);
        clearGroupFallback(groupName);
      };

      const bindGroupLoadListeners = (groupName, obs) => {
        const groupNodes = Array.from(document.querySelectorAll(`.reveal[data-reveal-group="${groupName}"]`));

        groupNodes.forEach((node) => {
          if (!(node instanceof HTMLImageElement) || node.complete) return;
          if (node.dataset.revealLoadBound === '1') return;

          node.dataset.revealLoadBound = '1';
          const tryReveal = () => revealGroupIfReady(groupName, obs);
          node.addEventListener('load', tryReveal, { once: true });
          node.addEventListener('error', tryReveal, { once: true });
        });
      };

      const scheduleGroupFallbackReveal = (groupName, obs) => {
        if (revealedGroups.has(groupName)) return;
        if (groupFallbackTimers.has(groupName)) return;

        const timerId = window.setTimeout(() => {
          if (revealedGroups.has(groupName)) return;
          const groupNodes = Array.from(document.querySelectorAll(`.reveal[data-reveal-group="${groupName}"]`));
          if (!groupNodes.length) return;

          groupNodes.forEach((node) => revealNode(node, obs));
          revealedGroups.add(groupName);
          groupFallbackTimers.delete(groupName);
        }, GROUP_REVEAL_MAX_WAIT_MS);

        groupFallbackTimers.set(groupName, timerId);
      };

      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const revealGroup = entry.target.getAttribute('data-reveal-group');
              if (revealGroup) {
                revealGroupIfReady(revealGroup, obs);
                if (!revealedGroups.has(revealGroup)) {
                  bindGroupLoadListeners(revealGroup, obs);
                  scheduleGroupFallbackReveal(revealGroup, obs);
                }
                return;
              }

              const waitForLoad = entry.target instanceof HTMLImageElement && entry.target.hasAttribute('data-reveal-wait-load');

              if (waitForLoad && !entry.target.complete) {
                const revealWhenReady = () => {
                  revealNode(entry.target, obs);
                };

                entry.target.addEventListener('load', revealWhenReady, { once: true });
                entry.target.addEventListener('error', revealWhenReady, { once: true });
                return;
              }

              revealNode(entry.target, obs);
            }
          });
        },
        {
          threshold: 0.16,
          rootMargin: '0px 0px -8% 0px'
        }
      );

      revealItems.forEach((item) => observer.observe(item));
    }
  }

  const links = Array.from(document.querySelectorAll('[data-nav-link]'));
  const sections = links
    .map((link) => {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return null;
      const target = document.querySelector(href);
      return target ? { link, target } : null;
    })
    .filter(Boolean);

  if (sections.length) {
    const syncActiveLink = () => {
      const y = window.scrollY + window.innerHeight * 0.35;
      let currentId = sections[0].target.id;

      sections.forEach(({ target }) => {
        if (target.offsetTop <= y) currentId = target.id;
      });

      sections.forEach(({ link, target }) => {
        const active = target.id === currentId;
        link.style.opacity = active ? '1' : '0.72';
      });
    };

    syncActiveLink();
    window.addEventListener('scroll', syncActiveLink, { passive: true });
    window.addEventListener('resize', syncActiveLink);
  }

  const yearNode = document.querySelector('[data-current-year]');
  if (yearNode) {
    yearNode.textContent = String(new Date().getFullYear());
  }
})();
