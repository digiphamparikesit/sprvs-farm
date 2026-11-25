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
    document.getElementById('pdf-ruangan').innerText = header.ruangan ? header.ruangan.nama_ruangan : '-';
    document.getElementById('pdf-pj').innerText = header.penanggung_jawab_nama;
    document.getElementById('pdf-risiko').innerText = header.kategori_risiko;
    document.getElementById('pdf-metode').innerText = `${header.metode} (Sampel: ${header.sampel})`;

    // 4. Render Tabel
    let tbodyHtml = '';
    if (detail) {
        detail.sort((a, b) => a.master_pertanyaan.no_urut.localeCompare(b.master_pertanyaan.no_urut));
        detail.forEach((item) => {
            const q = item.master_pertanyaan;
            const color = item.status === 'S' ? 'green' : 'red';
            
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

    // 5. Tombol Cetak
    document.getElementById('btn-cetak').addEventListener('click', () => {
        const element = document.getElementById('print-area');
        element.style.display = 'block'; // Tampilkan sementara agar bisa dirender

        // Tambahkan CSS sementara untuk memastikan header tabel berulang
        const style = document.createElement('style');
        style.innerHTML = `
            @media print {
                thead { display: table-header-group; }
                tr { page-break-inside: avoid; }
            }
            /* Sembunyikan kop surat di halaman ke-2 dan seterusnya */
            .html2pdf__page-break ~ .kop-container { display: none; }
        `;
        document.head.appendChild(style);

        const opt = {
            margin:       [10, 10, 10, 10], // Margin standar
            filename:     `Supervisi_Farmasi_${header.ruangan ? header.ruangan.nama_ruangan : 'RS'}_${header.tanggal}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
            // PENTING: mode 'css' memaksa html2pdf mengikuti aturan CSS page-break
            pagebreak:    { mode: ['css', 'legacy'] }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            element.style.display = 'none';
            document.head.removeChild(style); // Bersihkan style setelah selesai
        });
    });
});
