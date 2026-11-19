

function calculerDateFin(dateDebut, dureeJours) {
  if (!dateDebut || dureeJours === null || dureeJours === undefined || dureeJours === '') {
    return null;
  }

  const duree = Number(dureeJours);

  if (!Number.isFinite(duree) || duree < 0) {
    return null;
  }

  const match = String(dateDebut).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const [, annee, mois, jour] = match;
  const date = new Date(Date.UTC(
    Number(annee),
    Number(mois) - 1,
    Number(jour) + Math.floor(duree),
    0,
    0,
    0,
  ));

  return `${date.toISOString().slice(0, 19)}+03:00`;
}

function actualiserDateFinIncubation(incubateur) {
  if (!incubateur) return incubateur;

  const dateFin = calculerDateFin(
    incubateur.date_debut_incubation,
    incubateur.duree_jours,
  );

  return dateFin
    ? { ...incubateur, date_fin_incubation: dateFin }
    : incubateur;
}

function calculerJourActuel(dateDebut) {
  const debut = new Date(dateDebut);
  const maintenant = new Date();
  const diffEnMs = maintenant - debut;
  const diffEnJours = Math.floor(diffEnMs / (1000 * 60 * 60 * 24));
  return Math.max(diffEnJours + 1, 1);
}

function calculerProchainJourRetournement(jourActuel, joursRetournement) {
  if (!joursRetournement || joursRetournement.length === 0) return null;
  const sorted = [...joursRetournement].sort((a, b) => a - b);
  for (const jour of sorted) {
    if (jour > jourActuel) {
      return jour;
    }
  }
  return null;
}

function calculerDateProchainRetournement(dateDebut, jourRetournement) {
  if (!jourRetournement) return null;
  const date = new Date(dateDebut);
  date.setDate(date.getDate() + (jourRetournement - 1));
  date.setHours(10, 0, 0, 0);
  while (date.getTime() < Date.now()) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().replace('Z', '+03:00');
}

function genererJoursRetournement(jourArret) {
  const jours = [];
  for (let i = 2; i <= jourArret; i += 2) {
    jours.push(i);
  }
  return jours;
}


const INCUBATORS = [
  {
    id: 1,
    nom: "Incubateur A - Poules",
    espece_active: "Poule",
    date_debut_incubation: "2026-08-25T00:00:00+03:00",
    date_fin_incubation: "",
    duree_jours: 21,
    temperature: 37.6,
    humidite: 58.0,
    niveau_eau: "ok",
    pwm_chauffage: 42,
    etat_ventilateur_brassage: "on",
    etat_ventilateur_extraction: "off",
    etat_pompe: "on",
    alimentation: "secteur",
    hors_ligne_depuis: null,
    consigne_temperature: 37.5,
    consigne_humidite_min: 55,
    consigne_humidite_max: 60,
    jours_retournement: [2, 4, 6, 8, 10, 12, 14, 16, 18],
    jour_arret_retournement: 18,
    active: true,
    statut: "en_cours"
  },
  {
    id: 2,
    nom: "Incubateur B - Canards",
    espece_active: "Canard",
    date_debut_incubation: "2026-09-01T00:00:00+03:00",
    date_fin_incubation: "",
    duree_jours: 28,
    temperature: 37.5,
    humidite: 56.0,
    niveau_eau: "ok",
    pwm_chauffage: 38,
    etat_ventilateur_brassage: "on",
    etat_ventilateur_extraction: "on",
    etat_pompe: "off",
    alimentation: "secteur",
    hors_ligne_depuis: null,
    consigne_temperature: 37.5,
    consigne_humidite_min: 55,
    consigne_humidite_max: 60,
    jours_retournement: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 25],
    jour_arret_retournement: 25,
    active: true,
    statut: "en_cours"
  },
  {
    id: 3,
    nom: "Incubateur C - Cailles",
    espece_active: "Caille",
    date_debut_incubation: '2026-09-10T00:00:00+03:00',
    date_fin_incubation: '',
    duree_jours: 18,
    temperature: 22.0,
    humidite: 45.0,
    niveau_eau: "bas",
    pwm_chauffage: 0,
    etat_ventilateur_brassage: "off",
    etat_ventilateur_extraction: "off",
    etat_pompe: "off",
    alimentation: "secteur",
    hors_ligne_depuis: null,
    consigne_temperature: 37.5,
    consigne_humidite_min: 45,
    consigne_humidite_max: 50,
    jours_retournement: [2, 4, 6, 8, 10, 12, 14, 15],
    jour_arret_retournement: 15,
    active: false,
    statut: "inactif"
  },
  {
    id: 4,
    nom: "Incubateur D - Dindes",
    espece_active: "Dinde",
    date_debut_incubation: "2026-08-20T00:00:00+03:00",
    date_fin_incubation: "",
    duree_jours: 28,
    temperature: 37.4,
    humidite: 57.0,
    niveau_eau: "ok",
    pwm_chauffage: 45,
    etat_ventilateur_brassage: "on",
    etat_ventilateur_extraction: "off",
    etat_pompe: "on",
    alimentation: "batterie",
    hors_ligne_depuis: "2026-09-09T08:00:00+03:00",
    consigne_temperature: 37.5,
    consigne_humidite_min: 55,
    consigne_humidite_max: 60,
    jours_retournement: [3, 6, 9, 12, 15, 18, 21, 24, 25],
    jour_arret_retournement: 25,
    active: true,
    statut: "en_cours"
  },
];

