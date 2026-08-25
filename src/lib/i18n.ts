// Lightweight i18n for Color Switch Rush.
// Language is resolved from ytgame.system.getLanguage() when available,
// otherwise from navigator.language. Missing keys fall back to English.

export type Lang = "en" | "es" | "fr" | "de" | "pt" | "ja" | "zh" | "ko" | "it" | "ru";

export type Dict = {
  title: string;
  tagline: string;
  modeEndless: string;
  modeDaily: string;
  modePractice: string;
  playEndless: string;
  playDaily: string;
  playPractice: string;
  practiceHint: string;
  practiceRun: string;
  practiceComplete: string;
  score: string;
  combo: string;
  best: string;
  bestCombo: string;
  todaysBest: string;
  allTime: string;
  peakCombo: string;
  reachedLevel: string;
  level: string;
  speedUpIn: string;
  paused: string;
  resume: string;
  quitRun: string;
  quitHint: string;
  quitDiscards: string;
  gameOver: string;
  newBest: string;
  newDailyBest: string;
  playAgain: string;
  menu: string;
  share: string;
  settings: string;
  done: string;
  sound: string;
  soundDesc: string;
  shake: string;
  shakeDesc: string;
  reducedMotion: string;
  reducedMotionDesc: string;
  colorblind: string;
  colorblindDesc: string;
  streakDays: (n: number) => string;
  streakKeep: string;
  cycleColor: string;
  pauseResumeAnytime: string;
  badgesEarned: string;
  nextBadge: (combo: number, label: string, remaining: number) => string;
  firstBadgeHint: (combo: number) => string;
  canYouBeatIt: string;
  bestPass: string;
  perfectChain: string;
  passMiss: string;
  debugPanel: string;
  runTests: string;
  running: string;
  close: string;
  passed: string;
  failed: string;
  skipped: string;
  matchThreadCombo: string;
  copyReport: string;
  copied: string;
  downloadReport: string;
  selfCheckOk: (pass: number, total: number) => string;
  selfCheckFail: (fail: number) => string;
  selfCheckRunning: string;
  language: string;
  languageDesc: string;
  languageAuto: string;
  rerunCheck: string;
  showDetails: string;
  hideDetails: string;
  failingTests: string;
  recentLogs: string;
  exportOptions: string;
  includeLogs: string;
  includeEnvMeta: string;
  openDebugPanel: string;
};


const en: Dict = {
  title: "Color Switch Rush",
  tagline: "Match · Thread · Combo",
  modeEndless: "Endless",
  modeDaily: "Daily",
  modePractice: "Practice",
  playEndless: "▶ Play Endless",
  playDaily: "★ Daily Challenge",
  playPractice: "◐ Practice (slow warm-up)",
  practiceHint: "Practice · fixed slow speed",
  practiceRun: "Practice Run",
  practiceComplete: "Warm-up complete · scores not saved",
  score: "Score",
  combo: "Combo",
  best: "Best",
  bestCombo: "Best combo",
  todaysBest: "Today's best",
  allTime: "All-time",
  peakCombo: "Peak combo",
  reachedLevel: "Reached level",
  level: "Level",
  speedUpIn: "Speed up in",
  paused: "Paused",
  resume: "▶ Resume",
  quitRun: "✕ Quit run",
  quitHint: "resume · Q — quit",
  quitDiscards: "Quitting discards this run",
  gameOver: "Game Over",
  newBest: "New best score",
  newDailyBest: "New daily best",
  playAgain: "Play again",
  menu: "Menu",
  share: "Share",
  settings: "Settings",
  done: "Done",
  sound: "Sound",
  soundDesc: "Beeps & feedback tones",
  shake: "Screen shake",
  shakeDesc: "Rumble on near-miss & crash",
  reducedMotion: "Reduced motion",
  reducedMotionDesc: "Limit shake, flashes & glow",
  colorblind: "Colorblind mode",
  colorblindDesc: "Distinct hues + shape symbols",
  streakDays: (n) => `${n}-day streak`,
  streakKeep: "keep it alive",
  cycleColor: "cycle color",
  pauseResumeAnytime: "Pause / resume anytime",
  badgesEarned: "Combo Badges Earned",
  nextBadge: (combo, label, remaining) => `Next: x${combo} ${label} — ${remaining} to go`,
  firstBadgeHint: (combo) => `Chain x${combo} for your first badge`,
  canYouBeatIt: "Can you beat it?",
  bestPass: "Best combo",
  perfectChain: "Perfect chain",
  passMiss: "Pass / Miss",
  debugPanel: "Playables self-check",
  runTests: "Run tests",
  running: "Running…",
  close: "Close",
  passed: "PASS",
  failed: "FAIL",
  skipped: "SKIP",
  matchThreadCombo: "Match · Thread · Combo",
  copyReport: "Copy JSON",
  copied: "Copied",
  downloadReport: "Download JSON",
  selfCheckOk: (pass, total) => `Playables check ${pass}/${total} passed`,
  selfCheckFail: (fail) => `Playables check — ${fail} failed`,
  selfCheckRunning: "Running Playables check…",
  language: "Language",
  languageDesc: "Override the auto-detected locale",
  languageAuto: "Automatic",
};


