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

    // 2. Ambil Data Detail (Join dengan master_pertanyaan)
    // Note: Pastikan relasi foreign key sudah diset di Supabase (supervisi_detail.pertanyaan_id -> master_pertanyaan.id)
    const { data: detail, error: errDetail } = await supabase
        .from('supervisi_detail')
        .select(`
            status, catatan_temuan,
            master_pertanyaan (no_urut, objek_pemeriksaan, acuan, pengamatan_dilapangan, kategori, default_ruangan)
        `)
        .eq('supervisi_id', supervisiId);

    if (errDetail) {
        showAlert('Gagal mengambil detail: ' + errDetail.message, 'error');
        return;
    }

    // 3. Isi Data ke HTML Print Area
    document.getElementById('pdf-tanggal').innerText = `${formatTanggalIndo(header.tanggal)} / ${header.jam}`;
    document.getElementById('pdf-supervisor').innerText = header.apoteker_supervisor_nama;
    document.getElementById('pdf-ruangan').innerText = header.ruangan.nama_ruangan;
    document.getElementById('pdf-pj').innerText = header.penanggung_jawab_nama;
    document.getElementById('pdf-risiko').innerText = header.kategori_risiko;
    document.getElementById('pdf-metode').innerText = `${header.metode} (Sampel: ${header.sampel})`;

    // 4. Render Tabel (8 Kolom)
    let tbodyHtml = '';
    let lastKelompok = ''; // Opsional: Jika ingin menampilkan baris kelompok

    // Urutkan detail berdasarkan no_urut
    detail.sort((a, b) => {
        return a.master_pertanyaan.no_urut.localeCompare(b.master_pertanyaan.no_urut);
    });

    detail.forEach((item) => {
        const q = item.master_pertanyaan;
        const color = item.status === 'S' ? 'green' : 'red';
        
        // (Opsional) Render Header Kelompok jika diperlukan
        // if (q.kelompok !== lastKelompok) { ... }

        tbodyHtml += `
            <tr>
                <td style="text-align: center;">${q.no_urut}</td>
                <td>${q.objek_pemeriksaan}</td>
                <td style="text-align: center;">${q.acuan}</td>
                <td>${q.pengamatan_dilapangan}</td>
                <td style="text-align: center; color: ${color}; font-weight: bold;">${item.status}</td>
                <td>${item.catatan_temuan || '-'}</td>
                <td style="text-align: center;">${q.kategori}</td>
                <td style="text-align: center; display: none;">${q.default_ruangan}</td>
            </tr>
        `;
    });
    document.getElementById('pdf-tbody').innerHTML = tbodyHtml;

    // 5. Tombol Cetak
    document.getElementById('btn-cetak').addEventListener('click', () => {
        const element = document.getElementById('print-area');
        element.style.display = 'block'; // Tampilkan sementara

        const opt = {
            margin:       [10, 10, 10, 10],
            filename:     `Supervisi_Farmasi_${header.ruangan.nama_ruangan}_${header.tanggal}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }, // Landscape karena tabel lebar
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            element.style.display = 'none'; // Sembunyikan kembali
        });
    });
});