INCUBATORS.forEach((incubateur, index) => {
  INCUBATORS[index] = actualiserDateFinIncubation(incubateur);
});


const mockProfiles = [
  { 
    id: 1, 
    nom: "Poule", 
    duree_jours: 21, 
    temperature_min: 37.5, 
    temperature_max: 37.8, 
    humidite_phase1: "55-60%", 
    humidite_phase2: "65-75%", 
    jour_arret_retournement: 18,
    jours_retournement: [2, 4, 6, 8, 10, 12, 14, 16, 18]
  },
  { 
    id: 2, 
    nom: "Canard", 
    duree_jours: 28, 
    temperature_min: 37.5, 
    temperature_max: 37.5, 
    humidite_phase1: "55-60%", 
    humidite_phase2: "70-80%", 
    jour_arret_retournement: 25,
    jours_retournement: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 25]
  },
  { 
    id: 3, 
    nom: "Oie", 
    duree_jours: 29, 
    temperature_min: 37.5, 
    temperature_max: 37.5, 
    humidite_phase1: "55-65%", 
    humidite_phase2: "75-80%", 
    jour_arret_retournement: 27,
    jours_retournement: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 27]
  },
  { 
    id: 4, 
    nom: "Caille", 
    duree_jours: 18, 
    temperature_min: 37.5, 
    temperature_max: 37.8, 
    humidite_phase1: "45-50%", 
    humidite_phase2: "65-70%", 
    jour_arret_retournement: 15,
    jours_retournement: [2, 4, 6, 8, 10, 12, 14, 15]
  },
  { 
    id: 5, 
    nom: "Dinde", 
    duree_jours: 28, 
    temperature_min: 37.5, 
    temperature_max: 37.5, 
    humidite_phase1: "55-60%", 
    humidite_phase2: "65-75%", 
    jour_arret_retournement: 25,
    jours_retournement: [3, 6, 9, 12, 15, 18, 21, 24, 25]
  },
];