const es: Partial<Dict> = {
  tagline: "Iguala · Atraviesa · Combo",
  modeEndless: "Infinito",
  modeDaily: "Diario",
  modePractice: "Práctica",
  playEndless: "▶ Jugar Infinito",
  playDaily: "★ Reto Diario",
  playPractice: "◐ Práctica (calentamiento)",
  practiceHint: "Práctica · velocidad fija lenta",
  practiceRun: "Ronda de práctica",
  practiceComplete: "Calentamiento listo · no se guarda",
  score: "Puntos",
  combo: "Combo",
  best: "Mejor",
  bestCombo: "Mejor combo",
  todaysBest: "Mejor de hoy",
  allTime: "Histórico",
  peakCombo: "Combo máx.",
  reachedLevel: "Nivel alcanzado",
  level: "Nivel",
  speedUpIn: "Acelera en",
  paused: "Pausado",
  resume: "▶ Continuar",
  quitRun: "✕ Salir",
  gameOver: "Fin de la partida",
  newBest: "Nuevo récord",
  newDailyBest: "Récord diario",
  playAgain: "Jugar de nuevo",
  menu: "Menú",
  share: "Compartir",
  settings: "Ajustes",
  done: "Listo",
  sound: "Sonido",
  soundDesc: "Pitidos y efectos",
  shake: "Vibración",
  shakeDesc: "Sacudida al casi-fallar",
  reducedMotion: "Movimiento reducido",
  reducedMotionDesc: "Limita destellos y sacudidas",
  colorblind: "Daltónico",
  colorblindDesc: "Colores distintos + símbolos",
  streakDays: (n) => `Racha de ${n} días`,
  streakKeep: "no la pierdas",
  cycleColor: "cambiar color",
  pauseResumeAnytime: "Pausa / reanuda cuando quieras",
  badgesEarned: "Insignias obtenidas",
  nextBadge: (c, l, r) => `Siguiente: x${c} ${l} — faltan ${r}`,
  firstBadgeHint: (c) => `Encadena x${c} para tu primera insignia`,
  canYouBeatIt: "¿Puedes superarlo?",
  bestPass: "Mejor combo",
  perfectChain: "Cadena perfecta",
  passMiss: "Aciertos / Fallos",
  debugPanel: "Autoprueba Playables",
  runTests: "Ejecutar pruebas",
  running: "Ejecutando…",
  close: "Cerrar",
  matchThreadCombo: "Iguala · Atraviesa · Combo",
};

