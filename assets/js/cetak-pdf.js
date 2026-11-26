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

    // 5. Tombol Cetak (Membuka Preview Terlebih Dahulu)
    document.getElementById('btn-cetak').addEventListener('click', () => {
        const element = document.getElementById('print-area');
        const modal = document.getElementById('pdf-preview-modal');
        const previewContent = document.getElementById('preview-content');
        
        element.style.display = 'block'; // Tampilkan sementara agar bisa dirender
        
        // Beri efek loading di modal
        modal.style.display = 'flex';
        previewContent.innerHTML = '<p>Sedang memproses dokumen... Mohon tunggu.</p>';

        // Konfigurasi HTML2PDF
        const opt = {
            margin:       [10, 10, 10, 10],
            filename:     `Supervisi_Farmasi_${header.ruangan ? header.ruangan.nama_ruangan : 'RS'}_${header.tanggal}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak:    { mode: ['css', 'legacy'] }
        };

        // Render HTML ke Canvas (Gambar)
        html2pdf().set(opt).from(element).toCanvas().then(canvas => {
            const imgData = canvas.toDataURL('image/jpeg');
            
            // Tampilkan gambar hasil render ke dalam modal
            previewContent.innerHTML = `<img src="${imgData}" style="width: 100%; max-width: 1000px; box-shadow: 0 0 10px rgba(0,0,0,0.2);">`;
            
            // Event Listener untuk Tombol Download di dalam Modal
            document.getElementById('btn-download-pdf').onclick = () => {
                // Karena jsPDF dimuat via UMD, kita panggil dari window.jspdf
                const { jsPDF } = window.jspdf;
                
                // Gunakan format A4 landscape untuk mencetak gambar canvas
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: 'a4'
                });
                
                const imgProps = pdf.getImageProperties(imgData);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(opt.filename);
            };

        }).catch(err => {
            console.error(err);
            previewContent.innerHTML = '<p style="color: red;">Gagal memproses dokumen. Cek console untuk detail.</p>';
        });
    });

    // 6. Logika untuk Menutup Modal Preview
    document.getElementById('btn-close-preview').addEventListener('click', () => {
        document.getElementById('pdf-preview-modal').style.display = 'none';
        document.getElementById('print-area').style.display = 'none'; // Sembunyikan lagi area print
    });

});
