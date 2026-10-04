export function setupNavigation() {
  const header = document.querySelector('.site-header');
  const toggle = header?.querySelector('.navigation-toggle');
  const navigation = header?.querySelector('.navigation');
  if (!header || !toggle || !navigation) return;

  const mobile = window.matchMedia('(max-width: 900px)');
  const setExpanded = (expanded, returnFocus = false) => {
    const open = expanded && mobile.matches;
    header.dataset.expanded = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    if (returnFocus) toggle.focus({ preventScroll: true });
  };

  toggle.addEventListener('click', () => {
    setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
  });
  document.addEventListener('pointerdown', (event) => {
    if (!header.contains(event.target)) setExpanded(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setExpanded(false, true);
    }
  });
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('.navigation__item')) setExpanded(false);
  });
  mobile.addEventListener('change', () => setExpanded(false));
  setExpanded(false);
}
