'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import exercises from '@/data/exercises.json';

export const LANGS = [
  { code: 'pt', label: 'Português', short: 'PT', locale: 'pt-BR' },
  { code: 'es', label: 'Español', short: 'ES', locale: 'es-ES' },
  { code: 'fr', label: 'Français', short: 'FR', locale: 'fr-FR' },
];

const DEFAULT_LANG = 'pt';
const STORAGE_KEY = 'moviq_lang';

const dict = {
  pt: {
    loading: 'Carregando...',
    // Login
    loginSubtitle: 'Entre na sua conta',
    signupSubtitle: 'Crie sua conta grátis',
    name: 'Nome',
    namePlaceholder: 'Seu nome',
    email: 'E-mail',
    emailPlaceholder: 'voce@email.com',
    password: 'Senha',
    passwordPlaceholder: 'Mínimo 6 caracteres',
    wait: 'Aguarde...',
    signIn: 'Entrar',
    createAccount: 'Criar minha conta',
    noAccount: 'Ainda não tem conta?',
    haveAccount: 'Já tem conta?',
    signUp: 'Cadastre-se',
    accountCreated: 'Conta criada! Verifique seu e-mail para confirmar o cadastro.',
    errInvalid: 'E-mail ou senha incorretos.',
    errRegistered: 'Este e-mail já está cadastrado.',
    errShort: 'A senha precisa ter pelo menos 6 caracteres.',
    errNotConfirmed: 'Confirme seu e-mail antes de entrar.',
    errNetwork: 'Não foi possível conectar ao servidor. Tente novamente em instantes.',
    errPrefix: 'Erro: ',
    // Nav
    tabHome: 'Início',
    tabWorkout: 'Treino',
    tabProfile: 'Perfil',
    // Home
    noWorkouts: 'Nenhum treino ainda',
    noWorkoutsHint: 'Vá até a aba Treino para criar sua primeira rotina!',
    sets: 'séries',
    noSetsDone: 'Nenhuma série concluída',
    delete: 'Excluir',
    confirmDeleteWorkout: 'Excluir este treino do seu histórico?',
    // Routines
    createRoutine: 'Criar nova rotina',
    myRoutines: 'Minhas rotinas',
    noRoutines: 'Você ainda não tem rotinas. Crie a primeira acima!',
    start: 'Iniciar',
    edit: 'Editar',
    confirmDeleteRoutine: 'Excluir esta rotina?',
    // New routine
    editRoutine: 'Editar rotina',
    newRoutine: 'Nova rotina',
    routineName: 'Nome da rotina',
    routineNamePlaceholder: 'Ex.: Peito e Tríceps',
    setsLabel: 'Séries',
    repsLabel: 'Repetições',
    restLabel: 'Descanso (s)',
    remove: 'Remover',
    addExercise: 'Adicionar exercício',
    saving: 'Salvando...',
    saveRoutine: 'Salvar rotina',
    alertRoutineName: 'Dê um nome para sua rotina.',
    alertAddExercise: 'Adicione pelo menos um exercício.',
    saveError: 'Erro ao salvar: ',
    // Picker
    searchExercise: 'Buscar exercício...',
    all: 'Todos',
    exercisesCount: 'exercícios',
    showMore: 'Mostrar mais',
    // Session
    rest: 'Descanso',
    setCol: 'SÉRIE',
    kgCol: 'KG',
    repsCol: 'REPS',
    setDone: 'Série concluída',
    addSet: 'Série',
    finishWorkout: 'Finalizar treino',
    discard: 'Descartar',
    confirmNoSets: 'Nenhuma série concluída. Finalizar mesmo assim?',
    confirmDiscard: 'Descartar este treino?',
    resting: 'Descansando',
    skip: 'Pular',
    defaultSession: 'Treino',
    // Profile
    sessions: 'treinos',
    trainingTime: 'de treino',
    bmi: 'IMC',
    weight: 'Peso (kg)',
    height: 'Altura (cm)',
    saveProfile: 'Salvar perfil',
    profileSaved: 'Perfil salvo!',
    logout: 'Sair',
    language: 'Idioma',
  },
  es: {
    loading: 'Cargando...',
    loginSubtitle: 'Inicia sesión en tu cuenta',
    signupSubtitle: 'Crea tu cuenta gratis',
    name: 'Nombre',
    namePlaceholder: 'Tu nombre',
    email: 'Correo electrónico',
    emailPlaceholder: 'tu@email.com',
    password: 'Contraseña',
    passwordPlaceholder: 'Mínimo 6 caracteres',
    wait: 'Espera...',
    signIn: 'Iniciar sesión',
    createAccount: 'Crear mi cuenta',
    noAccount: '¿Aún no tienes cuenta?',
    haveAccount: '¿Ya tienes cuenta?',
    signUp: 'Regístrate',
    accountCreated: '¡Cuenta creada! Revisa tu correo para confirmar el registro.',
    errInvalid: 'Correo o contraseña incorrectos.',
    errRegistered: 'Este correo ya está registrado.',
    errShort: 'La contraseña debe tener al menos 6 caracteres.',
    errNotConfirmed: 'Confirma tu correo antes de iniciar sesión.',
    errNetwork: 'No se pudo conectar con el servidor. Inténtalo de nuevo en unos instantes.',
    errPrefix: 'Error: ',
    tabHome: 'Inicio',
    tabWorkout: 'Entreno',
    tabProfile: 'Perfil',
    noWorkouts: 'Aún no hay entrenamientos',
    noWorkoutsHint: '¡Ve a la pestaña Entreno para crear tu primera rutina!',
    sets: 'series',
    noSetsDone: 'Ninguna serie completada',
    delete: 'Eliminar',
    confirmDeleteWorkout: '¿Eliminar este entrenamiento de tu historial?',
    createRoutine: 'Crear nueva rutina',
    myRoutines: 'Mis rutinas',
    noRoutines: 'Aún no tienes rutinas. ¡Crea la primera arriba!',
    start: 'Empezar',
    edit: 'Editar',
    confirmDeleteRoutine: '¿Eliminar esta rutina?',
    editRoutine: 'Editar rutina',
    newRoutine: 'Nueva rutina',
    routineName: 'Nombre de la rutina',
    routineNamePlaceholder: 'Ej.: Pecho y tríceps',
    setsLabel: 'Series',
    repsLabel: 'Repeticiones',
    restLabel: 'Descanso (s)',
    remove: 'Quitar',
    addExercise: 'Añadir ejercicio',
    saving: 'Guardando...',
    saveRoutine: 'Guardar rutina',
    alertRoutineName: 'Ponle un nombre a tu rutina.',
    alertAddExercise: 'Añade al menos un ejercicio.',
    saveError: 'Error al guardar: ',
    searchExercise: 'Buscar ejercicio...',
    all: 'Todos',
    exercisesCount: 'ejercicios',
    showMore: 'Mostrar más',
    rest: 'Descanso',
    setCol: 'SERIE',
    kgCol: 'KG',
    repsCol: 'REPS',
    setDone: 'Serie completada',
    addSet: 'Serie',
    finishWorkout: 'Terminar entrenamiento',
    discard: 'Descartar',
    confirmNoSets: 'Ninguna serie completada. ¿Terminar de todos modos?',
    confirmDiscard: '¿Descartar este entrenamiento?',
    resting: 'Descansando',
    skip: 'Saltar',
    defaultSession: 'Entrenamiento',
    sessions: 'entrenos',
    trainingTime: 'de entreno',
    bmi: 'IMC',
    weight: 'Peso (kg)',
    height: 'Altura (cm)',
    saveProfile: 'Guardar perfil',
    profileSaved: '¡Perfil guardado!',
    logout: 'Cerrar sesión',
    language: 'Idioma',
  },
  fr: {
    loading: 'Chargement...',
    loginSubtitle: 'Connectez-vous à votre compte',
    signupSubtitle: 'Créez votre compte gratuit',
    name: 'Nom',
    namePlaceholder: 'Votre nom',
    email: 'E-mail',
    emailPlaceholder: 'vous@email.com',
    password: 'Mot de passe',
    passwordPlaceholder: 'Minimum 6 caractères',
    wait: 'Veuillez patienter...',
    signIn: 'Se connecter',
    createAccount: 'Créer mon compte',
    noAccount: 'Pas encore de compte ?',
    haveAccount: 'Déjà un compte ?',
    signUp: "S'inscrire",
    accountCreated: 'Compte créé ! Vérifiez votre e-mail pour confirmer votre inscription.',
    errInvalid: 'E-mail ou mot de passe incorrect.',
    errRegistered: 'Cet e-mail est déjà enregistré.',
    errShort: 'Le mot de passe doit contenir au moins 6 caractères.',
    errNotConfirmed: 'Confirmez votre e-mail avant de vous connecter.',
    errNetwork: 'Impossible de joindre le serveur. Réessayez dans quelques instants.',
    errPrefix: 'Erreur : ',
    tabHome: 'Accueil',
    tabWorkout: 'Entraînement',
    tabProfile: 'Profil',
    noWorkouts: 'Aucun entraînement pour le moment',
    noWorkoutsHint: "Allez dans l'onglet Entraînement pour créer votre première routine !",
    sets: 'séries',
    noSetsDone: 'Aucune série terminée',
    delete: 'Supprimer',
    confirmDeleteWorkout: 'Supprimer cet entraînement de votre historique ?',
    createRoutine: 'Créer une nouvelle routine',
    myRoutines: 'Mes routines',
    noRoutines: "Vous n'avez pas encore de routine. Créez la première ci-dessus !",
    start: 'Démarrer',
    edit: 'Modifier',
    confirmDeleteRoutine: 'Supprimer cette routine ?',
    editRoutine: 'Modifier la routine',
    newRoutine: 'Nouvelle routine',
    routineName: 'Nom de la routine',
    routineNamePlaceholder: 'Ex : Pectoraux et Triceps',
    setsLabel: 'Séries',
    repsLabel: 'Répétitions',
    restLabel: 'Repos (s)',
    remove: 'Retirer',
    addExercise: 'Ajouter un exercice',
    saving: 'Sauvegarde...',
    saveRoutine: 'Sauvegarder la routine',
    alertRoutineName: 'Donnez un nom à votre routine.',
    alertAddExercise: 'Ajoutez au moins un exercice.',
    saveError: 'Erreur lors de la sauvegarde : ',
    searchExercise: 'Rechercher un exercice...',
    all: 'Tous',
    exercisesCount: 'exercices',
    showMore: 'Afficher plus',
    rest: 'Repos',
    setCol: 'SÉRIE',
    kgCol: 'KG',
    repsCol: 'REPS',
    setDone: 'Série terminée',
    addSet: 'Série',
    finishWorkout: 'Terminer la séance',
    discard: 'Abandonner',
    confirmNoSets: 'Aucune série terminée. Terminer quand même ?',
    confirmDiscard: 'Abandonner cette séance ?',
    resting: 'Repos en cours',
    skip: 'Passer',
    defaultSession: 'Séance',
    sessions: 'séances',
    trainingTime: "d'entraînement",
    bmi: 'IMC',
    weight: 'Poids (kg)',
    height: 'Taille (cm)',
    saveProfile: 'Sauvegarder le profil',
    profileSaved: 'Profil sauvegardé !',
    logout: 'Se déconnecter',
    language: 'Langue',
  },
};

