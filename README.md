# Contrôle de la LED GPIO2 avec React et MQTT

Le firmware ESP32 rejoint votre Wi-Fi et un broker MQTT TLS. L’application React utilise MQTT sur WebSocket sécurisé (WSS). La carte et la page web échangent les commandes via le broker, sans exposer de port entrant sur le routeur.

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

```powershell
cd web
npm install
npm run dev
```

Pour créer la version statique à publier sur un hébergeur web :

```powershell
npm run build
```

Publiez le contenu de `web/dist`. Configurez les variables `VITE_MQTT_URL`, `VITE_MQTT_USERNAME` et `VITE_MQTT_PASSWORD` au moment du build sur l’hébergeur. Elles ne sont pas secrètes une fois intégrées dans le site : appliquez les mêmes restrictions ACL qu’au compte web de test.

La LED intégrée de nombreuses ESP32 DevKit V1 est reliée à GPIO2. La polarité peut varier selon la carte.
