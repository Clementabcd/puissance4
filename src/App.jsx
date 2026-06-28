import { useState, useEffect, useRef } from "react";

// ══════════════════════════════════════════════════════════════════
//  CONSTANTS & GAME LOGIC
// ══════════════════════════════════════════════════════════════════
const ROWS = 6, COLS = 7;
const PLAYER = "player", AI = "ai";
const CELL = 62, GAP = 8, PAD = 14;

const THEMES = {
  classic: { p:"#F03E3E", ai:"#F59F00", bg:"linear-gradient(135deg,#FF6B6B22,#F59F0022)" },
  ocean:   { p:"#228BE6", ai:"#20C997", bg:"linear-gradient(135deg,#228BE622,#20C99722)" },
  forest:  { p:"#E8590C", ai:"#37B24D", bg:"linear-gradient(135deg,#E8590C22,#37B24D22)" },
  dusk:    { p:"#7950F2", ai:"#F76707", bg:"linear-gradient(135deg,#7950F222,#F7670722)" },
};

const DIFFS = {
  easy:   { label:"Facile",     emoji:"🌱", depth:0,  mult:1,   desc:"Coups aléatoires — idéal pour débuter." },
  medium: { label:"Moyen",      emoji:"🧠", depth:5,  mult:2,   desc:"Minimax depth 5 — un vrai challenge." },
  hard:   { label:"Difficile",  emoji:"⚡", depth:8,  mult:3.5, desc:"Alpha-bêta depth 8 — implacable." },
};

const createBoard = () => Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
const isColFull   = (b, c) => !!b[0][c];
const validCols   = (b) => Array.from({length:COLS},(_,i)=>i).filter(c => !isColFull(b,c));
const isFull      = (b) => b[0].every(Boolean);

function drop(board, col, who) {
  for (let r = ROWS-1; r >= 0; r--) {
    if (!board[r][col]) {
      const b = board.map(row => [...row]);
      b[r][col] = who;
      return { board: b, row: r };
    }
  }
  return null;
}

function checkWinner(board) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = board[r][c]; if (!v) continue;
    for (const [dr,dc] of dirs) {
      const cells = [[r,c]];
      for (let k=1;k<4;k++) {
        const nr=r+dr*k, nc=c+dc*k;
        if (nr<0||nr>=ROWS||nc<0||nc>=COLS||board[nr][nc]!==v) break;
        cells.push([nr,nc]);
      }
      if (cells.length===4) return { winner:v, cells };
    }
  }
  return null;
}

function scoreWin(win, piece) {
  const opp = piece===AI ? PLAYER : AI;
  const pc=win.filter(x=>x===piece).length, ec=win.filter(x=>x===null).length, oc=win.filter(x=>x===opp).length;
  if(pc===4) return 100; if(pc===3&&ec===1) return 5; if(pc===2&&ec===2) return 2;
  if(oc===3&&ec===1) return -4; return 0;
}

function heur(board, piece) {
  let s=0;
  const mid=Math.floor(COLS/2);
  s+=board.map(r=>r[mid]).filter(x=>x===piece).length*3;
  for(let r=0;r<ROWS;r++) for(let c=0;c<=COLS-4;c++) s+=scoreWin([board[r][c],board[r][c+1],board[r][c+2],board[r][c+3]],piece);
  for(let c=0;c<COLS;c++) for(let r=0;r<=ROWS-4;r++) s+=scoreWin([board[r][c],board[r+1][c],board[r+2][c],board[r+3][c]],piece);
  for(let r=0;r<=ROWS-4;r++) for(let c=0;c<=COLS-4;c++) s+=scoreWin([board[r][c],board[r+1][c+1],board[r+2][c+2],board[r+3][c+3]],piece);
  for(let r=3;r<ROWS;r++) for(let c=0;c<=COLS-4;c++) s+=scoreWin([board[r][c],board[r-1][c+1],board[r-2][c+2],board[r-3][c+3]],piece);
  return s;
}

function minimax(board, depth, alpha, beta, maximizing, maxP, minP) {
  const res = checkWinner(board);
  if (res) return { score: res.winner===maxP ? 100000+depth : -100000-depth };
  const cols = validCols(board);
  if (depth===0||!cols.length) return { score: heur(board,maxP)-heur(board,minP) };
  let best = { score: maximizing?-Infinity:Infinity, col: cols[0] };
  for (const col of cols) {
    const r = drop(board, col, maximizing?maxP:minP);
    if (!r) continue;
    const { score } = minimax(r.board, depth-1, alpha, beta, !maximizing, maxP, minP);
    if (maximizing?score>best.score:score<best.score) best={score,col};
    if (maximizing) alpha=Math.max(alpha,score); else beta=Math.min(beta,score);
    if (alpha>=beta) break;
  }
  return best;
}

