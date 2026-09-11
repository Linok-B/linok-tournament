import { getIcon } from './icons.js';
import { exportBracketSVG } from '../store/capture.js';

export function initStaticModals(getTournamentName) {
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
    document.getElementById('warning-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.target.style.display = 'none';
    });

    // 2. End Stage Modal
    document.getElementById('end-stage-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.target.style.display = 'none';
    });

    // 3. Global Settings Modal
    document.getElementById('settings-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.target.style.display = 'none';
    });

    // 4. Tiebreaker Modal + mem purge
    document.getElementById('tiebreaker-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            document.getElementById('btn-close-tb-builder').click();
        }
    });
}
