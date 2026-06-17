export const SELLER_VERIFY_STEPS = [
    { id: 1, key: "business", title: "İşletme Türü" },
    { id: 2, key: "general", title: "Genel Bilgiler" },
    { id: 3, key: "documents", title: "Belgeler" },
    { id: 4, key: "iban", title: "IBAN" },
    { id: 5, key: "finish", title: "Bitir" },
];

export const BUSINESS_TYPES = [
    {
        value: "none",
        title: "Şirketim Yok",
        description: "Henüz şirket kurmadıysan ve bireysel olarak satış yapıyorsan",
    },
    {
        value: "sole",
        title: "Şahıs Şirketim Var",
        description: "Kendi adına kayıtlı şahıs şirketin varsa",
    },
    {
        value: "corporate",
        title: "Kurumsal Şirketim Var",
        description: "Limited (Ltd.) veya Anonim (A.Ş.) şirket adına işlem yapıyorsan",
    },
];

export const BUSINESS_TYPE_LABELS = {
    none: "Şirketim Yok",
    sole: "Şahıs Şirketim Var",
    corporate: "Kurumsal Şirketim Var",
};

export const TR_CITIES = [
    { name: "İstanbul", districts: ["Ümraniye", "Kadıköy", "Beşiktaş", "Şişli", "Ataşehir", "Bakırköy"] },
    { name: "Ankara", districts: ["Çankaya", "Yenimahalle", "Keçiören", "Mamak"] },
    { name: "İzmir", districts: ["Konak", "Karşıyaka", "Bornova", "Buca"] },
    { name: "Bursa", districts: ["Osmangazi", "Nilüfer", "Yıldırım"] },
    { name: "Antalya", districts: ["Muratpaşa", "Kepez", "Konyaaltı"] },
];

export const STEP_INFO = {
    1: {
        title: "Neden bu bilgilere ihtiyaç var?",
        text: "Yasal düzenlemeler gereği satıcı kimliğinizi doğrulamamız gerekir. Bilgileriniz yalnızca doğrulama ve ödeme aktarımı için kullanılır.",
        title2: "Başvurum ne zaman onaylanır?",
        text2: "Başvurular genellikle 1 iş günü içinde değerlendirilir.",
    },
    2: {
        title: "Neden bu bilgilere ihtiyaç var?",
        text: "Kimlik ve adres bilgileri yasal kayıtlarla eşleştirilir; ödeme ve fatura süreçleri için zorunludur.",
        title2: "Bilgilerim güvende mi?",
        text2: "Verileriniz şifreli saklanır ve KVKK kapsamında işlenir.",
    },
    3: {
        title: "Kimlik ve ikametgah belgesini neden talep ediyoruz?",
        text: "Satıcı doğrulaması ve dolandırıcılık önleme amacıyla resmi belgeler gereklidir.",
        title2: "Belgelerimi kiminle paylaşacaksınız?",
        text2: "Belgeler yalnızca doğrulama sürecinde yetkili ekip tarafından incelenir.",
    },
    4: {
        title: "IBAN bilgisi neden talep ediliyor?",
        text: "Satış gelirlerinizi güvenli şekilde aktarabilmek için IBAN bilgisine ihtiyacımız var.",
        title2: "IBAN bilgimi sonradan değiştirebilir miyim?",
        text2: "Evet, destek ekibiyle iletişime geçerek güncelleyebilirsiniz.",
    },
    5: {
        title: "Son kontrol",
        text: "Bilgilerinizi onaya göndermeden önce özet ekranından kontrol edin.",
    },
};

export const DOC_DEFS = {
    none: [
        {
            key: "idFront",
            title: "Kimlik belgesi",
            hint: "TC kimliğinizin ön yüzünü yükleyiniz.",
            part: "ön",
        },
        {
            key: "idBack",
            title: "Kimlik belgesi",
            hint: "TC kimliğinizin arka yüzünü yükleyiniz.",
            part: "arka",
        },
        {
            key: "residence",
            title: "İkametgah Belgesi",
            hint: "e-Devlet üzerinden alınan güncel tarihli ve barkodlu ikametgah belgesini yükleyiniz.",
        },
    ],
    sole: [
        {
            key: "idFront",
            title: "Kimlik belgesi",
            hint: "Şirket sahibine ait TC kimliğinin ön yüzünü yükleyiniz.",
            part: "ön",
        },
        {
            key: "idBack",
            title: "Kimlik belgesi",
            hint: "Şirket sahibine ait TC kimliğinin arka yüzünü yükleyiniz.",
            part: "arka",
        },
        {
            key: "taxPlate",
            title: "Vergi Levhası",
            hint: "Güncel tarihli vergi levhasını yükleyiniz.",
        },
        {
            key: "residence",
            title: "İkametgah Belgesi",
            hint: "Şirket sahibine ait e-Devlet ikametgah belgesini yükleyiniz.",
        },
    ],
    corporate: [
        {
            key: "idFront",
            title: "Kimlik belgesi",
            hint: "Yetkili kişiye ait TC kimliğinin ön yüzünü yükleyiniz.",
            part: "ön",
        },
        {
            key: "idBack",
            title: "Kimlik belgesi",
            hint: "Yetkili kişiye ait TC kimliğinin arka yüzünü yükleyiniz.",
            part: "arka",
        },
        {
            key: "taxPlate",
            title: "Vergi Levhası",
            hint: "Şirkete ait güncel vergi levhasını yükleyiniz.",
        },
        {
            key: "residence",
            title: "İkametgah Belgesi",
            hint: "Yetkili kişiye ait ikametgah belgesini yükleyiniz.",
        },
    ],
};
