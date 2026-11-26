import { supabase } from './supabase-client.js';
import { formatTanggalIndo, showAlert } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const supervisiId = urlParams.get('id');

    if (!supervisiId) {
        showAlert('ID Supervisi tidak ditemukan!', 'error');
        return;
    }

    const { data: header, error: errHeader } = await supabase
        .from('supervisi')
        .select(`*, ruangan (nama_ruangan)`)
        .eq('id', supervisiId)
        .single();

    if (errHeader) {
        showAlert('Gagal mengambil data header: ' + errHeader.message, 'error');
        return;
    }

    const { data: detail, error: errDetail } = await supabase
        .from('supervisi_detail')
        .select(`
            status, catatan_temuan,
            master_pertanyaan (no_urut, objek_pemeriksaan, acuan, pengamatan_dilapangan, kategori, default_ruangan, kelompok)
        `)
        .eq('supervisi_id', supervisiId);

    if (errDetail) {
        showAlert('Gagal mengambil detail: ' + errDetail.message, 'error');
        return;
    }

    // Isi Data ke HTML
    document.getElementById('pdf-tanggal').innerText = `${formatTanggalIndo(header.tanggal)} / ${header.jam}`;
    document.getElementById('pdf-supervisor').innerText = header.apoteker_supervisor_nama;
    document.getElementById('pdf-ruangan').innerText = header.ruangan ? header.ruangan.nama_ruangan : '-';
    document.getElementById('pdf-pj').innerText = header.penanggung_jawab_nama;
    document.getElementById('pdf-risiko').innerText = header.kategori_risiko;
    document.getElementById('pdf-metode').innerText = `${header.metode} (Sampel: ${header.sampel})`;

    // Render Tabel & Sub Judul
    let tbodyHtml = '';
    let lastKelompok = '';

    if (detail) {
        detail.sort((a, b) => a.master_pertanyaan.no_urut.localeCompare(b.master_pertanyaan.no_urut));
        
        detail.forEach((item) => {
            const q = item.master_pertanyaan;
            const color = item.status === 'S' ? 'green' : 'red';

            if (q.kelompok && q.kelompok !== lastKelompok) {
                tbodyHtml += `<tr class="sub-judul-row"><td colspan="7">${q.kelompok}</td></tr>`;
                lastKelompok = q.kelompok;
            }
            
            tbodyHtml += `
                <tr>
                    <td style="text-align: center;">${q.no_urut}</td>
                    <td>${q.objek_pemeriksaan}</td>
                    <td style="text-align: center;">${q.acuan}</td>
                    <td>${q.pengamatan_dilapangan}</td>
                    <td style="text-align: center; color: ${color}; font-weight: bold;">${item.status}</td>
                    <td>${item.catatan_temuan || '-'}</td>
                    <td style="text-align: center;">${q.kategori}</td>
                </tr>
            `;
        });
    }
    document.getElementById('pdf-tbody').innerHTML = tbodyHtml;

    // Tombol Cetak
    document.getElementById('btn-cetak').addEventListener('click', () => {
        const element = document.getElementById('print-area');
        const modal = document.getElementById('pdf-preview-modal');
        const loadingText = document.getElementById('loading-text');
        const previewResult = document.getElementById('preview-result');
        
        modal.style.display = 'flex';
        loadingText.style.display = 'block';
        previewResult.style.display = 'none';
        previewResult.innerHTML = '';

        // Tampilkan elemen sementara agar html2canvas bisa membacanya
        element.style.display = 'block';

        // Render ke Gambar untuk Preview
        html2canvas(element, { scale: 1.5, useCORS: true, scrollY: 0 }).then(canvas => {
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            
            // Tampilkan di modal
            previewResult.innerHTML = `<img src="${imgData}" style="max-width: 100%; height: auto; box-shadow: 0 0 10px rgba(0,0,0,0.2);">`;
            loadingText.style.display = 'none';
            previewResult.style.display = 'block';

            // Sembunyikan kembali print-area dari layar utama
            element.style.display = 'none';

            // Setup Tombol Download
            document.getElementById('btn-download-pdf').onclick = () => {
                // Tampilkan lagi sementara untuk html2pdf
                element.style.display = 'block';
                
                const opt = {
                    margin:       [10, 10, 10, 10],
                    filename:     `Supervisi_Farmasi_${header.tanggal}.pdf`,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
                    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
                    pagebreak:    { mode: ['css', 'legacy'] } // Memaksa header tabel berulang
                };

                html2pdf().set(opt).from(element).save().then(() => {
                    element.style.display = 'none';
                });
            };

        }).catch(err => {
            console.error(err);
            loadingText.innerText = 'Gagal memproses dokumen.';
        });
    });

    // Tutup Modal
    document.getElementById('btn-close-preview').addEventListener('click', () => {
        document.getElementById('pdf-preview-modal').style.display = 'none';
    });
});
