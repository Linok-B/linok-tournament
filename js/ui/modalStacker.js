// good \:D modal z-index & backdrop stacker
let modalStack = [];

function refreshModalStack() {
    // Clean up closed or unmounted modals from stack
    modalStack = modalStack.filter(el => {
        if (!document.body.contains(el)) return false;
        return el.style.display === 'flex' && el.style.position === 'fixed';
    });

    // Assign z-index and backdrops based on chronological open order
    modalStack.forEach((el, index) => {
        el.style.zIndex = (1000 + index * 20).toString();
        if (index === 0) {
            // Bottom-most modal provides the unified backdrop
            el.style.background = 'rgba(0, 0, 0, 0.8)';
        } else {
            // All stacked modals are transparent (zero double-darkening)
            el.style.background = 'transparent';
        }
    });
}

function handleModalOpen(el) {
    if (el.tagName !== 'DIV') return;
    if (el.style.position === 'fixed' && el.style.display === 'flex') {
        const isFullscreen = el.style.width === '100vw' || el.style.width === '100%' || (el.style.top === '0px' && el.style.left === '0px');
        if (isFullscreen) {
            if (!modalStack.includes(el)) {
                modalStack.push(el);
            }
            refreshModalStack();
        }
    }
}

function handleModalClose(el) {
    if (modalStack.includes(el)) {
        modalStack = modalStack.filter(x => x !== el);
        el.style.zIndex = '';
        el.style.background = '';
        refreshModalStack();
    }
}

export function initModalStacker() {
    const modalObserver = new MutationObserver((mutations) => {
        modalObserver.disconnect();

        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) handleModalOpen(node);
                });
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === 1) handleModalClose(node);
                });
            } else if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const el = mutation.target;
                if (el.style.display === 'flex') {
                    handleModalOpen(el);
                } else if (el.style.display === 'none') {
                    handleModalClose(el);
                }
            }
        });

        modalObserver.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['style'] });
    });

    modalObserver.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['style'] });
}
