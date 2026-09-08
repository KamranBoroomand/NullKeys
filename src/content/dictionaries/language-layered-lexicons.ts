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
  return input.trim().split(/\s+/u).filter(Boolean);
}

function lines(input: string) {
  return input
    .trim()
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

export const supplementalLanguageLexicons = {
  english: {
    foundationalWords: words(`
      air area arise artist assist east enter entire learn learner letter linear listen near real reason
      reset retain sailor salt seat sister star start state still street tailor talent train trail tree
      clear calm close direct easier listen listenable read reader steady settle simple sound startle stillness
      book bridge chair day door field hill night river road room table
    `),
    developingWords: words(`
      balance clause contrast control crafted detail durable guided passage preview readable recovery rhythm signal
      spacing steadying structure support teacher timing transition variety wording workflow
      journey kitchen market station village weather
    `),
    advancedWords: words(`
      adaptability articulation benchmark breadth calibration coherence complexity expressiveness progression readability reinforcement
      sophistication structure-aware teacherlike transition-rich variation
    `),
    realWords: words(`
      accuracy adaptive benchmark cadence clarity cluster confidence control cooldown fluency focus hesitation keyboard
      learner lesson mastery naturalness novelty passage patience planner posture practice preview punctuation readable
      recovery repetition rhythm review spacing stability teacher teacherly timing transition unlock variation workflow
      breadth clause coherence contrast editorial fluency-guided language-aware learner-facing modulation pacing passagework
      progression realism scaffold sentence-shaped stagecraft structure teacherlike transition-rich variety-first vocabulary
      window garden letter paper morning kettle doorway lantern quiet street hallway rain shadow
    `),
    phraseFragments: lines(`
      warm light across the wooden table
      soft rain against the kitchen window
      a folded note beside the blue cup
      morning air through the open door
      the narrow street at quiet dusk
      a garden path beside the old wall
      two books beneath a reading lamp
      fresh bread cooling near the stove
      low clouds above the distant hills
      a bicycle resting by the gate
      clear water moving over smooth stones
      the last train beyond the bridge
      bright leaves after the summer rain
      a small boat near the harbor wall
      winter sunlight on the empty bench
      gentle waves along the sandy shore
      a red scarf over the chair
      distant bells ringing across the town square
      the shaded porch before noon
      quiet footsteps in the upstairs hall
      wild flowers beside the country road
      a silver key inside the drawer
      evening shadows under the tall trees
      a paper map spread across the counter
    `),
    benchmarkSentences: lines(`
      Warm light falls across the wooden table while the open window carries a cool breeze through the quiet room.
      Soft rain touches the kitchen window, and a small kettle begins to sing beside a row of blue cups.
      A folded note waits beside the lamp until the afternoon sun reaches the far edge of the desk.
      Morning air moves through the open door as two sparrows search the garden path for fallen seeds.
      The narrow street remains quiet at dusk, though a distant bicycle bell briefly echoes between the houses.
      Beyond the old stone wall, the garden path curves toward a bench under the tallest apple tree.
      Two books rest beneath the reading lamp, with a pressed leaf marking the final page of one volume.
      Fresh bread cools near the stove while the family sets bowls and glasses along the long kitchen table.
      Low clouds gather above the hills, but a thin line of sunlight still marks the road through the valley.
      A bicycle rests by the gate after a long ride along the river and through the neighboring fields.
      Clear water moves over smooth stones, carrying small leaves toward the wooden bridge downstream.
      The last train crosses the bridge as warm lights appear one by one in the windows below.
      Bright leaves cover the garden after the summer rain, and the air smells of wet soil and pine.
      A small boat waits near the harbor wall while gulls circle above the ropes and painted wooden crates.
      Winter sunlight reaches the empty bench, leaving a narrow golden shape across the frozen ground.
      Gentle waves roll along the sandy shore as the evening wind lifts a line of footprints from the beach.
      A red scarf hangs over the chair beside an open suitcase and a neatly folded paper map.
      Distant bells ring across the town square while shopkeepers close their doors and sweep the steps for the night.
    `),
    sourceOrigins: {
      commonWords: ["Repository-maintained English vocabulary grouped by difficulty"],
      phraseDrills: ["Repository-maintained English scene fragments; automated checks only"],
      quoteDrills: ["Repository-maintained English scene passages; automated checks only"],
    },
  },
  russian: {
    foundationalWords: words(`
      ритм темп строка слово пауза взгляд рука буква урок ход опора знак точка мост шаг линия текст мысль
      день ночь семья человек ребёнок друг книга тетрадь кухня стул шкаф пол потолок свет огонь земля
      небо солнце луна река озеро море берег лес поле холм дорога поезд лодка хлеб
    `),
    developingWords: words(`
      переход связка обзор абзац поворот чтение точность привычка движение контраст ориентир повтор маршрут внимание
      погода деревня площадь рынок магазин сосед встреча разговор вопрос решение начало конец выбор причина
      пример правило задача результат история картина музыка тепло холод направление расстояние
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
    phraseFragments: lines(`
      тёплый свет на деревянном столе
      тихий дождь за кухонным окном
      письмо рядом с синей чашкой
      утренний воздух из открытой двери
      узкая улица в спокойных сумерках
      садовая тропа у старой стены
      две книги под настольной лампой
      свежий хлеб возле тёплой печи
      низкие облака над дальними холмами
      велосипед у зелёных ворот
      прозрачная вода среди гладких камней
      последний поезд за длинным мостом
      яркие листья после летнего дождя
      маленькая лодка у каменного причала
      зимний свет на пустой скамейке
      спокойные волны вдоль песчаного берега
      красный шарф на спинке стула
      далёкий звон над городской площадью
      прохладная веранда перед полуднем
      тихие шаги в верхнем коридоре
      полевые цветы возле старой дороги
      серебряный ключ в нижнем ящике
      вечерние тени под высокими деревьями
      бумажная карта на длинном прилавке
    `),
    benchmarkSentences: lines(`
      Тёплый свет ложится на деревянный стол, пока из открытого окна в тихую комнату входит прохладный воздух.
      Дождь мягко касается кухонного окна, а маленький чайник начинает шуметь рядом с синими чашками.
      Сложенное письмо лежит возле лампы, а лучи дневного солнца медленно ползут к краю письменного стола.
      Через открытую дверь тянет утренней прохладой, а два воробья ищут семена на садовой дорожке.
      Узкая улица остаётся тихой в сумерках, хотя далёкий звонок велосипеда на миг звучит между домами.
      За старой каменной стеной садовая тропа поворачивает к скамейке под высокой яблоней.
      Две книги лежат под настольной лампой, а сухой лист отмечает последнюю страницу одного тома.
      Свежий хлеб остывает возле печи, пока семья расставляет миски и стаканы на длинном столе.
      Низкие облака собираются над холмами, но тонкая полоса света ещё освещает дорогу через долину.
      Велосипед стоит у ворот после долгой поездки вдоль реки и через соседние поля.
      Прозрачная вода течёт между гладкими камнями и несёт маленькие листья к деревянному мосту.
      Последний поезд проходит по мосту, когда в окнах внизу один за другим загораются тёплые огни.
      Яркие листья покрывают сад после летнего дождя, и в воздухе остаётся запах влажной земли.
      Маленькая лодка покачивается у каменного причала, пока чайки кружат над канатами и деревянными ящиками.
      Зимний свет ложится на пустую скамейку и оставляет узкую золотую полосу на холодной земле.
      Спокойные волны накатывают на берег, а вечерний ветер стирает цепочку следов на песке.
      Красный шарф висит на стуле рядом с открытым чемоданом и аккуратно сложенной картой.
      Далёкий звон разносится над площадью, пока владельцы лавок закрывают двери и подметают ступени.
    `),
    sourceOrigins: {
      commonWords: ["Repository-maintained Russian vocabulary grouped by difficulty"],
      phraseDrills: ["Repository-maintained Russian scene fragments; automated checks only"],
      quoteDrills: ["Repository-maintained Russian scene passages; automated checks only"],
    },
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
    phraseFragments: lines(`
      نور گرم روی میز چوبی
      باران آرام پشت پنجره آشپزخانه
      نامه تاخورده کنار فنجان آبی
      هوای صبح از در باز
      کوچه باریک در غروب آرام
      مسیر باغ کنار دیوار قدیمی
      دو کتاب زیر چراغ مطالعه
      نان تازه نزدیک اجاق گرم
      ابرهای کم‌ارتفاع بر فراز تپه‌های دور
      دوچرخه کنار دروازه سبز
      آب زلال میان سنگ‌های صاف
      آخرین قطار آن سوی پل بلند
      برگ‌های رنگارنگ پس از باران تابستان
      قایق کوچک کنار اسکله سنگی
      نور زمستان روی نیمکت خالی
      موج‌های آرام کنار ساحل شنی
      شال قرمز روی پشتی صندلی
      صدای زنگی دور در میدان شهر
      ایوان خنک پیش از نیمروز
      صدای پا در راهروی بالا
      گل‌های وحشی کنار جاده قدیمی
      کلید نقره‌ای در کشوی پایین
      سایه‌های عصر زیر درختان بلند
      نقشه کاغذی روی پیشخوان
    `),
    benchmarkSentences: lines(`
      نور گرم روی میز چوبی می‌افتد و از پنجره باز، هوای خنک وارد اتاق آرام می‌شود.
      باران نرم به پنجره آشپزخانه می‌خورد و کتری کوچک کنار فنجان‌های آبی به صدا درمی‌آید.
      نامه‌ای تاخورده کنار چراغ است و آفتاب بعدازظهر آرام‌آرام به لبه دیگر میز می‌رسد.
      هوای صبح از در باز می‌گذرد و دو گنجشک در مسیر باغ به دنبال دانه‌های افتاده می‌گردند.
      کوچه باریک در غروب آرام می‌ماند، هرچند صدای زنگ دوچرخه‌ای دور برای لحظه‌ای میان خانه‌ها می‌پیچد.
      پشت دیوار سنگی قدیمی، مسیر باغ به سوی نیمکتی زیر بلندترین درخت سیب می‌پیچد.
      دو کتاب زیر چراغ مطالعه قرار دارند و برگ خشکی لای صفحه آخر یکی از آن‌ها مانده است.
      نان تازه کنار اجاق خنک می‌شود و خانواده کاسه‌ها و لیوان‌ها را روی میز بلند می‌چیند.
      ابرهای کم‌ارتفاع بر فراز تپه‌ها جمع می‌شوند، اما خط باریکی از نور هنوز راه دره را روشن نگه می‌دارد.
      دوچرخه پس از پیمودن مسیری طولانی در کنار رودخانه و میان کشتزارهای همسایه، کنار دروازه مانده است.
      آب زلال از میان سنگ‌های صاف می‌گذرد و برگ‌های کوچک را به سوی پل چوبی می‌برد.
      آخرین قطار از روی پل می‌گذرد و چراغ پنجره‌های پایین یکی پس از دیگری روشن می‌شوند.
      برگ‌های رنگارنگ پس از باران تابستان باغ را پوشانده‌اند و بوی خاک خیس در هوا مانده است.
      قایق کوچک کنار اسکله سنگی آرام گرفته است و مرغ‌های دریایی بالای طناب‌ها و جعبه‌های چوبی می‌چرخند.
      نور زمستان روی نیمکت خالی می‌افتد و خطی طلایی روی زمین سرد باقی می‌گذارد.
      موج‌های آرام کنار ساحل شنی پیش می‌آیند و باد عصر رد پاها را کم‌کم از روی شن پاک می‌کند.
      شال قرمز روی صندلی افتاده است و کنار آن، چمدان باز و نقشه‌ای مرتب دیده می‌شود.
      صدای زنگی دور در میدان می‌پیچد و مغازه‌داران درها را می‌بندند و پله‌ها را برای شب جارو می‌کنند.
    `),
    sourceOrigins: {
      commonWords: ["Repository-maintained Persian vocabulary grouped by difficulty"],
      phraseDrills: ["Repository-maintained Persian scene fragments; automated checks only"],
      quoteDrills: ["Repository-maintained Persian scene passages; automated checks only"],
    },
  },
} as const satisfies Record<string, SupplementalLanguageLexicon>;