const categories = {
  calisthenics: { pt: 'Calistenia', es: 'Calistenia', fr: 'Callisthénie' },
  crossfit: { pt: 'CrossFit', es: 'CrossFit', fr: 'CrossFit' },
  functional: { pt: 'Funcional e HIIT', es: 'Funcional y HIIT', fr: 'Fonctionnel et HIIT' },
  mobility: { pt: 'Mobilidade e Alongamento', es: 'Movilidad y Estiramientos', fr: 'Mobilité et Étirements' },
  strength: { pt: 'Musculação', es: 'Musculación', fr: 'Musculation' },
  neck: { pt: 'Pescoço', es: 'Cuello', fr: 'Cou' },
};

const muscles = {
  glutes: { pt: 'Glúteos', es: 'Glúteos', fr: 'Fessiers' },
  legs: { pt: 'Pernas', es: 'Piernas', fr: 'Jambes' },
  calves: { pt: 'Panturrilhas', es: 'Pantorrillas', fr: 'Mollets' },
  cardio: { pt: 'Cardio', es: 'Cardio', fr: 'Cardio' },
  chest: { pt: 'Peitoral', es: 'Pecho', fr: 'Pectoraux' },
  forearms: { pt: 'Antebraços', es: 'Antebrazos', fr: 'Avant-bras' },
  back: { pt: 'Costas', es: 'Espalda', fr: 'Dos' },
  shoulders: { pt: 'Ombros', es: 'Hombros', fr: 'Épaules' },
  traps: { pt: 'Trapézio', es: 'Trapecios', fr: 'Trapèzes' },
  triceps: { pt: 'Tríceps', es: 'Tríceps', fr: 'Triceps' },
  erectors: { pt: 'Eretores da espinha', es: 'Erectores espinales', fr: 'Érecteurs du rachis' },
  biceps: { pt: 'Bíceps', es: 'Bíceps', fr: 'Biceps' },
};

