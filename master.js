// ============================================================
//  master.js  —  Data panduan RTC & daftar produk
//  Berdasarkan: "PANDUAN RETUR DAN RTC.xlsx"
//  Anda bisa edit file ini langsung (tidak perlu sentuh HTML).
// ============================================================

// ---- 1. PANDUAN RTC PER MEREK ----
// rtc     : daftar level diskon [{pct, h, emp}]
//              pct = persentase diskon (30/50/70/80)
//              h   = H-berapa sebelum kedaluwarsa
//              emp = true jika khusus karyawan
// takeout : H-berapa produk harus ditarik (0 = Hari H)
// ret     : H-berapa produk return ke supplier (null = tidak return)
const GUIDELINE = {
  brands: [
    // ============ JUICE ============
    { key:'mamaroz', match:['MAMAROZ'], cat:'JUICE',
      rtc:[{pct:30,h:3},{pct:50,h:2},{pct:70,h:1},{pct:80,h:0,emp:true}],
      takeout:null, ret:null },

    { key:'hana', match:['HANA'], cat:'JUICE',
      rtc:[{pct:30,h:5},{pct:50,h:4},{pct:70,h:3},{pct:80,h:2,emp:true}],
      takeout:1, ret:null },

    { key:'florida', match:['FLORIDA JUICE','FLORIDA'], cat:'JUICE',
      rtc:[{pct:30,h:30},{pct:50,h:15},{pct:70,h:7},{pct:80,h:5,emp:true}],
      takeout:1, ret:null },

    { key:'jungle', match:['JUNGLE JUICE'], cat:'JUICE',
      rtc:null, takeout:null, ret:14 },

    { key:'berri', match:['BERRI JUICE','BERRI'], cat:'JUICE',
      rtc:null, takeout:null, ret:14 },

    { key:'rejuve', match:['REJUVE'], cat:'JUICE',
      rtc:null, takeout:null, ret:3 },

    // ============ TRADITIONAL ============
    { key:'tempe_karya', match:['KARYA ABADI'], cat:'TRADITIONAL',
      rtc:[{pct:30,h:3},{pct:50,h:2},{pct:70,h:1}],
      takeout:0, ret:null },

    { key:'kulit_dimsum', match:['KULIT DIMSUM'], cat:'TRADITIONAL',
      rtc:[{pct:30,h:7},{pct:50,h:5},{pct:70,h:4},{pct:80,h:3,emp:true}],
      takeout:0, ret:null },

    { key:'telur_fiesta', match:['FIESTA FRESH EGG','FIESTA FRESH'], cat:'TRADITIONAL',
      rtc:[{pct:30,h:10},{pct:50,h:8},{pct:70,h:6},{pct:80,h:4,emp:true}],
      takeout:0, ret:null },

    { key:'telur_sogood', match:['SO GOOD FRESH','SO GOOD HEALTHY'], cat:'TRADITIONAL',
      rtc:null, takeout:null, ret:14 },

    { key:'tape_singkong', match:['TAPE SINGKONG'], cat:'TRADITIONAL',
      rtc:[{pct:30,h:3},{pct:50,h:2},{pct:70,h:1}],
      takeout:0, ret:null },

    { key:'tape_ketan', match:['TAPE KETAN'], cat:'TRADITIONAL',
      rtc:[{pct:30,h:7},{pct:50,h:5},{pct:70,h:4},{pct:80,h:3,emp:true}],
      takeout:0, ret:null },

    // ============ TAHU ============
    { key:'japanese_tofu', match:['JAPANESE TOFU'], cat:'TAHU',
      rtc:[{pct:30,h:3},{pct:50,h:2},{pct:70,h:1},{pct:80,h:1,emp:true}],
      takeout:0, ret:null },

    { key:'tahu_sakura', match:['SAKURA TAHU','TAHU SAKURA'], cat:'TAHU',
      rtc:[{pct:30,h:7},{pct:50,h:5},{pct:70,h:3},{pct:80,h:2,emp:true}],
      takeout:0, ret:null },

    { key:'tahu_kongke', match:['KONGKEE'], cat:'TAHU',
      rtc:[{pct:30,h:7},{pct:50,h:5},{pct:70,h:3},{pct:80,h:2,emp:true}],
      takeout:0, ret:null },

    { key:'tahu_yunyi', match:['YUNYIE','YUN YI'], cat:'TAHU',
      rtc:[{pct:30,h:7},{pct:50,h:5},{pct:70,h:2},{pct:80,h:1,emp:true}],
      takeout:0, ret:null },

    { key:'tahu_kims', match:['TAHU KIM','KIMS'], cat:'TAHU',
      rtc:[{pct:30,h:7},{pct:50,h:5},{pct:70,h:2},{pct:80,h:1,emp:true}],
      takeout:0, ret:null },

    { key:'tahu_yunsen', match:['YUNSEN'], cat:'TAHU',
      rtc:[{pct:30,h:7},{pct:50,h:5},{pct:70,h:2},{pct:80,h:1,emp:true}],
      takeout:0, ret:null },

    { key:'tahu_towang', match:['TOWANG'], cat:'TAHU',
      rtc:[{pct:30,h:5},{pct:50,h:3},{pct:70,h:2},{pct:80,h:1,emp:true}],
      takeout:0, ret:null },

    // ============ DESSERT ============
    { key:'deli_co', match:['DELI & CO','DELI&CO'], cat:'DESSERT',
      rtc:null, takeout:null, ret:1 },

    { key:'dd_cake', match:['DD CHOCOLATE','DD MINI','DD VANILLA'], cat:'DESSERT',
      rtc:[{pct:30,h:3},{pct:50,h:2},{pct:70,h:1},{pct:80,h:0,emp:true}],
      takeout:null, ret:null },

    { key:'dessert_nonret',
      match:['KEJU','BUTTER','WHIPPING CREAM'], cat:'DESSERT',
      rtc:[{pct:30,h:30},{pct:50,h:14},{pct:70,h:7},{pct:80,h:3,emp:true}],
      takeout:0, ret:null },

    // ============ YOGURT ============
    { key:'yummy', match:['YUMMY'], cat:'YOGURT',
      rtc:[{pct:30,h:14},{pct:50,h:10},{pct:70,h:5},{pct:80,h:1,emp:true}],
      takeout:0, ret:null },

    { key:'yogurt_ret',
      match:['GREEK','KIN BULGARIAN','KIN YOGURT','GREENFIELDS YOGURT',
             'BIOKUL','MEIJI SOFT YOGHURT','YAKULT'], cat:'YOGURT',
      rtc:null, takeout:null, ret:3 },

    // ============ SUSU ============
    { key:'susu_ret7',
      match:['HOMETOWN','SPENCER','DIAMOND FRESH','BROOKFARM'], cat:'SUSU',
      rtc:null, takeout:null, ret:7 },

    { key:'susu_ret3',
      match:['GREENFIELDS FRESH MILK','GREENFIELDS FRESHMILK',
             'GREENFIELDS SKIMMED','GREENFIELDS LOWFAT','CIMORY',
             'MILK LIFE','MEIJI FRESH'], cat:'SUSU',
      rtc:null, takeout:null, ret:3 },

    { key:'roti_ret',
      match:['ROTI','BREAD'], cat:'SUSU',
      rtc:null, takeout:null, ret:1 },

    // ============ FROZEN ============
    { key:'frozen_nonret',
      match:['FIESTA','SO GOOD','SO NICE','KANZLER','BELFOODS','BELFOOD',
             'BERNARDI','KIMBO','CEDEA','BUMIFOOD','RIVERLAND','SUNNY GOLD',
             'GOLDEN FARM','HANZEL','EL PRIMO','AROMA','DELIMAX','MABELL',
             'PERFECTIO','GOURMET MASTER','LEZZA','EDO'], cat:'FROZEN',
      rtc:[{pct:30,h:30},{pct:50,h:14},{pct:70,h:7},{pct:80,h:3,emp:true}],
      takeout:0, ret:null },

    { key:'ice_nonret',
      match:['ICE CREAM','AICE','CAMPINA','WALLS','MAGNUM','CORNETTO',
             'FEAST','PADDLE POP','FROSTBITE','HAKU','JOYDAY','LA CREMERIA',
             'HAAGENDAZS'], cat:'FROZEN',
      rtc:[{pct:30,h:30},{pct:50,h:14},{pct:70,h:7},{pct:80,h:3,emp:true}],
      takeout:0, ret:null },

    // ============ DEFAULT (fallback) ============
    { key:'default',
      match:['*'], cat:'LAIN',
      rtc:[{pct:30,h:30},{pct:50,h:14},{pct:70,h:7},{pct:80,h:3,emp:true}],
      takeout:0, ret:null },
  ],
};