function getAIMove(board, diff) {
  const cols = validCols(board);
  if (diff==="easy") return cols[Math.floor(Math.random()*cols.length)];
  const { col } = minimax(board, DIFFS[diff].depth, -Infinity, Infinity, true, AI, PLAYER);
  return col ?? cols[0];
}

function getHint(board) {
  const cols = validCols(board);
  for (const col of cols) { const r=drop(board,col,PLAYER); if(r&&checkWinner(r.board)?.winner===PLAYER) return col; }
  for (const col of cols) { const r=drop(board,col,AI); if(r&&checkWinner(r.board)?.winner===AI) return col; }
  const { col } = minimax(board, 4, -Infinity, Infinity, true, PLAYER, AI);
  return col ?? cols[Math.floor(cols.length/2)];
}

function calcScore({ diff, moves, streak, blocks, center }) {
  const base=1000, speed=Math.max(0,500-moves*15);
  const streakB=streak>1?(streak-1)*300:0, blockB=blocks*75, centerB=center*25;
  const raw=base+speed+streakB+blockB+centerB;
  const mult=DIFFS[diff].mult;
  return { total:Math.round(raw*mult), base, speed, streakB, blockB, centerB, mult };
}

// ══════════════════════════════════════════════════════════════════
//  UI SUBCOMPONENTS
// ══════════════════════════════════════════════════════════════════

