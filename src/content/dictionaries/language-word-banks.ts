import { supplementalLanguageLexicons } from "@/content/dictionaries/language-layered-lexicons";

export type LanguageDirection = "ltr" | "rtl";

export interface LayeredLanguageLexicon {
  foundationalWords: readonly string[];
  developingWords: readonly string[];
  advancedWords: readonly string[];
  realWordBank: readonly string[];
  syntheticWordBank: readonly string[];
  phraseFragments: readonly string[];
  benchmarkSentences: readonly string[];
}

export interface LanguageBlueprint {
  id: string;
  label: string;
  nativeLabel: string;
  direction: LanguageDirection;
  letters: string;
  uppercaseLetters?: string;
  punctuation: readonly string[];
  quotes: readonly string[];
  sampleSentence: string;
  seedWords: readonly string[];
  stems: readonly string[];
  prefixes: readonly string[];
  suffixes: readonly string[];
  pseudoSyllables: readonly string[];
}

interface ImportedLexiconShape {
  realWords?: readonly string[];
  foundationalWords?: readonly string[];
  developingWords?: readonly string[];
  advancedWords?: readonly string[];
  phraseFragments?: readonly string[];
  benchmarkSentences?: readonly string[];
}

const universalDigits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

function uniqueWords(words: readonly string[]) {
  return Array.from(new Set(words.map((word) => word.trim()).filter(Boolean)));
}

function normalizeSentence(sentence: string) {
  const trimmedSentence = sentence.trim();

  if (!trimmedSentence) {
    return trimmedSentence;
  }

  return /[.!?؟。！？]$/u.test(trimmedSentence) ? trimmedSentence : `${trimmedSentence}.`;
}

function derivePhraseFragments(languageBlueprint: LanguageBlueprint, realWordBank: readonly string[]) {
  const sampleWords = languageBlueprint.sampleSentence
    .replace(/[.,!?;:。！？،؛؟]+/gu, " ")
    .split(/\s+/u)
    .filter(Boolean);
  const anchors = [
    realWordBank[0],
    realWordBank[4],
    realWordBank[8],
    realWordBank[12],
    realWordBank[16],
    realWordBank[20],
  ].filter(Boolean);

  return uniqueWords(
    [
      sampleWords.slice(0, 2).join(" "),
      sampleWords.slice(2, 5).join(" "),
      [anchors[0], anchors[1]].filter(Boolean).join(" "),
      [anchors[2], anchors[3]].filter(Boolean).join(" "),
      [anchors[4], anchors[5]].filter(Boolean).join(" "),
    ].filter((fragment) => fragment.split(/\s+/u).length >= 2),
  );
}

function deriveBenchmarkSentences(
  languageBlueprint: LanguageBlueprint,
  realWordBank: readonly string[],
) {
  const anchors = [
    realWordBank[0],
    realWordBank[3],
    realWordBank[6],
    realWordBank[9],
    realWordBank[12],
    realWordBank[15],
    realWordBank[18],
    realWordBank[21],
  ].filter(Boolean);

  return uniqueWords(
    [
      normalizeSentence(languageBlueprint.sampleSentence),
      normalizeSentence([anchors[0], anchors[1], anchors[2], anchors[3]].filter(Boolean).join(" ")),
      normalizeSentence([anchors[4], anchors[5], anchors[6], anchors[7]].filter(Boolean).join(" ")),
    ].filter((sentence) => sentence.split(/\s+/u).length >= 3),
  );
}

function buildLayeredLexicon(
  languageId: keyof typeof languageBlueprints,
  languageBlueprint: LanguageBlueprint,
) {
  const supplementalLexicon = (supplementalLanguageLexicons[languageId] as
    | ImportedLexiconShape
    | undefined) ?? {};
  const foundationalStageWords = uniqueWords([
    ...(supplementalLexicon.foundationalWords ?? []),
  ]);
  const developingStageWords = uniqueWords([
    ...(supplementalLexicon.developingWords ?? []),
  ]);
  const advancedStageWords = uniqueWords([
    ...(supplementalLexicon.advancedWords ?? []),
  ]);
  const stagedRealWords = uniqueWords([
    ...foundationalStageWords,
    ...developingStageWords,
    ...advancedStageWords,
  ]);
  const realWordBank = uniqueWords([
    ...stagedRealWords,
    ...(supplementalLexicon.realWords ?? []),
    ...languageBlueprint.seedWords,
  ]);
  const foundationalTarget = Math.max(24, Math.min(72, Math.round(realWordBank.length * 0.34)));
  const developingTarget = Math.max(20, Math.min(64, Math.round(realWordBank.length * 0.32)));
  const foundationalWords =
    foundationalStageWords.length > 0
      ? foundationalStageWords
      : realWordBank.slice(0, foundationalTarget);
  const developingWords =
    developingStageWords.length > 0
      ? developingStageWords
      : realWordBank.slice(foundationalTarget, foundationalTarget + developingTarget);
  const advancedWords =
    advancedStageWords.length > 0
      ? advancedStageWords
      : uniqueWords([
          ...realWordBank.slice(foundationalTarget + developingTarget),
          ...realWordBank.filter((word) => word.length >= 8).slice(0, 24),
        ]);
  const expandedWordBank = expandWordBank(languageBlueprint, realWordBank);
  const realWordSet = new Set(realWordBank);

  return {
    foundationalWords,
    developingWords,
    advancedWords,
    realWordBank,
    syntheticWordBank: expandedWordBank.filter((word) => !realWordSet.has(word)),
    phraseFragments: uniqueWords([
      ...(supplementalLexicon.phraseFragments ?? []),
      ...derivePhraseFragments(languageBlueprint, realWordBank),
    ]),
    benchmarkSentences: uniqueWords([
      ...(supplementalLexicon.benchmarkSentences ?? []),
      ...deriveBenchmarkSentences(languageBlueprint, realWordBank),
    ]),
  } satisfies LayeredLanguageLexicon;
}

