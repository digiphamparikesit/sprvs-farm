export function formatTanggalIndo(dateString) {
    if (!dateString) return '-';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
}

export function showAlert(message, type = 'info') {
    // Log ke console agar mudah debug
    const logFn = type === 'error' ? console.error
                : type === 'warning' ? console.warn
                : console.log;
    logFn(`[${type.toUpperCase()}] ${message}`);

    // Tetap pakai alert agar user tahu (bisa diganti SweetAlert2 nanti)
    alert(`[${type.toUpperCase()}] ${message}`);
}
