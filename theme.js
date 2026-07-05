const themes = [
  { name: '暗夜', icon: '🌙', theme: 'dark' },
  { name: '春', icon: '🌸', theme: 'spring' },
  { name: '夏', icon: '☀️', theme: 'summer' },
  { name: '秋', icon: '🍂', theme: 'autumn' },
  { name: '冬', icon: '❄️', theme: 'winter' }
];

let currentThemeIndex = 0;

function setTheme(index) {
  const theme = themes[index];
  document.body.setAttribute('data-theme', theme.theme);

  const iconEl = document.getElementById('themeIcon');
  const nameEl = document.getElementById('themeName');
  if (iconEl) iconEl.textContent = theme.icon;
  if (nameEl) nameEl.textContent = theme.name;

  const dots = document.querySelectorAll('.theme-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });

  localStorage.setItem('wakfu-theme', index.toString());
  currentThemeIndex = index;
}

function nextTheme() {
  currentThemeIndex = (currentThemeIndex + 1) % themes.length;
  setTheme(currentThemeIndex);
}

function initTheme() {
  const themeSwitcher = document.createElement('div');
  themeSwitcher.className = 'theme-switcher';
  themeSwitcher.id = 'themeSwitcher';
  themeSwitcher.title = '切换主题';
  themeSwitcher.innerHTML = `
    <div class="theme-tooltip">点击切换主题</div>
    <div class="theme-icon" id="themeIcon">🌙</div>
    <span class="theme-name" id="themeName">暗夜</span>
    <div class="theme-dots">
      <div class="theme-dot"></div>
      <div class="theme-dot"></div>
      <div class="theme-dot"></div>
      <div class="theme-dot"></div>
      <div class="theme-dot active"></div>
    </div>
  `;
  document.body.appendChild(themeSwitcher);

  themeSwitcher.addEventListener('click', nextTheme);

  const savedTheme = localStorage.getItem('wakfu-theme');
  if (savedTheme !== null) {
    setTheme(parseInt(savedTheme, 10));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}