function expandWordBank(
  languageBlueprint: LanguageBlueprint,
  realWordBank: readonly string[] = languageBlueprint.seedWords,
) {
  const baseWords = uniqueWords([...realWordBank, ...languageBlueprint.seedWords]);
  const permittedCharacters = new Set([
    ...Array.from(languageBlueprint.letters),
    ...Array.from(languageBlueprint.uppercaseLetters ?? ""),
    ...baseWords.flatMap((word) => Array.from(word)),
    ...languageBlueprint.stems.flatMap((word) => Array.from(word)),
    ...languageBlueprint.prefixes.flatMap((word) => Array.from(word)),
    ...languageBlueprint.suffixes.flatMap((word) => Array.from(word)),
    ...languageBlueprint.pseudoSyllables.flatMap((word) => Array.from(word)),
    "'",
    "’",
    "-",
  ]);
  const wordBank = new Set<string>(baseWords);

  const addWord = (candidateWord: string) => {
    const normalizedWord = candidateWord.trim();

    if (
      normalizedWord.length < 3 ||
      normalizedWord.length > 18 ||
      !Array.from(normalizedWord).every((character) => permittedCharacters.has(character))
    ) {
      return;
    }

    wordBank.add(normalizedWord);
  };

  for (const stem of languageBlueprint.stems) {
    addWord(stem);

    for (const suffix of languageBlueprint.suffixes) {
      addWord(`${stem}${suffix}`);
    }
  }

  for (const prefix of languageBlueprint.prefixes) {
    for (const stem of languageBlueprint.stems) {
      addWord(`${prefix}${stem}`);

      for (const suffix of languageBlueprint.suffixes.slice(0, 4)) {
        addWord(`${prefix}${stem}${suffix}`);
      }
    }
  }

  for (const firstSyllable of languageBlueprint.pseudoSyllables) {
    for (const secondSyllable of languageBlueprint.pseudoSyllables) {
      addWord(`${firstSyllable}${secondSyllable}`);
      addWord(`${firstSyllable}${secondSyllable}${languageBlueprint.pseudoSyllables[0] ?? ""}`);
    }
  }

  return Array.from(wordBank);
}