const fr: Partial<Dict> = {
  tagline: "Accorde · Traverse · Combo",
  modeEndless: "Infini",
  modeDaily: "Quotidien",
  modePractice: "Entraînement",
  playEndless: "▶ Jouer Infini",
  playDaily: "★ Défi Quotidien",
  playPractice: "◐ Entraînement (échauffement)",
  practiceHint: "Entraînement · vitesse lente",
  practiceRun: "Session d'entraînement",
  practiceComplete: "Échauffement terminé · non enregistré",
  score: "Score",
  combo: "Combo",
  best: "Meilleur",
  bestCombo: "Meilleur combo",
  todaysBest: "Meilleur du jour",
  allTime: "Historique",
  peakCombo: "Combo max.",
  reachedLevel: "Niveau atteint",
  level: "Niveau",
  speedUpIn: "Accélère dans",
  paused: "En pause",
  resume: "▶ Reprendre",
  quitRun: "✕ Quitter",
  gameOver: "Partie terminée",
  newBest: "Nouveau record",
  newDailyBest: "Record du jour",
  playAgain: "Rejouer",
  menu: "Menu",
  share: "Partager",
  settings: "Réglages",
  done: "OK",
  sound: "Son",
  soundDesc: "Bips et effets",
  shake: "Vibration écran",
  shakeDesc: "Secousse quasi-échec / crash",
  reducedMotion: "Mouvement réduit",
  reducedMotionDesc: "Limite secousses et éclats",
  colorblind: "Daltonien",
  colorblindDesc: "Teintes distinctes + symboles",
  streakDays: (n) => `Série de ${n} jours`,
  streakKeep: "à ne pas casser",
  cycleColor: "changer de couleur",
  pauseResumeAnytime: "Pause / reprise à tout moment",
  badgesEarned: "Badges gagnés",
  nextBadge: (c, l, r) => `Suivant : x${c} ${l} — ${r} restants`,
  firstBadgeHint: (c) => `Enchaîne x${c} pour ton premier badge`,
  canYouBeatIt: "Fais mieux si tu peux !",
  bestPass: "Meilleur combo",
  perfectChain: "Chaîne parfaite",
  passMiss: "Réussi / Raté",
  debugPanel: "Auto-test Playables",
  runTests: "Lancer les tests",
  running: "En cours…",
  close: "Fermer",
  matchThreadCombo: "Accorde · Traverse · Combo",
};

const de: Partial<Dict> = {
  tagline: "Passe · Fädele · Combo",
  modeEndless: "Endlos",
  modeDaily: "Täglich",
  modePractice: "Übung",
  playEndless: "▶ Endlos spielen",
  playDaily: "★ Tages-Challenge",
  playPractice: "◐ Übung (Aufwärmen)",
  practiceHint: "Übung · feste langsame Geschwindigkeit",
  practiceRun: "Übungslauf",
  practiceComplete: "Aufwärmen fertig · nicht gespeichert",
  score: "Punkte",
  combo: "Combo",
  best: "Beste",
  bestCombo: "Bester Combo",
  todaysBest: "Heute beste",
  allTime: "Allzeit",
  peakCombo: "Combo-Max",
  reachedLevel: "Level erreicht",
  level: "Level",
  speedUpIn: "Beschleunigt in",
  paused: "Pausiert",
  resume: "▶ Weiter",
  quitRun: "✕ Beenden",
  gameOver: "Game Over",
  newBest: "Neue Bestleistung",
  newDailyBest: "Neuer Tagesrekord",
  playAgain: "Nochmal",
  menu: "Menü",
  share: "Teilen",
  settings: "Einstellungen",
  done: "Fertig",
  sound: "Sound",
  soundDesc: "Töne & Effekte",
  shake: "Bildschirm-Rütteln",
  shakeDesc: "Rütteln bei Beinahe-Fehler",
  reducedMotion: "Weniger Bewegung",
  reducedMotionDesc: "Weniger Rütteln & Blitze",
  colorblind: "Farbenblind-Modus",
  colorblindDesc: "Klare Farben + Symbole",
  streakDays: (n) => `${n}-Tage-Serie`,
  streakKeep: "halte sie am Leben",
  cycleColor: "Farbe wechseln",
  pauseResumeAnytime: "Jederzeit pausieren",
  badgesEarned: "Combo-Abzeichen",
  nextBadge: (c, l, r) => `Nächstes: x${c} ${l} — noch ${r}`,
  firstBadgeHint: (c) => `Kette x${c} für dein erstes Abzeichen`,
  canYouBeatIt: "Schaffst du mehr?",
  bestPass: "Bester Combo",
  perfectChain: "Perfekte Kette",
  passMiss: "Treffer / Fehler",
  debugPanel: "Playables-Selbsttest",
  runTests: "Tests starten",
  running: "Läuft…",
  close: "Schließen",
  matchThreadCombo: "Passe · Fädele · Combo",
};

