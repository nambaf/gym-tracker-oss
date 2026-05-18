export type Dictionary = {
  nav: {
    home: string
    workout: string
    history: string
    plan: string
    profile: string
  }
  login: {
    eyebrow: string
    title: string
    titleFirst: string
    subtitle: string
    subtitleFirst: string
    email: string
    password: string
    newPassword: string
    passwordRequirements: string
    submit: string
    submitFirst: string
    errors: {
      invalidCredentials: string
      invalidNewPassword: string
      passwordResetRequired: string
      generic: string
      network: string
    }
  }
  common: {
    loading: string
    error: string
    retry: string
    save: string
    cancel: string
    close: string
    delete: string
    confirm: string
    add: string
    edit: string
    today: string
    language: string
  }
  ai: {
    notConfigured: string
    notEnabled: string
    weeklyTitle: string
    weeklySubtitle: string
    planTitle: string
    planSubtitle: string
    greeting: string
    placeholder: string
    errorRetry: string
  }
  trainingModes: {
    intensity: { label: string; desc: string }
    volume: { label: string; desc: string }
    mixed: { label: string; desc: string }
  }
  muscles: Record<string, string>
  exercise: {
    eyebrow: string
    sessionsCount: string
    setsCount: string
    oneRMEstimated: string
    realPR: string
    deltaInSuffix: string
    chartTitle: string
    periodAll: string
    chartTooltipLabel: string
    suggestedTitle: string
    recentTitle: string
    setLabel: string
    chipFailure: string
    emptyState: string
  }
  history: {
    eyebrow: string
    titleLine1: string
    titleLine2: string
    chartWeek: string
    chartMonth: string
    periodTitle: string
    periodCancel: string
    periodCustom: string
    periodApply: string
    periodThisWeek: string
    periodLastWeek: string
    periodLast30: string
    periodLast3m: string
    periodLast6m: string
    maxRangeAlert: string
    sessionsCountSingular: string
    sessionsCountPlural: string
    timelineLabel: string
    emptySession: string
    exercisesCount: string
    moreExercises: string
    morePrefix: string
    morePlural: string
    setsSuffix: string
    rpeSuffix: string
    emptyState: string
  }
  bodyMap: {
    title: string
    subtitle: string
    emptyData: string
    frontTitle: string
    backTitle: string
    actualSets: string
    plannedSets: string
    completion: string
    volume: string
    legendWell: string
    legendUnder: string
    legendNot: string
    legendUnplanned: string
    detailedMuscles: Record<string, string>
  }
  volumeChart: {
    title: string
    emptyState: string
    subtitleTemplate: string
    yAxisLabel: string
    tooltipSets: string
    tooltipVolume: string
    totalSets: string
    avgPerWeek: string
    breakdownTitle: string
    breakdownSubtitle: string
    hardSets: string
    targetPrefix: string
    targetSuffix: string
    warnInsufficientTitle: string
    warnInsufficientBody: string
    warnDeficitSets: string
    warnSuggestion: string
    warnMaintenanceTitle: string
    warnMaintenanceBody: string
    statusBadge: {
      insufficient: string
      maintenance: string
      hypertrophy: string
    }
  }
  intensityChart: {
    title: string
    emptyState: string
    subtitleTemplate: string
    yLeft: string
    yRight: string
    legendRpe: string
    legendIntensity: string
    statRpe: string
    statIntensity: string
  }
  exerciseHistory: {
    errorLoad: string
    firstTimePrefix: string
    firstTimeSuffix: string
    lastTime: string
    maxE1rm: string
    avgIntensityShort: string
    expandPrefix: string
    daysAgoSuffix: string
    today: string
    yesterday: string
    weeksAgoSingular: string
    weeksAgoSuffix: string
    monthSingular: string
    monthPlural: string
    monthsAgoSuffix: string
  }
  deloadBanner: {
    title: string
    body: string
    analyseBtn: string
    deactivateBtn: string
  }
  progressModal: {
    title: string
    empty: string
    emptySubtitle: string
    currentE1rm: string
    avgE1rm: string
    footnote: string
    badgeImproving: string
    badgeStable: string
    badgeDeclining: string
  }
  setRow: {
    recommendedFor: string
    repsSuffix: string
    rpeSuffix: string
    deloadSuffix: string
    weightLabel: string
    repsLabel: string
    frequentWeights: string
    intensityLabel: string
    intensityOpts: {
      veryEasy: string
      easy: string
      medium: string
      hard: string
      veryHard: string
    }
    failureToggle: string
    hideNote: string
    addNote: string
    notePlaceholder: string
    saveBtn: string
    saveBtnFailureSuffix: string
    lastSetLabel: string
  }
  restTimer: {
    label: string
    notifTitle: string
    notifBody: string
    stopAria: string
    stopBtn: string
    startBtn: string
    runningHint: string
    rest: string
    presets: {
      compound: string
      standard: string
      isolation: string
    }
  }
  workoutTimer: {
    startBtn: string
  }
  swipe: {
    confirm: string
    delete: string
  }
  previousSession: {
    label: string
    today: string
    yesterday: string
    daysAgoSuffix: string
  }
  sessionSummary: {
    title: string
    closeBtn: string
    loading: string
    error: string
    volume: string
    avgIntensity: string
    failureSets: string
    musclesTitle: string
    miscMuscle: string
    exercisesTitle: string
    setsTotal: string
    failureCountSuffix: string
    topPrefix: string
    e1rmPrefix: string
    cta: string
  }
  workout: {
    eyebrowDay: string
    eyebrowReady: string
    exerciseLabel: string
    ofConnector: string
    setsTotalSuffix: string
    addExerciseShort: string
    setLabel: string
    targetLabel: string
    repsLabel: string
    rpeLabel: string
    planNote: string
    setsToday: string
    setPrefix: string
    chipFailure: string
    removeExerciseBtn: string
    saving: string
    finishBtn: string
    pickerTitle: string
    pickerPlaceholder: string
  }
  plan: {
    untitledPlan: string
    selectorEmpty: string
    selectorActiveSuffix: string
    menuTitle: string
    menuNewEmpty: string
    menuDuplicate: string
    menuActivate: string
    menuRename: string
    menuDelete: string
    createdAt: string
    activeChip: string
    headerEyebrow: string
    daysCount: string
    exercisesTotal: string
    saveTooltipDirty: string
    saveTooltipClean: string
    saveBtnSaving: string
    saveBtnDirty: string
    saveBtnClean: string
    errors: {
      load: string
      create: string
      activate: string
      delete: string
      rename: string
      save: string
      cantDeleteActive: string
    }
    prompts: {
      copySuffix: string
      newPlanDefaultName: string
      askNewPlanName: string
      switchDirty: string
      askDelete: string
      askRename: string
      askRenameDay: string
      askRemoveDay: string
    }
    dayLabelPrefix: string
    dayStripExSuffix: string
    dayStripEmpty: string
    dayNamePlaceholder: string
    dayStatExercises: string
    dayStatSets: string
    dayStatRpe: string
    dayStatEst: string
    minutesShort: string
    sessionWarningsTitle: string
    sessionWarningsBody: string
    sessionWarningsLimit: string
    exerciseSingular: string
    exercisePlural: string
    minutesApprox: string
    deleteDayBtn: string
    rowSelectExercise: string
    rowSelectPlaceholder: string
    rowExercise: string
    rowSets: string
    rowReps: string
    rowRepsPlaceholder: string
    rowRpe: string
    rowRpePlaceholder: string
    rowNote: string
    rowNotePlaceholder: string
    rowMoveUp: string
    rowMoveDown: string
    rowRemove: string
    addExerciseBtn: string
    coverageTitle: string
    coverageSetsSuffix: string
    settings: string
    deloadChip: string
    trainingModeLabel: string
    deloadTitle: string
    deloadDesc: string
    seed: {
      title: string
      body: string
      btn: string
      btnRunning: string
      success: string
      error: string
    }
  }
  home: {
    sessionsThisWeek: string
    volumeTotalUnit: string
    statStreak: string
    statWeekSingular: string
    statWeekPlural: string
    statVolume: string
    statVolumeUnit: string
    stat1RM: string
    stat1RMNoData: string
    activityTitle: string
    activityOf: string
    weekDayInitials: readonly [string, string, string, string, string, string, string]
    next: {
      planEyebrow: string
      noPlanTitle: string
      noPlanSubtitle: string
      goToPlan: string
      todayCompleted: string
      todayNext: string
      tomorrowNext: string
      otherNextPrefix: string
      exercisesSuffix: string
      minutesSuffix: string
      reviewBtn: string
      startBtn: string
    }
    freshInstall: {
      eyebrow: string
      title: string
      body: string
      cta: string
    }
  }
  setup: {
    title: string
    subtitle: string
    skip: string
    allDone: string
    allDoneCta: string
    statusPending: string
    statusDone: string
    exercises: {
      title: string
      body: string
      btn: string
      btnRunning: string
      errorGeneric: string
    }
    plan: {
      title: string
      body: string
      btn: string
      btnRunning: string
      blockedNoExercises: string
      errorGeneric: string
    }
    settings: {
      title: string
      body: string
      btn: string
      btnRunning: string
      alreadyInit: string
      errorGeneric: string
    }
  }
  profile: {
    title: string
    subtitle: string
    save: string
    saving: string
    saved: string
    errorGeneric: string
    sectionBasic: string
    sectionAdvanced: string
    sectionMatrices: string
    comingSoon: string
    resetSection: string
    resetConfirm: string
    basic: {
      athleteProfile: { label: string; placeholder: string; helper: string }
      athleteNotes: { label: string; placeholder: string; helper: string }
      trainingMode: { label: string }
      deload: { label: string; helper: string }
    }
    advanced: {
      maxSetsPerSession: { label: string; helper: string }
      restCompound: { label: string; helper: string }
      restStandard: { label: string; helper: string }
      restIsolation: { label: string; helper: string }
      restSecondsSuffix: string
      compoundMuscles: { label: string; placeholder: string; helper: string }
      isolationMuscles: { label: string; placeholder: string; helper: string }
    }
    matrices: {
      thresholds: { title: string; helper: string; fieldA: string; fieldB: string }
      recommendedSets: { title: string; helper: string; fieldA: string; fieldB: string }
    }
  }
}

