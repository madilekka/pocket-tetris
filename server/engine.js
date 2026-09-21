// Pocket Tetris rules: pieces, moves, gravity, line clears, scoring and levels, stepped at a fixed 60 ticks a second.
// The game runs this file in the browser, and the server runs the very same file to replay a DAILY game from its
// recorded key presses and count the score itself, so a submitted score can't be made up.
// So nothing here may depend on the screen, the clock or floating-point rounding: all timing is whole ticks and all
// arithmetic is on integers, and the same inputs at the same ticks give the same game in every browser and in Node.
// It lives in server/ so that any change to it redeploys the server along with the site.
(function(root,factory){
  if(typeof module==='object' && module.exports) module.exports=factory();
  else root.PocketEngine=factory();
})(this,function(){
  "use strict";
  // Bumped whenever a rule change would replay old recordings differently; the server refuses other versions.
  var VERSION=1;
  var COLS=10, ROWS=20, TICKS_PER_SECOND=60, TICK_MS=1000/TICKS_PER_SECOND;
  var SHAPES={
    I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O:[[1,1],[1,1]],
    T:[[0,1,0],[1,1,1],[0,0,0]],
    S:[[0,1,1],[1,1,0],[0,0,0]],
    Z:[[1,1,0],[0,1,1],[0,0,0]],
    J:[[1,0,0],[1,1,1],[0,0,0]],
    L:[[0,0,1],[1,1,1],[0,0,0]]
  };
  var KEYS=['I','O','T','S','Z','J','L'];
  // A turn takes the first of these shifts that fits (tools/puzzlegen.js repeats this list).
  var KICKS=[[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1]];
  var SCORE_TABLE=[0,40,100,300,1200];
  var ATTACK=[0,0,1,2,4];
  // Modern (guideline) gravity: seconds per row = (0.8 - 0.007*level)^level, as rows per tick in 1/65536ths, so that
  // it's exact integers everywhere. Level 0 takes 1 s a row, 5 about 0.26 s, 10 about 0.04 s, and from 18 a piece
  // lands the moment it appears (20 rows a tick).
  var GRAVITY=[1092,1377,1768,2311,3075,4169,5759,8107,11634,17026,25416,38709,60169,95483,154742,256187,433425,749597,1310720];
  var ROW=65536;
  // A grounded piece locks after 15 ticks (0.25 s), and moving or turning it restarts that wait up to 15 times.
  // Gravity can't get harsher past level 18, so from level 20 the wait shrinks by a tick a level, to 9 ticks.
  var LOCK_TICKS=15, MIN_LOCK_TICKS=9, MAX_LOCK_RESETS=15;
  // In puzzles a piece the player has lowered onto something locks after half a second.
  var PUZZLE_LOCK_TICKS=30;
  var CLEAR_TICKS=11;
  // Battles speed up every 30 seconds, up to level 15, so a match always ends.
  var BATTLE_LEVEL_TICKS=30*TICKS_PER_SECOND, BATTLE_MAX_LEVEL=15;

  function gravityFor(level){ return GRAVITY[Math.min(level, GRAVITY.length-1)]; }
  function lockTicksFor(level){ return Math.max(MIN_LOCK_TICKS, LOCK_TICKS-Math.max(0, level-19)); }

  function seededRandom(seed){
    var a=seed>>>0;
    return function(){
      a=(a+0x6D2B79F5)>>>0;
      var t=Math.imul(a^(a>>>15), a|1);
      t^=t+Math.imul(t^(t>>>7), t|61);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }
  function emptyMatrix(n){
    var m=[];
    for(var i=0;i<n;i++){ var row=[]; for(var j=0;j<n;j++) row.push(0); m.push(row); }
    return m;
  }
  function rotateCW(m){
    var n=m.length, r=emptyMatrix(n);
    for(var i=0;i<n;i++) for(var j=0;j<n;j++) r[j][n-1-i]=m[i][j];
    return r;
  }
  function rotateCCW(m){
    var n=m.length, r=emptyMatrix(n);
    for(var i=0;i<n;i++) for(var j=0;j<n;j++) r[n-1-j][i]=m[i][j];
    return r;
  }
  function emptyRow(){ var r=[]; for(var x=0;x<COLS;x++) r.push(0); return r; }
  function emptyBoard(){ var b=[]; for(var y=0;y<ROWS;y++) b.push(emptyRow()); return b; }
  // Puzzle rows go top to bottom and sit on the floor; '#' is a block.
  function puzzleBoard(rows){
    var b=emptyBoard();
    for(var k=0;k<rows.length;k++){
      for(var x=0;x<COLS;x++) b[ROWS-rows.length+k][x] = rows[k].charAt(x)==='#' ? 1 : 0;
    }
    return b;
  }

  // Everyone gets the same DAILY: the pieces are shuffled with a seed from the date (YYYYMMDD in UTC+5).
  function dailyRules(day){
    return {startLevel:0, linesPerLevel:5, timeLimitTicks:5*60*TICKS_PER_SECOND, seed:Math.imul(day, 2654435761)};
  }

  // Inputs, as recorded: one letter per action, and A..J for 1..10 incoming garbage rows in a battle.
  var ACTION_CODES={left:'l', right:'r', soft:'s', cw:'c', ccw:'a', drop:'d', hold:'h'};
  var CODE_ACTIONS={l:'left', r:'right', s:'soft', c:'cw', a:'ccw', d:'drop', h:'hold'};

  // rules: startLevel; linesPerLevel (0: the level doesn't rise with lines); timeLimitTicks (0: no limit);
  // goalLines (0: none); seed (a number for a fixed piece order, otherwise Math.random); puzzle ({rows, pieces}:
  // pieces don't fall and the goal is an empty board); battle (garbage rises, level rises with time); record.
  function create(rules){
    var g={
      rules:rules, board:rules.puzzle ? puzzleBoard(rules.puzzle.rows) : emptyBoard(),
      piece:null, key:null, next:null, held:null, holdUsed:false, px:0, py:0,
      score:0, lines:0, level:rules.startLevel||0, combo:-1, backToBack:false,
      tick:0, state:'playing', over:null, clearRows:null, clearLeft:0,
      gravityAcc:0, lockTimer:0, lockResets:0, pieceCounts:{}, serial:0, pending:0,
      queue:rules.puzzle ? rules.puzzle.pieces.split('') : [], events:[]
    };
    var random = typeof rules.seed==='number' ? seededRandom(rules.seed) : Math.random;
    var garbageRandom = typeof rules.seed==='number' ? seededRandom(rules.seed ^ 0x5bd1e995) : Math.random;
    var bag=[], log=[], lastLogTick=0;

    function emit(e){ g.events.push(e); }
    function note(code){
      if(!rules.record) return;
      log.push(code+(g.tick-lastLogTick));
      lastLogTick=g.tick;
    }
    function end(kind){
      if(g.state==='over') return;
      g.state='over';
      g.over=kind;
      emit({t:'over', kind:kind});
    }

    function nextFromBag(){
      if(bag.length===0){
        bag=KEYS.slice();
        for(var i=bag.length-1;i>0;i--){ var j=(random()*(i+1))|0; var t=bag[i]; bag[i]=bag[j]; bag[j]=t; }
      }
      return bag.pop();
    }
    function nextPiece(){
      if(rules.puzzle) return g.queue.length ? g.queue.shift() : null;
      return nextFromBag();
    }
    function collides(shape,ox,oy){
      for(var r=0;r<shape.length;r++){
        for(var c=0;c<shape[r].length;c++){
          if(!shape[r][c]) continue;
          var x=ox+c, y=oy+r;
          if(x<0||x>=COLS||y>=ROWS) return true;
          if(y>=0 && g.board[y][x]) return true;
        }
      }
      return false;
    }
    function placeAtTop(key){
      g.key=key;
      g.piece=SHAPES[key].map(function(row){ return row.slice(); });
      g.px=((COLS-g.piece[0].length)/2)|0;
      g.py=0;
      g.lockTimer=0;
      g.lockResets=0;
      g.serial++;
    }
    function spawn(){
      var key=g.next || nextPiece();
      // In puzzles the held piece is played last once the list runs out.
      if(!key && g.held){ key=g.held; g.held=null; }
      if(!key){ end('nopieces'); return; }
      placeAtTop(key);
      g.next=nextPiece();
      g.pieceCounts[key]=(g.pieceCounts[key]||0)+1;
      emit({t:'spawn'});
      if(collides(g.piece,g.px,g.py)) end('topout');
    }
    function bumpLock(){
      if(g.lockTimer>0 && g.lockResets<MAX_LOCK_RESETS){ g.lockTimer=0; g.lockResets++; }
    }
    function tryMove(dx,dy){
      if(collides(g.piece,g.px+dx,g.py+dy)) return false;
      g.px+=dx; g.py+=dy;
      if(dx!==0){ emit({t:'move'}); bumpLock(); }
      return true;
    }
    function tryRotate(cw){
      var r=cw ? rotateCW(g.piece) : rotateCCW(g.piece);
      for(var i=0;i<KICKS.length;i++){
        var kx=KICKS[i][0], ky=KICKS[i][1];
        if(!collides(r,g.px+kx,g.py+ky)){ g.piece=r; g.px+=kx; g.py+=ky; emit({t:'rotate'}); bumpLock(); return; }
      }
    }
    function ghostY(){
      var gy=g.py;
      while(!collides(g.piece,g.px,gy+1)) gy++;
      return gy;
    }
    function boardEmpty(){
      for(var y=0;y<ROWS;y++) for(var x=0;x<COLS;x++) if(g.board[y][x]) return false;
      return true;
    }
    // Incoming garbage rises from the bottom with one gap; returns true if it pushed blocks off the top.
    function addGarbage(n){
      var hole=Math.floor(garbageRandom()*COLS), overflow=false;
      for(var i=0;i<n;i++){
        var top=g.board.shift();
        for(var x=0;x<COLS;x++) if(top[x]) overflow=true;
        var row=emptyRow();
        for(var k=0;k<COLS;k++) row[k]= k===hole ? 0 : 2;
        g.board.push(row);
      }
      return overflow;
    }

    function lock(){
      var cells=[];
      for(var r=0;r<g.piece.length;r++){
        for(var c=0;c<g.piece[r].length;c++){
          if(g.piece[r][c] && g.py+r>=0){ g.board[g.py+r][g.px+c]=1; cells.push([g.px+c, g.py+r]); }
        }
      }
      g.gravityAcc=0;
      // Where the piece landed, for the puzzle hint to check the player followed it.
      emit({t:'lock', cells:cells});
      var rows=[];
      for(var y=0;y<ROWS;y++){
        var full=true;
        for(var x=0;x<COLS;x++) if(!g.board[y][x]){ full=false; break; }
        if(full) rows.push(y);
      }
      if(rows.length){
        g.state='clearing';
        g.clearRows=rows;
        g.clearLeft=CLEAR_TICKS;
        return;
      }
      g.combo=-1;
      if(rules.battle && g.pending>0){
        var overflow=addGarbage(g.pending);
        g.pending=0;
        if(overflow){ end('topout'); return; }
      }
      spawn();
      g.holdUsed=false;
    }

    function finishClear(){
      var rows=g.clearRows;
      for(var i=rows.length-1;i>=0;i--) g.board.splice(rows[i],1);
      for(var k=0;k<rows.length;k++) g.board.unshift(emptyRow());
      var cleared=rows.length, level=g.level, b2b=false, sent=0, leveledUp=false;
      g.lines+=cleared;
      g.score+=SCORE_TABLE[cleared]*(level+1);
      g.combo++;
      if(g.combo>0) g.score+=50*g.combo*(level+1);
      if(cleared===4){
        if(g.backToBack){ g.score+=SCORE_TABLE[4]*(level+1)/2; b2b=true; }
        g.backToBack=true;
      } else {
        g.backToBack=false;
      }
      if(rules.battle){
        // Clears first cancel garbage that is waiting to rise, the rest goes to the rival.
        var attack=ATTACK[cleared]+(g.combo>=2 ? 1 : 0);
        var cancel=Math.min(g.pending, attack);
        g.pending-=cancel;
        sent=attack-cancel;
      }
      if(!rules.puzzle && !rules.battle && rules.linesPerLevel){
        var newLevel=(rules.startLevel||0)+Math.floor(g.lines/rules.linesPerLevel);
        if(newLevel>g.level){ g.level=newLevel; leveledUp=true; }
      }
      g.clearRows=null;
      g.state='playing';
      emit({t:'clear', n:cleared, b2b:b2b, combo:g.combo, sent:sent, leveledUp:leveledUp});
      if(rules.goalLines && g.lines>=rules.goalLines){ end('complete'); return; }
      if(rules.puzzle && boardEmpty()){ end('solved'); return; }
      spawn();
      g.holdUsed=false;
    }

    function hold(){
      if(g.holdUsed) return;
      g.holdUsed=true;
      var cur=g.key;
      if(g.held===null){
        g.held=cur;
        spawn();
      } else {
        var swap=g.held;
        g.held=cur;
        placeAtTop(swap);
        if(collides(g.piece,g.px,g.py)) end('topout');
      }
      emit({t:'hold'});
    }

    // A player's action; ignored unless a piece is in play.
    g.act=function(action){
      if(g.state!=='playing' || !ACTION_CODES[action]) return;
      note(ACTION_CODES[action]);
      switch(action){
        case 'left': tryMove(-1,0); break;
        case 'right': tryMove(1,0); break;
        case 'soft': if(tryMove(0,1)){ g.score+=1; g.gravityAcc=0; } break;
        case 'cw': tryRotate(true); break;
        case 'ccw': tryRotate(false); break;
        case 'drop': var gy=ghostY(); g.score+=2*(gy-g.py); g.py=gy; lock(); break;
        case 'hold': hold(); break;
      }
    };
    // Garbage the rival sent in a battle; it rises when the next piece locks without clearing a line.
    g.garbage=function(n){
      if(g.state==='over' || !(n>=1 && n<=10)) return;
      note(String.fromCharCode(64+n));
      g.pending+=n;
    };
    // One tick of time.
    g.step=function(){
      if(g.state==='over') return;
      g.tick++;
      if(g.state==='clearing'){
        if(--g.clearLeft<=0) finishClear();
        return;
      }
      if(rules.timeLimitTicks && g.tick>=rules.timeLimitTicks){ end('timeup'); return; }
      if(rules.battle){
        var lv=Math.min(BATTLE_MAX_LEVEL, Math.floor(g.tick/BATTLE_LEVEL_TICKS));
        if(lv>g.level){ g.level=lv; emit({t:'level'}); }
      }
      // Puzzle pieces don't fall on their own, so the player has time to think; once lowered onto something,
      // they lock like any other piece, just after a longer wait.
      if(!rules.puzzle){
        g.gravityAcc+=gravityFor(g.level);
        while(g.gravityAcc>=ROW){
          g.gravityAcc-=ROW;
          if(!tryMove(0,1)){ g.gravityAcc=0; break; }
        }
      }
      if(collides(g.piece,g.px,g.py+1)){
        if(++g.lockTimer>=(rules.puzzle ? PUZZLE_LOCK_TICKS : lockTicksFor(g.level))) lock();
      } else {
        g.lockTimer=0;
      }
    };
    g.ghostY=ghostY;
    g.elapsedMs=function(){ return g.tick*TICK_MS; };
    g.recording=function(){ return log.join(''); };
    g.takeEvents=function(){ var e=g.events; g.events=[]; return e; };

    spawn();
    return g;
  }

  // Plays a recording back from the start; returns the finished game, or null if the recording is malformed.
  // Inputs are applied before the tick they were recorded at, exactly as they were in the browser.
  function replay(rules, recording, maxTicks){
    if(typeof recording!=='string' || !/^([a-zA-Z]\d+)*$/.test(recording)) return null;
    var g=create(rules), re=/([a-zA-Z])(\d+)/g, m, at=0;
    var limit=maxTicks || (rules.timeLimitTicks ? rules.timeLimitTicks+TICKS_PER_SECOND : 60*60*TICKS_PER_SECOND);
    while((m=re.exec(recording))){
      at+=parseInt(m[2],10);
      while(g.tick<at && g.state!=='over' && g.tick<limit) g.step();
      if(g.state==='over' || g.tick>=limit) break;
      var code=m[1];
      if(CODE_ACTIONS[code]) g.act(CODE_ACTIONS[code]);
      else if(code>='A' && code<='J') g.garbage(code.charCodeAt(0)-64);
      else return null;
    }
    while(g.state!=='over' && g.tick<limit) g.step();
    g.takeEvents();
    return g;
  }

  return {
    VERSION:VERSION, COLS:COLS, ROWS:ROWS, TICK_MS:TICK_MS, TICKS_PER_SECOND:TICKS_PER_SECOND,
    SHAPES:SHAPES, KEYS:KEYS, KICKS:KICKS,
    create:create, replay:replay, dailyRules:dailyRules, puzzleBoard:puzzleBoard, emptyBoard:emptyBoard
  };
});
