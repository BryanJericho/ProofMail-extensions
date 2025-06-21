document.addEventListener("DOMContentLoaded", () => {
    // #region Element References
    const mainAppView = document.getElementById('main-app-view');
    const firstTimeView = document.getElementById('first-time-view'); // KEMBALIKAN INI

    const signButton = document.getElementById("sign-mode");
    const verifyButton = document.getElementById("verify-mode");

    // KEMBALIKAN INI (Tombol dari first-time-view)
    const checkoutWebsiteButton = document.getElementById('checkout-website-button');
    const continueAppButton = document.getElementById('continue-app-button');

    // Elemen-elemen Premium Plan
    const premiumSectionLabel = document.getElementById('premium-section-label');
    const premiumStatusCard = document.getElementById('premium-status-card');
    const currentUsageCount = document.getElementById('current-usage-count');
    const progressBarFill = document.querySelector('.premium-status-card .progress-fill');

    // #endregion Element References

    // #region Constants and Initial Data
    const MAX_USES = 90;
    let usesThisMonth = 0; // Contoh nilai

    const VISITED_KEY = 'proofmailHasVisited';
    const REGISTRATION_URL = 'https://proofmail.com/register'; // KEMBALIKAN INI
    // #endregion Constants and Initial Data


    // #region Utility Functions

    /**
     * Updates the display of current usage count and fills the progress bar.
     */
    function updateUsageDisplay() {
        if (currentUsageCount) {
            currentUsageCount.textContent = usesThisMonth;
        }
        if (progressBarFill) {
            const percentageUsed = (usesThisMonth / MAX_USES) * 100;
            progressBarFill.style.width = `${percentageUsed}%`;
        }
    }

    /**
     * Controls which main view is visible.
     * @param {string} viewToShow - 'main' or 'first-time'.
     */
    function showView(viewToShow) { // KEMBALIKAN FUNGSI INI
        if (viewToShow === 'main') {
            if (mainAppView) mainAppView.classList.remove('hidden');
            if (firstTimeView) firstTimeView.classList.add('hidden');
        } else if (viewToShow === 'first-time') {
            if (mainAppView) mainAppView.classList.add('hidden');
            if (firstTimeView) firstTimeView.classList.remove('hidden');
        }
    }

    /**
     * Executes the specific action for the main application buttons.
     * @param {string} buttonId - The ID of the button that was clicked.
     */
    async function executeMainButtonAction(buttonId) {
        console.log(`Executing action for: ${buttonId}`);
        usesThisMonth++; // Increment usage
        updateUsageDisplay(); // Refresh the display after usage

        if (buttonId === 'sign-mode') {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const userIdMatch = /\/u\/(\d+)\//.exec(tab.url);
            const userId = userIdMatch ? userIdMatch[1] : "0";

            chrome.tabs.create({
                url: `https://mail.google.com/mail/u/${userId}/#inbox?compose=new`
            });
        } else if (buttonId === 'verify-mode') {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    if (window.proofmailManualCheck) {
                        window.proofmailManualCheck();
                    } else {
                        console.error("proofmailManualCheck is not defined in content script.");
                    }
                }
            });
        }
    }

    // #endregion Utility Functions


    // #region Core Logic on DOMContentLoaded
    const hasVisited = localStorage.getItem(VISITED_KEY); // Check visit status

    if (!hasVisited) {
        // Kunjungan PERTAMA KALI (popup baru dibuka)
        console.log("First-time user (popup open). Showing minimal view.");
        showView('main'); // Tampilkan tampilan utama (minimal)
        if (premiumSectionLabel) { // Sembunyikan bagian premium
            premiumSectionLabel.classList.add('hidden');
        }
        if (premiumStatusCard) {
            premiumStatusCard.classList.add('hidden');
        }
        // VISITED_KEY BELUM disetel di sini. Akan disetel saat tombol utama diklik.

    } else {
        // Kunjungan KEDUA KALI atau lebih (popup dibuka oleh returning user)
        console.log("Returning user (popup open). Showing full view.");
        showView('main'); // Tampilkan tampilan utama
        if (premiumSectionLabel) { // Pastikan bagian premium terlihat
            premiumSectionLabel.classList.remove('hidden');
        }
        if (premiumStatusCard) {
            premiumStatusCard.classList.remove('hidden');
        }
        updateUsageDisplay(); // Perbarui tampilan penggunaan
    }
    // #endregion Core Logic on DOMContentLoaded


    // #region Event Listeners

    /**
     * Handles clicks on the main application buttons.
     * Differentiates behavior for first-time vs. returning users.
     * @param {Event} event - The click event.
     */
    async function handleMainButtonClick(event) {
        event.preventDefault(); // Prevent default button action
        const currentVisitedStatus = localStorage.getItem(VISITED_KEY); // Re-check status on click

        if (!currentVisitedStatus) { // Ini adalah user pertama kali YANG KLIK TOMBOL
            console.log("First-time user clicked main button. Redirecting to registration view.");
            showView('first-time'); // Alihkan ke tampilan "suruh registrasi"
            localStorage.setItem(VISITED_KEY, 'true'); // Tandai user sebagai "visited" setelah ini
            // Aksi tombol utama (executeMainButtonAction) TIDAK dijalankan di sini.
            // User harus memilih di halaman registrasi.

        } else {
            // User sudah pernah registrasi atau melewati alur pertama kali
            console.log("Returning user clicked main button. Executing action.");
            const buttonId = event.target.id;
            await executeMainButtonAction(buttonId); // Langsung ke fungsi normal tombol
        }
    }

    // Attach event listeners to main buttons
    if (signButton) {
        signButton.addEventListener("click", handleMainButtonClick);
    }
    if (verifyButton) {
        verifyButton.addEventListener("click", handleMainButtonClick);
    }

    // Event listeners for buttons in the "First Time User" view
    if (checkoutWebsiteButton) { // KEMBALIKAN INI
        checkoutWebsiteButton.addEventListener('click', () => {
            console.log('Checkout Website button clicked from first-time view.');
            window.open(REGISTRATION_URL, '_blank');
        });
    }

    if (continueAppButton) { 
        continueAppButton.addEventListener('click', () => {
            console.log('Continue App button clicked from first-time view. Showing full app.');
            showView('main'); 
            
            if (premiumSectionLabel) {
                premiumSectionLabel.classList.remove('hidden');
            }
            if (premiumStatusCard) {
                premiumStatusCard.classList.remove('hidden');
            }
            updateUsageDisplay(); 
        });
    }

  
});