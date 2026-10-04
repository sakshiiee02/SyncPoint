/**
 * SyncPoint Web Companion - Official Android APK Download Landing Page
 * Handles deep-link invite code detection and GitHub Releases redirection.
 */

// GitHub Releases download URL from environment or official repo default
const GITHUB_RELEASE_URL =
  import.meta.env?.VITE_GITHUB_RELEASE_URL ||
  'https://github.com/SyncPoint/SyncPoint/releases/latest';

const GITHUB_REPO_URL =
  GITHUB_RELEASE_URL.replace(/\/releases(\/latest)?$/, '');

class SyncPointLandingPage {
  constructor() {
    this.releaseUrl = GITHUB_RELEASE_URL;
    this.repoUrl = GITHUB_REPO_URL;
    this.init();
  }

  init() {
    this.bindDownloadLinks();
    this.checkInviteCode();
  }

  bindDownloadLinks() {
    const downloadBtns = [
      document.getElementById('heroDownloadBtn'),
      document.getElementById('mainDownloadBtn'),
      document.getElementById('navDownloadBtn'),
      document.getElementById('btnInviteDownload'),
    ];

    downloadBtns.forEach((btn) => {
      if (btn) {
        btn.href = this.releaseUrl;
      }
    });

    const repoLink = document.getElementById('footerRepoLink');
    if (repoLink) repoLink.href = this.repoUrl;

    const releasesLink = document.getElementById('footerReleasesLink');
    if (releasesLink) releasesLink.href = `${this.repoUrl}/releases`;
  }

  checkInviteCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code') || urlParams.get('journeyId');

    if (code) {
      const banner = document.getElementById('inviteBanner');
      const text = document.getElementById('inviteText');

      if (banner && text) {
        const cleanCode = code.toUpperCase();
        text.innerHTML = `You have been invited to join convoy <strong>#${cleanCode}</strong>! Download the SyncPoint APK below to join your friends on the shared journey.`;
        banner.classList.remove('hidden');
      }
    }
  }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new SyncPointLandingPage();
});
