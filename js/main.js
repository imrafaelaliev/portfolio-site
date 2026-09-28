(() => {
  document.documentElement.classList.add('js');

  const siteChrome = document.querySelector('.site-chrome');
  const menuToggle = siteChrome?.querySelector('.hero__menu-toggle');
  const navigation = siteChrome?.querySelector('.hero__side-nav');
  const menuBackdrop = siteChrome?.querySelector('.hero__menu-backdrop');
  if (menuToggle && navigation && menuBackdrop) {
    const closeMenu = () => {
      navigation.classList.remove('is-open');
      siteChrome.classList.remove('is-menu-open');
      document.body.classList.remove('mobile-menu-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Открыть меню');
    };

    menuToggle.addEventListener('click', () => {
      const isOpen = navigation.classList.toggle('is-open');
      siteChrome.classList.toggle('is-menu-open', isOpen);
      document.body.classList.toggle('mobile-menu-open', isOpen);
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.setAttribute('aria-label', isOpen ? 'Закрыть меню' : 'Открыть меню');
    });
    menuBackdrop.addEventListener('click', closeMenu);
    navigation.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
  }

  const hero = document.querySelector('.home--rebuild .hero--figma');
  if (hero) {
    const portfolioFooter = document.querySelector('#contacts.portfolio-footer');
    const updateHeroChrome = () => {
      const heroBottom = hero.getBoundingClientRect().bottom;
      const actionsTop = document.querySelector('.site-chrome .hero__actions').getBoundingClientRect().top;
      const footerRect = portfolioFooter?.getBoundingClientRect();
      if (portfolioFooter && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) {
        portfolioFooter.classList.add('is-filled');
      }
      document.body.classList.toggle('about-intro-visible', heroBottom <= 32);
      document.body.classList.toggle('hero-controls-on-white', heroBottom <= actionsTop);
      document.body.classList.toggle('hero-menu-on-white', heroBottom <= 68);
      document.body.classList.toggle('footer-in-view', !!footerRect && footerRect.top <= actionsTop && footerRect.bottom > actionsTop);
      document.body.classList.toggle('footer-is-filled', !!portfolioFooter?.classList.contains('is-filled'));
    };
    updateHeroChrome();
    window.addEventListener('scroll', updateHeroChrome, { passive: true });
    window.addEventListener('resize', updateHeroChrome);

    if (document.documentElement.classList.contains('hero-intro-playing')) {
      const finishIntro = () => {
        if (!document.documentElement.classList.contains('hero-intro-playing')) return;
        document.documentElement.classList.remove('hero-intro-playing');
        document.documentElement.classList.add('hero-intro-complete');
        window.removeEventListener('scroll', skipIntroOnScroll);
      };
      const skipIntroOnScroll = () => {
        if (window.scrollY > 32) finishIntro();
      };
      if (window.scrollY > 32) {
        finishIntro();
      } else {
        const activeSignature = hero.querySelector(
          window.matchMedia('(max-width: 1199px)').matches
            ? '.hero__signature-art--mobile'
            : '.hero__signature-art--desktop'
        );
        activeSignature?.querySelector('path:last-child')?.addEventListener('animationend', finishIntro, { once: true });
        window.addEventListener('scroll', skipIntroOnScroll, { passive: true });
        window.setTimeout(finishIntro, 4500);
      }
    }

    const ovalImage = hero.querySelector('.hero__oval-image');
    const previewNodes = document.querySelectorAll(
      '#projects .project-showcase__image, .mentions-reel__media img'
    );
    const previews = Array.from(previewNodes, (node) => ({
      src: node.getAttribute('src'),
      alt: node.getAttribute('alt') || 'Работа из портфолио'
    })).filter((item, index, items) => item.src && items.findIndex((candidate) => candidate.src === item.src) === index);

    if (previews.length > 1) {
      let currentSrc = ovalImage.getAttribute('src');
      let loading = false;

      window.setInterval(() => {
        if (loading) return;
        const choices = previews.filter((item) => item.src !== currentSrc);
        const next = choices[Math.floor(Math.random() * choices.length)];
        const incoming = new Image();
        loading = true;
        incoming.onload = () => {
          ovalImage.src = next.src;
          ovalImage.alt = next.alt;
          currentSrc = next.src;
          loading = false;
        };
        incoming.onerror = () => {
          loading = false;
        };
        incoming.src = next.src;
      }, 500);
    }
  }

  const mentionsSection = document.querySelector('.home--rebuild .mentions--redesign');
  if (mentionsSection) {
    const media = Array.from(mentionsSection.querySelectorAll('.mentions-reel__media'));
    const currentLabel = mentionsSection.querySelector('.mentions-reel__current');
    const mobileLayout = window.matchMedia('(max-width: 1199px)');
    let activeIndex = -1;
    let scrollFrame = 0;

    const updateMentions = () => {
      scrollFrame = 0;
      if (mobileLayout.matches || !media.length) return;

      const sectionTop = mentionsSection.getBoundingClientRect().top;
      const scrollDistance = Math.max(1, mentionsSection.offsetHeight - window.innerHeight);
      const stageLength = scrollDistance / media.length;
      const nextIndex = Math.min(media.length - 1, Math.max(0, Math.floor(-sectionTop / stageLength)));
      if (nextIndex === activeIndex) return;

      activeIndex = nextIndex;
      media.forEach((item, index) => item.classList.toggle('is-active', index === activeIndex));
      currentLabel.textContent = media[activeIndex].closest('[data-mentions-project]').dataset.mentionsProject;
    };

    const queueMentionsUpdate = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(updateMentions);
    };

    window.addEventListener('scroll', queueMentionsUpdate, { passive: true });
    window.addEventListener('resize', () => {
      activeIndex = -1;
      queueMentionsUpdate();
    });
    updateMentions();
  }

  const conceptVideos = Array.from(document.querySelectorAll('.concepts-grid__video-frame'));
  if (conceptVideos.length) {
    if (window.Vimeo?.Player) {
      conceptVideos.forEach((video) => {
        const player = new window.Vimeo.Player(video);
        player.on('play', () => video.classList.add('is-playing'));
        player.on('error', () => video.classList.remove('is-playing'));
      });
    }
    window.addEventListener('message', (event) => {
      if (event.origin !== 'https://player.vimeo.com') return;
      const video = conceptVideos.find((frame) => frame.contentWindow === event.source);
      if (!video) return;
      let payload = event.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }
      if (payload?.event === 'ready') {
        video.contentWindow.postMessage({ method: 'addEventListener', value: 'play' }, 'https://player.vimeo.com');
      }
      if (payload?.event === 'play' || payload?.event === 'playing') {
        video.classList.add('is-playing');
      }
    });
  }

  const revealAll = () => {
    document.querySelectorAll('.reveal, .motion-reveal').forEach((node) => node.classList.add('is-visible'));
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
      title: 'Веб-сервис MARSHALL Autoparts',
      image: 'assets/images/marshall/hero-cover-20260407.png?v=20260407-marshall-cover-1',
      captionClass: 'marshall-page__next-case-caption--project',
      summary:
        'Объединил 3 сайта в единый E-commerce сервис и сократил путь до покупки с 5 до 3 шагов. Ускорил добавление в корзину с 15 до 8 секунд.',
      role: 'Продуктовый дизайнер',
      tags: ['B2B & B2C', 'Web', 'E-commerce']
    },
    {
      slug: 'hios',
      title: 'Дизайн операционной системы HiOS (Tecno и Infinix)',
      image: 'assets/images/home/projects-redesign/hios.png',
      captionClass: 'marshall-page__next-case-caption--project',
      summary:
        'Провел анализ рынка ОС в РФ и разработал дизайн-концепцию операционной системы с аудиторией 10+ млн. человек. В основе — русский культурный код',
      role: 'UI/UX дизайнер',
      tags: ['B2C', 'Mobile', 'Operating system']
    },
    {
      slug: 'lori',
      title: 'Мобильное приложение для трекинга калорий',
      image: 'assets/images/home/projects-redesign/calorie-tracker.png',
      captionClass: 'marshall-page__next-case-caption--project',
      summary: 'Разработал механику удержания в приложении для трекинга питания через привычки и эмоциональную вовлеченность.',
      role: 'Продуктовый дизайнер',
      tags: ['B2C', 'Mobile', 'Medtech']
    }
  ];
  const caseMetaBySlug = new Map(FALLBACK_CASE_SEQUENCE.map((item) => [item.slug, item]));
  const FORCED_NEXT_CASE_BY_SLUG = {};
  let fetchedCaseSequence = null;

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

  const toAbsoluteCaseHref = (href) => {
    const slug = extractCaseSlug(href || '');
    return slug ? `/${slug}/index.html` : href;
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

  const escapeHtml = (value) =>
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

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
          const summary = typeof entry.summary === 'string' && entry.summary.trim() ? entry.summary.trim() : fallback?.summary || '';
          const role = typeof entry.role === 'string' && entry.role.trim() ? entry.role.trim() : fallback?.role || '';
          const tags = Array.isArray(entry.tags) && entry.tags.length ? entry.tags : fallback?.tags || [];
          const captionClass =
            typeof entry.captionClass === 'string' && NEXT_CASE_CAPTION_CLASSES.includes(entry.captionClass)
              ? entry.captionClass
              : fallback?.captionClass || 'marshall-page__next-case-caption--project';

          return {
            slug,
            title,
            image,
            summary,
            role,
            tags,
            captionClass
          };
        })
        .filter(Boolean);

      return normalized.length ? normalized : null;
    } catch {
      return null;
    }
  };

  const getCaseSequence = () => {
    if (document.body.classList.contains('marshall-page')) {
      return fetchedCaseSequence || FALLBACK_CASE_SEQUENCE;
    }
    return readStoredCaseSequence() || FALLBACK_CASE_SEQUENCE;
  };

  const getProjectTitle = (node) => {
    if (!node) return '';
    const copy = node.cloneNode(true);
    copy.querySelectorAll('br').forEach((breakNode) => breakNode.replaceWith(' '));
    return copy.textContent.replace(/\s+/g, ' ').trim();
  };

  const buildCaseSequenceFromCards = (cards = []) =>
    cards
      .map((card) => {
        const caseLink = card.matches('a[data-case-link]') ? card : card.querySelector('a[data-case-link]');
        if (!caseLink) return null;

        const slug = extractCaseSlug(caseLink.getAttribute('href') || '');
        if (!slug) return null;

        const fallback = caseMetaBySlug.get(slug);
        const titleNode = card.querySelector('.project-showcase__title, .project-item__title, .mentions__caption');
        const domTitle = getProjectTitle(titleNode);
        const imageNode = card.querySelector('.project-showcase__image, .project-item__desktop .project-card__cover, .project-card__cover, .mentions__cover img, img');
        const domImage = imageNode ? (imageNode.getAttribute('src') || '').trim() : '';
        const descriptionNode = card.querySelector('.project-showcase__description, .project-item__desktop .project-card__description, .project-card__description');
        const roleNode = card.querySelector('.project-item__desktop .project-card__role-text, .project-card__role-text');
        const desktopScope = card.querySelector('.project-item__desktop') || card;
        const tags = Array.from(desktopScope.querySelectorAll('.project-showcase__tags li, .project-card__tag'))
          .map((tagNode) => tagNode.textContent.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .filter((tag, idx, all) => all.indexOf(tag) === idx);

        return {
          slug,
          title: domTitle || fallback?.title || slug,
          image: domImage || fallback?.image || '',
          summary: descriptionNode ? descriptionNode.textContent.replace(/\s+/g, ' ').trim() : fallback?.summary || '',
          role: roleNode ? roleNode.textContent.replace(/\s+/g, ' ').trim() : fallback?.role || '',
          tags: tags.length ? tags : fallback?.tags || [],
          captionClass: fallback?.captionClass || 'marshall-page__next-case-caption--project'
        };
      })
      .filter(Boolean);

  const storeCaseSequenceFromHome = () => {
    if (!document.body.classList.contains('home')) return;

    const cards = Array.from(document.querySelectorAll('.project-showcase__card[data-case], .project-item, .mentions__card[data-case-link]'));
    if (!cards.length) return;

    const sequence = buildCaseSequenceFromCards(cards);

    if (!sequence.length) return;

    storage.set(CASE_SEQUENCE_KEY, JSON.stringify(sequence));
  };

  const refreshCaseSequenceFromHomePage = async () => {
    if (isFileProtocol) return;

    try {
      const response = await fetch('../index.html', { credentials: 'same-origin' });
      if (!response.ok) return;

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const cards = Array.from(doc.querySelectorAll('.project-showcase__card[data-case], .project-item, .mentions__card[data-case-link]'));
      if (!cards.length) return;

      const sequence = buildCaseSequenceFromCards(cards);
      if (!sequence.length) return;

      fetchedCaseSequence = sequence;
      storage.set(CASE_SEQUENCE_KEY, JSON.stringify(sequence));
      const currentCase = sequence.find((entry) => entry.slug === getCurrentCaseSlug());
      const caseHeading = document.querySelector('body.marshall-page .marshall-page__title');
      if (currentCase && caseHeading) {
        if (getProjectTitle(caseHeading) !== currentCase.title) {
          caseHeading.textContent = currentCase.title;
        }
        document.title = `${currentCase.title} — кейс Рафаэля Алиева`;
      }
      syncNextCaseCard();
    } catch {
      // Keep fallback behavior when preload from home is unavailable.
    }
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

    const forcedNextSlug = FORCED_NEXT_CASE_BY_SLUG[currentSlug] || '';
    const forcedNextCase = forcedNextSlug
      ? caseSequence.find((entry) => entry.slug === forcedNextSlug) || caseMetaBySlug.get(forcedNextSlug)
      : null;
    const sequenceNextCase = caseSequence[(currentIndex + 1) % caseSequence.length];
    const nextCase = forcedNextCase || sequenceNextCase;
    const nextCaseMeta = caseMetaBySlug.get(nextCase.slug) || {};
    const nextCaseResolved = {
      ...nextCaseMeta,
      ...nextCase
    };
    const webNextHref = `/${nextCase.slug}/index.html`;
    const localNextHref = `../${nextCase.slug}/index.html`;
    nextCaseLink.setAttribute('href', isFileProtocol ? localNextHref : webNextHref);
    nextCaseLink.setAttribute('aria-label', `Открыть следующий кейс: ${nextCaseResolved.title}`);

    const imageSource = toCasePreviewSrc(nextCaseResolved.image);
    const nextCaseImage = nextCaseLink.querySelector('.marshall-page__next-case-preview');
    if (nextCaseImage) {
      if (imageSource) nextCaseImage.setAttribute('src', imageSource);
      nextCaseImage.setAttribute('alt', `Следующий кейс: ${nextCaseResolved.title}`);
    }

    const baseTitle = String(nextCaseResolved.title || '').replace(/\s*↳+\s*$/, '').trim();
    const titleWithArrow = baseTitle;
    const description = nextCaseResolved.summary ? String(nextCaseResolved.summary).trim() : '';
    const role = nextCaseResolved.role ? String(nextCaseResolved.role).trim() : '';
    const tags = Array.isArray(nextCaseResolved.tags)
      ? nextCaseResolved.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];

    let tagsHtml = '';
    if (tags.length >= 3) {
      tagsHtml = `
        <div class="project-card__tags project-card__tags--triple">
          <span class="project-card__tag">${escapeHtml(tags[0])}</span>
          <div class="project-card__tags-row">
            ${tags
              .slice(1)
              .map((tag) => `<span class="project-card__tag">${escapeHtml(tag)}</span>`)
              .join('')}
          </div>
        </div>
      `;
    } else if (tags.length) {
      tagsHtml = `
        <div class="project-card__tags">
          ${tags.map((tag) => `<span class="project-card__tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      `;
    }

    const roleHtml = role
      ? `
        <div class="project-card__role">
          <p class="project-card__role-label">Роль</p>
          <span class="project-card__role-dot"></span>
          <p class="project-card__role-text">${escapeHtml(role)}</p>
        </div>
      `
      : '';

    const descriptionHtml = description ? `<p class="project-card__description">${escapeHtml(description)}</p>` : '';

    const isMobileView = window.matchMedia('(max-width: 767px)').matches;
    const roleInCopyHtml = isMobileView ? '' : roleHtml;
    const roleAfterTagsHtml = isMobileView ? roleHtml : '';

    nextCaseLink.innerHTML = `
      <div class="project-item__desktop" aria-hidden="true">
        <div class="project-card__media">
          <img
            class="project-card__cover"
            src="${escapeHtml(imageSource || '')}"
            alt="Следующий кейс: ${escapeHtml(nextCaseResolved.title || '')}"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div class="project-card__content">
          <div class="project-card__copy">
            <p class="project-item__title project-card__title">${escapeHtml(titleWithArrow)}</p>
            ${descriptionHtml}
            ${roleInCopyHtml}
          </div>
          ${tagsHtml}
          ${roleAfterTagsHtml}
        </div>
      </div>
    `;
  };


  if (!isFileProtocol) {
    const caseLinks = Array.from(document.querySelectorAll('a[data-case-link]'));
    caseLinks.forEach((link) => {
      const href = link.getAttribute('href') || '';
      const absoluteHref = toAbsoluteCaseHref(href);
      if (absoluteHref !== href) {
        link.setAttribute('href', absoluteHref);
      }
    });
  }

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
  refreshCaseSequenceFromHomePage();

  const initCompaniesHover = () => {
    const companiesCanvas = document.querySelector('.home.home--rebuild .companies--figma .companies__canvas');
    if (!companiesCanvas) return;

    const clusterNode = companiesCanvas.querySelector('.companies__cluster');
    const items = Array.from(companiesCanvas.querySelectorAll('.companies__item'));
    const detailsNode = companiesCanvas.querySelector('.companies__details');
    const titleNode = detailsNode?.querySelector('.companies__details-title');
    const descriptionNode = detailsNode?.querySelector('.companies__details-description');

    if (!clusterNode || !items.length || !detailsNode || !titleNode || !descriptionNode) return;

    const hoverMedia = window.matchMedia('(min-width: 1200px) and (hover: hover) and (pointer: fine)');
    let activeItem = null;

    const resetHover = () => {
      if (!activeItem) return;
      activeItem = null;
      clusterNode.classList.remove('is-hovering');
      detailsNode.classList.remove('is-visible');
      items.forEach((item) => item.classList.remove('is-active'));
      titleNode.textContent = '';
      descriptionNode.textContent = '';
    };

    const activateItem = (item) => {
      if (!hoverMedia.matches) return;
      const title = (item.dataset.companyTitle || '').trim();
      const description = (item.dataset.companyDescription || '').trim();
      if (!title) return;
      if (activeItem === item) return;

      activeItem = item;
      clusterNode.classList.add('is-hovering');
      detailsNode.classList.add('is-visible');
      items.forEach((node) => node.classList.toggle('is-active', node === item));
      titleNode.textContent = title;
      descriptionNode.textContent = description;
      detailsNode.style.top = `${clusterNode.offsetTop + item.offsetTop + 8}px`;
    };

    clusterNode.addEventListener('pointermove', (event) => {
      const itemNode = event.target.closest('.companies__item');
      if (!itemNode || !clusterNode.contains(itemNode)) {
        resetHover();
        return;
      }
      activateItem(itemNode);
    });

    items.forEach((item) => {
      item.addEventListener('pointerenter', () => activateItem(item));
      item.addEventListener('focus', () => activateItem(item));
      item.addEventListener('blur', () => {
        if (!clusterNode.contains(document.activeElement)) resetHover();
      });
    });

    clusterNode.addEventListener('pointerleave', resetHover);

    const updateMode = () => {
      resetHover();
      items.forEach((item) => { item.disabled = !hoverMedia.matches; });
    };

    hoverMedia.addEventListener('change', updateMode);
    updateMode();
  };

  initCompaniesHover();

  const caseFooter = document.querySelector('body.marshall-page #contacts.portfolio-footer');
  if (caseFooter) {
    const fillCaseFooter = () => {
      const footerRect = caseFooter.getBoundingClientRect();
      const actionsTop = document.querySelector('.case-chrome .hero__actions')?.getBoundingClientRect().top ?? 32;
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) {
        caseFooter.classList.add('is-filled');
      }
      document.body.classList.toggle('footer-in-view', footerRect.top <= actionsTop && footerRect.bottom > actionsTop);
      document.body.classList.toggle('footer-is-filled', caseFooter.classList.contains('is-filled'));
    };
    fillCaseFooter();
    window.addEventListener('scroll', fillCaseFooter, { passive: true });
    window.addEventListener('resize', fillCaseFooter);
  }

  if (document.body.classList.contains('home--rebuild') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const motionSelectors = [
      '.about-intro__collage',
      '.about-intro__lead',
      '.about-intro__orbit',
      '.companies__title',
      '.companies__cluster',
      '.project-showcase__card',
      '.mentions-reel__heading',
      '.concepts-grid__heading',
      '.concepts-grid__card',
      '.portfolio-footer__art',
      '.portfolio-footer__contacts',
      '.portfolio-footer__note'
    ];
    const mobileMentions = window.matchMedia('(max-width: 1199px)');
    motionSelectors.push(mobileMentions.matches ? '.mentions-reel__group' : '.mentions-reel__gallery');
    document.querySelectorAll(motionSelectors.join(', ')).forEach((node) => node.classList.add('motion-reveal'));
    mobileMentions.addEventListener('change', () => {
      document.querySelectorAll('.motion-reveal').forEach((node) => node.classList.add('is-visible'));
    }, { once: true });
  }

  const revealItems = Array.from(document.querySelectorAll('.reveal, .motion-reveal'));

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
