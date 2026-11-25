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

    // 4. Render Tabel (8 Kolom)
    let tbodyHtml = '';

    // Urutkan detail berdasarkan no_urut
    if (detail) {
        detail.sort((a, b) => {
            return a.master_pertanyaan.no_urut.localeCompare(b.master_pertanyaan.no_urut);
        });

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
                    <td style="text-align: center; display: none;">${q.default_ruangan}</td>
                </tr>
            `;
        });
    }
    document.getElementById('pdf-tbody').innerHTML = tbodyHtml;

    // 5. Tombol Cetak
    document.getElementById('btn-cetak').addEventListener('click', () => {
        // Pastikan html2canvas tersedia
        if (typeof html2canvas === 'undefined') {
            showAlert('Library html2canvas tidak ditemukan. Pastikan script sudah dimuat.', 'error');
            return;
        }

        const element = document.getElementById('print-area');
        element.style.display = 'block'; // Tampilkan sementara

        // Ambil area khusus untuk dijadikan Header berulang
        const headerElement = document.querySelector('.kop-surat');
        const judulElement = document.querySelector('.judul-laporan');
        
        if (!headerElement || !judulElement) {
            showAlert('Elemen Kop Surat atau Judul tidak ditemukan di halaman.', 'error');
            element.style.display = 'none';
            return;
        }

        // Gabungkan Kop Surat dan Judul ke dalam satu div sementara
        const tempHeader = document.createElement('div');
        tempHeader.style.width = '1100px'; // Lebar landscape A4
        tempHeader.style.background = 'white';
        tempHeader.style.padding = '20px';
        tempHeader.appendChild(headerElement.cloneNode(true));
        
        const garis = document.createElement('hr');
        garis.style.border = '2px solid black';
        garis.style.margin = '10px 0';
        tempHeader.appendChild(garis);
        tempHeader.appendChild(judulElement.cloneNode(true));

        // Gunakan html2canvas untuk mengubah Header menjadi Gambar Base64
        html2canvas(tempHeader, { scale: 2, useCORS: true }).then(canvas => {
            const headerImgData = canvas.toDataURL('image/jpeg');
            const headerHeight = (canvas.height * 190) / canvas.width; // Kalkulasi tinggi di PDF

            const opt = {
                margin:       [10, 10, 10, 10],
                filename:     `Supervisi_Farmasi_${header.ruangan ? header.ruangan.nama_ruangan : 'RS'}_${header.tanggal}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
                pagebreak:    { mode: ['css', 'legacy'] }
            };

            // Jalankan html2pdf dengan callback untuk menyisipkan header
            html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf) => {
                const totalPages = pdf.internal.getNumberOfPages();
                const pageWidth = pdf.internal.pageSize.getWidth();
                
                // Loop setiap halaman, tempelkan Header di atasnya
                for (let i = 1; i <= totalPages; i++) {
                    pdf.setPage(i);
                    // Tempel gambar header (margin kiri 10, atas 10, lebar menyesuaikan)
                    pdf.addImage(headerImgData, 'JPEG', 10, 10, pageWidth - 20, headerHeight);
                    
                    // Tambahkan nomor halaman di bawah
                    pdf.setFontSize(10);
                    pdf.text(`Halaman ${i} dari ${totalPages}`, pageWidth - 30, pdf.internal.pageSize.getHeight() - 10);
                }
            }).save().then(() => {
                element.style.display = 'none'; // Sembunyikan kembali setelah selesai
            });
        }).catch(err => {
            console.error("Gagal membuat gambar header:", err);
            showAlert('Gagal memproses header PDF.', 'error');
            element.style.display = 'none';
        });
    });
});
