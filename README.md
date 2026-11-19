# Contrôle de la LED GPIO2 avec React et MQTT

Le firmware ESP32 rejoint votre Wi-Fi et un broker MQTT TLS. L’application React utilise MQTT sur WebSocket sécurisé (WSS). La carte et la page web échangent les commandes via le broker, sans exposer de port entrant sur le routeur.

## Interface de couveuse

Le tableau de bord de couveuse est actuellement en mode démonstration (`VITE_USE_MOCKS=true`) : les mesures, profils et commandes de couveuse sont simulés et ne sont pas enregistrés sur un serveur. Dans **Commandes manuelles**, « Ventilation · LED GPIO2 » envoie `ON`/`OFF` sur MQTT et pilote la LED de l’ESP32. Aucun ventilateur physique n’est relié à cette commande. La page **LED GPIO2** permet aussi de tester directement la connexion MQTT.

En mode démo, l’inscription et la connexion sont enregistrées localement dans le navigateur ; elles ne sont pas partagées avec Netlify ni avec d’autres appareils. Cette authentification n’est pas sécurisée et ne convient pas à la protection de données privées ou au contrôle d’équipements réels.

## 1. Préparer le broker

Créez un broker MQTT qui fournit :

- une connexion MQTT TLS pour l’ESP32 (port généralement `8883`) ;
- une connexion MQTT sur WebSocket sécurisé pour le navigateur (URL `wss://...`) ;
- un certificat CA racine pour vérifier le certificat TLS côté ESP32 ;
- des utilisateurs et ACL distincts pour le firmware et le navigateur.

Utilisez les topics `esp32-devkit-v1/led/command`, `esp32-devkit-v1/led/state` et `esp32-devkit-v1/status`. Autorisez l’utilisateur de la carte à s’abonner à `esp32-devkit-v1/led/command` et à publier sur `esp32-devkit-v1/led/state` et `esp32-devkit-v1/status`. L’utilisateur web doit pouvoir publier sur `esp32-devkit-v1/led/command` et s’abonner aux deux autres topics.

**Important :** les identifiants `VITE_MQTT_*` de l’application web sont intégrés aux fichiers JavaScript et visibles par les visiteurs. Pour ce prototype, utilisez un compte dédié à faible privilège, limité à ces topics et à cette carte ; ne mettez jamais un compte administrateur ou des identifiants réutilisés dans l’application. Pour un déploiement public durable, placez l’authentification derrière un backend.

## 2. Configurer et téléverser l’ESP32

1. Copiez `include/secrets.example.h` sous le nom `include/secrets.h`.
2. Renseignez le Wi-Fi, l’hôte et le port MQTT, les identifiants du compte de la carte, et le certificat CA racine PEM du broker.
3. Compilez et téléversez avec PlatformIO pour `esp32doit-devkit-v1`.
4. Ouvrez le moniteur série à `115200` bauds pour vérifier la connexion.

`include/secrets.h` est ignoré par Git. Ne le publiez pas. Le firmware refuse une connexion MQTT si la CA n’est pas renseignée ; la vérification TLS reste activée.

## 3. Lancer ou publier l’application React

Dans `web`, copiez `.env.example` vers `.env.local`, puis renseignez l’URL MQTT WSS et les identifiants du compte web. L’URL est généralement fournie par votre service MQTT.

En mode `VITE_USE_MOCKS=true`, inscrivez-vous depuis la page de connexion ou utilisez un compte de démonstration. Les comptes sont conservés seulement dans le navigateur utilisé. Les mesures, profils et autres commandes de couveuse sont simulés et ne sont pas conservés après rechargement. Seule la commande « Ventilation · LED GPIO2 » et la page « LED GPIO2 » publient sur MQTT.

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

La LED intégrée de nombreuses ESP32 DevKit V1 est reliée à GPIO2. La polarité peut varier selon la carte.

## Firmware de la couveuse

Les modules C++ du dépôt `Mahenina01/incubateur_v1` sont maintenant directement dans `src/` et leur initialisation/boucle sont fusionnées avec le firmware MQTT de la LED dans `src/main.cpp`. La LED reste sur GPIO2 et conserve ses topics MQTT. Le point d’accès local de la couveuse utilise le mode AP+STA afin de ne pas couper la connexion Wi-Fi/MQTT lorsque l’AP est activé ou désactivé.

La configuration de l’écran prévoit son signal D/C sur GPIO5. Avant de téléverser et d’initialiser l’écran, déplace physiquement son fil D/C de GPIO2 vers GPIO5. GPIO5 est une broche de démarrage de l’ESP32 : vérifie le démarrage de la carte avec l’écran branché. Le capteur de niveau d’eau reste sur GPIO39, une entrée uniquement.

**Avant le téléversement :** les modules couveuse pilotent les sorties chauffage (GPIO25), ventilateur (GPIO26), humidificateur (GPIO27), pompe (GPIO17) et moteur (GPIO32/33), selon les capteurs et les réglages enregistrés. Vérifie le câblage, les relais et les sécurités avant de connecter des charges réelles.

Le module réseau Cloud attend une API REST et des identifiants `CLOUD_*` distincts de la liaison MQTT LED. Ils ne sont pas configurés ici ; les données de la couveuse ne sont donc pas encore envoyées à Vercel, dont le tableau de bord reste en mode démo.