const pt: Partial<Dict> = {
  tagline: "Combine · Passe · Combo",
  modeEndless: "Infinito",
  modeDaily: "Diário",
  modePractice: "Prática",
  playEndless: "▶ Jogar Infinito",
  playDaily: "★ Desafio Diário",
  playPractice: "◐ Prática (aquecimento)",
  practiceHint: "Prática · velocidade fixa lenta",
  practiceRun: "Rodada de prática",
  practiceComplete: "Aquecimento pronto · não salvo",
  score: "Pontos",
  combo: "Combo",
  best: "Melhor",
  bestCombo: "Melhor combo",
  todaysBest: "Melhor de hoje",
  allTime: "Geral",
  peakCombo: "Pico de combo",
  reachedLevel: "Nível alcançado",
  level: "Nível",
  speedUpIn: "Acelera em",
  paused: "Pausado",
  resume: "▶ Continuar",
  quitRun: "✕ Sair",
  gameOver: "Fim de jogo",
  newBest: "Novo recorde",
  newDailyBest: "Recorde diário",
  playAgain: "Jogar de novo",
  menu: "Menu",
  share: "Compartilhar",
  settings: "Ajustes",
  done: "Pronto",
  sound: "Som",
  soundDesc: "Bipes e efeitos",
  shake: "Tremor de tela",
  shakeDesc: "Tremor em quase-erro",
  reducedMotion: "Movimento reduzido",
  reducedMotionDesc: "Limita tremores e flashes",
  colorblind: "Daltônico",
  colorblindDesc: "Cores distintas + símbolos",
  streakDays: (n) => `Sequência de ${n} dias`,
  streakKeep: "mantenha viva",
  cycleColor: "trocar cor",
  pauseResumeAnytime: "Pause a qualquer momento",
  badgesEarned: "Insígnias obtidas",
  nextBadge: (c, l, r) => `Próxima: x${c} ${l} — faltam ${r}`,
  firstBadgeHint: (c) => `Encadeie x${c} para a primeira insígnia`,
  canYouBeatIt: "Consegue superar?",
  bestPass: "Melhor combo",
  perfectChain: "Cadeia perfeita",
  passMiss: "Acertos / Erros",
  debugPanel: "Autoteste Playables",
  runTests: "Executar testes",
  running: "Executando…",
  close: "Fechar",
  matchThreadCombo: "Combine · Passe · Combo",
};

const ja: Partial<Dict> = {
  tagline: "合わせて · 通り抜けて · コンボ",
  modeEndless: "エンドレス",
  modeDaily: "デイリー",
  modePractice: "練習",
  playEndless: "▶ エンドレスをプレイ",
  playDaily: "★ デイリーチャレンジ",
  playPractice: "◐ 練習(ウォームアップ)",
  practiceHint: "練習 · 低速固定",
  practiceRun: "練習ラン",
  practiceComplete: "ウォームアップ完了 · 記録なし",
  score: "スコア",
  combo: "コンボ",
  best: "ベスト",
  bestCombo: "ベストコンボ",
  todaysBest: "今日のベスト",
  allTime: "歴代",
  peakCombo: "最高コンボ",
  reachedLevel: "到達レベル",
  level: "レベル",
  speedUpIn: "加速まで",
  paused: "一時停止",
  resume: "▶ 再開",
  quitRun: "✕ やめる",
  gameOver: "ゲームオーバー",
  newBest: "自己ベスト更新",
  newDailyBest: "デイリー自己ベスト",
  playAgain: "もう一度",
  menu: "メニュー",
  share: "シェア",
  settings: "設定",
  done: "完了",
  sound: "サウンド",
  soundDesc: "ビープ音とフィードバック",
  shake: "画面シェイク",
  shakeDesc: "ニアミス時に揺れる",
  reducedMotion: "モーション軽減",
  reducedMotionDesc: "揺れや点滅を抑える",
  colorblind: "色覚サポート",
  colorblindDesc: "識別色 + 記号",
  streakDays: (n) => `${n}日連続`,
  streakKeep: "維持しよう",
  cycleColor: "色を変える",
  pauseResumeAnytime: "いつでも一時停止/再開",
  badgesEarned: "獲得バッジ",
  nextBadge: (c, l, r) => `次: x${c} ${l} — あと${r}`,
  firstBadgeHint: (c) => `x${c}を繋げて最初のバッジ`,
  canYouBeatIt: "超えられる?",
  bestPass: "ベストコンボ",
  perfectChain: "パーフェクト連鎖",
  passMiss: "成功 / 失敗",
  debugPanel: "Playablesセルフチェック",
  runTests: "テスト実行",
  running: "実行中…",
  close: "閉じる",
  matchThreadCombo: "合わせて · 通り抜けて · コンボ",
};

