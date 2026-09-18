(function(){
  "use strict";
  var COLS=10, ROWS=20;
  var CELL=16;
  function $(id){ return document.getElementById(id); }
  var boardCv=$('board'), bctx=boardCv.getContext('2d');
  var nextCv=$('next'), nctx=nextCv.getContext('2d');
  var holdCv=$('hold'), hctx=holdCv.getContext('2d');
  var toastEl=$('toast'), overlay=$('overlay'), overlayTitle=$('overlayTitle'), overlaySub=$('overlaySub'), overlayStats=$('overlayStats');
  var linesVal=$('linesVal'), levelVal=$('levelVal'), scoreVal=$('scoreVal'), topVal=$('topVal');
  var muteBtn=$('muteBtn'), powerLed=$('powerLed');
  var consoleEl=$('console'), fitEl=$('fit'), belowEl=$('below');
  var installBtn=$('installBtn'), iosHint=$('iosHint');

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
  var score=0, lines=0, level=0, dropAcc=0, lockTimer=0, lastTs=null;
  var gameState='ready', highScore=0, startHigh=0, holdUsed=false, combo=-1, backToBack=false;
  var flashRows=null, pieceCounts={}, scale=1;

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
  }

  function spawn(){
    placeAtTop(nextKey || nextFromBag());
    nextKey=nextFromBag();
    pieceCounts[pieceKey]=(pieceCounts[pieceKey]||0)+1;
    drawNext();
    if(collides(piece,px,py)) gameOver();
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
      if(collides(piece,px,py)) gameOver();
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
    var newLevel=Math.floor(lines/10);
    var leveledUp=newLevel>level;
    if(leveledUp){ level=newLevel; applyPalette(Math.floor(level/5)); }
    if(combo>0) msg+='\nCOMBO x'+combo;
    if(score>highScore){ highScore=score; saveHigh(); }
    updateHud();
    sfxClear(cleared);
    if(leveledUp) sfxLevel();
    showToast(msg,800);
    flashRows=null;
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
    if(dx!==0) sfxMove();
    return true;
  }

  var KICKS=[[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1]];
  function tryRotate(cw){
    if(gameState!=='playing') return;
    var r=cw?rotateCW(piece):rotateCCW(piece);
    for(var i=0;i<KICKS.length;i++){
      var kx=KICKS[i][0], ky=KICKS[i][1];
      if(!collides(r,px+kx,py+ky)){ piece=r; px+=kx; py+=ky; sfxRotate(); return; }
    }
  }

  function speedForLevel(l){ return Math.max(1000 - l*70, 90); }

  /* ---------------- HUD / storage ---------------- */
  function setNum(el,v){
    var s=String(v);
    el.textContent=s;
    el.style.fontSize = s.length>6 ? '8px' : '';
  }
  function updateHud(){
    linesVal.textContent=String(lines).padStart(3,'0');
    setNum(levelVal,level);
    setNum(scoreVal,score);
    setNum(topVal,highScore);
  }
  function readStore(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } }
  function writeStore(key,val){ try{ localStorage.setItem(key,val); }catch(e){} }
  function saveHigh(){ writeStore('pocket-tetris-high', String(highScore)); }

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
  function showOverlay(title,sub,stats){
    overlayTitle.textContent=title;
    overlaySub.textContent=sub;
    overlayStats.textContent=stats||'';
    overlaySub.classList.toggle('blink', /PRESS START/.test(sub));
    overlay.hidden=false;
  }
  function hideOverlay(){ overlay.hidden=true; }

  function startGame(){
    ensureAudio();
    resetBoard();
    score=0; lines=0; level=0; dropAcc=0; lockTimer=0;
    nextKey=null; heldKey=null; holdUsed=false; combo=-1; backToBack=false; flashRows=null;
    pieceCounts={};
    bag=[];
    startHigh=highScore;
    applyPalette(0);
    updateHud();
    hideOverlay();
    gameState='playing';
    powerLed.style.opacity='1';
    spawn();
    drawHold();
    draw();
    scheduleTune();
  }

  function gameOver(){
    gameState='gameover';
    stopTune();
    stopAllRepeats();
    sfxGameOver();
    var isRecord = score>0 && score>startHigh;
    if(score>highScore){ highScore=score; saveHigh(); }
    updateHud();
    powerLed.style.opacity='.35';
    showOverlay('GAME OVER', (isRecord ? 'NEW TOP SCORE\n' : '') + 'PRESS START', statsLine());
  }

  function togglePause(){
    if(gameState==='playing'){
      gameState='paused';
      stopTune();
      stopAllRepeats();
      showOverlay('PAUSE','PRESS START',statsLine());
    } else if(gameState==='paused'){
      gameState='playing';
      hideOverlay();
      scheduleTune();
    }
  }

  function handleStart(){
    if(gameState==='ready' || gameState==='gameover') startGame();
    else togglePause();
  }

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

  function doAction(action){
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
      case 'start': handleStart(); break;
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

  overlay.addEventListener('click', handleStart);
  consoleEl.addEventListener('contextmenu', function(e){ e.preventDefault(); });

  var KEYMAP={
    ArrowLeft:'left', ArrowRight:'right', ArrowDown:'soft',
    ArrowUp:'cw', KeyX:'cw', KeyZ:'ccw',
    Space:'drop', Enter:'start', KeyP:'start', Escape:'start',
    KeyC:'hold', ShiftLeft:'hold', ShiftRight:'hold'
  };
  window.addEventListener('keydown',function(e){
    var action=KEYMAP[e.code];
    if(!action || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    if(keysDown[e.code]) return;
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
    if(gameState==='playing'){
      var interval=speedForLevel(level);
      dropAcc+=dt;
      if(dropAcc>=interval){
        dropAcc=0;
        if(tryMove(0,1)){
          lockTimer=0;
        } else {
          lockTimer+=interval;
          if(lockTimer>350) lock();
        }
      }
      if(gameState==='playing') draw();
    }
    requestAnimationFrame(tick);
  }

  /* ---------------- boot ---------------- */
  highScore=parseInt(readStore('pocket-tetris-high')||'0',10)||0;
  muted=readStore('pocket-tetris-muted')==='1';
  renderMute();
  resetBoard();
  applyPalette(0);
  updateHud();
  showOverlay('TETRIS','PRESS START','');
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