function Pill({ options, value, onChange, accent="#4C6EF5" }) {
  return (
    <div style={{display:"flex",gap:3,background:"rgba(0,0,0,.06)",borderRadius:10,padding:3}}>
      {options.map(o => (
        <button key={String(o.v)} onClick={()=>onChange(o.v)} style={{
          padding:"5px 11px",borderRadius:7,border:"none",cursor:"pointer",
          background:value===o.v?"#fff":"transparent",
          color:value===o.v?accent:"#94A3B8",
          fontSize:12,fontWeight:700,fontFamily:"inherit",
          boxShadow:value===o.v?"0 2px 8px rgba(0,0,0,.1)":"none",
          transition:"all .16s",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function Confetti({ active }) {
  if (!active) return null;
  const pts = Array.from({length:55},(_,i)=>({
    id:i, x:5+Math.random()*90, size:6+Math.random()*9,
    delay:Math.random()*.9, dur:1.1+Math.random()*.9,
    color:["#F03E3E","#F59F00","#4C6EF5","#37B24D","#F06595","#339AF0"][Math.floor(Math.random()*6)],
    rot:Math.random()*360, rx:Math.random()*220-110,
    shape:Math.random()>.5?"50%":"3px",
  }));
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:200}}>
      {pts.map(p=>(
        <div key={p.id} style={{
          position:"absolute",left:`${p.x}%`,top:"-10px",
          width:p.size,height:p.size,borderRadius:p.shape,background:p.color,
          animation:`cfall ${p.dur}s ${p.delay}s ease-in forwards`,
          "--rx":`${p.rx}px`, transform:`rotate(${p.rot}deg)`,
        }}/>
      ))}
    </div>
  );
}

function MenuModal({ diff, setDiff, firstPlayer, setFirstPlayer, timerSecs, setTimerSecs, hints, setHints, theme, setTheme, onStart }) {
  return (
    <div style={{
      position:"fixed",inset:0,zIndex:50,
      background:"rgba(236,242,255,.8)",backdropFilter:"blur(16px)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:20,
    }}>
      <div style={{
        background:"rgba(255,255,255,.92)",backdropFilter:"blur(32px)",
        borderRadius:28,padding:"36px 40px",
        border:"1.5px solid rgba(255,255,255,.95)",
        boxShadow:"0 40px 100px rgba(80,100,200,.16),0 8px 32px rgba(80,100,200,.1)",
        maxWidth:520,width:"100%",
        animation:"modal-in .45s cubic-bezier(.34,1.56,.64,1)",
      }}>
        {/* Title */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:44,marginBottom:8,lineHeight:1}}>🔴🟡</div>
          <h1 style={{
            fontSize:33,fontWeight:800,margin:0,letterSpacing:"-.5px",
            background:"linear-gradient(120deg,#F03E3E 0%,#F59F00 50%,#4C6EF5 100%)",
            backgroundSize:"200% auto",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
            animation:"shimmer-title 4s linear infinite",
          }}>Puissance 4</h1>
          <p style={{color:"#94A3B8",fontSize:11,margin:"6px 0 0",letterSpacing:".14em",textTransform:"uppercase",fontWeight:700}}>
            Choisissez votre défi
          </p>
        </div>

        {/* Difficulty cards */}
        <div style={{display:"flex",gap:10,marginBottom:26}}>
          {Object.entries(DIFFS).map(([key,d]) => {
            const sel = diff===key;
            return (
              <div key={key} onClick={()=>setDiff(key)} style={{
                flex:1,padding:"16px 10px",borderRadius:16,cursor:"pointer",textAlign:"center",
                background:sel?"rgba(240,62,62,.06)":"rgba(0,0,0,.025)",
                border:`2px solid ${sel?"#F03E3E":"rgba(0,0,0,.07)"}`,
                boxShadow:sel?"0 8px 24px rgba(240,62,62,.15)":"0 2px 8px rgba(0,0,0,.04)",
                transform:sel?"translateY(-4px) scale(1.01)":"none",
                transition:"all .28s cubic-bezier(.34,1.56,.64,1)",
              }}>
                <div style={{fontSize:28,marginBottom:6}}>{d.emoji}</div>
                <div style={{fontWeight:800,fontSize:14,color:sel?"#F03E3E":"#374151",marginBottom:4}}>{d.label}</div>
                <div style={{fontSize:11,color:"#94A3B8",lineHeight:1.5}}>{d.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <div style={{flex:1,height:1,background:"rgba(0,0,0,.07)"}}/>
          <span style={{color:"#CBD5E1",fontSize:11,fontWeight:700,letterSpacing:".15em"}}>OPTIONS</span>
          <div style={{flex:1,height:1,background:"rgba(0,0,0,.07)"}}/>
        </div>

        {/* Options */}
        <div style={{display:"flex",flexDirection:"column",gap:13,marginBottom:28}}>
          {[
            { label:"🎮 Qui commence", content:
              <Pill value={firstPlayer} onChange={setFirstPlayer} options={[{v:"player",label:"Vous"},{v:"ai",label:"IA"},{v:"random",label:"Aléatoire"}]}/> },
            { label:"⏱ Minuteur", content:
              <Pill value={timerSecs} onChange={setTimerSecs} options={[{v:0,label:"Off"},{v:10,label:"10s"},{v:20,label:"20s"},{v:30,label:"30s"}]}/> },
            { label:"💡 Indices", content:
              <Pill value={hints} onChange={setHints} accent="#37B24D" options={[{v:false,label:"Off"},{v:true,label:"On — meilleur coup"}]}/> },
            { label:"🎨 Couleurs", content:
              <div style={{display:"flex",gap:8}}>
                {Object.entries(THEMES).map(([k,t])=>(
                  <button key={k} onClick={()=>setTheme(k)} style={{
                    width:26,height:26,borderRadius:"50%",cursor:"pointer",border:"none",padding:0,
                    background:`linear-gradient(135deg,${t.p} 50%,${t.ai} 50%)`,
                    outline:theme===k?"3px solid #4C6EF5":"3px solid transparent",
                    outlineOffset:2,
                    transform:theme===k?"scale(1.22)":"scale(1)",
                    transition:"all .22s cubic-bezier(.34,1.56,.64,1)",
                  }}/>
                ))}
              </div> },
          ].map(({label,content})=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
              <span style={{fontSize:13,fontWeight:600,color:"#374151",whiteSpace:"nowrap"}}>{label}</span>
              {content}
            </div>
          ))}
        </div>

        {/* CTA */}
        <button onClick={onStart}
          onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 14px 36px rgba(240,62,62,.55)";}}
          onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 8px 26px rgba(240,62,62,.4)";}}
          style={{
            width:"100%",padding:"14px",borderRadius:16,cursor:"pointer",
            background:"linear-gradient(130deg,#F03E3E,#F59F00)",
            border:"none",color:"#fff",fontSize:16,fontWeight:800,
            fontFamily:"inherit",letterSpacing:".02em",
            boxShadow:"0 8px 26px rgba(240,62,62,.4)",
            transition:"all .2s",
          }}>▶  Jouer</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function Connect4() {
  // Config
  const [diff,       setDiff]       = useState("medium");
  const [firstPlayer,setFirstPlayer]= useState("player");
  const [timerSecs,  setTimerSecs]  = useState(0);
  const [hints,      setHints]      = useState(false);
  const [theme,      setTheme]      = useState("classic");

  // Game
  const [phase,      setPhase]   = useState("menu"); // menu | playing | result
  const [board,      setBoard]   = useState(createBoard);
  const [turn,       setTurn]    = useState(PLAYER);
  const [outcome,    setOutcome] = useState(null);   // won|lost|draw
  const [winCells,   setWinCells]= useState([]);
  const [hoverCol,   setHoverCol]= useState(null);
  const [dropping,   setDropping]= useState(null);   // {row,col}
  const [lastMove,   setLastMove]= useState(null);   // {row,col}
  const [hintCol,    setHintCol] = useState(null);
  const [timeLeft,   setTimeLeft]= useState(0);
  const [ripple,     setRipple]  = useState(null);   // {row,col,key}
  const [breakdown,  setBreakdown]= useState(null);
  const [showBD,     setShowBD]  = useState(false);

  // Stats
  const [streak,     setStreak]     = useState(0);
  const [totalScore, setTotalScore] = useState(0);

  // Refs for stale-closure safety
  const boardRef  = useRef(board);
  const phaseRef  = useRef(phase);
  const turnRef   = useRef(turn);
  const aiLock    = useRef(false);
  const moves     = useRef(0);
  const blocks    = useRef(0);
  const centerC   = useRef(0);
  const streakRef = useRef(streak);
  const diffRef   = useRef(diff);
  const pmRef     = useRef(null); // player-move fn ref for timer

  useEffect(()=>{ boardRef.current=board; },[board]);
  useEffect(()=>{ phaseRef.current=phase; },[phase]);
  useEffect(()=>{ turnRef.current=turn; },[turn]);
  useEffect(()=>{ streakRef.current=streak; },[streak]);
  useEffect(()=>{ diffRef.current=diff; },[diff]);

  const th = THEMES[theme];
  const isWC = (r,c) => winCells.some(([wr,wc])=>wr===r&&wc===c);
  const BW = COLS*CELL+(COLS-1)*GAP+PAD*2;

  // ── Finalize ────────────────────────────────────────────────────
  const finalize = (who) => {
    if (who===PLAYER) {
      const ns = streakRef.current+1;
      setStreak(ns);
      const bd = calcScore({diff:diffRef.current, moves:moves.current, streak:ns, blocks:blocks.current, center:centerC.current});
      setBreakdown(bd);
      setTotalScore(t=>t+bd.total);
      setTimeout(()=>setShowBD(true),700);
      setOutcome("won");
    } else if (who===AI) {
      setStreak(0); setOutcome("lost");
    } else {
      setStreak(0); setOutcome("draw");
    }
    setPhase("result"); phaseRef.current="result";
  };

  // ── Place piece ─────────────────────────────────────────────────
  const placePiece = (col, who) => {
    const b = boardRef.current;
    if (isColFull(b,col)) return "full";
    const res = drop(b,col,who);
    if (!res) return "full";
    boardRef.current = res.board;
    setBoard(res.board);
    setDropping({row:res.row,col});
    setLastMove({row:res.row,col});
    setRipple({row:res.row,col,key:Date.now()});
    setTimeout(()=>setDropping(null),480);
    setTimeout(()=>setRipple(null),700);
    moves.current++;
    const winRes = checkWinner(res.board);
    if (winRes) { setWinCells(winRes.cells); finalize(who); return "win"; }
    if (isFull(res.board)) { finalize(null); return "draw"; }
    return "ok";
  };

  // ── Player click ────────────────────────────────────────────────
  const handleClick = (col) => {
    if (phaseRef.current!=="playing"||turnRef.current!==PLAYER||aiLock.current) return;
    if (isColFull(boardRef.current,col)) return;
    const b=boardRef.current, mid=Math.floor(COLS/2);
    if (col>=mid-1&&col<=mid+1) centerC.current++;
    const testAI=drop(b,col,AI);
    if (testAI&&checkWinner(testAI.board)?.winner===AI) blocks.current++;
    const res=placePiece(col,PLAYER);
    if (res==="ok") { setTurn(AI); turnRef.current=AI; }
  };
  pmRef.current = handleClick;

  // ── AI turn ─────────────────────────────────────────────────────
  useEffect(()=>{
    if (phase!=="playing"||turn!==AI) return;
    aiLock.current=true;
    const delay={easy:420,medium:780,hard:1200}[diff];
    const t=setTimeout(()=>{
      const col=getAIMove(boardRef.current,diff);
      const res=placePiece(col,AI);
      if (res==="ok") { setTurn(PLAYER); turnRef.current=PLAYER; }
      aiLock.current=false;
    },delay);
    return ()=>clearTimeout(t);
  },[turn,phase,diff]);

  // ── Hints ───────────────────────────────────────────────────────
  useEffect(()=>{
    if (!hints||phase!=="playing"||turn!==PLAYER){setHintCol(null);return;}
    const t=setTimeout(()=>setHintCol(getHint(boardRef.current)),80);
    return ()=>clearTimeout(t);
  },[hints,phase,turn,board]);

  // ── Timer ───────────────────────────────────────────────────────
  useEffect(()=>{
    if (timerSecs===0||phase!=="playing"||turn!==PLAYER) return;
    setTimeLeft(timerSecs);
    const iv=setInterval(()=>{
      setTimeLeft(t=>{
        if (t<=1) {
          const cols=validCols(boardRef.current);
          if (cols.length) pmRef.current(cols[Math.floor(Math.random()*cols.length)]);
          return 0;
        }
        return t-1;
      });
    },1000);
    return ()=>clearInterval(iv);
  },[phase,turn,timerSecs]);

  // ── Start ───────────────────────────────────────────────────────
  const startGame = () => {
    const b=createBoard();
    boardRef.current=b; setBoard(b);
    const fp=firstPlayer==="random"?(Math.random()>.5?PLAYER:AI):firstPlayer;
    turnRef.current=fp; setTurn(fp);
    phaseRef.current="playing"; setPhase("playing");
    setOutcome(null); setWinCells([]); setDropping(null);
    setHintCol(null); setLastMove(null); setShowBD(false); setBreakdown(null);
    aiLock.current=false;
    moves.current=0; blocks.current=0; centerC.current=0;
  };

  const goMenu=()=>{setPhase("menu");phaseRef.current="menu";setShowBD(false);};

  // ══════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(150deg,#EEF2FF 0%,#F8F4FF 45%,#EAF8FF 100%)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      fontFamily:"'DM Sans',system-ui,sans-serif",
      padding:"20px",position:"relative",overflow:"hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,800&display=swap');

        @keyframes modal-in    { from{opacity:0;transform:scale(.88) translateY(28px);} to{opacity:1;transform:none;} }
        @keyframes shimmer-title{ 0%{background-position:-200% center;} 100%{background-position:200% center;} }
        @keyframes fadein      { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:none;} }
        @keyframes drop-in     { 0%{transform:translateY(-560px);opacity:0;} 82%{transform:translateY(5px);} 91%{transform:translateY(-3px);} 100%{transform:translateY(0);opacity:1;} }
        @keyframes pulse-win   { 0%,100%{transform:scale(1);filter:brightness(1);} 50%{transform:scale(1.13);filter:brightness(1.18);} }
        @keyframes ring-out    { 0%{transform:scale(.55);opacity:.75;} 100%{transform:scale(2.5);opacity:0;} }
        @keyframes ripple-out  { 0%{transform:scale(.4);opacity:.6;} 100%{transform:scale(2.8);opacity:0;} }
        @keyframes blink       { 0%,100%{opacity:.3;} 50%{opacity:1;} }
        @keyframes spin        { to{transform:rotate(360deg);} }
        @keyframes hint-bob    { 0%,100%{transform:translateY(0);opacity:.9;} 50%{transform:translateY(5px);opacity:1;} }
        @keyframes stamp       { 0%{transform:scale(1.5);opacity:0;} 65%{transform:scale(.95);} 80%{transform:scale(1.04);} 100%{transform:scale(1);opacity:1;} }
        @keyframes score-row   { from{opacity:0;transform:translateX(-10px);} to{opacity:1;transform:none;} }
        @keyframes cfall       { 0%{transform:translateY(-10px) rotate(0deg) translateX(0);opacity:1;} 100%{transform:translateY(105vh) rotate(540deg) translateX(var(--rx));opacity:0;} }
        @keyframes timer-drain { from{width:100%;} to{width:0%;} }
        @keyframes board-in    { from{opacity:0;transform:translateY(20px) scale(.97);} to{opacity:1;transform:none;} }
        @keyframes ai-dots     { 0%,80%,100%{transform:scale(0);} 40%{transform:scale(1);} }
      `}</style>

      {/* Ambient blobs */}
      {[
        {w:640,h:640,top:-220,left:-180,c:"rgba(167,139,250,.13)"},
        {w:520,h:520,bottom:-160,right:-160,c:"rgba(96,165,250,.10)"},
        {w:380,h:380,top:"32%",right:"6%",c:"rgba(251,113,133,.09)"},
        {w:280,h:280,bottom:"20%",left:"5%",c:"rgba(52,211,153,.07)"},
      ].map((b,i)=>(
        <div key={i} style={{
          position:"fixed",width:b.w,height:b.h,borderRadius:"50%",pointerEvents:"none",
          background:`radial-gradient(circle,${b.c} 0%,transparent 70%)`,
          top:b.top,left:b.left,bottom:b.bottom,right:b.right,
        }}/>
      ))}

      <Confetti active={outcome==="won"&&phase==="result"} />

      {/* ── MENU ── */}
      {phase==="menu" && (
        <MenuModal diff={diff} setDiff={setDiff}
          firstPlayer={firstPlayer} setFirstPlayer={setFirstPlayer}
          timerSecs={timerSecs} setTimerSecs={setTimerSecs}
          hints={hints} setHints={setHints}
          theme={theme} setTheme={setTheme}
          onStart={startGame}/>
      )}

      {/* ── GAME & RESULT ── */}
      {phase!=="menu" && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,animation:"board-in .5s ease"}}>

          {/* ── Score bar ── */}
          <div style={{
            display:"flex",gap:0,borderRadius:16,overflow:"hidden",
            background:"rgba(255,255,255,.72)",backdropFilter:"blur(20px)",
            border:"1.5px solid rgba(255,255,255,.92)",
            boxShadow:"0 4px 20px rgba(80,100,200,.1)",
          }}>
            {[
              {label:"Score",    value:totalScore.toLocaleString("fr"), color:"#F03E3E"},
              {label:"Série",    value:streak>0?`🔥 ×${streak}`:"—",   color:"#F59F00"},
              {label:DIFFS[diff].emoji+" "+DIFFS[diff].label, value:"", color:"#4C6EF5", badge:true},
            ].map(({label,value,color,badge},i)=>(
              <div key={i} style={{
                padding:"10px 20px",textAlign:"center",
                borderRight:i<2?"1px solid rgba(0,0,0,.06)":"none",
              }}>
                {badge
                  ? <div style={{color,fontSize:13,fontWeight:800,lineHeight:"28px"}}>{label}</div>
                  : <>
                      <div style={{color,fontSize:19,fontWeight:800,lineHeight:1}}>{value}</div>
                      <div style={{color:"#94A3B8",fontSize:10,textTransform:"uppercase",letterSpacing:".1em",marginTop:3,fontWeight:700}}>{label}</div>
                    </>
                }
              </div>
            ))}
          </div>

          {/* ── Turn pill ── */}
          <div style={{
            display:"flex",alignItems:"center",gap:8,
            background:"rgba(255,255,255,.72)",backdropFilter:"blur(16px)",
            borderRadius:50,padding:"8px 20px",
            border:"1.5px solid rgba(255,255,255,.92)",
            boxShadow:"0 2px 12px rgba(80,100,200,.08)",
            minWidth:190,justifyContent:"center",height:38,
          }}>
            {phase==="playing" && (
              <>
                <div style={{
                  width:10,height:10,borderRadius:"50%",
                  background:turn===PLAYER?th.p:th.ai,
                  boxShadow:`0 0 8px ${turn===PLAYER?th.p:th.ai}`,
                  animation:"blink 1.1s ease infinite",flexShrink:0,
                }}/>
                <span style={{fontSize:13,fontWeight:700,color:"#374151"}}>
                  {turn===PLAYER ? "Votre tour" : "IA réfléchit"}
                </span>
                {turn===AI && (
                  <div style={{display:"flex",gap:3,alignItems:"center"}}>
                    {[0,.18,.36].map((d,i)=>(
                      <div key={i} style={{
                        width:5,height:5,borderRadius:"50%",background:th.ai,
                        animation:`ai-dots .9s ${d}s ease infinite`,
                      }}/>
                    ))}
                  </div>
                )}
              </>
            )}
            {phase==="result" && (
              <span style={{
                fontSize:13,fontWeight:800,
                color:outcome==="won"?th.p:outcome==="lost"?th.ai:"#94A3B8",
              }}>
                {outcome==="won"?"🏆 Victoire !":outcome==="lost"?"🤖 L'IA gagne":"🤝 Égalité"}
              </span>
            )}
          </div>

          {/* ── Timer bar ── */}
          {timerSecs>0&&phase==="playing"&&turn===PLAYER && (
            <div style={{width:BW,height:5,background:"rgba(0,0,0,.07)",borderRadius:5,overflow:"hidden"}}>
              <div key={`t-${moves.current}`} style={{
                height:"100%",borderRadius:5,
                background:`linear-gradient(90deg,${th.p},${th.ai})`,
                animation:`timer-drain ${timerSecs}s linear forwards`,
              }}/>
            </div>
          )}

          {/* ── Hint + hover arrows row ── */}
          <div style={{display:"flex",paddingLeft:PAD,gap:GAP,width:BW}}>
            {Array.from({length:COLS},(_,c)=>(
              <div key={c} style={{width:CELL,height:18,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                {hintCol===c&&phase==="playing"&&turn===PLAYER&&!isColFull(board,c) && (
                  <div style={{
                    fontSize:13,color:th.p,fontWeight:800,
                    animation:"hint-bob .7s ease infinite",
                    filter:`drop-shadow(0 0 4px ${th.p}80)`,
                    display:"flex",flexDirection:"column",alignItems:"center",gap:1,
                  }}>
                    <span style={{fontSize:8,letterSpacing:".05em",color:th.p,opacity:.8}}>HINT</span>
                    <span>▼</span>
                  </div>
                )}
                {hoverCol===c&&hintCol!==c&&phase==="playing"&&turn===PLAYER&&!isColFull(board,c) && (
                  <div style={{width:7,height:7,borderRadius:"50%",background:th.p,opacity:.45,animation:"blink .5s ease infinite"}}/>
                )}
              </div>
            ))}
          </div>

          {/* ── Board ── */}
          <div style={{position:"relative"}}>
            {/* Column hover highlight */}
            {phase==="playing"&&turn===PLAYER&&hoverCol!==null&&!isColFull(board,hoverCol) && (
              <div style={{
                position:"absolute",pointerEvents:"none",zIndex:1,
                left:PAD+hoverCol*(CELL+GAP)-3,top:6,
                width:CELL+6,height:"calc(100% - 12px)",
                background:`linear-gradient(180deg,${th.p}1A,${th.p}0A)`,
                borderRadius:14,border:`1px solid ${th.p}28`,
              }}/>
            )}

            {/* Glass board */}
            <div style={{
              background:"rgba(255,255,255,.65)",
              backdropFilter:"blur(28px)",
              borderRadius:22,padding:PAD,
              border:"1.5px solid rgba(255,255,255,.94)",
              boxShadow:`0 24px 64px rgba(80,100,200,.13),0 6px 20px rgba(80,100,200,.08),inset 0 1px 0 rgba(255,255,255,.85)`,
              position:"relative",zIndex:2,
            }}>
              {board.map((row,r)=>(
                <div key={r} style={{display:"flex",gap:GAP,marginBottom:r<ROWS-1?GAP:0}}>
                  {row.map((cell,c)=>{
                    const win=isWC(r,c);
                    const isP=cell===PLAYER, isA=cell===AI;
                    const isDrop=dropping?.row===r&&dropping?.col===c;
                    const isLast=lastMove?.row===r&&lastMove?.col===c&&!win;
                    const isRipple=ripple?.row===r&&ripple?.col===c;
                    const cc = isP?th.p:isA?th.ai:null;

                    return (
                      <div key={c} style={{position:"relative",width:CELL,height:CELL,flexShrink:0}}>
                        {/* Ripple ring on placement */}
                        {isRipple&&cc&&(
                          <div key={ripple.key} style={{
                            position:"absolute",inset:-4,borderRadius:"50%",
                            border:`2px solid ${cc}`,
                            animation:"ripple-out .65s ease-out forwards",
                            pointerEvents:"none",zIndex:3,
                          }}/>
                        )}
                        {/* Win ring */}
                        {win&&cc&&(
                          <div style={{
                            position:"absolute",inset:-5,borderRadius:"50%",
                            border:`2.5px solid ${cc}`,
                            animation:"ring-out 1.3s ease infinite",
                            pointerEvents:"none",zIndex:3,
                          }}/>
                        )}

                        {/* Cell */}
                        <div
                          onMouseEnter={()=>phase==="playing"&&turn===PLAYER&&setHoverCol(c)}
                          onMouseLeave={()=>setHoverCol(null)}
                          onClick={()=>handleClick(c)}
                          style={{
                            width:CELL,height:CELL,borderRadius:"50%",
                            position:"relative",overflow:"hidden",
                            cursor:phase==="playing"&&turn===PLAYER&&!isColFull(board,c)?"pointer":"default",
                            background: isP
                              ? `radial-gradient(circle at 35% 30%,${th.p}FF 0%,${th.p}CC 50%,${th.p}99 100%)`
                              : isA
                              ? `radial-gradient(circle at 35% 30%,${th.ai}FF 0%,${th.ai}CC 50%,${th.ai}99 100%)`
                              : "radial-gradient(circle at 45% 38%,rgba(210,218,240,.6),rgba(185,198,230,.35))",
                            boxShadow: isP
                              ? win
                                ? `0 0 0 3px ${th.p}55,0 0 22px ${th.p}90,0 4px 14px rgba(0,0,0,.14),inset 0 3px 6px rgba(255,255,255,.45),inset 0 -3px 8px rgba(0,0,0,.22)`
                                : isLast
                                ? `0 0 0 2px ${th.p}55,0 0 14px ${th.p}70,0 4px 12px rgba(0,0,0,.11),inset 0 3px 6px rgba(255,255,255,.4),inset 0 -3px 8px rgba(0,0,0,.18)`
                                : `0 0 8px ${th.p}50,0 4px 10px rgba(0,0,0,.1),inset 0 3px 6px rgba(255,255,255,.4),inset 0 -3px 8px rgba(0,0,0,.16)`
                              : isA
                              ? win
                                ? `0 0 0 3px ${th.ai}55,0 0 22px ${th.ai}90,0 4px 14px rgba(0,0,0,.14),inset 0 3px 6px rgba(255,255,255,.45),inset 0 -3px 8px rgba(0,0,0,.22)`
                                : isLast
                                ? `0 0 0 2px ${th.ai}55,0 0 14px ${th.ai}70,0 4px 12px rgba(0,0,0,.11),inset 0 3px 6px rgba(255,255,255,.4),inset 0 -3px 8px rgba(0,0,0,.18)`
                                : `0 0 8px ${th.ai}50,0 4px 10px rgba(0,0,0,.1),inset 0 3px 6px rgba(255,255,255,.4),inset 0 -3px 8px rgba(0,0,0,.16)`
                              : "inset 0 4px 10px rgba(130,150,200,.28),inset 0 1px 0 rgba(255,255,255,.3)",
                            animation: isDrop
                              ? "drop-in .44s cubic-bezier(.33,1,.68,1)"
                              : win
                              ? "pulse-win .95s ease infinite"
                              : "none",
                          }}
                        >
                          {/* Specular highlight */}
                          {(isP||isA) && (
                            <div style={{
                              position:"absolute",top:"17%",left:"21%",
                              width:"30%",height:"20%",borderRadius:"50%",
                              background:"rgba(255,255,255,.52)",
                              filter:"blur(2px)",pointerEvents:"none",
                            }}/>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* ── Result panel ── */}
          {phase==="result" && (
            <div style={{
              textAlign:"center",
              background:"rgba(255,255,255,.75)",backdropFilter:"blur(22px)",
              borderRadius:22,padding:"22px 30px",
              border:"1.5px solid rgba(255,255,255,.92)",
              boxShadow:"0 12px 40px rgba(80,100,200,.12)",
              maxWidth:310,width:"100%",
              animation:"fadein .5s cubic-bezier(.34,1.56,.64,1)",
            }}>
              <div style={{
                fontSize:32,fontWeight:800,marginBottom:6,
                color:outcome==="won"?th.p:outcome==="lost"?th.ai:"#94A3B8",
                animation:"stamp .5s cubic-bezier(.34,1.56,.64,1)",
              }}>
                {outcome==="won"?"🏆 Victoire !":outcome==="lost"?"🤖 L'IA gagne":"🤝 Égalité"}
              </div>

              {outcome==="won"&&showBD&&breakdown&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:27,fontWeight:800,color:th.p,marginBottom:12,letterSpacing:"-1px"}}>
                    +{breakdown.total.toLocaleString("fr")} pts
                  </div>
                  {[
                    {k:"base",    icon:"⭐",label:"Base",              v:breakdown.base},
                    {k:"speed",   icon:"⚡",label:"Vitesse",           v:breakdown.speed},
                    {k:"streakB", icon:"🔥",label:"Série",             v:breakdown.streakB},
                    {k:"blockB",  icon:"🛡",label:"Blocages défensifs", v:breakdown.blockB},
                    {k:"centerB", icon:"🎯",label:"Contrôle centre",   v:breakdown.centerB},
                  ].filter(x=>x.v>0).map(({k,icon,label,v},i)=>(
                    <div key={k} style={{
                      display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5,
                      animation:`score-row .3s ${i*.06}s ease both`,
                    }}>
                      <span style={{color:"#94A3B8",fontSize:12,fontWeight:600}}>{icon} {label}</span>
                      <span style={{color:"#374151",fontSize:13,fontWeight:800}}>+{v}</span>
                    </div>
                  ))}
                  {breakdown.mult>1&&(
                    <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid rgba(0,0,0,.07)",display:"flex",justifyContent:"space-between"}}>
                      <span style={{color:"#94A3B8",fontSize:12,fontWeight:600}}>✨ Multiplicateur</span>
                      <span style={{color:"#4C6EF5",fontSize:15,fontWeight:800}}>×{breakdown.mult}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{display:"flex",gap:8}}>
                <button onClick={startGame}
                  onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                  onMouseLeave={e=>e.currentTarget.style.transform=""}
                  style={{
                    flex:1,padding:"11px",borderRadius:12,cursor:"pointer",
                    background:`linear-gradient(130deg,${th.p},${th.ai})`,
                    border:"none",color:"#fff",fontSize:13,fontWeight:800,
                    fontFamily:"inherit",boxShadow:`0 4px 16px ${th.p}50`,transition:"all .2s",
                  }}>↺ Rejouer</button>
                <button onClick={goMenu}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,.08)"}
                  onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,.05)"}
                  style={{
                    flex:1,padding:"11px",borderRadius:12,cursor:"pointer",
                    background:"rgba(0,0,0,.05)",border:"1.5px solid rgba(0,0,0,.08)",
                    color:"#374151",fontSize:13,fontWeight:700,fontFamily:"inherit",transition:"all .18s",
                  }}>☰ Menu</button>
              </div>
            </div>
          )}

          {/* ── In-game bottom bar ── */}
          {phase==="playing" && (
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={goMenu}
                onMouseEnter={e=>e.currentTarget.style.color="#374151"}
                onMouseLeave={e=>e.currentTarget.style.color="#94A3B8"}
                style={{
                  padding:"7px 16px",borderRadius:10,cursor:"pointer",
                  background:"rgba(255,255,255,.65)",backdropFilter:"blur(8px)",
                  border:"1px solid rgba(0,0,0,.07)",color:"#94A3B8",
                  fontSize:12,fontWeight:700,fontFamily:"inherit",transition:"color .15s",
                }}>← Menu</button>
              <div style={{
                display:"flex",gap:12,alignItems:"center",
                background:"rgba(255,255,255,.65)",backdropFilter:"blur(8px)",
                borderRadius:10,padding:"7px 14px",
                border:"1px solid rgba(0,0,0,.06)",
              }}>
                {[{c:th.p,l:"Vous"},{c:th.ai,l:"IA"}].map(({c,l})=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:9,height:9,borderRadius:"50%",background:c,boxShadow:`0 0 5px ${c}`}}/>
                    <span style={{color:"#94A3B8",fontSize:12,fontWeight:700}}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}