const zh: Partial<Dict> = {
  tagline: "对色 · 穿门 · 连击",
  modeEndless: "无尽",
  modeDaily: "每日",
  modePractice: "练习",
  playEndless: "▶ 无尽模式",
  playDaily: "★ 每日挑战",
  playPractice: "◐ 练习(热身)",
  practiceHint: "练习 · 固定慢速",
  practiceRun: "练习回合",
  practiceComplete: "热身完成 · 不记录",
  score: "分数",
  combo: "连击",
  best: "最佳",
  bestCombo: "最佳连击",
  todaysBest: "今日最佳",
  allTime: "历史",
  peakCombo: "最高连击",
  reachedLevel: "达到关卡",
  level: "关卡",
  speedUpIn: "加速倒计",
  paused: "已暂停",
  resume: "▶ 继续",
  quitRun: "✕ 退出",
  gameOver: "游戏结束",
  newBest: "新纪录",
  newDailyBest: "每日新纪录",
  playAgain: "再来一局",
  menu: "菜单",
  share: "分享",
  settings: "设置",
  done: "完成",
  sound: "音效",
  soundDesc: "提示音与反馈",
  shake: "画面震动",
  shakeDesc: "险过与撞击震动",
  reducedMotion: "减弱动效",
  reducedMotionDesc: "减少震动和闪烁",
  colorblind: "色盲模式",
  colorblindDesc: "高对比色+图形符号",
  streakDays: (n) => `连续${n}天`,
  streakKeep: "别断哦",
  cycleColor: "切换颜色",
  pauseResumeAnytime: "随时暂停/继续",
  badgesEarned: "获得徽章",
  nextBadge: (c, l, r) => `下一个: x${c} ${l} — 还差${r}`,
  firstBadgeHint: (c) => `连击x${c}解锁首个徽章`,
  canYouBeatIt: "你能超越吗?",
  bestPass: "最佳连击",
  perfectChain: "完美连锁",
  passMiss: "成功 / 失误",
  debugPanel: "Playables 自检",
  runTests: "运行测试",
  running: "运行中…",
  close: "关闭",
  matchThreadCombo: "对色 · 穿门 · 连击",
};

