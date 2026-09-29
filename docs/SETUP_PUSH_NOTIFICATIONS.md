# Setting up push notifications (Firebase)

Order updates ("Order confirmed", "Out for delivery", ...) are always saved to the customer's
in-app **Notifications** list. Sending them to the phone as a push needs Firebase Cloud
Messaging (FCM). Until it is set up, the backend uses `PUSH_PROVIDER=fake`, which only logs.

You need a Google account. Firebase's free (Spark) plan is enough.

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> → **Add project** → name it `Bada Bazar`.
   Google Analytics is optional (you can turn it off).
2. In the project, click the **Android** icon to add an app:
   - **Package name:** `com.badabazar.app` (must match `mobile/app.config.ts`)
   - Nickname: `Bada Bazar`
   - SHA-1: not needed for push; skip
3. Download **`google-services.json`** and put it at `mobile/google-services.json`.
   It is git-ignored. Skip the "add Firebase SDK" steps: Expo handles them.

## 2. Give the backend permission to send

1. Firebase console → ⚙ **Project settings** → **Service accounts** → **Generate new private key**.
2. Save the file as `backend/firebase-credentials.json` (git-ignored). **Never commit or share it.**
3. In `backend/.env`:
   ```
   PUSH_PROVIDER=fcm
   FIREBASE_CREDENTIALS_FILE=firebase-credentials.json
   ```
4. Restart the backend.

The Firebase Cloud Messaging API (V1) is enabled by default for new projects. If pushes fail
with `403`, enable it at Project settings → **Cloud Messaging**.

## 3. Build the app with Firebase inside

Push needs native code, so **Expo Go and the web preview can't receive pushes**. Make a new
development build (the old one doesn't include notifications):

```powershell
cd mobile
# One-time: upload google-services.json as an EAS secret file, so cloud builds get it too.
npx eas-cli@latest env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment development --environment preview --environment production
npx eas-cli@latest build --profile development --platform android
```

Install the new build on your phone, sign in, and place an order. After the order the app asks
for permission to send notifications; allow it.

## 4. Check it works

1. In the admin, open the order and click **Accept order**.
2. The phone shows "Order confirmed" within a few seconds (even with the app closed).
3. Tapping it opens that order.

If nothing arrives:
- Backend log says `push (fake)`: `PUSH_PROVIDER` is still `fake`.
- Phone never asked for permission: Android settings → Apps → Bada Bazar → Notifications.
- The app's Account → Notifications list shows the update but no push came: the build doesn't
  have `google-services.json` (rebuild after step 3), or the key file path is wrong.

## For deployment (Phase 12)

- Store the service-account key as a **secret file** on the host and set
  `FIREBASE_CREDENTIALS_FILE` to its path. Staging and production refuse to start with
  `PUSH_PROVIDER=fake`.
- Production builds get `google-services.json` from the same EAS secret.
