import { createIcons, ArrowUpRight, ArrowRight, ArrowLeft, ArrowDown, ArrowUp, ArrowDownRight, MapPin, Menu, GraduationCap, BriefcaseBusiness, BookOpen, UsersRound, Network, BadgeCheck, Lightbulb, BookOpenText, CalendarDays, ChevronDown, X } from 'lucide';
import { hydrateWebsite, escapeHtml } from './site-content.js';

const cmsContent = await hydrateWebsite();

createIcons({ icons: { ArrowUpRight, ArrowRight, ArrowDown, ArrowUp, ArrowDownRight, MapPin, Menu, GraduationCap, BriefcaseBusiness, BookOpen, UsersRound, Network, BadgeCheck, Lightbulb, BookOpenText, CalendarDays, ChevronDown, X } });

const navigation = document.querySelector('#main-nav');
const menuToggle = document.querySelector('.menu-toggle');
const profileDropdown = document.querySelector('.profile-dropdown');
const profileToggle = document.querySelector('.profile-toggle');
const profileSubmenu = document.querySelector('#profile-submenu');
function closeProfile() {
  profileSubmenu.hidden = true;
  profileToggle.setAttribute('aria-expanded', 'false');
}
profileToggle.addEventListener('click', () => {
  const open = profileSubmenu.hidden;
  profileSubmenu.hidden = !open;
  profileToggle.setAttribute('aria-expanded', String(open));
});
profileDropdown.addEventListener('focusout', event => {
  if (!profileDropdown.contains(event.relatedTarget)) closeProfile();
});
function closeMenu() {
  closeProfile();
  navigation.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Buka navigasi');
}
menuToggle.addEventListener('click', () => {
  const open = navigation.classList.toggle('open');
  if (!open) closeProfile();
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Tutup navigasi' : 'Buka navigasi');
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!profileSubmenu.hidden) {
    closeProfile();
    profileToggle.focus();
  } else if (navigation.classList.contains('open')) {
    closeMenu();
    menuToggle.focus();
  }
});
document.addEventListener('click', event => {
  if (!profileDropdown.contains(event.target)) closeProfile();
  if (!event.target.closest('.site-header')) closeMenu();
});
window.matchMedia('(min-width: 941px)').addEventListener('change', closeMenu);
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    profileToggle.classList.toggle('active', entry.target.id === 'tentang');
    navigation.querySelectorAll('a').forEach(link => {
      const active = link.hash === `#${entry.target.id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
document.querySelectorAll('main section[id]').forEach(section => sectionObserver.observe(section));
document.querySelector('#year').textContent = new Date().getFullYear();

function filterArticles(category) {
  document.querySelectorAll('[data-filter]').forEach(button => {
    const active = button.dataset.filter === category;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  let count = 0;
  document.querySelectorAll('.article').forEach(article => {
    article.hidden = category !== 'Semua' && article.dataset.category !== category;
    if (!article.hidden) count += 1;
  });
  document.querySelector('#filter-status').textContent = `${count} informasi ditampilkan untuk kategori ${category}.`;
  const emptyState = document.querySelector('#information-empty');
  emptyState.hidden = count > 0;
  emptyState.textContent = category === 'Semua'
    ? 'Belum ada informasi yang dipublikasikan.'
    : `Belum ada ${category.toLowerCase()} yang dipublikasikan.`;
}
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => filterArticles(button.dataset.filter)));
document.querySelectorAll('[data-topic]').forEach(link => link.addEventListener('click', () => filterArticles(link.dataset.topic)));

const readingDialog = document.querySelector('#reading-dialog');
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
}));
const articles = {
  digital: {
    category: 'TRANSFORMASI DIGITAL', title: 'Administrasi perkantoran di era kerja digital',
    content: '<p>Digitalisasi administrasi bukan sekadar mengganti dokumen kertas dengan berkas elektronik. Perubahan yang bermakna dimulai dari proses kerja yang jelas: siapa yang membuat dokumen, siapa yang memeriksa, di mana berkas disimpan, dan bagaimana keputusan ditelusuri.</p><h3>Mulai dari alur, bukan aplikasi</h3><p>Petakan satu proses yang paling sering dilakukan, misalnya pengelolaan surat masuk. Catat sumber surat, penanggung jawab, batas waktu tindak lanjut, dan lokasi arsip. Pemetaan sederhana ini membantu tim memilih perangkat yang sesuai dengan kebutuhan, bukan sekadar mengikuti tren.</p><h3>Bangun kebiasaan yang konsisten</h3><p>Penamaan berkas, pembagian akses, dan pengendalian versi perlu disepakati bersama. Gunakan struktur folder yang mudah dipahami dan pisahkan dokumen kerja dari dokumen final. Hindari menjadikan akun pribadi sebagai satu-satunya tempat penyimpanan arsip organisasi.</p><h3>Jaga keamanan dan keterlacakan</h3><p>Berikan akses sesuai kebutuhan tugas, aktifkan autentikasi berlapis bila tersedia, dan siapkan cadangan. Tinjau akses saat anggota tim berpindah peran. Informasi sensitif perlu diperlakukan sesuai kebijakan organisasi dan ketentuan perlindungan data yang berlaku.</p><p>Keberhasilan tidak cukup diukur dari banyaknya aplikasi. Waktu pencarian dokumen, berkurangnya kesalahan, dan kejelasan tanggung jawab dapat menjadi indikator awal untuk mengevaluasi perbaikan.</p>'
  },
  etika: {
    category: 'PRAKTIK PROFESIONAL', title: 'Profesionalisme dimulai dari hal-hal kecil',
    content: '<p>Kepercayaan terhadap sebuah organisasi sering dibentuk melalui interaksi sehari-hari: balasan surat yang jelas, jadwal yang tertib, dan informasi yang akurat. Di balik hal-hal tersebut, ada pekerjaan administrasi yang menuntut ketelitian sekaligus kepekaan.</p><h3>Ketelitian sebagai bentuk tanggung jawab</h3><p>Sebelum dokumen dikirim, periksa nama penerima, tanggal, lampiran, dan pihak yang berwenang menyetujui. Daftar periksa singkat dapat membantu menjaga mutu, terutama ketika pekerjaan berulang dilakukan di tengah tenggat waktu yang padat.</p><h3>Komunikasi yang memberi kepastian</h3><p>Pesan yang profesional menjelaskan tujuan, tindakan yang diperlukan, dan waktu yang diharapkan. Bila penyelesaian pekerjaan tertunda, sampaikan kondisi serta perkiraan tindak lanjut. Kepastian yang realistis lebih berguna daripada janji yang tidak dapat dipenuhi.</p><h3>Menjaga batas dan kerahasiaan</h3><p>Tidak semua informasi yang dapat diakses boleh dibagikan. Pastikan penerima memang berwenang sebelum meneruskan dokumen. Gunakan saluran komunikasi yang disepakati organisasi, terutama untuk data pribadi dan dokumen internal.</p><p>Profesionalisme tumbuh dari kebiasaan yang dapat diandalkan. Refleksi singkat bersama rekan kerja dapat membantu mengidentifikasi hal kecil yang perlu diperbaiki tanpa menunggu munculnya masalah besar.</p>'
  },
  kolaborasi: {
    category: 'KEILMUAN', title: 'Menjembatani kampus dan dunia praktik',
    content: '<p>Pembelajaran administrasi perkantoran menjadi lebih kaya ketika teori bertemu dengan pengalaman lapangan. Kampus menawarkan kerangka berpikir dan metode kajian, sementara praktisi membawa konteks, keterbatasan, dan persoalan nyata organisasi.</p><h3>Mulai dengan pertanyaan bersama</h3><p>Kolaborasi dapat berangkat dari masalah yang sederhana dan terukur: bagaimana mempercepat temu kembali arsip, memperjelas alur disposisi, atau meningkatkan kualitas layanan administrasi? Pertanyaan bersama membantu menyelaraskan kebutuhan praktisi dengan tujuan pembelajaran.</p><h3>Hadirkan kasus yang bertanggung jawab</h3><p>Studi kasus dari tempat kerja perlu disiapkan dengan memperhatikan izin penggunaan dan kerahasiaan. Hilangkan identitas serta data sensitif yang tidak diperlukan. Bedakan temuan yang didukung bukti dari pendapat atau pengalaman individual.</p><h3>Belajar dua arah</h3><p>Diskusi kasus, kuliah praktisi, dan proyek berbasis masalah dapat menjadi pilihan bentuk kerja sama. Mahasiswa berlatih menghubungkan konsep dengan situasi nyata; praktisi memperoleh sudut pandang baru; pendidik mendapatkan masukan untuk memperbarui pembelajaran.</p><p>Kolaborasi tidak harus dimulai dengan kegiatan berskala besar. Satu kasus yang dibahas secara mendalam, dengan tujuan dan evaluasi yang jelas, dapat menjadi langkah awal yang bermanfaat.</p>'
  }
};
if (cmsContent) {
  Object.keys(articles).forEach(key => delete articles[key]);
  cmsContent.articles.forEach(item => { articles[item.id] = { ...item, category: item.topic || item.category }; });
}
function openReading(category, title, content) {
  document.querySelector('#reading-category').textContent = category;
  document.querySelector('#reading-title').textContent = title;
  document.querySelector('#reading-body').innerHTML = content;
  readingDialog.showModal();
  readingDialog.scrollTop = 0;
}
const profiles = {
  'visi-misi': {
    title: 'Visi dan Misi ASPAPI',
    content: `
      <h3>Visi</h3>
      <blockquote class="profile-vision"><p>Asosiasi Sarjana dan Praktisi Administrasi Perkantoran Indonesia (ASPAPI) menjadi organisasi profesi yang unggul dan berwatak sosial, dalam rangka pembangunan sumber daya manusia Indonesia yang kompeten dan profesional di bidang administrasi/manajemen perkantoran.</p></blockquote>
      <h3>Misi</h3>
      <ol class="profile-mission-list">
        <li>Mewadahi pemikiran spekulatif maupun empiris yang bersumber dari pengalaman pendidikan, dialog, dan pertemuan ilmiah.</li>
        <li>Mengembangkan wacana, paradigma, kerangka berpikir, model, serta konsensus akademis dan praktis administrasi/manajemen perkantoran yang sesuai dengan konteks Indonesia.</li>
        <li>Menyebarluaskan hasil pemikiran melalui teknologi informasi dan komunikasi agar dapat menjangkau berbagai konteks.</li>
        <li>Memfasilitasi ahli, praktisi, dan pemerhati untuk mengkaji serta menerapkan hasil pemikiran demi pengembangan keilmuan dan bidang kajian pendidikan.</li>
        <li>Memberikan pertimbangan akademis, profesional, dan rekomendasi kepada pemerintah pusat serta daerah untuk meningkatkan mutu pendidikan.</li>
        <li>Mengembangkan organisasi menjadi Lembaga Sertifikasi Profesi untuk uji kompetensi administrasi dan manajemen perkantoran serta kesekretarisan.</li>
      </ol>
      <h3>Tujuan</h3>
      <p>Menyumbangkan pemikiran untuk pembangunan nasional secara profesional dalam penataan, perlindungan, pemberdayaan administrasi dan manajemen perkantoran sehingga lebih terarah, berhasil, dan berdaya guna melalui penelitian, pengembangan dan penerapan ilmu pengetahuan dan teknologi dalam upaya mencerdaskan kehidupan bangsa.</p>
    `
  },
  sejarah: {
    title: 'Sejarah Singkat ASPAPI',
    content: `
      <h3>Awal Pembentukan</h3>
      <p>ASPAPI lahir dari prakarsa para inisiator untuk mempertemukan sarjana dan praktisi administrasi perkantoran. Kebutuhan berbagi pengetahuan, pengalaman, dan gagasan mendorong pembentukan wadah profesi melalui rangkaian pertemuan lintas institusi.</p>
      <h3>Sembilan Pertemuan Pembentukan</h3>
      <ol class="profile-history-list">
        <li><time datetime="2010-02-27">27 Februari 2010</time><p>Pertemuan awal di PAP UNS mempertemukan alumni dan praktisi untuk menggagas asosiasi profesi.</p></li>
        <li><time datetime="2010-05-01">1 Mei 2010</time><p>Nama ASPAPI disepakati di FKIP UNS, disertai rencana kongres dan penyusunan AD/ART.</p></li>
        <li><time datetime="2010-06-19">19 Juni 2010</time><p>Pertemuan di UNY membahas rancangan AD/ART serta persiapan kongres dan seminar nasional.</p></li>
        <li><time datetime="2010-07-06">6 Juli 2010</time><p>Kepanitiaan kongres dan seminar dibentuk dalam pertemuan di Candi Resto, Solo-Baru.</p></li>
        <li><time datetime="2010-07-17">17 Juli 2010</time><p>Perwakilan UNS, UNY, UNJ, UM, dan UNESA membahas jadwal, tema, serta topik kongres di UNY.</p></li>
        <li><time datetime="2010-08-13">13 Agustus 2010</time><p>Koordinasi di UNS mematangkan kepanitiaan, pembagian tugas, serta persiapan teknis dan logistik.</p></li>
        <li><time datetime="2010-09-05">5 September 2010</time><p>Rapat di Restoran Ilham menetapkan Graha Solo Raya sebagai tempat kongres dan mematangkan acara.</p></li>
        <li><time datetime="2010-10-08">8 Oktober 2010</time><p>Pertemuan akhir di PAP UNS meninjau kesiapan pelaksanaan, narasumber, serta materi komisi kongres.</p></li>
        <li><time datetime="2010-10-16">16&ndash;17 Oktober 2010</time><p>Kongres dan Seminar Nasional di Graha Solo Raya, Surakarta, menjadi puncak rangkaian pembentukan ASPAPI.</p></li>
      </ol>
      <h3>Pengukuhan Organisasi</h3>
      <p>ASPAPI dikukuhkan melalui Akta Notaris Sri Purwanti, S.H. Nomor 01 tanggal <strong>7 Oktober 2010</strong>.</p>
    `
  },
  inisiator: { title: 'Inisiator', description: 'Informasi inisiator ASPAPI Sulawesi Selatan belum dipublikasikan pada website ini.' },
  kongres: { title: 'Kongres', description: 'Informasi pelaksanaan dan hasil kongres ASPAPI belum dipublikasikan pada website ini.' },
  penasihat: { title: 'Dewan Penasihat', description: 'Susunan Dewan Penasihat ASPAPI Sulawesi Selatan belum dipublikasikan pada website ini.' },
  pakar: { title: 'Dewan Pakar', description: 'Susunan Dewan Pakar ASPAPI Sulawesi Selatan belum dipublikasikan pada website ini.' },
  pengurus: { title: 'Pengurus', description: 'Susunan pengurus dan masa bakti kepengurusan ASPAPI Sulawesi Selatan belum dipublikasikan pada website ini.' }
};
if (cmsContent) cmsContent.profiles.forEach(item => { profiles[item.id] = item; });
const profileButtons = [...document.querySelectorAll('[data-profile]')];
const profileOrder = profileButtons.map(button => button.dataset.profile);
function openProfile(profileId) {
  const profile = profiles[profileId];
  const currentIndex = profileOrder.indexOf(profileId);
  const previousId = profileOrder[currentIndex - 1];
  const nextId = profileOrder[currentIndex + 1];
  const previousButton = previousId
    ? `<button class="button button-outline" data-previous-profile><i data-lucide="arrow-left" aria-hidden="true"></i><span class="profile-next-label"><small>Sebelumnya</small><span>${escapeHtml(profiles[previousId].title)}</span></span></button>`
    : '';
  const nextButton = nextId
    ? `<button class="button button-red" data-next-profile><span class="profile-next-label"><small>Selanjutnya</small><span>${escapeHtml(profiles[nextId].title)}</span></span><i data-lucide="arrow-right" aria-hidden="true"></i></button>`
    : '<button class="button button-red" data-finish-profile>Selesai <i data-lucide="x" aria-hidden="true"></i></button>';
  const pagination = `<div class="profile-pagination">${previousButton}${nextButton}</div>`;
  openReading('PROFIL ASPAPI', profile.title, (profile.content ?? `<p>${profile.description}</p>`) + pagination);
  createIcons({ icons: { ArrowLeft, ArrowRight, X } });
  if (previousId) {
    readingDialog.querySelector('[data-previous-profile]').addEventListener('click', () => openProfile(previousId));
  }
  if (nextId) {
    readingDialog.querySelector('[data-next-profile]').addEventListener('click', () => openProfile(nextId));
  } else {
    readingDialog.querySelector('[data-finish-profile]').addEventListener('click', () => readingDialog.close());
  }
  const heading = document.querySelector('#reading-title');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}
profileButtons.forEach(button => button.addEventListener('click', () => {
  closeMenu();
  openProfile(button.dataset.profile);
  readingDialog.addEventListener('close', () => {
    const mobile = window.matchMedia('(max-width: 940px)').matches;
    (mobile ? menuToggle : profileToggle).focus();
  }, { once: true });
}));
document.querySelector('[data-privacy]').addEventListener('click', () => {
  openReading('PRIVASI', 'Data Anda, kendali Anda.', '<p>Website ASPAPI Sulawesi Selatan tidak mengumpulkan atau menyimpan formulir pendaftaran anggota. Tautan keanggotaan mengarahkan Anda ke halaman Registrasi & Iuran Anggota di aspapi.id.</p><h3>Registrasi dan iuran anggota</h3><p>Data yang Anda masukkan pada halaman registrasi resmi diproses oleh pengelola aspapi.id sesuai ketentuan dan kebijakan privasi pada situs tersebut. Periksa ketentuan tersebut sebelum mengisi data atau melakukan pembayaran.</p><h3>Layanan eksternal</h3><p>Foto ilustrasi dimuat dari Unsplash dan font dimuat dari Google Fonts. Penyedia layanan tersebut dapat menerima alamat IP dan informasi teknis browser saat aset dimuat. Website ini tidak memasang pelacak analitik.</p>');
});

function renderArticlePage(articleId) {
  const article = Object.hasOwn(articles, articleId) ? articles[articleId] : null;
  const card = [...document.querySelectorAll('[data-article]')].find(link => link.dataset.article === articleId);
  const title = article ? article.title : 'Artikel tidak ditemukan';
  const summary = article ? card.querySelector('p').textContent : 'Artikel yang Anda cari tidak tersedia. Silakan kembali ke daftar Informasi.';
  const image = article ? card.querySelector('img')?.cloneNode(true) : null;
  const relatedCards = article
    ? [...document.querySelectorAll('[data-article]')]
      .filter(link => link.dataset.article !== articleId)
      .map(link => link.closest('.article').cloneNode(true))
    : [];
  sectionObserver.disconnect();
  document.querySelectorAll('a[href^="#"]:not(.skip-link)').forEach(link => {
    link.setAttribute('href', `./${link.getAttribute('href')}`);
  });
  navigation.querySelectorAll('a').forEach(link => {
    const active = link.hash === '#informasi';
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = `${title} | ASPAPI Sulawesi Selatan`;
  document.querySelector('meta[name="description"]').setAttribute('content', summary);
  document.querySelector('#main').innerHTML = `
    <div class="container article-page">
      <a class="text-link article-back" href="./#informasi"><i data-lucide="arrow-left" aria-hidden="true"></i> Kembali ke Informasi</a>
      <article class="article-detail" aria-labelledby="article-page-title">
        <header class="article-detail-header">
          <div class="eyebrow">${article ? `INFORMASI / ${escapeHtml(article.category)}` : 'INFORMASI'}</div>
          <h1 id="article-page-title">${escapeHtml(title)}</h1>
          <p class="article-detail-summary">${escapeHtml(summary)}</p>
          ${article ? `<span class="article-read-time">${article.readMinutes || 3} menit baca</span>` : ''}
        </header>
        ${article ? `${image ? `<figure class="article-detail-image">${article.imageAlt ? `<figcaption>${escapeHtml(article.imageAlt)}</figcaption>` : ''}</figure>` : ''}<div class="reading-body article-detail-copy">${article.content}</div>` : ''}
        ${relatedCards.length ? '<section class="related-articles" aria-labelledby="related-heading"><h2 id="related-heading">Berita Lainnya</h2><div class="article-grid"></div></section>' : ''}
        <div class="article-detail-bottom"><a class="button button-red" href="./#informasi"><i data-lucide="arrow-left" aria-hidden="true"></i> Kembali ke Informasi</a></div>
      </article>
    </div>
  `;
  if (image) {
    image.loading = 'eager';
    image.setAttribute('fetchpriority', 'high');
    document.querySelector('.article-detail-image').prepend(image);
  }
  if (relatedCards.length) {
    document.querySelector('.related-articles .article-grid').append(...relatedCards);
  }
  createIcons({ icons: { ArrowLeft } });
}
const articleId = new URLSearchParams(window.location.search).get('artikel');
if (articleId !== null) renderArticlePage(articleId);