const ko: Partial<Dict> = {
  tagline: "맞추고 · 통과하고 · 콤보",
  modeEndless: "무한",
  modeDaily: "데일리",
  modePractice: "연습",
  playEndless: "▶ 무한 모드",
  playDaily: "★ 데일리 챌린지",
  playPractice: "◐ 연습(워밍업)",
  practiceHint: "연습 · 고정 저속",
  practiceRun: "연습 라운드",
  practiceComplete: "워밍업 완료 · 저장되지 않음",
  score: "점수",
  combo: "콤보",
  best: "최고",
  bestCombo: "최고 콤보",
  todaysBest: "오늘 최고",
  allTime: "전체",
  peakCombo: "최고 콤보",
  reachedLevel: "도달 레벨",
  level: "레벨",
  speedUpIn: "가속까지",
  paused: "일시정지",
  resume: "▶ 계속",
  quitRun: "✕ 나가기",
  gameOver: "게임 종료",
  newBest: "최고 기록!",
  newDailyBest: "오늘 최고 기록",
  playAgain: "다시하기",
  menu: "메뉴",
  share: "공유",
  settings: "설정",
  done: "완료",
  sound: "사운드",
  soundDesc: "효과음과 피드백",
  shake: "화면 흔들림",
  shakeDesc: "근접 실패 시 진동",
  reducedMotion: "모션 감소",
  reducedMotionDesc: "흔들림·번쩍임 감소",
  colorblind: "색약 모드",
  colorblindDesc: "구별색 + 도형 기호",
  streakDays: (n) => `${n}일 연속`,
  streakKeep: "이어가세요",
  cycleColor: "색 바꾸기",
  pauseResumeAnytime: "언제든 일시정지",
  badgesEarned: "획득 뱃지",
  nextBadge: (c, l, r) => `다음: x${c} ${l} — ${r} 남음`,
  firstBadgeHint: (c) => `x${c} 콤보로 첫 뱃지`,
  canYouBeatIt: "이길 수 있나요?",
  bestPass: "최고 콤보",
  perfectChain: "퍼펙트 체인",
  passMiss: "성공 / 실패",
  debugPanel: "Playables 셀프체크",
  runTests: "테스트 실행",
  running: "실행 중…",
  close: "닫기",
  matchThreadCombo: "맞추고 · 통과하고 · 콤보",
};

const it: Partial<Dict> = {
  tagline: "Abbina · Passa · Combo",
  modeEndless: "Infinito",
  modeDaily: "Giornaliero",
  modePractice: "Allenamento",
  playEndless: "▶ Gioca Infinito",
  playDaily: "★ Sfida Giornaliera",
  playPractice: "◐ Allenamento (riscaldamento)",
  practiceHint: "Allenamento · velocità lenta",
  practiceRun: "Sessione di allenamento",
  practiceComplete: "Riscaldamento fatto · non salvato",
  score: "Punti",
  combo: "Combo",
  best: "Migliore",
  bestCombo: "Miglior combo",
  todaysBest: "Miglior di oggi",
  allTime: "Assoluto",
  peakCombo: "Combo max",
  reachedLevel: "Livello raggiunto",
  level: "Livello",
  speedUpIn: "Accelera tra",
  paused: "In pausa",
  resume: "▶ Riprendi",
  quitRun: "✕ Esci",
  gameOver: "Partita finita",
  newBest: "Nuovo record",
  newDailyBest: "Record giornaliero",
  playAgain: "Ancora",
  menu: "Menu",
  share: "Condividi",
  settings: "Impostazioni",
  done: "OK",
  sound: "Suono",
  soundDesc: "Bip e feedback",
  shake: "Vibrazione schermo",
  shakeDesc: "Tremore su quasi-errore",
  reducedMotion: "Movimento ridotto",
  reducedMotionDesc: "Limita tremori e flash",
  colorblind: "Modalità daltonica",
  colorblindDesc: "Colori distinti + simboli",
  streakDays: (n) => `Serie di ${n} giorni`,
  streakKeep: "non spezzarla",
  cycleColor: "cambia colore",
  pauseResumeAnytime: "Pausa/ripresa in ogni momento",
  badgesEarned: "Distintivi ottenuti",
  nextBadge: (c, l, r) => `Prossimo: x${c} ${l} — mancano ${r}`,
  firstBadgeHint: (c) => `Concatena x${c} per il primo distintivo`,
  canYouBeatIt: "Riesci a batterlo?",
  bestPass: "Miglior combo",
  perfectChain: "Catena perfetta",
  passMiss: "Riusciti / Falliti",
  debugPanel: "Autotest Playables",
  runTests: "Esegui test",
  running: "In corso…",
  close: "Chiudi",
  matchThreadCombo: "Abbina · Passa · Combo",
};