// Índices do catálogo para traduzir exercícios já salvos (rotinas e histórico)
const byId = new Map(exercises.map((e) => [e.id, e]));
const byGif = new Map(exercises.map((e) => [e.gif, e]));

export function findExercise(ex) {
  if (!ex) return null;
  return byId.get(ex.id) || byGif.get(ex.gif) || null;
}

function isLang(code) {
  return LANGS.some((l) => l.code === code);
}

function detectLang() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (isLang(fromUrl)) return fromUrl;
  } catch (e) {}
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch (e) {}
  const nav = (navigator.languages || [navigator.language || '']).map((l) => (l || '').slice(0, 2).toLowerCase());
  const match = nav.find(isLang);
  return match || DEFAULT_LANG;
}

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    const l = detectLang();
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch (e) {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l) => {
    if (!isLang(l)) return;
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch (e) {}
  }, []);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LangContext) || { lang: DEFAULT_LANG, setLang: () => {} };
  const { lang, setLang } = ctx;
  const t = (key) => dict[lang][key] ?? dict[DEFAULT_LANG][key] ?? key;
  const locale = LANGS.find((l) => l.code === lang).locale;

  const exName = (ex) => {
    const cat = findExercise(ex);
    if (cat) return cat.name[lang];
    return typeof ex?.name === 'object' ? ex.name[lang] : ex?.name || '';
  };
  const catName = (key) => categories[key]?.[lang] || key || '';
  const muscleName = (key) => muscles[key]?.[lang] || key || '';
  const exMeta = (ex) => {
    const cat = findExercise(ex);
    if (!cat) return '';
    return catName(cat.cat) + (cat.muscle ? ` · ${muscleName(cat.muscle)}` : '');
  };

  return { lang, setLang, t, locale, exName, catName, muscleName, exMeta };
}