const mockAlarms = {
  1: [
    { id: 1, type: 'temperature_haute', message: 'Température trop élevée: 38.2°C', timestamp: '2026-09-04 14:32:00+03:00', active: false, severity: 'critique' },
    { id: 2, type: 'niveau_eau_bas', message: "Niveau d'eau critique", timestamp: '2026-09-04 13:15:00+03:00', active: false, severity: 'élevée' },
  ],
  2: [
    { id: 3, type: 'humidite_basse', message: 'Humidité inférieure à 50%', timestamp: '2026-09-04 12:00:00+03:00', active: false, severity: 'moyenne' },
  ],
  3: [
    { id: 4, type: 'temperature_basse', message: 'Température trop basse: 22.0°C', timestamp: '2026-09-04 11:00:00+03:00', active: true, severity: 'élevée' },
    { id: 5, type: 'niveau_eau_bas', message: "Niveau d'eau critique", timestamp: '2026-09-04 10:30:00+03:00', active: true, severity: 'critique' },
  ],
  4: [
    { id: 6, type: 'alimentation_batterie', message: 'Bascule sur batterie de secours', timestamp: '2026-09-04 08:00:00+03:00', active: true, severity: 'élevée' },
  ],
};


function generateMockMesures(incubatorId, dateDebut, dureeJours) {
  const mesures = [];
  const startDate = new Date(dateDebut || "2026-08-25T00:00:00Z");
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (dureeJours || 21));
  
  let currentDate = new Date(startDate);
  let dayCount = 0;
  const maxPoints = 100;
  
  while (currentDate <= endDate && dayCount < maxPoints) {
    const baseTemp = 37.5;
    const baseHumidite = 58;
    const variationTemp = (Math.random() - 0.5) * 0.6;
    const variationHumidite = (Math.random() - 0.5) * 4;
    
    let humiditeOffset = 0;
    if (dayCount < 10) {
      humiditeOffset = -3;
    } else if (dayCount > 15) {
      humiditeOffset = +5;
    }
    
    const incubatorOffset = (incubatorId % 3) * 0.1;
    
    mesures.push({
      timestamp: currentDate.toISOString(),
      temperature: Math.round((baseTemp + variationTemp + incubatorOffset) * 10) / 10,
      humidite: Math.round((baseHumidite + variationHumidite + humiditeOffset + (incubatorId * 0.5)) * 10) / 10,
      pwm_chauffage: Math.round(35 + Math.random() * 20 + (incubatorId * 2))
    });
    
    currentDate.setHours(currentDate.getHours() + 4);
    dayCount++;
  }
  
  return mesures;
}

const mockMesures = {};
INCUBATORS.forEach(inc => {
  mockMesures[inc.id] = generateMockMesures(inc.id, inc.date_debut_incubation, inc.duree_jours);
});


let currentIncubatorId = 1;
let updateCount = 0;
let customProfiles = [];


function getUpdatedStatusForIncubator(incubatorId) {
  const baseIncubator = actualiserDateFinIncubation(
    INCUBATORS.find(inc => inc.id === incubatorId),
  );
  if (!baseIncubator) return null;

  updateCount++;
  const baseTemp = baseIncubator.temperature || 37.6;
  const baseHumidite = baseIncubator.humidite || 58.0;
  const cycle = Math.sin(updateCount * 0.01 + incubatorId) * 0.2;
  
  const dateDebut = baseIncubator.date_debut_incubation;
  const jourActuel = dateDebut ? calculerJourActuel(dateDebut) : 0;
  const joursRetournement = baseIncubator.jours_retournement || [];
  const prochainJour = calculerProchainJourRetournement(jourActuel, joursRetournement);
  const prochainDate = dateDebut ? calculerDateProchainRetournement(dateDebut, prochainJour) : null;

  return {
    ...baseIncubator,
    temperature: Math.round((baseTemp + cycle) * 10) / 10,
    humidite: Math.round((baseHumidite + cycle * 3) * 10) / 10,
    pwm_chauffage: Math.round((baseIncubator.pwm_chauffage || 42) + cycle * 10),
    jour_incubation: jourActuel,
    prochain_retournement: prochainDate,
    prochain_jour_retournement: prochainJour,
    niveau_eau: Math.random() > 0.15 ? 'ok' : 'bas',
  };
}


