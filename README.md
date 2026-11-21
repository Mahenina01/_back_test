# Supervision du capteur de vibration KY-002 avec React et MQTT

Le firmware ESP32 rejoint votre Wi-Fi et un broker MQTT TLS. L’application React utilise MQTT sur WebSocket sécurisé (WSS). La carte publie l’état du capteur via le broker pour l’afficher sur la page web, sans exposer de port entrant sur le routeur.

## Interface de couveuse

L’application utilise le backend configuré par `VITE_API_URL` pour l’authentification et les données de couveuse. Le mode de démonstration est désactivé par défaut (`VITE_USE_MOCKS=false`) : sans backend disponible, les données ne sont pas remplacées par des valeurs fictives. Le KY-002 connecté à GPIO2 publie son état de vibration sur MQTT, affiché dans la page « Capteur KY-002 ».

L’inscription et la connexion passent par le backend réel. Les mesures réelles nécessitent que ce backend soit configuré et alimenté par l’équipement ; le mode démo ne constitue pas une source de données.

## 1. Préparer le broker

Créez un broker MQTT qui fournit :

- une connexion MQTT TLS pour l’ESP32 (port généralement `8883`) ;
- une connexion MQTT sur WebSocket sécurisé pour le navigateur (URL `wss://...`) ;
- un certificat CA racine pour vérifier le certificat TLS côté ESP32 ;
- des utilisateurs et ACL distincts pour le firmware et le navigateur.

Utilisez les topics `esp32-devkit-v1/vibration/state` et `esp32-devkit-v1/status`. Autorisez l’utilisateur de la carte à publier sur ces deux topics. L’utilisateur web doit pouvoir s’y abonner.

**Important :** les identifiants `VITE_MQTT_*` de l’application web sont intégrés aux fichiers JavaScript et visibles par les visiteurs. Pour ce prototype, utilisez un compte dédié à faible privilège, limité à ces topics et à cette carte ; ne mettez jamais un compte administrateur ou des identifiants réutilisés dans l’application. Pour un déploiement public durable, placez l’authentification derrière un backend.

## 2. Configurer et téléverser l’ESP32

1. Copiez `include/secrets.example.h` sous le nom `include/secrets.h`.
2. Renseignez le Wi-Fi, l’hôte et le port MQTT, les identifiants du compte de la carte, et le certificat CA racine PEM du broker.
3. Compilez et téléversez avec PlatformIO pour `esp32doit-devkit-v1`.
4. Ouvrez le moniteur série à `115200` bauds pour vérifier la connexion.

`include/secrets.h` est ignoré par Git. Ne le publiez pas. Le firmware refuse une connexion MQTT si la CA n’est pas renseignée ; la vérification TLS reste activée.

## 3. Lancer ou publier l’application React

Dans `web`, copiez `.env.example` vers `.env.local`, puis renseignez l’URL du backend (`VITE_API_URL`), l’URL MQTT WSS et les identifiants du compte web. L’URL MQTT WSS est généralement fournie par votre service MQTT. Gardez `VITE_USE_MOCKS=false` pour ne pas afficher de données de démonstration.

Connectez-vous avec un compte géré par le backend. Les mesures et fonctions de gestion de la couveuse nécessitent que ce backend fournisse les routes API utilisées par l’application. L’état du capteur de vibration est reçu directement par MQTT.

```powershell
cd web
npm install
npm run dev
```

Pour créer la version statique :

```powershell
npm run build
```

## 4. Mettre le site en ligne avec Vercel

### Avec GitHub (déploiement automatique)

1. Envoyez le projet sur un dépôt GitHub et importez ce dépôt dans Vercel.
2. Dans les réglages du projet Vercel, choisissez `web` comme **Root Directory**. Vercel détecte Vite ; la commande de build est `npm run build` et le dossier de sortie `dist`.
3. Ajoutez `VITE_USE_MOCKS=true`, `VITE_MQTT_URL`, `VITE_MQTT_USERNAME` et `VITE_MQTT_PASSWORD` dans **Settings → Environment Variables**. Cochez **Production** (et **Preview** si nécessaire).
4. Lancez le déploiement. Chaque push ultérieur déclenchera automatiquement un nouveau déploiement.

### Avec la CLI Vercel (sans dépôt GitHub)

Depuis la racine du projet, ouvrez PowerShell :

```powershell
cd web
npx vercel@latest login
npx vercel@latest
```

La première commande ouvre l’authentification ; la seconde lie le projet Vercel et crée un déploiement Preview. Ajoutez ensuite les trois variables ci-dessus dans les réglages Vercel, puis publiez en Production :

```powershell
npx vercel@latest --prod
```

Les changements de variables d’environnement prennent effet au prochain build/déploiement.

**Sécurité :** les valeurs `VITE_*` sont intégrées au JavaScript livré au navigateur ; elles sont lisibles par les visiteurs, même si elles sont configurées dans les réglages Vercel. Utilisez un compte MQTT web dédié, à privilèges minimaux et limité aux topics décrits plus haut. Ne placez jamais un mot de passe administrateur ou réutilisé dans ces variables.

## Firmware de la couveuse

Les modules C++ du dépôt `Mahenina01/incubateur_v1` sont maintenant directement dans `src/` et leur initialisation/boucle sont fusionnées avec le firmware MQTT dans `src/main.cpp`. Le KY-002 remplace la LED sur GPIO2 : reliez sa sortie S à GPIO2, son alimentation à 3,3 V et GND à GND. Le firmware interprète un niveau HIGH comme une vibration détectée, filtre les changements pendant 20 ms et publie `ON`/`OFF` sur `esp32-devkit-v1/vibration/state` (état conservé). Le point d’accès local de la couveuse utilise le mode AP+STA afin de ne pas couper la connexion Wi-Fi/MQTT lorsque l’AP est activé ou désactivé.

La configuration de l’écran prévoit son signal D/C sur GPIO5. Vérifiez que le fil D/C de l’écran est sur GPIO5 et non sur GPIO2, désormais utilisé par le KY-002. GPIO5 est une broche de démarrage de l’ESP32 : vérifiez le démarrage de la carte avec l’écran branché. Le capteur de niveau d’eau reste sur GPIO39, une entrée uniquement.

**Avant le téléversement :** les modules couveuse pilotent les sorties chauffage (GPIO25), ventilateur (GPIO26), humidificateur (GPIO27), pompe (GPIO17) et moteur (GPIO32/33), selon les capteurs et les réglages enregistrés. Vérifie le câblage, les relais et les sécurités avant de connecter des charges réelles.

Le module réseau Cloud attend une API REST et des identifiants `CLOUD_*` distincts de la liaison MQTT du capteur. Ils ne sont pas configurés ici ; les données de la couveuse ne sont donc pas encore envoyées à Vercel, dont le tableau de bord reste en mode démo.
