const toast = document.querySelector('.toast');
let toastTimer;

const mobileLayoutWidth = 375;

function syncMobileViewport() {
  const isMobileViewport = window.innerWidth <= 600;
  const scale = isMobileViewport ? window.innerWidth / mobileLayoutWidth : 1;
  const layoutHeight = isMobileViewport ? window.innerHeight / scale : 812;

  document.documentElement.style.setProperty('--mobile-scale', String(scale));
  document.documentElement.style.setProperty('--mobile-layout-height', `${layoutHeight}px`);
}

syncMobileViewport();
window.addEventListener('resize', syncMobileViewport);

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 1800);
}

document.querySelector('.appointment-button').addEventListener('click', () => {
  showToast('Переходим к выбору даты и времени');
});

document.querySelector('.family-button').addEventListener('click', () => {
  showToast('Семейные профили');
});

document.querySelectorAll('.record-card').forEach((card) => {
  card.addEventListener('click', () => showToast(card.innerText.replace(/\n/g, ' ')));
});
