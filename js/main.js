(() => {
  document.documentElement.classList.add('js');
  const HOME_SCROLL_KEY = 'portfolioHomeScrollY';
  const RESTORE_HOME_SCROLL_KEY = 'portfolioRestoreHomeScroll';

  if (document.body.classList.contains('home')) {
    const shouldRestore = sessionStorage.getItem(RESTORE_HOME_SCROLL_KEY) === '1';
    const savedScroll = Number.parseFloat(sessionStorage.getItem(HOME_SCROLL_KEY) || '0');

    if (shouldRestore) {
      if (Number.isFinite(savedScroll) && savedScroll >= 0) {
        const prevScrollBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, savedScroll);
        document.documentElement.style.scrollBehavior = prevScrollBehavior;
      }
      sessionStorage.removeItem(RESTORE_HOME_SCROLL_KEY);
    }

    const caseLinks = Array.from(document.querySelectorAll('[data-case-link]'));
    caseLinks.forEach((link) => {
      link.addEventListener('click', () => {
        sessionStorage.setItem(HOME_SCROLL_KEY, String(window.scrollY));
      });
    });
  }

  const backToHomeLinks = Array.from(document.querySelectorAll('[data-back-to-home]'));
  backToHomeLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (sessionStorage.getItem(HOME_SCROLL_KEY) !== null) {
        sessionStorage.setItem(RESTORE_HOME_SCROLL_KEY, '1');
      }
    });
  });

  const revealItems = Array.from(document.querySelectorAll('.reveal'));

  if (revealItems.length) {
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