const ru: Partial<Dict> = {
  tagline: "Совпади · Пройди · Комбо",
  modeEndless: "Бесконечный",
  modeDaily: "Ежедневный",
  modePractice: "Тренировка",
  playEndless: "▶ Бесконечный",
  playDaily: "★ Ежедневный вызов",
  playPractice: "◐ Тренировка (разминка)",
  practiceHint: "Тренировка · медленный темп",
  practiceRun: "Тренировочный забег",
  practiceComplete: "Разминка окончена · не сохраняется",
  score: "Счёт",
  combo: "Комбо",
  best: "Лучший",
  bestCombo: "Лучшее комбо",
  todaysBest: "Лучший сегодня",
  allTime: "За всё время",
  peakCombo: "Пик комбо",
  reachedLevel: "Уровень достигнут",
  level: "Уровень",
  speedUpIn: "Ускорение через",
  paused: "Пауза",
  resume: "▶ Продолжить",
  quitRun: "✕ Выйти",
  gameOver: "Игра окончена",
  newBest: "Новый рекорд",
  newDailyBest: "Дневной рекорд",
  playAgain: "Ещё раз",
  menu: "Меню",
  share: "Поделиться",
  settings: "Настройки",
  done: "Готово",
  sound: "Звук",
  soundDesc: "Сигналы и эффекты",
  shake: "Тряска экрана",
  shakeDesc: "Тряска при почти-промахе",
  reducedMotion: "Меньше движения",
  reducedMotionDesc: "Меньше тряски и вспышек",
  colorblind: "Режим для дальтоников",
  colorblindDesc: "Разные цвета и символы",
  streakDays: (n) => `Серия ${n} дн.`,
  streakKeep: "не прерывайте",
  cycleColor: "сменить цвет",
  pauseResumeAnytime: "Пауза в любой момент",
  badgesEarned: "Полученные значки",
  nextBadge: (c, l, r) => `Далее: x${c} ${l} — осталось ${r}`,
  firstBadgeHint: (c) => `Держите x${c} для первого значка`,
  canYouBeatIt: "Сможешь побить?",
  bestPass: "Лучшее комбо",
  perfectChain: "Идеальная цепь",
  passMiss: "Успех / Промах",
  debugPanel: "Самопроверка Playables",
  runTests: "Запустить тесты",
  running: "Выполняется…",
  close: "Закрыть",
  matchThreadCombo: "Совпади · Пройди · Комбо",
};

const DICTS: Record<Lang, Partial<Dict>> = { en, es, fr, de, pt, ja, zh, ko, it, ru };

export function resolveLang(raw: string | undefined | null): Lang {
  if (!raw) return "en";
  const l = raw.toLowerCase();
  const base = l.split(/[-_]/)[0];
  if (base in DICTS) return base as Lang;
  return "en";
}

export function getDict(lang: Lang): Dict {
  return { ...en, ...DICTS[lang] } as Dict;
}

export async function detectLanguage(): Promise<Lang> {
  if (typeof window === "undefined") return "en";
  try {
    const yt = window.ytgame;
    if (yt && typeof yt.system?.getLanguage === "function") {
      const raw = await yt.system.getLanguage();
      return resolveLang(raw);
    }
  } catch {}
  try {
    return resolveLang(navigator.language);
  } catch {
    return "en";
  }
}

export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
  it: "Italiano",
  ru: "Русский",
};

export const LANGS = Object.keys(LANG_NAMES) as Lang[];

/** BCP 47 tag used for Intl formatting for a given app language. */
export function localeTag(lang: Lang): string {
  return lang;
}

/**
 * Formats a `YYYY-MM-DD` key using the player's locale rules.
 * Falls back to the raw key if Intl is unavailable.
 */
export function formatDate(
  key: string,
  lang: Lang,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  try {
    return new Intl.DateTimeFormat(localeTag(lang), opts).format(new Date(y, m - 1, d));
  } catch {
    return key;
  }
}

/** Formats a number using the player's locale rules. */
export function formatNumber(n: number, lang: Lang): string {
  try {
    return new Intl.NumberFormat(localeTag(lang)).format(n);
  } catch {
    return String(n);
  }
}
