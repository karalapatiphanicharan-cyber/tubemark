// TubeMark Popup Script - Phase 1 Minimal UI Interaction
document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save-bookmark-btn');
  const toast = document.getElementById('toast');
  let toastTimeout = null;

  if (saveBtn && toast) {
    saveBtn.addEventListener('click', () => {
      // Clear any existing active timeout
      if (toastTimeout) {
        clearTimeout(toastTimeout);
      }

      // Set text content and show the toast
      toast.textContent = 'Coming in the next phase!';
      toast.classList.remove('hidden');

      // Hide toast after 2.5 seconds
      toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
      }, 2500);
    });
  }

  console.log('TubeMark Phase 1 Popup UI successfully initialized.');
});
