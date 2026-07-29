(() => {
  const dialog = document.querySelector('.lightbox');
  const dialogImage = dialog.querySelector('img');
  const dialogCaption = dialog.querySelector('p');
  const close = () => dialog.close();
  const open = (image) => {
    dialogImage.src = image.currentSrc || image.src;
    dialogImage.alt = image.alt;
    dialogCaption.textContent = image.closest('figure')?.querySelector('figcaption')?.textContent || image.alt;
    dialog.showModal();
    dialog.querySelector('button').focus();
  };
  document.querySelectorAll('.image-link img').forEach((image) => {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `Enlarge photograph: ${image.alt}`);
    image.addEventListener('click', () => open(image));
    image.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(image);
      }
    });
  });
  dialog.querySelector('button').addEventListener('click', close);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  const links = [...document.querySelectorAll('.rail nav a')];
  const sections = links.map((link) => document.querySelector(link.hash)).filter(Boolean);
  const progress = document.querySelector('.progress-wrap span');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) links.forEach((link) => link.classList.toggle('active', link.hash === `#${entry.target.id}`)); });
  }, { rootMargin: '-20% 0px -70% 0px' });
  sections.forEach((section) => observer.observe(section));
  addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.height = `${max ? (scrollY / max) * 100 : 0}%`;
  }, { passive: true });
})();