// ---- 2. FUNGSI DETEKSI MEREK DARI NAMA ----
function detectBrand(nama) {
  const u = (nama || '').toUpperCase();
  // Urut: match dengan panjang terpanjang dulu
  const sorted = GUIDELINE.brands
    .filter(b => b.key !== 'default')
    .sort((a,b) => {
      const la = Math.max(...a.match.map(m => m.length));
      const lb = Math.max(...b.match.map(m => m.length));
      return lb - la;
    });
  for (const b of sorted) {
    if (b.match.some(m => u.includes(m.toUpperCase()))) return b;
  }
  return GUIDELINE.brands.find(b => b.key === 'default');
}

// ---- 3. DAFTAR PRODUK ----
// Format: [barcode, nama]
// Pola RTC otomatis dari nama via detectBrand().
// Untuk memaksa merek tertentu, tambahkan index ke-3:
//   ['8991234','Nama Produk','yummy']
const MASTER = [
  // === JUICE ===
  ['8991646002263','REJUVE TURMERIC GINGER'],
  ['8991646000030','REJUVE ASIAN GREEN 250 ML'],
  ['8991646000092','REJUVE BEAT THAT 250 ML'],
  ['8991646001686','REJUVE CRUSH WATERMELON 250 ML'],
  ['8991646000214','REJUVE FIREY BEAT 250 ML'],
  ['8991646000429','REJUVE TROPIC APPLE 250 ML'],
  ['8991646000061','REJUVE GREEN GLORY 250 ML'],
  ['8991646000122','REJUVE I.GLW 250 ML'],
  ['8991646000153','REJUVE U.GLW 250 ML'],
  ['8999898972839','JUNGLE JUICE ORANGE 1500 ML'],
  ['8999898972822','JUNGLE JUICE APPLE 1500 ML'],
  ['8999898561019','JUNGLE JUICE APPLE 200 ML'],
  ['8999898561026','JUNGLE JUICE ORANGE 200 ML'],
  ['8999898309079','JUNGLE JUICE APPLE 500 ML'],
  ['8999898976035','JUNGLE JUICE LYCHEE 200 ML'],
  ['8993363110016','BERRI JUICE ORANGE 1 LTR'],
  ['8993363130014','BERRI JUICE APPLE 1 LTR'],
  ['8993363140013','BERRI JUICE PINK GUAVA 1 LTR'],
  ['8993363120015','BERRI JUICE MANGO 1 LTR'],

  // === TRADITIONAL ===
  ['2000076641822','KARYA ABADI TEMPE BULAT 250GR NONPPN'],
  ['2000076641686','KARYA ABADI TEMPE JUMBO NONPPN'],
  ['2000076642294','KARYA ABADI TEMPE KOTAK 250GR NONPPN'],
  ['2000076642058','KARYA ABADI TEMPE MENDOAN 250GR NONPPN'],
  ['2000076641990','KARYA ABADI TEMPE MENDOAN NONPPN'],
  ['2000076641754','KARYA ABADI TEMPE POTONG 250GR NONPPN'],
  ['2000076642126','KARYA ABADI TEMPE SEGITIGA 250GR NONPPN'],
  ['8993207180649','FIESTA FRESH EGG PREMIUM 650GR'],
  ['8993207180649','FIESTA FRESH EGG PREMIUM 650GR'],
  ['2000077428668','TAPE KETAN PAMELLA 500GR'],
  ['2000091851282','TAPE SARI MANIS JEMBER'],
  ['2000077428422','TAPE SINGKONG CRP 300GR'],
  ['2000077428590','TAPE SINGKONG CRP 500GR'],

  // === TAHU ===
  ['2000026438540','JAPANESE TOFU MOMEN'],
  ['8993036212405','KONGKEE TAHU SUTRA SILKEN TOFU 240 GR'],
  ['8993036112507','KONGKEE TOFU JEPUN PUTIH 250 GR'],
  ['8993036114006','KONGKEE TOFU RASA UDANG 140 GR'],
  ['8993036114020','KONGKEE TOFU TELUR AYAM 140 GR'],
  ['8993036114013','KONGKEE TOFU TELUR SPECIAL 140 GR'],
  ['8997017180011','TAHU KIM S KUNING VACUUM 10S'],
  ['8997017180073','TAHU KIM S PUTIH VACUUM 10S'],
  ['8997017180127','TAHU KIM S YUN YI KUNING 4S'],
  ['8997017180004','TAHU KIM S YUN YI KUNING VACUUM 8S'],
  ['8997017180134','TAHU KIM S YUN YI PUTIH 4S'],
  ['8997017180066','TAHU KIM S YUN YI PUTIH VACUUM 8S'],
  ['8991788992415','SAKURA TAHU SUTRA 240 GR'],
  ['8991788973018','SAKURA TAHU SUTRA 300 GR'],
  ['8991788981617','SAKURA TAHU TELUR 160 GR'],
  ['8991788982416','SAKURA TAHU TELUR SUTRA 240 GR'],
  ['8991004042337','YUNSEN TAHU ORGANIK KUNING TALAGA 4S'],
  ['8991004042344','YUNSEN TAHU ORGANIK PUTIH TALAGA 4S'],
  ['8991004042313','YUNSEN TAHU PREMIUM KUNING TALAGA 4S'],
  ['8991004042320','YUNSEN TAHU PREMIUM PUTIH TALAGA 4S'],
  ['8997030780090','YUNYIE TAHU KUNING 4 PCS'],
  ['8997030780106','YUNYIE TAHU PUTIH 4PCS'],
  ['8997030780052','KINGS TAHU YUN YI KUNING 10 PCS'],
  ['8997030780069','KINGS TAHU YUN YI PUTIH 10 PCS'],
  ['2000063073186','TOWANG T PREMIUM 200GR'],
  ['2000099876232','TOWANG TAHU KALASAN 300GR'],
  ['2000063073018','TOWANG TAHU ORGANIK 200GR'],
  ['2000099876164','TOWANG TAHU SEAWEED 500GR'],
  ['2000091851350','TAHU SUSU PUTIH DAPUR NYONYA JOMBANG'],

  // === DESSERT ===
  ['8997238580157','DELI CO CREAMY CHOCO PUDDING 135GR'],
  ['8997238580010','DELI CO DOUBLE CHOUX CHOCOLATE 88GR'],
  ['8997238580232','DELI CO DOUBLE CHOUX MATCHA 88GR'],
  ['8997238580027','DELI CO DOUBLE CHOUX VANILLA 88GR'],
  ['8997238580614','DELI CO PILLOW CREPE CHOCOLATE 65 GR'],
  ['8997238580607','DELI CO PILLOW CREPE VANILLA 65 GR'],
  ['8997238580119','DELI CO BROWNIE BAR CHOCO'],
  ['8997238580386','DELI CO NEWYORK CHEESE CAKE'],
  ['2000089564606','DD CHOCOLATE ROLL CAKE'],
  ['2000089564842','DD MINI CHEESECAKE'],
  ['2000089564774','DD VANILLA ROLL CAKE'],

  // === YOGURT ===
  ['8993406830215','YUMMY YOFIT STRAWBERRY 180 ML'],
  ['8993406830314','YUMMY YOFIT BLUEBERRY 180 ML'],
  ['8993406830116','YUMMY YOFIT NATURAL PLAIN 180 ML'],
  ['8993406815007','YUMMY SKIM YOGHURT PLAIN 500 GR'],
  ['8993406805008','YUMMY YOGHURT PLAIN 500 GR'],
  ['8993406801253','YUMMY YOGHURT PLAIN 100GR'],
  ['8993406823019','YUMMY YOGHURT MANGO 100GR'],
  ['8993406801017','YUMMY YOGHURT GREEK ORIGINAL 100GR'],
  ['8993406801024','YUMMY YOGHURT GREEK STRAWBERRY 100GR'],
  ['8992994110112','YAKULT 5 X 65 ML'],
  ['8992994110136','YAKULT DOUBLE PACK 650ML'],
  ['8992994110143','YAKULT LIGHT 5 X 65 ML'],
  ['8992994000017','YAKULT MANGGA 5 X 65 ML'],
  ['8999898962649','BIOKUL STIRRED APRICOT 80ML'],
  ['8999898962212','BIOKUL STIRRED BLUEBERRY 80 ML'],
  ['8999898963912','BIOKUL STIRRED MANGO 80ML'],
  ['8999898962199','BIOKUL STIRRED PLAIN 80 ML'],
  ['8999898962205','BIOKUL STIRRED STRAWBERRY 80 ML'],
  ['8993351120003','GREENFIELDS YOGURT ORIGINAL 125GR'],
  ['8993351120300','GREENFIELDS YOGURT STRAWBERRY 125GR'],
  ['8850329315116','MEIJI SOFT YOGHURT STRAWBERRY 135GR'],
  ['8850329315918','MEIJI SOFT YOGHURT MIXEDBERRY 135GR'],
  ['8997220410011','KIN YOGURT ORIGINAL 200ML'],
  ['8997220410028','KIN YOGURT STRAWBERRY 200ML'],
  ['8997220410103','KIN YOGURT BLUEBERRY 200ML'],

  // === SUSU ===
  ['8999898969419','BROOKFARM FRESH MILK LOW FAT 946ML'],
  ['8999898969846','BROOKFARM FRESH MILK STRAWBERRY 946ML'],
  ['8999898300038','DIAMOND FRESH MILK CHOCOLATE 946ML'],
  ['8999898301011','DIAMOND FRESH MILK NON FAT 946ML'],
  ['8999898962458','DIAMOND FRESH MILK STRAWBERRY 946ML'],
  ['8999898300076','DIAMOND FRESH MILK CHOCOLATE 300ML'],
  ['8993351129419','GREENFIELDS SKIMMED MILK 950ML'],
  ['8993351129211','GREENFIELDS LOWFAT MILK 950ML'],
  ['8993351129501','GREENFIELDS CHOCO MILK 950ML'],
  ['8993351129105','GREENFIELDS FRESH MILK 950ML'],
  ['8993351129914','GREENFIELDS FRESH MILK 1890ML'],
  ['8991999110318','MILK LIFE CHOCO 1000MLX12'],
  ['8991999110417','MILK LIFE CHOCO 200MLX24'],
  ['8991999110011','MILK LIFE FRESH PLAIN 1000MLX12 NON PPN'],
  ['8997213710104','HOMETOWN FRESH MILK 1000ML NONPPN'],
  ['8997213710326','HOMETOWN FRESH MILK 450ML NONPPN'],
  ['8993200663729','CIMORY FULL CREAM 950ML NONPPN'],
  ['8850329183715','MEIJI FRESH MILK DELUXE 4.3 946ML'],

  // === FROZEN ===
  ['8992770191014','AJINOMOTO FROZEN CHICKEN GYOZA 200GR'],
  ['8992770191007','AJINOMOTO FROZEN CHICKEN GYOZA 600GR'],
  ['8994036551334','AROMA BAKSO BABI BESAR 250 GR VCM'],
  ['8994036552331','AROMA BAKSO BABI KECIL 250 GR VCM'],
  ['8994130900670','BELFOOD CHICKEN COCKTAIL 400GR'],
  ['8994130899691','BELFOODS CHICKEN NUGGET CRUNCHY 500 GR'],
  ['8995229800321','BELFOODS FAVORITE CHICKEN NUGGET 500 GR'],
  ['8993071700301','BELFOOD ROYAL FRY N SHAKE 250GR'],
  ['9916500102100','BERNARDI BAKSO SAPI BESAR 25 PCS'],
  ['9916995101107','BERNARDI BAKSO SAPI BESAR 50 PCS'],
  ['8997014356013','CEDEA BASO IKAN BESAR 500 GR'],
  ['8997014352626','CEDEA CHIKUWA 250GR'],
  ['8993492101909','EDO CHIKUWA 250GR'],
  ['8993492101893','EDO CUTTLE FISH BALL 250GR'],
  ['8993207180786','FIESTA READY MEAL BEEF BULGOGI WITH RICE 320 G'],
  ['8993207180717','FIESTA READY MEAL BEEF RENDANG W RICE 320GR'],
  ['8993207240558','FIESTA NUGGET 400 GR'],
  ['8993207240619','FIESTA KARAGE 400GR'],
  ['8995555216315','KIMBO BURGER SAPI ISTIMEWA 06 PCS 200GR'],
  ['8995555676713','KIMBO GOLD PLUS BAKSO SAPI 25PCS 340GR'],
  ['8995555115625','KIMBO SOSIS SAPI GORENG 06 PCS 186GR'],

  // === ICE CREAM ===
  ['8885013131055','AICE FAMILY PACK MOCHI CHOCOLATE X6'],
  ['8885013131048','AICE FAMILY PACK MOCHI DURIAN X6'],
  ['8885013131031','AICE FAMILY PACK MOCHI VANILLA X6'],
  ['8998009972669','CAMPINA BANANA SPLIT ISI 6PCS 700ML'],
  ['8990114000459','CAMPINA BLUEBERRY CHIPS 700 ML'],
  ['8990114000442','CAMPINA NEAPOLITAN 700 ML'],
  ['8999999005610','MAGNUM ALMOND 24X90ML'],
  ['8999999005689','MAGNUM CLASSIC 24X90ML'],
  ['8999999513757','CORNETTO DISC OREO 110ML'],
  ['8999999608200','CORNETTO DISC CHOCO HAZELNUT 24X108ML'],
  ['8999999294038','FEAST CHOCOLATE 65ML'],
  ['8999999294021','FEAST VANILLA 65ML'],
  ['8999898270027','DIAMOND ICE CREAM IC REG CHOCOLATE 700 ML'],
  ['8999898270058','DIAMOND ICE CREAM IC REG NEOPOLITAN 700 ML'],
  ['8999898270034','DIAMOND ICE CREAM IC REG STRAWBERRY 700ML'],
  ['8999898270010','DIAMOND ICE CREAM IC REG VANILLA 700 ML'],
  ['8998866820400','FROSTBITE COOKIES CREAM 60MLX48'],
  ['8998866820103','GLICO HAKU MONAKA VANILLA 180ML'],
];

// Ekspor ke window
window.GUIDELINE = GUIDELINE;
window.MASTER = MASTER;
window.detectBrand = detectBrand;