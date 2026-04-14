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
      title: 'MARSHALL Autoparts',
      image: 'assets/images/marshall/hero-cover-20260407.png?v=20260407-marshall-cover-1',
      captionClass: 'marshall-page__next-case-caption--project',
      summary:
        'Объединил 3 сайта в единый E-commerce сервис и сократил путь до покупки с 5 до 3 шагов. Ускорил добавление в корзину с 15 до 8 секунд.',
      role: 'Продуктовый дизайнер',
      tags: ['e-commerce', 'b2b & b2c']
    },
    {
      slug: 'hios',
      title: 'HiOS (Tecno и Infinix)',
      image: 'assets/images/hios/hero-preview.png',
      captionClass: 'marshall-page__next-case-caption--project',
      summary:
        'Провел анализ рынка ОС в РФ и разработал дизайн-концепцию операционной системы с аудиторией 10+ млн. человек. В основе — русский культурный код. Ожидаем полугодовое удержание на уровне 70% и увеличение доли компании на рынке',
      role: 'UI/UX дизайнер',
      tags: ['operating system', 'b2c']
    },
    {
      slug: 'sladonezh',
      title: 'Корпоративный сайт Сладонеж',
      image: 'assets/images/sladonezh/hero-preview.png',
      captionClass: 'marshall-page__next-case-caption--project',
      summary: 'С нуля сделали дизайн крупного производителя кондитерских изделий.',
      role: 'UI/UX дизайнер',
      tags: ['corporate site', 'b2b']
    },
    {
      slug: 'lori',
      title: 'Lori Mobile App',
      image: 'assets/images/lori/hero-preview.png',
      captionClass: 'marshall-page__next-case-caption--project',
      summary: 'Разработал механику удержания в приложении для трекинга питания через привычки и эмоциональную вовлеченность',
      role: 'Продуктовый дизайнер',
      tags: ['medtech', 'mvp', 'b2c']
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
  const FORCED_NEXT_CASE_BY_SLUG = {
    hios: 'lori',
    lori: 'marshall'
  };
  const CANONICAL_NEXT_TITLE_BY_SLUG = {
    marshall: 'MARSHALL Autoparts',
    hios: 'HiOS (Tecno и Infinix)',
    lori: 'Lori Mobile App'
  };

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
      return FALLBACK_CASE_SEQUENCE;
    }
    return readStoredCaseSequence() || FALLBACK_CASE_SEQUENCE;
  };

  const buildCaseSequenceFromCards = (cards = []) =>
    cards
      .map((card) => {
        const caseLink = card.matches('a[data-case-link]') ? card : card.querySelector('a[data-case-link]');
        if (!caseLink) return null;

        const slug = extractCaseSlug(caseLink.getAttribute('href') || '');
        if (!slug) return null;

        const fallback = caseMetaBySlug.get(slug);
        const titleNode = card.querySelector('.project-item__title, .mentions__caption');
        const domTitle = titleNode ? titleNode.textContent.replace(/\s+/g, ' ').trim() : '';
        const imageNode = card.querySelector('.project-item__desktop .project-card__cover, .project-card__cover, .mentions__cover img, img');
        const domImage = imageNode ? (imageNode.getAttribute('src') || '').trim() : '';
        const descriptionNode = card.querySelector('.project-item__desktop .project-card__description, .project-card__description');
        const roleNode = card.querySelector('.project-item__desktop .project-card__role-text, .project-card__role-text');
        const desktopScope = card.querySelector('.project-item__desktop') || card;
        const tags = Array.from(desktopScope.querySelectorAll('.project-card__tag'))
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

    const cards = Array.from(document.querySelectorAll('.project-item, .mentions__card[data-case-link]'));
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
      const cards = Array.from(doc.querySelectorAll('.project-item, .mentions__card[data-case-link]'));
      if (!cards.length) return;

      const sequence = buildCaseSequenceFromCards(cards);
      if (!sequence.length) return;

      storage.set(CASE_SEQUENCE_KEY, JSON.stringify(sequence));
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
    if (CANONICAL_NEXT_TITLE_BY_SLUG[nextCaseResolved.slug]) {
      nextCaseResolved.title = CANONICAL_NEXT_TITLE_BY_SLUG[nextCaseResolved.slug];
    }
    const nextHref = `../${nextCase.slug}/`;
    nextCaseLink.setAttribute('href', isFileProtocol ? `${nextHref}index.html` : nextHref);
    nextCaseLink.setAttribute('aria-label', `Открыть следующий кейс: ${nextCaseResolved.title}`);

    const imageSource = toCasePreviewSrc(nextCaseResolved.image);
    const nextCaseImage = nextCaseLink.querySelector('.marshall-page__next-case-preview');
    if (nextCaseImage) {
      if (imageSource) nextCaseImage.setAttribute('src', imageSource);
      nextCaseImage.setAttribute('alt', `Следующий кейс: ${nextCaseResolved.title}`);
    }

    const baseTitle = String(nextCaseResolved.title || '').replace(/\s*↳+\s*$/, '').trim();
    const titleWithArrow = baseTitle ? `${baseTitle}↳` : '';
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
  const injectSharedCaseFooter = () => {
    if (!document.body.classList.contains('marshall-page')) return;

    document.querySelectorAll('.marshall-page__footer').forEach((footerNode) => footerNode.remove());
    document.querySelectorAll('[data-shared-home-footer]').forEach((footerNode) => footerNode.remove());

    const rootNode = document.body;
    if (!rootNode) return;

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
            href="https://www.behance.net/rafaelaliev"
            target="_blank"
            rel="noopener noreferrer"
            >behance</a
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
          <img class="contacts__banner-bg" src="../assets/images/home/footer-banner-figma-406-851.png" alt="" loading="lazy" decoding="async" />
        </div>
      </div>
    `;

    footerShell.appendChild(footerSection);
    rootNode.appendChild(footerShell);
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