export const languageBlueprints = {
  english: {
    id: "english",
    label: "English",
    nativeLabel: "English",
    direction: "ltr",
    letters: "abcdefghijklmnopqrstuvwxyz",
    uppercaseLetters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`, "`"],
    sampleSentence: "Quiet lines make steady movement easier.",
    seedWords: ["steady", "signal", "woven", "bridge", "careful", "clarity", "window", "garden", "letter", "market", "paper", "silver", "morning", "kettle"],
    stems: ["signal", "steady", "motion", "craft", "tempo", "bridge", "letter", "window", "garden", "paper", "market", "future", "morning"],
    prefixes: ["re", "pre", "over", "under", "cross", "micro"],
    suffixes: ["ing", "ed", "er", "ly", "less", "wise"],
    pseudoSyllables: ["ta", "lo", "mi", "sen", "ra", "chi", "ve", "no", "pla", "der"],
  },
  spanish: {
    id: "spanish",
    label: "Spanish",
    nativeLabel: "Español",
    direction: "ltr",
    letters: "abcdefghijklmnñopqrstuvwxyzáéíóúü",
    uppercaseLetters: "ABCDEFGHIJKLMNÑOPQRSTUVWXYZÁÉÍÓÚÜ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "¡", "¿"],
    quotes: [`"`, `'`],
    sampleSentence: "La práctica constante crea control.",
    seedWords: ["claro", "ritmo", "puente", "teclado", "señal", "pasaje", "número", "rápido", "detalle", "ventana", "pulso", "lengua"],
    stems: ["ritmo", "tecla", "paso", "señal", "puente", "claro", "pulso", "texto", "rápido", "detalle"],
    prefixes: ["re", "pre", "contra", "sobre", "micro"],
    suffixes: ["mente", "ción", "dor", "ria", "ble"],
    pseudoSyllables: ["la", "te", "ri", "mo", "cla", "pu", "sen", "ve", "na", "do"],
  },
  french: {
    id: "french",
    label: "French",
    nativeLabel: "Français",
    direction: "ltr",
    letters: "abcdefghijklmnopqrstuvwxyzàâçéèêëîïôùûüÿœ",
    uppercaseLetters: "ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÇÉÈÊËÎÏÔÙÛÜŸŒ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`, "«", "»"],
    sampleSentence: "Chaque touche demande une attention précise.",
    seedWords: ["clavier", "propre", "rythme", "nuance", "lettre", "espace", "valeur", "rapide", "phrase", "mesure", "constance", "moteur"],
    stems: ["clavier", "nuance", "mesure", "phrase", "lettre", "propre", "tempo", "valeur", "signal", "moteur"],
    prefixes: ["re", "pré", "sur", "contre", "micro"],
    suffixes: ["ment", "tion", "eur", "euse", "able"],
    pseudoSyllables: ["cla", "vie", "rai", "nu", "mer", "sou", "pro", "lan", "te", "se"],
  },
  german: {
    id: "german",
    label: "German",
    nativeLabel: "Deutsch",
    direction: "ltr",
    letters: "abcdefghijklmnopqrstuvwxyzäöüß",
    uppercaseLetters: "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜẞ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Sauberes Tippen verbindet Tempo und Ruhe.",
    seedWords: ["tastatur", "zeichen", "ordnung", "tempo", "klarheit", "lernen", "fortschritt", "fenster", "fehler", "punkt", "schrift", "zahlen"],
    stems: ["tast", "zeichen", "klar", "lern", "tempo", "schrift", "zahlen", "fenster", "ordnung", "fehler"],
    prefixes: ["vor", "nach", "unter", "über", "mit"],
    suffixes: ["en", "er", "ung", "lich", "heit"],
    pseudoSyllables: ["ta", "zei", "ler", "ord", "fen", "sch", "kla", "tem", "ruh", "gen"],
  },
  portuguese: {
    id: "portuguese",
    label: "Portuguese",
    nativeLabel: "Português",
    direction: "ltr",
    letters: "abcdefghijklmnopqrstuvwxyzáâãàçéêíóôõú",
    uppercaseLetters: "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÂÃÀÇÉÊÍÓÔÕÚ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Cada sessão melhora o controle dos dedos.",
    seedWords: ["teclado", "clareza", "ritmo", "passagem", "número", "janela", "código", "detalhe", "memória", "rápido", "sinal", "toque"],
    stems: ["tecla", "ritmo", "clare", "janela", "sinal", "memó", "toque", "passa", "rápido", "detal"],
    prefixes: ["re", "pré", "sobre", "contra", "micro"],
    suffixes: ["ção", "mente", "dor", "ria", "vel"],
    pseudoSyllables: ["te", "cla", "ri", "mo", "si", "nal", "to", "que", "ja", "ne"],
  },
  italian: {
    id: "italian",
    label: "Italian",
    nativeLabel: "Italiano",
    direction: "ltr",
    letters: "abcdefghilmnopqrstuvzàèéìòù",
    uppercaseLetters: "ABCDEFGHILMNOPQRSTUVZÀÈÉÌÒÙ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Una pratica pulita rende il ritmo stabile.",
    seedWords: ["tastiera", "ritmo", "ponte", "preciso", "lettera", "spazio", "valore", "rapido", "misura", "sereno", "motore", "segnale"],
    stems: ["tasti", "ritmo", "ponte", "chiaro", "spazio", "valore", "motore", "misura", "segnal", "seren"],
    prefixes: ["ri", "pre", "sovra", "contro", "micro"],
    suffixes: ["mente", "zione", "tore", "abile", "oso"],
    pseudoSyllables: ["ta", "sti", "ri", "mo", "pon", "te", "va", "lo", "se", "gno"],
  },
  dutch: {
    id: "dutch",
    label: "Dutch",
    nativeLabel: "Nederlands",
    direction: "ltr",
    letters: "abcdefghijklmnopqrstuvwxyzéëïóöü",
    uppercaseLetters: "ABCDEFGHIJKLMNOPQRSTUVWXYZÉËÏÓÖÜ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Rustige herhaling bouwt nauwkeurige snelheid.",
    seedWords: ["toetsen", "ritme", "brug", "helder", "venster", "detail", "tempo", "letters", "nauwkeurig", "ruimte", "signaal", "controle"],
    stems: ["toets", "ritme", "venster", "tempo", "helder", "ruimte", "signaal", "detail", "controle", "letter"],
    prefixes: ["her", "voor", "onder", "boven", "micro"],
    suffixes: ["ing", "heid", "lijk", "baar", "er"],
    pseudoSyllables: ["toe", "rit", "hel", "ven", "sig", "na", "ru", "im", "con", "tro"],
  },
  estonian: {
    id: "estonian",
    label: "Estonian",
    nativeLabel: "Eesti",
    direction: "ltr",
    letters: "abdeghijklmnoprstuõäöüšzž",
    uppercaseLetters: "ABDEGHIJKLMNOPRSTUÕÄÖÜŠZŽ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Rahulik harjutus hoiab rütmi puhtana.",
    seedWords: ["klaviatuur", "rütm", "sild", "täpsus", "aken", "signaal", "tempo", "täht", "number", "stabiilne", "detail", "voog"],
    stems: ["klavia", "rütm", "täps", "aken", "signa", "tempo", "täht", "number", "stabi", "detail"],
    prefixes: ["üle", "ala", "taas", "mikro", "vastu"],
    suffixes: ["mine", "lik", "line", "sus", "ja"],
    pseudoSyllables: ["kla", "rüt", "täp", "ak", "sig", "tem", "tä", "num", "sta", "voo"],
  },
  swedish: {
    id: "swedish",
    label: "Swedish",
    nativeLabel: "Svenska",
    direction: "ltr",
    letters: "abcdefghijklmnopqrstuvwxyzåäö",
    uppercaseLetters: "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Lugn träning bygger stadig precision.",
    seedWords: ["tangent", "rytm", "bro", "fokus", "signal", "detalj", "tempo", "ordning", "fönster", "siffra", "stabil", "klarhet"],
    stems: ["tangent", "rytm", "signal", "tempo", "klar", "ordning", "stabil", "detalj", "fönster", "siffra"],
    prefixes: ["över", "under", "för", "mot", "mikro"],
    suffixes: ["ing", "het", "lig", "bar", "are"],
    pseudoSyllables: ["tan", "ryt", "sig", "nal", "sta", "bil", "fo", "kus", "kla", "het"],
  },
  norwegian: {
    id: "norwegian",
    label: "Norwegian",
    nativeLabel: "Norsk",
    direction: "ltr",
    letters: "abcdefghijklmnopqrstuvwxyzæøå",
    uppercaseLetters: "ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Rolig øving holder rytmen presis.",
    seedWords: ["tastatur", "rytme", "bro", "klarhet", "vindu", "tempo", "signal", "detalj", "siffer", "presis", "styrke", "struktur"],
    stems: ["tast", "rytme", "klar", "vindu", "tempo", "signal", "styr", "struktur", "detalj", "presis"],
    prefixes: ["for", "over", "under", "sam", "mikro"],
    suffixes: ["ing", "het", "lig", "bar", "er"],
    pseudoSyllables: ["tas", "ryt", "vin", "sig", "pre", "struk", "tur", "kla", "he", "det"],
  },
  "norwegian-bokmal": {
    id: "norwegian-bokmal",
    label: "Norwegian Bokmål",
    nativeLabel: "Norsk Bokmål",
    direction: "ltr",
    letters: "abcdefghijklmnopqrstuvwxyzæøå",
    uppercaseLetters: "ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Rolig øving holder rytmen presis.",
    seedWords: ["tastatur", "rytme", "bro", "klarhet", "vindu", "tempo", "signal", "detalj", "siffer", "presis", "styrke", "struktur"],
    stems: ["tast", "rytme", "klar", "vindu", "tempo", "signal", "styr", "struktur", "detalj", "presis"],
    prefixes: ["for", "over", "under", "sam", "mikro"],
    suffixes: ["ing", "het", "lig", "bar", "er"],
    pseudoSyllables: ["tas", "ryt", "vin", "sig", "pre", "struk", "tur", "kla", "he", "det"],
  },
  danish: {
    id: "danish",
    label: "Danish",
    nativeLabel: "Dansk",
    direction: "ltr",
    letters: "abcdefghijklmnopqrstuvwxyzæøå",
    uppercaseLetters: "ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Jævn træning holder bevægelsen rolig.",
    seedWords: ["tastatur", "rytme", "bro", "klarhed", "vindue", "signal", "detalje", "tempo", "præcis", "stabil", "talrække", "struktur"],
    stems: ["tast", "rytme", "klar", "vindu", "signal", "tempo", "struktur", "stabil", "præcis", "detalj"],
    prefixes: ["for", "over", "under", "sam", "mikro"],
    suffixes: ["ing", "hed", "lig", "bar", "er"],
    pseudoSyllables: ["tas", "ryt", "vin", "sig", "sta", "bil", "tem", "po", "kla", "hed"],
  },
  finnish: {
    id: "finnish",
    label: "Finnish",
    nativeLabel: "Suomi",
    direction: "ltr",
    letters: "abcdefghijklmnopqrstuvwxyzåäö",
    uppercaseLetters: "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Tasainen harjoitus tekee liikkeestä puhtaan.",
    seedWords: ["näppäin", "rytmi", "silta", "selkeys", "ikkuna", "merkki", "tempo", "kirjain", "numero", "vakaa", "tarkka", "virtaus"],
    stems: ["näppä", "rytmi", "selke", "ikku", "merk", "kirjai", "numero", "vakaa", "tark", "virta"],
    prefixes: ["esi", "yli", "ala", "pikku", "mikro"],
    suffixes: ["inen", "sti", "us", "ja", "lla"],
    pseudoSyllables: ["näp", "ryt", "sil", "sel", "ik", "mer", "nu", "va", "tar", "vir"],
  },
  polish: {
    id: "polish",
    label: "Polish",
    nativeLabel: "Polski",
    direction: "ltr",
    letters: "aąbcćdeęfghijklłmnńoópqrsśtuvwxyzźż",
    uppercaseLetters: "AĄBCĆDEĘFGHIJKLŁMNŃOÓPQRSŚTUVWXYZŹŻ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Spokojny rytm buduje czystą precyzję.",
    seedWords: ["klawiatura", "rytm", "most", "dokładność", "okno", "sygnał", "tempo", "litera", "liczba", "płynność", "spokój", "detal"],
    stems: ["klawi", "rytm", "dokład", "okno", "sygna", "tempo", "litera", "liczba", "płyn", "detal"],
    prefixes: ["prze", "pod", "nad", "mikro", "wspó"],
    suffixes: ["owy", "enie", "anie", "ność", "nik"],
    pseudoSyllables: ["kla", "ryt", "dok", "ok", "syg", "li", "czba", "pły", "spo", "det"],
  },
  czech: {
    id: "czech",
    label: "Czech",
    nativeLabel: "Čeština",
    direction: "ltr",
    letters: "aábcčdďeéěfghchiíjklmnňoópqrřsštťuúůvwxyýzž",
    uppercaseLetters: "AÁBCČDĎEÉĚFGHCHIÍJKLMNŇOÓPQRŘSŠTŤUÚŮVWXYÝZŽ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Klidné opakování drží tempo přesné.",
    seedWords: ["klávesa", "rytmus", "most", "přesnost", "okno", "signál", "tempo", "písmeno", "číslo", "tok", "klid", "detail"],
    stems: ["kláve", "rytmu", "přes", "okno", "signá", "tempo", "písme", "čísl", "detail", "klid"],
    prefixes: ["pře", "pod", "nad", "mikro", "mezi"],
    suffixes: ["ní", "nost", "ový", "ník", "ka"],
    pseudoSyllables: ["klá", "ryt", "pře", "ok", "sig", "tem", "pís", "čí", "de", "ta"],
  },
  croatian: {
    id: "croatian",
    label: "Croatian",
    nativeLabel: "Hrvatski",
    direction: "ltr",
    letters: "abcčćdđefghijklmnoprsštuvzž",
    uppercaseLetters: "ABCČĆDĐEFGHIJKLMNOPRSŠTUVZŽ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Mirna vježba čuva ritam čistim.",
    seedWords: ["tipkovnica", "ritam", "most", "točnost", "prozor", "signal", "tempo", "slovo", "broj", "stabilno", "detalj", "tok"],
    stems: ["tipko", "ritam", "točn", "prozor", "signa", "tempo", "slovo", "broj", "stabil", "detal"],
    prefixes: ["pre", "pod", "nad", "mikro", "među"],
    suffixes: ["nost", "anje", "nik", "ski", "ica"],
    pseudoSyllables: ["tip", "ri", "to", "pro", "sig", "tem", "slo", "bro", "sta", "det"],
  },
  romanian: {
    id: "romanian",
    label: "Romanian",
    nativeLabel: "Română",
    direction: "ltr",
    letters: "aăâbcdefghiîjklmnopqrsștțuvwxyz",
    uppercaseLetters: "AĂÂBCDEFGHIÎJKLMNOPQRSȘTȚUVWXYZ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Practica liniștită păstrează ritmul curat.",
    seedWords: ["tastatură", "ritm", "pod", "claritate", "fereastră", "semnal", "tempo", "literă", "număr", "stabil", "detaliu", "flux"],
    stems: ["tasta", "ritm", "clari", "fere", "semna", "tempo", "litera", "număr", "stabil", "detali"],
    prefixes: ["pre", "re", "supra", "contra", "micro"],
    suffixes: ["ție", "tor", "abil", "are", "ment"],
    pseudoSyllables: ["tas", "rit", "cla", "fe", "sem", "tem", "li", "nu", "sta", "de"],
  },
  hungarian: {
    id: "hungarian",
    label: "Hungarian",
    nativeLabel: "Magyar",
    direction: "ltr",
    letters: "aábcdeéfghiíjklmnoóöőpqrstuúüűvwxyz",
    uppercaseLetters: "AÁBCDEÉFGHIÍJKLMNOÓÖŐPQRSTUÚÜŰVWXYZ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "A nyugodt ismétlés tiszta ritmust épít.",
    seedWords: ["billentyű", "ritmus", "híd", "pontosság", "ablak", "jelzés", "tempó", "betű", "szám", "stabil", "részlet", "folyam"],
    stems: ["bille", "ritmu", "pontos", "ablak", "jelzé", "tempó", "betű", "szám", "stabil", "rész"],
    prefixes: ["elő", "utó", "alá", "fölé", "mikro"],
    suffixes: ["ság", "ás", "és", "os", "ható"],
    pseudoSyllables: ["bil", "rit", "pon", "ab", "jel", "tem", "be", "szá", "sta", "rész"],
  },
  slovenian: {
    id: "slovenian",
    label: "Slovenian",
    nativeLabel: "Slovenščina",
    direction: "ltr",
    letters: "abcčdefghijklmnoprsštuvzž",
    uppercaseLetters: "ABCČDEFGHIJKLMNOPRSŠTUVZŽ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Mirna vaja ohranja ritem natančen.",
    seedWords: ["tipkovnica", "ritem", "most", "natančnost", "okno", "signal", "tempo", "črka", "število", "stabilno", "podrobnost", "tok"],
    stems: ["tipko", "ritem", "natan", "okno", "signa", "tempo", "črka", "števi", "stabil", "podrob"],
    prefixes: ["pre", "pod", "nad", "mikro", "med"],
    suffixes: ["nost", "anje", "nik", "ski", "ilo"],
    pseudoSyllables: ["tip", "ri", "na", "ok", "sig", "tem", "čr", "šte", "sta", "po"],
  },
  turkish: {
    id: "turkish",
    label: "Turkish",
    nativeLabel: "Türkçe",
    direction: "ltr",
    letters: "abcçdefgğhıijklmnoöprsştuüvyz",
    uppercaseLetters: "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Dengeli tekrar yazma akışını güçlendirir.",
    seedWords: ["klavye", "ritim", "denge", "işaret", "harfler", "sayılar", "odak", "pratik", "hızlı", "temiz", "yüksek", "çözüm"],
    stems: ["klav", "ritim", "denge", "işar", "harf", "sayı", "odak", "prat", "hız", "temiz"],
    prefixes: ["ön", "arka", "alt", "üst", "mikro"],
    suffixes: ["li", "lik", "leme", "sel", "ci"],
    pseudoSyllables: ["kla", "ri", "den", "işa", "har", "sa", "o", "pra", "hız", "te"],
  },
  indonesian: {
    id: "indonesian",
    label: "Indonesian",
    nativeLabel: "Bahasa Indonesia",
    direction: "ltr",
    letters: "abcdefghijklmnopqrstuvwxyz",
    uppercaseLetters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Latihan tenang menjaga ritme tetap rapi.",
    seedWords: ["keyboard", "ritme", "jembatan", "jelas", "layar", "sinyal", "tempo", "huruf", "angka", "stabil", "detail", "gerak"],
    stems: ["key", "ritme", "jelas", "layar", "sinyal", "tempo", "huruf", "angka", "stabil", "detail"],
    prefixes: ["pra", "ulang", "antar", "mikro", "super"],
    suffixes: ["kan", "an", "i", "nya", "wan"],
    pseudoSyllables: ["la", "ti", "han", "ri", "tem", "si", "nal", "hu", "ruf", "ang"],
  },
  ukrainian: {
    id: "ukrainian",
    label: "Ukrainian",
    nativeLabel: "Українська",
    direction: "ltr",
    letters: "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя",
    uppercaseLetters: "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: ["«", "»", `"`, `'`],
    sampleSentence: "Спокійний ритм тримає точність чистою.",
    seedWords: ["клавіатура", "ритм", "міст", "точність", "вікно", "сигнал", "темп", "літера", "цифра", "стабільність", "деталь", "потік"],
    stems: ["клав", "ритм", "точн", "вікн", "сигна", "темп", "літер", "цифр", "детал", "пот"],
    prefixes: ["пере", "над", "під", "мікро", "між"],
    suffixes: ["ний", "ність", "ення", "увач", "ка"],
    pseudoSyllables: ["кла", "рит", "точ", "вік", "сиг", "тем", "лі", "ци", "де", "по"],
  },
  belarusian: {
    id: "belarusian",
    label: "Belarusian",
    nativeLabel: "Беларуская",
    direction: "ltr",
    letters: "абвгдзеёжзійклмнопрстуўфхцчшыьэюя",
    uppercaseLetters: "АБВГДЗЕЁЖЗІЙКЛМНОПРСТУЎФХЦЧШЫЬЭЮЯ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: ["«", "»", `"`, `'`],
    sampleSentence: "Спакойны рытм захоўвае дакладнасць чыстай.",
    seedWords: ["клавіятура", "рытм", "мост", "дакладнасць", "акно", "сігнал", "тэмп", "літара", "лічба", "стабільнасць", "дэталь", "паток"],
    stems: ["клав", "рытм", "даклад", "акно", "сігна", "тэмп", "літар", "лічб", "дэтал", "пат"],
    prefixes: ["пера", "над", "пад", "мікра", "між"],
    suffixes: ["ны", "насць", "енне", "аль", "ка"],
    pseudoSyllables: ["кла", "ры", "да", "ак", "сі", "тэм", "лі", "ліч", "дэ", "па"],
  },
  russian: {
    id: "russian",
    label: "Russian",
    nativeLabel: "Русский",
    direction: "ltr",
    letters: "абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
    uppercaseLetters: "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: ["«", "»", `"`, `'`],
    sampleSentence: "Спокойный ритм держит строку ровной.",
    seedWords: ["клавиатура", "скорость", "точность", "буква", "пауза", "практика", "сигнал", "цифры", "строка", "внимание", "ритм", "память", "окно", "письмо", "тишина", "сад"],
    stems: ["клав", "скор", "точ", "букв", "практ", "сигна", "цифр", "строк", "внима", "памя", "тиш", "сад", "пись"],
    prefixes: ["пере", "под", "над", "микро", "меж"],
    suffixes: ["ный", "ность", "ение", "атель", "ка"],
    pseudoSyllables: ["та", "ро", "ми", "сен", "ла", "ко", "ви", "пре", "на", "до"],
  },
  greek: {
    id: "greek",
    label: "Greek",
    nativeLabel: "Ελληνικά",
    direction: "ltr",
    letters: "αβγδεζηθικλμνξοπρστυφχψω",
    uppercaseLetters: "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Η ήρεμη εξάσκηση κρατά τον ρυθμό καθαρό.",
    seedWords: ["πληκτρολόγιο", "ρυθμός", "γέφυρα", "καθαρό", "παράθυρο", "σήμα", "τέμπο", "γράμμα", "αριθμός", "σταθερό", "λεπτομέρεια", "ροή"],
    stems: ["πληκτρ", "ρυθμ", "γεφυρ", "καθαρ", "παράθυρ", "σήμα", "τέμπο", "γράμμ", "αριθμ", "σταθερ"],
    prefixes: ["προ", "υπερ", "αντι", "μικρο", "μετα"],
    suffixes: ["ση", "μα", "της", "ικο", "τητα"],
    pseudoSyllables: ["πλη", "ρυθ", "γε", "κα", "πα", "ση", "τε", "γρα", "α", "στα"],
  },
  japanese: {
    id: "japanese",
    label: "Japanese",
    nativeLabel: "日本語",
    direction: "ltr",
    letters: "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
    punctuation: ["。", "、", "・", "「", "」", "！", "？", "(", ")", "-", "_", "/"],
    quotes: ["「", "」", `"`, `'`],
    sampleSentence: "ていねいなれんしゅうがりずむをつくる。",
    seedWords: ["かな", "れんしゅう", "そくど", "せいかく", "きーぼーど", "もじ", "すうじ", "りずむ", "しせい", "てんぽ", "しぐなる", "ながれ"],
    stems: ["かな", "れん", "そく", "せい", "もじ", "すう", "りず", "てん", "なが", "しぐ"],
    prefixes: ["さい", "しん", "こう", "まい", "ふく"],
    suffixes: ["する", "てき", "たい", "かん", "りょく"],
    pseudoSyllables: ["か", "な", "り", "ず", "て", "ん", "も", "じ", "そ", "く"],
  },
  hebrew: {
    id: "hebrew",
    label: "Hebrew",
    nativeLabel: "עברית",
    direction: "rtl",
    letters: "אבגדהוזחטיכלמנסעפצקרשתםןףץ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "«", "»"],
    quotes: ["«", "»", `"`, `'`],
    sampleSentence: "אימון רגוע שומר על קצב נקי.",
    seedWords: ["מקלדת", "קצב", "גשר", "דיוק", "חלון", "אות", "מספר", "יציב", "תרגול", "זרימה", "שקט", "פרט"],
    stems: ["מקלד", "קצב", "גשר", "דיוק", "חלונ", "אות", "מספר", "יציב", "תרגול", "זרימ"],
    prefixes: ["מ", "ה", "תת", "על", "קו"],
    suffixes: ["ית", "ון", "ים", "ה", "ות"],
    pseudoSyllables: ["קה", "רה", "שי", "תו", "לה", "נו", "די", "קו", "בי", "מה"],
  },
  arabic: {
    id: "arabic",
    label: "Arabic",
    nativeLabel: "العربية",
    direction: "rtl",
    letters: "ابتثجحخدذرزسشصضطظعغفقكلمنهوية",
    punctuation: ["،", "؛", "؟", ".", ":", "(", ")", "«", "»", "-", "_", "/"],
    quotes: ["«", "»", `"`, `'`],
    sampleSentence: "الدقة الهادئة تصنع سرعة ثابتة.",
    seedWords: ["لوحة", "مفاتيح", "سرعة", "دقة", "تدريب", "حروف", "أرقام", "نص", "إيقاع", "واجهة", "تحسن", "ثبات"],
    stems: ["لوح", "سرع", "دق", "تدر", "حرف", "رقم", "إيق", "واجه", "تحس", "ثب"],
    prefixes: ["ال", "مت", "فوق", "دون", "صغ"],
    suffixes: ["ة", "ات", "ون", "ي", "ية"],
    pseudoSyllables: ["لا", "نا", "تي", "رو", "فا", "مي", "سا", "كو", "بي", "دا"],
  },
  persian: {
    id: "persian",
    label: "Persian",
    nativeLabel: "فارسی",
    direction: "rtl",
    letters: "اآبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی",
    punctuation: ["،", "؛", "؟", ".", ":", "(", ")", "«", "»", "-", "_", "/"],
    quotes: ["«", "»", `"`, `'`],
    sampleSentence: "متن آرام، ریتم روشن را نگه می‌دارد.",
    seedWords: [
      "صفحه",
      "کلید",
      "سرعت",
      "دقت",
      "تمرین",
      "حروف",
      "اعداد",
      "آرام",
      "پیشرفت",
      "متن",
      "ریتم",
      "نشانه",
      "پنجره",
      "کوچه",
      "باران",
      "چراغ",
      "دفتر",
      "نامه",
      "باغچه",
      "حیاط",
    ],
    stems: ["صفح", "کلید", "سرع", "دق", "تمر", "حرو", "اعدا", "آرا", "پیش", "نشا", "پنجر", "بارا", "باغچ", "دفتر"],
    prefixes: ["هم", "نا", "فرا", "ریز", "ابر", "باز", "پیش"],
    suffixes: ["ی", "ها", "تر", "انه", "مند", "وار", "خوانی"],
    pseudoSyllables: ["با", "را", "نی", "در", "سا", "رو", "مه", "کا", "نو", "تی"],
  },
  lithuanian: {
    id: "lithuanian",
    label: "Lithuanian",
    nativeLabel: "Lietuvių",
    direction: "ltr",
    letters: "aąbcčdeęėfghiįyjklmnoprsštuųūvzž",
    uppercaseLetters: "AĄBCČDEĘĖFGHIĮYJKLMNOPRSŠTUŲŪVZŽ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Rami praktika išlaiko ritmą švarų.",
    seedWords: ["klaviatūra", "ritmas", "tiltas", "tikslumas", "langas", "signalas", "tempas", "raidė", "skaičius", "stabilus", "detalė", "srautas"],
    stems: ["klavia", "ritm", "tiksl", "lang", "signa", "temp", "raid", "skai", "stabil", "detal"],
    prefixes: ["per", "po", "virš", "mikro", "tarp"],
    suffixes: ["umas", "imas", "inis", "yto", "a"],
    pseudoSyllables: ["kla", "ri", "tik", "lan", "sig", "tem", "rai", "skai", "sta", "de"],
  },
  latvian: {
    id: "latvian",
    label: "Latvian",
    nativeLabel: "Latviešu",
    direction: "ltr",
    letters: "aābcčdeēfgģhiījkķlļmnņoprsštuūvzž",
    uppercaseLetters: "AĀBCČDEĒFGĢHIĪJKĶLĻMNŅOPRSŠTUŪVZŽ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "[", "]", "{", "}"],
    quotes: [`"`, `'`],
    sampleSentence: "Mierīgs treniņš uztur ritmu tīru.",
    seedWords: ["tastatūra", "ritms", "tilts", "precizitāte", "logs", "signāls", "temps", "burts", "skaitlis", "stabils", "detaļa", "plūsma"],
    stems: ["tasta", "ritm", "preciz", "logs", "signā", "temp", "burt", "skait", "stabil", "deta"],
    prefixes: ["pār", "zem", "virs", "mikro", "starp"],
    suffixes: ["ība", "ums", "īgs", "ēt", "ais"],
    pseudoSyllables: ["tas", "rit", "pre", "log", "sig", "tem", "bur", "skai", "sta", "de"],
  },
  hindi: {
    id: "hindi",
    label: "Hindi",
    nativeLabel: "हिन्दी",
    direction: "ltr",
    letters: "अआइईउऊएऐओऔकखगघचछजझटठडढतथदधनपफबभमयरलवशषसहक्षज्ञ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "“", "”"],
    quotes: ["“", "”", `"`, `'`],
    sampleSentence: "शांत अभ्यास गति और शुद्धता बनाता है।",
    seedWords: ["कुंजी", "गति", "सटीक", "अभ्यास", "अक्षर", "संख्या", "लय", "खिड़की", "संकेत", "प्रवाह", "साफ", "धैर्य"],
    stems: ["कुंज", "गत", "सटीक", "अभ्या", "अक्ष", "संख्य", "लय", "संके", "प्रवा", "धैर"],
    prefixes: ["अति", "पुन", "उप", "माइक्रो", "सह"],
    suffixes: ["ता", "ना", "िक", "ीय", "पन"],
    pseudoSyllables: ["कु", "ला", "ति", "रा", "सि", "धा", "प्र", "वा", "सं", "के"],
  },
  thai: {
    id: "thai",
    label: "Thai",
    nativeLabel: "ไทย",
    direction: "ltr",
    letters: "กขคงจฉชซญดตถทธนบบปผพภมยรลวศษสหออะาิีึืุูเแโใไ",
    punctuation: [".", ",", ";", ":", "!", "?", "-", "_", "/", "(", ")", "“", "”"],
    quotes: ["“", "”", `"`, `'`],
    sampleSentence: "การฝึกอย่างนิ่งช่วยให้จังหวะสะอาด",
    seedWords: ["แป้นพิมพ์", "จังหวะ", "ความเร็ว", "ความแม่น", "ตัวอักษร", "ตัวเลข", "หน้าต่าง", "สัญญาณ", "จังหวะดี", "เสถียร", "รายละเอียด", "การไหล"],
    stems: ["แป้น", "จัง", "เร็ว", "แม่น", "อักษร", "เลข", "หน้า", "สัญญา", "เสถีย", "ละเอียด"],
    prefixes: ["การ", "ความ", "เหนือ", "ใต้", "ไมโคร"],
    suffixes: ["ภาพ", "การ", "ดี", "มาก", "ใจ"],
    pseudoSyllables: ["กา", "ระ", "จัง", "หวะ", "แม่น", "ยา", "หน้า", "เลข", "ละ", "เอี"],
  },
} as const satisfies Record<string, LanguageBlueprint>;

export const languageLexiconLayers =
  {} as Record<keyof typeof languageBlueprints, LayeredLanguageLexicon>;
export const languageWordBanks = {} as Record<keyof typeof languageBlueprints, string[]>;
export const languageSyntheticWordBanks = {} as Record<keyof typeof languageBlueprints, string[]>;

for (const languageId of Object.keys(languageBlueprints) as Array<keyof typeof languageBlueprints>) {
  const languageBlueprint = languageBlueprints[languageId];
  const layeredLexicon = buildLayeredLexicon(languageId, languageBlueprint);
  const expandedWordBank = expandWordBank(languageBlueprint, layeredLexicon.realWordBank);

  languageLexiconLayers[languageId] = layeredLexicon;
  languageWordBanks[languageId] = expandedWordBank;
  languageSyntheticWordBanks[languageId] = layeredLexicon.syntheticWordBank;
}

export const languageDigits = Object.fromEntries(
  Object.keys(languageBlueprints).map((languageId) => [languageId, [...universalDigits]]),
) as Record<keyof typeof languageBlueprints, string[]>;

export const practicalLanguageCoverage = Object.keys(languageBlueprints).length;
