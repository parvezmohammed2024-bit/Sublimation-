import { createContext, useContext, useState, type ReactNode } from "react";

const en = {
  appName: "Job Tracker",
  // stages, teams, states
  stage: { artwork: "Artwork approval", printing: "Template & Printing", production: "Heat Press & QC", ready: "Ready for collection", delivered: "Delivered", cancelled: "Cancelled" },
  teamName: { printing: "Template & Printing", production: "Heat Press & QC" },
  approvalState: { not_sent: "Mockup not sent", waiting: "Waiting for approval", approved: "Approved", changes: "Changes requested" },
  approvedBy: { customer: "Approved by customer", admin: "Approved by admin" },
  step: { printed: "Printed", pressed: "Heat pressed", qc_pass: "QC passed", qc_reject: "QC rejected", reprinted: "Reprinted" },
  reason: { ghosting: "Ghosting / shadow", faded: "Faded / dull colour", blurry: "Blurry / bleeding", white_spots: "White spots / creases", misprint: "Wrong design / misprint", wrong_name: "Wrong name or number", scorch: "Scorch / fabric damage", other: "Other" },
  printType: { full: "Full sublimation", partial: "Partial print" },
  eventText: { created: "Job created", started: "Started", completed: "Finished", moved_by_admin: "Moved by admin", sent_for_approval: "Mockup sent for approval", approved: "Approved", changes_requested: "Changes requested" },
  decideErr: { not_found: "Job not found.", not_waiting: "This mockup is no longer waiting for approval.", locked: "Too many wrong tries. Please wait 15 minutes.", no_phone: "No phone number on this job. Please contact us.", wrong_phone: "That phone number does not match this job.", note_required: "Please tell us what to change." },

  // common
  back: "Back", loading: "Loading…", cancel: "Cancel", save: "Save", remove: "Remove", edit: "Edit", show: "Show",
  pcs: "pcs", total: "Total", paid: "Paid", balance: "Balance", payment: "Payment", phone: "Phone number", mobile: "Mobile number",
  item: "Item", fabric: "Fabric", quantity: "Quantity", size: "Size", deadline: "Deadline", date: "Date", name: "Name",
  notes: "Notes", roster: "Name list", rosterName: "Name", rosterNumber: "No.", trackingNo: "Tracking number",
  received: "Received", targetDate: "Target date", today: "due today", daysLeft: "{n} days left", oneDayLeft: "1 day left", daysLate: "{n} days late", due: "Due",
  inProgress: "In progress", queued: "In the queue", entries: "Entries", undo: "Undo", round: "Round", artwork: "Artwork",
  serviceDown: "Can't reach the server right now. Check your internet and try again.",
  notConfigured: "This site is not connected to the database yet (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).",
  signIn: "Sign in", signOut: "Sign out", email: "Email", password: "Password", pin: "4-digit PIN",

  // home
  homeKicker: "Sublimation print jobs", homeTitle: "Your print, from artwork to collection.",
  homeLead: "Approve your design, then watch it move through printing, heat press and quality check, live.",
  homeHow: "How your job moves", staff: "Staff",
  homeStep1: "We send a mockup. You approve it or ask for changes, right from the tracking page.",
  homeStep2: "Your design is set on the garment template and printed onto transfer paper.",
  homeStep3: "Ink is heat-pressed into the fabric, then every piece is checked for colour and print faults.",
  homeStep4: "Packed and ready. Collect once your balance is settled.",

  // tracking
  trackTitle: "Track your job", trackLead: "Enter the tracking number from your receipt or WhatsApp.", track: "Track",
  manyOrdersLink: "Have many jobs? See them all with your phone number", notFound: "No job found with that tracking number. Check it and try again.",
  backToMyOrders: "My jobs", readyCollect: "Ready for collection", notDeliverable: "Not deliverable yet",
  readyPaidMsg: "Your job is packed and ready for collection.",
  readyBalanceMsg: "Your job is ready, but there is a balance of {amount}. It can't be released yet. Please contact the admin before collection.",
  deliveredOn: "Delivered on", liveProgress: "Live progress", orderDetails: "Job details", showRoster: "Show name list",
  balanceBeforeCollect: "The balance must be paid before collection.", contactAdmin: "Contact admin on WhatsApp", waHello: "Hi, about my job",
  approveTitle: "Please check your mockup", approveLead: "Nothing is printed until you approve. Check every detail carefully.",
  approveChecklist: ["Spelling of names and text", "Numbers and sizes", "Logo position and colours", "Sponsor logos, if any"],
  checkRoster: "Check the name list", yourPhone: "Your phone number", phoneWhy: "The number you gave us when ordering, so only you can approve.",
  whatToChange: "What should we change?", changePlaceholder: "e.g. Number 10 should be 11, make the logo bigger", approveBtn: "Approve design",
  requestChanges: "Request changes", sendChanges: "Send changes", approvedThanks: "Thank you! Your design is approved and goes to printing.",
  changesThanks: "Got it. We'll update the mockup and send it again.", changesSent: "You asked for changes. We'll send a new mockup soon.",

  // my orders
  myOrdersTitle: "My jobs", myOrdersLead: "Enter your phone number and the 4-digit customer code we gave you.", customerCode: "Customer code",
  badCode: "Wrong phone number or code.", lockedCustomer: "Too many wrong tries. Please wait 15 minutes.", hello: "Hello", activeOrders: "Active jobs",
  noActiveOrders: "No active jobs right now.", fullyPaid: "Fully paid", needsYourApproval: "Needs your approval",

  // team
  teamLogin: "Team login", teamLoginLead: "Template & Printing and Heat Press & QC teams sign in here.",
  firstLoginHint: "First time? Your PIN is the last 4 digits of your mobile number.", badLogin: "Wrong mobile number or PIN.",
  locked: "Too many wrong PINs. Try again in 15 minutes.", changePin: "Change PIN", newPin: "New PIN", confirmPin: "Confirm new PIN", savePin: "Save PIN",
  setPinHelp: "Choose a 4-digit PIN that only you know.", pinMismatch: "The two PINs don't match.", pinSaved: "PIN saved",
  defaultPinNotice: "You're still using the starting PIN (last 4 digits of your mobile). Set your own for safety.",
  myJobs: "My jobs", allJobs: "All jobs", newJobs: "{n} new job(s) arrived", newBadge: "NEW", queueEmpty: "No jobs right now",
  queueEmptyLead: "New jobs appear here by themselves. This page refreshes every 20 seconds.",
  startPrinting: "Start printing", startPressing: "Start heat press", logPrinted: "Add printed pieces", logReprinted: "Add reprinted pieces",
  donePrinting: "Printing done, send to heat press", doneQc: "QC done, mark ready", qcPassShort: "QC pass", qcRejectShort: "Reject",
  waitReprint: "waiting for {n} reprint(s)", qcShort: "QC passed {a} of {b}. All pieces must pass QC.", rejectedSoFar: "{n} rejected",
  reprint: "REPRINT", reprintNeeded: "QC rejected pieces. Reprint {n} piece(s).", howMany: "How many pieces?", useAll: "Use {n}",
  maxIs: "Maximum is {n}", rejectReason: "Why rejected?", describe: "Describe the problem",

  // admin
  adminLogin: "Admin login", adminLoginLead: "Management only.", notAdmin: "This account is not a tracker admin.",
  dashboard: "Dashboard", newJob: "New job", customers: "Customers", workers: "Workers", activeJobs: "active jobs", overdue: "overdue",
  waitingShort: "waiting for customer", unpaidShort: "with balance due", needsAction: "Needs your action",
  actChanges: "Customer asked for changes", actSendMockup: "Upload & send mockup", actReprint: "{n} piece(s) waiting for reprint",
  actDeliver: "Paid and ready: hand over", actCollect: "Ready, collect balance", searchJobs: "Search tracking no, customer, item or phone",
  active: "Active", all: "All", noJobs: "No jobs here.", paidShort: "Paid",
  newJobSheet: "New job sheet", editJob: "Edit job", customer: "Customer", customerName: "Customer / team name", job: "Job",
  phoneNeeded: "Needed for artwork approval and WhatsApp.", printTypeLabel: "Print type", totalPrice: "Total price",
  priceVisibility: "Only you and the customer see the price. Teams never do.", sizesQty: "Sizes & quantity", addSize: "Add size",
  rosterTitle: "Name & number list (optional)", rosterHelp: "For jerseys: one player per line, as NAME, NUMBER, SIZE. You can paste from Excel.",
  addToRoster: "Add to list", sizesFromRoster: "Count sizes from list", clearRoster: "Clear list",
  mockupTitle: "Mockup / artwork", mockupHelp: "Upload the design mockup. The customer approves it on the tracking page before printing.",
  addImage: "Add image", notesForTeam: "Notes for the team", notesPlaceholder: "e.g. Collar in black, sponsor logo on the back",
  fillRequired: "Fill in the customer name and item.", needQty: "Add at least one size with a quantity, or a name list.",
  saving: "Saving…", saveChanges: "Save changes", createJob: "Create job",
  copyLink: "Copy link", copied: "Copied", artworkApproval: "Artwork & approval", noMockup: "No mockup uploaded yet.",
  customerAsked: "Customer asked for:", sendForApproval: "Send to customer for approval", sendAgain: "Send new mockup again",
  uploadMockup: "Upload mockup", updateMockup: "Update mockup", sendWaApproval: "Send approval link on WhatsApp",
  markApproved: "Mark approved (customer confirmed)", confirmManualApprove: "Mark this design as approved and send it to Template & Printing?",
  noPhoneApproval: "No phone number on this job, so the customer can't approve online. Add one, or mark it approved yourself.",
  workshopProgress: "Workshop progress", confirmDeleteEntry: "Delete this entry?", history: "History",
  noPriceSet: "No price set for this job.", amount: "Amount (RM)", method: "Method", noteOpt: "Note (optional)", fullBalance: "Full balance",
  addPayment: "Add payment", confirmDeletePayment: "Delete this payment?", stageControl: "Stage",
  notDeliverableAdmin: "Not deliverable: balance {amount} is still due. Collect payment first.",
  deliverAnyway: "Deliver anyway (balance still due)", markDelivered: "Mark delivered", moveTo: "Move to stage", move: "Move",
  moveHelp: "Use this to fix a mistake or send a job back for redo.", balanceBlocks: "This job still has a balance. Record the payment first.",
  deleteOrder: "Delete job", confirmDeleteOrder: "Delete job {no} and everything on it? This can't be undone.",
  addWorker: "Add worker", section: "Section", defaultPinHelp: "Their first PIN is the last 4 digits of their mobile. They can change it after signing in.",
  workerAdded: "Worker added. First PIN: {pin}", noWorkers: "No workers in this section yet.", inactive: "inactive", onDefaultPin: "on starting PIN",
  lockedShort: "locked", moveSection: "Move to the other section", resetPin: "Reset PIN", confirmResetPin: "Reset {name}'s PIN to the last 4 digits of their mobile?",
  pinReset: "PIN reset to the last 4 digits of their mobile.", deactivate: "Deactivate", activate: "Activate",
  customersLead: "Give regular customers a 4-digit code to see all their jobs at /my.", nameOpt: "Name (optional)", getCode: "Get code",
  searchCustomers: "Search name or phone", confirmNewCode: "Make a new code? The old code stops working.", newCode: "New code", noCustomers: "No customer codes yet.",

  // WhatsApp messages
  waGreeting: "Hi", waApproval: "Your design mockup is ready. Please check it and tap Approve (or request changes) here:",
  waReady: "Good news! Your job is ready for collection.", waReadyBalance: "Your job is ready. Balance due: {amount}. Please settle the balance before collection.",
  waStatus: "You can follow your job live here:", waCode: "Hi! Track all your print jobs at {url}\nYour customer code: {code}",
};

