import { getIcon } from './icons.js';
import { exportBracketSVG } from '../store/capture.js';

function injectStaticModalsHTML() {
    if (document.getElementById('privacy-modal')) return;

    const html = `
        <!-- PRIVACY MODAL -->
        <div id="privacy-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.81); z-index: 1000; justify-content: center; align-items: center;">
            <div style="background: var(--bg-panel); padding: 30px; border-radius: 8px; max-width: 400px; border: 2px solid var(--accent); text-align: center;">
                <h2 style="color: var(--accent); margin-top: 0;">Privacy Notice</h2>
                <p style="color: var(--text-main); font-size: 14px; line-height: 1.6;">This application runs entirely locally in your web browser. <br><br><strong>No data is collected, tracked, or sent to any external servers.</strong><br><br>All tournament data is saved strictly in your device's local storage and via the manual JSON export files.</p>
                <button id="btn-close-privacy" style="margin-top: 20px; background: var(--accent); color: var(--text-on-accent); border: none; padding: 10px 30px; border-radius: 4px; cursor: pointer; font-weight: bold;">Close</button>
            </div>
        </div>

        <!-- SOURCE & LICENSE MODAL -->
        <div id="license-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.81); z-index: 1000; justify-content: center; align-items: center;">
            <div style="background: var(--bg-panel); padding: 30px; border-radius: 8px; max-width: 420px; border: 2px solid var(--accent); text-align: center;">
                <h2 style="color: var(--accent); margin-top: 0;">Source & License</h2>
                <p style="color: var(--text-main); font-size: 14px; line-height: 1.6; margin-bottom: 12px;">
                    &copy; 2026 Linok-B.<br>
                    Licensed under the <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer" style="color: var(--accent); font-weight: bold; text-decoration: underline;">GNU AGPLv3</a>.
                </p>
                <p style="color: var(--text-muted); font-size: 12px; line-height: 1.5; margin-bottom: 20px;">
                    This project is free and open-source software. You are free to inspect, modify, and distribute it under the terms of the AGPLv3.
                </p>
                <div style="display: flex; flex-direction: column; gap: 12px; align-items: center;">
                    <a id="link-repo" href="https://github.com/Linok-B/linok-tournament" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: var(--bg-dark); color: var(--accent); border: 1px solid var(--border-main); padding: 8px 16px; border-radius: 4px; font-size: 12px; text-decoration: none; font-weight: bold;">
                        View Source Repository
                    </a>
                    <button id="btn-close-license" style="background: var(--accent); color: var(--text-on-accent); border: none; padding: 8px 30px; border-radius: 4px; cursor: pointer; font-weight: bold;">Close</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
}

export function initStaticModals(getTournamentName) {

    injectStaticModalsHTML();
    
    // hamburgur :tongue:
    // Sidebar Toggle
    document.getElementById('btn-hamburger').addEventListener('click', () => {
        document.body.classList.toggle('sidebar-hidden');
    });
    
    // Eye Icon (Streamer Mode Toggle)
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'btn-streamer-mode') {
            document.body.classList.toggle('streamer-mode');
            
            // Change icon based on state
            if (document.body.classList.contains('streamer-mode')) {
                e.target.innerHTML = getIcon('openEye', 20);
            } else {
                e.target.innerHTML = getIcon('closedEye', 20);
            }
            // Ensure background always matches the panel
            e.target.style.background = "var(--bg-panel)";
            e.target.style.color = "var(--text-main)";
        }
    });

    // PRIVACY MODAL
    const privacyModal = document.getElementById('privacy-modal');
    document.getElementById('btn-privacy').addEventListener('click', () => {
        privacyModal.style.display = 'flex';
    });
    document.getElementById('btn-close-privacy').addEventListener('click', () => {
        privacyModal.style.display = 'none';
    });
    privacyModal.addEventListener('click', (e) => {
        if (e.target === privacyModal) {
            privacyModal.style.display = 'none';
        }
    });

    // Source Modal
    const licenseModal = document.getElementById('license-modal');
    const btnSourceLicense = document.getElementById('btn-source-license');
    const btnCloseLicense = document.getElementById('btn-close-license');

    if (btnSourceLicense) {
        btnSourceLicense.addEventListener('click', () => {
            licenseModal.style.display = 'flex';
        });
    }

    if (btnCloseLicense) {
        btnCloseLicense.addEventListener('click', () => {
            licenseModal.style.display = 'none';
        });
    }

    if (licenseModal) {
        licenseModal.addEventListener('click', (e) => {
            if (e.target === licenseModal) {
                licenseModal.style.display = 'none';
            }
        });
    }

    // NATIVE SVG CAPTURE ENGINE
    document.addEventListener('click', (e) => {
        if (e.target && e.target.closest('#btn-capture-bracket')) {
            const name = typeof getTournamentName === 'function' ? getTournamentName() : 'Tournament';
            exportBracketSVG(name);
        }
    });
    
    // smh had to actually implement these instead of my 0.8 sloppy trick 
    // smh had to even make each thing own themselves
    // Safely close modals on outside click
    // 1. Warning Modal
    document.getElementById('warning-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.target.style.display = 'none';
    });

    // 2. End Stage Modal
    document.getElementById('end-stage-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.target.style.display = 'none';
    });

    // 3. Global Settings Modal
    document.getElementById('settings-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.target.style.display = 'none';
    });

    // 4. Tiebreaker Modal + mem purge
    document.getElementById('tiebreaker-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            document.getElementById('btn-close-tb-builder')?.click();
        }
    });
}
