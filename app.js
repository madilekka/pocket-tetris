(function(){
  "use strict";
  // The rules live in server/engine.js, which the server also runs to replay DAILY games.
  var Engine=window.PocketEngine;
  var COLS=Engine.COLS, ROWS=Engine.ROWS;
  var CELL=16;
  function $(id){ return document.getElementById(id); }
  var boardCv=$('board'), bctx=boardCv.getContext('2d');
  var nextCv=$('next'), nctx=nextCv.getContext('2d');
  var holdCv=$('hold'), hctx=holdCv.getContext('2d');
  var toastEl=$('toast'), overlay=$('overlay'), overlayTitle=$('overlayTitle'), overlaySub=$('overlaySub'), overlayStats=$('overlayStats');
  var linesVal=$('linesVal'), levelVal=$('levelVal'), scoreVal=$('scoreVal'), topVal=$('topVal'), topLabel=$('topLabel');
  var timePanel=$('timePanel'), timeVal=$('timeVal'), lvBar=$('lvBar'), lvLeft=$('lvLeft');
  var menuEl=$('menu'), modeValEl=$('modeVal'), modeHintEl=$('modeHint'), levelSelEl=$('levelSel');
  var menuRows=[$('rowMode'), $('rowLevel'), $('rowColor')];
  var colorValEl=$('colorVal'), colorHintEl=$('colorHint'), optCapEl=$('optCap');
  var levelLabel=$('levelLabel'), scoreLabel=$('scoreLabel'), timeLabel=$('timeLabel'), lvWrap=$('lvWrap'), goalText=$('goalText');
  var restartBtn=$('restartBtn'), hintPill=$('hintPill'), hintRetryBtn=$('hintRetryBtn');
  var pauseMenuEl=$('pauseMenu'), resumeBtn=$('resumeBtn'), quitBtn=$('quitBtn'), overlayPrompt=$('overlayPrompt');
  var startPill=$('startPill'), startLabel=$('startLabel'), shareRow=$('shareRow'), shareBtn=$('shareBtn'), topBtn=$('topBtn');
  var topPanel=$('topPanel'), topText=$('topText'), topList=$('topList'), nameInput=$('nameInput');
  var topMain=$('topMain'), topAlt=$('topAlt'), topWeek=$('topWeek'), topBack=$('topBack'), chBtn=$('chBtn');
  var muteBtn=$('muteBtn'), langBtn=$('langBtn'), powerLed=$('powerLed');
  var consoleEl=$('console'), fitEl=$('fit'), belowEl=$('below'), screenEl=$('screen');
  var installBtn=$('installBtn'), iosHint=$('iosHint');

  var lvCells=[];
  for(var li=0;li<10;li++){ var cellEl=document.createElement('i'); lvBar.appendChild(cellEl); lvCells.push(cellEl); }

  /* ---------------- language ---------------- */
  // Every word the player sees, in Russian and English. The game starts in Russian on phones set to Russian
  // (or another language of the region) and in English elsewhere; the RU/EN button switches it.
  var TEXT={
    ru:{
      'mode.marathon':'МАРАФОН', 'mode.sprint':'40 ЛИНИЙ', 'mode.dig':'РАСКОПКИ', 'mode.ultra':'НА ВРЕМЯ', 'mode.daily':'ИСПЫТАНИЕ ДНЯ', 'mode.puzzle':'ГОЛОВОЛОМКИ', 'mode.battle':'БИТВА',
      'hint.marathon':'ИГРАЙ, ПОКА НЕ ЗАПОЛНИТСЯ ПОЛЕ', 'hint.dig':'ПРОКОПАЙСЯ ДО ДНА КАК МОЖНО БЫСТРЕЕ', 'hint.sprint':'СОБЕРИ 40 ЛИНИЙ КАК МОЖНО БЫСТРЕЕ', 'hint.ultra':'НАБЕРИ БОЛЬШЕ ОЧКОВ ЗА ВРЕМЯ',
      'hint.daily':'{0} - У ВСЕХ ОДИНАКОВЫЕ ФИГУРЫ', 'hint.puzzle':'ОЧИСТИ ПОЛЕ, ФИГУРЫ НЕ ПАДАЮТ САМИ', 'hint.battle':'ОНЛАЙН ПРОТИВ ДРУГА',
      'skin.classic':'КЛАССИКА', 'skin.purple':'ФИОЛЕТОВЫЙ', 'skin.teal':'БИРЮЗОВЫЙ', 'skin.yellow':'ЖЁЛТЫЙ', 'skin.red':'КРАСНЫЙ', 'skin.black':'ЧЁРНЫЙ', 'skin.gold':'ЗОЛОТОЙ',
      'how.purple':'ОТКРОЕТСЯ ЗА ПЕРВЫЙ ТЕТРИС (4 ЛИНИИ РАЗОМ)', 'how.teal':'ОТКРОЕТСЯ ЗА СЕРИЮ X3', 'how.yellow':'ОТКРОЕТСЯ, КОГДА ПРОЙДЁШЬ 40 ЛИНИЙ',
      'how.red':'ОТКРОЕТСЯ, КОГДА ДОИГРАЕШЬ ИСПЫТАНИЕ ДНЯ', 'how.black':'ОТКРОЕТСЯ ЗА 100 ЛИНИЙ В МАРАФОНЕ', 'how.gold':'ОТКРОЕТСЯ ЗА 50 000 ОЧКОВ',
      newColor:'НОВЫЙ ЦВЕТ!\n{0}',
      clear1:'1 ЛИНИЯ', clear2:'2 ЛИНИИ', clear3:'3 ЛИНИИ', clear4:'ТЕТРИС!', b2b:'ТЕТРИС ПОДРЯД', combo:'СЕРИЯ x{0}', sent:'СОПЕРНИКУ +{0}',
      lines:'ЛИНИИ', clearAll:'ОЧИСТИ ПОЛЕ', vsFriend:'ПРОТИВ ДРУГА', incomingBar:'МУСОР +{0}', incoming:'МУСОР +{0}',
      lblHold:'ЗАПАС', lblNext:'ДАЛЕЕ', lblRival:'СОПЕРНИК', lblLevel:'УРОВЕНЬ', lblScore:'ОЧКИ', lblTime:'ВРЕМЯ', lblTop:'РЕКОРД', lblBest:'ЛУЧШЕЕ',
      lblPuzzle:'УРОВЕНЬ', lblPieces:'ФИГУРЫ', lblQueue:'ОЧЕРЕДЬ', lblSolved:'РЕШЕНО',
      sound0:'МУЗЫКА 1\nКОРОБЕЙНИКИ', sound1:'МУЗЫКА 2\nМЕНУЭТ', sound2:'МУЗЫКА 3\nПЕЩЕРА ГОРНОГО КОРОЛЯ', sound3:'БЕЗ МУЗЫКИ\nЗВУКИ ВКЛЮЧЕНЫ', sound4:'ЗВУК ВЫКЛЮЧЕН',
      pillStart:'СТАРТ', pillPause:'ПАУЗА', pillResume:'ДАЛЬШЕ', pillHold:'ЗАПАС', ariaStart:'Старт', ariaPause:'Пауза', ariaResume:'Продолжить',
      pressStart:'НАЖМИ СТАРТ', puzzleStart:'УРОВЕНЬ {0}\n{1}', clearBoard:'ОЧИСТИ ПОЛЕ',
      youWin:'ПОБЕДА!', youLose:'ПОРАЖЕНИЕ', gameOver:'КОНЕЦ ИГРЫ', complete:'ГОТОВО!', solvedTitle:'РЕШЕНО!', outOfPieces:'ФИГУРЫ КОНЧИЛИСЬ',
      timeUp:'ВРЕМЯ ВЫШЛО', dailyTitle:'ИСПЫТАНИЕ {0}', subTime:'ВРЕМЯ {0}', subScore:'ОЧКИ {0}', subPuzzle:'УРОВЕНЬ {0}',
      nextPuzzle:'СТАРТ - СЛЕДУЮЩИЙ УРОВЕНЬ', allSolved:'ВСЕ ГОЛОВОЛОМКИ РЕШЕНЫ!', tryAgain:'СТАРТ - ЕЩЁ РАЗ',
      newRecord:'НОВЫЙ РЕКОРД', bestToday:'ЛУЧШИЙ ЗА ДЕНЬ', place:'МЕСТО {0} ИЗ {1}',
      copied:'СКОПИРОВАНО', cannotShare:'НЕ ПОЛУЧИЛОСЬ', linkCopied:'ССЫЛКА СКОПИРОВАНА',
      cardDaily:'ИСПЫТАНИЕ {0}', cardUltra:'НА ВРЕМЯ, {0} МИН', cardMarathon:'МАРАФОН', cardSprint:'40 ЛИНИЙ', cardPuzzle:'ГОЛОВОЛОМКА {0}',
      cardScore:'ОЧКИ', cardLines:'ЛИНИИ', cardLevel:'УРОВЕНЬ', cardPlace:'МЕСТО', cardTime:'ВРЕМЯ', cardResult:'ИТОГ', cardPieces:'ФИГУРЫ',
      cardSolved:'РЕШЕНО!', cardOf:'{0} ИЗ {1}',
      shareSprintDone:'Pocket Tetris: собрал 40 линий за {0}! Сможешь быстрее?', shareSprint:'Pocket Tetris: собрал {0} из 40 линий. Попробуй пройти все!',
      sharePuzzle:'Pocket Tetris: решил головоломку {0}! Сможешь очистить поле?',
      shareDaily:'Pocket Tetris, испытание дня {0}: {1} очков!{2} Сегодня у всех одинаковые фигуры — сможешь больше?', shareDailyRank:' Я на {0}-м месте из {1}.',
      shareUltra:'Pocket Tetris, {0} минут: {1} очков! Сможешь больше?', shareMarathon:'Pocket Tetris, марафон: {0} очков и {1} линий! Сможешь больше?',
      invite:'Сыграем в Pocket Tetris один на один? Комната {0}:',
      capMode:'РЕЖИМ', capStart:'С КАКОГО УРОВНЯ НАЧАТЬ', capLength:'СКОЛЬКО ИГРАТЬ', capRoom:'КОМНАТА', capPuzzle:'УРОВЕНЬ - РЕШЕНО {0} ИЗ {1}', capColor:'ЦВЕТ КОНСОЛИ',
      unlocked:'ОТКРЫТО {0} ИЗ {1}', selLevel:'УРОВЕНЬ {0}', selMinutes:'{0} МИНУТ', selPuzzle:'УРОВЕНЬ {0}', roomNew:'НОВАЯ КОМНАТА', roomJoin:'ВОЙТИ ПО КОДУ',
      pause:'ПАУЗА', 'continue':'ПРОДОЛЖИТЬ', restart:'ЗАНОВО', quit:'В МЕНЮ', hint:'ПОДСКАЗКА',
      shareResult:'ПОДЕЛИТЬСЯ', dailyTop:'РЕКОРДЫ ДНЯ',
      battleTitle:'БИТВА', roomTitle:'КОМНАТА {0}', joinTitle:'ВХОД В КОМНАТУ', inviteFriend:'ПОЗВАТЬ ДРУГА', leave:'ВЫЙТИ', ready:'ГОТОВ', rematch:'РЕВАНШ',
      join:'ВОЙТИ', back:'НАЗАД', cancel:'ОТМЕНА',
      bFriendLeftRoom:'ДРУГ ВЫШЕЛ ИЗ КОМНАТЫ', bWaitRematch:'ЖДЁМ, КОГДА ДРУГ\nНАЖМЁТ «РЕВАНШ»', bWantsRematch:'ДРУГ ХОЧЕТ РЕВАНШ!', bAgain:'СЫГРАЕМ ЕЩЁ?',
      bWaitFriend:'ЖДЁМ ДРУГА...\nОТПРАВЬ ЕМУ ПРИГЛАШЕНИЕ\nИЛИ КОД {0}', bYouReady:'ТЫ ГОТОВ!\nЖДЁМ, КОГДА ДРУГ\nНАЖМЁТ «ГОТОВ»',
      bFriendReady:'ДРУГ ГОТОВ!', bFriendHere:'ДРУГ В КОМНАТЕ!', bPressReady:'НАЖМИ «ГОТОВ», КОГДА ГОТОВ',
      bConnecting:'ПОДКЛЮЧАЕМСЯ К СЕРВЕРУ...\nПЕРВЫЙ РАЗ ЗА ДЕНЬ\nЭТО ЗАЙМЁТ ДО МИНУТЫ', bTooMany:'СЛИШКОМ МНОГО КОМНАТ.\nПОДОЖДИ НЕСКОЛЬКО МИНУТ',
      bNoServer:'НЕ УДАЛОСЬ СВЯЗАТЬСЯ\nС СЕРВЕРОМ. ПРОВЕРЬ ИНТЕРНЕТ', bEnterCode:'ВВЕДИ КОД КОМНАТЫ\nИЗ 4 ЦИФР', bNeed4:'НУЖНО 4 ЦИФРЫ',
      bJoining:'ПОДКЛЮЧАЕМСЯ...\nЭТО ЗАЙМЁТ ДО МИНУТЫ', bRoomTaken:'КОМНАТА {0}\nУЖЕ ЗАНЯТА', bRoomMissing:'КОМНАТА {0}\nНЕ НАЙДЕНА',
      bFriendQuit:'ДРУГ ВЫШЕЛ ИЗ ИГРЫ', bConnLost:'СВЯЗЬ ПОТЕРЯНА', bRoomLost:'СВЯЗЬ С КОМНАТОЙ\nПОТЕРЯНА', bResumeIn:'ИГРА ПРОДОЛЖИТСЯ\nЧЕРЕЗ {0}',
      bRivalGone:'СОПЕРНИК ПРОПАЛ', bAway:'ТЫ ДОЛГО БЫЛ\nВНЕ ИГРЫ', bRivalLost:'СОПЕРНИК ПРОИГРАЛ', bYourConn:'ТВОЯ СВЯЗЬ ПРОПАЛА', go:'ВПЕРЁД!',
      topTitle:'РЕКОРДЫ {0}', play:'ИГРАТЬ', myName:'МОЁ ИМЯ', save:'СОХРАНИТЬ', haveCode:'У МЕНЯ ЕСТЬ КОД', restore:'ВОССТАНОВИТЬ', changeName:'СМЕНИТЬ ИМЯ', retry:'ПОВТОРИТЬ',
      tLoading:'ЗАГРУЖАЕМ...\nПЕРВЫЙ РАЗ ЗА ДЕНЬ\nЭТО ЗАЙМЁТ ДО МИНУТЫ', tNoServer:'НЕ УДАЛОСЬ СВЯЗАТЬСЯ\nС СЕРВЕРОМ. ПРОВЕРЬ ИНТЕРНЕТ',
      tAskName:'ИМЯ ДЛЯ ТАБЛИЦЫ РЕКОРДОВ\nДО 10 БУКВ И ЦИФР', tAskCode:'КОД ВОССТАНОВЛЕНИЯ\nСО СТАРОГО ТЕЛЕФОНА',
      tProfile:'ИМЯ: {0}\n\nКОД ВОССТАНОВЛЕНИЯ:\n{1}\n\nЗАПИШИ ЕГО: С НИМ ИМЯ\nВЕРНЁТСЯ НА ДРУГОМ ТЕЛЕФОНЕ.\nНИКОМУ ЕГО НЕ ПОКАЗЫВАЙ',
      tNobody:'СЕГОДНЯ ЕЩЁ НИКТО НЕ ИГРАЛ.\nБУДЬ ПЕРВЫМ!', tPlayers:'ИГРОКОВ СЕГОДНЯ: {0}', tPlayToJoin:'СЫГРАЙ, ЧТОБЫ ПОПАСТЬ В СПИСОК',
      tUpdate:'ОБНОВИ СТРАНИЦУ, ЧТОБЫ\nРЕЗУЛЬТАТ ПОПАЛ В СПИСОК', tNameLost:'ИМЯ {0} УЖЕ ЗАНЯТО,\nВЫБЕРИ ДРУГОЕ', tNameTaken:'ИМЯ {0} УЖЕ ЗАНЯТО',
      tBadName:'ТОЛЬКО БУКВЫ И ЦИФРЫ,\nДО 10 ЗНАКОВ', tBadCode:'В КОДЕ 16 ЗНАКОВ:\nЦИФРЫ И БУКВЫ A-F', tNoCode:'ТАКОЙ КОД НЕ НАЙДЕН',
      ariaCode:'Код восстановления', ariaName:'Имя в таблице рекордов',
      hintOn:'ПОДСКАЗКА:\nСТАВЬ ФИГУРУ\nНА ПОДСВЕТКУ', hintHold:'НАЖМИ «ЗАПАС»', hintOff:'ФИГУРА НЕ ТАМ -\nПОДСКАЗКА ВЫКЛЮЧЕНА', hintSpent:'ПОДСКАЗКА ДЛЯ ЭТОГО\nУРОВНЯ УЖЕ БЫЛА', ariaHint:'Подсказка: показать, куда ставить фигуры',
      cardDig:'РАСКОПКИ', cardRows:'РЯДЫ', digLeftSub:'РЯДОВ МУСОРА ОСТАЛОСЬ: {0}', sprintSub:'ЛИНИЙ: {0} ИЗ 40',
      shareDigDone:'Pocket Tetris: раскопал {0} рядов мусора за {1}! Сможешь быстрее?', shareDig:'Pocket Tetris: раскопал {0} из {1} рядов мусора. Попробуй до самого дна!',
      streak:'СЕРИЯ: {0} {1} ПОДРЯД', weekTitle:'НЕДЕЛЯ {0}', byWeek:'ЗА НЕДЕЛЮ', byDay:'ЗА ДЕНЬ',
      tNobodyWeek:'НА ЭТОЙ НЕДЕЛЕ ЕЩЁ\nНИКТО НЕ ИГРАЛ. БУДЬ ПЕРВЫМ!', tPlayersWeek:'ИГРОКОВ ЗА НЕДЕЛЮ: {0}\nЛУЧШИЕ ОЧКИ КАЖДОГО ДНЯ\nСКЛАДЫВАЮТСЯ',
      nameTitle:'ИМЯ ИГРОКА', toMenu:'В МЕНЮ', restored:'ПРОГРЕСС ВОССТАНОВЛЕН',
      chBtn:'ВЫЗОВ ДРУГУ', chTitle:'ВЫЗОВ', chMaking:'ГОТОВИМ ВЫЗОВ...',
      chReady:'ВЫЗОВ ГОТОВ!\nДРУГ СЫГРАЕТ ТЕМИ ЖЕ ФИГУРАМИ.\nОТКРОЙ ЭТУ ССЫЛКУ ПОЗЖЕ,\nЧТОБЫ УВИДЕТЬ ЕГО РЕЗУЛЬТАТ', chSend:'ОТПРАВИТЬ',
      chFrom:'{0} ВЫЗЫВАЕТ ТЕБЯ!\n{1}\nФИГУРЫ ТЕ ЖЕ, ЧТО У НЕГО', chWin:'ТЫ ВПЕРЕДИ ВСЕХ!', chAlone:'ПОКА СЫГРАЛ ТОЛЬКО ТЫ', chPlace:'ТЫ НА {0}-М МЕСТЕ ИЗ {1}',
      chPlay:'ИГРАТЬ', chAgain:'ЕЩЁ РАЗ', chSendMore:'ПОЗВАТЬ ЕЩЁ', chOld:'ЭТОТ ВЫЗОВ ИЗ СТАРОЙ\nВЕРСИИ ИГРЫ, СЫГРАТЬ\nЕГО УЖЕ НЕЛЬЗЯ',
      chMissing:'ВЫЗОВ НЕ НАЙДЕН.\nССЫЛКИ ЖИВУТ ДВЕ НЕДЕЛИ', chMarathon:'МАРАФОН С УРОВНЯ {0}', chUltra:'НА ВРЕМЯ, {0} МИНУТ',
      chShareText:'Pocket Tetris: вызываю тебя! {0}, мой результат — {1}. Фигуры будут те же — сможешь лучше?',
      langName:'РУССКИЙ', install:'Установить как приложение',
      iosHint:'Установка на iPhone: нажми <b>•••</b> или значок «Поделиться» (квадрат со стрелкой вверх) &rarr; <b>На экран «Домой»</b>',
      ariaSound:'Звук', ariaLang:'Язык: русский. Нажми, чтобы переключить на английский', ariaPrevMode:'Предыдущий режим', ariaNextMode:'Следующий режим',
      ariaLess:'Меньше', ariaMore:'Больше', ariaPrevColor:'Предыдущий цвет консоли', ariaNextColor:'Следующий цвет консоли', ariaRoom:'Код комнаты',
      ariaLeft:'Влево', ariaRight:'Вправо', ariaDrop:'Сбросить вниз', ariaSoft:'Опустить ниже', ariaCcw:'Повернуть против часовой', ariaCw:'Повернуть по часовой',
      ariaHold:'Отложить фигуру в запас'
    },
    en:{
      'mode.marathon':'MARATHON', 'mode.sprint':'40 LINES', 'mode.dig':'DIG', 'mode.ultra':'TIME ATTACK', 'mode.daily':'DAILY', 'mode.puzzle':'PUZZLES', 'mode.battle':'BATTLE',
      'hint.marathon':'PLAY UNTIL THE BOARD FILLS UP', 'hint.dig':'DIG DOWN TO THE FLOOR AS FAST AS YOU CAN', 'hint.sprint':'CLEAR 40 LINES AS FAST AS YOU CAN', 'hint.ultra':'SCORE AS MUCH AS YOU CAN IN TIME',
      'hint.daily':'{0} - SAME PIECES FOR EVERYONE', 'hint.puzzle':'CLEAR THE BOARD, PIECES DON\'T FALL', 'hint.battle':'ONLINE AGAINST A FRIEND',
      'skin.classic':'CLASSIC', 'skin.purple':'PURPLE', 'skin.teal':'TEAL', 'skin.yellow':'YELLOW', 'skin.red':'RED', 'skin.black':'BLACK', 'skin.gold':'GOLD',
      'how.purple':'UNLOCKS WITH YOUR FIRST TETRIS (4 LINES)', 'how.teal':'UNLOCKS WITH A COMBO X3', 'how.yellow':'UNLOCKS WHEN YOU FINISH 40 LINES',
      'how.red':'UNLOCKS WHEN YOU FINISH A DAILY', 'how.black':'UNLOCKS WITH 100 LINES IN MARATHON', 'how.gold':'UNLOCKS AT 50 000 POINTS',
      newColor:'NEW COLOR!\n{0}',
      clear1:'SINGLE', clear2:'DOUBLE', clear3:'TRIPLE', clear4:'TETRIS', b2b:'BACK-TO-BACK', combo:'COMBO x{0}', sent:'SENT {0}',
      lines:'LINES', clearAll:'CLEAR ALL', vsFriend:'VS FRIEND', incomingBar:'INCOMING {0}', incoming:'INCOMING {0}',
      lblHold:'HOLD', lblNext:'NEXT', lblRival:'RIVAL', lblLevel:'LEVEL', lblScore:'SCORE', lblTime:'TIME', lblTop:'TOP', lblBest:'BEST',
      lblPuzzle:'PUZZLE', lblPieces:'PIECES', lblQueue:'QUEUE', lblSolved:'SOLVED',
      sound0:'MUSIC 1\nKOROBEINIKI', sound1:'MUSIC 2\nMINUET', sound2:'MUSIC 3\nMOUNTAIN KING', sound3:'NO MUSIC\nSOUNDS ON', sound4:'SOUND OFF',
      pillStart:'START', pillPause:'PAUSE', pillResume:'RESUME', pillHold:'HOLD', ariaStart:'Start', ariaPause:'Pause', ariaResume:'Resume',
      pressStart:'PRESS START', puzzleStart:'PUZZLE {0}\n{1}', clearBoard:'CLEAR THE BOARD',
      youWin:'YOU WIN!', youLose:'YOU LOSE', gameOver:'GAME OVER', complete:'COMPLETE', solvedTitle:'SOLVED!', outOfPieces:'OUT OF PIECES',
      timeUp:'TIME UP', dailyTitle:'DAILY {0}', subTime:'TIME {0}', subScore:'SCORE {0}', subPuzzle:'PUZZLE {0}',
      nextPuzzle:'START: NEXT PUZZLE', allSolved:'ALL PUZZLES SOLVED!', tryAgain:'START: TRY AGAIN',
      newRecord:'NEW RECORD', bestToday:'BEST TODAY', place:'PLACE {0} OF {1}',
      copied:'COPIED', cannotShare:'CANNOT SHARE', linkCopied:'LINK COPIED',
      cardDaily:'DAILY {0}', cardUltra:'TIME ATTACK {0} MIN', cardMarathon:'MARATHON', cardSprint:'40 LINES', cardPuzzle:'PUZZLE {0}',
      cardScore:'SCORE', cardLines:'LINES', cardLevel:'LEVEL', cardPlace:'PLACE', cardTime:'TIME', cardResult:'RESULT', cardPieces:'PIECES',
      cardSolved:'SOLVED!', cardOf:'{0} OF {1}',
      shareSprintDone:'Pocket Tetris: 40 lines in {0}! Can you be faster?', shareSprint:'Pocket Tetris: {0} of 40 lines. Try to clear them all!',
      sharePuzzle:'Pocket Tetris: I solved puzzle {0}! Can you clear the board?',
      shareDaily:'Pocket Tetris, daily challenge {0}: {1} points!{2} Everyone gets the same pieces today — can you beat it?', shareDailyRank:' I\'m number {0} of {1}.',
      shareUltra:'Pocket Tetris, {0} minutes: {1} points! Can you beat it?', shareMarathon:'Pocket Tetris, marathon: {0} points and {1} lines! Can you beat it?',
      invite:'Play Pocket Tetris one on one? Room {0}:',
      capMode:'MODE', capStart:'START LEVEL', capLength:'LENGTH', capRoom:'ROOM', capPuzzle:'LEVEL - SOLVED {0} OF {1}', capColor:'CONSOLE COLOR',
      unlocked:'UNLOCKED {0} OF {1}', selLevel:'LEVEL {0}', selMinutes:'{0} MINUTES', selPuzzle:'PUZZLE {0}', roomNew:'NEW ROOM', roomJoin:'JOIN ROOM',
      pause:'PAUSE', 'continue':'CONTINUE', restart:'RESTART', quit:'QUIT TO MENU', hint:'HINT',
      shareResult:'SHARE RESULT', dailyTop:'DAILY TOP',
      battleTitle:'BATTLE', roomTitle:'ROOM {0}', joinTitle:'JOIN ROOM', inviteFriend:'INVITE FRIEND', leave:'LEAVE', ready:'READY', rematch:'REMATCH',
      join:'JOIN', back:'BACK', cancel:'CANCEL',
      bFriendLeftRoom:'YOUR FRIEND LEFT THE ROOM', bWaitRematch:'WAITING FOR YOUR FRIEND\nTO PRESS REMATCH', bWantsRematch:'YOUR FRIEND WANTS A REMATCH!', bAgain:'PLAY AGAIN?',
      bWaitFriend:'WAITING FOR A FRIEND...\nSEND AN INVITE\nOR THE CODE {0}', bYouReady:'YOU ARE READY!\nWAITING FOR YOUR FRIEND\nTO PRESS READY',
      bFriendReady:'YOUR FRIEND IS READY!', bFriendHere:'YOUR FRIEND IS HERE!', bPressReady:'PRESS READY WHEN YOU ARE',
      bConnecting:'CONNECTING TO THE SERVER...\nTHE FIRST TIME TODAY\nTAKES UP TO A MINUTE', bTooMany:'TOO MANY ROOMS.\nWAIT A FEW MINUTES',
      bNoServer:'CANNOT REACH THE SERVER.\nCHECK THE INTERNET', bEnterCode:'ENTER THE 4-DIGIT\nROOM CODE', bNeed4:'IT NEEDS 4 DIGITS',
      bJoining:'CONNECTING...\nTAKES UP TO A MINUTE', bRoomTaken:'ROOM {0}\nIS FULL', bRoomMissing:'ROOM {0}\nNOT FOUND',
      bFriendQuit:'YOUR FRIEND LEFT THE GAME', bConnLost:'CONNECTION LOST', bRoomLost:'LOST THE CONNECTION\nTO THE ROOM', bResumeIn:'RESUMING\nIN {0}',
      bRivalGone:'YOUR RIVAL VANISHED', bAway:'YOU WERE AWAY\nTOO LONG', bRivalLost:'YOUR RIVAL LOST', bYourConn:'YOUR CONNECTION DROPPED', go:'GO!',
      topTitle:'DAILY {0}', play:'PLAY', myName:'MY NAME', save:'SAVE', haveCode:'I HAVE A CODE', restore:'RESTORE', changeName:'CHANGE NAME', retry:'RETRY',
      tLoading:'LOADING...\nTHE FIRST TIME TODAY\nTAKES UP TO A MINUTE', tNoServer:'CANNOT REACH THE SERVER.\nCHECK THE INTERNET',
      tAskName:'YOUR NAME FOR THE DAILY TOP\nUP TO 10 LETTERS AND DIGITS', tAskCode:'RECOVERY CODE\nFROM YOUR OLD PHONE',
      tProfile:'NAME: {0}\n\nRECOVERY CODE:\n{1}\n\nWRITE IT DOWN: IT BRINGS YOUR\nNAME BACK ON ANOTHER PHONE.\nDON\'T SHOW IT TO ANYONE',
      tNobody:'NOBODY HAS PLAYED TODAY.\nBE THE FIRST!', tPlayers:'PLAYERS TODAY: {0}', tPlayToJoin:'PLAY TO GET ON THE LIST',
      tUpdate:'RELOAD THE PAGE TO GET\nYOUR SCORE ON THE LIST', tNameLost:'THE NAME {0} IS TAKEN,\nPICK ANOTHER', tNameTaken:'THE NAME {0} IS TAKEN',
      tBadName:'ONLY LETTERS AND DIGITS,\nUP TO 10', tBadCode:'THE CODE HAS 16 CHARACTERS:\nDIGITS AND LETTERS A-F', tNoCode:'NO SUCH CODE',
      ariaCode:'Recovery code', ariaName:'Name for the daily top',
      hintOn:'HINT: PUT THE\nPIECE ON THE\nMARKED CELLS', hintHold:'PRESS HOLD', hintOff:'OFF THE PLAN -\nTHE HINT IS OFF', hintSpent:'NO HINT LEFT\nFOR THIS LEVEL', ariaHint:'Hint: show where the pieces go',
      cardDig:'DIG', cardRows:'ROWS', digLeftSub:'GARBAGE ROWS LEFT: {0}', sprintSub:'LINES: {0} OF 40',
      shareDigDone:'Pocket Tetris: dug through {0} rows of garbage in {1}! Can you be faster?', shareDig:'Pocket Tetris: dug {0} of {1} rows of garbage. Try to reach the floor!',
      streak:'STREAK: {0} {1} IN A ROW', weekTitle:'WEEK {0}', byWeek:'THIS WEEK', byDay:'TODAY',
      tNobodyWeek:'NOBODY HAS PLAYED THIS\nWEEK YET. BE THE FIRST!', tPlayersWeek:'PLAYERS THIS WEEK: {0}\nEVERY DAY\'S BEST SCORE\nADDS UP',
      nameTitle:'PLAYER NAME', toMenu:'TO THE MENU', restored:'PROGRESS RESTORED',
      chBtn:'CHALLENGE A FRIEND', chTitle:'CHALLENGE', chMaking:'PREPARING THE CHALLENGE...',
      chReady:'THE CHALLENGE IS READY!\nYOUR FRIEND GETS THE SAME\nPIECES. OPEN THIS LINK LATER\nTO SEE HOW THEY DID', chSend:'SEND',
      chFrom:'{0} CHALLENGES YOU!\n{1}\nTHE SAME PIECES AS THEIRS', chWin:'YOU ARE AHEAD OF EVERYONE!', chAlone:'SO FAR ONLY YOU PLAYED', chPlace:'YOU ARE {0} OF {1}',
      chPlay:'PLAY', chAgain:'AGAIN', chSendMore:'INVITE MORE', chOld:'THIS CHALLENGE IS FROM AN\nOLDER VERSION OF THE GAME\nAND CAN\'T BE PLAYED',
      chMissing:'CHALLENGE NOT FOUND.\nLINKS LAST TWO WEEKS', chMarathon:'MARATHON FROM LEVEL {0}', chUltra:'TIME ATTACK, {0} MINUTES',
      chShareText:'Pocket Tetris: I challenge you! {0}, my result is {1}. You get the same pieces — can you beat it?',
      langName:'ENGLISH', install:'Install as an app',
      iosHint:'To install on iPhone: tap <b>•••</b> or the Share icon (a square with an up arrow) &rarr; <b>Add to Home Screen</b>',
      ariaSound:'Sound', ariaLang:'Language: English. Tap to switch to Russian', ariaPrevMode:'Previous mode', ariaNextMode:'Next mode',
      ariaLess:'Less', ariaMore:'More', ariaPrevColor:'Previous console color', ariaNextColor:'Next console color', ariaRoom:'Room code',
      ariaLeft:'Left', ariaRight:'Right', ariaDrop:'Drop', ariaSoft:'Move down', ariaCcw:'Rotate counterclockwise', ariaCw:'Rotate clockwise',
      ariaHold:'Hold the piece'
    }
  };
  // Level tips come from puzzles.js in English.
  var RU_TIPS={'SOFT DROP,\nTHEN SLIDE\nUNDER THE LEDGE':'ОПУСТИ ФИГУРУ\nИ ЗАДВИНЬ ЕЁ\nПОД НАВЕС'};
  var lang=readStore('pocket-tetris-lang');
  if(lang!=='ru' && lang!=='en') lang = /^(ru|kk|uk|be|ky|uz|tg|az|hy)\b/i.test(navigator.language||'') ? 'ru' : 'en';
  // t('key', a, b) fills {0}, {1} in the text.
  function t(key){
    var s=TEXT[lang][key];
    if(s===undefined) s=TEXT.en[key];
    if(s===undefined) return String(key);
    for(var i=1;i<arguments.length;i++) s=s.split('{'+(i-1)+'}').join(String(arguments[i]));
    return s;
  }
  function tipText(tip){ return lang==='ru' && RU_TIPS[tip] || tip; }
  // Fixed texts in index.html carry their key in data-t (text) or data-ta (aria-label).
  function applyLang(){
    document.documentElement.lang=lang;
    Array.prototype.forEach.call(document.querySelectorAll('[data-t]'), function(el){ el.textContent=t(el.getAttribute('data-t')); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-ta]'), function(el){ el.setAttribute('aria-label', t(el.getAttribute('data-ta'))); });
    iosHint.innerHTML=t('iosHint');
    langBtn.textContent = lang==='ru' ? 'RU' : 'EN';
  }
  function switchLang(){
    lang = lang==='ru' ? 'en' : 'ru';
    writeStore('pocket-tetris-lang', lang);
    applyLang();
    renderMenu();
    updateHud();
    if(topOpen()) renderTop();
    else if(battleUiOpen() && (battle.stage==='lobby' || battle.stage==='over')) renderLobby();
    else if(gameState==='paused') showOverlay(t('pause'),'',statsLine(),'pause');
    else if(gameState==='ready' && !overlay.hidden) showOverlay('TETRIS','','','main');
    if(overlay.hidden) setStartLabel(t('pillPause'), t('ariaPause'));
    showToast(t('langName'),1000);
  }
  langBtn.addEventListener('click', switchLang);

  /* ---------------- modes ---------------- */
  var MODES=[
    {id:'marathon'}, {id:'sprint'}, {id:'dig'}, {id:'ultra'}, {id:'daily'}, {id:'puzzle'}, {id:'battle'}
  ];

  /* ---------------- puzzles ---------------- */
  // Each level is a fixed board and a fixed list of pieces; the goal is to clear every block.
  // Pieces don't fall on their own and lock only on a hard drop, so the player can think.
  var PUZZLES=window.POCKET_PUZZLES||[];
  var puzzleIdx=0, puzzleQueue=[], solvedPuzzles=[];
  function puzzleName(i){ return (Math.floor(i/8)+1)+'-'+(i%8+1); }
  function puzzleUnlocked(i){ return i===0 || solvedPuzzles.indexOf(i-1)!==-1; }
  function puzzleLayout(i){ return Engine.puzzleBoard(PUZZLES[i].rows); }
  function loadPuzzleBoard(i){ board=puzzleLayout(i); }
  // 40 LINES starts at level 2 and, like MARATHON, speeds up every 10 lines (level 5 for the last ten).
  var SPRINT_LINES=40, SPRINT_LEVEL=2, DAILY_MINUTES=5;
  var DURATIONS=[5,7,10];
  // Only MARATHON lets the player pick a level; the other modes have fixed rules so friends' records are comparable.
  // Timed games start at level 0 and level up every N lines, N = the game's minutes, so difficulty peaks near the end.
  function baseLevel(){ return mode==='marathon' ? startLevel : (mode==='sprint' || mode==='dig' ? SPRINT_LEVEL : 0); }
  // 40 LINES and DIG are races: the time counts up and the record is the fastest finish.
  function raceMode(){ return mode==='sprint' || mode==='dig'; }
  function onTheClock(){ return mode==='ultra' || mode==='daily'; }
  function minutes(){ return mode==='daily' ? DAILY_MINUTES : DURATIONS[durIdx]; }
  function timeLimit(){ return minutes()*60000; }
  function linesPerLevel(){ return onTheClock() ? minutes() : 10; }
  function recordId(){ return mode==='ultra' ? 'ta'+DURATIONS[durIdx] : mode; }

  /* ---------------- puzzle hints ---------------- */
  // Each level carries one solution from the generator. A player gets one hint per level, for good: it restarts
  // the level and shows, step by step, the cells the current piece should land on (or asks for HOLD).
  // Placing a piece anywhere else turns the hint off.
  var usedHints=[], hint=null;
  function hintSteps(i){
    return (PUZZLES[i].hint||[]).map(function(s){
      if(s==='H') return {hold:true};
      var p=s.split(':');
      return {piece:p[0], cells:p[1].split(' ').map(function(c){ var xy=c.split(','); return [+xy[0], +xy[1]]; })};
    });
  }
  function hintAvailable(){ return mode==='puzzle' && !!PUZZLES[puzzleIdx] && !!PUZZLES[puzzleIdx].hint && usedHints.indexOf(puzzleIdx)===-1; }
  function useHint(){
    if(!hintAvailable()) return;
    usedHints.push(puzzleIdx);
    saveProgressSoon();
    writeStore('pocket-tetris-hints', JSON.stringify(usedHints));
    startGame(true);
  }
  // The HINT button on the console shows only in puzzles, dimmed once the level's hint is spent.
  function renderHintPill(){
    hintPill.hidden = mode!=='puzzle';
    hintPill.classList.toggle('used', !hintAvailable());
  }
  hintPill.addEventListener('click', function(){
    if(topOpen() || battleUiOpen() || (inMenu() && performance.now()<menuLockUntil)) return;
    if(hintAvailable()) useHint();
    else showToast(hint ? t('hintOn') : t('hintSpent'),1800);
  });
  function hintStep(){ return hint && hint.steps[hint.at]; }
  function hintPrompt(){ var st=hintStep(); if(st && st.hold) showToast(t('hintHold'),1800); }
  function hintOff(){ hint=null; showToast(t('hintOff'),1800); }
  function cellsKey(cells){ return cells.map(function(c){ return c[0]+','+c[1]; }).sort().join(' '); }
  function hintOnLock(cells){
    var st=hintStep();
    if(!st) return;
    if(st.hold || cellsKey(st.cells)!==cellsKey(cells)){ hintOff(); return; }
    hint.at++;
    hintPrompt();
  }
  function hintOnHold(){
    var st=hintStep();
    if(!st) return;
    if(!st.hold){ hintOff(); return; }
    hint.at++;
  }

  /* ---------------- daily challenge ---------------- */
  // Everyone gets the same piece order on the same day: the shuffle is seeded with the date.
  // The day is counted in Kazakhstan time (UTC+5) so friends in other time zones share one challenge.
  function dayParts(){ var t=new Date(Date.now()+5*3600000); return {y:t.getUTCFullYear(), m:t.getUTCMonth()+1, d:t.getUTCDate()}; }
  function dayKey(){ var p=dayParts(); return p.y*10000+p.m*100+p.d; }
  function dayLabel(){ var p=dayParts(); return (p.d<10?'0':'')+p.d+'.'+(p.m<10?'0':'')+p.m; }
  var dailyDay=0;
  // Today's best DAILY game is kept as a recording of its key presses: the server replays it to count the score.
  function dailyReplayKey(){ return BEST_KEYS.daily+'-replay'; }
  function refreshDaily(){
    var k=dayKey();
    if(k===dailyDay) return;
    dailyDay=k;
    BEST_KEYS.daily='pocket-tetris-daily-rec2-'+k;
    best.daily=parseInt(readStore(BEST_KEYS.daily)||'0',10)||0;
    try{
      for(var i=localStorage.length-1;i>=0;i--){
        var sk=localStorage.key(i);
        if(sk && sk.indexOf('pocket-tetris-daily')===0 && sk.indexOf(BEST_KEYS.daily)!==0) localStorage.removeItem(sk);
      }
    }catch(e){}
  }
  /* ---------------- console colors, unlocked by achievements ---------------- */
  var SKIN_VARS=['--shell','--shell-hi','--shell-lo','--ink','--mark','--btn-hi','--btn','--btn-lo','--btn-shadow','--btn-ink','--pill-hi','--pill-lo','--pill-ink'];
  var SKINS=[
    {id:'classic', c:['#a9a692','#c9c6b0','#726f5e','#2b2a26','#a83232','#c95555','#a83232','#7a2222','#5e1717','#2a0e0e','#918e7c','#5f5c4d','#2b2a26']},
    {id:'purple', c:['#6d5a9c','#9b89c9','#45386a','#1c1530','#f2d4ff','#d9607a','#b8324a','#7d2033','#561626','#2a0a12','#7f6daf','#4a3d73','#e9e2ff']},
    {id:'teal', c:['#3d8c86','#6cb8b1','#255e5a','#0d2624','#f5e27a','#f2d66b','#d9b43a','#9c7f1f','#6e5815','#3a2e06','#4f9c96','#2c6a65','#e2f5f3']},
    {id:'yellow', c:['#d9b93c','#f1d970','#9d8526','#3a2f08','#2f5ea8','#5d8fd6','#3a6db5','#274c80','#1b3559','#0c1a2e','#c7a93a','#8c7420','#2e2506']},
    {id:'red', c:['#b3403d','#d7706b','#7c2826','#2e0c0b','#f6e7c8','#5a5852','#3b3a36','#22211e','#121110','#d8d4c8','#9a3532','#6a2220','#f6e7c8']},
    {id:'black', c:['#2f2f35','#4b4b54','#18181c','#c9c9d1','#e0474a','#c95555','#a83232','#7a2222','#5e1717','#2a0e0e','#45454d','#25252a','#d6d6de']},
    {id:'gold', c:['#c8a24a','#ebd18b','#8a6c26','#2e2206','#7a1f1f','#b54848','#8e2a2a','#611b1b','#401111','#f3dca0','#b08d3c','#7a6020','#2e2206']}
  ];
  // skinIdx is what the menu shows (and previews on the console); appliedSkin is the last unlocked choice.
  var unlockedSkins=['classic'], skinIdx=0, appliedSkin='classic';
  function skinIndex(id){ for(var i=0;i<SKINS.length;i++) if(SKINS[i].id===id) return i; return -1; }
  function isUnlocked(id){ return unlockedSkins.indexOf(id)!==-1; }
  function applySkin(id){
    var s=SKINS[Math.max(0,skinIndex(id))], st=document.documentElement.style;
    for(var i=0;i<SKIN_VARS.length;i++) st.setProperty(SKIN_VARS[i], s.c[i]);
  }
  function unlockSkin(id){
    if(isUnlocked(id)) return;
    unlockedSkins.push(id);
    writeStore('pocket-tetris-colors', JSON.stringify(unlockedSkins));
    saveProgressSoon();
    // Shown after the line-clear toast so the two messages don't overwrite each other.
    setTimeout(function(){ showToast(t('newColor', t('skin.'+id)),1800); sfxLevel(); },900);
  }

  var modeIdx=0, mode='marathon', startLevel=0, durIdx=0, menuRow=0, menuLockUntil=0;
  var best={marathon:0, sprint:0, dig:0, ta5:0, ta7:0, ta10:0, daily:0};
  // Records start over whenever a rule change makes old scores incomparable: rec2 began with the modern speed curve.
  var BEST_KEYS={marathon:'pocket-tetris-rec2-marathon', sprint:'pocket-tetris-rec2-sprint',
    ta5:'pocket-tetris-rec2-ta5', ta7:'pocket-tetris-rec2-ta7', ta10:'pocket-tetris-rec2-ta10', dig:'pocket-tetris-rec2-dig'};
  var OLD_RECORD_KEYS=['pocket-tetris-high','pocket-tetris-best-sprint','pocket-tetris-best-sprint-v2',
    'pocket-tetris-best-ta5','pocket-tetris-best-ta7','pocket-tetris-best-ta10'];

  /* ---------------- pieces ---------------- */
  var SHAPES=Engine.SHAPES, KEYS=Engine.KEYS;

  /* ---------------- palettes ---------------- */
  var PALETTES=[
    {bg:'#9bbc0f',light:'#8bac0f',mid:'#306230',dark:'#0f380f'},
    {bg:'#c8ccc0',light:'#a3a89a',mid:'#5c6058',dark:'#202019'},
    {bg:'#f3cf6b',light:'#d9a53c',mid:'#8a5f14',dark:'#3a2604'},
    {bg:'#ff9d7a',light:'#e06a4a',mid:'#7a2418',dark:'#2b0a06'}
  ];
  var pal=PALETTES[0];
  function applyPalette(idx){
    pal=PALETTES[idx % PALETTES.length];
    var st=document.documentElement.style;
    st.setProperty('--lcd-bg',pal.bg);
    st.setProperty('--lcd-light',pal.light);
    st.setProperty('--lcd-mid',pal.mid);
    st.setProperty('--lcd-dark',pal.dark);
    drawNext();
    drawHold();
    if(mode==='battle') drawRival();
  }

  /* ---------------- state ---------------- */
  // The running game is an engine object. These variables mirror it for drawing and the HUD (pull), and between
  // games they hold what the menu shows behind it: an empty board or the chosen puzzle.
  var game=null, tickAcc=0, shown={};
  var board=[], piece=null, pieceKey=null, nextKey=null, heldKey=null, px=0, py=0;
  var score=0, lines=0, level=0, lastTs=null, elapsed=0;
  var gameState='ready', holdUsed=false;
  var flashRows=null, pieceCounts={}, scale=1, pieceSerial=0, puzzleQueue=[], digLeft=0, playedOpt=0, playedSeed=0;

  function resetBoard(){ board=Engine.emptyBoard(); }

  function rulesFor(){
    if(mode==='puzzle') return {puzzle:PUZZLES[puzzleIdx]};
    if(mode==='battle') return {battle:true, seed:battleSeed};
    if(mode==='daily'){ var r=Engine.dailyRules(dailyDay); r.record=true; return r; }
    // Every other game has its own seed and is recorded, so it can be sent as a challenge; a challenge deals the friend's seed.
    playedOpt = mode==='marathon' ? startLevel : mode==='ultra' ? DURATIONS[durIdx] : 0;
    playedSeed = challenge && challenge.mode===mode ? challenge.seed : randomSeed();
    var r=Engine.modeRules(mode, playedOpt, playedSeed);
    r.record=true;
    return r;
  }
  function pull(){
    board=game.board; piece=game.piece; pieceKey=game.key; nextKey=game.next; heldKey=game.held; holdUsed=game.holdUsed;
    px=game.px; py=game.py; score=game.score; lines=game.lines; level=game.level; elapsed=game.elapsedMs();
    flashRows=game.clearRows; pieceCounts=game.pieceCounts; pieceSerial=game.serial; puzzleQueue=game.queue;
    battle.pending=game.pending; digLeft=game.digLeft;
  }
  // After the engine has moved on: mirror it, react to what happened (sounds, messages, the end), refresh the HUD.
  function afterEngine(){
    pull();
    if(gameState==='playing' || gameState==='clearing') gameState = game.state==='clearing' ? 'clearing' : 'playing';
    var events=game.takeEvents();
    for(var i=0;i<events.length;i++) onEngineEvent(events[i]);
    if(gameState==='playing' || gameState==='clearing') syncView();
  }
  function onEngineEvent(e){
    switch(e.t){
      case 'move': sfxMove(); break;
      case 'rotate': sfxRotate(); break;
      case 'hold': sfxRotate(); if(hint) hintOnHold(); break;
      case 'lock': sfxLock(); if(hint) hintOnLock(e.cells); break;
      case 'spawn': sendBoard(); break;
      case 'level': applyPalette(Math.floor(level/5)); sfxLevel(); break;
      case 'clear':
        var msg=t('clear'+e.n);
        if(e.b2b) msg+='\n'+t('b2b');
        if(e.sent>0){ sendMsg('attack', e.sent); msg+='\n'+t('sent', e.sent); }
        if(e.combo>0) msg+='\n'+t('combo', e.combo);
        if(e.leveledUp) applyPalette(Math.floor(level/5));
        if(mode!=='puzzle'){
          if(e.n===4) unlockSkin('purple');
          if(e.combo>=3) unlockSkin('teal');
          if(mode==='marathon' && lines>=100) unlockSkin('black');
          if(score>=50000) unlockSkin('gold');
        }
        sfxClear(e.n);
        if(e.leveledUp) sfxLevel();
        showToast(msg,800);
        break;
      case 'over': endGame(e.kind); break;
    }
  }
  // Redraws the HUD and the HOLD/NEXT boxes only when what they show has changed.
  function syncView(){
    var hud=[score,lines,level,battle.pending,puzzleQueue.length,nextKey,heldKey,digLeft].join('|');
    if(hud!==shown.hud){ shown.hud=hud; updateHud(); }
    var boxes=(nextKey||'-')+(heldKey||'-')+(holdUsed?1:0);
    if(boxes!==shown.boxes){ shown.boxes=boxes; drawNext(); drawHold(); }
  }

  /* ---------------- HUD / storage ---------------- */
  function setNum(el,v){
    var s=String(v);
    el.textContent=s;
    el.style.fontSize = s.length>6 ? '8px' : '';
  }
  function fmtTime(ms,tenths){
    var t=Math.max(0,ms);
    var m=Math.floor(t/60000), s=Math.floor(t/1000)%60;
    var txt=m+':'+(s<10?'0':'')+s;
    if(tenths) txt+='.'+(Math.floor(t/100)%10);
    return txt;
  }
  function timeText(){
    if(raceMode()) return fmtTime(elapsed,true);
    return fmtTime(Math.ceil(Math.max(0,timeLimit()-elapsed)/1000)*1000,false);
  }
  function inGame(){ return gameState==='playing' || gameState==='paused' || gameState==='clearing'; }
  function bestText(){
    if(raceMode()) return best[mode] ? fmtTime(best[mode],true) : '--';
    var b=best[recordId()];
    return inGame() ? Math.max(b,score) : b;
  }
  var lastTimeText='';
  function updateTimeHud(){
    var t=timeText();
    if(t===lastTimeText) return;
    lastTimeText=t;
    setNum(timeVal,t);
  }
  function updateHud(){
    renderHintPill();
    linesVal.textContent=String(lines).padStart(3,'0');
    var isPuzzle = mode==='puzzle', isBattle = mode==='battle';
    lvWrap.hidden = isPuzzle || isBattle;
    goalText.hidden = !(isPuzzle || isBattle);
    rivalPanel.hidden = !isBattle;
    scoreVal.parentNode.hidden = isBattle;
    topVal.parentNode.hidden = isBattle;
    if(isBattle){
      goalText.textContent = battle.pending>0 ? t('incomingBar', battle.pending) : t('vsFriend');
      levelLabel.textContent=t('lblLevel');
      setNum(levelVal,level);
      timePanel.hidden=true;
      return;
    }
    if(isPuzzle){
      goalText.textContent=t('clearAll');
      // The side panels switch roles: which puzzle, pieces left, the pieces after NEXT, and overall progress.
      var p=PUZZLES[puzzleIdx];
      var left = inGame() ? puzzleQueue.length+(nextKey?1:0)+(heldKey?1:0)+(piece?1:0) : p.pieces.length;
      var upcoming = inGame() ? puzzleQueue.join('') : p.pieces.slice(2);
      levelLabel.textContent=t('lblPuzzle'); setNum(levelVal,puzzleName(puzzleIdx));
      scoreLabel.textContent=t('lblPieces'); setNum(scoreVal,left);
      timePanel.hidden=false;
      timeLabel.textContent=t('lblQueue'); setNum(timeVal,upcoming||'-');
      topLabel.textContent=t('lblSolved'); setNum(topVal,solvedPuzzles.length+'/'+PUZZLES.length);
      return;
    }
    levelLabel.textContent=t('lblLevel');
    scoreLabel.textContent=t('lblScore');
    timeLabel.textContent=t('lblTime');
    var toGo, filled;
    if(mode==='dig'){
      // The bar fills as the garbage goes; the number is how many garbage rows are left.
      toGo=digLeft;
      filled=Math.round((Engine.DIG_ROWS-digLeft)*10/Engine.DIG_ROWS);
    } else if(mode==='sprint'){
      toGo=Math.max(0,SPRINT_LINES-lines);
      filled=Math.min(10,Math.floor(lines/(SPRINT_LINES/10)));
    } else {
      var lpl=linesPerLevel();
      toGo=lpl-(lines%lpl);
      filled=Math.round((lines%lpl)*10/lpl);
    }
    for(var i=0;i<10;i++) lvCells[i].classList.toggle('on', i<filled);
    lvLeft.textContent=String(toGo);
    setNum(levelVal,level);
    setNum(scoreVal,score);
    timePanel.hidden = mode==='marathon';
    topLabel.textContent = mode==='marathon' ? t('lblTop') : t('lblBest');
    setNum(topVal,bestText());
    lastTimeText='';
    if(!timePanel.hidden) updateTimeHud();
  }
  function readStore(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } }
  function writeStore(key,val){ try{ localStorage.setItem(key,val); }catch(e){} }
  function removeStore(key){ try{ localStorage.removeItem(key); }catch(e){} }
  function saveBest(){ for(var k in BEST_KEYS) writeStore(BEST_KEYS[k], String(best[k])); }

  /* ---------------- drawing ---------------- */
  function gapFor(cell){ return Math.max(1, Math.round(cell/16)); }
  function drawBlock(ctx,x,y,cell,color){
    var g=gapFor(cell);
    ctx.fillStyle=color;
    ctx.fillRect(x+g, y+g, cell-2*g, cell-2*g);
  }

  function draw(){
    var c=CELL;
    bctx.fillStyle=pal.bg;
    bctx.fillRect(0,0,boardCv.width,boardCv.height);
    for(var r=0;r<ROWS;r++){
      var isFlash = gameState==='clearing' && flashRows && flashRows.indexOf(r)!==-1;
      for(var col=0;col<COLS;col++){
        if(board[r][col]) drawBlock(bctx, col*c, r*c, c, isFlash ? pal.light : (board[r][col]===2 ? pal.mid : pal.dark));
      }
    }
    if(game && piece && (gameState==='playing' || gameState==='paused')){
      var hs=hintStep();
      if(hs && !hs.hold && hs.piece===pieceKey){
        bctx.fillStyle=pal.mid;
        bctx.globalAlpha=.45;
        hs.cells.forEach(function(cell){ drawBlock(bctx, cell[0]*c, cell[1]*c, c, pal.mid); });
        bctx.globalAlpha=1;
      }
      var gy=game.ghostY(), lw=gapFor(c);
      bctx.strokeStyle=pal.mid;
      bctx.lineWidth=lw;
      for(var r2=0;r2<piece.length;r2++){
        for(var c2=0;c2<piece[r2].length;c2++){
          if(!piece[r2][c2] || gy+r2<0) continue;
          bctx.strokeRect((px+c2)*c + lw*1.5, (gy+r2)*c + lw*1.5, c - lw*3, c - lw*3);
        }
      }
      for(var r3=0;r3<piece.length;r3++){
        for(var c3=0;c3<piece[r3].length;c3++){
          if(piece[r3][c3] && py+r3>=0) drawBlock(bctx, (px+c3)*c, (py+r3)*c, c, pal.dark);
        }
      }
    }
  }

  function drawPreview(cv,ctx,key,dim){
    ctx.fillStyle=pal.bg;
    ctx.fillRect(0,0,cv.width,cv.height);
    if(!key) return;
    var sh=SHAPES[key], minR=99, maxR=-1, minC=99, maxC=-1;
    for(var r=0;r<sh.length;r++){
      for(var k=0;k<sh.length;k++){
        if(!sh[r][k]) continue;
        if(r<minR) minR=r; if(r>maxR) maxR=r;
        if(k<minC) minC=k; if(k>maxC) maxC=k;
      }
    }
    var cell=Math.floor(cv.width/4.6);
    var ox=Math.round((cv.width-(maxC-minC+1)*cell)/2);
    var oy=Math.round((cv.height-(maxR-minR+1)*cell)/2);
    var color=dim ? pal.mid : pal.dark;
    for(var r2=minR;r2<=maxR;r2++){
      for(var k2=minC;k2<=maxC;k2++){
        if(sh[r2][k2]) drawBlock(ctx, ox+(k2-minC)*cell, oy+(r2-minR)*cell, cell, color);
      }
    }
  }
  function drawNext(){ drawPreview(nextCv,nctx,nextKey,false); }
  function drawHold(){ drawPreview(holdCv,hctx,heldKey,holdUsed); }

  var toastTimer=null;
  function showToast(text,ms){
    toastEl.textContent=text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){ toastEl.classList.remove('show'); }, ms||700);
  }

  function statsLine(){
    return KEYS.map(function(k){ return k+':'+(pieceCounts[k]||0); }).join('  ');
  }

  /* ---------------- fit to screen ---------------- */
  function sizeCanvases(){
    var dpr=Math.min(window.devicePixelRatio||1, 2);
    var cell=Math.max(4, Math.round(boardCv.clientWidth*scale*dpr/COLS));
    if(boardCv.width!==cell*COLS){
      CELL=cell;
      boardCv.width=cell*COLS;
      boardCv.height=cell*ROWS;
    }
    var m=Math.max(16, Math.round(nextCv.clientWidth*scale*dpr));
    if(nextCv.width!==m){
      nextCv.width=nextCv.height=m;
      holdCv.width=holdCv.height=m;
    }
    draw();
    drawNext();
    drawHold();
  }

  function fit(){
    var w=consoleEl.offsetWidth, h=consoleEl.offsetHeight;
    var bs=getComputedStyle(document.body);
    var availW=document.documentElement.clientWidth - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight);
    var belowH=belowEl.offsetHeight ? belowEl.offsetHeight + 14 : 0;
    var availH=window.innerHeight - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom) - belowH;
    scale=Math.max(0.4, Math.min(availW/w, availH/h, 1.5));
    consoleEl.style.transform='scale('+scale+')';
    fitEl.style.width=(w*scale)+'px';
    fitEl.style.height=(h*scale)+'px';
    sizeCanvases();
  }

  var fitQueued=false;
  function queueFit(){
    if(fitQueued) return;
    fitQueued=true;
    requestAnimationFrame(function(){ fitQueued=false; fit(); });
  }

  /* ---------------- sound ---------------- */
  var actx=null, muted=false;
  function ensureAudio(){
    if(!actx){
      var AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return;
      try{ actx=new AC(); }catch(e){ return; }
    }
    if(actx.state==='suspended'){
      var p=actx.resume();
      if(p && p.catch) p.catch(function(){});
    }
  }
  function beep(freq,dur,type,gain,when,dest){
    if(muted||!actx) return;
    var t=actx.currentTime+(when||0);
    var osc=actx.createOscillator();
    var g=actx.createGain();
    osc.type=type||'square';
    osc.frequency.value=freq;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(gain||0.06,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    osc.connect(g);
    g.connect(dest||actx.destination);
    osc.start(t);
    osc.stop(t+dur+0.02);
  }
  function sfxMove(){ beep(220,0.04,'square',0.03); }
  function sfxRotate(){ beep(330,0.05,'square',0.035); }
  function sfxLock(){ beep(140,0.06,'triangle',0.05); }
  function sfxClear(n){
    var base=[523,659,784,1047];
    for(var i=0;i<Math.min(n,4);i++) beep(base[i],0.09,'square',0.05,i*0.06);
  }
  function sfxLevel(){ beep(880,0.12,'square',0.05); beep(1175,0.14,'square',0.05,0.1); }
  function sfxGameOver(){ beep(220,0.18,'sawtooth',0.05); beep(165,0.22,'sawtooth',0.05,0.16); beep(110,0.35,'sawtooth',0.05,0.34); }

  // Notes as "D5:2" = pitch and length in eighths; R is a rest.
  function noteFreq(n){
    var m=/^([A-G])(#?)(\d)$/.exec(n);
    var semi={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]] + (m[2] ? 1 : 0);
    return 440*Math.pow(2, (12*(+m[3]+1)+semi-69)/12);
  }
  function parseTune(str,eighth){
    return str.split(/[\s|]+/).filter(Boolean).map(function(t){
      var p=t.split(':');
      return [p[0]==='R' ? 0 : noteFreq(p[0]), (+p[1])*eighth];
    });
  }
  // All melodies are public domain: a 19th-century folk song, Petzold (d. 1733) and Grieg (d. 1907).
  var TRACKS=[
    {name:'KOROBEINIKI', notes:parseTune(
      'E5:2 B4:1 C5:1 D5:2 C5:1 B4:1 | A4:2 A4:1 C5:1 E5:2 D5:1 C5:1 | B4:3 C5:1 D5:2 E5:2 | C5:2 A4:2 A4:4 |'+
      'R:1 D5:2 F5:1 A5:2 G5:1 F5:1 | E5:3 C5:1 E5:2 D5:1 C5:1 | B4:2 B4:1 C5:1 D5:2 E5:2 | C5:2 A4:2 A4:2 R:2', 0.1)},
    {name:'MINUET', notes:parseTune(
      'D5:2 G4:1 A4:1 B4:1 C5:1 | D5:2 G4:2 G4:2 | E5:2 C5:1 D5:1 E5:1 F#5:1 | G5:2 G4:2 G4:2 |'+
      'C5:2 D5:1 C5:1 B4:1 A4:1 | B4:2 C5:1 B4:1 A4:1 G4:1 | F#4:2 G4:1 A4:1 B4:1 G4:1 | A4:6 |'+
      'D5:2 G4:1 A4:1 B4:1 C5:1 | D5:2 G4:2 G4:2 | E5:2 C5:1 D5:1 E5:1 F#5:1 | G5:2 G4:2 G4:2 |'+
      'C5:2 D5:1 C5:1 B4:1 A4:1 | B4:2 C5:1 B4:1 A4:1 G4:1 | A4:2 B4:1 A4:1 G4:1 F#4:1 | G4:6', 0.16)},
    {name:'MOUNTAIN KING', notes:parseTune(
      'B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:2 | F4:1 C#4:1 F4:2 E4:1 C4:1 E4:2 |'+
      'B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:1 B4:1 | A4:1 F#4:1 D4:1 F#4:1 A4:4 |'+
      'B4:1 C#5:1 D5:1 E5:1 F#5:1 D5:1 F#5:2 | F5:1 C#5:1 F5:2 E5:1 C5:1 E5:2 |'+
      'B4:1 C#5:1 D5:1 E5:1 F#5:1 D5:1 F#5:1 B5:1 | A5:1 F#5:1 D5:1 F#5:1 A5:4', 0.14)}
  ];
  // The sound button cycles: music 1, 2, 3, sound effects only, everything off.
  var SOUND_LABELS=['♪1','♪2','♪3','FX','×'];
  var soundMode=0;

  var tuneTimeout=null, tuneBus=null;
  function scheduleTune(){
    stopTune();
    if(muted || soundMode>2 || !actx) return;
    tuneBus=actx.createGain();
    tuneBus.connect(actx.destination);
    var notes=TRACKS[soundMode].notes, t=0;
    for(var i=0;i<notes.length;i++){
      if(notes[i][0]>0) beep(notes[i][0],notes[i][1]*0.9,'square',0.028,t,tuneBus);
      t+=notes[i][1];
    }
    tuneTimeout=setTimeout(function(){ if(gameState==='playing') scheduleTune(); }, t*1000);
  }
  function stopTune(){
    clearTimeout(tuneTimeout);
    tuneTimeout=null;
    if(tuneBus){ try{ tuneBus.disconnect(); }catch(e){} tuneBus=null; }
  }

  function renderMute(){
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteBtn.textContent = SOUND_LABELS[soundMode];
  }
  muteBtn.addEventListener('click',function(){
    soundMode=(soundMode+1)%SOUND_LABELS.length;
    muted = soundMode===4;
    writeStore('pocket-tetris-sound', String(soundMode));
    renderMute();
    stopTune();
    if(!muted) ensureAudio();
    if(gameState==='playing') scheduleTune();
    showToast(t('sound'+soundMode),1300);
  });

  ['pointerup','touchend','click','keydown'].forEach(function(type){
    document.addEventListener(type, ensureAudio, true);
  });

  /* ---------------- game flow ---------------- */
  // The main screen's text is kept so it can come back after the daily top has covered it.
  var mainOverlay=null;
  function showOverlay(title,sub,stats,kind){
    if(kind==='main') mainOverlay=[title,sub,stats,kind];
    overlayTitle.textContent=title;
    overlaySub.textContent=sub||'';
    overlayStats.textContent=stats||'';
    menuEl.hidden = kind!=='main';
    pauseMenuEl.hidden = kind!=='pause';
    battlePanel.hidden = true;
    topPanel.hidden = true;
    overlayPrompt.hidden = kind!=='main';
    overlay.hidden=false;
    renderShareRow();
    setStartLabel(kind==='pause' ? t('pillResume') : t('pillStart'), kind==='pause' ? t('ariaResume') : t('ariaStart'));
  }
  // SHARE after a finished game (not a failed puzzle); DAILY TOP whenever the menu is on DAILY.
  function renderShareRow(){
    var onMain = !overlay.hidden && !menuEl.hidden;
    var failedPuzzle = lastResult && lastResult.mode==='puzzle' && lastResult.kind!=='solved';
    var canShare = onMain && gameState==='gameover' && !!lastResult && !failedPuzzle;
    var canTop = onMain && MODES[modeIdx].id==='daily';
    var canCh = onMain && gameState==='gameover' && canChallenge(lastResult);
    // After a failed puzzle, the level's one hint can be spent on a guided retry.
    var canHint = onMain && gameState==='gameover' && failedPuzzle && hintAvailable();
    shareBtn.hidden=!canShare;
    topBtn.hidden=!canTop;
    hintRetryBtn.hidden=!canHint;
    chBtn.hidden=!canCh;
    shareRow.hidden=!(canShare || canTop || canHint || canCh);
  }
  function hideOverlay(){
    overlay.hidden=true;
    setStartLabel(t('pillPause'), t('ariaPause'));
  }
  function setStartLabel(text,aria){
    startLabel.textContent=text;
    startPill.setAttribute('aria-label',aria);
  }

  function startGame(withHint){
    if(!isUnlocked(SKINS[skinIdx].id)){ skinIdx=skinIndex(appliedSkin); applySkin(appliedSkin); }
    ensureAudio();
    mode=MODES[modeIdx].id;
    refreshDaily();
    game=Engine.create(rulesFor());
    tickAcc=0;
    shown={};
    gesture=null;
    pull();
    applyPalette(Math.floor(level/5));
    hideOverlay();
    gameState='playing';
    powerLed.style.opacity='1';
    scheduleTune();
    afterEngine();
    draw();
    hint = withHint && mode==='puzzle' ? {steps:hintSteps(puzzleIdx), at:0} : null;
    if(hint){
      showToast(t('hintOn'),2600);
      if(hintStep().hold) setTimeout(hintPrompt,2700);
    } else if(mode==='puzzle'){
      var tip=PUZZLES[puzzleIdx].tip;
      showToast(t('puzzleStart', puzzleName(puzzleIdx), tip ? tipText(tip) : t('clearBoard')), tip ? 3000 : 1600);
    }
    // The free server sleeps when idle; wake it now so the daily top is ready when the game ends.
    if(mode==='daily') wakeServer();
  }

  function restartGame(){
    if(gameState!=='paused') return;
    if(mode==='marathon' && score>best.marathon){ best.marathon=score; saveBest(); }
    startGame();
  }

  function endGame(kind){
    gameState='gameover';
    hint=null;
    stopTune();
    stopAllRepeats();
    gesture=null;
    // Ignore menu input briefly, so taps meant for the last piece don't restart the game.
    menuLockUntil=performance.now()+900;
    if(mode==='battle'){
      var won = kind==='win';
      if(!won) sendMsg('lost');
      battle.stage='over';
      battle.title = won ? 'youWin' : 'youLose';
      if(won) sfxLevel(); else sfxGameOver();
      updateHud();
      draw();
      powerLed.style.opacity='.35';
      renderLobby();
      return;
    }
    var title=t('gameOver'), sub='', record=false, puzzleLabel=puzzleName(puzzleIdx), puzzleAt=puzzleIdx;
    if(kind==='complete'){
      title=t('complete');
      sub=t('subTime', fmtTime(elapsed,true));
      if(!best[mode] || elapsed<best[mode]){ best[mode]=Math.round(elapsed); record=true; }
      sfxLevel();
    } else if(mode==='puzzle'){
      if(kind==='solved'){
        title=t('solvedTitle');
        if(solvedPuzzles.indexOf(puzzleIdx)===-1){
          solvedPuzzles.push(puzzleIdx);
          writeStore('pocket-tetris-puzzles', JSON.stringify(solvedPuzzles));
        }
        var hasNext = puzzleIdx+1 < PUZZLES.length;
        sub=t('subPuzzle', puzzleLabel)+'\n'+(hasNext ? t('nextPuzzle') : t('allSolved'));
        if(hasNext){ puzzleIdx++; writeStore('pocket-tetris-puzzle', String(puzzleIdx)); }
        sfxLevel();
      } else {
        title = kind==='nopieces' ? t('outOfPieces') : t('gameOver');
        sub=t('tryAgain');
        sfxGameOver();
      }
    } else if(onTheClock()){
      // In timed games the score counts even after a top-out: survival is part of the challenge, not a reason to lose everything.
      if(kind==='timeup') title = mode==='daily' ? t('dailyTitle', dayLabel()) : t('timeUp');
      sub=t('subScore', score);
      var rid=recordId();
      if(score>best[rid]){ best[rid]=score; record=true; }
      // The best game of the day (or the first one) is kept as a recording for the daily top.
      if(mode==='daily' && (record || !readStore(dailyReplayKey()))) writeStore(dailyReplayKey(), game.recording());
      if(mode==='daily'){ noteDailyDone(dailyDay); if(streakLine()) sub+='\n'+streakLine(); }
      if(kind==='timeup') sfxLevel(); else sfxGameOver();
    } else {
      if(mode==='marathon' && score>best.marathon){ best.marathon=score; record=true; }
      // A race that ended before the finish says how far it got.
      if(mode==='dig') sub=t('digLeftSub', digLeft);
      if(mode==='sprint') sub=t('sprintSub', lines);
      sfxGameOver();
    }
    lastResult={mode:mode, kind:kind, score:score, lines:lines, level:level, elapsed:elapsed, minutes:minutes(), day:dayLabel(),
      puzzle:puzzleLabel, pieces:PUZZLES.length ? PUZZLES[puzzleAt].pieces : '', record:record,
      ticks:game.tick, dug:Engine.DIG_ROWS-digLeft, opt:playedOpt, seed:playedSeed, rec: CHALLENGE_MODES[mode] ? game.recording() : '',
      // A solved puzzle ends on an empty board, so the picture shows the puzzle it started from.
      board: mode==='puzzle' ? puzzleLayout(puzzleAt) : board.map(function(row){ return row.slice(); })};
    renderShareCard(lastResult);
    // Before renderMenu: it may roll the daily over to a new day if the game ended after midnight.
    if(mode==='daily') sendDailyResult(lastResult, dailyDay);
    if(kind==='complete' && mode==='sprint') unlockSkin('yellow');
    if(kind==='timeup' && mode==='daily') unlockSkin('red');
    if(mode!=='puzzle' && score>=50000) unlockSkin('gold');
    saveBest();
    updateHud();
    renderMenu();
    draw();
    powerLed.style.opacity='.35';
    var recordText = mode==='daily' ? t('bestToday') : t('newRecord');
    showOverlay(title, (record ? recordText + (sub ? '\n' : '') : '') + sub, '', 'main');
    saveProgressSoon();
    // A challenge game goes straight to the challenge's table.
    if(challenge && challenge.mode===mode) sendChallengeResult(lastResult);
  }

  /* ---------------- share result ---------------- */
  var lastResult=null;
  function fmtScore(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' '); }
  function shareText(r){
    if(r.mode==='sprint') return r.kind==='complete' ? t('shareSprintDone', fmtTime(r.elapsed,true)) : t('shareSprint', r.lines);
    if(r.mode==='dig') return r.kind==='complete' ? t('shareDigDone', Engine.DIG_ROWS, fmtTime(r.elapsed,true)) : t('shareDig', r.dug, Engine.DIG_ROWS);
    if(r.mode==='puzzle') return t('sharePuzzle', r.puzzle);
    if(r.mode==='daily') return t('shareDaily', r.day, fmtScore(r.score), r.rank ? t('shareDailyRank', r.rank, r.players) : '');
    if(r.mode==='ultra') return t('shareUltra', r.minutes, fmtScore(r.score));
    return t('shareMarathon', fmtScore(r.score), r.lines);
  }
  function shareResult(){
    if(!lastResult) return;
    var text=shareText(lastResult), url=location.origin+'/';
    var files=shareFile ? [shareFile] : null;
    if(files && navigator.canShare && navigator.canShare({files:files})){
      // Some apps drop a separate url when a picture is attached, so the link goes into the text.
      navigator.share({title:'Pocket Tetris', text:text+' '+url, files:files}).catch(function(){});
    } else if(navigator.share){
      navigator.share({title:'Pocket Tetris', text:text, url:url}).catch(function(){});
    } else if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text+' '+url).then(function(){ showToast(t('copied'),1200); }, function(){ showToast(t('cannotShare'),1200); });
    } else {
      showToast(t('cannotShare'),1200);
    }
  }
  shareBtn.addEventListener('click', shareResult);

  /* ---------------- share card: the result as a picture ---------------- */
  // Messengers show a picture far more prominently than a line of text, so the result is also drawn as a PNG
  // in the console's current colors: the final board on the left, the numbers on the right.
  // It's drawn when the game ends, because sharing has to start right in the tap, with the file ready.
  var shareFile=null, shareSerial=0;
  function cardContent(r){
    var head, rows, badge='';
    if(r.mode==='sprint'){
      head=t('cardSprint');
      rows = r.kind==='complete' ? [[t('cardTime'),fmtTime(r.elapsed,true)],[t('cardLines'),'40']] : [[t('cardLines'),r.lines+'/40'],[t('cardTime'),fmtTime(r.elapsed,true)]];
    } else if(r.mode==='dig'){
      head=t('cardDig');
      rows = r.kind==='complete' ? [[t('cardTime'),fmtTime(r.elapsed,true)],[t('cardRows'),String(Engine.DIG_ROWS)]] : [[t('cardRows'),r.dug+'/'+Engine.DIG_ROWS],[t('cardTime'),fmtTime(r.elapsed,true)]];
    } else if(r.mode==='puzzle'){
      head=t('cardPuzzle', r.puzzle);
      rows=[[t('cardResult'),t('cardSolved')],[t('cardPieces'),r.pieces]];
    } else {
      head = r.mode==='daily' ? t('cardDaily', r.day) : r.mode==='ultra' ? t('cardUltra', r.minutes) : t('cardMarathon');
      rows=[[t('cardScore'),fmtScore(r.score)],[t('cardLines'),String(r.lines)],[t('cardLevel'),String(r.level)]];
      if(r.rank) rows.push([t('cardPlace'),t('cardOf', r.rank, r.players)]);
    }
    if(r.record && r.mode!=='puzzle') badge = r.mode==='daily' ? t('bestToday') : t('newRecord');
    return {head:head, rows:rows, badge:badge};
  }
  function roundRectPath(g,x,y,w,h,rad){
    g.beginPath();
    g.moveTo(x+rad,y); g.arcTo(x+w,y,x+w,y+h,rad); g.arcTo(x+w,y+h,x,y+h,rad);
    g.arcTo(x,y+h,x,y,rad); g.arcTo(x,y,x+w,y,rad); g.closePath();
  }
  function drawShareCard(r,serial){
    if(serial!==shareSerial) return;
    var W=720, H=960, cv=document.createElement('canvas'), g=cv.getContext('2d');
    cv.width=W; cv.height=H;
    var sk=SKINS[Math.max(0,skinIndex(appliedSkin))].c, c=cardContent(r);
    function font(px){ g.font=px+"px 'Press Start 2P', monospace"; }
    // Console shell and its brand row.
    var shell=g.createLinearGradient(0,0,W,H);
    shell.addColorStop(0,sk[1]); shell.addColorStop(.4,sk[0]); shell.addColorStop(1,sk[2]);
    g.fillStyle=shell; g.fillRect(0,0,W,H);
    g.fillStyle='#c0392b'; g.beginPath(); g.arc(52,74,8,0,Math.PI*2); g.fill();
    font(16); g.fillStyle=sk[3]; g.globalAlpha=.75; g.fillText('POCKET SYSTEM',76,82); g.globalAlpha=1;
    font(32); g.fillStyle=sk[4]; g.textAlign='right'; g.fillText('TETRIS',W-40,90); g.textAlign='left';
    // Bezel and screen.
    g.fillStyle='#2c2b25'; roundRectPath(g,32,120,W-64,736,18); g.fill();
    var sx=60, sy=148, sw=W-120, sh=680;
    g.fillStyle=pal.bg; g.fillRect(sx,sy,sw,sh);
    font(16); g.fillStyle=pal.dark; g.fillText(c.head, sx+24, sy+44);
    // The board.
    var cell=28, bx=sx+24, by=sy+72;
    g.strokeStyle=pal.mid; g.lineWidth=2; g.strokeRect(bx-3,by-3,COLS*cell+6,ROWS*cell+6);
    for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++){
      var v=r.board[y][x];
      if(!v) continue;
      g.fillStyle = v===2 ? pal.mid : pal.dark;
      g.fillRect(bx+x*cell+2, by+y*cell+2, cell-4, cell-4);
    }
    // Numbers on the right; the first one big, long values shrunk to fit.
    var rx=bx+COLS*cell+32, rw=sx+sw-24-rx, ty=by+24;
    c.rows.forEach(function(row,i){
      font(16); g.fillStyle=pal.dark; g.globalAlpha=.7; g.fillText(row[0], rx, ty); g.globalAlpha=1;
      var size = i===0 ? 32 : 24;
      font(size);
      while(size>12 && g.measureText(row[1]).width>rw){ size-=4; font(size); }
      g.fillText(row[1], rx, ty+size+14);
      ty += size+14+48;
    });
    if(c.badge){
      font(16);
      var bw=g.measureText(c.badge).width+24;
      g.fillStyle=pal.dark; g.fillRect(rx,ty-8,bw,40);
      g.fillStyle=pal.bg; g.fillText(c.badge, rx+12, ty+20);
    }
    // Scanlines, like the LCD in the game.
    g.fillStyle=pal.dark; g.globalAlpha=.07;
    for(var ly=sy; ly<sy+sh; ly+=4) g.fillRect(sx,ly,sw,1);
    g.globalAlpha=1;
    // Where to play.
    font(16); g.fillStyle=sk[3]; g.textAlign='center'; g.fillText(location.host, W/2, 912); g.textAlign='left';
    cv.toBlob(function(blob){
      if(blob && serial===shareSerial) shareFile=new File([blob],'pocket-tetris.png',{type:'image/png'});
    },'image/png');
  }
  function renderShareCard(r){
    var serial=++shareSerial;
    shareFile=null;
    if(typeof File!=='function' || !HTMLCanvasElement.prototype.toBlob) return;
    var go=function(){ drawShareCard(r,serial); };
    // The pixel font must be loaded before the canvas can draw with it.
    if(document.fonts && document.fonts.load) document.fonts.load("16px 'Press Start 2P'", 'AЖ').then(go,go);
    else go();
  }

  /* ---------------- daily top ---------------- */
  // Everyone plays the same DAILY pieces, so each player's best score of the day goes on a shared list, and the
  // week's list adds up every day's best. The game sends a recording of the best game's key presses, and the
  // server replays it to count the score itself.
  // A player is a random id kept on this device. It doubles as the recovery code that brings the name (and the
  // progress) back on another phone, and the name belongs to it, so nobody else can take the name. Only a hash
  // of the id (playerPub) ever goes into a URL or onto a list.
  var NAME_RE=/^[A-Z0-9А-ЯЁ][A-Z0-9А-ЯЁ _.-]{0,9}$/, CODE_RE=/^[0-9a-f]{16}$/;
  function randomHex(bytes){
    return Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(bytes)), function(b){ return ('0'+b.toString(16)).slice(-2); }).join('');
  }
  var playerId=readStore('pocket-tetris-player');
  if(!CODE_RE.test(playerId||'')){ playerId=randomHex(8); writeStore('pocket-tetris-player', playerId); }
  var playerName=readStore('pocket-tetris-name')||'';
  if(!NAME_RE.test(playerName)) playerName='';
  var playerPub=null;
  function publicId(id){
    if(!(window.crypto && crypto.subtle && window.TextEncoder)) return Promise.resolve(null);
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)).then(function(buf){
      return Array.prototype.map.call(new Uint8Array(buf, 0, 8), function(b){ return ('0'+b.toString(16)).slice(-2); }).join('');
    }, function(){ return null; });
  }
  function refreshPub(){ return publicId(playerId).then(function(p){ playerPub=p; return p; }); }
  function withPub(){ return playerPub ? Promise.resolve(playerPub) : refreshPub(); }
  refreshPub();
  function fmtCode(c){ return c.toUpperCase().replace(/(.{4})(?=.)/g,'$1 '); }

  // Days as YYYYMMDD numbers.
  function shiftDay(day,n){
    var d=new Date(Date.UTC(Math.floor(day/10000), Math.floor(day/100)%100-1, day%100));
    d.setUTCDate(d.getUTCDate()+n);
    return d.getUTCFullYear()*10000+(d.getUTCMonth()+1)*100+d.getUTCDate();
  }
  function weekStart(day){ return shiftDay(day, -((new Date(Date.UTC(Math.floor(day/10000), Math.floor(day/100)%100-1, day%100)).getUTCDay()+6)%7)); }
  function shortDay(day){ var d=day%100, m=Math.floor(day/100)%100; return (d<10?'0':'')+d+'.'+(m<10?'0':'')+m; }
  function weekLabel(){ var w=weekStart(dailyDay); return shortDay(w)+'-'+shortDay(shiftDay(w,6)); }

  // How many days in a row the player finished the DAILY. It lives on the phone and travels with the progress.
  var streak=null;
  try{
    var savedStreak=JSON.parse(readStore('pocket-tetris-streak')||'null');
    if(savedStreak && savedStreak.last===(savedStreak.last|0) && savedStreak.n===(savedStreak.n|0)) streak={last:savedStreak.last, n:savedStreak.n};
  }catch(e){}
  function noteDailyDone(day){
    if(streak && streak.last===day) return;
    streak={last:day, n: streak && streak.last===shiftDay(day,-1) ? streak.n+1 : 1};
    writeStore('pocket-tetris-streak', JSON.stringify(streak));
  }
  function dayWord(n){
    if(lang!=='ru') return n===1 ? 'DAY' : 'DAYS';
    var a=n%10, b=n%100;
    return a===1 && b!==11 ? 'ДЕНЬ' : a>=2 && a<=4 && (b<12 || b>14) ? 'ДНЯ' : 'ДНЕЙ';
  }
  // Shown from two days on, while the streak is alive (played today or yesterday).
  function streakLine(){
    var today=dayKey(), n = streak && (streak.last===today || streak.last===shiftDay(today,-1)) ? streak.n : 0;
    return n>=2 ? t('streak', n, dayWord(n)) : '';
  }

  // The panel over the screen, one view at a time: null while closed; 'loading', 'error', 'list' (today),
  // 'week', 'profile', 'name', 'code'; and for challenges 'chMaking', 'chReady', 'chInvite', 'chResult'.
  // topBase is the list BACK returns to; nameThen runs once a name is picked (a challenge needs one).
  var topView=null, topData=null, topSerial=0, topNote='', topRetry=null, topError='', topTitle='', topBase=null, nameThen=null;
  function topOpen(){ return topView!==null; }
  function post(path,body){ return api(path, {method:'POST', headers:{'Content-Type':'text/plain'}, body:JSON.stringify(body)}); }

  // Sends today's best recorded game; resolves with {rank, players, score}, or null when there's nothing to send.
  // Fails with 409 when the name belongs to someone else and 426 when this copy of the game is out of date.
  function submitDaily(day){
    var rec=readStore(dailyReplayKey());
    if(!playerName || !rec) return Promise.resolve(null);
    return post('/daily', {pid:playerId, name:playerName, day:day, v:Engine.VERSION, rec:rec});
  }
  // After a DAILY game: send today's best and show the player's place under the result.
  function sendDailyResult(r,day){
    submitDaily(day).then(function(res){
      if(!res || lastResult!==r || gameState!=='gameover') return;
      r.rank=res.rank; r.players=res.players;
      renderShareCard(r);
      var line=t('place', res.rank, res.players);
      mainOverlay[1]=(mainOverlay[1] ? mainOverlay[1]+'\n' : '')+line;
      if(!overlay.hidden && !menuEl.hidden) overlaySub.textContent=mainOverlay[1];
    }, function(){});
  }

  function topRow(rank,name,value,me){
    var el=document.createElement('div');
    el.textContent=(rank ? String(rank) : '').padStart(3,' ')+' '+name.padEnd(10,' ')+' '+value.padStart(10,' ');
    if(me) el.className='me';
    topList.appendChild(el);
  }
  function listBoard(rows, me, value){
    rows.forEach(function(r,i){ topRow(r.rank || i+1, r.name, value(r), r.me); });
    if(me && me.rank>rows.length){ topRow(0,'   ...','',false); topRow(me.rank, me.name || playerName, value(me), true); }
  }
  function renderTop(){
    var v=topView, d=topData;
    overlayTitle.textContent = v==='list' ? t('topTitle', dayLabel()) : v==='week' ? t('weekTitle', weekLabel())
      : (v==='name' || v==='code' || v==='profile') ? t('nameTitle') : v.indexOf('ch')===0 ? t('chTitle') : topTitle;
    overlaySub.textContent=''; overlayStats.textContent='';
    menuEl.hidden=true; pauseMenuEl.hidden=true; overlayPrompt.hidden=true; shareRow.hidden=true; battlePanel.hidden=true;
    topPanel.hidden=false;
    overlay.hidden=false;
    topList.textContent='';
    var typing = v==='name' || v==='code';
    nameInput.hidden=!typing;
    nameInput.classList.toggle('codein', v==='code');
    nameInput.maxLength = v==='code' ? 19 : 10;
    nameInput.setAttribute('aria-label', v==='code' ? t('ariaCode') : t('ariaName'));
    topMain.hidden = v==='loading' || v==='chMaking' || (v==='error' && !topRetry);
    topAlt.hidden = !(v==='list' || v==='week' || v==='name' || v==='chResult');
    topWeek.hidden = !(v==='list' || v==='week');
    topBack.textContent = v==='loading' || v==='chMaking' ? t('cancel') : v==='chResult' ? t('toMenu') : t('back');
    var text='';
    switch(v){
      case 'loading': text=t('tLoading'); break;
      case 'error': text=t(topError || 'tNoServer'); topMain.textContent=t('retry'); break;
      case 'name': text=t('tAskName'); topMain.textContent=t('save'); topAlt.textContent=t('haveCode'); break;
      case 'code': text=t('tAskCode'); topMain.textContent=t('restore'); break;
      case 'profile': text=t('tProfile', playerName, fmtCode(playerId)); topMain.textContent=t('changeName'); break;
      case 'list': case 'week':
        var week = v==='week';
        text = !d.players ? t(week ? 'tNobodyWeek' : 'tNobody') : t(week ? 'tPlayersWeek' : 'tPlayers', d.players)+(d.me ? '' : '\n'+t('tPlayToJoin'));
        if(streakLine()) text=streakLine()+'\n'+text;
        listBoard(d.top, d.me, function(r){ return fmtScore(r.score); });
        topMain.textContent=t('play'); topAlt.textContent=t('myName'); topWeek.textContent=t(week ? 'byDay' : 'byWeek');
        break;
      case 'chMaking': text=t('chMaking'); break;
      case 'chReady': text=t('chReady'); topMain.textContent=t('chSend'); break;
      case 'chInvite': case 'chResult':
        var old = d.v!==Engine.VERSION;
        if(v==='chInvite') text = old ? t('chOld') : t('chFrom', d.by, chDesc(d));
        else text = chDesc(d)+'\n'+(d.players<2 ? t('chAlone') : d.me && d.me.rank===1 ? t('chWin') : t('chPlace', d.me ? d.me.rank : '?', d.players));
        listBoard(d.top, d.me, function(r){ return chValue(d.mode, r); });
        if(old) topMain.hidden=true;
        topMain.textContent = v==='chInvite' ? t('chPlay') : t('chAgain');
        topAlt.textContent=t('chSendMore');
        break;
    }
    topText.textContent = topNote ? topNote+'\n\n'+text : text;
  }
  function showTopView(view,note){
    topView=view;
    topNote=note||'';
    if(view==='list' || view==='week') topBase=view;
    renderTop();
  }
  function showTopError(retry,textKey){
    topRetry=retry||null;
    topError=textKey||'';
    showTopView('error');
  }

  function openTop(){
    topTitle=t('topTitle', dayLabel());
    if(!playerName){ askName(); return; }
    loadTop();
  }
  function askName(note){
    topSerial++;
    showTopView('name', note);
    nameInput.value=playerName;
    setTimeout(function(){ nameInput.focus(); },50);
  }
  function askCode(note){
    topSerial++;
    showTopView('code', note);
    nameInput.value='';
    setTimeout(function(){ nameInput.focus(); },50);
  }
  function loadTop(){
    var serial=++topSerial, note='';
    topTitle=t('topTitle', dayLabel());
    showTopView('loading');
    refreshDaily();
    var day=dailyDay;
    // Today's best game goes up first, so one played before picking a name (or offline) still counts.
    submitDaily(day).catch(function(status){
      if(status===409) note='taken';
      else if(status===426) note=t('tUpdate');
    }).then(withPub).then(function(pub){
      return api('/daily/'+day+(pub ? '?me='+pub : ''));
    }).then(function(d){
      if(serial!==topSerial) return;
      topData=d;
      if(note==='taken'){
        // The name was picked on this phone before names were claimed, and someone else has it now.
        var lost=playerName;
        playerName='';
        removeStore('pocket-tetris-name');
        askName(t('tNameLost', lost));
        return;
      }
      showTopView('list', note);
    }).catch(function(){
      if(serial!==topSerial) return;
      showTopError(loadTop);
    });
  }
  function loadWeek(){
    var serial=++topSerial;
    showTopView('loading');
    refreshDaily();
    withPub().then(function(pub){
      return api('/week/'+weekStart(dailyDay)+(pub ? '?me='+pub : ''));
    }).then(function(d){
      if(serial!==topSerial) return;
      topData=d;
      showTopView('week');
    }).catch(function(){
      if(serial!==topSerial) return;
      showTopError(loadWeek);
    });
  }
  function afterName(){
    if(nameThen){ var then=nameThen; nameThen=null; then(); }
    else loadTop();
  }
  function saveName(){
    var n=nameInput.value.trim().replace(/\s+/g,' ').toUpperCase();
    if(!NAME_RE.test(n)){ topText.textContent=t('tBadName'); return; }
    nameInput.blur();
    var serial=++topSerial;
    showTopView('loading');
    post('/name', {pid:playerId, name:n}).then(function(){
      if(serial!==topSerial) return;
      playerName=n;
      writeStore('pocket-tetris-name', n);
      saveProgressSoon();
      afterName();
    }, function(status){
      if(serial!==topSerial) return;
      if(status===409) askName(t('tNameTaken', n));
      else showTopError(function(){ askName(); });
    });
  }
  // A recovery code makes this phone the player from the old one: same id, same name, same progress.
  function restoreCode(){
    var c=nameInput.value.replace(/\s+/g,'').toLowerCase();
    if(!CODE_RE.test(c)){ topText.textContent=t('tBadCode'); return; }
    nameInput.blur();
    var serial=++topSerial;
    showTopView('loading');
    publicId(c).then(function(pub){
      if(!pub) throw 0;
      return api('/name/'+pub);
    }).then(function(res){
      if(serial!==topSerial) return;
      playerId=c; writeStore('pocket-tetris-player', c);
      playerName=res.name; writeStore('pocket-tetris-name', res.name);
      playerPub=null;
      return loadProgress().then(refreshPub).then(function(){
        if(serial!==topSerial) return;
        showToast(t('restored'),1600);
        afterName();
      });
    }, function(status){
      if(serial!==topSerial) return;
      if(status===404) askCode(t('tNoCode'));
      else showTopError(function(){ askCode(); });
    });
  }
  function closeTop(){
    topSerial++;
    topView=null;
    topBase=null;
    nameThen=null;
    nameInput.blur();
    topPanel.hidden=true;
    if(mainOverlay) showOverlay.apply(null, mainOverlay);
  }
  function topGo(){
    switch(topView){
      case 'name': saveName(); break;
      case 'code': restoreCode(); break;
      case 'error': if(topRetry) topRetry(); break;
      case 'profile': askName(); break;
      case 'list': case 'week':
        challenge=null;
        closeTop();
        modeIdx=MODES.map(function(m){ return m.id; }).indexOf('daily');
        selectionChanged();
        startGame();
        break;
      case 'chReady': sendChallenge(); break;
      case 'chInvite': playChallenge(); break;
      case 'chResult': startChallengeGame(); break;
    }
  }
  function topAltAction(){
    if(topView==='name') askCode();
    else if(topView==='list' || topView==='week') showTopView('profile');
    else if(topView==='chResult'){ setChallengeLink(topData); sendChallenge(); }
  }
  function topWeekAction(){
    if(topView==='list') loadWeek();
    else if(topView==='week') loadTop();
  }
  // BACK steps back inside the panel (profile and name to the list they came from, code to name) and otherwise closes it.
  function topBackAction(){
    if(topView==='code'){ askName(); return; }
    if((topView==='profile' || topView==='name') && playerName && topBase && !nameThen){
      topSerial++; nameInput.blur(); showTopView(topBase); return;
    }
    if(topView==='chResult') challenge=null;
    closeTop();
  }
  function topInput(cmd){
    if(cmd==='go' && !topMain.hidden) topGo();
    else if(cmd==='back') topBackAction();
  }
  topBtn.addEventListener('click', function(){ if(inMenu() && performance.now()>=menuLockUntil) openTop(); });
  topMain.addEventListener('click', topGo);
  topAlt.addEventListener('click', topAltAction);
  topWeek.addEventListener('click', topWeekAction);
  topBack.addEventListener('click', topBackAction);
  nameInput.addEventListener('input', function(){
    var v = topView==='code'
      ? nameInput.value.toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,16).replace(/(.{4})(?=.)/g,'$1 ')
      : nameInput.value.toUpperCase().replace(/[^A-Z0-9А-ЯЁ _.-]/g,'').slice(0,10);
    if(v!==nameInput.value) nameInput.value=v;
  });

  /* ---------------- challenges ---------------- */
  // A finished MARATHON, 40 LINES, TIME ATTACK or DIG game can be sent to friends as a challenge: whoever opens
  // the link plays the very same pieces (the game's seed) under the same rules, and the server replays every
  // result, so the table under a challenge is honest. challenge is the one being played, if any.
  var CHALLENGE_MODES={marathon:true, sprint:true, ultra:true, dig:true};
  var challenge=null, chLink='', chText='';
  function canChallenge(r){ return !!(r && CHALLENGE_MODES[r.mode] && r.rec); }
  function randomSeed(){ return crypto.getRandomValues(new Uint32Array(1))[0]; }
  function chDesc(d){ return d.mode==='marathon' ? t('chMarathon', d.opt) : d.mode==='ultra' ? t('chUltra', d.opt) : t('mode.'+d.mode); }
  // A result as the table shows it: points, or for 40 LINES and DIG the time (or how far an unfinished run got).
  function chValue(mode,r){
    if(mode==='sprint' || mode==='dig') return r.done ? fmtTime(r.ticks*Engine.TICK_MS,true) : mode==='dig' ? r.dug+'/'+Engine.DIG_ROWS : r.lines+'/40';
    return fmtScore(r.score);
  }
  function setChallengeLink(d){
    chLink=location.origin+'/?c='+d.id;
    var mine=d.me || d.top[0];
    chText=t('chShareText', chDesc(d), chValue(d.mode, mine));
  }
  function withName(then){
    if(playerName){ then(); return; }
    nameThen=then;
    askName();
  }
  function createChallenge(){
    var r=lastResult;
    if(!canChallenge(r)) return;
    withName(function(){
      var serial=++topSerial;
      showTopView('chMaking');
      post('/challenge', {pid:playerId, name:playerName, mode:r.mode, opt:r.opt, seed:r.seed, v:Engine.VERSION, rec:r.rec}).then(function(res){
        if(serial!==topSerial) return;
        setChallengeLink({id:res.id, mode:r.mode, opt:r.opt, top:[{score:r.score, lines:r.lines, ticks:r.ticks, dug:r.dug, done:r.kind==='complete'}]});
        showTopView('chReady');
      }, function(){
        if(serial!==topSerial) return;
        showTopError(createChallenge);
      });
    });
  }
  function sendChallenge(){
    if(navigator.share) navigator.share({title:'Pocket Tetris', text:chText, url:chLink}).catch(function(){});
    else if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(chText+' '+chLink).then(function(){ showToast(t('linkCopied'),1200); }, function(){});
  }
  function openChallenge(id){
    var serial=++topSerial;
    topTitle=t('chTitle');
    showTopView('loading');
    withPub().then(function(pub){
      return api('/challenge/'+id+(pub ? '?me='+pub : ''));
    }).then(function(d){
      if(serial!==topSerial) return;
      topData=d;
      showTopView('chInvite');
    }, function(status){
      if(serial!==topSerial) return;
      if(status===404) showTopError(null,'chMissing');
      else showTopError(function(){ openChallenge(id); });
    });
  }
  function playChallenge(){
    var d=topData;
    withName(function(){
      challenge={id:d.id, mode:d.mode, opt:d.opt, seed:d.seed};
      startChallengeGame();
    });
  }
  // Plays the challenge: its mode and options become the menu's, and startGame deals its seed (rulesFor).
  function startChallengeGame(){
    modeIdx=MODES.map(function(m){ return m.id; }).indexOf(challenge.mode);
    if(challenge.mode==='marathon') startLevel=challenge.opt;
    if(challenge.mode==='ultra') durIdx=Math.max(0, DURATIONS.indexOf(challenge.opt));
    topSerial++; topView=null; topBase=null; nameInput.blur(); topPanel.hidden=true;
    selectionChanged();
    renderMenu();
    startGame();
  }
  function sendChallengeResult(r){
    var serial=++topSerial, c=challenge;
    topTitle=t('chTitle');
    showTopView('loading');
    post('/challenge/'+c.id+'/result', {pid:playerId, name:playerName, v:Engine.VERSION, rec:r.rec}).then(function(d){
      if(serial!==topSerial) return;
      topData=d;
      showTopView('chResult');
    }, function(){
      if(serial!==topSerial) return;
      showTopError(function(){ sendChallengeResult(r); });
    });
  }
  chBtn.addEventListener('click', function(){ if(inMenu() && performance.now()>=menuLockUntil) createChallenge(); });

  /* ---------------- progress on the server ---------------- */
  // Colors, solved puzzles, spent hints, records and the daily streak are kept on the server under the player's
  // id, so the recovery code brings them to a new phone too. Only players with a name keep progress there.
  var progressTimer=null;
  var RECORD_IDS=['marathon','sprint','ta5','ta7','ta10','dig'], TIME_RECORDS={sprint:true, dig:true};
  function progressData(){
    var rec={};
    RECORD_IDS.forEach(function(k){ rec[k]=Math.round(best[k]||0); });
    return {skins:unlockedSkins.slice(), puzzles:solvedPuzzles.slice(), hints:usedHints.slice(), rec:rec, streak:streak};
  }
  function saveProgressSoon(){
    if(!playerName) return;
    clearTimeout(progressTimer);
    progressTimer=setTimeout(function(){ post('/progress', {pid:playerId, data:progressData()}).catch(function(){}); },3000);
  }
  // Brings in progress from another phone: everything unlocked on either counts, and the better records win.
  function mergeProgress(d){
    (d.skins||[]).forEach(function(id){ if(skinIndex(id)>0 && !isUnlocked(id)) unlockedSkins.push(id); });
    (d.puzzles||[]).forEach(function(i){ if(i<PUZZLES.length && solvedPuzzles.indexOf(i)===-1) solvedPuzzles.push(i); });
    (d.hints||[]).forEach(function(i){ if(i<PUZZLES.length && usedHints.indexOf(i)===-1) usedHints.push(i); });
    var rec=d.rec||{};
    RECORD_IDS.forEach(function(k){
      var v=rec[k]|0;
      if(!v) return;
      if(TIME_RECORDS[k] ? (!best[k] || v<best[k]) : v>best[k]) best[k]=v;
    });
    if(d.streak && (!streak || d.streak.last>streak.last || (d.streak.last===streak.last && d.streak.n>streak.n))) streak=d.streak;
    writeStore('pocket-tetris-colors', JSON.stringify(unlockedSkins));
    writeStore('pocket-tetris-puzzles', JSON.stringify(solvedPuzzles));
    writeStore('pocket-tetris-hints', JSON.stringify(usedHints));
    if(streak) writeStore('pocket-tetris-streak', JSON.stringify(streak));
    saveBest();
    renderMenu();
    updateHud();
  }
  function loadProgress(){
    return post('/progress/load', {pid:playerId}).then(function(r){ if(r && r.data) mergeProgress(r.data); saveProgressSoon(); }, function(){});
  }

  /* ---------------- online battle ---------------- */
  // Two friends play the same pieces (the server hands both the same seed). Clearing 2+ lines sends
  // garbage rows to the rival; whoever tops out first loses. The server only relays messages.
  var SERVER_URL = location.hostname==='127.0.0.1' ? 'http://127.0.0.1:8094' : 'https://pocket-tetris-battle.onrender.com';
  var BATTLE_OPTIONS=['roomNew','roomJoin'];
  // Time can't stop in a match: garbage only rises when a piece locks, so a paused player could never lose.
  // A pause resumes by itself, a player who leaves the app for too long loses, and a rival who goes
  // silent (no board updates, which are also sent as a heartbeat) loses too.
  var BATTLE_PAUSE_MS=5000, BATTLE_AWAY_MS=15000, BATTLE_SILENCE_MS=25000, BATTLE_HEARTBEAT_MS=5000;
  var battleOpt=0, battleSeed=1, rivalBoard='';
  var battle={stage:'idle', code:'', es:null, players:0, pending:0, meReady:false, peerReady:false, title:'', reason:'',
    heardAt:0, sentAt:0, pausedAt:0, hiddenAt:0};
  var pid=randomHex(8);
  var battlePanel=$('battlePanel'), battleText=$('battleText'), battleMain=$('battleMain'), battleBack=$('battleBack'), roomInput=$('roomInput');
  var rivalPanel=$('rivalPanel'), rivalCv=$('rival'), rctx=rivalCv.getContext('2d');

  function battleUiOpen(){ return ['connecting','code','lobby','over'].indexOf(battle.stage)!==-1; }
  function battleRunning(){ return mode==='battle' && ['playing','clearing','paused','countdown'].indexOf(gameState)!==-1; }
  function wakeServer(){ fetch(SERVER_URL+'/health',{cache:'no-store'}).catch(function(){}); }
  function api(path,opts){
    return fetch(SERVER_URL+path, opts||{cache:'no-store'}).then(function(r){
      if(!r.ok) throw r.status;
      return r.status===204 ? null : r.json();
    });
  }
  // text/plain keeps these simple CORS requests, so there is no extra preflight round trip.
  function sendMsg(type,data){
    if(!battle.code) return;
    battle.sentAt=performance.now();
    fetch(SERVER_URL+'/rooms/'+battle.code+'/msg', {method:'POST', headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({pid:pid, type:type, data:data})}).catch(function(){});
  }
  function boardString(){
    var s='';
    for(var r=0;r<ROWS;r++) for(var x=0;x<COLS;x++) s+=board[r][x];
    return s;
  }
  function sendBoard(){ if(mode==='battle' && gameState!=='ready') sendMsg('board', boardString()); }

  function drawRival(){
    var c=rivalCv.width/COLS;
    rctx.fillStyle=pal.bg;
    rctx.fillRect(0,0,rivalCv.width,rivalCv.height);
    for(var i=0;i<rivalBoard.length;i++){
      var v=rivalBoard.charCodeAt(i)-48;
      if(!v) continue;
      rctx.fillStyle = v===2 ? pal.mid : pal.dark;
      rctx.fillRect((i%COLS)*c+1, Math.floor(i/COLS)*c+1, c-2, c-2);
    }
  }

  function showBattle(title,text,main,back,withInput){
    overlayTitle.textContent=title;
    overlaySub.textContent='';
    overlayStats.textContent='';
    menuEl.hidden=true; pauseMenuEl.hidden=true; overlayPrompt.hidden=true; shareRow.hidden=true; topPanel.hidden=true;
    battlePanel.hidden=false;
    battleText.textContent=text;
    battleMain.hidden=!main; battleMain.textContent=main||'';
    battleBack.hidden=!back; battleBack.textContent=back||'';
    roomInput.hidden=!withInput;
    overlay.hidden=false;
    setStartLabel(t('pillStart'), t('ariaStart'));
  }

  function renderLobby(){
    if(battle.stage==='over'){
      var head=(battle.reason ? t(battle.reason)+'\n' : ''), title=t(battle.title);
      if(battle.players<2) showBattle(title, head+t('bFriendLeftRoom'), t('inviteFriend'), t('leave'));
      else if(battle.meReady) showBattle(title, head+t('bWaitRematch'), null, t('leave'));
      else showBattle(title, head+(battle.peerReady ? t('bWantsRematch') : t('bAgain')), t('rematch'), t('leave'));
      return;
    }
    var title=t('roomTitle', battle.code);
    if(battle.players<2) showBattle(title, t('bWaitFriend', battle.code), t('inviteFriend'), t('leave'));
    else if(battle.meReady) showBattle(title, t('bYouReady'), null, t('leave'));
    else showBattle(title, (battle.peerReady ? t('bFriendReady') : t('bFriendHere'))+'\n'+t('bPressReady'), t('ready'), t('leave'));
  }

  function battleError(text){
    battleLeave(false);
    battle.stage='code';
    showBattle(t('battleTitle'), text, null, t('back'));
  }

  function battleCreate(){
    battle.stage='connecting';
    showBattle(t('battleTitle'), t('bConnecting'), null, t('cancel'));
    api('/rooms',{method:'POST'}).then(function(r){
      if(battle.stage==='connecting') openRoom(r.code);
    }).catch(function(status){
      if(battle.stage!=='connecting') return;
      battleError(status===429 ? t('bTooMany') : t('bNoServer'));
    });
  }

  function battleJoinPrompt(){
    battle.stage='code';
    showBattle(t('joinTitle'), t('bEnterCode'), t('join'), t('back'), true);
    roomInput.value='';
    setTimeout(function(){ roomInput.focus(); },50);
  }

  function battleJoin(code){
    code=String(code||'').replace(/\D/g,'');
    if(code.length!==4){ battleText.textContent=t('bNeed4'); return; }
    roomInput.blur();
    battle.stage='connecting';
    showBattle(t('roomTitle', code), t('bJoining'), null, t('cancel'));
    api('/rooms/'+code).then(function(r){
      if(battle.stage!=='connecting') return;
      if(r.players>=2) battleError(t('bRoomTaken', code));
      else openRoom(code);
    }).catch(function(status){
      if(battle.stage!=='connecting') return;
      battleError(status===404 ? t('bRoomMissing', code) : t('bNoServer'));
    });
  }

  function openRoom(code){
    battle.code=code; battle.meReady=false; battle.peerReady=false; battle.players=0;
    var es=new EventSource(SERVER_URL+'/rooms/'+code+'/events?pid='+pid);
    battle.es=es;
    function data(e){ try{ return JSON.parse(e.data); }catch(err){ return {}; } }
    es.addEventListener('joined', function(e){
      battle.players=data(e).players;
      if(battle.stage==='connecting'){ battle.stage='lobby'; renderLobby(); }
    });
    es.addEventListener('peer', function(e){
      var d=data(e);
      battle.players=d.players;
      battle.peerReady=false;
      if(d.left && battleRunning()){ battleResult(true,'bFriendQuit'); return; }
      if(d.left) battle.meReady=false;
      if(battle.stage==='lobby' || battle.stage==='over') renderLobby();
    });
    es.addEventListener('peer-ready', function(){
      battle.peerReady=true;
      if(battle.stage==='lobby' || battle.stage==='over') renderLobby();
    });
    es.addEventListener('start', function(e){ battleCountdown(data(e).seed); });
    es.addEventListener('msg', function(e){ var d=data(e); onBattleMsg(d.type,d.data); });
    es.onerror=function(){
      // EventSource reconnects by itself; it only gives up (CLOSED) when the server refuses the room.
      if(es.readyState===2 && battle.es===es){
        if(battleRunning()) battleResult(false,'bConnLost');
        else battleError(t('bRoomLost'));
      }
    };
  }

  function battleReady(){
    if(battle.players<2 || battle.meReady) return;
    battle.meReady=true;
    sendMsg('ready');
    renderLobby();
  }

  function inviteFriend(){
    var url=location.origin+'/?room='+battle.code;
    var text=t('invite', battle.code);
    if(navigator.share) navigator.share({title:'Pocket Tetris', text:text, url:url}).catch(function(){});
    else if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text+' '+url).then(function(){ showToast(t('linkCopied'),1200); }, function(){});
  }

  function battleLeave(sendLost){
    if(sendLost && battleRunning()) sendMsg('lost');
    if(battle.es){ battle.es.close(); battle.es=null; }
    battle.stage='idle'; battle.code=''; battle.players=0; battle.pending=0; battle.meReady=false; battle.peerReady=false;
    rivalBoard='';
  }

  function backToMenu(){
    battleLeave(false);
    gameState='ready';
    renderMenu();
    showOverlay('TETRIS','','','main');
  }

  battleMain.addEventListener('click', function(){
    if(battle.stage==='code') battleJoin(roomInput.value);
    else if(battle.players<2) inviteFriend();
    else battleReady();
  });
  battleBack.addEventListener('click', backToMenu);
  roomInput.addEventListener('input', function(){ roomInput.value=roomInput.value.replace(/\D/g,'').slice(0,4); });

  function battleInput(cmd){
    if(cmd==='go' && !battleMain.hidden) battleMain.click();
    else if(cmd==='back' && !battleBack.hidden) battleBack.click();
  }

  function battleCountdown(seed){
    battleSeed=seed;
    battle.stage='countdown';
    battle.meReady=false; battle.peerReady=false; battle.reason='';
    rivalBoard='';
    game=null; resetBoard(); piece=null; nextKey=null; heldKey=null;
    hideOverlay();
    gameState='countdown';
    updateHud(); draw(); drawNext(); drawHold(); drawRival();
    var n=3;
    showToast('3',700); sfxMove();
    var timer=setInterval(function(){
      if(battle.stage!=='countdown'){ clearInterval(timer); return; }
      n--;
      if(n>0){ showToast(String(n),700); sfxMove(); return; }
      clearInterval(timer);
      showToast(t('go'),600);
      battle.stage='match';
      battle.pending=0;
      battle.heardAt=performance.now();
      startGame();
      sendBoard();
    },800);
  }

  // Runs every frame of a match: ends a pause that ran out, sends the heartbeat, and notices a rival who went silent.
  function battleTick(now){
    if(battle.stage!=='match' || !battleRunning()) return;
    if(gameState==='paused'){
      var left=BATTLE_PAUSE_MS-(now-battle.pausedAt);
      if(left<=0){ togglePause(); showToast(t('go'),600); }
      else overlaySub.textContent=t('bResumeIn', Math.ceil(left/1000));
    }
    if(now-battle.sentAt>=BATTLE_HEARTBEAT_MS) sendBoard();
    if(now-battle.heardAt>=BATTLE_SILENCE_MS){
      // Tell the rival too: if only their sending broke, they would otherwise wait for us and win by silence as well.
      sendMsg('won');
      battleResult(true,'bRivalGone');
    }
  }

  function battleVisibility(hidden){
    if(!battleRunning()) return;
    var now=performance.now();
    if(hidden){ battle.hiddenAt=now; return; }
    var away = battle.hiddenAt ? now-battle.hiddenAt : 0;
    battle.hiddenAt=0;
    if(battle.stage!=='match') return;
    if(away>=BATTLE_AWAY_MS){ battleResult(false,'bAway'); return; }
    // While the app was in the background the rival's messages may not have arrived, so don't count that as silence;
    // and the pause restarts, so the player gets a moment to look at the board again.
    battle.heardAt=now;
    battle.pausedAt=now;
  }

  function onBattleMsg(type,data){
    battle.heardAt=performance.now();
    if(type==='board'){ rivalBoard=data; drawRival(); }
    else if(type==='attack' && battleRunning() && game){ game.garbage(data); afterEngine(); showToast(t('incoming', data),700); }
    else if(type==='lost' && battleRunning()){ battleResult(true,'bRivalLost'); }
    else if(type==='won' && battleRunning()){ battleResult(false,'bYourConn'); }
  }

  function battleResult(won,reason){
    battle.reason=reason||'';
    endGame(won ? 'win' : 'topout');
  }

  function togglePause(){
    if(gameState==='playing'){
      gameState='paused';
      stopTune();
      stopAllRepeats();
      gesture=null;
      pauseRow=0;
      restartBtn.hidden = mode==='battle';
      battle.pausedAt=performance.now();
      renderPauseMenu();
      showOverlay(t('pause'),'',statsLine(),'pause');
    } else if(gameState==='paused'){
      gameState='playing';
      hideOverlay();
      scheduleTune();
    }
  }

  /* ---------------- pause menu: continue or quit ---------------- */
  var pauseRow=0;
  function pauseItems(){ return [resumeBtn, restartBtn, quitBtn].filter(function(b){ return !b.hidden; }); }
  function renderPauseMenu(){
    var items=pauseItems();
    [resumeBtn, restartBtn, quitBtn].forEach(function(b){ b.classList.toggle('focus', items.indexOf(b)===pauseRow); });
  }

  function quitToMenu(){
    if(gameState!=='paused') return;
    if(mode==='battle') battleLeave(true);
    if(mode==='marathon' && score>best.marathon){ best.marathon=score; saveBest(); }
    gameState='ready';
    game=null;
    if(mode==='puzzle') loadPuzzleBoard(puzzleIdx); else resetBoard();
    piece=null; nextKey=null; heldKey=null; holdUsed=false; puzzleQueue=[];
    score=0; lines=0; level=baseLevel(); elapsed=0;
    applyPalette(Math.floor(level/5));
    updateHud();
    draw(); drawNext(); drawHold();
    powerLed.style.opacity='.35';
    menuRow=0;
    renderMenu();
    showOverlay('TETRIS','','','main');
  }

  function pauseInput(cmd){
    if(!cmd) return;
    if(cmd==='resume'){ togglePause(); return; }
    var items=pauseItems();
    if(cmd==='go'){ items[Math.min(pauseRow, items.length-1)].click(); return; }
    pauseRow = Math.max(0, Math.min(items.length-1, pauseRow + (cmd==='up' ? -1 : 1)));
    sfxMove();
    renderPauseMenu();
  }

  resumeBtn.addEventListener('click', function(){ if(gameState==='paused') togglePause(); });
  restartBtn.addEventListener('click', restartGame);
  quitBtn.addEventListener('click', quitToMenu);
  hintRetryBtn.addEventListener('click', function(){ if(inMenu() && performance.now()>=menuLockUntil) useHint(); });

  /* ---------------- menu: mode and start level ---------------- */
  function renderMenu(){
    var m=MODES[modeIdx];
    refreshDaily();
    modeValEl.textContent=t('mode.'+m.id);
    modeHintEl.textContent = m.id==='daily' ? t('hint.daily', dayLabel()) : t('hint.'+m.id);
    // The second row is the start level in MARATHON, the game length in TIME ATTACK and the level in PUZZLES.
    var hasOption = m.id==='marathon' || m.id==='ultra' || m.id==='puzzle' || m.id==='battle';
    if(m.id==='ultra'){
      levelSelEl.textContent=t('selMinutes', DURATIONS[durIdx]);
      optCapEl.textContent=t('capLength');
    } else if(m.id==='battle'){
      levelSelEl.textContent=t(BATTLE_OPTIONS[battleOpt]);
      optCapEl.textContent=t('capRoom');
    } else if(m.id==='puzzle'){
      levelSelEl.textContent=t('selPuzzle', puzzleName(puzzleIdx));
      optCapEl.textContent=t('capPuzzle', solvedPuzzles.length, PUZZLES.length);
    } else {
      levelSelEl.textContent=t('selLevel', startLevel);
      optCapEl.textContent=t('capStart');
    }
    if(!hasOption && menuRow===1) menuRow=0;
    menuRows[1].hidden=!hasOption;
    optCapEl.hidden=!hasOption;
    var sk=SKINS[skinIdx], open=isUnlocked(sk.id);
    colorValEl.textContent=t('skin.'+sk.id);
    colorHintEl.textContent = open ? t('unlocked', unlockedSkins.length, SKINS.length) : t('how.'+sk.id);
    menuRows[2].classList.toggle('locked', !open);
    for(var i=0;i<menuRows.length;i++) menuRows[i].classList.toggle('focus', menuRow===i);
    renderShareRow();
  }

  function visibleRows(){ return menuRows[1].hidden ? [0,2] : [0,1,2]; }

  function selectionChanged(){
    mode=MODES[modeIdx].id;
    score=0; lines=0; level=baseLevel(); elapsed=0;
    applyPalette(Math.floor(level/5));
    writeStore('pocket-tetris-mode', mode);
    writeStore('pocket-tetris-level', String(startLevel));
    writeStore('pocket-tetris-minutes', String(DURATIONS[durIdx]));
    writeStore('pocket-tetris-puzzle', String(puzzleIdx));
    // Show the chosen puzzle's board behind the menu, so it's clear what the level looks like.
    game=null; piece=null; nextKey=null; heldKey=null;
    if(mode==='puzzle') loadPuzzleBoard(puzzleIdx); else resetBoard();
    draw(); drawNext(); drawHold();
    // The free server sleeps when idle; start waking it as soon as BATTLE or DAILY is picked.
    if(mode==='battle'){ rivalBoard=''; drawRival(); }
    if(mode==='battle' || mode==='daily') wakeServer();
    updateHud();
  }

  function stepPuzzle(d){
    for(var i=1;i<=PUZZLES.length;i++){
      var j=(puzzleIdx+d*i+PUZZLES.length*i)%PUZZLES.length;
      if(puzzleUnlocked(j)){ puzzleIdx=j; return; }
    }
  }

  function menuInput(cmd){
    if(!cmd || performance.now()<menuLockUntil) return;
    if(cmd==='go'){
      if(MODES[modeIdx].id==='battle'){ if(battleOpt===0) battleCreate(); else battleJoinPrompt(); }
      else startGame();
      return;
    }
    if(cmd==='up' || cmd==='down'){
      var rows=visibleRows(), at=Math.max(0, rows.indexOf(menuRow));
      menuRow=rows[Math.max(0, Math.min(rows.length-1, at+(cmd==='up' ? -1 : 1)))];
    } else {
      var d = cmd==='inc' ? 1 : -1;
      if(menuRow===2){
        skinIdx=(skinIdx+d+SKINS.length)%SKINS.length;
        var sk=SKINS[skinIdx];
        // Every color is previewed on the console so it's obvious what this row changes; only unlocked ones are kept.
        applySkin(sk.id);
        if(isUnlocked(sk.id)){ appliedSkin=sk.id; writeStore('pocket-tetris-color', sk.id); }
      } else {
        if(menuRow===0) modeIdx=(modeIdx+d+MODES.length)%MODES.length;
        else if(MODES[modeIdx].id==='ultra') durIdx=(durIdx+d+DURATIONS.length)%DURATIONS.length;
        else if(MODES[modeIdx].id==='puzzle') stepPuzzle(d);
        else if(MODES[modeIdx].id==='battle') battleOpt=1-battleOpt;
        else startLevel=(startLevel+d+10)%10;
        challenge=null;
        selectionChanged();
      }
    }
    sfxMove();
    renderMenu();
  }

  function inMenu(){ return gameState==='ready' || gameState==='gameover'; }

  Array.prototype.forEach.call(menuEl.querySelectorAll('.mbtn'), function(b){
    b.addEventListener('click', function(){
      menuRow=+b.getAttribute('data-row');
      menuInput(b.getAttribute('data-dir')==='1' ? 'inc' : 'dec');
      renderMenu();
    });
  });

  /* ---------------- input ---------------- */
  // A finger tap lasts ~0.2 s, so touch needs a longer delay before auto-repeat than a key press.
  var DAS_TOUCH=300, DAS_KEY=200, DAS_SOFT=120, ARR=45;
  var REPEATING={left:true, right:true, soft:true};
  var repeatTimers={}, keysDown={};

  function startRepeat(action,delay){
    stopRepeat(action);
    repeatTimers[action]=setTimeout(function rep(){
      doAction(action,true);
      repeatTimers[action]=setTimeout(rep,ARR);
    },delay);
  }
  function stopRepeat(action){
    clearTimeout(repeatTimers[action]);
    repeatTimers[action]=null;
  }
  function stopAllRepeats(){
    for(var a in repeatTimers) stopRepeat(a);
    keysDown={};
  }

  var BUTTON_MENU={drop:'up', soft:'down', left:'dec', right:'inc', cw:'go', start:'go'};
  var BUTTON_PAUSE={drop:'up', soft:'down', cw:'go', start:'resume'};
  var BUTTON_BATTLE={cw:'go', start:'go', ccw:'back'};
  // repeat: the action comes from holding a button or dragging, not from a fresh press.
  function doAction(action,repeat){
    if(topOpen()){ topInput(BUTTON_BATTLE[action]); return; }
    if(battleUiOpen()){ battleInput(BUTTON_BATTLE[action]); return; }
    if(inMenu()){ menuInput(BUTTON_MENU[action]); return; }
    if(gameState==='paused'){ pauseInput(BUTTON_PAUSE[action]); return; }
    if(action==='start'){ togglePause(); return; }
    if(game && (gameState==='playing' || gameState==='clearing')){
      // A puzzle piece lowered onto something locks after half a second; a fresh DOWN on it places it right away.
      // Holding DOWN only lowers it, so there is still time to slide it under a ledge.
      var grounded = mode==='puzzle' && game.state==='playing' && game.ghostY()===game.py;
      if(action==='soft' && !repeat && grounded) action='drop';
      game.act(action);
      afterEngine();
      if(gameState==='playing' || gameState==='clearing') draw();
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-action]'), function(btn){
    var action=btn.getAttribute('data-action');
    var activePointer=null;
    btn.addEventListener('pointerdown',function(e){
      if(e.button>0) return;
      e.preventDefault();
      if(activePointer!==null) return;
      activePointer=e.pointerId;
      btn.classList.add('pressed');
      doAction(action);
      if(action==='soft') startRepeat(action, DAS_SOFT);
      // Windows touchpad tap-to-click holds the button ~0.2 s, which would read as a hold, so mouse clicks never slide sideways.
      else if(REPEATING[action] && e.pointerType!=='mouse') startRepeat(action, DAS_TOUCH);
    });
    function release(e){
      if(activePointer===null || e.pointerId!==activePointer) return;
      activePointer=null;
      btn.classList.remove('pressed');
      if(REPEATING[action]) stopRepeat(action);
    }
    btn.addEventListener('pointerup',release);
    btn.addEventListener('pointercancel',release);
    btn.addEventListener('pointerleave',release);
    btn.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  });

  overlay.addEventListener('pointerup', function(e){
    if(e.target.closest('.menu') || battleUiOpen() || topOpen()) return;
    if(gameState==='paused') togglePause();
    else if(inMenu()) menuInput('go');
  });
  consoleEl.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  // iOS shows its magnifier loupe on a long press unless touchstart is cancelled; pointer events still fire.
  // Real buttons are skipped because cancelling touchstart also cancels their click.
  consoleEl.addEventListener('touchstart', function(e){
    if(e.target.closest('.mute, .mbtn, .mitem, .hintpill, input')) return;
    e.preventDefault();
  }, {passive:false});

  var KEYMAP={
    ArrowLeft:'left', ArrowRight:'right', ArrowDown:'soft',
    ArrowUp:'cw', KeyX:'cw', KeyZ:'ccw',
    Space:'drop', Enter:'start', KeyP:'start', Escape:'start',
    KeyC:'hold', ShiftLeft:'hold', ShiftRight:'hold'
  };
  var KEY_MENU={ArrowUp:'up', ArrowDown:'down', ArrowLeft:'dec', ArrowRight:'inc', Enter:'go', Space:'go', KeyP:'go'};
  var KEY_PAUSE={ArrowUp:'up', ArrowDown:'down', Enter:'go', Space:'go', KeyP:'resume', Escape:'resume'};
  window.addEventListener('keydown',function(e){
    if(e.ctrlKey || e.metaKey || e.altKey) return;
    if(topOpen()){
      // Letters go into the name field untouched; only Enter and Escape act on the daily top.
      var tcmd = e.code==='Enter' ? 'go' : e.code==='Escape' ? 'back' : null;
      if(!tcmd) return;
      e.preventDefault();
      if(!e.repeat) topInput(tcmd);
      return;
    }
    if(battleUiOpen()){
      // Digits go into the room code field untouched; only Enter and Escape act on the lobby.
      var bcmd = e.code==='Enter' ? 'go' : e.code==='Escape' ? 'back' : null;
      if(!bcmd) return;
      e.preventDefault();
      if(!e.repeat) battleInput(bcmd);
      return;
    }
    if(inMenu() || gameState==='paused'){
      var cmd=(inMenu() ? KEY_MENU : KEY_PAUSE)[e.code];
      if(!cmd) return;
      e.preventDefault();
      if(e.repeat) return;
      if(inMenu()) menuInput(cmd); else pauseInput(cmd);
      return;
    }
    var action=KEYMAP[e.code];
    if(!action) return;
    e.preventDefault();
    if(e.repeat || keysDown[e.code]) return;
    keysDown[e.code]=true;
    doAction(action);
    if(REPEATING[action]) startRepeat(action, action==='soft' ? DAS_SOFT : DAS_KEY);
  });
  window.addEventListener('keyup',function(e){
    var action=KEYMAP[e.code];
    if(!action) return;
    keysDown[e.code]=false;
    if(REPEATING[action]) stopRepeat(action);
  });

  /* ---------------- swipe gestures on the screen ---------------- */
  var gesture=null;
  var TAP_MS=250, FLICK_SPEED=1.1, FLICK_WINDOW=100;
  function swipeStep(){ return Math.max(8, boardCv.clientWidth*scale/COLS); }

  screenEl.addEventListener('pointerdown',function(e){
    if(e.pointerType==='mouse' || gameState!=='playing' || gesture) return;
    e.preventDefault();
    gesture={id:e.pointerId, x0:e.clientX, y0:e.clientY, ax:e.clientX, ay:e.clientY,
      t0:e.timeStamp, moved:false, serial:pieceSerial, trail:[[e.timeStamp,e.clientY]]};
  });

  screenEl.addEventListener('pointermove',function(e){
    var g=gesture;
    if(!g || e.pointerId!==g.id || gameState!=='playing') return;
    e.preventDefault();
    g.trail.push([e.timeStamp,e.clientY]);
    while(g.trail.length>2 && e.timeStamp-g.trail[0][0]>FLICK_WINDOW) g.trail.shift();
    // A new piece starts its own drag, so the old swipe doesn't keep pushing it.
    if(g.serial!==pieceSerial){
      g.serial=pieceSerial;
      g.x0=g.ax=e.clientX;
      g.y0=g.ay=e.clientY;
      return;
    }
    var step=swipeStep();
    var totX=Math.abs(e.clientX-g.x0), totY=e.clientY-g.y0;
    if(totY>0 && totY>totX*1.5){
      g.ax=e.clientX;
      while(e.clientY-g.ay>=step){ g.ay+=step; g.moved=true; doAction('soft',true); }
    } else {
      g.ay=e.clientY;
      while(e.clientX-g.ax>=step){ g.ax+=step; g.moved=true; doAction('right'); }
      while(g.ax-e.clientX>=step){ g.ax-=step; g.moved=true; doAction('left'); }
    }
  });

  function endGesture(e){
    var g=gesture;
    if(!g || e.pointerId!==g.id) return;
    gesture=null;
    if(e.type==='pointercancel' || gameState!=='playing' || g.serial!==pieceSerial) return;
    var step=swipeStep();
    var dx=e.clientX-g.x0, dy=e.clientY-g.y0, dt=e.timeStamp-g.t0;
    var first=g.trail[0], span=e.timeStamp-first[0];
    var vy=span>0 ? (e.clientY-first[1])/span : 0;
    if(!g.moved && dt<TAP_MS && Math.abs(dx)<step*0.6 && Math.abs(dy)<step*0.6){ doAction('cw'); return; }
    if(dy<-step*2 && -dy>Math.abs(dx)*1.5){ doAction('hold'); return; }
    if(dy>step && vy>FLICK_SPEED && dy>Math.abs(dx)*1.5) doAction('drop');
  }
  screenEl.addEventListener('pointerup',endGesture);
  screenEl.addEventListener('pointercancel',endGesture);

  window.addEventListener('blur', stopAllRepeats);
  document.addEventListener('visibilitychange',function(){
    battleVisibility(document.hidden);
    if(!document.hidden) return;
    stopAllRepeats();
    if(gameState==='playing') togglePause();
  });

  /* ---------------- main loop ---------------- */
  function tick(ts){
    if(lastTs===null) lastTs=ts;
    var dt=Math.min(ts-lastTs, 100);
    lastTs=ts;
    // The engine runs in fixed 1/60 s ticks, however often the screen refreshes: that keeps a game replayable.
    if(game && (gameState==='playing' || gameState==='clearing')){
      tickAcc+=dt;
      var stepped=false;
      while(tickAcc>=Engine.TICK_MS && game.state!=='over'){ tickAcc-=Engine.TICK_MS; game.step(); stepped=true; }
      if(stepped) afterEngine();
      if(gameState==='playing' || gameState==='clearing'){
        if(raceMode() || onTheClock()) updateTimeHud();
        draw();
      }
    }
    battleTick(performance.now());
    requestAnimationFrame(tick);
  }

  /* ---------------- boot ---------------- */
  OLD_RECORD_KEYS.forEach(removeStore);
  refreshDaily();
  for(var bk in BEST_KEYS) best[bk]=parseInt(readStore(BEST_KEYS[bk])||'0',10)||0;
  modeIdx=Math.max(0, MODES.map(function(m){ return m.id; }).indexOf(readStore('pocket-tetris-mode')));
  startLevel=Math.min(9, Math.max(0, parseInt(readStore('pocket-tetris-level')||'0',10)||0));
  durIdx=Math.max(0, DURATIONS.indexOf(parseInt(readStore('pocket-tetris-minutes')||'5',10)));
  try{
    var savedSolved=JSON.parse(readStore('pocket-tetris-puzzles')||'[]');
    if(Array.isArray(savedSolved)) solvedPuzzles=savedSolved.filter(function(i){ return i===(i|0) && i>=0 && i<PUZZLES.length; });
  }catch(e){}
  puzzleIdx=Math.min(PUZZLES.length-1, Math.max(0, parseInt(readStore('pocket-tetris-puzzle')||'0',10)||0));
  if(!puzzleUnlocked(puzzleIdx)) puzzleIdx=0;
  try{
    var savedHints=JSON.parse(readStore('pocket-tetris-hints')||'[]');
    if(Array.isArray(savedHints)) usedHints=savedHints.filter(function(i){ return i===(i|0) && i>=0 && i<PUZZLES.length; });
  }catch(e){}
  applyLang();
  if(!PUZZLES.length && MODES[modeIdx].id==='puzzle') modeIdx=0;
  mode=MODES[modeIdx].id;
  level=baseLevel();
  var savedSound=parseInt(readStore('pocket-tetris-sound'),10);
  soundMode = (savedSound>=0 && savedSound<SOUND_LABELS.length) ? savedSound : (readStore('pocket-tetris-muted')==='1' ? 4 : 0);
  muted = soundMode===4;
  renderMute();
  try{
    var savedSkins=JSON.parse(readStore('pocket-tetris-colors')||'[]');
    if(Array.isArray(savedSkins)) savedSkins.forEach(function(id){ if(skinIndex(id)>0 && !isUnlocked(id)) unlockedSkins.push(id); });
  }catch(e){}
  var savedSkin=readStore('pocket-tetris-color');
  skinIdx = (savedSkin && isUnlocked(savedSkin)) ? skinIndex(savedSkin) : 0;
  appliedSkin=SKINS[skinIdx].id;
  applySkin(appliedSkin);
  if(mode==='puzzle') loadPuzzleBoard(puzzleIdx); else resetBoard();
  applyPalette(Math.floor(level/5));
  updateHud();
  renderMenu();
  showOverlay('TETRIS','','','main');
  powerLed.style.opacity='.35';

  // An invite link (…/?room=1234) drops the friend straight into the room; a challenge link (…/?c=abc234) opens the challenge.
  var linkParams=new URLSearchParams(location.search), linkRoom=linkParams.get('room'), linkChallenge=linkParams.get('c');
  if(linkChallenge && /^[a-z2-9]{6}$/.test(linkChallenge)){
    history.replaceState(null,'',location.pathname);
    openChallenge(linkChallenge);
  } else if(linkRoom && /^\d{4}$/.test(linkRoom)){
    history.replaceState(null,'',location.pathname);
    modeIdx=MODES.map(function(m){ return m.id; }).indexOf('battle');
    selectionChanged();
    renderMenu();
    battleJoin(linkRoom);
  } else if(mode==='battle' || mode==='daily'){
    wakeServer();
  }
  fit();
  window.addEventListener('resize', queueFit);
  window.addEventListener('orientationchange', queueFit);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  requestAnimationFrame(tick);

  /* ---------------- install as app ---------------- */
  var installPrompt=null;
  function setInstallVisible(show){
    installBtn.hidden=!show;
    queueFit();
  }
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault();
    installPrompt=e;
    setInstallVisible(true);
  });
  installBtn.addEventListener('click',function(){
    if(!installPrompt) return;
    installPrompt.prompt();
    var done=function(){ installPrompt=null; setInstallVisible(false); };
    installPrompt.userChoice.then(done,done);
  });
  window.addEventListener('appinstalled',function(){ installPrompt=null; setInstallVisible(false); });

  var isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  var isStandalone=(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone===true;
  if(isIOS && !isStandalone){ iosHint.hidden=false; queueFit(); }

  if('serviceWorker' in navigator && location.protocol!=='file:'){
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('sw.js').catch(function(){});
    });
  }
})();