export async function getMockResponse(path, options = {}) {
  await new Promise((r) => setTimeout(r, 150));


  if (path === "/incubators") {
    return INCUBATORS.map(inc => ({
      id: inc.id,
      nom: inc.nom,
      espece_active: inc.espece_active,
      active: inc.active,
      statut: inc.statut,
      date_debut_incubation: inc.date_debut_incubation,
      date_fin_incubation: inc.date_fin_incubation,
    }));
  }

  const incubatorMatch = path.match(/^\/incubators\/(\d+)$/);
  if (incubatorMatch) {
    const id = parseInt(incubatorMatch[1]);
    const status = getUpdatedStatusForIncubator(id);
    if (status) {
      return status;
    }
    throw new Error("Couveuse non trouvée");
  }

  if (path === "/incubators" && options.method === "POST") {
    const body = JSON.parse(options.body || "{}");
    const newIncubator = actualiserDateFinIncubation({
      id: INCUBATORS.length + 100,
      ...body,
      active: body.active !== undefined ? body.active : false,
      statut: body.statut || "inactif",
    });
    INCUBATORS.push(newIncubator);
    return { success: true, incubator: newIncubator };
  }

  const updateMatch = path.match(/^\/incubators\/(\d+)$/);
  if (updateMatch && options.method === "PUT") {
    const id = parseInt(updateMatch[1]);
    const body = JSON.parse(options.body || "{}");
    const index = INCUBATORS.findIndex(inc => inc.id === id);
    if (index === -1) throw new Error("Couveuse non trouvée");
    
    INCUBATORS[index] = actualiserDateFinIncubation({
      ...INCUBATORS[index],
      ...body,
    });
    return { success: true, incubator: INCUBATORS[index] };
  }

  const deleteMatch = path.match(/^\/incubators\/(\d+)$/);
  if (deleteMatch && options.method === "DELETE") {
    const id = parseInt(deleteMatch[1]);
    const index = INCUBATORS.findIndex(inc => inc.id === id);
    if (index === -1) throw new Error("Couveuse non trouvée");
    
    INCUBATORS.splice(index, 1);
    return { success: true };
  }

  const alarmsMatch = path.match(/^\/incubators\/(\d+)\/alarms$/);
  if (alarmsMatch) {
    const id = parseInt(alarmsMatch[1]);
    return mockAlarms[id] || [];
  }

  const mesuresMatch = path.match(/^\/incubators\/(\d+)\/mesures$/);
  if (mesuresMatch || path.includes("/mesures?")) {
    let id = 1;
    if (mesuresMatch) {
      id = parseInt(mesuresMatch[1]);
    }
    
    const range = options.params?.range || '24h';
    const now = new Date();
    let limit = 24;
    
    if (range === '1h') limit = 1;
    else if (range === '24h') limit = 24;
    else if (range === '7d') limit = 168;
    else if (range === '30d') limit = 720;
    
    const mesures = mockMesures[id] || [];
    const filtered = mesures.filter(m => {
      const date = new Date(m.timestamp);
      const diffHours = (now - date) / (1000 * 60 * 60);
      return diffHours <= limit;
    });
    
    return filtered.length > 0 ? filtered : mesures.slice(-24);
  }


  const pumpMatch = path.match(/^\/incubators\/(\d+)\/command\/pump$/);
  if (pumpMatch && options.method === "POST") {
    const id = parseInt(pumpMatch[1]);
    const body = JSON.parse(options.body || "{}");
    const incubator = INCUBATORS.find(inc => inc.id === id);
    if (incubator) {
      incubator.etat_pompe = body.state || 'on';
      return { success: true, message: `Commande pompe envoyée pour la couveuse ${id}` };
    }
    return { success: false, message: "Couveuse non trouvée" };
  }

  const motorMatch = path.match(/^\/incubators\/(\d+)\/command\/motor$/);
  if (motorMatch && options.method === "POST") {
    const id = parseInt(motorMatch[1]);
    const body = JSON.parse(options.body || "{}");
    const incubator = INCUBATORS.find(inc => inc.id === id);
    if (incubator) {
      return { success: true, message: `Commande moteur envoyée pour la couveuse ${id}` };
    }
    return { success: false, message: "Couveuse non trouvée" };
  }

  const extractMatch = path.match(/^\/incubators\/(\d+)\/command\/extraction$/);
  if (extractMatch && options.method === "POST") {
    const id = parseInt(extractMatch[1]);
    const body = JSON.parse(options.body || "{}");
    const incubator = INCUBATORS.find(inc => inc.id === id);
    if (incubator) {
      incubator.etat_ventilateur_extraction = body.state || 'on';
      return { success: true, message: `Commande extraction envoyée pour la couveuse ${id}` };
    }
    return { success: false, message: "Couveuse non trouvée" };
  }


  if (path === "/profiles") {
    if (options.method === "POST") {
      const body = JSON.parse(options.body || "{}");
      const newProfile = {
        ...body,
        id: Date.now(),
        jours_retournement: body.jours_retournement || genererJoursRetournement(body.jour_arret_retournement)
      };
      customProfiles.push(newProfile);
      return { success: true, profile: newProfile };
    }
    return [...mockProfiles, ...customProfiles];
  }


  if (path === "/auth/login" && options.method === "POST") {
    const body = JSON.parse(options.body || "{}");
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      const err = new Error("Veuillez renseigner votre email et votre mot de passe");
      err.code = "MISSING_FIELDS";
      throw err;
    }

    const mockUsers = [
      { id: 1, email: "admin@smartincubator.com", password: "admin123", name: "Admin", role: "admin" },
      { id: 2, email: "operateur@smartincubator.com", password: "operateur123", name: "Opérateur", role: "opérateur" },
    ];

    const user = mockUsers.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      const err = new Error("Aucun compte ne correspond à cet email");
      err.code = "ACCOUNT_NOT_FOUND";
      throw err;
    }

    if (user.password !== password) {
      const err = new Error("Mot de passe incorrect");
      err.code = "INVALID_PASSWORD";
      throw err;
    }

    const { password: _omit, ...safeUser } = user;
    return { success: true, user: safeUser, token: `mock-token-${user.id}` };
  }

  
  if (path === "/status") {
    return getUpdatedStatusForIncubator(currentIncubatorId);
  }

  if (path === "/alarms") {
    return mockAlarms[currentIncubatorId] || [];
  }

  if (path === "/mesures" || path.startsWith("/mesures?")) {
    const range = options.params?.range || '24h';
    const now = new Date();
    let limit = 24;
    
    if (range === '1h') limit = 1;
    else if (range === '24h') limit = 24;
    else if (range === '7d') limit = 168;
    else if (range === '30d') limit = 720;
    
    const mesures = mockMesures[currentIncubatorId] || [];
    const filtered = mesures.filter(m => {
      const date = new Date(m.timestamp);
      const diffHours = (now - date) / (1000 * 60 * 60);
      return diffHours <= limit;
    });
    
    return filtered.length > 0 ? filtered : mesures.slice(-24);
  }

  if (path === "/actuators/pump" && options.method === "POST") {
    return { success: true, message: "Commande pompe envoyée" };
  }

  if (path === "/actuators/motor" && options.method === "POST") {
    return { success: true, message: "Commande moteur envoyée" };
  }

  if (path === "/setpoints" && options.method === "POST") {
    return { success: true, message: "Consigne mise à jour" };
  }

  return {};
}


export function setCurrentIncubatorId(id) {
  currentIncubatorId = id;
}

export function getCurrentIncubatorId() {
  return currentIncubatorId;
}

export function getIncubators() {
  return INCUBATORS;
}