type Dict = typeof en;

const ms: Dict = {
  appName: "Penjejak Kerja",
  stage: { artwork: "Kelulusan reka bentuk", printing: "Templat & Cetakan", production: "Tekan Haba & QC", ready: "Sedia untuk diambil", delivered: "Telah dihantar", cancelled: "Dibatalkan" },
  teamName: { printing: "Templat & Cetakan", production: "Tekan Haba & QC" },
  approvalState: { not_sent: "Mockup belum dihantar", waiting: "Menunggu kelulusan", approved: "Diluluskan", changes: "Minta pindaan" },
  approvedBy: { customer: "Diluluskan oleh pelanggan", admin: "Diluluskan oleh admin" },
  step: { printed: "Dicetak", pressed: "Ditekan haba", qc_pass: "Lulus QC", qc_reject: "Ditolak QC", reprinted: "Dicetak semula" },
  reason: { ghosting: "Bayang / ghosting", faded: "Warna pudar", blurry: "Kabur / meleleh", white_spots: "Tompok putih / kedut", misprint: "Reka bentuk salah", wrong_name: "Nama atau nombor salah", scorch: "Hangus / kain rosak", other: "Lain-lain" },
  printType: { full: "Sublimasi penuh", partial: "Cetakan separa" },
  eventText: { created: "Kerja dibuka", started: "Dimulakan", completed: "Selesai", moved_by_admin: "Dialih oleh admin", sent_for_approval: "Mockup dihantar untuk kelulusan", approved: "Diluluskan", changes_requested: "Minta pindaan" },
  decideErr: { not_found: "Kerja tidak dijumpai.", not_waiting: "Mockup ini tidak lagi menunggu kelulusan.", locked: "Terlalu banyak cubaan salah. Sila tunggu 15 minit.", no_phone: "Tiada nombor telefon pada kerja ini. Sila hubungi kami.", wrong_phone: "Nombor telefon tidak sepadan dengan kerja ini.", note_required: "Sila nyatakan apa yang perlu diubah." },

  back: "Kembali", loading: "Memuatkan…", cancel: "Batal", save: "Simpan", remove: "Buang", edit: "Ubah", show: "Papar",
  pcs: "helai", total: "Jumlah", paid: "Dibayar", balance: "Baki", payment: "Bayaran", phone: "Nombor telefon", mobile: "Nombor telefon bimbit",
  item: "Barang", fabric: "Kain", quantity: "Kuantiti", size: "Saiz", deadline: "Tarikh akhir", date: "Tarikh", name: "Nama",
  notes: "Nota", roster: "Senarai nama", rosterName: "Nama", rosterNumber: "No.", trackingNo: "Nombor penjejakan",
  received: "Diterima", targetDate: "Tarikh sasaran", today: "hari ini", daysLeft: "{n} hari lagi", oneDayLeft: "1 hari lagi", daysLate: "lewat {n} hari", due: "Tamat",
  inProgress: "Sedang dibuat", queued: "Dalam giliran", entries: "Catatan", undo: "Batal", round: "Pusingan", artwork: "Reka bentuk",
  serviceDown: "Tidak dapat menghubungi pelayan. Semak internet dan cuba lagi.",
  notConfigured: "Laman ini belum disambung ke pangkalan data (tiada VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).",
  signIn: "Log masuk", signOut: "Log keluar", email: "E-mel", password: "Kata laluan", pin: "PIN 4 digit",

  homeKicker: "Kerja cetakan sublimasi", homeTitle: "Cetakan anda, dari reka bentuk hingga diambil.",
  homeLead: "Luluskan reka bentuk, kemudian ikuti kerja anda melalui cetakan, tekan haba dan semakan kualiti secara langsung.",
  homeHow: "Perjalanan kerja anda", staff: "Staf",
  homeStep1: "Kami hantar mockup. Anda luluskan atau minta pindaan terus dari halaman penjejakan.",
  homeStep2: "Reka bentuk disusun pada templat pakaian dan dicetak ke atas kertas pindahan.",
  homeStep3: "Dakwat ditekan haba ke dalam kain, kemudian setiap helai disemak warna dan kecacatan cetakan.",
  homeStep4: "Siap dibungkus. Boleh diambil selepas baki dijelaskan.",

  trackTitle: "Jejak kerja anda", trackLead: "Masukkan nombor penjejakan dari resit atau WhatsApp anda.", track: "Jejak",
  manyOrdersLink: "Banyak kerja? Lihat semua dengan nombor telefon anda", notFound: "Tiada kerja dengan nombor itu. Semak dan cuba lagi.",
  backToMyOrders: "Kerja saya", readyCollect: "Sedia untuk diambil", notDeliverable: "Belum boleh diserahkan",
  readyPaidMsg: "Kerja anda sudah dibungkus dan sedia untuk diambil.",
  readyBalanceMsg: "Kerja anda sudah siap, tetapi masih ada baki {amount}. Ia belum boleh diserahkan. Sila hubungi admin sebelum mengambil.",
  deliveredOn: "Dihantar pada", liveProgress: "Kemajuan langsung", orderDetails: "Butiran kerja", showRoster: "Papar senarai nama",
  balanceBeforeCollect: "Baki perlu dibayar sebelum mengambil.", contactAdmin: "Hubungi admin di WhatsApp", waHello: "Hai, tentang kerja saya",
  approveTitle: "Sila semak mockup anda", approveLead: "Tiada apa dicetak sebelum anda luluskan. Semak setiap butiran dengan teliti.",
  approveChecklist: ["Ejaan nama dan teks", "Nombor dan saiz", "Kedudukan dan warna logo", "Logo penaja, jika ada"],
  checkRoster: "Semak senarai nama", yourPhone: "Nombor telefon anda", phoneWhy: "Nombor yang anda beri semasa membuat pesanan, supaya hanya anda boleh meluluskan.",
  whatToChange: "Apa yang perlu kami ubah?", changePlaceholder: "cth. Nombor 10 tukar ke 11, besarkan logo", approveBtn: "Luluskan reka bentuk",
  requestChanges: "Minta pindaan", sendChanges: "Hantar pindaan", approvedThanks: "Terima kasih! Reka bentuk diluluskan dan dihantar untuk cetakan.",
  changesThanks: "Baik. Kami akan kemas kini mockup dan hantar semula.", changesSent: "Anda minta pindaan. Mockup baharu akan dihantar tidak lama lagi.",

  myOrdersTitle: "Kerja saya", myOrdersLead: "Masukkan nombor telefon dan kod pelanggan 4 digit yang kami beri.", customerCode: "Kod pelanggan",
  badCode: "Nombor telefon atau kod salah.", lockedCustomer: "Terlalu banyak cubaan salah. Sila tunggu 15 minit.", hello: "Hai", activeOrders: "Kerja aktif",
  noActiveOrders: "Tiada kerja aktif sekarang.", fullyPaid: "Dibayar penuh", needsYourApproval: "Perlu kelulusan anda",

  teamLogin: "Log masuk pasukan", teamLoginLead: "Pasukan Templat & Cetakan dan Tekan Haba & QC log masuk di sini.",
  firstLoginHint: "Kali pertama? PIN anda ialah 4 digit terakhir nombor telefon anda.", badLogin: "Nombor telefon atau PIN salah.",
  locked: "Terlalu banyak PIN salah. Cuba lagi dalam 15 minit.", changePin: "Tukar PIN", newPin: "PIN baharu", confirmPin: "Sahkan PIN baharu", savePin: "Simpan PIN",
  setPinHelp: "Pilih PIN 4 digit yang hanya anda tahu.", pinMismatch: "Kedua-dua PIN tidak sama.", pinSaved: "PIN disimpan",
  defaultPinNotice: "Anda masih guna PIN permulaan (4 digit terakhir telefon). Tukar kepada PIN sendiri untuk keselamatan.",
  myJobs: "Kerja saya", allJobs: "Semua kerja", newJobs: "{n} kerja baharu masuk", newBadge: "BARU", queueEmpty: "Tiada kerja sekarang",
  queueEmptyLead: "Kerja baharu akan muncul di sini sendiri. Halaman ini dikemas kini setiap 20 saat.",
  startPrinting: "Mula cetak", startPressing: "Mula tekan haba", logPrinted: "Tambah helai dicetak", logReprinted: "Tambah helai cetak semula",
  donePrinting: "Cetakan siap, hantar ke tekan haba", doneQc: "QC siap, tanda sedia", qcPassShort: "Lulus QC", qcRejectShort: "Tolak",
  waitReprint: "menunggu {n} cetak semula", qcShort: "Lulus QC {a} daripada {b}. Semua helai mesti lulus QC.", rejectedSoFar: "{n} ditolak",
  reprint: "CETAK SEMULA", reprintNeeded: "Ada helai ditolak QC. Cetak semula {n} helai.", howMany: "Berapa helai?", useAll: "Guna {n}",
  maxIs: "Maksimum {n}", rejectReason: "Sebab ditolak?", describe: "Terangkan masalah",

  adminLogin: "Log masuk admin", adminLoginLead: "Pengurusan sahaja.", notAdmin: "Akaun ini bukan admin penjejak.",
  dashboard: "Papan pemuka", newJob: "Kerja baharu", customers: "Pelanggan", workers: "Pekerja", activeJobs: "kerja aktif", overdue: "lewat",
  waitingShort: "menunggu pelanggan", unpaidShort: "ada baki", needsAction: "Perlu tindakan anda",
  actChanges: "Pelanggan minta pindaan", actSendMockup: "Muat naik & hantar mockup", actReprint: "{n} helai menunggu cetak semula",
  actDeliver: "Dibayar dan siap: serahkan", actCollect: "Siap, kutip baki", searchJobs: "Cari nombor, pelanggan, barang atau telefon",
  active: "Aktif", all: "Semua", noJobs: "Tiada kerja di sini.", paidShort: "Dibayar",
  newJobSheet: "Helaian kerja baharu", editJob: "Ubah kerja", customer: "Pelanggan", customerName: "Nama pelanggan / pasukan", job: "Kerja",
  phoneNeeded: "Perlu untuk kelulusan reka bentuk dan WhatsApp.", printTypeLabel: "Jenis cetakan", totalPrice: "Harga keseluruhan",
  priceVisibility: "Hanya anda dan pelanggan nampak harga. Pasukan tidak.", sizesQty: "Saiz & kuantiti", addSize: "Tambah saiz",
  rosterTitle: "Senarai nama & nombor (pilihan)", rosterHelp: "Untuk jersi: seorang pemain satu baris, NAMA, NOMBOR, SAIZ. Boleh tampal dari Excel.",
  addToRoster: "Tambah ke senarai", sizesFromRoster: "Kira saiz dari senarai", clearRoster: "Kosongkan senarai",
  mockupTitle: "Mockup / reka bentuk", mockupHelp: "Muat naik mockup reka bentuk. Pelanggan luluskan di halaman penjejakan sebelum dicetak.",
  addImage: "Tambah gambar", notesForTeam: "Nota untuk pasukan", notesPlaceholder: "cth. Kolar hitam, logo penaja di belakang",
  fillRequired: "Isi nama pelanggan dan barang.", needQty: "Tambah sekurang-kurangnya satu saiz dengan kuantiti, atau senarai nama.",
  saving: "Menyimpan…", saveChanges: "Simpan perubahan", createJob: "Buka kerja",
  copyLink: "Salin pautan", copied: "Disalin", artworkApproval: "Reka bentuk & kelulusan", noMockup: "Belum ada mockup.",
  customerAsked: "Pelanggan minta:", sendForApproval: "Hantar kepada pelanggan untuk kelulusan", sendAgain: "Hantar semula mockup baharu",
  uploadMockup: "Muat naik mockup", updateMockup: "Kemas kini mockup", sendWaApproval: "Hantar pautan kelulusan di WhatsApp",
  markApproved: "Tanda diluluskan (pelanggan sahkan)", confirmManualApprove: "Tanda reka bentuk ini diluluskan dan hantar ke Templat & Cetakan?",
  noPhoneApproval: "Tiada nombor telefon, jadi pelanggan tidak boleh lulus dalam talian. Tambah nombor, atau tanda diluluskan sendiri.",
  workshopProgress: "Kemajuan bengkel", confirmDeleteEntry: "Padam catatan ini?", history: "Sejarah",
  noPriceSet: "Tiada harga ditetapkan untuk kerja ini.", amount: "Jumlah (RM)", method: "Kaedah", noteOpt: "Nota (pilihan)", fullBalance: "Baki penuh",
  addPayment: "Tambah bayaran", confirmDeletePayment: "Padam bayaran ini?", stageControl: "Peringkat",
  notDeliverableAdmin: "Belum boleh diserahkan: baki {amount} masih tertunggak. Kutip bayaran dahulu.",
  deliverAnyway: "Serahkan juga (baki masih ada)", markDelivered: "Tanda dihantar", moveTo: "Alih ke peringkat", move: "Alih",
  moveHelp: "Guna ini untuk betulkan kesilapan atau hantar kerja balik untuk dibuat semula.", balanceBlocks: "Kerja ini masih ada baki. Rekod bayaran dahulu.",
  deleteOrder: "Padam kerja", confirmDeleteOrder: "Padam kerja {no} dan semua butirannya? Tidak boleh dibatalkan.",
  addWorker: "Tambah pekerja", section: "Bahagian", defaultPinHelp: "PIN pertama ialah 4 digit terakhir nombor telefon. Boleh ditukar selepas log masuk.",
  workerAdded: "Pekerja ditambah. PIN pertama: {pin}", noWorkers: "Belum ada pekerja di bahagian ini.", inactive: "tidak aktif", onDefaultPin: "guna PIN permulaan",
  lockedShort: "dikunci", moveSection: "Alih ke bahagian lain", resetPin: "Set semula PIN", confirmResetPin: "Set semula PIN {name} kepada 4 digit terakhir telefonnya?",
  pinReset: "PIN diset semula kepada 4 digit terakhir telefon.", deactivate: "Nyahaktif", activate: "Aktifkan",
  customersLead: "Beri pelanggan tetap kod 4 digit untuk melihat semua kerja mereka di /my.", nameOpt: "Nama (pilihan)", getCode: "Dapatkan kod",
  searchCustomers: "Cari nama atau telefon", confirmNewCode: "Buat kod baharu? Kod lama tidak boleh digunakan lagi.", newCode: "Kod baharu", noCustomers: "Belum ada kod pelanggan.",

  waGreeting: "Hai", waApproval: "Mockup reka bentuk anda sudah siap. Sila semak dan tekan Luluskan (atau minta pindaan) di sini:",
  waReady: "Berita baik! Kerja anda sedia untuk diambil.", waReadyBalance: "Kerja anda sudah siap. Baki: {amount}. Sila jelaskan baki sebelum mengambil.",
  waStatus: "Ikuti kerja anda secara langsung di sini:", waCode: "Hai! Jejak semua kerja cetakan anda di {url}\nKod pelanggan anda: {code}",
};

export type Lang = "en" | "ms";
const dicts = { en, ms };

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Dict }>({ lang: "en", setLang: () => {}, t: en });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return localStorage.getItem("subli-lang") === "ms" ? "ms" : "en"; } catch { return "en"; }
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    try { localStorage.setItem("subli-lang", l); } catch { /* ignore */ }
  };
  return <Ctx.Provider value={{ lang, setLang, t: dicts[lang] }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
