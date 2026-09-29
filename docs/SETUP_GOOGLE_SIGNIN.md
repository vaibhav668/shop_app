# Setting up Google Sign-In

This takes about 15 minutes in the Google Cloud Console. Until it's done, both apps work locally with the **development email sign-in**.

You'll create **one project** with **two OAuth clients**:

| Client | Type | Used by | Where the ID goes |
|---|---|---|---|
| Web client | Web application | Admin dashboard, **and** as the audience for the Android app's ID tokens | `GOOGLE_ALLOWED_CLIENT_IDS` (backend), `VITE_GOOGLE_CLIENT_ID` (admin), `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (mobile) |
| Android client | Android | Lets the Android app request a Google sign-in | Nowhere in code. Google matches it by package name + SHA-1. |

The mobile app asks Google for an ID token *for the web client*. That's why the backend only needs the web client ID.

## 1. Project and consent screen
1. Go to <https://console.cloud.google.com/> and create a project named **Bada Bazar**.
2. Open **APIs & Services → OAuth consent screen** (called "Google Auth Platform" in newer consoles).
   - User type: **External**.
   - App name: *Bada Bazar*. Support email: your email.
   - Scopes: the defaults (`openid`, `email`, `profile`) are enough.
   - While the app is in **Testing**, add your own Google account(s) under **Test users**.

## 2. Web client
1. **Credentials → Create credentials → OAuth client ID → Web application**.
2. Name: `Bada Bazar web`.
3. **Authorised JavaScript origins**: `http://localhost:5173` (admin) and `http://localhost:8081` (the customer app's web preview). Later also add `https://admin.<your-domain>`.
4. No redirect URIs are needed.
5. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`).

## 3. Android client
1. Get the SHA-1 of the signing key for the build you'll install:
   - **EAS development build**: run `npx eas-cli@latest credentials -p android` in `mobile/`, choose the *development* profile, and copy the **SHA1 Fingerprint**. You can also create the first build with step 5 below, then read the fingerprint from the same menu.
   - **Play Store builds (later)**: also add the **App signing key** SHA-1 from Play Console → Setup → App integrity. If this is missing, sign-in fails only in Play builds.
2. **Create credentials → OAuth client ID → Android**.
3. Package name: `com.badabazar.app`.
4. Paste the SHA-1 and create the client.

## 4. Put the IDs in place
```bash
# backend/.env
GOOGLE_ALLOWED_CLIENT_IDS=<web-client-id>

# admin/.env.local
VITE_GOOGLE_CLIENT_ID=<web-client-id>

# mobile/.env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>
```
Restart the backend and the dev servers after changing env files.

## 5. Build the Android development app
Google Sign-In is native code, so it can't run in Expo Go.
```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
```
Install the APK from the link EAS prints, then run `npx expo start` (without `--go`) and open the project in the installed app.

On a physical phone, the app can't reach `localhost`. Set `EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:8000/api/v1` and start the backend with `uvicorn app.main:app --reload --host 0.0.0.0`.

## Troubleshooting
| Symptom | Cause |
|---|---|
| `DEVELOPER_ERROR` on Android | Package name or SHA-1 doesn't match the Android client |
| `INVALID_GOOGLE_TOKEN` from the API | `GOOGLE_ALLOWED_CLIENT_IDS` doesn't contain the web client ID the app used |
| `GOOGLE_NOT_CONFIGURED` from the API | `GOOGLE_ALLOWED_CLIENT_IDS` is empty |
| Admin Google button shows an origin error | `http://localhost:5173` is missing from the web client's JavaScript origins |
| App web preview's Google button shows an origin error | `http://localhost:8081` is missing from the web client's JavaScript origins |
| Admin: "isn't a shop admin" | Run `python -m app.cli make-admin <email>` in `backend/` |
