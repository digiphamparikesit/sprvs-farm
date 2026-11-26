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

    // Pastikan kolom tindak_lanjut diambil dari database
    const { data: detail, error: errDetail } = await supabase
        .from('supervisi_detail')
        .select(`
            status, catatan_temuan, tindak_lanjut,
            master_pertanyaan (no_urut, objek_pemeriksaan, acuan, pengamatan_dilapangan, kategori, default_ruangan, kelompok)
        `)
        .eq('supervisi_id', supervisiId);

    if (errDetail) {
        showAlert('Gagal mengambil detail: ' + errDetail.message, 'error');
        return;
    }

    document.getElementById('pdf-tanggal').innerText = `${formatTanggalIndo(header.tanggal)} / ${header.jam}`;
    document.getElementById('pdf-supervisor').innerText = header.apoteker_supervisor_nama;
    document.getElementById('pdf-ruangan').innerText = header.ruangan ? header.ruangan.nama_ruangan : '-';
    document.getElementById('pdf-pj').innerText = header.penanggung_jawab_nama;
    document.getElementById('pdf-risiko').innerText = header.kategori_risiko;
    document.getElementById('pdf-metode').innerText = `${header.metode} (Sampel: ${header.sampel})`;

    document.getElementById('btn-cetak').addEventListener('click', async () => {
        if (!window.jspdf) return showAlert('Library jsPDF tidak ditemukan.', 'error');
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });

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
            
            doc.text("Unit / Ruangan", 10, 56);
            doc.text(`: ${header.ruangan ? header.ruangan.nama_ruangan : '-'}`, 45, 56);
            doc.text("Apoteker Supervisor", 10, 61);
            doc.text(`: ${header.apoteker_supervisor_nama}`, 45, 61);
            doc.text("Kategori Risiko Lokasi", 10, 66);
            doc.text(`: ${header.kategori_risiko}`, 45, 66);

            doc.text("Tanggal dan Jam", 150, 56);
            doc.text(`: ${formatTanggalIndo(header.tanggal)} / ${header.jam}`, 185, 56);
            doc.text("Penanggung Jawab Unit", 150, 61);
            doc.text(`: ${header.penanggung_jawab_nama}`, 185, 61);
            doc.text("Metode dan Sampel", 150, 66);
            doc.text(`: ${header.metode} (Sampel: ${header.sampel})`, 185, 66);
        }

        gambarKopSurat();

        let bodyData = [];
        let currentKelompok = '';

        if (detail) {
            detail.sort((a, b) => a.master_pertanyaan.no_urut.localeCompare(b.master_pertanyaan.no_urut));
            detail.forEach((item) => {
                const q = item.master_pertanyaan;
                
                // Render Sub Judul
                if (q.kelompok && q.kelompok !== currentKelompok) {
                    bodyData.push([
                        { content: q.kelompok, colSpan: 8, styles: { fillColor: [226, 232, 240], fontStyle: 'bold', halign: 'left' } }
                    ]);
                    currentKelompok = q.kelompok;
                }

                // LOGIKA BARU: S = 0, TS = Nilai Kategori
                let nilaiKategori = item.status === 'S' ? '0' : q.kategori;

                bodyData.push([
                    { content: q.no_urut, styles: { halign: 'center' } },
                    q.objek_pemeriksaan,
                    { content: q.acuan, styles: { halign: 'center' } },
                    q.pengamatan_dilapangan,
                    { content: item.status, styles: { halign: 'center', textColor: item.status === 'S' ? [0, 128, 0] : [255, 0, 0], fontStyle: 'bold' } },
                    item.catatan_temuan || '-',
                    { content: item.tindak_lanjut || '-', styles: { halign: 'center' } }, // Kolom Tindak Lanjut
                    { content: nilaiKategori, styles: { halign: 'center' } }
                ]);
            });
        }

        doc.autoTable({
            startY: 72,
            head: [[
                { content: 'No', styles: { halign: 'center' } },
                { content: 'Objek Pemeriksaan' },
                { content: 'Acuan', styles: { halign: 'center' } },
                { content: 'Pengamatan di Lapangan' },
                { content: 'S / TS', styles: { halign: 'center' } },
                { content: 'Catatan/nomor temuan' },
                { content: 'Hasil Tindak Lanjut', styles: { halign: 'center' } }, // Header Baru
                { content: 'Kategori', styles: { halign: 'center' } }
            ]],
            body: bodyData,
            theme: 'grid',
            styles: {
                font: 'times',
                fontSize: 8, // Ukuran font sedikit dikecilkan agar muat kolom baru
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
                2: { cellWidth: 22 },
                3: { cellWidth: 70 }, // Lebar disesuaikan karena kolom bertambah
                4: { cellWidth: 12 },
                5: { cellWidth: 45 },
                6: { cellWidth: 30 }, // Lebar Tindak Lanjut
                7: { cellWidth: 15 }
            },
            didDrawPage: function (data) {
                if (doc.internal.getNumberOfPages() > 1) {
                    doc.setLineWidth(0.5);
                    doc.line(10, 10, 287, 10);
                }
                const str = "Halaman " + doc.internal.getNumberOfPages();
                doc.setFontSize(8);
                doc.text(str, 280, 200, { align: "right" });
            }
        });

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

        doc.save(`Supervisi_${header.ruangan ? header.ruangan.nama_ruangan : 'RS'}_${header.tanggal}.pdf`);
    });
});
