const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

/** Reveal the page only after its fonts, layout and first 3D frames are ready. */
export async function finishPreloader(updateLayout) {
  const root = document.documentElement;
  const loader = document.querySelector('.preloader');
  if (!loader) return;

  await Promise.allSettled([
    document.fonts.load('400 16px "Instrument Serif"'),
    document.fonts.load('400 16px "Manrope"'),
    document.fonts.ready,
  ]);
  // A brief minimum prevents a flash on fast reloads; slow loads add no delay.
  const remaining = Math.max(0, 420 - performance.now());
  if (remaining) await new Promise(resolve => setTimeout(resolve, remaining));
  if (loader.dataset.state === 'failed') return;
  updateLayout?.();
  await nextFrame();
  await nextFrame();
  if (loader.dataset.state === 'failed') return;
  if (getComputedStyle(root).getPropertyValue('--site-styles-ready').trim() !== '1') {
    document.dispatchEvent(new Event('site:loadfailed'));
    return;
  }

  root.removeAttribute('data-loading');
  root.setAttribute('aria-busy', 'false');
  updateLayout?.();
  document.dispatchEvent(new Event('site:ready'));
  loader.dataset.state = 'leaving';

  const hide = () => {
    loader.hidden = true;
    loader.dataset.state = 'ready';
  };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) hide();
  else {
    loader.addEventListener('transitionend', event => {
      if (event.target === loader && event.propertyName === 'opacity') hide();
    }, { once: true });
    // Background tabs may skip transition events; never retain an invisible layer.
    setTimeout(hide, 600);
  }
}
