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
      image: 'assets/images/marshall/hero-cover-20260407.png?v=20260407-marshall-cover-1',
      captionClass: 'marshall-page__next-case-caption--project'
    },
    {
      slug: 'hios',
      title: 'Дизайн операционной системы HiOS под русский культурный код',
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

    const cards = Array.from(document.querySelectorAll('.project-item, .mentions__card[data-case-link]'));
    if (!cards.length) return;

    const sequence = cards
      .map((card) => {
        const caseLink = card.matches('a[data-case-link]') ? card : card.querySelector('a[data-case-link]');
        if (!caseLink) return null;

        const slug = extractCaseSlug(caseLink.getAttribute('href') || '');
        if (!slug) return null;

        const fallback = caseMetaBySlug.get(slug);
        const titleNode = card.querySelector('.project-item__title, .mentions__caption');
        const domTitle = titleNode ? titleNode.textContent.replace(/\s+/g, ' ').trim() : '';
        const imageNode = card.querySelector('.project-card__cover, .mentions__cover img, img');
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
  const injectSharedCaseFooter = () => {
    if (!document.body.classList.contains('marshall-page')) return;

    const mainNode = document.querySelector('main.marshall-page__main') || document.querySelector('main');
    if (!mainNode) return;

    document.querySelectorAll('.marshall-page__footer').forEach((footerNode) => footerNode.remove());

    if (mainNode.querySelector('[data-shared-home-footer]')) return;

    const footerShell = document.createElement('div');
    footerShell.className = 'home home--rebuild marshall-page__shared-home-footer';
    footerShell.setAttribute('data-shared-home-footer', '');

    const footerSection = document.createElement('section');
    footerSection.className = 'section contacts contacts--figma';
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

        <div class="contacts__links-row reveal">
          <a class="contacts__link contacts__link--telegram" href="https://t.me/imrafaelaliev" target="_blank" rel="noopener noreferrer">telegram</a>
          <a
            class="contacts__link contacts__link--linkedin"
            href="https://www.linkedin.com/in/rafael-aliev-a10539399/"
            target="_blank"
            rel="noopener noreferrer"
            >linkedin</a
          >
          <a class="contacts__link contacts__link--email" href="mailto:rafaelaliev53@gmail.com">email</a>
        </div>

        <div class="contacts__banner reveal" aria-hidden="true">
          <img
            class="contacts__banner-image contacts__banner-image--mobile"
            src="../assets/images/home/footer-banner-mobile-figma.png"
            alt=""
            loading="lazy"
            decoding="async"
          />
          <img class="contacts__banner-bg" src="../assets/images/home/footer-bg.png" alt="" loading="lazy" decoding="async" />
          <img class="contacts__banner-word" src="../assets/images/home/footer-word.svg" alt="" loading="lazy" decoding="async" />
        </div>
      </div>
    `;

    footerShell.appendChild(footerSection);
    mainNode.appendChild(footerShell);
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
