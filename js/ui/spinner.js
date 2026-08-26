// podium logo spinner module
const BASELINE = 129;              
const NORMAL_H = [38, 58, 24];     
const MIN_H = 15;
const MAX_H = 68;                  
const ALL_MODES = ['random', 'shuffle', 'both'];
const DERANGEMENTS_3 = [[1, 2, 0], [2, 0, 1]];
const anticipateOvershoot = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

let spinnerElement = null;
let isAnimating = false;
let spinnerTimeout = null;
let mode = 'both';

// 1. Inject styles & html into dom once
function initSpinnerDOM() {
    if (spinnerElement) return;

    const style = document.createElement('style');
    style.innerHTML = `
        #app-spinner-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(4px);
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.18s ease-out;
        }
        #app-spinner-overlay.is-visible {
            opacity: 1;
            pointer-events: auto;
        }
        .spinner-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
        }
        .spinner-label {
            color: var(--text-main, #cdd6f4);
            font-size: 13px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            font-family: inherit;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);

    spinnerElement = document.createElement('div');
    spinnerElement.id = 'app-spinner-overlay';
    spinnerElement.innerHTML = `
        <div class="spinner-card">
            <svg id="spinner-logo" xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 200 200" fill="none" style="overflow: visible;">
                <defs>
                    <linearGradient id="spinner-grad" x1="41" y1="177" x2="165" y2="21" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#472380"/>
                        <stop offset="0.5" stop-color="#A72681"/>
                        <stop offset="1" stop-color="#E78888"/>
                    </linearGradient>
                </defs>

                <!-- Hexagonal Frame -->
                <path id="sp-hex"
                    d="M 184.68,45.7 L 101.99,2.08 C 100.61,1.29 98.93,1.26 97.52,2.01 L 15.61,45.06 C 14.37,45.74 14.01,46.81 14.06,48.52 L 14.18,52.71 L 14.11,151.94 C 14.11,153.49 14.79,155.02 16.38,155.71 L 96.98,197.56 C 98.72,198.46 100.5,198.14 101.88,197.38 L 183.79,155.08 C 185.1,154.46 185.46,153.32 185.46,151.94 L 185.19,47.91 C 185.19,47.01 185.08,46.21 184.68,45.7 Z M 173.86,146.36 L 100.09,185.61 C 99.41,186.02 98.92,185.88 98.51,185.67 L 25.68,146.61 V 52.47 L 99.12,13.08 L 173.86,52.47 V 146.36 Z"
                    fill="url(#spinner-grad)"
                />

                <!-- Seamless Podium -->
                <g id="sp-bars">
                    <rect id="sp-bar1" x="46"  width="36.5" y="91"  height="38" fill="url(#spinner-grad)"/>
                    <rect id="sp-bar2" x="82"  width="36.5" y="71"  height="58" fill="url(#spinner-grad)"/>
                    <rect id="sp-bar3" x="118" width="36"   y="105" height="24" fill="url(#spinner-grad)"/>
                </g>
            </svg>
            <div class="spinner-label" id="spinner-msg">Loading...</div>
        </div>
    `;
    document.body.appendChild(spinnerElement);

    // Anchor rotation to svg visual center
    const hex = document.getElementById('sp-hex');
    const hexBox = hex.getBBox();
    hex.style.transformBox = 'view-box';
    hex.style.transformOrigin = `${hexBox.x + hexBox.width / 2}px ${hexBox.y + hexBox.height / 2}px`;
}

// 2. Animation Logic
function randomHeight() { return MIN_H + Math.random() * (MAX_H - MIN_H); }
function applyPermutation(current, perm) { return perm.map(i => current[i]); }

function animateBar(bar, fromH, toH, duration) {
    return bar.animate(
        [ { height: `${fromH}px`, y: `${BASELINE - fromH}px` }, { height: `${toH}px`, y: `${BASELINE - toH}px` } ],
        { duration, easing: anticipateOvershoot, fill: 'forwards' }
    ).finished;
}

function shuffleStep(bars, currentHeights, targetHeights, duration) {
    return Promise.all(bars.map((bar, i) => animateBar(bar, currentHeights[i], targetHeights[i], duration)));
}

function spinHex(hex, duration) {
    const rot = (deg) => `rotate(${deg}deg)`;
    return hex.animate(
        [
            { transform: rot(0), offset: 0 }, { transform: rot(-12), offset: 0.12 },
            { transform: rot(-7), offset: 0.20 }, { transform: rot(300), offset: 0.78 },
            { transform: rot(374), offset: 0.92 }, { transform: rot(360), offset: 1 }
        ],
        { duration, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'forwards' }
    ).finished;
}

async function runAnimationLoop() {
    if (!isAnimating) return;

    const bars = [document.getElementById('sp-bar1'), document.getElementById('sp-bar2'), document.getElementById('sp-bar3')];
    const hex = document.getElementById('sp-hex');
    const shufflePerm = DERANGEMENTS_3[Math.floor(Math.random() * DERANGEMENTS_3.length)];
    let heights = [...NORMAL_H];

    for (let i = 0; i < 2; i++) {
        if (!isAnimating) return;
        let stepType = mode === 'both' ? (Math.random() < (2 / 3) ? 'random' : 'shuffle') : mode;
        const next = stepType === 'shuffle' ? applyPermutation(heights, shufflePerm) : [randomHeight(), randomHeight(), randomHeight()];
        await shuffleStep(bars, heights, next, 270);
        heights = next;
    }

    if (!isAnimating) return;
    const barsBackHome = shuffleStep(bars, heights, NORMAL_H, 320);
    const hexSpin = spinHex(hex, 920);
    await Promise.all([barsBackHome, hexSpin]);

    hex.getAnimations().forEach(a => a.cancel());
    hex.style.transform = 'rotate(0deg)';

    if (!isAnimating) return;
    await new Promise(r => setTimeout(r, 500));
    runAnimationLoop();
}

// 3. Public API
export function startLoading(message = "Loading...", delay = 250) {
    initSpinnerDOM();
    document.getElementById('spinner-msg').innerText = message;
    
    // pick 1/3 random mode on each trigger
    mode = ALL_MODES[Math.floor(Math.random() * ALL_MODES.length)];

    clearTimeout(spinnerTimeout);
    spinnerTimeout = setTimeout(() => {
        spinnerElement.classList.add('is-visible');
        if (!isAnimating) {
            isAnimating = true;
            runAnimationLoop();
        }
    }, delay);
}

export function stopLoading() {
    clearTimeout(spinnerTimeout);
    if (!spinnerElement) return;

    spinnerElement.classList.remove('is-visible');
    isAnimating = false;

    // reset bar positions cleanly
    const bars = [document.getElementById('sp-bar1'), document.getElementById('sp-bar2'), document.getElementById('sp-bar3')];
    if (bars[0]) {
        bars.forEach((bar, i) => {
            bar.getAnimations().forEach(a => a.cancel());
            bar.setAttribute('y', BASELINE - NORMAL_H[i]);
            bar.setAttribute('height', NORMAL_H[i]);
        });
    }
}
