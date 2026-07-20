const toast = document.querySelector('.toast');
let toastTimer;

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
