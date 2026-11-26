import { supabase } from './supabase-client.js';
import { formatTanggalIndo, showAlert } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const supervisiId = urlParams.get('id');

    if (!supervisiId) {
        showAlert('ID Supervisi tidak ditemukan!', 'error');
        return;
    }

    // 1. Ambil Data Header
    const { data: header, error: errHeader } = await supabase
        .from('supervisi')
        .select(`*, ruangan (nama_ruangan)`)
        .eq('id', supervisiId)
        .single();

    if (errHeader) {
        showAlert('Gagal mengambil data header: ' + errHeader.message, 'error');
        return;
    }

    // 2. Ambil Data Detail
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

    // 3. Isi Data ke HTML Print Area
    document.getElementById('pdf-tanggal').innerText = `${formatTanggalIndo(header.tanggal)} / ${header.jam}`;
    document.getElementById('pdf-supervisor').innerText = header.apoteker_supervisor_nama;
    document.getElementById('pdf-ruangan').innerText = header.ruangan ? header.ruangan.nama_ruangan : '-';
    document.getElementById('pdf-pj').innerText = header.penanggung_jawab_nama;
    document.getElementById('pdf-risiko').innerText = header.kategori_risiko;
    document.getElementById('pdf-metode').innerText = `${header.metode} (Sampel: ${header.sampel})`;

    // 4. Render Tabel dengan Sub Judul (Kelompok)
    let tbodyHtml = '';
    let lastKelompok = '';

    if (detail) {
        detail.sort((a, b) => a.master_pertanyaan.no_urut.localeCompare(b.master_pertanyaan.no_urut));
        
        detail.forEach((item) => {
            const q = item.master_pertanyaan;
            const color = item.status === 'S' ? 'green' : 'red';

            // Render Sub Judul (Kelompok) jika berubah
            if (q.kelompok && q.kelompok !== lastKelompok) {
                tbodyHtml += `
                    <tr class="sub-judul-row">
                        <td colspan="7" style="background-color: #e2e8f0; font-weight: bold; padding: 8px; font-size: 11px;">
                            ${q.kelompok}
                        </td>
                    </tr>
                `;
                lastKelompok = q.kelompok;
            }
            
            // Render Baris Pertanyaan
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

    // 5. Tombol Cetak (Membuka Preview Terlebih Dahulu)
    document.getElementById('btn-cetak').addEventListener('click', () => {
        const element = document.getElementById('print-area');
        const modal = document.getElementById('pdf-preview-modal');
        const previewContent = document.getElementById('preview-content');
        
        element.style.display = 'block'; // Tampilkan sementara agar bisa dirender
        
        // Beri efek loading di modal
        modal.style.display = 'flex';
        previewContent.innerHTML = '<p style="text-align: center; margin-top: 20px;">Sedang memproses dokumen... Mohon tunggu.</p>';

        // Konfigurasi Render
        const opt = {
            margin:       [10, 10, 10, 10],
            filename:     `Supervisi_Farmasi_${header.ruangan ? header.ruangan.nama_ruangan : 'RS'}_${header.tanggal}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak:    { mode: ['css', 'legacy'] }
        };

        // Render HTML ke Canvas (Untuk Preview)
        html2canvas(element, opt.html2canvas).then(canvas => {
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            
            // Tampilkan gambar hasil render di dalam modal (Proporsional)
            previewContent.innerHTML = `<img src="${imgData}" style="max-width: 100%; height: auto; display: block; margin: 0 auto; box-shadow: 0 0 10px rgba(0,0,0,0.2);">`;
            
            // Event Listener untuk Tombol Download
            document.getElementById('btn-download-pdf').onclick = () => {
                // Gunakan html2pdf murni untuk mendownload agar header tabel berulang di setiap halaman
                html2pdf().set(opt).from(element).save().then(() => {
                    // Opsional: Tutup modal setelah selesai download
                    // modal.style.display = 'none';
                    // element.style.display = 'none';
                });
            };

        }).catch(err => {
            console.error(err);
            previewContent.innerHTML = '<p style="color: red; text-align: center; margin-top: 20px;">Gagal memproses dokumen.</p>';
        });
    });

    // 6. Logika untuk Menutup Modal Preview
    document.getElementById('btn-close-preview').addEventListener('click', () => {
        document.getElementById('pdf-preview-modal').style.display = 'none';
        document.getElementById('print-area').style.display = 'none'; // Sembunyikan lagi area print
    });

});
