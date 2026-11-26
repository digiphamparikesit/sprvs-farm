import { supabase } from './supabase-client.js';
import { formatTanggalIndo, showAlert } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const supervisiId = urlParams.get('id');

    if (!supervisiId) {
        showAlert('ID Supervisi tidak ditemukan!', 'error');
        return;
    }

    // 1. Ambil Data dari Supabase
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

    // 2. Isi Data ke HTML
    document.getElementById('pdf-tanggal').innerText = `${formatTanggalIndo(header.tanggal)} / ${header.jam}`;
    document.getElementById('pdf-supervisor').innerText = header.apoteker_supervisor_nama;
    document.getElementById('pdf-ruangan').innerText = header.ruangan ? header.ruangan.nama_ruangan : '-';
    document.getElementById('pdf-pj').innerText = header.penanggung_jawab_nama;
    document.getElementById('pdf-risiko').innerText = header.kategori_risiko;
    document.getElementById('pdf-metode').innerText = `${header.metode} (Sampel: ${header.sampel})`;

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

    // 3. TOMBOL CETAK
    document.getElementById('btn-cetak').addEventListener('click', async () => {
        // Pastikan library jsPDF tersedia
        if (!window.jspdf) {
            showAlert('Library jsPDF tidak ditemukan. Pastikan script dimuat.', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        // Inisialisasi jsPDF mode landscape
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });

        // FUNGSI MENGGAMBAR KOP SURAT
        function gambarKopSurat() {
            doc.setFont("times", "normal");
            doc.setFontSize(12);
            doc.text("PEMERINTAH KABUPATEN KUTAI KARTANEGARA", 148.5, 10, { align: "center" });
            doc.text("DINAS KESEHATAN", 148.5, 15, { align: "center" });
            doc.text("UNIT ORGANISASI BERSIFAT KHUSUS", 148.5, 20, { align: "center" });
            
            doc.setFont("times", "bold");
            doc.setFontSize(16);
            doc.text("RUMAH SAKIT UMUM DAERAH AJI MUHAMMAD PARIKESIT", 148.5, 27, { align: "center" });
            
            doc.setFont("times", "normal");
            doc.setFontSize(9);
            doc.text("Jalan Ratu Agung Nomor 1, Teluk Dalam, Tenggarong Seberang, Kutai Kartanegara, Kalimantan Timur 75572", 148.5, 33, { align: "center" });
            doc.text("Telepon (0541) 661015, Laman: www.rsamp.kukarkab.go.id, Pos-el: rsudamparikesit@yahoo.com", 148.5, 37, { align: "center" });

            doc.setLineWidth(1);
            doc.line(10, 40, 287, 40);
            doc.setLineWidth(0.2);
            doc.line(10, 41, 287, 41);

            doc.setFontSize(14);
            doc.setFont("times", "bold");
            doc.text("CHECKLIST SUPERVISI INSTALASI FARMASI", 148.5, 48, { align: "center" });

            doc.setFontSize(10);
            doc.setFont("times", "normal");
            
            // Info Kiri
            doc.text("Unit / Ruangan", 10, 56);
            doc.text(`: ${header.ruangan ? header.ruangan.nama_ruangan : '-'}`, 45, 56);
            doc.text("Apoteker Supervisor", 10, 61);
            doc.text(`: ${header.apoteker_supervisor_nama}`, 45, 61);
            doc.text("Kategori Risiko Lokasi", 10, 66);
            doc.text(`: ${header.kategori_risiko}`, 45, 66);

            // Info Kanan
            doc.text("Tanggal dan Jam", 150, 56);
            doc.text(`: ${formatTanggalIndo(header.tanggal)} / ${header.jam}`, 185, 56);
            doc.text("Penanggung Jawab Unit", 150, 61);
            doc.text(`: ${header.penanggung_jawab_nama}`, 185, 61);
            doc.text("Metode dan Sampel", 150, 66);
            doc.text(`: ${header.metode} (Sampel: ${header.sampel})`, 185, 66);
        }

        gambarKopSurat();

        // SUSUN DATA UNTUK TABEL
        let bodyData = [];
        let currentKelompok = '';

        if (detail) {
            detail.forEach((item) => {
                const q = item.master_pertanyaan;
                // Baris Sub-Judul
                if (q.kelompok && q.kelompok !== currentKelompok) {
                    bodyData.push([
                        { content: q.kelompok, colSpan: 7, styles: { fillColor: [226, 232, 240], fontStyle: 'bold', halign: 'left' } }
                    ]);
                    currentKelompok = q.kelompok;
                }
                // Baris Data
                bodyData.push([
                    { content: q.no_urut, styles: { halign: 'center' } },
                    q.objek_pemeriksaan,
                    { content: q.acuan, styles: { halign: 'center' } },
                    q.pengamatan_dilapangan,
                    { content: item.status, styles: { halign: 'center', textColor: item.status === 'S' ? [0, 128, 0] : [255, 0, 0], fontStyle: 'bold' } },
                    item.catatan_temuan || '-',
                    { content: q.kategori, styles: { halign: 'center' } }
                ]);
            });
        }

        // PANGGIL AUTOTABLE
        // Karena jsPDF-autotable versi baru mendaftarkan diri ke doc secara otomatis
        doc.autoTable({
            startY: 72, // Mulai setelah kop surat
            head: [[
                { content: 'No', styles: { halign: 'center' } },
                { content: 'Objek Pemeriksaan' },
                { content: 'Acuan', styles: { halign: 'center' } },
                { content: 'Pengamatan di Lapangan' },
                { content: 'S / TS', styles: { halign: 'center' } },
                { content: 'Catatan/nomor temuan' },
                { content: 'Kategori', styles: { halign: 'center' } }
            ]],
            body: bodyData,
            theme: 'grid',
            styles: {
                font: 'times',
                fontSize: 9,
                cellPadding: 2,
                lineWidth: 0.1,
                lineColor: [0, 0, 0],
            },
            headStyles: {
                fillColor: [224, 224, 224],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 40 },
                2: { cellWidth: 25 },
                3: { cellWidth: 85 },
                4: { cellWidth: 15 },
                5: { cellWidth: 50 },
                6: { cellWidth: 20 }
            },
            didDrawPage: function (data) {
                // Jika halaman > 1, beri garis atas
                if (doc.internal.getNumberOfPages() > 1) {
                    doc.setLineWidth(0.5);
                    doc.line(10, 10, 287, 10);
                }
                // Footer Halaman
                const str = "Halaman " + doc.internal.getNumberOfPages();
                doc.setFontSize(8);
                doc.text(str, 280, 200, { align: "right" });
            }
        });

        // TANDA TANGAN
        let finalY = doc.lastAutoTable.finalY + 15;
        
        if (finalY > 170) {
            doc.addPage();
            finalY = 20;
        }

        doc.setFontSize(10);
        doc.setFont("times", "normal");
        doc.text("Penanggung Jawab Unit", 60, finalY, { align: "center" });
        doc.text("Apoteker Supervisor", 220, finalY, { align: "center" });
        
        finalY += 20;
        doc.text("(...........................................)", 60, finalY, { align: "center" });
        doc.text("(...........................................)", 220, finalY, { align: "center" });

        // Simpan PDF
        doc.save(`Supervisi_${header.ruangan ? header.ruangan.nama_ruangan : 'RS'}_${header.tanggal}.pdf`);
    });
});
