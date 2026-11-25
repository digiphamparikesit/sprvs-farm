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
                    <td style="text-align: center; display: none;">${q.default_ruangan}</td>
                </tr>
            `;
        });
    }
    document.getElementById('pdf-tbody').innerHTML = tbodyHtml;

    // 5. Tombol Cetak (Metode Manual jsPDF)
    document.getElementById('btn-cetak').addEventListener('click', () => {
        const element = document.getElementById('print-area');
        element.style.display = 'block';

        const opt = {
            margin:       [35, 10, 15, 10], // Atas dibuat 35mm agar tidak menabrak kop manual
            filename:     `Supervisi_Farmasi_${header.ruangan ? header.ruangan.nama_ruangan : 'RS'}_${header.tanggal}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak:    { mode: ['css', 'legacy'] }
        };

        html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf) => {
            const totalPages = pdf.internal.getNumberOfPages();
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                
                // --- GAMBAR KOP SURAT MANUAL DI SETIAP HALAMAN ---
                pdf.setFont("times", "normal");
                pdf.setFontSize(12);
                pdf.text("PEMERINTAH KABUPATEN KUTAI KARTANEGARA", pageWidth / 2, 10, { align: "center" });
                pdf.text("DINAS KESEHATAN", pageWidth / 2, 15, { align: "center" });
                pdf.text("UNIT ORGANISASI BERSIFAT KHUSUS", pageWidth / 2, 20, { align: "center" });
                
                pdf.setFont("times", "bold");
                pdf.setFontSize(14);
                pdf.text("RUMAH SAKIT UMUM DAERAH AJI MUHAMMAD PARIKESIT", pageWidth / 2, 26, { align: "center" });
                
                pdf.setFont("times", "normal");
                pdf.setFontSize(9);
                pdf.text("Jalan Ratu Agung Nomor 1, Teluk Dalam, Tenggarong Seberang, Kutai Kartanegara, Kalimantan Timur 75572", pageWidth / 2, 31, { align: "center" });
                pdf.text("Telepon (0541) 661015, Laman: www.rsamp.kukarkab.go.id, Pos-el: rsudamparikesit@yahoo.com", pageWidth / 2, 35, { align: "center" });

                // Garis Tebal Kop
                pdf.setLineWidth(1);
                pdf.line(10, 37, pageWidth - 10, 37);
                pdf.setLineWidth(0.3);
                pdf.line(10, 38, pageWidth - 10, 38);

                // Judul Laporan
                pdf.setFont("times", "bold");
                pdf.setFontSize(12);
                pdf.text("CHECKLIST SUPERVISI INSTALASI FARMASI", pageWidth / 2, 43, { align: "center" });
                
                // Garis Bawah Judul (Opsional)
                // pdf.line((pageWidth/2) - 40, 44, (pageWidth/2) + 40, 44);

                // --- FOOTER (NOMOR HALAMAN) ---
                pdf.setFont("times", "normal");
                pdf.setFontSize(10);
                pdf.text(`Halaman ${i} dari ${totalPages}`, pageWidth - 20, pageHeight - 8, { align: "right" });
            }
        }).save().then(() => {
            element.style.display = 'none';
        }).catch(err => {
            console.error(err);
            showAlert('Terjadi kesalahan saat mencetak PDF.', 'error');
            element.style.display = 'none';
        });
    });
});
