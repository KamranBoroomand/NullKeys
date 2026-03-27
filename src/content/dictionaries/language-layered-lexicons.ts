export interface SupplementalLanguageLexicon {
  foundationalWords?: readonly string[];
  developingWords?: readonly string[];
  advancedWords?: readonly string[];
  realWords?: readonly string[];
  phraseFragments?: readonly string[];
  benchmarkSentences?: readonly string[];
  sourceOrigins?: {
    commonWords?: readonly string[];
    phraseDrills?: readonly string[];
    quoteDrills?: readonly string[];
  };
}

function words(input: string) {
  return input
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function lines(input: string) {
  return input
    .trim()
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniqueTexts(values: readonly string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function capitalizeFirstCharacter(value: string) {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

function extractFragmentAnchor(value: string) {
  return value.split(/\s+/u).slice(0, 2).join(" ");
}

function buildClauseSet(subjects: readonly string[], predicates: readonly string[]) {
  const clauses: string[] = [];

  for (const subject of subjects) {
    for (const predicate of predicates) {
      clauses.push(`${subject} ${predicate}`);
    }
  }

  return uniqueTexts(clauses);
}

function buildSentencePairs(options: {
  fragments: readonly string[];
  tails: readonly string[];
  templates: ReadonlyArray<(lead: string, follow: string, tail: string) => string>;
  count: number;
}) {
  const sentences: string[] = [];

  for (let index = 0; index < options.count; index += 1) {
    const lead = options.fragments[(index * 5) % options.fragments.length] ?? "";
    let follow =
      options.fragments[(index * 11 + 3) % options.fragments.length] ??
      options.fragments[(index + 1) % options.fragments.length] ??
      "";
    const tail = options.tails[index % options.tails.length] ?? "";
    const template = options.templates[index % options.templates.length];

    if (extractFragmentAnchor(lead) === extractFragmentAnchor(follow)) {
      for (let offset = 1; offset < options.fragments.length; offset += 1) {
        const candidate =
          options.fragments[(index * 11 + 3 + offset) % options.fragments.length] ??
          options.fragments[(index + offset + 1) % options.fragments.length];

        if (candidate && extractFragmentAnchor(lead) !== extractFragmentAnchor(candidate)) {
          follow = candidate;
          break;
        }
      }
    }

    if (!lead || !follow || !tail || !template || lead === follow) {
      continue;
    }

    sentences.push(template(lead, follow, tail));
  }

  return uniqueTexts(sentences);
}

const russianPhraseFragments = uniqueTexts([
  ...buildClauseSet(
    lines(`
      ровный ритм
      короткая пауза
      чистая строка
      спокойный темп
      новая фраза
      точный переход
      узкий набор
      знакомое слово
      длинный абзац
      тихий повтор
      следующая строка
      сильная опора
      мягкий разворот
      ясный ориентир
      спокойный обзор
      живой текст
      рабочая связка
      свободный взгляд
      чистая пунктуация
      тихая уверенность
      длинная мысль
      новая опора
      плавный абзац
      точная связка
    `),
    lines(`
      держит внимание
      возвращает точность
      снижает спешку
      смягчает нагрузку
      показывает слабый переход
      делает урок чище
      собирает взгляд
      расширяет словарь
      не дает ритму распасться
      помогает держать линию
      рано показывает ошибку
      делает чтение спокойнее
      поддерживает ровное дыхание
      сохраняет рабочий темп
      помогает держать строку собранной
      делает переходы естественнее
      расширяет рабочий запас
      тренирует длинные связки
      не прячет слабое место
      оставляет текст живым
      помогает читать знаки заранее
      делает повтор полезнее
    `),
  ),
  ...lines(`
    сложный знак не ломает строку
    короткий обзор заранее снимает спешку
    живой абзац звучит как речь
    мягкий возврат быстро чинит ошибку
    узкая раскладка все же держит ход
    знакомый поворот приходит вовремя
    тихий повтор не сушит урок
    взгляд заранее ловит поворот
    сильная опора не дает ритму осыпаться
    длинная строка остается чистой
    новая связка входит без паники
    короткий фрагмент держит темп
    плотный проход все еще читается
    ошибка видна раньше финала
    спокойное чтение собирает руки
    настоящая фраза не звучит механически
    точная пунктуация заранее собирает дыхание
    новый абзац не рушит ровную подачу
    свободный взгляд раньше замечает связку
    длинная мысль остается чистой на повороте
    рабочая связка возвращается без суеты
    живая фраза держит слух и руки вместе
    тихая уверенность не дает спешке править строкой
    плавный абзац не превращается в сухой список
  `),
]);

const russianBenchmarkSentences = uniqueTexts([
  ...lines(`
    Ровный ритм держит внимание, а короткая пауза возвращает точность, поэтому длинный проход остается читаемым.
    Когда знакомое слово приходит внутри новой фразы, руки не цепляются за память и все же держат честный рабочий темп.
    Хороший отрывок не сводится к безопасному словарю: он мягко расширяет запас, но не ломает дыхание на каждом повороте.
    Если узкий набор букв начинает давить на темп, спокойный обзор раньше показывает слабое место и не дает строке развалиться.
    Живой текст полезнее сухого списка, потому что взгляд учится видеть связки, паузы и знаки прямо внутри настоящей речи.
    Точный переход ценен не сам по себе, а потому, что он возвращается в разных словах и делает повтор содержательным.
    Длинный абзац звучит лучше, когда тихий повтор не сушит урок, а короткий обзор заранее снимает лишнюю спешку.
    Даже сложный знак меньше пугает, если перед ним идет чистая строка и после него остается ясная линия движения.
    Плотный проход не должен сваливаться в петлю из одних и тех же слов, иначе пальцы бегут по памяти быстрее, чем глаза читают текст.
    Настоящий контрольный текст полезен тогда, когда он оставляет достаточно вариации, чтобы скорость выглядела заслуженной, а не заученной.
    Разве строка не читается спокойнее, когда ясный ориентир собирает взгляд, а мягкий разворот не срывает рабочий темп?
    Следующая строка должна открываться чуть раньше, иначе глаза догоняют пальцы уже после того, как ошибка попала в ритм.
    Хорошая практика сначала снимает лишнее напряжение, потом расширяет словарь и только после этого просит о большей скорости.
    Когда тихий повтор встречается внутри живого текста, ученик видит пользу обзора и меньше боится длинного абзаца.
    Чистая пунктуация полезна не только сама по себе: она заранее учит взгляд видеть границы фразы и не терять ход внутри длинной строки.
    Если рабочая связка появляется в новом окружении, ученик тренирует не память о фрагменте, а настоящую гибкость чтения и набора.
    Свободный взгляд важен тем, что он замечает знак заранее и дает рукам сохранить ровное усилие на трудном переходе.
    Хороший русский отрывок не должен звучать искусственно, даже когда он мягко подталкивает к более длинным словам и плотным связкам.
    Чем богаче словарь внутри урока, тем меньше безопасные слова доминируют над ритмом и тем честнее выглядит достигнутая скорость.
    Плотный проход остается полезным только тогда, когда в нем хватает разных поворотов, пауз и опор, а не просто шума вокруг знаков.
    Настоящая фраза помогает держать темп лучше сухих обрывков, потому что она дает глазам смысловую линию и предсказуемую пунктуацию.
    Когда новая опора приходит рядом со знакомым словом, набор становится смелее, но урок все равно не теряет спокойную подачу.
  `),
  ...buildSentencePairs({
    fragments: russianPhraseFragments,
    tails: lines(`
      длинный проход остается читаемым
      ученик раньше замечает слабое место
      повтор не превращается в скучную петлю
      пальцы не срывают темп на легких словах
      взгляд спокойно готовится к следующему повороту
      урок звучит как настоящая речь
      широкий абзац не теряет ясную линию
      ошибка видна еще до конца строки
      скорость выглядит честной, а не заученной
    `),
    templates: [
      (lead, follow, tail) =>
        `${capitalizeFirstCharacter(lead)}, а ${follow}, поэтому ${tail}.`,
      (lead, follow, tail) => `Когда ${lead}, ${follow}, и ${tail}.`,
      (lead, follow, tail) =>
        `${capitalizeFirstCharacter(lead)}, затем ${follow}, так что ${tail}.`,
      (lead, follow, tail) => `Если ${lead}, ${follow}, то ${tail}.`,
    ],
    count: 144,
  }),
]);

const persianPhraseFragments = uniqueTexts([
  ...buildClauseSet(
    lines(`
      ریتم آرام
      مکث کوتاه
      جمله روشن
      واژه آشنا
      تمرین روزانه
      عبارت تازه
      بازبینی سریع
      مسیر چشم
      درس کوتاه
      پاراگراف ساده
      گروه هم‌خانواده
      ترکیب سخت
      حافظه حرکتی
      مرحله بعدی
      نقطه ضعف
      متن زنده
      نشانه روشن
      پیوند تازه
      تکرار سنجیده
      گذر آرام
      واژه دقیق
      جمله بلند
      مرور منظم
      نشانه‌گذاری درست
    `),
    lines(`
      دقت را نگه می‌دارد
      فشار را کم می‌کند
      سرعت را نرم‌تر می‌کند
      ذهن را آماده می‌کند
      خطا را زود نشان می‌دهد
      راه برگشت را کوتاه می‌کند
      حرکت دست را روان می‌کند
      دامنه دید را باز می‌کند
      تمرین را خواناتر می‌کند
      تکرار خشک را کنار می‌زند
      پیوندها را واضح‌تر می‌کند
      عبارت بعدی را ساده‌تر می‌کند
      تعادل را نگه می‌دارد
      آهنگ درس را منظم می‌کند
      متن را یکدست نگه می‌دارد
      گذرها را طبیعی‌تر می‌کند
      دامنه واژه‌ها را بازتر می‌کند
      سطر را جمع‌وجور نگه می‌دارد
      فشار اضافه را پنهان نمی‌کند
      تمرین را زنده نگه می‌دارد
      نشانه‌ها را زودتر دیده‌پذیر می‌کند
      بازگشت بعدی را ساده‌تر می‌کند
    `),
  ),
  ...lines(`
    نیم‌فاصله متن را طبیعی‌تر می‌کند
    پرسش روشن با نشانه درست می‌آید
    مرور پله‌پله فشار را پخش می‌کند
    واژه هم‌ریشه سریع‌تر برمی‌گردد
    مکث به‌موقع ریتم را نمی‌شکند
    جمله کوتاه هنوز زنده می‌ماند
    نگاه آرام پایان سطر را روشن می‌کند
    بازگشت نرم خطا را کم می‌کند
    فاصله درست دور واژه‌ها می‌ماند
    دست خسته دوباره راه را پیدا می‌کند
    کلید سخت در متن واقعی جا می‌افتد
    عبارت پیوسته آهنگ درس را نگه می‌دارد
    واژه تازه کنار واژه آشنا می‌نشیند
    متن بلند با ریتم خوب آرام می‌ماند
    سطر تازه ذهن را دوباره مرتب می‌کند
    مرور کوتاه مسیر نگاه را باز می‌کند
    نشانه‌گذاری درست خواندن را کند نمی‌کند
    جمله بلند هنوز روشن و آرام می‌ماند
    تکرار سنجیده درس را خشک و بی‌جان نمی‌کند
    پیوند تازه واژه بعدی را قابل پیش‌بینی‌تر می‌کند
    واژه دقیق فشار بیهوده را از دست می‌گیرد
    گذر آرام چشم را برای نشانه بعدی آماده می‌کند
    مرور منظم جلوی بازگشت عجله را می‌گیرد
    متن طبیعی اجازه نمی‌دهد تمرین شبیه فهرست شود
  `),
]);

const persianBenchmarkSentences = uniqueTexts([
  ...lines(`
    ریتم آرام دقت را نگه می‌دارد و مکث کوتاه فشار را کم می‌کند، پس متن بلند هم خوانا می‌ماند.
    وقتی واژه آشنا زود برمی‌گردد، چشم برای عبارت تازه آماده می‌شود و دست راه درست را گم نمی‌کند.
    تمرین خوب فقط واژه‌های امن را تکرار نمی‌کند؛ جمله روشن می‌سازد تا گذرهای سخت هم طبیعی دیده شوند.
    اگر نیم‌فاصله سر جای خودش بماند، واژه مرکب طبیعی‌تر خوانده می‌شود و مکث اضافی به ریتم درس فشار نمی‌آورد.
    پاراگراف ساده به شاگرد نشان می‌دهد که بازبینی سریع از شتاب کور بهتر است، چون خطا را زودتر روشن می‌کند.
    کلید دشوار وقتی در متن زنده برمی‌گردد، کمتر ترسناک به نظر می‌رسد و دست راحت‌تر تعادل خود را پیدا می‌کند.
    عبارت تازه باید واقعی بماند، وگرنه تمرین شبیه فهرست خشک می‌شود و چشم خیلی زود از مسیر جمله جا می‌ماند.
    مرور کوتاه پیش از عبور بعدی کمک می‌کند که حافظه حرکتی فرو نریزد و جمله بلند هنوز آرام و دقیق بماند.
    وقتی گروه هم‌خانواده کنار هم می‌آید، مغز الگو را زودتر می‌بیند و واژه بعدی با فشار کمتر نوشته می‌شود.
    متن معیار خوب نه بیش از حد آشنا است و نه بی‌دلیل عجیب؛ فقط آن‌قدر تنوع دارد که سرعت واقعی را صادقانه نشان دهد.
    آیا جمله روشن هنوز خوانا می‌ماند وقتی ترکیب سخت چند بار پشت سر هم برمی‌گردد و چشم باید زودتر جهت خود را عوض کند؟
    پرسش کوتاه با نشانه درست می‌آید، زیرا خواننده باید هم واژه را ببیند و هم فاصله و آهنگ جمله را حفظ کند.
    وقتی بازگشت نرم از خطا ممکن باشد، شاگرد کمتر در دور بسته می‌افتد و دوباره به جریان طبیعی متن می‌رسد.
    درس خوب اول فشار را کم می‌کند، بعد دامنه دید را باز می‌کند، و در پایان سرعت را بدون آشفتگی بالا می‌برد.
    نشانه‌گذاری درست فقط ظاهر متن را بهتر نمی‌کند؛ به چشم کمک می‌کند مرز جمله را زودتر ببیند و ریتم را بیهوده نشکند.
    وقتی پیوند تازه کنار واژه آشنا می‌آید، شاگرد تنوع واقعی را تمرین می‌کند و هنوز حس نمی‌کند که متن از هم گسیخته شده است.
    متن خوب فارسی باید طبیعی بماند، حتی وقتی واژگان را گسترده‌تر می‌کند و از شاگرد می‌خواهد که گذرهای سخت‌تری را آرام‌تر بخواند.
    اگر مرور منظم در میانه درس برگردد، فشار روی کلیدهای ضعیف پخش می‌شود و جمله بلند همچنان روان و قابل‌دنبال‌کردن می‌ماند.
    سرعت زمانی صادقانه‌تر دیده می‌شود که متن فقط از واژه‌های امن ساخته نشده باشد و هر سطر کمی تنوع تازه به همراه بیاورد.
    عبارت طبیعی از فهرست خشک بهتر است، چون چشم در آن هم معنا را می‌بیند و هم فاصله، نشانه، و جای نفس را زودتر پیدا می‌کند.
    واژه دقیق و جمله روشن کنار هم به شاگرد یاد می‌دهند که سختی خوب باید خوانا بماند، نه اینکه فقط شلوغ‌تر به نظر برسد.
    وقتی گذر آرام با نشانه درست همراه می‌شود، دست فرصت دارد تعادل خود را حفظ کند و متن هنوز حالتی سرد و ماشینی پیدا نمی‌کند.
  `),
  ...buildSentencePairs({
    fragments: persianPhraseFragments,
    tails: lines(`
      متن بلند هم خوانا می‌ماند
      چشم زودتر به واژه بعدی می‌رسد
      تمرین به دور بسته تبدیل نمی‌شود
      دست در میانه سطر از ریتم جدا نمی‌شود
      عبارت تازه طبیعی و واقعی می‌ماند
      فشار اضافه روی کلیدهای ضعیف کم می‌شود
      گذرهای سخت نرم‌تر دیده می‌شوند
      بازگشت به واژه آشنا سریع‌تر انجام می‌شود
      سرعت واقعی‌تر و صادقانه‌تر دیده می‌شود
    `),
    templates: [
      (lead, follow, tail) => `${lead} و ${follow}، بنابراین ${tail}.`,
      (lead, follow, tail) => `وقتی ${lead}، ${follow} و ${tail}.`,
      (lead, follow, tail) => `اگر ${lead}، ${follow}، ${tail}.`,
      (lead, follow, tail) => `${lead}، بعد ${follow} و ${tail}.`,
    ],
    count: 144,
  }),
]);

const persianCalmPhraseFragments = uniqueTexts([
  ...lines(`
    صبح آرام از راه می‌رسد
    نور نرم روی دیوار می‌ماند
    باد کم از حیاط می‌گذرد
    خانه هنوز ساکت و روشن است
    راه باریک تا در می‌رود
    صدای دور آرام می‌آید
    پنجره باز هوای تازه می‌دهد
    برگ نازک روی میز می‌ماند
    آب روشن در جوی می‌رود
    آسمان صاف بالای بام می‌ماند
    کوچه روشن تا خانه می‌رسد
    چراغ کوچک کنار راه مانده است
    بوی باران در حیاط می‌پیچد
    صبح روشن روی دیوار می‌نشیند
    سایه روشن کنار پنجره مانده است
    نسیم نرم از باغ می‌آید
    آفتاب کم بر سنگ می‌تابد
    موج نرم کنار ساحل می‌ماند
    راه ساده و روشن پیش می‌رود
    هوای خنک از باغچه می‌آید
    سنگ روشن کنار آب مانده است
    شاخه نازک روی دیوار افتاده است
    حیاط خلوت در نور صبح مانده است
    سکوت نرم تا پایان راه می‌رود
  `),
]);

const persianCalmBenchmarkSentences = uniqueTexts([
  ...lines(`
    صبح آرام از پنجره می‌آید و خانه هنوز ساکت است، برای همین هر چیز با نظمی نرم و روشن پیش می‌رود.
    باد کم از حیاط می‌گذرد و برگ نازک روی سنگ می‌ماند، انگار هیچ چیز عجله‌ای برای رفتن ندارد.
    راه باریک تا در خانه می‌رود و نور نرم روی دیوار می‌نشیند، پس صحنه ساده اما زنده باقی می‌ماند.
    صدای دور از کوچه می‌آید و بعد دوباره سکوت برمی‌گردد، چنان‌که فضا آرام و یکدست دیده می‌شود.
    آب روشن در جوی باریک می‌رود و سایه بام روی آن می‌افتد، اما مسیر هنوز روشن و آرام می‌ماند.
    نسیم نرم از باغ می‌آید و بوی باران در هوا می‌پیچد، برای همین صبح شکل ساده و دلپذیر خود را نگه می‌دارد.
    چراغ کوچک کنار راه مانده است و خانه در نور کم صبح دیده می‌شود، بی‌آنکه چیزی در صحنه تند یا ناآرام شود.
    کوچه روشن تا در خانه می‌رسد و آسمان صاف بالای بام می‌ماند، پس نگاه بی‌فشار از یک سو به سوی دیگر می‌رود.
    شاخه نازک روی دیوار افتاده است و باد فقط اندکی آن را جابه‌جا می‌کند، انگار زمان آهسته‌تر از همیشه می‌گذرد.
    حیاط خلوت در نور صبح مانده است و صدای دور هم سکوت آن را بر هم نمی‌زند، چون همه چیز در جای خود آرام گرفته است.
    سنگ روشن کنار آب مانده است و موج نرم آهسته از کنارش می‌گذرد، برای همین تصویر ساده اما زنده دیده می‌شود.
    صبح روشن روی دیوار می‌نشیند و پنجره باز هوای تازه می‌دهد، پس خانه هنوز سبک و آرام نفس می‌کشد.
    راه ساده و روشن پیش می‌رود و هیچ پیچ تندی در آن نیست، برای همین نگاه بی‌شتاب تا پایان مسیر همراه آن می‌ماند.
    بوی خاک باران‌خورده در هوا می‌پیچد و سایه روشن روی دیوار می‌لغزد، اما فضای صحنه همچنان آرام و پیوسته باقی می‌ماند.
  `),
]);

const japanesePhraseFragments = uniqueTexts([
  ...lines(`
    ていねいな ・ れんしゅう ・ が ・ りずむ ・ を ・ つくる
    みじかい ・ ぶん ・ が ・ よみ ・ やすさ ・ を ・ たもつ
    しずかな ・ くりかえし ・ が ・ てんぽ ・ を ・ ととのえる
    あたらしい ・ ことば ・ が ・ きおく ・ に ・ のこる
    ことば ・ の ・ ながれ ・ が ・ め ・ を ・ ささえる
    やわらかな ・ きりかえ ・ が ・ あわて ・ を ・ へらす
    しぜんな ・ ぶんしょう ・ が ・ て ・ を ・ みちびく
    みなおし ・ の ・ じかん ・ が ・ あやまり ・ を ・ みつける
    れんしゅう ・ の ・ おと ・ が ・ しせい ・ を ・ まもる
    ゆるやかな ・ すすみ ・ が ・ よゆう ・ を ・ のこす
    てもと ・ の ・ かんかく ・ が ・ つぎ ・ を ・ しらせる
    あんていした ・ よみ ・ が ・ もじ ・ を ・ つなげる
  `),
]);

const japaneseBenchmarkSentences = uniqueTexts([
  ...lines(`
    ていねいな ・ れんしゅう ・ は 、 もじ ・ の ・ ながれ ・ を ・ ととのえ 、 よみ ・ の ・ りずむ ・ を ・ やさしく ・ まもる 。
    みじかい ・ ぶん ・ が ・ あんていして ・ よめる と 、 あたらしい ・ ことば ・ も ・ あわてず ・ に ・ うてる 。
    しずかな ・ くりかえし ・ は 、 はやさ ・ だけ ・ を ・ おわず 、 せいかくさ ・ を ・ きちんと ・ のこす 。
    しぜんな ・ ぶんしょう ・ を ・ つかう と 、 め ・ は ・ つぎ ・ の ・ ことば ・ を ・ はやめ ・ に ・ みつけられる 。
    みなおし ・ の ・ じかん ・ が ・ ある と 、 まちがい ・ は ・ おそくなる ・ まえ ・ に ・ みえてくる 。
    やわらかな ・ きりかえ ・ が ・ できる と 、 れんしゅう ・ は ・ きゅう に ・ かたく ・ ならない 。
    あたらしい ・ ことば ・ も 、 よく ・ しった ・ ながれ ・ の ・ なか ・ に ・ ある と 、 おちついて ・ うてる 。
    よみ ・ やすい ・ ぶん ・ は 、 ゆび ・ だけ ・ でなく 、 め ・ と ・ こころ ・ の ・ てんぽ ・ も ・ ととのえる 。
    てもと ・ の ・ かんかく ・ が ・ しずか ・ に ・ つづく と 、 つぎ ・ の ・ いどう ・ も ・ しぜん ・ に ・ つながる 。
    ぶんしょう ・ が ・ やさしく ・ つながる と 、 れんしゅう ・ は ・ きかい ・ みたい ・ に ・ きこえない 。
    はやさ ・ は 、 むり ・ に ・ あげる ・ もの ・ ではなく 、 よみ ・ の ・ あんてい ・ から ・ しぜん ・ に ・ のびていく 。
    よい ・ れんしゅう ・ は 、 あたらしい ・ もじ ・ を ・ いれても 、 ことば ・ の ・ いみ ・ を ・ なくさない 。
  `),
]);

const englishPhraseFragments = uniqueTexts([
  ...lines(`
    steady hands and clearer timing
    read the next phrase before the jump
    clean motion keeps the lesson readable
    short review first, broader flow next
    let the weak keys settle into rhythm
    smooth spacing before faster passages
    easy words can still teach precision
    longer words arrive after control returns
    practice the turn, then hold the line
    quiet accuracy supports lasting speed
    steady hands and clear timing
    review the weak keys calmly
    clean motion before raw speed
    short recovery words, then longer flow
    smooth rhythm with careful spacing
    focused review around the next unlock
    natural words with lighter repetition
    small pauses, then stronger control
    clear punctuation and readable clauses
    measured practice with broader vocabulary
    teacher-like passages widen the word bank
    review the shaky turn inside calm language
    short clauses can still carry real difficulty
    broader phrases reveal timing gaps sooner
    let punctuation sharpen the reading rhythm
    natural variety keeps memory from cheating
    recover the weak link without flattening the sentence
    clear transitions matter more than raw length
    trusted words should lead into newer shapes
    steadier phrasing makes harder text feel teachable
    guide the eyes, then ask for speed
    recovery first, range second, pressure last
  `),
  ...buildClauseSet(
    lines(`
      calm review
      readable sentence
      familiar pattern
      cleaner clause
      broader phrase
      longer paragraph
      gentle difficulty shift
      trusted benchmark
      honest benchmark
      quiet recovery
      stable rhythm
      guided preview
      stronger transition
      varied wording
      patient progression
      useful punctuation
      clearer pacing
      fresh contrast
      deliberate review
      wider vocabulary
    `),
    lines(`
      keeps the lesson grounded
      opens the next turn early
      makes weak joins easier to see
      widens the word bank without noise
      keeps repetition from taking over
      gives punctuation a clear job
      lets the eyes stay ahead
      steadies the move into longer words
      turns review into forward motion
      keeps harder text teachable
      reveals the next weak link
      preserves a calm reading line
    `),
  ),
  ...lines(`
    early passages should sound edited, not assembled
    shorter reviews can still feel rich on the fingers
    a natural clause makes the next error easier to notice
    confident pacing keeps the learner from rushing the easy words
    wider vocabulary should arrive before the lesson gets louder
    the next unlock should feel invited, not forced
    readable practice hides the machinery behind the language
    calm wording can still challenge weak transitions honestly
    stronger sentences make benchmark speed look earned
    review stays useful when the phrase still sounds like speech
    broader passages teach spacing without turning cold
    punctuation should sharpen the rhythm, not steal attention
    steady wording gives the eyes room to stay ahead
    the sentence should turn naturally before it turns hard
    premium English practice stays calm while the vocabulary widens
    deliberate phrasing keeps repetition from becoming a crutch
    warm light rests across the page
    soft rain taps against the window
    a folded note waits beside the cup
    morning air moves through the open door
    the narrow street stays quiet at dusk
    the garden path bends toward the gate
    a calm room keeps the next line clear
    the paper stays flat beneath the hand
  `),
]);

const englishBenchmarkSentences = uniqueTexts([
  ...lines(`
    A careful run grows steadier when each phrase feels readable instead of stitched together from the same tiny loop.
    Strong benchmark text gives the hands natural variation, then asks for patience when a longer word changes the rhythm.
    As the learner improves, the passage should widen its vocabulary, vary its turns, and still remain calm on the fingers.
    Recovery drills work best when familiar words return inside larger phrases, so review feels purposeful rather than stale.
    Typing practice becomes more honest when the text resists memory and still sounds like language instead of shuffled scraps.
    Sentence flow matters because the hands learn transitions, pauses, and punctuation better inside connected ideas than inside lists.
    A richer word bank gives early lessons room to breathe, which makes later speed feel earned and not merely rehearsed.
    The best passages stay teacher-like: they guide attention, reveal weak transitions, and leave enough variety for real learning.
    The line stays clean when the hands move with calm timing and the eyes stay one phrase ahead.
    A strong typing run depends on rhythm, readable transitions, and enough variety to prevent memory from doing all the work.
    When the lesson mixes recovery words with broader vocabulary, the learner can rebuild control without falling into a dull loop.
    Good benchmark text feels natural on the fingers, but it still asks for patience when the sentence turns or the punctuation tightens.
    Longer passages reward posture, attention, and quiet consistency more than bursts of speed that fade after a few easy words.
    The best drills surface weak transitions gently, then return them inside smooth phrases so the practice still feels like real language.
    A richer word bank gives the hands more shapes to learn, which makes later speed feel earned instead of memorized.
    As confidence rises, the passage can widen its vocabulary, vary its pacing, and ask for steadier punctuation control.
    Premium progression does more than lengthen the prompt; it changes word choice, clause shape, and how often the eyes must prepare for a turn.
    Teacher-like English practice should let recovery words return inside broader sentences so support feels intentional instead of protective.
    Harder passages earn their difficulty by widening the vocabulary and sentence texture, not by collapsing into awkward noise or novelty for its own sake.
    A strong mid-stage lesson keeps enough familiar structure to stay readable while quietly asking for more contrast, punctuation control, and lexical range.
    Benchmark text is more honest when it resists memorized safe words and still sounds like an editor wrote it for a learner rather than a search index.
    Natural phrasing matters because the hands learn spacing and punctuation more reliably when the sentence keeps meaning all the way through the harder turn.
    Early stability should open the door to richer wording, but the text still needs enough calm structure that the learner can read one phrase ahead.
    The most useful review passages bring weak transitions back inside clean prose, then let stronger vocabulary prove whether the control really held.
    Clearer English content helps the learner trust the progression, because each new layer feels broader and more deliberate instead of merely longer.
    When the passage sounds human, punctuation becomes part of the rhythm, and the learner can practice difficult joins without losing the thread of the sentence.
    A good advanced passage keeps its editorial balance even while it asks for longer words, denser clauses, and more varied transitions between common patterns.
    The word bank should widen before the lesson grows chaotic, so later speed reflects genuine reading control and not only familiarity with protected fragments.
    A trustworthy English lesson introduces challenge by widening the sentence shape, not by hiding the next move inside stitched fragments.
    The next benchmark should feel inevitable after a strong review cycle, because the wording, pacing, and punctuation all point in the same direction.
    Calm prose gives the learner time to see the next turn coming, which makes accuracy feel active rather than merely cautious.
    Editorially tight text makes progression believable, because the harder lesson sounds richer and more mature instead of merely longer.
    Better practice copy keeps meaning alive while the clause structure grows denser, so reading and typing improve together.
    Shorter sentences still matter late in the path, especially when they reset the rhythm before a longer paragraph asks for more control.
    A premium word bank reduces repetition without showing its machinery, so the learner feels guided rather than managed.
    English passages become more useful when the review thread stays visible inside the prose instead of vanishing behind random variety.
    Warm light falls across the desk, and the open window keeps the room quiet enough for a steady line of text.
    The narrow street is still at dusk, so the learner can read a longer sentence without feeling pushed by the rhythm.
    A folded note waits beside the cup, and the calm scene keeps the next words natural instead of mechanical.
    Morning air moves through the open door, which makes the longer clause feel clear before the hands reach it.
    The garden path curves toward the gate, and the sentence stays readable because each turn arrives without noise.
    Soft rain touches the window while the page stays bright, so the eyes can hold the next phrase without rushing.
    A quiet room with a clear line of text gives the hands a calm route into broader vocabulary and steadier timing.
    The paper lies flat beneath the hand, and that small steadiness makes the longer sentence feel easier to trust.
  `),
  ...buildSentencePairs({
    fragments: englishPhraseFragments,
    tails: lines(`
      the next lesson feels obviously earned
      review keeps sounding like real prose
      the harder turn arrives without a jolt
      the learner can read one phrase ahead
      benchmark speed looks honest instead of memorized
      the sentence stays calm even while it grows richer
      punctuation sharpens the rhythm without stealing attention
      wider vocabulary never collapses into noise
      progression feels deliberate from the very first line
    `),
    templates: [
      (lead, follow, tail) =>
        `${capitalizeFirstCharacter(lead)}, while ${follow}, so ${tail}.`,
      (lead, follow, tail) => `When ${lead}, ${follow}, and ${tail}.`,
      (lead, follow, tail) =>
        `${capitalizeFirstCharacter(lead)}, then ${follow}, which means ${tail}.`,
      (lead, follow, tail) => `If ${lead}, ${follow}, then ${tail}.`,
    ],
    count: 120,
  }),
]);

const russianExpandedPhraseFragments = uniqueTexts([
  ...buildClauseSet(
    lines(`
      спокойная подача
      честный обзор
      знакомый абзац
      новая опора
      плотная связка
      длинная фраза
      живая речь
      точный знак
      широкий словарь
      мягкая сложность
      ясная ступень
      тихая подстройка
      ровное чтение
      сильный ориентир
      полезный возврат
      рабочий контекст
      естественная пауза
      спокойный разгон
      внятный повтор
      короткий разбор
      осмысленный урок
      собранный ритм
    `),
    lines(`
      делает следующий урок очевиднее
      раньше показывает трудный стык
      удерживает текст в живом ритме
      расширяет запас без лишнего шума
      помогает читать знак до удара
      не дает повтору стать костылем
      мягко готовит к длинной строке
      оставляет практику честной
      делает обзор содержательнее
      не ломает дыхание внутри фразы
      возвращает слабый переход в естественную речь
      помогает держать взгляд впереди
      объясняет рост сложности без суеты
      делает пунктуацию заранее заметной
      сохраняет спокойную подачу при новом словаре
      не сводит урок к безопасным словам
    `),
  ),
  ...lines(`
    следующая фраза должна казаться заслуженной, а не случайной
    хороший русский отрывок оставляет смысл впереди рук
    новая трудность полезна только тогда, когда строка все еще звучит живо
    понятный обзор не скрывает слабое место, а показывает его раньше
    сильный абзац помогает держать длинные связки без холодной механики
    выразительный текст учит видеть знак заранее и не пугаться поворота
    честный урок не маскирует повтор богатой пунктуацией
    спокойная фраза легче открывает дорогу к плотному проходу
    чтение становится смелее, когда знакомая опора встречает новый словарь
    мягкий рост сложности лучше слышен внутри живой речи
    русский текст должен быть плотным, но не жестким
    полезный возврат приходит вовремя и не сушит ритм
    ясная ступень делает следующий шаг заметным без лишних подсказок
    сильная подача удерживает внимание даже в длинном абзаце
    хороший контрольный текст не превращает практику в список безопасных слов
    живая фраза помогает рукам доверять следующему повороту
    новый контраст должен расширять урок, а не ломать его тон
    спокойный обзор возвращает смысл туда, где память уже хочет срезать путь
    тёплый свет ложится на стол
    тихий двор еще держит тень
    письмо лежит рядом с книгой
    лёгкий дождь касается стекла
    окно открыто вечернему воздуху
    чай остывает на краю стола
    узкая тропа ведет к саду
    спокойный голос еще слышен в комнате
  `),
]);

const russianPremiumPhraseFragments = uniqueTexts([
  ...russianPhraseFragments,
  ...russianExpandedPhraseFragments,
]);

const russianExpandedBenchmarkSentences = uniqueTexts([
  ...lines(`
    Хороший русский урок сначала делает следующий шаг понятным, а уже потом расширяет словарь и плотность фразы.
    Спокойная подача особенно важна в начале пути, потому что она дает рукам уверенность, а глазам живую линию чтения.
    Когда новая связка возвращается внутри естественной речи, ученик тренирует не память о шаблоне, а настоящую гибкость.
    Сильный абзац не прячет сложность, но и не превращает урок в набор колючих переходов ради одной только новизны.
    Полезный обзор объясняет, что именно меняется в следующем проходе: словарь, длина фразы, плотность знаков или глубина паузы.
    Русская практика звучит зрелее, когда пунктуация помогает держать дыхание, а не просто добавляет поверх текста шум.
    Чем лучше организован ранний повтор, тем легче ученик верит, что следующая строка выбрана не случайно, а по делу.
    Настоящий рост заметен там, где знакомые слова больше не доминируют над ритмом и уступают место более широкому контексту.
    Хороший контрольный текст не ускоряет ученика обманом; он дает честную вариацию и сохраняет спокойный литературный тон.
    Новая трудность должна быть видна заранее, чтобы взгляд успел подготовиться и не догонял руки уже после ошибки.
    Плотный русский проход полезен тогда, когда смысл, пауза и знак остаются связаны одной понятной интонацией.
    Когда урок звучит как речь, ученик легче переносит навык в реальные тексты и меньше зависит от знакомых фрагментов.
    Более широкий словарь нужен не для украшения, а для того, чтобы скорость опиралась на чтение, а не на память о безопасных словах.
    Следующий этап кажется убедительным, когда он приносит новую структуру и новые переходы, но не теряет спокойную подачу.
    Хороший русский абзац держит ученика внутри мысли, поэтому даже длинная строка не рассыпается на отдельные слоги.
    Если повтор возвращается слишком громко, урок грубеет; если он встроен мягко, то поддерживает точность и зрелый ритм.
    Настоящая редактура видна в том, что трудный поворот появляется вовремя и не ломает дыхание всей строки.
    Чем богаче связки внутри текста, тем честнее выглядит достигнутая скорость и тем труднее памяти подменить чтение.
    Тёплый свет ложится на стол, а открытое окно держит комнату тихой, поэтому длинная строка читается без толчков.
    Письмо лежит рядом с книгой, и этот спокойный бытовой кадр делает следующую фразу естественной, а не собранной из шаблонов.
    Лёгкий дождь касается стекла, пока взгляд спокойно идет вперед, так что даже плотный поворот не ломает общий ритм.
    Узкая тропа ведет к саду, и ясная картина помогает держать смысл до конца строки, не уступая место сухой механике.
    Чай остывает на краю стола, а тихий двор еще держит тень, поэтому длинный абзац звучит мягко и связно.
    Спокойный голос еще слышен в комнате, и эта живая сцена оставляет тексту дыхание даже тогда, когда словарь становится шире.
  `),
  ...buildSentencePairs({
    fragments: russianPremiumPhraseFragments,
    tails: lines(`
      следующая строка открывается без догадки
      сложность читается как рост, а не как шум
      ученик видит смысл раньше трудного стыка
      повтор остается полезным и живым
      скорость выглядит заслуженной, а не защищенной
      длинный абзац не теряет интонацию
      урок звучит как речь, а не как сборка
      новая связка приходит в правильный момент
      взгляд спокойно держит линию дальше
    `),
    templates: [
      (lead, follow, tail) =>
        `${capitalizeFirstCharacter(lead)}, а ${follow}, поэтому ${tail}.`,
      (lead, follow, tail) => `Когда ${lead}, ${follow}, и ${tail}.`,
      (lead, follow, tail) =>
        `${capitalizeFirstCharacter(lead)}, потому что ${follow}, и ${tail}.`,
      (lead, follow, tail) => `Если ${lead}, ${follow}, то ${tail}.`,
    ],
    count: 192,
  }),
]);

const russianPremiumBenchmarkSentences = uniqueTexts([
  ...russianBenchmarkSentences,
  ...russianExpandedBenchmarkSentences,
]);

const persianExpandedPhraseFragments = uniqueTexts([
  ...buildClauseSet(
    lines(`
      مرور آرام
      جمله طبیعی
      واژه آشنا
      گذر سخت
      بند کوتاه
      پاراگراف زنده
      نشانه دقیق
      بازگشت سنجیده
      واژگان گسترده
      سختی آرام
      متن روان
      مکث به‌جا
      دید جلوتر
      پیوند روشن
      مرور هدفمند
      مرحله روشن
      درس منسجم
      جمله پیوسته
      لحن آرام
      راهنمای نرم
      ریتم جمع‌وجور
      مسیر روشن
    `),
    lines(`
      درس بعدی را روشن می‌کند
      گذر دشوار را زودتر نشان می‌دهد
      متن را از حالت فهرست بیرون می‌آورد
      واژگان را بدون شلوغی گسترده‌تر می‌کند
      چشم را یک گام جلوتر نگه می‌دارد
      نشانه را پیش از ضربه قابل‌دیدن می‌کند
      تکرار را از دور بسته دور می‌کند
      ورود به جمله بلند را نرم‌تر می‌کند
      مرور را به پیشروی واقعی تبدیل می‌کند
      سختی را خوانا و قابل‌اعتماد نگه می‌دارد
      جای نفس را روشن نگه می‌دارد
      بازگشت به واژه آشنا را طبیعی می‌کند
      فشار را روی کلیدهای ضعیف پخش می‌کند
      متن را انسانی و واقعی نگه می‌دارد
      خطای پنهان را زودتر آشکار می‌کند
      حس معلم‌وار درس را حفظ می‌کند
    `),
  ),
  ...lines(`
    جمله بعدی باید درست و بجا به نظر برسد، نه فقط متفاوت
    متن خوب فارسی معنا را جلوتر از دست نگه می‌دارد
    دشواری تازه فقط وقتی مفید است که لحن درس هنوز آرام بماند
    مرور روشن نقطه ضعف را پنهان نمی‌کند و زودتر آن را نشان می‌دهد
    پاراگراف زنده گذرهای بلند را بدون خشکی نگه می‌دارد
    نشانه‌گذاری خوب چشم را پیش از ضربه آماده می‌کند
    درس منسجم تکرار را از حالت ماشینی بیرون می‌آورد
    جمله طبیعی راه ورود به واژگان تازه را هموارتر می‌کند
    متن روان به شاگرد کمک می‌کند سختی را باور کند
    واژه آشنا وقتی کنار ساختار تازه می‌آید هنوز واقعی و زنده می‌ماند
    سختی خوب باید خوانا بماند، نه اینکه فقط فشرده‌تر شود
    مرور هدفمند به شاگرد نشان می‌دهد چرا این مرحله سخت‌تر شده است
    مسیر روشن باعث می‌شود چشم از واژه بعدی جا نماند
    بازگشت سنجیده ریتم را نگه می‌دارد و درس را خسته‌کننده نمی‌کند
    متن فارسی باید بومی، پیوسته، و خوش‌ریتم دیده شود
    لحن آرام حتی در جمله بلند هم حس اعتماد را حفظ می‌کند
    بند کوتاه می‌تواند سکوی ورود به پاراگراف پیچیده‌تر باشد
    پیوند روشن اجازه نمی‌دهد حافظه جای خواندن واقعی را بگیرد
  `),
]);

const persianEverydayPhraseFragments = uniqueTexts([
  ...lines(`
    چای گرم روی میز آرام می‌ماند
    صدای نرم از کوچه بالا می‌آید
    در نیمه‌باز هوای تازه می‌آورد
    کتاب باز کنار پنجره جا مانده است
    نور صبح روی فرش آرام می‌افتد
    بوی نان تازه در راهرو می‌پیچد
    سایه درخت روی دیوار می‌لغزد
    گفت‌وگوی کوتاه هنوز در گوش می‌ماند
    باران ریز روی شیشه آرام می‌نشیند
    حیاط کوچک بعد از باران روشن مانده است
    راهرو ساکت تا اتاق ادامه پیدا می‌کند
    چراغ کوچک گوشه اتاق روشن است
    سکوت خانه با صدای دور نمی‌شکند
    نگاه آرام تا انتهای سطر پیش می‌رود
    برگ خیس کنار پله‌ها افتاده است
    هوای خنک از پنجره آهسته می‌وزد
    کوچه باریک تا میدان قدیمی می‌رسد
    صدای قدم‌ها روی سنگ نرم می‌شود
    اتاق نیم‌روشن هنوز منظم و آرام است
    عصر آرام روی بام خانه می‌ماند
    نسیم کم پرده روشن را تکان می‌دهد
    فنجان چای کنار دفتر جا گرفته است
    نامه کوتاه روی میز تاخورده مانده است
    حاشیه نور تا دیوار روبه‌رو می‌رسد
    بوی خاک نم‌خورده در هوا می‌ماند
    باغچه کوچک بعد از آب دادن زنده‌تر است
    صندلی خالی کنار پنجره ساکت مانده است
    عکس قدیمی هنوز بر دیوار روشن است
    موج کم کنار ساحل آرام برمی‌گردد
    سنگ خنک در سایه درخت مانده است
    نور کم روی دفتر باز پخش می‌شود
    خیابان خلوت تا پل قدیمی ادامه دارد
    بوی چای تازه در اتاق می‌ماند
    پنجره روشن رو به حیاط باز است
    صدای دور از پشت بام می‌گذرد
    هوای صبح کوچه را روشن‌تر می‌کند
    نگاه آرام روی کلمه بعدی می‌نشیند
    سایه نرم تا لبه دیوار می‌رسد
    نامه تازه کنار کتاب بسته مانده است
    راه کوتاه تا در چوبی ادامه پیدا می‌کند
    چای کم‌رنگ کنار پنجره آرام می‌ماند
    صدای باران تا آخر راهرو می‌رسد
    سکوت نرم روی صفحه باز می‌نشیند
    در چوبی با صدای کم بسته می‌شود
    نور عصر روی دیوار روشن می‌لغزد
  `),
]);

const persianEditorialPhraseFragments = uniqueTexts([
  ...lines(`
    جمله نرم فشار واژه تازه را کم می‌کند
    متن زنده اجازه نمی‌دهد تمرین مصنوعی شود
    عبارت طبیعی چشم را از معنا جدا نمی‌کند
    واژه دقیق در جمله درست جا می‌افتد
    پیوند خوب راه ورود به بند بعدی را روشن می‌کند
    مکث بجا نفس جمله را سالم نگه می‌دارد
    بند کوتاه می‌تواند بسیار آموزنده بماند
    جمله بلند باید هنوز روشن و خوش‌ریتم باشد
    متن فارسی با لحن درست بهتر در ذهن می‌ماند
    واژه تازه وقتی طبیعی باشد زودتر پذیرفته می‌شود
    تمرین خوب فشار را پنهان نمی‌کند اما شلوغ هم نمی‌شود
    سطر پیوسته چشم را برای واژه بعدی آماده نگه می‌دارد
    ساختار روشن حس اعتماد را در کل درس نگه می‌دارد
    متن خوب سرعت را بر خواندن واقعی بنا می‌کند
    گذر دشوار باید خوانا بماند تا مفید باشد
    جمله درست هنوز در شروع آرام و قابل‌اعتماد است
    واژگان گسترده وقتی طبیعی باشند درس را بالغ‌تر می‌کنند
    مرور نرم باعث می‌شود دشواری باورپذیر بماند
    خطای کوچک نباید جریان طبیعی بند را از هم بپاشد
    عبارت پخته به جای فهرست خشک می‌نشیند
  `),
]);

const persianPremiumPhraseFragments = uniqueTexts([
  ...persianCalmPhraseFragments,
  ...persianPhraseFragments,
  ...persianExpandedPhraseFragments,
  ...persianEverydayPhraseFragments,
  ...persianEditorialPhraseFragments,
]);

const persianExpandedBenchmarkSentences = uniqueTexts([
  ...lines(`
    درس خوب فارسی اول مسیر مرحله بعدی را روشن می‌کند و بعد دامنه واژگان و طول جمله را گسترده‌تر می‌سازد.
    لحن آرام در شروع مسیر مهم است، چون هم به دست اطمینان می‌دهد و هم به چشم فرصت می‌دهد یک گام جلوتر بماند.
    وقتی پیوند تازه در دل زبان طبیعی برمی‌گردد، شاگرد انعطاف واقعی را تمرین می‌کند و فقط یک الگوی آشنا را تکرار نمی‌کند.
    پاراگراف قوی دشواری را پنهان نمی‌کند، اما آن را به شلوغی و آشفتگی بی‌منطق هم تبدیل نمی‌کند.
    مرور سنجیده روشن می‌کند که چرا متن سخت‌تر شده است: واژگان گسترده‌تر شده‌اند، جمله پیچیده‌تر شده، یا نشانه‌ها نقش بیشتری گرفته‌اند.
    فارسی زمانی بالغ‌تر به نظر می‌رسد که نشانه‌گذاری در خدمت ریتم و معنا باشد، نه اینکه فقط بار ظاهری سطر را بیشتر کند.
    اگر بازبینی به‌جا و به‌موقع برگردد، شاگرد راحت‌تر باور می‌کند که درس بعدی واقعا بهترین گام بعدی است.
    رشد واقعی آن‌جاست که واژه‌های امن دیگر تمام ریتم را در دست ندارند و متن زمینه‌ای گسترده‌تر و طبیعی‌تر پیدا می‌کند.
    متن معیار خوب سرعت را با فریب بالا نمی‌برد؛ تنوع کافی می‌دهد و در عین حال لحن انسانی خود را حفظ می‌کند.
    دشواری تازه باید زودتر دیده شود تا چشم بتواند آماده بماند و بعد از خطا به متن نرسد.
    گذر فشرده وقتی مفید است که معنا، مکث، و نشانه هنوز زیر یک آهنگ روشن کنار هم بمانند.
    وقتی درس شبیه گفتار طبیعی شنیده می‌شود، انتقال مهارت به متن واقعی هم آسان‌تر و پایدارتر خواهد بود.
    واژگان گسترده فقط برای تزئین نیستند؛ آن‌ها باعث می‌شوند سرعت بر خواندن تکیه کند، نه بر حفظ چند واژه امن.
    مرحله بعدی زمانی قانع‌کننده است که ساختار تازه و پیوندهای تازه بیاورد و هنوز آرامش خود را از دست ندهد.
    یک متن فارسی خوب شاگرد را داخل معنای جمله نگه می‌دارد و نمی‌گذارد سطر بلند به قطعات بی‌جان شکسته شود.
    اگر تکرار بیش از حد آشکار شود، درس سرد می‌شود؛ اگر نرم و به‌اندازه برگردد، دقت و اعتماد را با هم نگه می‌دارد.
    ویرایش خوب از این‌جا دیده می‌شود که گذر سخت درست در زمان مناسب وارد می‌شود و نفس کل جمله را نمی‌شکند.
    هرچه پیوندهای درون متن متنوع‌تر و طبیعی‌تر باشند، سرعت به‌دست‌آمده هم صادقانه‌تر و پایدارتر خواهد بود.
  `),
  ...buildSentencePairs({
    fragments: persianPremiumPhraseFragments,
    tails: lines(`
      سطر بعدی بدون حدس‌زدن باز می‌شود
      سختی به صورت رشد دیده می‌شود، نه شلوغی
      شاگرد معنا را پیش از گذر دشوار می‌بیند
      تکرار هنوز زنده و مفید می‌ماند
      سرعت واقعی‌تر و صادقانه‌تر دیده می‌شود
      پاراگراف بلند لحن خود را از دست نمی‌دهد
      درس شبیه زبان واقعی شنیده می‌شود
      پیوند تازه در زمان درست برمی‌گردد
      چشم با آرامش خط بعدی را دنبال می‌کند
    `),
    templates: [
      (lead, follow, tail) => `${lead} و ${follow}، بنابراین ${tail}.`,
      (lead, follow, tail) => `وقتی ${lead}، ${follow} و ${tail}.`,
      (lead, follow, tail) => `${lead}، چون ${follow} و ${tail}.`,
      (lead, follow, tail) => `اگر ${lead}، ${follow}، ${tail}.`,
    ],
    count: 192,
  }),
]);

const persianNarrativeBenchmarkSentences = uniqueTexts([
  ...lines(`
    چای گرم روی میز بخار می‌کند و نور کم از پنجره می‌ریزد، برای همین اتاق آرام اما زنده به نظر می‌رسد.
    کوچه بعد از باران بوی خاک می‌دهد و رهگذرها آهسته‌تر راه می‌روند، انگار شهر برای لحظه‌ای نفس عمیق‌تری کشیده است.
    کتاب باز کنار پنجره جا مانده است و نسیم کم برگ‌هایش را جابه‌جا می‌کند، بی‌آنکه سکوت نرم اتاق را بر هم بزند.
    گفت‌وگوی کوتاه در راهرو تمام شده است، اما آهنگ آرام آن هنوز در فضا می‌ماند و حس پیوستگی صحنه را نگه می‌دارد.
    نور صبح از لبه پرده می‌گذرد و روی فرش روشن می‌نشیند، چنان‌که هر چیز ساده‌تر و منظم‌تر از چند دقیقه پیش دیده می‌شود.
    باغچه کوچک بعد از آب دادن زنده‌تر شده است و بوی خاک نم‌خورده در هوا می‌ماند، برای همین حیاط هنوز تازه و آرام حس می‌شود.
    صدای قدم‌ها روی سنگ نرم می‌شود و بعد در پیچ کوچه گم می‌گردد، اما سکوت آرام خیابان همچنان سر جای خود باقی می‌ماند.
    نامه کوتاه روی میز تاخورده مانده است و فنجان چای کنارش سرد می‌شود، گویی زمان در اتاق برای لحظه‌ای از شتاب افتاده است.
    راهرو ساکت تا اتاق آخر ادامه پیدا می‌کند و چراغ کوچک گوشه دیوار هنوز روشن است، پس نگاه بی‌فشار همه خط را دنبال می‌کند.
    عصر آرام روی بام خانه می‌ماند و صدای دور شهر به نرمی بالا می‌آید، بی‌آنکه تصویر روشن و ساده پیش رو را آشفته کند.
    متن خوب فارسی فقط درست نوشته نمی‌شود؛ معنا، مکث، و آهنگ را هم کنار هم نگه می‌دارد تا خواندن آن طبیعی و پیوسته بماند.
    وقتی بندی با واژه‌های زنده و پیوندهای روشن ساخته می‌شود، شاگرد دیگر حس نمی‌کند که درس از قطعه‌های جدا کنار هم چیده شده است.
    عبارت طبیعی به چشم کمک می‌کند قبل از رسیدن دست، راه جمله را ببیند و گذر دشوار را بدون دستپاچگی پشت سر بگذارد.
    دشواری واقعی زمانی ارزش دارد که متن هنوز لحن انسانی خود را حفظ کند و شاگرد را فقط با شلوغی یا نشانه‌های اضافه تحت فشار نگذارد.
    اگر واژه تازه در یک جمله جاافتاده و خوش‌ریتم برگردد، پذیرش آن آسان‌تر می‌شود و حافظه جای خواندن واقعی را نمی‌گیرد.
    مرور سنجیده باید روشن کند که چرا این بند سخت‌تر شده است: شاید واژگان گسترده‌تر شده‌اند، شاید پیوندها فشرده‌تر شده‌اند، و شاید مکث‌ها نقش تازه‌ای گرفته‌اند.
    متن معیار خوب سرعت را با فریب بالا نمی‌برد، بلکه به اندازه کافی تنوع می‌دهد تا نتیجه بر خواندن واقعی و کنترل آرام تکیه کند.
    سطر بلند وقتی ارزش تمرین پیدا می‌کند که هنوز جای نفس، نشانه، و مسیر نگاه را روشن نگه دارد و به قطعات بی‌جان فرو نریزد.
    چراغ کوچک کنار دیوار روشن مانده است و سکوت خانه به چشم فرصت می‌دهد تا واژه بعدی را بی‌فشار پیدا کند.
    فنجان چای روی میز سرد می‌شود و نور بعدازظهر آرام‌تر می‌افتد، چنان‌که سطر بلند هنوز خوانا و نرم دنبال می‌شود.
    کوچه باریک تا میدان قدیمی می‌رسد و صدای قدم‌ها در آن پخش می‌شود، اما ریتم صحنه هنوز منظم و بی‌شتاب باقی می‌ماند.
    پنجره نیمه‌باز هوای خنک را به اتاق می‌آورد و صفحه باز کتاب هنوز روشن است، برای همین نگاه بی‌گسست تا پایان جمله پیش می‌رود.
    متن فارسی وقتی بالغ به نظر می‌رسد که هم واژه زنده داشته باشد و هم گذر دشوار را بی‌نمایش و بی‌خشونت وارد کند.
    اگر عبارت‌ها طبیعی و جاافتاده باشند، شاگرد زودتر حس می‌کند که درس از زبان زنده آمده است، نه از قطعه‌های جدا و بی‌نفس.
    بند خوب نه بیش از اندازه امن می‌ماند و نه بی‌جهت شلوغ می‌شود؛ فقط راهی روشن برای دیدن و زدن واژه بعدی باز می‌کند.
    نگاه وقتی آرام جلو می‌رود که پیوندها به‌جا باشند و نشانه‌ها معنای جمله را نگه دارند، نه اینکه فقط بار ظاهری سطر را بیشتر کنند.
    چای کم‌رنگ کنار پنجره آرام می‌ماند و نور عصر روی دیوار می‌لغزد، برای همین جمله بلند هنوز نرم و پیوسته دیده می‌شود.
    صدای باران تا آخر راهرو می‌رسد و سکوت خانه را تند نمی‌کند، پس نگاه با آرامش تا واژه بعدی جلو می‌رود.
    در چوبی با صدای کم بسته می‌شود و صفحه باز هنوز روشن می‌ماند، چنان‌که سطر بعدی بی‌فشار و بی‌گسست دنبال می‌شود.
    اگر تصویر جمله زنده و آرام بماند، شاگرد زودتر حس می‌کند که دشواری تازه از دل زبان آمده است، نه از قطعه‌های کنار هم.
  `),
  ...buildSentencePairs({
    fragments: [...persianEverydayPhraseFragments, ...persianEditorialPhraseFragments],
    tails: lines(`
      بند هنوز طبیعی و خوانا باقی می‌ماند
      نگاه با آرامش تا واژه بعدی پیش می‌رود
      معنا از زیر فشار نشانه‌ها بیرون نمی‌افتد
      شاگرد دلیل سخت‌تر شدن متن را حس می‌کند
      ریتم جمله بی‌جهت به هم نمی‌ریزد
      سرعت بر خواندن واقعی تکیه می‌کند
      سطر بعدی بدون خشکی و پرش باز می‌شود
      تمرین از حالت قطعه‌های جدا بیرون می‌آید
      متن هنوز شبیه زبان زنده شنیده می‌شود
    `),
    templates: [
      (lead, follow, tail) => `${lead} و ${follow}، بنابراین ${tail}.`,
      (lead, follow, tail) => `وقتی ${lead}، ${follow} و ${tail}.`,
      (lead, follow, tail) => `${lead}، بعد ${follow} و ${tail}.`,
      (lead, follow, tail) => `اگر ${lead}، ${follow}، ${tail}.`,
    ],
    count: 168,
  }),
]);

const persianPremiumBenchmarkSentences = uniqueTexts([
  ...persianCalmBenchmarkSentences,
  ...persianBenchmarkSentences,
  ...persianExpandedBenchmarkSentences,
  ...persianNarrativeBenchmarkSentences,
]);

export const supplementalLanguageLexicons = {
  english: {
    foundationalWords: words(`
      air area arise artist assist east enter entire learn learner letter linear listen near real reason
      reset retain sailor salt seat sister star start state still street tailor talent train trail tree
      clear calm close direct easier listen listenable read reader steady settle simple sound startle stillness
    `),
    developingWords: words(`
      balance clause contrast control crafted detail durable guided passage preview readable recovery rhythm signal
      spacing steadying structure support teacher timing transition variety wording workflow
    `),
    advancedWords: words(`
      adaptability articulation benchmark breadth calibration coherence complexity expressiveness progression readability reinforcement
      sophistication structure-aware teacherlike transition-rich variation
    `),
    realWords: words(`
      accuracy adaptive benchmark cadence clarity cluster confidence control cooldown fluency focus hesitation keyboard
      learner lesson mastery naturalness novelty passage patience planner posture practice preview punctuation readable
      recovery repetition rhythm review spacing stability teacher teacherly timing transition unlock variation workflow
      breadth clause coherence contrast editorial fluency-guided handoff language-aware learner-facing modulation pacing passagework
      progression realism scaffold sentence-shaped stagecraft structure teacherlike transition-rich variety-first vocabulary
      window garden letter paper morning kettle doorway lantern quiet street hallway rain shadow
    `),
    phraseFragments: englishPhraseFragments,
    benchmarkSentences: englishBenchmarkSentences,
    sourceOrigins: {
      commonWords: [
        "NullKeys curated English progression booster lexicon for beginner, intermediate, and advanced practice",
      ],
      phraseDrills: [
        "NullKeys curated English teacher-style phrase drills for early and mid progression",
      ],
      quoteDrills: [
        "NullKeys curated English benchmark passages for readable, editorially strong progression",
      ],
    },
  },
  spanish: {
    realWords: words(`
      tiempo gente casa calle puerta mesa agua viento papel mano mundo tarde manana ciudad ventana escuela
      trabajo detalle memoria ritmo palabra lectura mirada paisaje claridad puente teclado numero senal enfoque
      esfuerzo progreso control tejido camino puerto jardin mercado silencio costumbre distancia textura
      amigo amiga barrio bosque brillo calma camino camisa canto causa centro ciudad clase cocina consejo cuerpo
      cuidado cultura deber debate dibujo diario dinero detalle dolor domingo ejemplo energia espacio espejo estudio
      familia figura fuerza fuente futuro gesto gobierno harina historia hogar idea iglesia imagen invierno jardin
      jornada justicia lengua lectura libertad lluvia lugar maquina madera manera mercado mensaje minuto mirada modelo
      momento moneda montana musica negocio nivel noticia numero oficina origen pagina paisaje palabra parada parte
      paciencia periodo persona pregunta pueblo puerta recuerdo region respeto respuesta ritmo saludo semana servicio
      silencio sonrisa sonido suerte taller tarea tension tierra trabajo ventana viaje viento volumen
    `),
  },
  french: {
    realWords: words(`
      temps monde maison rue porte table eau vent papier main soir matin ville fenetre ecole travail
      detail memoire rythme lecture regard paysage clarte clavier signal nombre phrase mesure controle
      patience passage nuance atelier chemin marche lumiere routine texture cadence
      accord action adresse avenir balance bureau campagne carriere chanson chaleur chemin ciel classe client
      colonne commerce conseil courage courant culture decision defense demande dessin dialogue distance docteur
      economie effort element energie epoque equipe exemple exercice famille fenetre figure formule fortune
      geste histoire horizon image industrie instant journal langue lecture logique lumiere marche materiel
      methode minute miroir modele moment montagne musique niveau nombre objet occasion opinion origine palais
      parole passage patience periode personne phrase pouvoir pratique presence programme promesse question raison
      region relation reponse retour richesse rivage routine science secret service silence solution sourire
      station structure systeme talent theorie travail univers valeur vitesse volume voyage
    `),
  },
  german: {
    realWords: words(`
      zeit welt haus tisch wasser fenster garten strae papier hand abend morgen stadt arbeit detail
      rhythmus lesung blick klarheit tastatur signal zahl wort uebung geduld ordnung bewegung muster
      kontrolle bruecke raum schritt fortschritt alltag
      abschnitt abstand alltag antwort arbeit atelier aufgabe ausgang balance bedeutung bericht beruf
      bewegung bildung blick bruecke buchung buehne dialog dorf druck ebene eingang erinnerung erfolg
      familie farbe fenster figur fluss frage freude fuehrung gebaeude gedanke gefuehl geheimnis geraet
      gesicht geschichte gesund grund gruppe handel heimat hinweis horizon idee insel kapitel klasse kultur
      landschaft leitung linie loesung markt minute modell moment mutter nachricht natur ordnung quelle
      raum reise routine rueckblick schatten signal sprache station struktur system talent teil theorie
      uebung uebergang umfeld ursache verkehr versuch vision waerme weise werkzeug winter wortzahl zentrum
    `),
  },
  portuguese: {
    realWords: words(`
      tempo casa rua porta mesa agua vento papel mao mundo tarde manha cidade janela escola trabalho
      detalhe memoria ritmo leitura olhar paisagem clareza teclado numero sinal enfoque esforco progresso
      controle rotina caminho textura medida oficina
    `),
  },
  italian: {
    realWords: words(`
      tempo mondo casa strada porta tavolo acqua vento carta mano sera mattina citta finestra scuola
      lavoro dettaglio memoria ritmo lettura sguardo chiarezza tastiera numero segnale pratica controllo
      ponte misura officina routine pazienza passaggio trama
    `),
  },
  dutch: {
    realWords: words(`
      tijd wereld huis straat deur tafel water wind papier hand avond ochtend stad venster school werk
      detail geheugen ritme lezing blik helderheid toetsen signaal getal oefening controle patroon brug
      routine beweging maat tempo ruimte vooruitgang
    `),
  },
  estonian: {
    realWords: words(`
      aeg maja tanav uks laud vesi tuul paber kasi maailm ohtu hommik linn aken kool too detail malestus
      rytm sona lugemine vaade selgus klaviatuur number signaal harjutus kontroll sild samm edenemine
    `),
  },
  swedish: {
    realWords: words(`
      tid hus gata dorr bord vatten vind papper hand varld kvall morgon stad fonster skola arbete detalj
      minne rytm ord lasning blick klarhet tangent signal nummer ovning kontroll bro monster vardag
    `),
  },
  norwegian: {
    realWords: words(`
      tid hus gate dor bord vann vind papir hand verden kveld morgen by vindu skole arbeid detalj minne
      rytme ord lesing blikk klarhet tastatur signal tall oving kontroll bro monster flyt hverdag
    `),
  },
  "norwegian-bokmal": {
    realWords: words(`
      tid hus gate dor bord vann vind papir hand verden kveld morgen by vindu skole arbeid detalj minne
      rytme ord lesing blikk klarhet tastatur signal tall oving kontroll bro monster flyt hverdag
    `),
  },
  danish: {
    realWords: words(`
      tid hus gade dor bord vand vind papir hand verden aften morgen by vindue skole arbejde detalje
      hukommelse rytme ord laesning blik klarhed tastatur signal tal ovelse kontrol bro monster flyd
    `),
  },
  finnish: {
    realWords: words(`
      aika talo katu ovi poyta vesi tuuli paperi kasi maailma ilta aamu kaupunki ikkuna koulu tyo
      yksityiskohta muisti rytmi sana lukeminen katse selkeys nappain numero merkki harjoitus hallinta silta
    `),
  },
  polish: {
    realWords: words(`
      czas dom ulica drzwi stol woda wiatr papier dlon swiat wieczor rano miasto okno szkola praca
      detal pamiec rytm slowo lektura spojrzenie jasnosc klawiatura liczba sygnal cwiczenie kontrola most
    `),
  },
  czech: {
    realWords: words(`
      cas dum ulice dvere stul voda vitr papir ruka svet vecer rano mesto okno skola prace detail pamet
      rytmus slovo cteni pohled jasnost klavesnice cislo signal cviceni kontrola most
    `),
  },
  croatian: {
    realWords: words(`
      vrijeme kuca ulica vrata stol voda vjetar papir ruka svijet vecer jutro grad prozor skola posao
      detalj pamcenje ritam rijec citanje pogled jasnoca tipkovnica broj signal vjezba kontrola most
    `),
  },
  romanian: {
    realWords: words(`
      timp casa strada usa masa apa vant hartie mana lume seara dimineata oras fereastra scoala munca
      detaliu memorie ritm cuvant lectura privire claritate tastatura numar semnal exercitiu control pod
    `),
  },
  hungarian: {
    realWords: words(`
      ido haz utca ajto asztal viz szel papir kez vilag este reggel varos ablak iskola munka reszlet
      emlek ritmus szo olvasas tekintet tisztasag billentyu szam jelzes gyakorlat kontroll hid
    `),
  },
  slovenian: {
    realWords: words(`
      cas hisa ulica vrata miza voda veter papir roka svet vecer jutro mesto okno sola delo podrobnost
      spomin ritem beseda branje pogled jasnost tipkovnica stevilo signal vaja nadzor most
    `),
  },
  turkish: {
    realWords: words(`
      zaman ev sokak kapi masa su ruzgar kagit el dunya aksam sabah sehir pencere okul is ayrinti bellek
      ritim kelime okuma bakis aciklik klavye sayi isaret alistirma kontrol kopru duzen gecis
    `),
  },
  indonesian: {
    realWords: words(`
      waktu rumah jalan pintu meja air angin kertas tangan dunia sore pagi kota jendela sekolah kerja
      detail memori ritme kata bacaan pandangan jelas papan angka sinyal latihan kontrol jembatan pola
      teman keluarga pasar kantor ruang lampu halaman taman suara senyum cerita gambar warna cuaca langit
      musim pantai sungai gunung desa kereta kapal bandara stasiun halaman berita pesan jawaban alasan
      bentuk ukuran bahan tenaga gerak langkah pilihan tujuan usaha hasil perasaan harapan perhatian
      kebiasaan pelajaran bahasa tulisan pembaca pemimpin layanan sejarah budaya makanan minuman sayuran
      buah bunga perjalanan latihan kemajuan ketelitian ketenangan kecepatan kestabilan catatan halaman
      tugas minggu bulan tahun malam siang pagi sore senin selasa rabu kamis jumat sabtu minggu
    `),
  },
  ukrainian: {
    realWords: words(`
      час дім вулиця двері стіл вода вітер папір рука світ вечір ранок місто вікно школа робота
      деталь память ритм слово читання погляд ясність клавіша число сигнал вправа контроль міст шлях
    `),
  },
  belarusian: {
    realWords: words(`
      час дом вуліца дзверы стол вада вецер папера рука свет вечар раніца горад акно школа праца
      дэталь память рытм слова чытанне погляд яснасць клавіша лік сігнал практыка кантроль мост шлях
      дзень ноч дарога рака поле лес сад кветка дрэва неба воблака сонца месяц зорка песня мова
      кніга старонка адказ пытанне урок вучань настаўнік думка сэрца жыццё сямя сябра сусед дапамога
      справа вынік пачатак канец сярэдзіна рух крок форма колер гук цішыня звычка увага спакой
      надзея сустрэча дарожка майстэрня майстар будынак плошча вакзал паведамленне прыклад гісторыя
      культура традыцыя памяць будучыня мінулае сёння заўтра учора ранак абед вечарына маршрут
      назіранне асцярога дакладнасць якасць трываласць пераход сувязь адказнасць
    `),
  },
  russian: {
    foundationalWords: words(`
      ритм темп строка слово пауза взгляд рука буква урок ход опора знак точка мост шаг линия текст мысль
    `),
    developingWords: words(`
      переход связка обзор абзац поворот чтение точность привычка движение контраст ориентир повтор маршрут внимание
    `),
    advancedWords: words(`
      выразительность пунктуация последовательность разнообразие устойчивость напряжение распределение восстановление наблюдательность
    `),
    realWords: words(`
      время дом улица дверь стол вода ветер бумага рука мир вечер утро город окно школа работа
      деталь память ритм слово чтение взгляд ясность клавиша число сигнал упражнение контроль мост
      маршрут поток опора граница контекст размер привычка движение точка ответ абзац связка обзор
      ориентир повтор подача дыхание выразительность пунктуация разнообразие устойчивость переход
      письмо тишина дождь сад тропа чашка лампа комната окно двор голос тень
    `),
    phraseFragments: russianPremiumPhraseFragments,
    benchmarkSentences: russianPremiumBenchmarkSentences,
    sourceOrigins: {
      commonWords: [
        "NullKeys Russian supplemental lexicon additions for teacher-style practice vocabulary",
      ],
      phraseDrills: [
        "NullKeys curated Russian phrase-drill clauses built from local teacher-style lesson templates",
      ],
      quoteDrills: [
        "NullKeys curated Russian benchmark passages built from local sentence templates and readable clause pairings",
      ],
    },
  },
  greek: {
    realWords: words(`
      χρονος σπιτι δρομος πορτα τραπεζι νερο αερας χαρτι χερι κοσμος βραδυ πρωι πολη παραθυρο σχολειο
      δουλεια λεπτομερεια μνημη ρυθμος λεξη αναγνωση βλεμμα καθαροτητα πληκτρο σημειο αριθμος ασκηση ελεγχος
    `),
  },
  japanese: {
    realWords: words(`
      ことば てもと まど みち みず ひかり よる あさ しごと がくしゅう りずむ おん ひょうし
      ぶん もんだい かいとう きろく しせい ながれ はやさ せいちょう れんしゅう みなおし
    `),
    phraseFragments: japanesePhraseFragments,
    benchmarkSentences: japaneseBenchmarkSentences,
    sourceOrigins: {
      commonWords: [
        "NullKeys Japanese supplemental vocabulary curated for kana-first practice flow",
      ],
      phraseDrills: [
        "NullKeys curated Japanese phrase-drill fragments written with readable learner-facing separators",
      ],
      quoteDrills: [
        "NullKeys curated Japanese benchmark passages with phrase-like pacing and local-only sentence templates",
      ],
    },
  },
  hebrew: {
    realWords: words(`
      זמן בית רחוב דלת שולחן מים רוח ניר יד עולם ערב בוקר עיר חלון ביתספר עבודה זכרון קצב
      מילה קריאה מבט בהירות מספר סימן תרגיל שליטה גשר מעבר מרחב
    `),
  },
  arabic: {
    realWords: words(`
      وقت بيت شارع باب طاولة ماء هواء ورق يد عالم مساء صباح مدينة نافذة مدرسة عمل ذاكرة ايقاع
      كلمة قراءة نظر وضوح رقم اشارة تدريب سيطرة جسر حركة توازن سطر فقرة
    `),
  },
  persian: {
    foundationalWords: words(`
      ریتم متن جمله واژه نگاه دست درس مکث مسیر سطر تمرین مرحله دقت پل نشانه خط راه
      آرام امروز فردا خانه کوچه پنجره کتاب دفتر اتاق صدا چراغ باران بهار پاییز دوست
      خانواده باغچه فنجان نامه ساحل شاخه بام پرده حیاط دیوار فرش نسیم
    `),
    developingWords: words(`
      بازبینی ترکیب گذر پیوند پاراگراف خوانایی تعادل تمرکز جریان الگو مرور بازگشت واژگان همراهی
      روایت پیوستگی خوش‌ریتم معناپذیری مکث‌گذاری هماهنگی جریان‌خوانی سطرخوانی جمله‌سازی بندبندی
      آراستگی پیگیری سنجیدگی انسجام هم‌نشینی
    `),
    advancedWords: words(`
      یادسپاری هماهنگی سازگاری پیچیدگی تنوع پایداری جمله‌پردازی نشانه‌خوانی پیوستگی ساختارمندی بازآرایی
      روان‌خوانی خوش‌آهنگی معناپردازی ساختاردهی جهت‌خوانی ظرافت‌پردازی پیوسته‌خوانی واژه‌آرایی
      انسجام‌بخشی ضرب‌آهنگ توازن‌بخشی
    `),
    realWords: words(`
      زمان خانه خیابان در میز آب باد کاغذ دست جهان شب صبح شهر پنجره مدرسه کار حافظه ریتم
      واژه خواندن نگاه روشنی عدد نشانه تمرین کنترل پل مسیر تعادل جریان متن جمله دفتر پاسخ
      حرکت مرحله کیفیت تمرکز آگاهی الگو سکوت دقت پیگیری بازبینی پیوند پاراگراف خوانایی
      نشانه‌گذاری واژگان همراهی پایداری هماهنگی پیوستگی
      آرامش روایت بند عبارت معنی لحن آراستگی چای باران پرده دیوار باغچه راهرو فنجان نامه
      صندلی فرش سایه ساحل شاخه موج کوچه میدان رهگذر بخار خاک گفت‌وگو تصویر اتاق
      پنجره‌باز نیم‌روشن خوش‌ریتم پیوسته روشنایی هم‌نشینی بازخوانی بازگشت‌نرم معناپذیری
      سطرخوانی روان‌خوانی خوش‌آهنگی آراسته طبیعی روزمره پیوسته‌خوانی همدلی اعتماد نفس
      سکوت صفحه روشن دیوار روشن راه کوتاه در چوبی
    `),
    phraseFragments: persianPremiumPhraseFragments,
    benchmarkSentences: persianPremiumBenchmarkSentences,
    sourceOrigins: {
      commonWords: [
        "NullKeys Persian supplemental lexicon additions for reading-like practice vocabulary",
      ],
      phraseDrills: [
        "NullKeys curated Persian phrase-drill clauses with explicit ZWNJ-aware orthography, everyday scene writing, and readable sentence rhythm",
      ],
      quoteDrills: [
        "NullKeys curated Persian benchmark passages built from local teacher-style passage templates, narrative scenes, and paired clauses",
      ],
    },
  },
  lithuanian: {
    realWords: words(`
      laikas namas gatve durys stalas vanduo vejas popierius ranka pasaulis vakaras rytas miestas langas
      mokykla darbas detale atmintis ritmas zodis skaitymas zvilgsnis aiskumas klaviatura skaicius signalas
      pratyba kontrole tiltas eiga
    `),
  },
  latvian: {
    realWords: words(`
      laiks maja iela durvis galds udens vejs papirs roka pasaule vakars rits pilseta logs skola darbs
      detalja atmina ritms vards lasisana skatiens skaidriba tastatura skaitlis signals vingrinajums kontrole tilts
    `),
  },
  hindi: {
    realWords: words(`
      समय घर सड़क दरवाजा मेज पानी हवा कागज हाथ दुनिया शाम सुबह शहर खिड़की स्कूल काम स्मृति लय
      शब्द पठन नजर स्पष्टता अंक संकेत अभ्यास नियंत्रण पुल प्रवाह चरण उत्तर ध्यान संतुलन गति रेखा
      अनुच्छेद क्रम धैर्य सुधार प्रगति
      परिवार मित्र कहानी रास्ता बाजार कार्यालय कमरा प्रकाश आंगन बगीचा आवाज मुस्कान चित्र रंग
      मौसम आकाश नदी पहाड़ गांव यात्रा स्टेशन संदेश कारण आकार ऊर्जा कदम विकल्प उद्देश्य प्रयास
      परिणाम भावना आशा आदत पाठ भाषा लेखन पाठक शिक्षक सेवा इतिहास संस्कृति भोजन फल फूल
      तैयारी कौशल गुणवत्ता स्थिरता परिवर्तन विराम तालमेल एकाग्रता अनुभव उदाहरण समाधान प्रश्न
      विचार जीवन हृदय समाज भविष्य वर्तमान अतीत सुबह दोपहर रात सप्ताह महीना वर्ष अभ्यासक्रम
      रचना संकेतक निरीक्षण प्रतिक्रिया पुनरावृत्ति नियंत्रणशीलता
    `),
  },
  thai: {
    realWords: words(`
      เวลา บ้าน ถนน ประตู โต๊ะ น้ำ ลม กระดาษ มือ โลก เย็น เช้า เมือง หน้าต่าง โรงเรียน งาน
      ความจำ จังหวะ คำ อ่าน มอง ชัดเจน ตัวเลข สัญญาณ ฝึก ควบคุม สะพาน การไหล สมดุล ประโยค
    `),
  },
} as const satisfies Record<string, SupplementalLanguageLexicon>;
