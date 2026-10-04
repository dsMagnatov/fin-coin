import { startStoryCoins } from './story-coins.js';
import { storyProgress, tokenReveal, coinIsRevealed } from './story-progress.js';

export function startStory({ externalFirstCoin = false, onCoinActivity } = {}) {
  const section = document.querySelector('#story');
  const pin = section.querySelector('.story-pin');
  const paragraph = section.querySelector('.story-text');
  const tokens = [];
  // Keep normal spaces and natural desktop line wrapping around the coin slots.
  for (const node of [...paragraph.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const fragment = document.createDocumentFragment();
      for (const part of node.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) fragment.append(document.createTextNode(' '));
        else {
          const word = document.createElement('span');
          word.className = 'story-word';
          word.textContent = part;
          fragment.append(word);
          tokens.push(word);
        }
      }
      node.replaceWith(fragment);
    } else if (node.classList?.contains('story-coin')) tokens.push(node);
  }
  tokens.forEach((token, index) => { token.dataset.readingIndex = String(index); });
  const coins = startStoryCoins({ externalFirstCoin });
  let request = 0;
  let readingState = { progress: 0, activated: [] };
  let previousActivity = null;

  function render() {
    request = 0;
    const rect = section.getBoundingClientRect();
    const progress = storyProgress(rect.top, rect.height, pin.getBoundingClientRect().height);
    const activated = [];
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      if (token.classList.contains('story-coin')) {
        activated[Number(token.dataset.storyCoin)] = coinIsRevealed(progress, index, tokens.length);
      } else {
        const amount = tokenReveal(progress, index, tokens.length);
        const shade = Math.round(48 + amount * 199);
        token.style.color = `rgb(${shade}, ${shade}, ${shade})`;
        token.dataset.reveal = amount.toFixed(3);
      }
    }
    coins.setActive(activated);
    readingState = { progress, activated };
    section.dataset.progress = progress.toFixed(5);
    section.dataset.activeCoins = JSON.stringify(activated);
    section.dataset.tokenCount = String(tokens.length);
    if (!previousActivity || activated.some((active, index) => active !== previousActivity[index])) {
      previousActivity = [...activated];
      onCoinActivity?.([...activated]);
    }
  }

  function update() {
    if (!request) request = requestAnimationFrame(render);
  }

  function fitMobileText() {
    if (!window.matchMedia('(max-width: 900px)').matches) {
      paragraph.style.removeProperty('--story-font-size');
      delete paragraph.dataset.fontSize;
      return;
    }
    // Keep the full reading passage in its pinned frame, leaving room for
    // the fixed header and the two inline coin slots on shorter phones.
    const availableHeight = Math.max(1, pin.getBoundingClientRect().height - 160);
    const setSize = size => {
      const value = `${size}px`;
      if (paragraph.style.getPropertyValue('--story-font-size') !== value) {
        paragraph.style.setProperty('--story-font-size', value);
      }
    };
    let lower = 20;
    let upper = 32;
    setSize(upper);
    if (paragraph.scrollHeight > availableHeight) {
      while (upper - lower > 0.25) {
        const candidate = (lower + upper) / 2;
        setSize(candidate);
        if (paragraph.scrollHeight <= availableHeight) lower = candidate;
        else upper = candidate;
      }
      setSize(Math.floor(lower * 4) / 4);
    }
    paragraph.dataset.fontSize = paragraph.style.getPropertyValue('--story-font-size');
  }

  function resize() {
    fitMobileText();
    coins.resize();
    render();
  }
  window.addEventListener('scroll', update, { passive: true });
  document.fonts.ready.then(resize);
  render();
  resize.getReadingState = () => ({ progress: readingState.progress, activated: [...readingState.activated] });
  return resize;
}