export const it: Dictionary = {
  nav: {
    home: 'Home',
    workout: 'Workout',
    history: 'Storico',
    plan: 'Piano',
    profile: 'Profilo',
  },
  login: {
    eyebrow: 'Gym Tracker',
    title: 'Accedi',
    titleFirst: 'Imposta password',
    subtitle: 'Una volta dentro, la sessione dura un\'ora.',
    subtitleFirst: 'Primo accesso: scegli una nuova password.',
    email: 'Email',
    password: 'Password',
    newPassword: 'Nuova password',
    passwordRequirements: 'Min 8 caratteri, maiuscola, minuscola, numero e simbolo.',
    submit: 'Entra',
    submitFirst: 'Imposta e entra',
    errors: {
      invalidCredentials: 'Email o password non validi',
      invalidNewPassword: 'La nuova password non rispetta i requisiti',
      passwordResetRequired: 'Reset password richiesto, contatta l\'admin',
      generic: 'Errore, riprova',
      network: 'Errore di rete',
    },
  },
  common: {
    loading: 'Caricamento…',
    error: 'Errore',
    retry: 'Riprova',
    save: 'Salva',
    cancel: 'Annulla',
    close: 'Chiudi',
    delete: 'Elimina',
    confirm: 'Conferma',
    add: 'Aggiungi',
    edit: 'Modifica',
    today: 'Oggi',
    language: 'Lingua',
  },
  ai: {
    notConfigured: 'Coach AI non configurato',
    notEnabled: 'Coach AI disattivato',
    weeklyTitle: 'Coach · settimana',
    weeklySubtitle: 'Analisi progressi e suggerimenti',
    planTitle: 'Coach · piano',
    planSubtitle: 'Valutazione piano e ottimizzazioni',
    greeting: 'Ciao! Sono il tuo Coach AI. Ho precompilato un messaggio qui sotto con i dati aggiornati. Modificalo o invialo così com\'è.',
    placeholder: 'Chiedi al coach...',
    errorRetry: 'Errore nella risposta. Riprova.',
  },
  trainingModes: {
    intensity: { label: 'Intensità', desc: 'Pochi set a cedimento' },
    volume: { label: 'Volume', desc: 'Più set con 2–3 RIR' },
    mixed: { label: 'Misto', desc: 'Upper intensità, lower volume' },
  },
  muscles: {
    petto: 'Petto', dorsali: 'Dorsali', spalle: 'Spalle',
    bicipiti: 'Bicipiti', tricipiti: 'Tricipiti', quadricipiti: 'Quadricipiti',
    femorali: 'Femorali', glutei: 'Glutei', polpacci: 'Polpacci',
    core: 'Core', trapezi: 'Trapezi', avambracci: 'Avambracci', adduttori: 'Adduttori',
  },
  exercise: {
    eyebrow: 'Esercizio',
    sessionsCount: 'sessioni',
    setsCount: 'set',
    oneRMEstimated: '1RM stimato',
    realPR: 'PR reale',
    deltaInSuffix: 'in',
    chartTitle: 'Progressione 1RM',
    periodAll: 'Tutto',
    chartTooltipLabel: '1RM',
    suggestedTitle: 'Suggerito per la prossima sessione',
    recentTitle: 'Sessioni recenti',
    setLabel: 'Set',
    chipFailure: 'cedimento',
    emptyState: 'Nessuna sessione registrata ancora per questo esercizio.',
  },
  history: {
    eyebrow: 'Storico',
    titleLine1: 'Le tue',
    titleLine2: 'sessioni',
    chartWeek: 'Settimana',
    chartMonth: 'Mese',
    periodTitle: 'Periodo',
    periodCancel: 'Annulla',
    periodCustom: 'Personalizza',
    periodApply: 'Applica',
    periodThisWeek: 'Questa settimana',
    periodLastWeek: 'Settimana scorsa',
    periodLast30: 'Ultimi 30 giorni',
    periodLast3m: 'Ultimi 3 mesi',
    periodLast6m: 'Ultimi 6 mesi',
    maxRangeAlert: 'Il periodo massimo selezionabile è 6 mesi',
    sessionsCountSingular: 'sessione',
    sessionsCountPlural: 'sessioni',
    timelineLabel: 'Sessioni',
    emptySession: 'Sessione vuota',
    exercisesCount: 'esercizi',
    moreExercises: 'altri esercizi',
    morePrefix: '+',
    morePlural: 'altri',
    setsSuffix: 'set',
    rpeSuffix: 'RPE',
    emptyState: 'Nessuna sessione con esercizi trovata nel periodo selezionato.',
  },
  bodyMap: {
    title: 'Muscoli allenati vs piano',
    subtitle: 'Confronto set effettivi vs pianificati per questa settimana',
    emptyData: 'Nessun dato muscolare trovato. Verifica che il piano sia caricato correttamente.',
    frontTitle: 'Fronte',
    backTitle: 'Retro',
    actualSets: 'Set effettivi:',
    plannedSets: 'Set pianificati:',
    completion: 'Completamento:',
    volume: 'Volume:',
    legendWell: 'Ben allenato (≥80%)',
    legendUnder: 'Sotto-allenato (50-79%)',
    legendNot: 'Non allenato (<50%)',
    legendUnplanned: 'Non pianificato',
    detailedMuscles: {
      'chest': 'Petto',
      'upper-back': 'Dorsali Alti',
      'lower-back': 'Dorsali Bassi',
      'front-deltoids': 'Deltoidi Anteriori',
      'back-deltoids': 'Deltoidi Posteriori',
      'biceps': 'Bicipiti',
      'triceps': 'Tricipiti',
      'quadriceps': 'Quadricipiti',
      'hamstring': 'Femorali',
      'gluteal': 'Glutei',
      'calves': 'Polpacci',
      'abs': 'Addominali',
      'obliques': 'Obliqui',
      'trapezius': 'Trapezi',
      'forearm': 'Avambracci',
      'adductor': 'Adduttori',
    },
  },
  volumeChart: {
    title: 'Volume settimanale',
    emptyState: 'Nessun dato disponibile per il periodo selezionato',
    subtitleTemplate: 'Trend dei set totali nelle ultime {n} settimane',
    yAxisLabel: 'Set totali',
    tooltipSets: 'Set',
    tooltipVolume: 'Volume',
    totalSets: 'set totali',
    avgPerWeek: 'set di media/settimana',
    breakdownTitle: 'Hard set per gruppo muscolare (settimana corrente)',
    breakdownSubtitle: 'Set con RPE ≥ 7 (3 o meno ripetizioni in riserva)',
    hardSets: 'hard set',
    targetPrefix: '(obiettivo:',
    targetSuffix: 'set)',
    warnInsufficientTitle: 'Volume insufficiente',
    warnInsufficientBody: 'I seguenti gruppi muscolari sono sotto la soglia minima per l\'ipertrofia:',
    warnDeficitSets: 'mancano circa',
    warnSuggestion: 'Suggerimento: aumenta il numero di serie per questi gruppi muscolari.',
    warnMaintenanceTitle: 'Zona mantenimento',
    warnMaintenanceBody: 'Alcuni muscoli sono in zona mantenimento. Per massimizzare l\'ipertrofia, considera di aggiungere serie:',
    statusBadge: {
      insufficient: '❌ Insufficiente',
      maintenance: '⚠️ Mantenimento',
      hypertrophy: '✅ Ipertrofia',
    },
  },
  intensityChart: {
    title: 'Intensità allenamenti',
    emptyState: 'Nessun dato disponibile per il periodo selezionato',
    subtitleTemplate: 'Trend di RPE medio e intensità (% massimale) negli ultimi {n} giorni',
    yLeft: 'RPE',
    yRight: '% Massimale',
    legendRpe: 'RPE medio',
    legendIntensity: 'Intensità media (%)',
    statRpe: 'RPE medio:',
    statIntensity: 'Intensità media:',
  },
  exerciseHistory: {
    errorLoad: 'Errore nel caricamento storico',
    firstTimePrefix: 'Prima volta',
    firstTimeSuffix: '. Inizia con un peso gestibile e concentrati sulla tecnica.',
    lastTime: 'Ultima volta',
    maxE1rm: 'Max e1RM',
    avgIntensityShort: 'Int. media',
    expandPrefix: 'Ultimi',
    daysAgoSuffix: 'giorni fa',
    today: 'oggi',
    yesterday: 'ieri',
    weeksAgoSingular: '1 settimana fa',
    weeksAgoSuffix: 'settimane fa',
    monthSingular: 'mese',
    monthPlural: 'mesi',
    monthsAgoSuffix: 'fa',
  },
  deloadBanner: {
    title: 'Settimana di scarico attiva',
    body: 'RPE −2 su tutti gli esercizi per permettere il recupero sistemico.',
    analyseBtn: 'Analizza progresso',
    deactivateBtn: 'Disattiva',
  },
  progressModal: {
    title: 'Analisi Progresso (ultime 4 settimane)',
    empty: 'Ancora nessun dato di progresso.',
    emptySubtitle: 'Continua ad allenarti per vedere i trend!',
    currentE1rm: 'e1RM Corrente',
    avgE1rm: 'e1RM Medio',
    footnote: 'Il progresso è calcolato confrontando l\'e1RM (massimale stimato) delle ultime 4 settimane.',
    badgeImproving: 'In miglioramento',
    badgeStable: 'Stabile',
    badgeDeclining: 'In calo',
  },
  setRow: {
    recommendedFor: 'Consigliato per',
    repsSuffix: 'reps',
    rpeSuffix: 'RPE',
    deloadSuffix: '(scarico)',
    weightLabel: 'Peso',
    repsLabel: 'Ripetizioni',
    frequentWeights: 'Pesi frequenti',
    intensityLabel: 'Intensità percepita',
    intensityOpts: {
      veryEasy: 'Molto facile',
      easy: 'Facile',
      medium: 'Medio',
      hard: 'Difficile',
      veryHard: 'Molto duro',
    },
    failureToggle: 'Cedimento',
    hideNote: 'Nascondi nota',
    addNote: '+ Aggiungi nota',
    notePlaceholder: 'Es. difficile i primi set, meglio del previsto…',
    saveBtn: 'Salva set',
    saveBtnFailureSuffix: '· cedimento',
    lastSetLabel: 'Ultimo set:',
  },
  restTimer: {
    label: 'Riposo',
    notifTitle: 'Riposo completato',
    notifBody: 'Pronto per la prossima serie.',
    stopAria: 'Ferma timer',
    stopBtn: 'Stop',
    startBtn: 'Avvia',
    runningHint: 'Timer in corso · usa la barra in basso per fermarlo o aggiungere tempo',
    rest: 'Riposo',
    presets: {
      compound: 'Composto',
      standard: 'Standard',
      isolation: 'Isolamento',
    },
  },
  workoutTimer: {
    startBtn: 'Inizia',
  },
  swipe: {
    confirm: 'Conferma?',
    delete: 'Elimina',
  },
  previousSession: {
    label: 'Sessione precedente',
    today: 'oggi',
    yesterday: 'ieri',
    daysAgoSuffix: 'g fa',
  },
  sessionSummary: {
    title: 'Riepilogo sessione',
    closeBtn: 'Chiudi',
    loading: 'Caricamento…',
    error: 'Errore caricamento dati',
    volume: 'Volume',
    avgIntensity: 'Intensità media',
    failureSets: 'Set cedimento',
    musclesTitle: 'Muscoli coinvolti (per volume)',
    miscMuscle: 'varie',
    exercisesTitle: 'Esercizi completati',
    setsTotal: 'set totali',
    failureCountSuffix: 'a cedimento',
    topPrefix: 'Top:',
    e1rmPrefix: 'e1RM:',
    cta: 'Ottimo lavoro!',
  },
  workout: {
    eyebrowDay: 'Allenamento',
    eyebrowReady: 'Pronto',
    exerciseLabel: 'Esercizio',
    ofConnector: 'di',
    setsTotalSuffix: 'set tot.',
    addExerciseShort: 'Aggiungi',
    setLabel: 'Set',
    targetLabel: 'Target',
    repsLabel: 'reps',
    rpeLabel: 'RPE',
    planNote: 'Nota piano',
    setsToday: 'Set di oggi',
    setPrefix: 'Set',
    chipFailure: 'cedimento',
    removeExerciseBtn: 'Rimuovi esercizio dal workout',
    saving: 'Salvataggio…',
    finishBtn: 'Termina allenamento',
    pickerTitle: 'Aggiungi esercizio',
    pickerPlaceholder: 'Cerca esercizio…',
  },
  plan: {
    untitledPlan: 'Piano senza nome',
    selectorEmpty: 'Nessun piano',
    selectorActiveSuffix: ' · attivo',
    menuTitle: 'Azioni piano',
    menuNewEmpty: 'Nuovo piano vuoto',
    menuDuplicate: 'Duplica corrente',
    menuActivate: 'Imposta come attivo',
    menuRename: 'Rinomina',
    menuDelete: 'Elimina',
    createdAt: 'Creato',
    activeChip: 'attivo',
    headerEyebrow: 'Piano',
    daysCount: 'giorni',
    exercisesTotal: 'esercizi totali',
    saveTooltipDirty: 'Salva modifiche al piano',
    saveTooltipClean: 'Tutto salvato',
    saveBtnSaving: 'Salvo…',
    saveBtnDirty: 'Salva piano',
    saveBtnClean: 'Salvato',
    errors: {
      load: 'Impossibile caricare i piani. Riprova.',
      create: 'Creazione piano fallita.',
      activate: 'Attivazione fallita.',
      delete: 'Eliminazione fallita.',
      rename: 'Rinomina fallita.',
      save: 'Salvataggio fallito. Controlla la rete e riprova.',
      cantDeleteActive: 'Non puoi eliminare il piano attivo. Attivane prima un altro.',
    },
    prompts: {
      copySuffix: ' (copia)',
      newPlanDefaultName: 'Nuovo piano',
      askNewPlanName: 'Nome del nuovo piano:',
      switchDirty: 'Hai modifiche non salvate. Cambiare piano le perderà. Continuare?',
      askDelete: 'Eliminare definitivamente "{name}"?',
      askRename: 'Nuovo nome:',
      askRenameDay: 'Nuovo nome per il giorno',
      askRemoveDay: 'Rimuovere il giorno "{name}" e tutti i suoi esercizi?',
    },
    dayLabelPrefix: 'G',
    dayStripExSuffix: 'ex',
    dayStripEmpty: 'vuoto',
    dayNamePlaceholder: 'Nome…',
    dayStatExercises: 'Esercizi',
    dayStatSets: 'Set tot.',
    dayStatRpe: 'RPE avg',
    dayStatEst: 'Stim.',
    minutesShort: 'm',
    sessionWarningsTitle: 'Volume eccessivo per sessione',
    sessionWarningsBody: 'Oltre ~10 set per muscolo in una sessione i rendimenti calano significativamente.',
    sessionWarningsLimit: 'set (limite {limit})',
    exerciseSingular: 'esercizio',
    exercisePlural: 'esercizi',
    minutesApprox: 'min',
    deleteDayBtn: 'Elimina giorno',
    rowSelectExercise: 'Seleziona esercizio',
    rowSelectPlaceholder: '— Seleziona —',
    rowExercise: 'Esercizio',
    rowSets: 'Set',
    rowReps: 'Reps',
    rowRepsPlaceholder: '5 o 6-8',
    rowRpe: 'RPE',
    rowRpePlaceholder: '7-10',
    rowNote: 'Note',
    rowNotePlaceholder: 'Note opzionali…',
    rowMoveUp: 'Sposta su',
    rowMoveDown: 'Sposta giù',
    rowRemove: 'Rimuovi',
    addExerciseBtn: 'Aggiungi esercizio',
    coverageTitle: 'Copertura piano',
    coverageSetsSuffix: 'set',
    settings: 'Impostazioni allenamento',
    deloadChip: 'Deload attivo',
    trainingModeLabel: 'Modalità di allenamento',
    deloadTitle: 'Settimana di scarico',
    deloadDesc: 'RPE −2 su tutti gli esercizi.',
    seed: {
      title: 'Nessun esercizio nel database',
      body: 'Per partire ti serve un catalogo di esercizi. Inserisci la lista predefinita (~26 esercizi che coprono tutti i gruppi muscolari) — potrai modificarla quando vuoi dalla schermata Piano.',
      btn: 'Carica la lista predefinita',
      btnRunning: 'Caricamento…',
      success: 'Esercizi predefiniti caricati.',
      error: 'Errore nel caricamento degli esercizi.',
    },
  },
  home: {
    sessionsThisWeek: 'sessioni questa settimana',
    volumeTotalUnit: 'kg·rep totali.',
    statStreak: 'Streak',
    statWeekSingular: 'settimana',
    statWeekPlural: 'settimane',
    statVolume: 'Volume sett.',
    statVolumeUnit: 'k kg·rep',
    stat1RM: '1RM stim.',
    stat1RMNoData: 'nessun dato',
    activityTitle: 'Attività · 2 settimane',
    activityOf: 'di 14 giorni',
    weekDayInitials: ['D', 'L', 'M', 'M', 'G', 'V', 'S'] as const,
    next: {
      planEyebrow: 'Piano',
      noPlanTitle: 'Nessun piano impostato',
      noPlanSubtitle: 'Crea il tuo piano settimanale per vedere il prossimo workout.',
      goToPlan: 'Vai al piano',
      todayCompleted: 'Oggi · Completato',
      todayNext: 'Prossimo · Oggi',
      tomorrowNext: 'Prossimo · Domani',
      otherNextPrefix: 'Prossimo · ',
      exercisesSuffix: 'esercizi',
      minutesSuffix: 'min',
      reviewBtn: 'Rivedi',
      startBtn: 'Inizia',
    },
    freshInstall: {
      eyebrow: 'Installazione nuova',
      title: 'Configura il tuo gym tracker',
      body: 'La tua scheda è vuota. Carica gli esercizi di default e un piano di partenza in pochi click.',
      cta: 'Avvia il setup',
    },
  },
  setup: {
    title: 'Setup iniziale',
    subtitle: 'Tre passaggi opzionali per partire subito. Puoi saltarli e configurare tutto a mano dal Piano.',
    skip: 'Salta e vai alla dashboard',
    allDone: 'Setup completato.',
    allDoneCta: 'Vai alla dashboard',
    statusPending: 'Da fare',
    statusDone: 'Fatto',
    exercises: {
      title: '1 · Esercizi di default',
      body: 'Carica una lista di ~27 esercizi base che coprono tutti i gruppi muscolari. Potrai rinominarli o cancellarli dalla schermata Piano.',
      btn: 'Carica gli esercizi',
      btnRunning: 'Caricamento…',
      errorGeneric: 'Errore nel caricamento degli esercizi.',
    },
    plan: {
      title: '2 · Piano starter (opzionale)',
      body: 'Inserisce un piano full-body 2 giorni (A/B) con i fondamentali. Modificalo a piacere dopo dal Piano.',
      btn: 'Crea il piano starter',
      btnRunning: 'Creazione…',
      blockedNoExercises: 'Carica prima gli esercizi.',
      errorGeneric: 'Errore nella creazione del piano.',
    },
    settings: {
      title: '3 · Impostazioni profilo (opzionale)',
      body: 'Crea il record di impostazioni. Ogni valore resta sui default finché non lo modifichi dalla pagina Profilo.',
      btn: 'Inizializza',
      btnRunning: 'Inizializzazione…',
      alreadyInit: 'Già inizializzato.',
      errorGeneric: 'Errore nell\'inizializzazione delle impostazioni.',
    },
  },
  profile: {
    title: 'Profilo & impostazioni',
    subtitle: 'Profilo atleta, approccio di allenamento e soglie avanzate. I valori non impostati ricadono sui default.',
    save: 'Salva',
    saving: 'Salvataggio…',
    saved: 'Salvato',
    errorGeneric: 'Errore nel salvataggio.',
    sectionBasic: 'Base',
    sectionAdvanced: 'Avanzate',
    sectionMatrices: 'Avanzate — matrici',
    comingSoon: 'Disponibile a breve.',
    resetSection: 'Ripristina ai default',
    resetConfirm: 'Ripristinare questa sezione ai default?',
    basic: {
      athleteProfile: {
        label: 'Profilo atleta',
        placeholder: 'es. intermedio, 80kg, obiettivo ipertrofia',
        helper: 'Riga libera passata come contesto a ogni prompt del coach AI.',
      },
      athleteNotes: {
        label: 'Note aggiuntive',
        placeholder: 'es. niente squat per problema al ginocchio',
        helper: 'Note che il coach dovrebbe sempre tenere a mente.',
      },
      trainingMode: {
        label: 'Approccio di allenamento',
      },
      deload: {
        label: 'Modalità deload',
        helper: 'Riduce il volume suggerito per la fase di recupero.',
      },
    },
    advanced: {
      maxSetsPerSession: {
        label: 'Set massimi per muscolo per sessione',
        helper: 'Oltre questa soglia, il volume aggiuntivo rende sempre meno (junk volume). Range consigliato: 4–20.',
      },
      restCompound: {
        label: 'Recupero — multi-articolare',
        helper: 'Tempo di recupero per movimenti pesanti multi-articolari (squat, panca, stacco).',
      },
      restStandard: {
        label: 'Recupero — standard',
        helper: 'Tempo di recupero per esercizi misti o monoarticolari pesanti.',
      },
      restIsolation: {
        label: 'Recupero — isolamento',
        helper: 'Tempo di recupero per esercizi di isolamento (curl, alzate laterali, push-down).',
      },
      restSecondsSuffix: 'sec',
      compoundMuscles: {
        label: 'Muscoli "multi-articolari"',
        placeholder: 'quadricipiti, glutei, dorsali, petto…',
        helper: 'Lista separata da virgole. Lowercase. Usato per scegliere il preset di recupero.',
      },
      isolationMuscles: {
        label: 'Muscoli di "isolamento"',
        placeholder: 'bicipiti, tricipiti, polpacci…',
        helper: 'Lista separata da virgole. Lowercase. Usato per scegliere il preset di recupero.',
      },
    },
    matrices: {
      thresholds: {
        title: 'Soglie ipertrofia (hard set settimanali)',
        helper: 'Per ogni muscolo: minimo per mantenere la massa vs soglia di ipertrofia attiva.',
        fieldA: 'Mant.',
        fieldB: 'Iper.',
      },
      recommendedSets: {
        title: 'Set raccomandati (completezza piano)',
        helper: 'Per ogni muscolo: minimo per essere coperto dal piano vs ottimale.',
        fieldA: 'Min.',
        fieldB: 'Ott.',
      },
    },
  },
}
