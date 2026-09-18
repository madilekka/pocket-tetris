(function(){
  "use strict";
  var COLS=10, ROWS=20;
  var CELL=16;
  function $(id){ return document.getElementById(id); }
  var boardCv=$('board'), bctx=boardCv.getContext('2d');
  var nextCv=$('next'), nctx=nextCv.getContext('2d');
  var holdCv=$('hold'), hctx=holdCv.getContext('2d');
  var toastEl=$('toast'), overlay=$('overlay'), overlayTitle=$('overlayTitle'), overlaySub=$('overlaySub'), overlayStats=$('overlayStats');
  var linesVal=$('linesVal'), levelVal=$('levelVal'), scoreVal=$('scoreVal'), topVal=$('topVal'), topLabel=$('topLabel');
  var timePanel=$('timePanel'), timeVal=$('timeVal'), lvBar=$('lvBar'), lvLeft=$('lvLeft');
  var menuEl=$('menu'), modeValEl=$('modeVal'), modeHintEl=$('modeHint'), levelSelEl=$('levelSel');
  var menuRows=[$('rowMode'), $('rowLevel')];
  var muteBtn=$('muteBtn'), powerLed=$('powerLed');
  var consoleEl=$('console'), fitEl=$('fit'), belowEl=$('below'), screenEl=$('screen');
  var installBtn=$('installBtn'), iosHint=$('iosHint');

  var lvCells=[];
  for(var li=0;li<10;li++){ var cellEl=document.createElement('i'); lvBar.appendChild(cellEl); lvCells.push(cellEl); }

  /* ---------------- modes ---------------- */
  var MODES=[
    {id:'marathon', name:'MARATHON', hint:'ENDLESS'},
    {id:'sprint', name:'40 LINES', hint:'BEAT THE CLOCK'},
    {id:'ultra', name:'2 MINUTES', hint:'MAX SCORE'}
  ];
  var SPRINT_LINES=40, ULTRA_MS=120000;
  var modeIdx=0, mode='marathon', startLevel=0, menuRow=0, menuLockUntil=0;
  var best={marathon:0, sprint:0, ultra:0};
  var BEST_KEYS={marathon:'pocket-tetris-high', sprint:'pocket-tetris-best-sprint', ultra:'pocket-tetris-best-ultra'};

  /* ---------------- pieces ---------------- */
  var SHAPES={
    I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O:[[1,1],[1,1]],
    T:[[0,1,0],[1,1,1],[0,0,0]],
    S:[[0,1,1],[1,1,0],[0,0,0]],
    Z:[[1,1,0],[0,1,1],[0,0,0]],
    J:[[1,0,0],[1,1,1],[0,0,0]],
    L:[[0,0,1],[1,1,1],[0,0,0]]
  };
  var KEYS=Object.keys(SHAPES);

  function emptyMatrix(n){
    var m=[];
    for(var i=0;i<n;i++){ m.push(new Array(n).fill(0)); }
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

  var bag=[];
  function newBag(){
    var b=KEYS.slice();
    for(var i=b.length-1;i>0;i--){ var j=(Math.random()*(i+1))|0; var t=b[i]; b[i]=b[j]; b[j]=t; }
    return b;
  }
  function nextFromBag(){ if(bag.length===0) bag=newBag(); return bag.pop(); }

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
  }

  /* ---------------- state ---------------- */
  var board=[], piece=null, pieceKey=null, nextKey=null, heldKey=null, px=0, py=0;
  var score=0, lines=0, level=0, dropAcc=0, lockTimer=0, lastTs=null, elapsed=0;
  var gameState='ready', holdUsed=false, combo=-1, backToBack=false;
  var flashRows=null, pieceCounts={}, scale=1, pieceSerial=0;
  // A grounded piece locks after a short fixed delay, not after a full gravity step (1 s at level 0).
  var LOCK_DELAY=250, MAX_LOCK_RESETS=15, lockResets=0;

  function resetBoard(){
    board=[];
    for(var r=0;r<ROWS;r++) board.push(new Array(COLS).fill(0));
  }

  function placeAtTop(key){
    pieceKey=key;
    piece=SHAPES[key].map(function(row){ return row.slice(); });
    px=((COLS - piece[0].length) / 2) | 0;
    py=0;
    lockTimer=0;
    lockResets=0;
    pieceSerial++;
  }

  function bumpLock(){
    if(lockTimer>0 && lockResets<MAX_LOCK_RESETS){ lockTimer=0; lockResets++; }
  }

  function spawn(){
    placeAtTop(nextKey || nextFromBag());
    nextKey=nextFromBag();
    pieceCounts[pieceKey]=(pieceCounts[pieceKey]||0)+1;
    drawNext();
    if(collides(piece,px,py)) endGame('topout');
  }

  function doHold(){
    if(gameState!=='playing' || holdUsed) return;
    holdUsed=true;
    var cur=pieceKey;
    if(heldKey===null){
      heldKey=cur;
      spawn();
    } else {
      var swap=heldKey;
      heldKey=cur;
      placeAtTop(swap);
      if(collides(piece,px,py)) endGame('topout');
    }
    sfxRotate();
    drawHold();
    draw();
  }

  function collides(shape,ox,oy){
    for(var r=0;r<shape.length;r++){
      for(var c=0;c<shape[r].length;c++){
        if(!shape[r][c]) continue;
        var x=ox+c, y=oy+r;
        if(x<0||x>=COLS||y>=ROWS) return true;
        if(y>=0 && board[y][x]) return true;
      }
    }
    return false;
  }

  function merge(){
    for(var r=0;r<piece.length;r++){
      for(var c=0;c<piece[r].length;c++){
        if(piece[r][c] && py+r>=0) board[py+r][px+c]=1;
      }
    }
  }

  var SCORE_TABLE=[0,40,100,300,1200];
  var CLEAR_NAMES=['','SINGLE','DOUBLE','TRIPLE','TETRIS'];

  function findFullRows(){
    var rows=[];
    for(var r=0;r<ROWS;r++){ if(board[r].every(function(v){ return v; })) rows.push(r); }
    return rows;
  }

  function finishClear(rows){
    for(var i=rows.length-1;i>=0;i--) board.splice(rows[i],1);
    for(var k=0;k<rows.length;k++) board.unshift(new Array(COLS).fill(0));
    var cleared=rows.length;
    lines+=cleared;
    score+=SCORE_TABLE[cleared]*(level+1);
    combo++;
    if(combo>0) score+=50*combo*(level+1);
    var msg=CLEAR_NAMES[cleared];
    if(cleared===4){
      if(backToBack){ score+=Math.floor(SCORE_TABLE[4]*(level+1)*0.5); msg+='\nBACK-TO-BACK'; }
      backToBack=true;
    } else {
      backToBack=false;
    }
    var leveledUp=false;
    if(mode!=='sprint'){
      var newLevel=startLevel+Math.floor(lines/10);
      leveledUp=newLevel>level;
      if(leveledUp){ level=newLevel; applyPalette(Math.floor(level/5)); }
    }
    if(combo>0) msg+='\nCOMBO x'+combo;
    updateHud();
    sfxClear(cleared);
    if(leveledUp) sfxLevel();
    showToast(msg,800);
    flashRows=null;
    if(mode==='sprint' && lines>=SPRINT_LINES){ endGame('complete'); return; }
    gameState='playing';
    spawn();
    holdUsed=false;
    drawHold();
    draw();
  }

  function ghostY(){
    var gy=py;
    while(!collides(piece,px,gy+1)) gy++;
    return gy;
  }

  function hardDrop(){
    if(gameState!=='playing') return;
    var gy=ghostY();
    score+=2*(gy-py);
    py=gy;
    updateHud();
    lock();
  }

  function lock(){
    merge();
    sfxLock();
    dropAcc=0;
    var rows=findFullRows();
    if(rows.length>0){
      gameState='clearing';
      flashRows=rows;
      draw();
      setTimeout(function(){ finishClear(rows); },180);
    } else {
      combo=-1;
      spawn();
      holdUsed=false;
      drawHold();
      draw();
    }
  }

  function tryMove(dx,dy){
    if(gameState!=='playing') return false;
    if(collides(piece,px+dx,py+dy)) return false;
    px+=dx; py+=dy;
    if(dx!==0){ sfxMove(); bumpLock(); }
    return true;
  }

  var KICKS=[[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1]];
  function tryRotate(cw){
    if(gameState!=='playing') return;
    var r=cw?rotateCW(piece):rotateCCW(piece);
    for(var i=0;i<KICKS.length;i++){
      var kx=KICKS[i][0], ky=KICKS[i][1];
      if(!collides(r,px+kx,py+ky)){ piece=r; px+=kx; py+=ky; sfxRotate(); bumpLock(); return; }
    }
  }

  function speedForLevel(l){ return Math.max(1000 - l*70, 90); }

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
    if(mode==='sprint') return fmtTime(elapsed,true);
    return fmtTime(Math.ceil(Math.max(0,ULTRA_MS-elapsed)/1000)*1000,false);
  }
  function inGame(){ return gameState==='playing' || gameState==='paused' || gameState==='clearing'; }
  function bestText(){
    if(mode==='sprint') return best.sprint ? fmtTime(best.sprint,true) : '--';
    return inGame() ? Math.max(best[mode],score) : best[mode];
  }
  var lastTimeText='';
  function updateTimeHud(){
    var t=timeText();
    if(t===lastTimeText) return;
    lastTimeText=t;
    setNum(timeVal,t);
  }
  function updateHud(){
    linesVal.textContent=String(lines).padStart(3,'0');
    var toGo, filled;
    if(mode==='sprint'){
      toGo=Math.max(0,SPRINT_LINES-lines);
      filled=Math.min(10,Math.floor(lines/(SPRINT_LINES/10)));
    } else {
      toGo=10-(lines%10);
      filled=lines%10;
    }
    for(var i=0;i<10;i++) lvCells[i].classList.toggle('on', i<filled);
    lvLeft.textContent=String(toGo);
    setNum(levelVal,level);
    setNum(scoreVal,score);
    timePanel.hidden = mode==='marathon';
    topLabel.textContent = mode==='marathon' ? 'TOP' : 'BEST';
    setNum(topVal,bestText());
    lastTimeText='';
    updateTimeHud();
  }
  function readStore(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } }
  function writeStore(key,val){ try{ localStorage.setItem(key,val); }catch(e){} }
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
        if(board[r][col]) drawBlock(bctx, col*c, r*c, c, isFlash ? pal.light : pal.dark);
      }
    }
    if(piece && (gameState==='playing' || gameState==='paused')){
      var gy=ghostY(), lw=gapFor(c);
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

  var TUNE=[
    [659,.2],[493,.1],[523,.2],[587,.2],[523,.1],[493,.1],[440,.2],[440,.1],[523,.2],[659,.2],[587,.1],[523,.1],[493,.3],[523,.2],[587,.2],[659,.2],
    [523,.2],[440,.2],[440,.2],[0,.2],[587,.2],[698,.1],[880,.2],[784,.1],[698,.1],[659,.3],[523,.1],[659,.2],[587,.1],[523,.1],[493,.2],[493,.1],
    [523,.2],[587,.2],[659,.2],[523,.2],[440,.2],[440,.2],[0,.4]
  ];
  var tuneTimeout=null, tuneBus=null;
  function scheduleTune(){
    stopTune();
    if(muted||!actx) return;
    tuneBus=actx.createGain();
    tuneBus.connect(actx.destination);
    var t=0;
    for(var i=0;i<TUNE.length;i++){
      if(TUNE[i][0]>0) beep(TUNE[i][0],TUNE[i][1]*0.9,'square',0.028,t,tuneBus);
      t+=TUNE[i][1];
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
    muteBtn.textContent = muted ? '×' : '♪';
  }
  muteBtn.addEventListener('click',function(){
    muted=!muted;
    writeStore('pocket-tetris-muted', muted ? '1' : '0');
    renderMute();
    if(muted) stopTune();
    else { ensureAudio(); if(gameState==='playing') scheduleTune(); }
  });

  ['pointerup','touchend','click','keydown'].forEach(function(type){
    document.addEventListener(type, ensureAudio, true);
  });

  /* ---------------- game flow ---------------- */
  function showOverlay(title,sub,stats,withMenu){
    overlayTitle.textContent=title;
    overlaySub.textContent=sub||'';
    overlayStats.textContent=stats||'';
    menuEl.hidden=!withMenu;
    overlay.hidden=false;
  }
  function hideOverlay(){ overlay.hidden=true; }

  function startGame(){
    ensureAudio();
    resetBoard();
    mode=MODES[modeIdx].id;
    score=0; lines=0; level=startLevel; elapsed=0; dropAcc=0; lockTimer=0;
    nextKey=null; heldKey=null; holdUsed=false; combo=-1; backToBack=false; flashRows=null;
    pieceCounts={};
    bag=[];
    gesture=null;
    applyPalette(Math.floor(level/5));
    hideOverlay();
    gameState='playing';
    updateHud();
    powerLed.style.opacity='1';
    spawn();
    drawHold();
    draw();
    scheduleTune();
  }

  function endGame(kind){
    gameState='gameover';
    stopTune();
    stopAllRepeats();
    gesture=null;
    // Ignore menu input briefly, so taps meant for the last piece don't restart the game.
    menuLockUntil=performance.now()+900;
    var title='GAME OVER', sub='', record=false;
    if(kind==='complete'){
      title='COMPLETE';
      sub='TIME '+fmtTime(elapsed,true);
      if(!best.sprint || elapsed<best.sprint){ best.sprint=Math.round(elapsed); record=true; }
      sfxLevel();
    } else if(kind==='timeup'){
      title='TIME UP';
      sub='SCORE '+score;
      if(score>best.ultra){ best.ultra=score; record=true; }
      sfxLevel();
    } else {
      if(mode==='marathon' && score>best.marathon){ best.marathon=score; record=true; }
      sfxGameOver();
    }
    saveBest();
    updateHud();
    draw();
    powerLed.style.opacity='.35';
    showOverlay(title, (record ? 'NEW RECORD' + (sub ? '\n' : '') : '') + sub, statsLine(), true);
  }

  function togglePause(){
    if(gameState==='playing'){
      gameState='paused';
      stopTune();
      stopAllRepeats();
      gesture=null;
      showOverlay('PAUSE','',statsLine(),false);
    } else if(gameState==='paused'){
      gameState='playing';
      hideOverlay();
      scheduleTune();
    }
  }

  /* ---------------- menu: mode and start level ---------------- */
  function renderMenu(){
    var m=MODES[modeIdx];
    modeValEl.textContent=m.name;
    modeHintEl.textContent=m.hint;
    levelSelEl.textContent='LEVEL '+startLevel;
    menuRows[0].classList.toggle('focus', menuRow===0);
    menuRows[1].classList.toggle('focus', menuRow===1);
  }

  function selectionChanged(){
    mode=MODES[modeIdx].id;
    score=0; lines=0; level=startLevel; elapsed=0;
    applyPalette(Math.floor(level/5));
    writeStore('pocket-tetris-mode', mode);
    writeStore('pocket-tetris-level', String(startLevel));
    updateHud();
  }

  function menuInput(cmd){
    if(!cmd || performance.now()<menuLockUntil) return;
    if(cmd==='go'){ startGame(); return; }
    if(cmd==='up') menuRow=0;
    else if(cmd==='down') menuRow=1;
    else {
      var d = cmd==='inc' ? 1 : -1;
      if(menuRow===0) modeIdx=(modeIdx+d+MODES.length)%MODES.length;
      else startLevel=(startLevel+d+10)%10;
      selectionChanged();
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
      doAction(action);
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
  function doAction(action){
    if(inMenu()){ menuInput(BUTTON_MENU[action]); return; }
    switch(action){
      case 'left': if(tryMove(-1,0)) draw(); break;
      case 'right': if(tryMove(1,0)) draw(); break;
      case 'soft':
        if(gameState==='playing' && tryMove(0,1)){ score+=1; dropAcc=0; updateHud(); draw(); }
        break;
      case 'cw': tryRotate(true); draw(); break;
      case 'ccw': tryRotate(false); draw(); break;
      case 'drop': hardDrop(); break;
      case 'hold': doHold(); break;
      case 'start': togglePause(); break;
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

  overlay.addEventListener('click', function(e){
    if(menuEl.contains(e.target)) return;
    if(gameState==='paused') togglePause();
    else if(inMenu()) menuInput('go');
  });
  consoleEl.addEventListener('contextmenu', function(e){ e.preventDefault(); });

  var KEYMAP={
    ArrowLeft:'left', ArrowRight:'right', ArrowDown:'soft',
    ArrowUp:'cw', KeyX:'cw', KeyZ:'ccw',
    Space:'drop', Enter:'start', KeyP:'start', Escape:'start',
    KeyC:'hold', ShiftLeft:'hold', ShiftRight:'hold'
  };
  var KEY_MENU={ArrowUp:'up', ArrowDown:'down', ArrowLeft:'dec', ArrowRight:'inc', Enter:'go', Space:'go', KeyP:'go'};
  window.addEventListener('keydown',function(e){
    if(e.ctrlKey || e.metaKey || e.altKey) return;
    if(inMenu()){
      var cmd=KEY_MENU[e.code];
      if(!cmd) return;
      e.preventDefault();
      if(!e.repeat) menuInput(cmd);
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
      while(e.clientY-g.ay>=step){ g.ay+=step; g.moved=true; doAction('soft'); }
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
    if(!document.hidden) return;
    stopAllRepeats();
    if(gameState==='playing') togglePause();
  });

  /* ---------------- main loop ---------------- */
  function tick(ts){
    if(lastTs===null) lastTs=ts;
    var dt=Math.min(ts-lastTs, 100);
    lastTs=ts;
    if(gameState==='playing' || gameState==='clearing'){
      elapsed+=dt;
      if(mode!=='marathon') updateTimeHud();
    }
    if(gameState==='playing' && mode==='ultra' && elapsed>=ULTRA_MS){
      endGame('timeup');
    } else if(gameState==='playing'){
      dropAcc+=dt;
      if(dropAcc>=speedForLevel(level)){
        dropAcc=0;
        tryMove(0,1);
      }
      if(collides(piece,px,py+1)){
        lockTimer+=dt;
        if(lockTimer>=LOCK_DELAY) lock();
      } else {
        lockTimer=0;
      }
      if(gameState==='playing') draw();
    }
    requestAnimationFrame(tick);
  }

  /* ---------------- boot ---------------- */
  for(var bk in BEST_KEYS) best[bk]=parseInt(readStore(BEST_KEYS[bk])||'0',10)||0;
  modeIdx=Math.max(0, MODES.map(function(m){ return m.id; }).indexOf(readStore('pocket-tetris-mode')));
  startLevel=Math.min(9, Math.max(0, parseInt(readStore('pocket-tetris-level')||'0',10)||0));
  mode=MODES[modeIdx].id;
  level=startLevel;
  muted=readStore('pocket-tetris-muted')==='1';
  renderMute();
  resetBoard();
  applyPalette(Math.floor(level/5));
  updateHud();
  renderMenu();
  showOverlay('TETRIS','','',true);
  powerLed.style.opacity='.35';
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
