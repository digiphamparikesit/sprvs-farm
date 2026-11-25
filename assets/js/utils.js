export function formatTanggalIndo(dateString) {
    if (!dateString) return '-';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
}

export function showAlert(message, type = 'info') {
    alert(`[${type.toUpperCase()}] ${message}`);
}
